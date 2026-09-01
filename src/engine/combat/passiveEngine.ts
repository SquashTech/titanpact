// The Passives contract's runtime half (content.ts's PassiveDefinition is the
// data half — CLAUDE.md's "abilities" contract, first implemented here).
// Mirrors statusEngine.ts's discipline: pure, generic functions reading
// PassiveDefinition flags off held passives, no per-passive special cases.
//
// Two integration families, matching PassiveDefinition's two effect shapes:
//   - resolvePassiveReactions: event-reactive. Scans a batch of just-produced
//     CombatEvents (resolveRound.ts passes each checkpoint's own new slice,
//     not the whole round) for hook matches, generalizing the exact pattern
//     detonateTriggeredStatuses already uses for Conduct (match a
//     generic flag, run a generic effect) — keyed off real event types
//     instead of move type.
//   - collectPassiveDamageModifiers: synchronous. Evaluated BEFORE a hit is
//     rolled, contributing to the damage pipeline's DamageModifier
//     accumulator (damagePipeline.ts) — never a reaction to a past event.
//
// resolveBattleStartEntries is a third, small entry point rather than a third
// family: it is resolvePassiveReactions run against a SYNTHESISED SwitchedIn
// context for the combatants a fight opens with, because those never produce a
// real SwitchedIn event (they are placed, not switched in). See its own doc.

import type { HeroLookup, CombatState, Combatant, Side } from '../state';
import { getMaxHp } from '../state';
import type { FieldEffectDefinition, PassiveDefinition, PassiveId, PassiveEffect, PassiveEffectTarget, PassiveTriggerCondition, PassiveAmount, StatusDefinition, MoveDefinition } from '../content';
import type { CombatEvent } from '../events';
import type { DamageModifier } from '../damage/damagePipeline';
import { applyHpDelta } from './faintHandling';
import { applyStatus } from './statusEngine';
import { setFieldEffect } from './fieldEffectEngine';

/** Generic field-read off a CombatEvent (or, for damage modifiers, a synthetic pre-roll context) by name — same discipline as StatusDefinition's flag-driven matching, just against event shape instead of move.type. */
type TriggerContext = Record<string, unknown>;

function matchesFields(eventFieldEquals: Partial<Record<string, string>> | undefined, context: TriggerContext): boolean {
  if (!eventFieldEquals) return true;
  return Object.entries(eventFieldEquals).every(([key, value]) => String(context[key]) === value);
}

function relationHolds(relation: PassiveTriggerCondition['relativeTo'], ownerId: string, ownerSide: Side, subjectId: string | undefined, subjectSide: Side | undefined): boolean {
  if (!subjectId || !subjectSide) return false; // every currently-supported PassiveHook always has a subject — kept as a safe default, not a real case
  switch (relation) {
    case 'self':
      return subjectId === ownerId;
    case 'ally':
      return subjectSide === ownerSide && subjectId !== ownerId;
    case 'enemy':
      return subjectSide !== ownerSide;
  }
}

/** The shared matcher: relation (who the triggering event's subject is, relative to the owner) AND every declared field equality must hold. */
export function matchesTrigger(
  condition: PassiveTriggerCondition,
  context: TriggerContext,
  ownerId: string,
  ownerSide: Side,
  subjectId: string | undefined,
  subjectSide: Side | undefined
): boolean {
  return relationHolds(condition.relativeTo, ownerId, ownerSide, subjectId, subjectSide) && matchesFields(condition.eventFieldEquals, context);
}

