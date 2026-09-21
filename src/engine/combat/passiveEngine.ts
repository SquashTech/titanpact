// The Passives contract's runtime half (content.ts PassiveDefinition is the data
// half). Two families: resolvePassiveReactions (event-reactive, fed each
// checkpoint's own new event slice) and collectPassiveDamageModifiers
// (synchronous, evaluated before a hit is rolled).

import type { HeroLookup, CombatState, Combatant, Side } from '../state';
import { getMaxHp, getMaxMana, applyStatModifierDelta, getEffectiveStat } from '../state';
import type { FieldEffectDefinition, PassiveDefinition, PassiveId, PassiveEffect, PassiveEffectTarget, PassiveTriggerCondition, PassiveAmount, StatKey, StatusDefinition, MoveDefinition } from '../content';
import type { CombatEvent } from '../events';
import type { DamageModifier } from '../damage/damagePipeline';
import { nextFloat, nextInt } from '../rng/seededRng';
import { magnitudeMultFromStat } from '../heal/healPipeline';
import { hasStatus } from '../state';
import { applyHpDelta } from './faintHandling';
import { applyStatus, cleanseStatuses } from './statusEngine';
import { setFieldEffect } from './fieldEffectEngine';
import { wardRefusesStatus } from './ward';

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

/** The mirror of the above, on the same terms: unreadable is a no-fire, and zero is neither. */
function matchesNegativeField(field: string | undefined, context: TriggerContext): boolean {
  if (field === undefined) return true;
  const value = context[field];
  return typeof value === 'number' && value < 0;
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
    matchesPositiveField(condition.eventFieldPositive, context) &&
    matchesNegativeField(condition.eventFieldNegative, context) &&
    matchesCadence(condition.everyNRounds, context) &&
    (condition.finishingBlow === undefined || context.finishing === true)
  );
}

/** An unreadable round is a no-fire, on the same terms as the field matchers. */
function matchesCadence(everyNRounds: number | undefined, context: TriggerContext): boolean {
  if (everyNRounds === undefined) return true;
  const round = context.round;
  return typeof round === 'number' && round % everyNRounds === 0;
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
      case 'Healed':
        return event.sourceCombatantId;
      case 'StatusDetonated':
        return event.sourceCombatantId;
      default:
        return undefined;
    }
  }
  switch (event.type) {
    case 'StatusTicked':
    case 'StatusApplied':
    case 'StatusDetonated':
    case 'StatChanged':
    case 'Rested':
      return event.combatantId;
    case 'DamageDealt':
      return event.targetCombatantId;
    case 'Healed':
      return event.targetCombatantId;
    case 'SwitchedIn':
      return event.inCombatantId;
    default:
      return undefined;
  }
}

/** `targetMaxHp` is the effect target's, for a percentMaxHp amount; a caller without a target reads it as 0. */
function resolveAmount(amount: PassiveAmount, context: TriggerContext, targetMaxHp = 0): number {
  if (amount.kind === 'flat') return amount.value;
  if (amount.kind === 'percentMaxHp') return Math.round(targetMaxHp * amount.value);
  const raw = context[amount.field ?? 'amount'];
  const base = typeof raw === 'number' ? raw : 0;
  return Math.round(base * (amount.multiplier ?? 1));
}

/** An authored number passes through; a PassiveAmount is read off the triggering event. */
function resolveMagnitude(magnitude: number | PassiveAmount | undefined, context: TriggerContext): number | undefined {
  if (magnitude === undefined || typeof magnitude === 'number') return magnitude;
  return resolveAmount(magnitude, context);
}

