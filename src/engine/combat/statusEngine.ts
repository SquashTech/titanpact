// The status engine (docs/conditions.md, the 6th contract's runtime half —
// StatusDefinition in content.ts is the data half). Reads StatusDefinition
// flags generically; contains no per-status special cases beyond the two
// documented exceptions the catalog itself calls out (Bleed's flat %maxHp,
// Blight's stat-pipeline hook which lives in state.ts instead since it must
// run on every getEffectiveStat call, not just at apply/tick time).

import type { StatusDefinition, StatusId, StatusRemovalReason } from '../content';
import type { CombatState, StatusInstance } from '../state';
import type { CombatEvent } from '../events';
import { applyHpDelta } from './faintHandling';

function setStatus(state: CombatState, combatantId: string, statusId: StatusId, instance: StatusInstance): CombatState {
  const combatant = state.combatants[combatantId];
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...combatant, statuses: { ...combatant.statuses, [statusId]: instance } } },
  };
}

function removeStatus(
  state: CombatState,
  round: number,
  combatantId: string,
  statusId: StatusId,
  reason: StatusRemovalReason
): { state: CombatState; events: CombatEvent[] } {
  const combatant = state.combatants[combatantId];
  if (!combatant?.statuses[statusId]) return { state, events: [] };
  const nextStatuses = { ...combatant.statuses };
  delete nextStatuses[statusId];
  return {
    state: { ...state, combatants: { ...state.combatants, [combatantId]: { ...combatant, statuses: nextStatuses } } },
    events: [{ type: 'StatusRemoved', round, combatantId, statusId, reason }],
  };
}

export interface StatusApplyParams {
  magnitude?: number;
  duration?: number;
}

/**
 * Applies (or stacks onto an existing) status per its StatusDefinition.stacking
 * rule (docs/conditions.md §1 per-status stacking column). No-ops on an already
 * fainted combatant.
 */
export function applyStatus(
  state: CombatState,
  round: number,
  combatantId: string,
  def: StatusDefinition,
  params: StatusApplyParams
): { state: CombatState; events: CombatEvent[] } {
  const combatant = state.combatants[combatantId];
  if (!combatant || combatant.fainted) return { state, events: [] };

  const existing = combatant.statuses[def.id];
  let magnitude = params.magnitude;
  let duration = params.duration;

  if (existing) {
    if (def.stacking === 'none') return { state, events: [] }; // reapply while present is a no-op (Bleed, Freeze)
    if (def.stacking === 'additive') {
      magnitude = (existing.magnitude ?? 0) + (params.magnitude ?? 0);
    } else if (def.stacking === 'takeHigher') {
      magnitude = params.magnitude !== undefined ? Math.max(existing.magnitude ?? 0, params.magnitude) : existing.magnitude;
      duration = params.duration !== undefined ? Math.max(existing.duration ?? 0, params.duration) : existing.duration;
    }
  }

  if (magnitude !== undefined && def.capMagnitude !== undefined) {
    magnitude = Math.min(def.capMagnitude, magnitude);
  }

  const nextState = setStatus(state, combatantId, def.id, { statusId: def.id, magnitude, duration });
  return { state: nextState, events: [{ type: 'StatusApplied', round, combatantId, statusId: def.id, magnitude, duration }] };
}

/**
 * End-of-round tick (docs/conditions.md §7 "Status tick timing" — resolved as
 * end-of-round, the only tick boundary this engine has). Runs over EVERY
 * combatant, active or benched: Bleed/Blight/Bind/Regen persist through switch
 * specifically so they aren't escapable by bench-parking, so their ticks must
 * follow. Handles DoT/HoT damage-or-heal + magnitude decay, and duration
 * countdown for Daze/Bind — driven entirely by StatusDefinition flags.
 */
export function tickEndOfRound(
  state: CombatState,
  round: number,
  statusDefs: Record<string, StatusDefinition>,
  maxHpOf: (combatantId: string) => number
): { state: CombatState; events: CombatEvent[] } {
  let working = state;
  const events: CombatEvent[] = [];

  for (const combatantId of Object.keys(working.combatants)) {
    const combatant = working.combatants[combatantId];
    if (!combatant || combatant.fainted) continue;

    for (const statusId of Object.keys(combatant.statuses)) {
      const instance = combatant.statuses[statusId];
      const def = statusDefs[statusId];
      if (!def || !instance || !def.ticksAtEndOfRound) continue;

      if (def.pipeline === 'dot' || def.pipeline === 'hot') {
        const maxHp = maxHpOf(combatantId);
        const magnitude = instance.magnitude ?? (def.flatPercentOfMaxHp ? Math.ceil(maxHp * def.flatPercentOfMaxHp) : 0);
        const delta = def.pipeline === 'dot' ? -magnitude : magnitude;
        // Computed up front so the StatusTicked event's newMagnitude is already the
        // post-decay value the view should replay onto combatant.statuses. Left
        // undefined for non-decaying statuses (Bleed) — it has no magnitude to begin
        // with, and a stray 0 would render as "Bleed 0" instead of "Bleed".
        const decayedMagnitude = def.decay === 'halve' ? Math.floor((instance.magnitude ?? 0) / 2) : undefined;

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

        if (def.decay === 'halve') {
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

  return { state: working, events };
}

/** docs/conditions.md §4: switching to bench clears every status with clearsOnSwitch (Burn, Freeze, Daze). */
export function clearOnSwitch(
  state: CombatState,
  round: number,
  combatantId: string,
  statusDefs: Record<string, StatusDefinition>
): { state: CombatState; events: CombatEvent[] } {
  let working = state;
  const events: CombatEvent[] = [];
  const combatant = working.combatants[combatantId];
  if (!combatant) return { state, events };

  for (const statusId of Object.keys(combatant.statuses)) {
    if (!statusDefs[statusId]?.clearsOnSwitch) continue;
    const rm = removeStatus(working, round, combatantId, statusId, 'switch');
    working = rm.state;
    events.push(...rm.events);
  }

  return { state: working, events };
}

/** Pops Expose for the damage pipeline's modifier list (docs/conditions.md: "wiped on the first instance of receiving damage"). Magnitude is 0 if absent. */
export function consumeExpose(
  state: CombatState,
  round: number,
  targetId: string
): { state: CombatState; magnitude: number; events: CombatEvent[] } {
  const instance = state.combatants[targetId]?.statuses['Expose'];
  if (!instance) return { state, magnitude: 0, events: [] };
  const rm = removeStatus(state, round, targetId, 'Expose', 'consumed');
  return { state: rm.state, magnitude: instance.magnitude ?? 0, events: rm.events };
}

/**
 * docs/conditions.md §7 "Cleanse & positive statuses" — resolved per the doc's
 * own recommendation: 'debuffs' strips everything except Regen (the only
 * positive status); 'all' strips everything including Regen.
 */
export function cleanseStatuses(
  state: CombatState,
  round: number,
  combatantId: string,
  scope: 'debuffs' | 'all'
): { state: CombatState; events: CombatEvent[] } {
  let working = state;
  const events: CombatEvent[] = [];
  const combatant = working.combatants[combatantId];
  if (!combatant) return { state, events };

  for (const statusId of Object.keys(combatant.statuses)) {
    if (scope === 'debuffs' && statusId === 'Regen') continue;
    const rm = removeStatus(working, round, combatantId, statusId, 'cleanse');
    working = rm.state;
    events.push(...rm.events);
  }

  return { state: working, events };
}