/**
 * Which combatant a CombatEvent is "about", for relational matching — from
 * the perspective the condition asked for (content.ts
 * PassiveTriggerCondition.subjectRole).
 *
 * The default 'target' role is the DEFENDER perspective: DamageDealt's
 * subject is the target rather than the source, so the hook reads "when an
 * enemy/ally is hit, do X". SwitchedIn's subject is the INCOMING combatant,
 * not the one leaving — an entry hook is about who arrived.
 *
 * The 'source' role is the ACTOR perspective ("when I deal damage / when I
 * afflict"), and only the two events that carry an actor can answer it.
 * Everything else — SwitchedIn, StatusTicked, a StatusApplied with no actor
 * behind it — returns undefined, which relationHolds already reads as no
 * match, so a source-role passive is silent rather than wrong.
 *
 * Event types outside PassiveHook return undefined too — harmless, since the
 * hook match already filters them out before subjectOf is ever consulted.
 */
function subjectOf(event: CombatEvent, role: 'target' | 'source'): string | undefined {
  if (role === 'source') {
    switch (event.type) {
      case 'StatusApplied':
        return event.sourceCombatantId;
      case 'DamageDealt':
        return event.sourceCombatantId;
      default:
        return undefined;
    }
  }
  switch (event.type) {
    case 'StatusTicked':
    case 'StatusApplied':
      return event.combatantId;
    case 'DamageDealt':
      return event.targetCombatantId;
    case 'SwitchedIn':
      return event.inCombatantId;
    default:
      return undefined;
  }
}

function resolveAmount(amount: PassiveAmount, context: TriggerContext): number {
  if (amount.kind === 'flat') return amount.value;
  const base = typeof context.amount === 'number' ? context.amount : 0;
  return Math.round(base * (amount.multiplier ?? 1));
}

function resolveEffect(
  state: CombatState,
  round: number,
  heroes: HeroLookup,
  statusDefs: Record<string, StatusDefinition>,
  fieldEffectDefs: Record<string, FieldEffectDefinition>,
  ownerId: string,
  subjectId: string | undefined,
  effect: PassiveEffect,
  context: TriggerContext
): { state: CombatState; events: CombatEvent[] } {
  // Global, so unlike the other three effect kinds it has no target combatant
  // to resolve — handled before the targetId lookup below, which the other
  // three all rely on.
  if (effect.kind === 'setFieldEffect') {
    if (!fieldEffectDefs[effect.fieldEffectId]) return { state, events: [] };
    return setFieldEffect(state, round, effect.fieldEffectId);
  }

  // A group target ('activeEnemies') resolves the same effect once per
  // member, in slot order, threading state through — so one trigger emits N
  // state-change events after its single PassiveTriggered. The two singular
  // targets are the one-element case of exactly this loop.
  let working = state;
  const produced: CombatEvent[] = [];
  for (const targetId of resolveTargetIds(state, ownerId, subjectId, effect.target)) {
    const target = working.combatants[targetId];
    if (!target || target.fainted) continue;
    const resolved = resolveEffectOn(working, round, heroes, statusDefs, ownerId, targetId, target, effect, context);
    working = resolved.state;
    produced.push(...resolved.events);
  }
  return { state: working, events: produced };
}

/** The combatant(s) an effect's `target` names, relative to the passive's owner. Missing/absent ids are simply not returned — the caller skips fainted members too. */
function resolveTargetIds(state: CombatState, ownerId: string, subjectId: string | undefined, target: PassiveEffectTarget): string[] {
  switch (target) {
    case 'self':
      return [ownerId];
    case 'triggerSubject':
      return subjectId ? [subjectId] : [];
    case 'activeEnemies': {
      const ownerSide = state.combatants[ownerId]?.side;
      if (!ownerSide) return [];
      const enemySide: Side = ownerSide === 'A' ? 'B' : 'A';
      return state.active[enemySide].filter((id): id is string => id !== null);
    }
  }
}

