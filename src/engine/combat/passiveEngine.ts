// The Passives contract's runtime half (content.ts PassiveDefinition is the data
// half). Two families: resolvePassiveReactions (event-reactive, fed each
// checkpoint's own new event slice) and collectPassiveDamageModifiers
// (synchronous, evaluated before a hit is rolled).

import type { HeroLookup, CombatState, Combatant, Side } from '../state';
import { getMaxHp } from '../state';
import type { FieldEffectDefinition, PassiveDefinition, PassiveId, PassiveEffect, PassiveEffectTarget, PassiveTriggerCondition, PassiveAmount, StatusDefinition, MoveDefinition } from '../content';
import type { CombatEvent } from '../events';
import type { DamageModifier } from '../damage/damagePipeline';
import { nextInt } from '../rng/seededRng';
import { applyHpDelta } from './faintHandling';
import { applyStatus } from './statusEngine';
import { setFieldEffect } from './fieldEffectEngine';

/** A CombatEvent (or a synthetic pre-roll context) read generically by field name. */
type TriggerContext = Record<string, unknown>;

function matchesFields(eventFieldEquals: Partial<Record<string, string>> | undefined, context: TriggerContext): boolean {
  if (!eventFieldEquals) return true;
  return Object.entries(eventFieldEquals).every(([key, value]) => String(context[key]) === value);
}

/** A missing or non-numeric field never matches — an unreadable condition is a no-fire, not a free pass. */
function matchesPositiveField(field: string | undefined, context: TriggerContext): boolean {
  if (field === undefined) return true;
  const value = context[field];
  return typeof value === 'number' && value > 0;
}

function relationHolds(relation: PassiveTriggerCondition['relativeTo'], ownerId: string, ownerSide: Side, subjectId: string | undefined, subjectSide: Side | undefined): boolean {
  if (!subjectId || !subjectSide) return false;
  switch (relation) {
    case 'self':
      return subjectId === ownerId;
    case 'ally':
      return subjectSide === ownerSide && subjectId !== ownerId;
    case 'enemy':
      return subjectSide !== ownerSide;
  }
}

/** Relation (subject vs. owner) AND every declared field equality must hold. */
export function matchesTrigger(
  condition: PassiveTriggerCondition,
  context: TriggerContext,
  ownerId: string,
  ownerSide: Side,
  subjectId: string | undefined,
  subjectSide: Side | undefined
): boolean {
  return (
    relationHolds(condition.relativeTo, ownerId, ownerSide, subjectId, subjectSide) &&
    matchesFields(condition.eventFieldEquals, context) &&
    matchesPositiveField(condition.eventFieldPositive, context)
  );
}

// Who an event is "about": 'target' is the defender/arriver perspective, 'source' the
// actor's. Events with no actor return undefined for 'source', which relationHolds reads as no match.
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
    case 'StatChanged':
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
  eventTargetId: string | undefined,
  effect: PassiveEffect,
  context: TriggerContext
): { state: CombatState; events: CombatEvent[] } {
  if (effect.kind === 'setFieldEffect') {
    if (!fieldEffectDefs[effect.fieldEffectId]) return { state, events: [] };
    return setFieldEffect(state, round, effect.fieldEffectId);
  }

  // A group target resolves once per member in slot order, threading state through.
  const aimed = resolveTargetIdsRolled(state, ownerId, subjectId, eventTargetId, effect.target);
  let working = aimed.state;
  const produced: CombatEvent[] = [];
  for (const targetId of aimed.targetIds) {
    const target = working.combatants[targetId];
    if (!target || target.fainted) continue;
    const resolved = resolveEffectOn(working, round, heroes, statusDefs, ownerId, targetId, target, effect, context);
    working = resolved.state;
    produced.push(...resolved.events);
  }
  return { state: working, events: produced };
}

function resolveTargetIds(
  state: CombatState,
  ownerId: string,
  subjectId: string | undefined,
  eventTargetId: string | undefined,
  target: PassiveEffectTarget
): string[] {
  switch (target) {
    case 'self':
      return [ownerId];
    case 'triggerSubject':
      return subjectId ? [subjectId] : [];
    case 'triggerTarget':
      return eventTargetId ? [eventTargetId] : [];
    case 'activeEnemies':
    case 'randomEnemy': {
      const ownerSide = state.combatants[ownerId]?.side;
      if (!ownerSide) return [];
      const enemySide: Side = ownerSide === 'A' ? 'B' : 'A';
      const active = state.active[enemySide].filter((id): id is string => id !== null);
      // The random mode returns the POOL; resolveTargetIdsRolled narrows it. Fainted foes are
      // dropped there and only there, so an existing group target keeps its slot-order semantics.
      return target === 'randomEnemy' ? active.filter((id) => !state.combatants[id]?.fainted) : active;
    }
  }
}

/** resolveTargetIds plus the single draw 'randomEnemy' needs; every other mode leaves rngState untouched. */
function resolveTargetIdsRolled(
  state: CombatState,
  ownerId: string,
  subjectId: string | undefined,
  eventTargetId: string | undefined,
  target: PassiveEffectTarget
): { state: CombatState; targetIds: string[] } {
  const pool = resolveTargetIds(state, ownerId, subjectId, eventTargetId, target);
  if (target !== 'randomEnemy' || pool.length === 0) return { state, targetIds: pool };
  const roll = nextInt(state.rngState, 0, pool.length);
  return { state: { ...state, rngState: roll.nextState }, targetIds: [pool[roll.value]] };
}

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
      // The passive's OWNER is the actor, so a source-role passive can see it.
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
 * Scans a checkpoint's own new event slice (never the round's accumulated log) for
 * held passives whose hook and condition match. N stacks resolve N times, except a
 * `oncePerFight` reaction, which resolves once per combat.
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
        const subjectId = subjectOf(event, reactive.condition.subjectRole ?? 'target');
        // Kept apart from `subjectId`: a source-role condition ("I dealt this") still needs the defender.
        const eventTargetId = subjectOf(event, 'target');
        const subjectSide = subjectId ? working.combatants[subjectId]?.side : undefined;
        if (!matchesTrigger(reactive.condition, context, ownerId, owner.side, subjectId, subjectSide)) continue;
        // Checked AFTER the match and marked BEFORE the effect resolves, so a re-entrant reaction cannot fire itself twice.
        if (reactive.oncePerFight) {
          if (working.combatants[ownerId]?.passives[instance.passiveId]?.firedThisFight) continue;
          working = markFired(working, ownerId, instance.passiveId);
        }

        for (let i = 0; i < (reactive.oncePerFight ? 1 : instance.stacks); i++) {
          const resolved = resolveEffect(working, round, heroes, statusDefs, fieldEffectDefs, ownerId, subjectId, eventTargetId, reactive.effect, context);
          working = resolved.state;
          // Emitted even when the effect no-op'd, so the view knows the passive attempted to fire.
          produced.push({ type: 'PassiveTriggered', round, combatantId: ownerId, passiveId: instance.passiveId }, ...resolved.events);
        }
      }
    }
  }

  return { state: working, events: produced };
}

/**
 * The opening lead's entry trigger: synthesises the SwitchedIn each starting active
 * would have produced and runs the normal matcher. The synthesised events are NOT
 * returned — only what the passives did. Called once at fight construction.
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

/** One DamageModifier per held stack of every matching `damageModifier` passive; called before rollDamage. */
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
