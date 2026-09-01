// The status engine (docs/conditions.md). Reads StatusDefinition flags
// generically; the only literal-id checks are the catalog's documented
// exceptions (Stealth here, Freeze's Speed hook in state.ts).

import type { FieldEffectDefinition, MoveDefinition, StatusDefinition, StatusId, StatusRemovalReason, TargetMode, TypeId } from '../content';
import type { CombatState, Combatant, StatusInstance } from '../state';
import { hasStatus } from '../state';
import type { CombatEvent } from '../events';
import { applyHpDelta } from './faintHandling';
import { nextInt } from '../rng/seededRng';

type StatusResult = { state: CombatState; events: CombatEvent[] };

function setStatus(state: CombatState, combatantId: string, statusId: StatusId, instance: StatusInstance): CombatState {
  const combatant = state.combatants[combatantId];
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...combatant, statuses: { ...combatant.statuses, [statusId]: instance } } },
  };
}

function removeStatus(state: CombatState, round: number, combatantId: string, statusId: StatusId, reason: StatusRemovalReason): StatusResult {
  const combatant = state.combatants[combatantId];
  if (!combatant?.statuses[statusId]) return { state, events: [] };
  const nextStatuses = { ...combatant.statuses };
  delete nextStatuses[statusId];
  return {
    state: { ...state, combatants: { ...state.combatants, [combatantId]: { ...combatant, statuses: nextStatuses } } },
    events: [{ type: 'StatusRemoved', round, combatantId, statusId, reason }],
  };
}

/** Removes every status on `combatantId` whose definition satisfies `flag`, in held order. */
function removeStatusesWhere(
  state: CombatState,
  round: number,
  combatantId: string,
  statusDefs: Record<string, StatusDefinition>,
  flag: (def: StatusDefinition) => boolean | undefined,
  reason: StatusRemovalReason
): StatusResult {
  let working = state;
  const events: CombatEvent[] = [];
  const combatant = working.combatants[combatantId];
  if (!combatant) return { state, events };

  for (const statusId of Object.keys(combatant.statuses)) {
    const def = statusDefs[statusId];
    if (!def || !flag(def)) continue;
    const rm = removeStatus(working, round, combatantId, statusId, reason);
    working = rm.state;
    events.push(...rm.events);
  }

  return { state: working, events };
}

/** The ids of every status that taunts (redirectsSingleTargetEnemyMoves). */
function tauntStatusIds(statusDefs: Record<string, StatusDefinition>): StatusId[] {
  const ids: StatusId[] = [];
  for (const def of Object.values(statusDefs)) if (def.redirectsSingleTargetEnemyMoves) ids.push(def.id);
  return ids;
}

function holdsAny(combatant: Combatant, statusIds: readonly StatusId[]): boolean {
  return statusIds.some((id) => hasStatus(combatant, id));
}

// 'consumed' is the only removal reason content may reach for; the other four stay inside this module.
export function consumeStatus(state: CombatState, round: number, combatantId: string, statusId: StatusId): StatusResult {
  return removeStatus(state, round, combatantId, statusId, 'consumed');
}

export interface StatusApplyParams {
  magnitude?: number;
  duration?: number;
  /** Passed through onto the StatusApplied event; never read here. */
  sourceCombatantId?: string;
}