function resolveEffect(
  state: CombatState,
  round: number,
  heroes: HeroLookup,
  statusDefs: Record<string, StatusDefinition>,
  fieldEffectDefs: Record<string, FieldEffectDefinition>,
  passiveDefs: Record<PassiveId, PassiveDefinition>,
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
    if (effect.kind === 'damage' && effect.onlyWithStatus !== undefined && !hasStatus(target, effect.onlyWithStatus)) continue;
    const resolved = resolveEffectOn(working, round, heroes, statusDefs, passiveDefs, ownerId, targetId, target, effect, context);
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
    case 'ally': {
      // The owner's ACTIVE partner. Alone on the field (a KO not yet replaced), this aims at nobody.
      const side = state.combatants[ownerId]?.side;
      if (!side) return [];
      const partner = state.active[side].find((id): id is string => id !== null && id !== ownerId);
      return partner ? [partner] : [];
    }
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
  passiveDefs: Record<PassiveId, PassiveDefinition>,
  ownerId: string,
  targetId: string,
  target: Combatant,
  effect: Exclude<PassiveEffect, { kind: 'setFieldEffect' }>,
  context: TriggerContext
): { state: CombatState; events: CombatEvent[] } {
  switch (effect.kind) {
    case 'damage': {
      const maxHp = getMaxHp(heroes[target.heroId], target);
      const amount = Math.round(maxHp * effect.percentMaxHp);
      if (amount <= 0) return { state, events: [] };
      // Direct, like the Clock: no Shield, no reaction of its own beyond what applyHpDelta emits.
      return applyHpDelta(state, round, targetId, -amount, maxHp, { source: 'direct' });
    }
    case 'heal': {
      const maxHp = getMaxHp(heroes[target.heroId], target);
      const amount = resolveAmount(effect.amount, context, maxHp);
      if (amount <= 0) return { state, events: [] };
      // Nothing to restore is a no-op, not a "+0 HP" beat.
      if (target.currentHp >= maxHp) return { state, events: [] };
      return applyHpDelta(state, round, targetId, amount, maxHp);
    }
    case 'applyStatus': {
      const def = statusDefs[effect.statusId];
      if (!def) return { state, events: [] };
      // A warded target refuses it (the Herald struck through an Ice Shell, a Thorns-shaped reaction).
      if (wardRefusesStatus(state, targetId, ownerId, def, passiveDefs)) return { state, events: [] };
      let magnitude = resolveMagnitude(effect.magnitude, context);
      // An event-read magnitude of nothing (a Rest that restored 0) is no status at all.
      if (typeof effect.magnitude === 'object' && (magnitude ?? 0) <= 0) return { state, events: [] };
      if (effect.scaledBy !== undefined && magnitude !== undefined) {
        const owner = state.combatants[ownerId];
        if (owner) magnitude = Math.round(magnitude * magnitudeMultFromStat(getEffectiveStat(heroes[owner.heroId], owner, effect.scaledBy)));
      }
      // The passive's OWNER is the actor, so a source-role passive can see it.
      return applyStatus(state, round, targetId, def, {
        magnitude,
        duration: effect.duration,
        sourceCombatantId: ownerId,
        holderMaxHp: getMaxHp(heroes[target.heroId], target),
      });
    }
    case 'cleanse':
      return cleanseStatuses(state, round, targetId, statusDefs, effect.count);
    case 'manaGrant': {
      const amount = resolveAmount(effect.amount, context);
      if (amount <= 0) return { state, events: [] };
      // Uncapped by design, exactly as a move's manaGrant is — the overflow IS the payout.
      const previousMana = target.currentMana;
      const newMana = previousMana + amount;
      const nextState: CombatState = {
        ...state,
        combatants: { ...state.combatants, [targetId]: { ...target, currentMana: newMana } },
      };
      const maxMana = getMaxMana(heroes[target.heroId], target);
      return {
        state: nextState,
        events: [
          {
            type: 'ManaGranted',
            round,
            sourceCombatantId: ownerId,
            targetCombatantId: targetId,
            amount,
            previousMana,
            newMana,
            maxMana,
            overflow: Math.max(0, newMana - maxMana),
          },
        ],
      };
    }
    case 'statDelta': {
      // One stat or several; each lands separately and reports its own StatChanged, so a
      // stat-reactive passive (Entanglement) sees them one at a time exactly as a move's would.
      const stats: readonly StatKey[] = Array.isArray(effect.stat) ? (effect.stat as readonly StatKey[]) : [effect.stat as StatKey];
      const amount = typeof effect.amount === 'number' ? effect.amount : resolveAmount(effect.amount, context);
      if (amount === 0) return { state, events: [] };
      let modifiers = target.statModifiers;
      const changes: CombatEvent[] = [];
      for (const stat of stats) {
        // Flat (no move to scale off), but held at the same floor as a move's drop.
        const { newValue, landed, capped } = applyStatModifierDelta(heroes[target.heroId], { ...target, statModifiers: modifiers }, stat, amount);
        modifiers = { ...modifiers, [stat]: newValue };
        changes.push({ type: 'StatChanged', round, combatantId: targetId, stat, delta: landed, ...(capped ? { capped: true } : {}), newValue });
      }
      // A permanent gain is banked as AUTHORED, not as landed: the roster grant is not subject to the fight's band.
      const banked = effect.permanent
        ? Object.fromEntries(stats.map((stat) => [stat, (target.permanentStatGains?.[stat] ?? 0) + amount]))
        : undefined;
      const nextState: CombatState = {
        ...state,
        combatants: {
          ...state.combatants,
          [targetId]: { ...target, statModifiers: modifiers, ...(banked ? { permanentStatGains: { ...target.permanentStatGains, ...banked } } : {}) },
        },
      };
      return { state: nextState, events: changes };
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
      // A passive reacts only from the field: a benched Bloodthirst holder does not drink its side's hits.
      if (!working.active[owner.side].includes(ownerId)) continue;

      for (const instance of Object.values(owner.passives)) {
        const reactive = passiveDefs[instance.passiveId]?.reactive;
        if (!reactive || reactive.hook !== event.type) continue;
        // A round's end is about nobody, so each active owner is its own subject: 'self' fires, nothing else does.
        const subjectId = event.type === 'RoundEnded' ? ownerId : subjectOf(event, reactive.condition.subjectRole ?? 'target');
        // Kept apart from `subjectId`: a source-role condition ("I dealt this") still needs the defender.
        const eventTargetId = subjectOf(event, 'target');
        const subjectSide = subjectId ? working.combatants[subjectId]?.side : undefined;
        if (!matchesTrigger(reactive.condition, context, ownerId, owner.side, subjectId, subjectSide)) continue;
        if (reactive.condition.eventTargetHasStatus !== undefined) {
          const struck = eventTargetId ? working.combatants[eventTargetId] : undefined;
          if (!struck || !hasStatus(struck, reactive.condition.eventTargetHasStatus)) continue;
        }
        // Checked AFTER the match and marked BEFORE the effect resolves, so a re-entrant reaction cannot fire itself twice.
        if (reactive.oncePerFight) {
          if (working.combatants[ownerId]?.passives[instance.passiveId]?.firedThisFight) continue;
          working = markFired(working, ownerId, instance.passiveId);
        }

        for (let i = 0; i < (reactive.oncePerFight ? 1 : instance.stacks); i++) {
          if (reactive.chance !== undefined) {
            const roll = nextFloat(working.rngState);
            working = { ...working, rngState: roll.nextState };
            if (roll.value >= reactive.chance) continue;
          }
          const resolved = resolveEffect(working, round, heroes, statusDefs, fieldEffectDefs, passiveDefs, ownerId, subjectId, eventTargetId, reactive.effect, context);
          working = resolved.state;
          // A no-op (a heal at full HP, a target already fainted) is not a trigger: nothing to log.
          if (resolved.events.length === 0) continue;
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
  passiveDefs: Record<PassiveId, PassiveDefinition>,
  /** The defender of this hit, for a modifier gated on what it holds; a forecast with none reports such a modifier unfired. */
  target?: Combatant
): DamageModifier[] {
  const modifiers: DamageModifier[] = [];
  const context: TriggerContext = { moveType: move.type };

  for (const instance of Object.values(attacker.passives)) {
    const def = passiveDefs[instance.passiveId]?.damageModifier;
    if (!def || !matchesFields(def.eventFieldEquals, context)) continue;
    if (def.alternatesCategory && (attacker.lastHitCategory === undefined || attacker.lastHitCategory === move.category)) continue;
    if (def.requiresTargetStatuses && !(target && def.requiresTargetStatuses.every((id) => hasStatus(target, id)))) continue;
    for (let i = 0; i < instance.stacks; i++) {
      modifiers.push({ source: instance.passiveId, amount: def.amount });
    }
  }

  return modifiers;
}
