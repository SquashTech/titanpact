// The status engine (docs/conditions.md, the 6th contract's runtime half —
// StatusDefinition in content.ts is the data half). Reads StatusDefinition
// flags generically; contains no per-status special cases beyond the
// documented exceptions the catalog itself calls out: Bleed's flat %maxHp,
// Freeze's stat-pipeline hook (lives in state.ts instead, since it must run
// on every getEffectiveStat call rather than only at apply/tick time), and
// Stealth's untargetable-while-active redirect (applyStealthRedirect below —
// narrow enough to stay a literal status-id check, same precedent as Freeze).

import type { StatusDefinition, StatusId, StatusRemovalReason, TargetMode, TypeId } from '../content';
import type { CombatState, StatusInstance } from '../state';
import { hasStatus } from '../state';
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
    if (def.stacking === 'none') return { state, events: [] }; // reapply while present is a no-op (Bleed, Freeze, Conduct, Haunt)
    if (def.stacking === 'additive') {
      magnitude = (existing.magnitude ?? 0) + (params.magnitude ?? 0);
    } else if (def.stacking === 'takeHigher') {
      magnitude = params.magnitude !== undefined ? Math.max(existing.magnitude ?? 0, params.magnitude) : existing.magnitude;
      duration = params.duration !== undefined ? Math.max(existing.duration ?? 0, params.duration) : existing.duration;
    } else if (def.stacking === 'additiveMagnitudeFixedDuration') {
      // Poison (docs/conditions.md §7 Q3/Q4): magnitude builds up, but the
      // timer never resets or extends — reapplying mid-countdown ignores
      // params.duration entirely and just holds the existing value.
      magnitude = (existing.magnitude ?? 0) + (params.magnitude ?? 0);
      duration = existing.duration;
    }
  }

  const nextState = setStatus(state, combatantId, def.id, { statusId: def.id, magnitude, duration });
  return { state: nextState, events: [{ type: 'StatusApplied', round, combatantId, statusId: def.id, magnitude, duration }] };
}

/**
 * End-of-round tick (docs/conditions.md §7 "Status tick timing" — resolved as
 * end-of-round, the only tick boundary this engine has). Runs over EVERY
 * combatant, active or benched: Bleed/Poison/Regen persist through switch
 * specifically so they aren't escapable by bench-parking, so their ticks must
 * follow — except Poison's `activeOnly` flag, which stalls its timer entirely
 * while benched instead (docs/conditions.md: "switching stalls the clock
 * rather than clearing it"). Handles DoT/HoT damage-or-heal + magnitude decay,
 * Poison's timer-then-detonate, and duration countdown for Daze/Stealth —
 * driven entirely by StatusDefinition flags.
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

/**
 * Start-of-round tick (Stealth only, currently) — the counterpart to
 * tickEndOfRound above, run BEFORE a round's actions so the countdown lands
 * on a round boundary the caster wasn't already mid-action for. A duration
 * already at 0 has used up the one full round it was owed (see
 * ticksAtStartOfRound's doc comment in content.ts) and is removed before this
 * round's actions run; otherwise it decrements and stays present, so it also
 * protects the round now starting.
 */
export function tickStartOfRound(
  state: CombatState,
  round: number,
  statusDefs: Record<string, StatusDefinition>
): { state: CombatState; events: CombatEvent[] } {
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

/** docs/conditions.md §4: switching to bench clears every status with clearsOnSwitch (Burn, Freeze, Daze, Haunt). */
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

/**
 * docs/conditions.md §7 "Cleanse & positive statuses" — resolved as a flat
 * rule, not a per-move choice: Cleanse strips every status EXCEPT ones
 * flagged `positive` (Regen, Stealth). Data-driven off StatusDefinition.positive
 * rather than a hardcoded status-id check.
 */
export function cleanseStatuses(
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
    if (statusDefs[statusId]?.positive) continue;
    const rm = removeStatus(working, round, combatantId, statusId, 'cleanse');
    working = rm.state;
    events.push(...rm.events);
  }

  return { state: working, events };
}