/** Applies (or stacks onto) a status per StatusDefinition.stacking. No-ops on a fainted combatant. */
export function applyStatus(state: CombatState, round: number, combatantId: string, def: StatusDefinition, params: StatusApplyParams): StatusResult {
  const combatant = state.combatants[combatantId];
  if (!combatant || combatant.fainted) return { state, events: [] };

  // A side's two actives can never both be Stealthed (docs/conditions.md). Fizzles silently, no event.
  if (def.id === 'Stealth' && state.active[combatant.side].includes(combatantId)) {
    const partnerId = state.active[combatant.side].find((id): id is string => id !== null && id !== combatantId);
    if (partnerId && hasStatus(state.combatants[partnerId], 'Stealth')) {
      return { state, events: [] };
    }
  }

  const existing = combatant.statuses[def.id];
  let magnitude = params.magnitude;
  let duration = params.duration;

  if (existing) {
    if (def.stacking === 'none') return { state, events: [] };
    if (def.stacking === 'additive') {
      magnitude = (existing.magnitude ?? 0) + (params.magnitude ?? 0);
    } else if (def.stacking === 'takeHigher') {
      magnitude = params.magnitude !== undefined ? Math.max(existing.magnitude ?? 0, params.magnitude) : existing.magnitude;
      duration = params.duration !== undefined ? Math.max(existing.duration ?? 0, params.duration) : existing.duration;
    } else if (def.stacking === 'additiveMagnitudeFixedDuration') {
      // Poison: magnitude builds, the timer never resets or extends.
      magnitude = (existing.magnitude ?? 0) + (params.magnitude ?? 0);
      duration = existing.duration;
    }
  }

  const nextState = setStatus(state, combatantId, def.id, { statusId: def.id, magnitude, duration });
  return {
    state: nextState,
    events: [{ type: 'StatusApplied', round, combatantId, sourceCombatantId: params.sourceCombatantId, statusId: def.id, magnitude, duration }],
  };
}

/**
 * End-of-round tick over EVERY combatant, active or benched (statuses persist through
 * switch so they cannot be bench-parked); `activeOnly` stalls a timer while benched.
 */
export function tickEndOfRound(
  state: CombatState,
  round: number,
  statusDefs: Record<string, StatusDefinition>,
  fieldEffects: Record<string, FieldEffectDefinition>,
  maxHpOf: (combatantId: string) => number
): StatusResult {
  let working = state;
  const events: CombatEvent[] = [];

  const activeFieldEffectId = working.activeFieldEffect?.fieldEffectId;
  const activeFieldEffectDef = activeFieldEffectId ? fieldEffects[activeFieldEffectId] : undefined;

  for (const combatantId of Object.keys(working.combatants)) {
    const combatant = working.combatants[combatantId];
    if (!combatant || combatant.fainted) continue;

    for (const statusId of Object.keys(combatant.statuses)) {
      const instance = combatant.statuses[statusId];
      const def = statusDefs[statusId];
      if (!def || !instance || !def.ticksAtEndOfRound) continue;
      if (def.activeOnly && !working.active[combatant.side].includes(combatantId)) continue;

      if (def.pipeline === 'timer') {
        const newDuration = (instance.duration ?? 0) - 1;
        if (newDuration <= 0) {
          const maxHp = maxHpOf(combatantId);
          const amount = Math.ceil((maxHp * (instance.magnitude ?? 0)) / 100);
          events.push({ type: 'StatusTicked', round, combatantId, statusId, kind: 'damage', amount, newDuration: 0 });
          const hpResult = applyHpDelta(working, round, combatantId, -amount, maxHp);
          working = hpResult.state;
          events.push(...hpResult.events);
          const rm = removeStatus(working, round, combatantId, statusId, 'expired');
          working = rm.state;
          events.push(...rm.events);
        } else {
          events.push({ type: 'StatusTicked', round, combatantId, statusId, kind: 'duration', amount: 0, newDuration });
          working = setStatus(working, combatantId, statusId, { ...instance, duration: newDuration });
        }
      } else if (def.pipeline === 'dot' || def.pipeline === 'hot') {
        const maxHp = maxHpOf(combatantId);
        const magnitude = instance.magnitude ?? (def.flatPercentOfMaxHp ? Math.ceil(maxHp * def.flatPercentOfMaxHp) : 0);
        const delta = def.pipeline === 'dot' ? -magnitude : magnitude;
        // Scorched Land suppresses decay only; the tick itself is untouched.
        const decaySuppressed = activeFieldEffectDef?.suppressesStatusDecay?.includes(statusId) ?? false;
        // undefined (not 0) for a non-decaying status, so the view never renders "Bleed 0".
        const decayedMagnitude = def.decay === 'halve' && !decaySuppressed ? Math.floor((instance.magnitude ?? 0) / 2) : undefined;

        events.push({
          type: 'StatusTicked',
          round,
          combatantId,
          statusId,
          kind: def.pipeline === 'dot' ? 'damage' : 'heal',
          amount: magnitude,
          newMagnitude: decayedMagnitude,
        });
        const hpResult = applyHpDelta(working, round, combatantId, delta, maxHp);
        working = hpResult.state;
        events.push(...hpResult.events);

        if (def.decay === 'halve' && !decaySuppressed) {
          if ((decayedMagnitude ?? 0) <= 0) {
            const rm = removeStatus(working, round, combatantId, statusId, 'decay');
            working = rm.state;
            events.push(...rm.events);
          } else {
            working = setStatus(working, combatantId, statusId, { ...instance, magnitude: decayedMagnitude });
          }
        }
      } else if (def.shape === 'duration') {
        const newDuration = (instance.duration ?? 0) - 1;
        events.push({ type: 'StatusTicked', round, combatantId, statusId, kind: 'duration', amount: 0, newDuration });
        if (newDuration <= 0) {
          const rm = removeStatus(working, round, combatantId, statusId, 'expired');
          working = rm.state;
          events.push(...rm.events);
        } else {
          working = setStatus(working, combatantId, statusId, { ...instance, duration: newDuration });
        }
      }
    }
  }

  // The flinch pass (clearsAtEndOfRound — Daze): its own loop, after the ticks, not gated on ticksAtEndOfRound.
  for (const combatantId of Object.keys(working.combatants)) {
    const combatant = working.combatants[combatantId];
    if (!combatant || combatant.fainted) continue;
    const rm = removeStatusesWhere(working, round, combatantId, statusDefs, (def) => def.clearsAtEndOfRound, 'expired');
    working = rm.state;
    events.push(...rm.events);
  }

  return { state: working, events };
}

