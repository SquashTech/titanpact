// The Passives contract's runtime half (content.ts's PassiveDefinition is the
// data half — CLAUDE.md's "abilities" contract, first implemented here).
// Mirrors statusEngine.ts's discipline: pure, generic functions reading
// PassiveDefinition flags off held passives, no per-passive special cases.
//
// Two integration families, matching PassiveDefinition's two effect shapes:
//   - resolvePassiveReactions: event-reactive. Scans a batch of just-produced
//     CombatEvents (resolveRound.ts passes each checkpoint's own new slice,
//     not the whole round) for hook matches, generalizing the exact pattern
//     applyOrDetonateTriggeredStatuses already uses for Conduct (match a
//     generic flag, run a generic effect) — keyed off real event types
//     instead of move type.
//   - collectPassiveDamageModifiers: synchronous. Evaluated BEFORE a hit is
//     rolled, contributing to the damage pipeline's DamageModifier
//     accumulator (damagePipeline.ts) — never a reaction to a past event.

import type { HeroLookup, CombatState, Combatant, Side } from '../state';
import { getMaxHp } from '../state';
import type { FieldEffectDefinition, PassiveDefinition, PassiveId, PassiveEffect, PassiveTriggerCondition, PassiveAmount, StatusDefinition, MoveDefinition } from '../content';
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
 * Which combatant a CombatEvent is "about", for relational matching.
 * DamageDealt's subject is the TARGET (not the source) — this makes the hook
 * a defender-perspective reaction ("when an enemy/ally is hit, do X"), not an
 * attacker-perspective one ("when I deal damage, do X"); that second
 * direction isn't needed by any passive yet and isn't implemented. Event
 * types outside PassiveHook return undefined — harmless, since the hook
 * match already filters them out before subjectOf is ever consulted for them.
 */
function subjectOf(event: CombatEvent): string | undefined {
  switch (event.type) {
    case 'StatusTicked':
    case 'StatusApplied':
      return event.combatantId;
    case 'DamageDealt':
      return event.targetCombatantId;
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

  const targetId = effect.target === 'self' ? ownerId : subjectId;
  const target = targetId ? state.combatants[targetId] : undefined;
  if (!targetId || !target || target.fainted) return { state, events: [] };

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
      return applyStatus(state, round, targetId, def, { magnitude: effect.magnitude, duration: effect.duration });
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

/**
 * Scans `events` (a checkpoint's own newly-produced slice, e.g. one round's
 * status ticks or one move's status-application results — resolveRound.ts's
 * call sites, not the whole round's accumulated log) for every combatant's
 * held passives whose `reactive.hook` matches an event's type and whose
 * condition matches. N held stacks of a match resolve the effect N
 * independent times (state.ts PassiveInstance doc comment).
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
    const subjectId = subjectOf(event);
    const subjectSide = subjectId ? working.combatants[subjectId]?.side : undefined;
    const context = event as unknown as TriggerContext;

    for (const ownerId of Object.keys(working.combatants)) {
      const owner = working.combatants[ownerId];
      if (!owner || owner.fainted) continue;

      for (const instance of Object.values(owner.passives)) {
        const reactive = passiveDefs[instance.passiveId]?.reactive;
        if (!reactive || reactive.hook !== event.type) continue;
        if (!matchesTrigger(reactive.condition, context, ownerId, owner.side, subjectId, subjectSide)) continue;

        for (let i = 0; i < instance.stacks; i++) {
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