/**
 * Conduct's engine hook, written generically off `triggerTypes` /
 * `detonateBonusPercentMaxHp` so any future type-triggered status reuses it.
 * For a `kind: 'damage'` hit whose move type matches a status's
 * `triggerTypes`: if the target already carries that status, detonate it
 * (bonus damage, then `removeStatus` reason 'consumed') — otherwise apply it
 * fresh (boolean shape, no magnitude/duration needed) via the existing
 * `applyStatus` helper. docs/conditions.md: "apply and detonate are separate"
 * — a single hit only ever does one or the other, never both.
 */
export function applyOrDetonateTriggeredStatuses(
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

    if (hasStatus(target, def.id)) {
      const bonus = Math.ceil(maxHp * (def.detonateBonusPercentMaxHp ?? 0));
      bonusDamage += bonus;
      // Own event (not folded into the triggering hit's DamageDealt) so the view
      // can present the detonation as a separate beat/indicator — see events.ts.
      events.push({ type: 'StatusDetonated', round, combatantId: targetId, statusId: def.id, amount: bonus });
      const rm = removeStatus(working, round, targetId, def.id, 'consumed');
      working = rm.state;
      events.push(...rm.events);
    } else {
      const applied = applyStatus(working, round, targetId, def, {});
      working = applied.state;
      events.push(...applied.events);
    }
  }

  return { state: working, bonusDamage, events };
}

/**
 * Haunt's engine hook, written generically off `spreadTriggerTypes` so any
 * future retarget-style status reuses it. For a `singleEnemy` `kind: 'damage'`
 * move resolved to exactly one target: if an active ally-of-the-target (not
 * the target itself) carries a status whose `spreadTriggerTypes` matches the
 * move's type, that ally is added to the target list too — single-target
 * becomes spread. Only expands `singleEnemy` targeting — native spread moves
 * (bothEnemies/allOthers) are untouched. LOCKED, 2026-08-18 designer sign-off
 * (docs/conditions.md §7): this caps Haunt's burst ceiling at one extra
 * full-damage hit rather than roughly doubling an already-spread move.
 */
export function expandSpreadTargets(
  state: CombatState,
  moveType: TypeId,
  targetMode: TargetMode,
  targetIds: readonly string[],
  statusDefs: Record<string, StatusDefinition>
): string[] {
  if (targetMode !== 'singleEnemy' || targetIds.length !== 1) return [...targetIds];
  const target = state.combatants[targetIds[0]];
  if (!target) return [...targetIds];

  const extra = state.active[target.side].filter((id): id is string => {
    if (!id || id === targetIds[0] || state.combatants[id]?.fainted) return false;
    return Object.values(statusDefs).some(
      (def) => def.spreadTriggerTypes?.includes(moveType) && hasStatus(state.combatants[id], def.id)
    );
  });

  return extra.length > 0 ? [...targetIds, ...extra] : [...targetIds];
}

/**
 * Stealth's redirect (docs/conditions.md, §7 Q7 resolution: "a fast stealth
 * can redirect an attack directed at that hero"). Narrow one-off mechanic —
 * stays a literal 'Stealth' id check, same precedent as Freeze's Speed hook
 * in state.ts. Only redirects a `kind: 'damage'` move resolved to exactly one
 * target (singleEnemy/singleAlly) — spread moves still land, per the doc.
 * Because actions resolve in priority/speed order and this runs at the exact
 * point the attack resolves, a Stealth applied by a faster action earlier
 * this same round is already on the target when this check runs; a slower
 * Stealth simply hasn't landed yet and the attack goes through untouched.
 */
export function applyStealthRedirect(
  state: CombatState,
  targetMode: TargetMode,
  moveKind: 'damage' | 'heal' | 'buff',
  targetIds: readonly string[]
): string[] {
  if (moveKind !== 'damage') return [...targetIds];
  if (targetMode !== 'singleEnemy' && targetMode !== 'singleAlly') return [...targetIds];
  if (targetIds.length !== 1) return [...targetIds];

  const [id] = targetIds;
  const target = state.combatants[id];
  if (!target || !hasStatus(target, 'Stealth')) return [...targetIds];

  const alternate = state.active[target.side].find((cid): cid is string => cid !== null && cid !== id && !state.combatants[cid]?.fainted);
  return alternate ? [alternate] : [...targetIds];
}