/** Start-of-round tick (ticksAtStartOfRound — Stealth): a duration already at 0 expires; otherwise it decrements and stays. */
export function tickStartOfRound(state: CombatState, round: number, statusDefs: Record<string, StatusDefinition>): StatusResult {
  let working = state;
  const events: CombatEvent[] = [];

  for (const combatantId of Object.keys(working.combatants)) {
    const combatant = working.combatants[combatantId];
    if (!combatant || combatant.fainted) continue;

    for (const statusId of Object.keys(combatant.statuses)) {
      const instance = combatant.statuses[statusId];
      const def = statusDefs[statusId];
      if (!def || !instance || !def.ticksAtStartOfRound) continue;

      if ((instance.duration ?? 0) <= 0) {
        const rm = removeStatus(working, round, combatantId, statusId, 'expired');
        working = rm.state;
        events.push(...rm.events);
        continue;
      }

      const newDuration = (instance.duration ?? 0) - 1;
      events.push({ type: 'StatusTicked', round, combatantId, statusId, kind: 'duration', amount: 0, newDuration });
      working = setStatus(working, combatantId, statusId, { ...instance, duration: newDuration });
    }
  }

  return { state: working, events };
}

/** docs/conditions.md §4: switching to bench clears every status with clearsOnSwitch. */
export function clearOnSwitch(state: CombatState, round: number, combatantId: string, statusDefs: Record<string, StatusDefinition>): StatusResult {
  return removeStatusesWhere(state, round, combatantId, statusDefs, (def) => def.clearsOnSwitch, 'switch');
}

/** Cleanse strips every status not flagged `positive`; `limit` picks that many at random (draws RNG only when it must choose). */
export function cleanseStatuses(
  state: CombatState,
  round: number,
  combatantId: string,
  statusDefs: Record<string, StatusDefinition>,
  limit?: number
): StatusResult {
  let working = state;
  const events: CombatEvent[] = [];
  const combatant = working.combatants[combatantId];
  if (!combatant) return { state, events };

  const eligible = Object.keys(combatant.statuses).filter((statusId) => !statusDefs[statusId]?.positive);

  let selected = eligible;
  if (limit !== undefined && eligible.length > limit) {
    const pool = [...eligible];
    const picked: string[] = [];
    for (let i = 0; i < limit && pool.length > 0; i++) {
      const roll = nextInt(working.rngState, 0, pool.length);
      working = { ...working, rngState: roll.nextState };
      picked.push(pool.splice(roll.value, 1)[0]);
    }
    selected = picked;
  }

  for (const statusId of selected) {
    const rm = removeStatus(working, round, combatantId, statusId, 'cleanse');
    working = rm.state;
    events.push(...rm.events);
  }

  return { state: working, events };
}