/** One effect, one already-resolved living target — the body the target loop above runs per member. */
function resolveEffectOn(
  state: CombatState,
  round: number,
  heroes: HeroLookup,
  statusDefs: Record<string, StatusDefinition>,
  ownerId: string,
  targetId: string,
  target: Combatant,
  effect: Exclude<PassiveEffect, { kind: 'setFieldEffect' }>,
  context: TriggerContext
): { state: CombatState; events: CombatEvent[] } {
  switch (effect.kind) {
    case 'heal': {
      const amount = resolveAmount(effect.amount, context);
      if (amount <= 0) return { state, events: [] };
      const maxHp = getMaxHp(heroes[target.heroId], target);
      return applyHpDelta(state, round, targetId, amount, maxHp);
    }
    case 'applyStatus': {
      const def = statusDefs[effect.statusId];
      if (!def) return { state, events: [] };
      // The passive's OWNER is the actor here — a passive that applies a
      // status is that hero doing it, which is what lets a source-role passive
      // (subjectRole 'source') see a status another passive planted.
      return applyStatus(state, round, targetId, def, { magnitude: effect.magnitude, duration: effect.duration, sourceCombatantId: ownerId });
    }
    case 'statDelta': {
      const newValue = (target.statModifiers[effect.stat] ?? 0) + effect.amount;
      const nextState: CombatState = {
        ...state,
        combatants: { ...state.combatants, [targetId]: { ...target, statModifiers: { ...target.statModifiers, [effect.stat]: newValue } } },
      };
      return { state: nextState, events: [{ type: 'StatChanged', round, combatantId: targetId, stat: effect.stat, delta: effect.amount, newValue }] };
    }
  }
}

/** Marks a once-per-fight reaction spent on its owner's held instance (state.ts PassiveInstance.firedThisFight). No-ops if the owner or the instance is gone. */
function markFired(state: CombatState, ownerId: string, passiveId: PassiveId): CombatState {
  const owner = state.combatants[ownerId];
  const instance = owner?.passives[passiveId];
  if (!owner || !instance) return state;
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [ownerId]: { ...owner, passives: { ...owner.passives, [passiveId]: { ...instance, firedThisFight: true } } },
    },
  };
}

/**
 * Scans `events` (a checkpoint's own newly-produced slice, e.g. one round's
 * status ticks or one move's status-application results — resolveRound.ts's
 * call sites, not the whole round's accumulated log) for every combatant's
 * held passives whose `reactive.hook` matches an event's type and whose
 * condition matches. N held stacks of a match resolve the effect N
 * independent times (state.ts PassiveInstance doc comment) — except a
 * `oncePerFight` reaction, which resolves once no matter how many stacks are
 * held and then never again this combat.
 */
export function resolvePassiveReactions(
  state: CombatState,
  round: number,
  events: readonly CombatEvent[],
  heroes: HeroLookup,
  statusDefs: Record<string, StatusDefinition>,
  passiveDefs: Record<PassiveId, PassiveDefinition>,
  fieldEffectDefs: Record<string, FieldEffectDefinition>
): { state: CombatState; events: CombatEvent[] } {
  let working = state;
  const produced: CombatEvent[] = [];

  for (const event of events) {
    const context = event as unknown as TriggerContext;

    for (const ownerId of Object.keys(working.combatants)) {
      const owner = working.combatants[ownerId];
      if (!owner || owner.fainted) continue;

      for (const instance of Object.values(owner.passives)) {
        const reactive = passiveDefs[instance.passiveId]?.reactive;
        if (!reactive || reactive.hook !== event.type) continue;
        // Resolved per passive, not per event: which combatant the event is
        // "about" depends on the perspective the condition asked for
        // (content.ts subjectRole), so two passives can read the same event
        // from opposite ends.
        const subjectId = subjectOf(event, reactive.condition.subjectRole ?? 'target');
        const subjectSide = subjectId ? working.combatants[subjectId]?.side : undefined;
        if (!matchesTrigger(reactive.condition, context, ownerId, owner.side, subjectId, subjectSide)) continue;
        // "The first time ... during combat" (content.ts reactive.oncePerFight).
        // Checked AFTER the match so a spent passive is skipped by the flag
        // rather than by a condition it would still satisfy, and marked before
        // the effect resolves so a reaction that re-enters this scan cannot
        // fire itself a second time.
        if (reactive.oncePerFight) {
          if (working.combatants[ownerId]?.passives[instance.passiveId]?.firedThisFight) continue;
          working = markFired(working, ownerId, instance.passiveId);
        }

        for (let i = 0; i < (reactive.oncePerFight ? 1 : instance.stacks); i++) {
          const resolved = resolveEffect(working, round, heroes, statusDefs, fieldEffectDefs, ownerId, subjectId, reactive.effect, context);
          working = resolved.state;
          // Emitted even if resolveEffect no-op'd (e.g. target already
          // fainted) so the view still knows the passive attempted to fire —
          // buildBeats.ts only awards it a visible beat when a state-change
          // event actually follows.
          produced.push({ type: 'PassiveTriggered', round, combatantId: ownerId, passiveId: instance.passiveId }, ...resolved.events);
        }
      }
    }
  }

  return { state: working, events: produced };
}