/**
 * Conduct's hook, generic over `triggerTypes`: a damage hit of a matching type detonates
 * a held status (bonus damage, then removal 'consumed'). Detonate-only — a clean hit
 * never plants the status; that is a move-authored statusApplication like any other.
 */
export function detonateTriggeredStatuses(
  state: CombatState,
  round: number,
  targetId: string,
  moveType: TypeId,
  maxHp: number,
  statusDefs: Record<string, StatusDefinition>
): { state: CombatState; bonusDamage: number; events: CombatEvent[] } {
  let working = state;
  const events: CombatEvent[] = [];
  let bonusDamage = 0;

  for (const def of Object.values(statusDefs)) {
    if (!def.triggerTypes?.includes(moveType)) continue;
    const target = working.combatants[targetId];
    if (!target || target.fainted) continue;
    if (!hasStatus(target, def.id)) continue;

    const bonus = Math.ceil(maxHp * (def.detonateBonusPercentMaxHp ?? 0));
    bonusDamage += bonus;
    // Own event so the view presents the detonation as a separate beat.
    events.push({ type: 'StatusDetonated', round, combatantId: targetId, statusId: def.id, amount: bonus });
    const rm = removeStatus(working, round, targetId, def.id, 'consumed');
    working = rm.state;
    events.push(...rm.events);
  }

  return { state: working, bonusDamage, events };
}

/**
 * Fire a TIMER-shape status's payload now (detonatesStatus — Miasma): the same
 * `magnitude`% of max HP the timer would pay at 0, removed with reason 'consumed'.
 * Gated on the shape, so naming a non-timer status is a silent no-op.
 */
export function detonateStatusNow(
  state: CombatState,
  round: number,
  combatantId: string,
  statusId: StatusId,
  statusDefs: Record<string, StatusDefinition>,
  maxHp: number
): { state: CombatState; amount: number; events: CombatEvent[] } {
  const def = statusDefs[statusId];
  const combatant = state.combatants[combatantId];
  if (!def || def.pipeline !== 'timer') return { state, amount: 0, events: [] };
  if (!combatant || combatant.fainted) return { state, amount: 0, events: [] };
  const instance = combatant.statuses[statusId];
  if (!instance) return { state, amount: 0, events: [] };

  const amount = Math.ceil((maxHp * (instance.magnitude ?? 0)) / 100);
  const events: CombatEvent[] = [{ type: 'StatusDetonated', round, combatantId, statusId, amount }];

  let working = state;
  const rm = removeStatus(working, round, combatantId, statusId, 'consumed');
  working = rm.state;
  events.push(...rm.events);

  const hpResult = applyHpDelta(working, round, combatantId, -amount, maxHp);
  working = hpResult.state;
  events.push(...hpResult.events);

  return { state: working, amount, events };
}

/**
 * Haunt's hook, generic over `spreadTriggerTypes`: a singleEnemy damage move resolved to
 * one target also hits the target's active ally if that ally holds a matching status.
 * Only singleEnemy expands (LOCKED, docs/conditions.md §7) — native spread moves are untouched.
 */
export function expandSpreadTargets(
  state: CombatState,
  moveType: TypeId,
  targetMode: TargetMode,
  targetIds: readonly string[],
  statusDefs: Record<string, StatusDefinition>
): { targetIds: string[]; spreadVia: Record<string, StatusId> } {
  if (targetMode !== 'singleEnemy' || targetIds.length !== 1) return { targetIds: [...targetIds], spreadVia: {} };
  const target = state.combatants[targetIds[0]];
  if (!target) return { targetIds: [...targetIds], spreadVia: {} };

  const spreadDefs = Object.values(statusDefs).filter((def) => def.spreadTriggerTypes?.includes(moveType));
  // spreadVia lets the caller stamp DamageDealt.viaStatusId on the dragged-in target.
  const spreadVia: Record<string, StatusId> = {};
  const extra = state.active[target.side].filter((id): id is string => {
    if (!id || id === targetIds[0] || state.combatants[id]?.fainted) return false;
    const match = spreadDefs.find((def) => hasStatus(state.combatants[id], def.id));
    if (match) spreadVia[id] = match.id;
    return !!match;
  });

  return { targetIds: extra.length > 0 ? [...targetIds, ...extra] : [...targetIds], spreadVia };
}

/**
 * Stealth's redirect (docs/conditions.md §7 Q7): a damage move resolved to exactly one
 * target that is Stealthed lands on its active partner instead. Literal-id check by design.
 */
export function applyStealthRedirect(
  state: CombatState,
  targetMode: TargetMode,
  moveKind: 'damage' | 'heal' | 'buff',
  targetIds: readonly string[]
): string[] {
  if (moveKind !== 'damage' || (targetMode !== 'singleEnemy' && targetMode !== 'singleAlly') || targetIds.length !== 1) {
    return [...targetIds];
  }

  const [id] = targetIds;
  const target = state.combatants[id];
  if (!target || !hasStatus(target, 'Stealth')) return [...targetIds];

  const alternate = state.active[target.side].find((cid): cid is string => cid !== null && cid !== id && !state.combatants[cid]?.fainted);
  return alternate ? [alternate] : [...targetIds];
}

/**
 * Provoke's redirect (redirectsSingleTargetEnemyMoves): every singleEnemy move of ANY
 * kind is pulled onto the taunter on the caster's enemy side. Runs after Stealth in
 * resolveRound so Provoke wins when a hero holds both.
 */
export function applyProvokeRedirect(
  state: CombatState,
  actorCombatantId: string,
  targetMode: TargetMode,
  targetIds: readonly string[],
  statusDefs: Record<string, StatusDefinition>
): string[] {
  if (targetMode !== 'singleEnemy' || targetIds.length !== 1) return [...targetIds];

  const actor = state.combatants[actorCombatantId];
  if (!actor) return [...targetIds];
  const enemySide = actor.side === 'A' ? 'B' : 'A';
  const taunts = tauntStatusIds(statusDefs);

  const taunter = state.active[enemySide].find((id): id is string => {
    if (!id) return false;
    const combatant = state.combatants[id];
    return !!combatant && !combatant.fainted && holdsAny(combatant, taunts);
  });

  return taunter ? [taunter] : [...targetIds];
}

/**
 * The hard targeting gate (requiresTargetStatus): only targets carrying the status.
 * Deliberately NO fallback — an empty result means the move has no legal target, and
 * both the view (FightScreen) and resolveRound read that off this one function.
 */
export function statusGatedTargets(state: CombatState, move: MoveDefinition, targetIds: readonly string[]): string[] {
  const required = move.requiresTargetStatus;
  if (!required) return [...targetIds];
  return targetIds.filter((id) => {
    const combatant = state.combatants[id];
    return combatant != null && hasStatus(combatant, required);
  });
}

/**
 * Declaration-time counterpart to the redirects: a taunter narrows a singleEnemy
 * picker to itself; a Stealthed hero is hidden from a single-target damage picker
 * (falling back to the full list if hiding would leave nothing).
 */
export function selectableTargets(
  state: CombatState,
  targetMode: TargetMode,
  moveKind: 'damage' | 'heal' | 'buff',
  candidateIds: readonly string[],
  /** Omitted keeps the pre-Provoke behaviour exactly. */
  statusDefs?: Record<string, StatusDefinition>
): string[] {
  if (statusDefs && targetMode === 'singleEnemy') {
    const taunts = tauntStatusIds(statusDefs);
    const taunter = candidateIds.find((id) => {
      const combatant = state.combatants[id];
      return !!combatant && !combatant.fainted && holdsAny(combatant, taunts);
    });
    if (taunter) return [taunter];
  }

  if (moveKind !== 'damage') return [...candidateIds];
  if (targetMode !== 'singleEnemy' && targetMode !== 'singleAlly') return [...candidateIds];

  const visible = candidateIds.filter((id) => {
    const combatant = state.combatants[id];
    return !combatant || !hasStatus(combatant, 'Stealth');
  });
  return visible.length > 0 ? visible : [...candidateIds];
}