/**
 * The opening lead's entry trigger (PassiveHook 'SwitchedIn').
 *
 * A fight's starting four are PLACED by buildCombatState, not switched in, so
 * the battlefield they are standing on produced no SwitchedIn event and an
 * entry passive would sit silent until its owner happened to be cycled. That
 * is the wrong reading of "when this hero enters the battlefield" and, worse,
 * an inconsistent one: the same passive would fire on the hero's SECOND
 * arrival but not its first.
 *
 * So this synthesises exactly the event a switch would have produced for each
 * currently-active combatant and runs it through the same matcher — no second
 * code path, no per-passive special case. `outCombatantId` is null (nobody
 * left), which is already legal on SwitchedInEvent for a switch into an empty
 * slot.
 *
 * The synthesised events are NOT returned: the view would narrate them as
 * "X switches in!" over a board where nothing switched. Only what the passives
 * actually did comes back, which is what the opening log should say.
 *
 * Called once, at fight construction (view/combat/FightScreen.tsx), on the
 * state buildCombatState just produced — not inside resolveRound, which starts
 * from an already-open board.
 */
export function resolveBattleStartEntries(
  state: CombatState,
  round: number,
  heroes: HeroLookup,
  statusDefs: Record<string, StatusDefinition>,
  passiveDefs: Record<PassiveId, PassiveDefinition>,
  fieldEffectDefs: Record<string, FieldEffectDefinition>
): { state: CombatState; events: CombatEvent[] } {
  const entries: CombatEvent[] = [];
  for (const side of ['A', 'B'] as const) {
    state.active[side].forEach((inCombatantId, slot) => {
      if (!inCombatantId) return;
      entries.push({ type: 'SwitchedIn', round, side, slot: slot as 0 | 1, outCombatantId: null, inCombatantId });
    });
  }
  return resolvePassiveReactions(state, round, entries, heroes, statusDefs, passiveDefs, fieldEffectDefs);
}

/**
 * The damage-pipeline-modifier family: for the attacker's held passives with
 * a `damageModifier`, matches it against the pending hit's own context
 * (currently just `{ moveType }`) and pushes one `{source, amount}` per held
 * stack. Called BEFORE rollDamage (resolveRound.ts), feeding the array
 * damagePipeline.ts's DamageModifier accumulator already expects — N stacks
 * compose correctly for free via that pipeline's locked multiplicative
 * stacking (resolveMultiplierTerm).
 */
export function collectPassiveDamageModifiers(
  attacker: Combatant,
  move: MoveDefinition,
  passiveDefs: Record<PassiveId, PassiveDefinition>
): DamageModifier[] {
  const modifiers: DamageModifier[] = [];
  const context: TriggerContext = { moveType: move.type };

  for (const instance of Object.values(attacker.passives)) {
    const def = passiveDefs[instance.passiveId]?.damageModifier;
    if (!def || !matchesFields(def.eventFieldEquals, context)) continue;
    for (let i = 0; i < instance.stacks; i++) {
      modifiers.push({ source: instance.passiveId, amount: def.amount });
    }
  }

  return modifiers;
}
