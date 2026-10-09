// The status engine (docs/conditions.md). Reads StatusDefinition flags
// generically; the catalog's one remaining literal-id check is Freeze's Speed
// hook in state.ts.

import type { FieldEffectDefinition, MoveDefinition, PassiveDefinition, PassiveId, StatusDefinition, StatusId, StatusRemovalReason, TargetMode, TypeId } from '../content';
import type { CombatState, Combatant, StatusInstance } from '../state';
import { hasStatus } from '../state';
import type { CombatEvent } from '../events';
import { applyHpDelta } from './faintHandling';
import { wardOn, wardRefusesStatus } from './ward';
import { nextInt } from '../rng/seededRng';

type StatusResult = { state: CombatState; events: CombatEvent[] };

/** `decay: 'halve'` as a retained share. */
const DEFAULT_DECAY_RETAIN = 0.5;

function setStatus(state: CombatState, combatantId: string, statusId: StatusId, instance: StatusInstance): CombatState {
  const combatant = state.combatants[combatantId];
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...combatant, statuses: { ...combatant.statuses, [statusId]: instance } } },
  };
}

export function removeStatus(state: CombatState, round: number, combatantId: string, statusId: StatusId, reason: StatusRemovalReason): StatusResult {
  const combatant = state.combatants[combatantId];
  if (!combatant?.statuses[statusId]) return { state, events: [] };
  const held = combatant.statuses[statusId].magnitude;
  const nextStatuses = { ...combatant.statuses };
  delete nextStatuses[statusId];
  return {
    state: { ...state, combatants: { ...state.combatants, [combatantId]: { ...combatant, statuses: nextStatuses } } },
    events: [{ type: 'StatusRemoved', round, combatantId, statusId, reason, ...(held === undefined ? {} : { magnitude: held }) }],
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
  /** The holder's max HP — the ceiling a 'shield' pipeline's pool is held at (docs/shield.md §3.1), and what a `ticksOnApply` HoT heals a percent of. */
  holderMaxHp?: number;
  /** The active Field Effect's definition, for a `ticksOnApply` heal it amplifies (Verdant Earth). */
  fieldEffect?: FieldEffectDefinition;
  /** The status catalog, so an amplified heal can find the Shield its overflow becomes. */
  statusDefs?: Record<string, StatusDefinition>;
}

/**
 * True when the active field refuses this combatant any HP back (Blood Moon on a Bleeding hero,
 * FieldEffectDefinition.blocksHealingWhile). Every heal site reads it: a heal move, a drain, a
 * passive heal and a HoT tick. A potion is not a heal and does not.
 */
export function healBlocked(state: CombatState, combatantId: string, fieldEffect: FieldEffectDefinition | undefined): boolean {
  const statusId = fieldEffect?.blocksHealingWhile;
  const combatant = state.combatants[combatantId];
  return !!statusId && !!combatant && hasStatus(combatant, statusId);
}

/**
 * The percent a timed status's NEXT round end ticks for (docs/timed-statuses.md), read off the rounds
 * it has left; under a field that holds it (Scorched Land), always its first round's.
 */
export function timedTickPercent(def: StatusDefinition, roundsLeft: number | undefined, fieldEffect?: FieldEffectDefinition): number {
  const percents = def.timed?.tickPercents ?? [];
  if (percents.length === 0) return 0;
  if (fieldEffect?.holdsTimedStatusAtFirst?.includes(def.id)) return percents[0];
  const left = Math.max(1, Math.min(percents.length, roundsLeft ?? percents.length));
  return percents[percents.length - left];
}

/** What one tick of a dot deals: a timed round's percent (Burn), a flat fraction (Bleed), or the magnitude itself. */
export function dotTickAmount(def: StatusDefinition, instance: { magnitude?: number; duration?: number }, maxHp: number, fieldEffect?: FieldEffectDefinition): number {
  if (def.timed) return Math.ceil((maxHp * timedTickPercent(def, instance.duration, fieldEffect)) / 100);
  if (instance.magnitude === undefined && def.flatPercentOfMaxHp) return Math.ceil(maxHp * def.flatPercentOfMaxHp);
  return instance.magnitude ?? 0;
}

/** What one heal of a hot restores before any field: a timed round's percent of max HP (Renew), or the magnitude itself. */
export function hotTickAmount(def: StatusDefinition, instance: { magnitude?: number; duration?: number }, maxHp: number): number {
  if (def.timed) return Math.ceil((maxHp * timedTickPercent(def, instance.duration)) / 100);
  return instance.magnitude ?? 0;
}

/** Everything a timed status deals or heals over its rounds left (the AI's and the pilot's horizon). */
export function timedRemainingAmount(def: StatusDefinition, roundsLeft: number | undefined, maxHp: number, fieldEffect?: FieldEffectDefinition): number {
  let total = 0;
  for (let left = roundsLeft ?? def.timed?.tickPercents.length ?? 0; left > 0; left--) {
    total += Math.ceil((maxHp * timedTickPercent(def, left, fieldEffect)) / 100);
  }
  return total;
}

/**
 * A HoT's round-end heal: its share of the holder's max HP (or a flat amount), times the field's
 * `amplifiesStatusHealing`, and — under a field that says so — whatever passes max HP laid on as
 * Shield (Verdant Earth). A holder the field refuses healing (Blood Moon) ticks for nothing, and
 * the tick says so (`blocked`).
 */
function healFromStatus(
  state: CombatState,
  round: number,
  combatantId: string,
  def: StatusDefinition,
  instance: { magnitude?: number; duration?: number },
  maxHp: number,
  fieldEffect: FieldEffectDefinition | undefined,
  statusDefs: Record<string, StatusDefinition> | undefined,
  tick: { newMagnitude?: number; newDuration?: number }
): StatusResult {
  if (healBlocked(state, combatantId, fieldEffect)) {
    return { state, events: [{ type: 'StatusTicked', round, combatantId, statusId: def.id, kind: 'heal', amount: 0, blocked: true, ...tick }] };
  }
  const base = hotTickAmount(def, instance, maxHp);
  const amplified = fieldEffect?.amplifiesStatusHealing;
  const boosted = amplified?.statusIds.includes(def.id) ? Math.round(base * amplified.multiplier) : base;
  const events: CombatEvent[] = [{ type: 'StatusTicked', round, combatantId, statusId: def.id, kind: 'heal', amount: boosted, ...tick }];
  const room = Math.max(0, maxHp - state.combatants[combatantId].currentHp);
  const hpResult = applyHpDelta(state, round, combatantId, boosted, maxHp);
  let working = hpResult.state;
  events.push(...hpResult.events);
  const overflow = boosted - room;
  if (overflow > 0 && amplified?.overflowToShield && amplified.statusIds.includes(def.id) && statusDefs) {
    const shieldDef = Object.values(statusDefs).find((d) => d.pipeline === 'shield');
    if (shieldDef) {
      const shielded = applyStatus(working, round, combatantId, shieldDef, { magnitude: overflow, holderMaxHp: maxHp });
      working = shielded.state;
      events.push(...shielded.events);
    }
  }
  return { state: working, events };
}

/** Applies (or stacks onto) a status per StatusDefinition.stacking. No-ops on a fainted combatant. */
/** An active combatant whose side has an active holder refusing this status (Combatant.sideStatusImmunities). The bench is never covered. */
export function sideRefuses(state: CombatState, round: number, combatantId: string, statusId: StatusId): CombatEvent | null {
  const combatant = state.combatants[combatantId];
  if (!combatant) return null;
  const field = state.active[combatant.side];
  if (!field.includes(combatantId)) return null;
  for (const id of field) {
    const holder = id ? state.combatants[id] : undefined;
    const passiveId = holder && !holder.fainted ? holder.sideStatusImmunities?.[statusId] : undefined;
    if (holder && passiveId) return { type: 'StatusRefused', round, combatantId, statusId, holderCombatantId: holder.combatantId, passiveId };
  }
  return null;
}

export function applyStatus(state: CombatState, round: number, combatantId: string, def: StatusDefinition, params: StatusApplyParams): StatusResult {
  const combatant = state.combatants[combatantId];
  if (!combatant || combatant.fainted) return { state, events: [] };
  const refused = sideRefuses(state, round, combatantId, def.id);
  if (refused) return { state, events: [refused] };

  const existing = combatant.statuses[def.id];
  // A timed status carries no number: every application lands it whole, back at its first round.
  if (def.timed) {
    const duration = def.timed.tickPercents.length;
    return {
      state: setStatus(state, combatantId, def.id, { statusId: def.id, duration }),
      events: [{ type: 'StatusApplied', round, combatantId, sourceCombatantId: params.sourceCombatantId, statusId: def.id, duration }],
    };
  }
  let magnitude = params.magnitude;
  let duration = params.duration;
  let capped = false;

  if (existing) {
    if (def.stacking === 'none') return { state, events: [] };
    if (def.stacking === 'additive') {
      magnitude = (existing.magnitude ?? 0) + (magnitude ?? 0);
    } else if (def.stacking === 'takeHigher') {
      magnitude = params.magnitude !== undefined ? Math.max(existing.magnitude ?? 0, params.magnitude) : existing.magnitude;
      duration = params.duration !== undefined ? Math.max(existing.duration ?? 0, params.duration) : existing.duration;
    } else if (def.stacking === 'additiveMagnitudeFixedDuration') {
      // Poison: magnitude builds, the timer never resets or extends.
      magnitude = (existing.magnitude ?? 0) + (params.magnitude ?? 0);
      duration = existing.duration;
    } else if (def.stacking === 'additiveRefreshDuration') {
      // Renew: the pool builds, and the clock is topped back up to the longer of the two.
      magnitude = (existing.magnitude ?? 0) + (params.magnitude ?? 0);
      duration = Math.max(existing.duration ?? 0, duration ?? 0);
    }
  }

  // A Shield never holds more than the holder's own max HP: the pool lands the rest of the
  // way and says so, the way a stat at its ceiling does.
  if (def.pipeline === 'shield' && params.holderMaxHp !== undefined && magnitude !== undefined && magnitude > params.holderMaxHp) {
    magnitude = params.holderMaxHp;
    capped = true;
  }

  const nextState = setStatus(state, combatantId, def.id, { statusId: def.id, magnitude, duration });
  return {
    state: nextState,
    events: [
      {
        type: 'StatusApplied',
        round,
        combatantId,
        sourceCombatantId: params.sourceCombatantId,
        statusId: def.id,
        magnitude,
        duration,
        ...(capped ? { capped: true } : {}),
      },
    ],
  };
}

/**
 * Ice Shell's clause (docs/shield.md §3.5): once a hit has broken the holder's Shield, every
 * status the holder carries with `onShieldBroken` lands its rider on the striker and is
 * consumed. Runs after the hit has resolved, so the striker pays with the damage already done.
 */
export function resolveShieldBrokenRiders(
  state: CombatState,
  round: number,
  holderId: string,
  strikerId: string,
  statusDefs: Record<string, StatusDefinition>,
  maxHpOf: (combatantId: string) => number,
  /** Omitted (tests) = no ward can refuse the rider. */
  passiveDefs: Record<PassiveId, PassiveDefinition> = {}
): StatusResult {
  let working = state;
  const events: CombatEvent[] = [];
  const holder = working.combatants[holderId];
  if (!holder) return { state, events };

  for (const statusId of Object.keys(holder.statuses)) {
    const rider = statusDefs[statusId]?.onShieldBroken;
    if (!rider) continue;
    const consumed = removeStatus(working, round, holderId, statusId, 'consumed');
    working = consumed.state;
    events.push(...consumed.events);
    const riderDef = statusDefs[rider.statusId];
    if (!riderDef) continue;
    // A warded striker (the Herald) refuses the rider; the Shell is still spent.
    if (wardRefusesStatus(working, strikerId, holderId, riderDef, passiveDefs)) continue;
    const applied = applyStatus(working, round, strikerId, riderDef, {
      magnitude: rider.magnitude,
      duration: rider.duration,
      sourceCombatantId: holderId,
      holderMaxHp: maxHpOf(strikerId),
    });
    working = applied.state;
    events.push(...applied.events);
  }

  return { state: working, events };
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
      // Held but harmless while an active ally refuses it (Flameproof); it resumes once that ally leaves.
      const refusedTick = def.pipeline === 'dot' ? sideRefuses(working, round, combatantId, statusId) : null;
      if (refusedTick) {
        events.push(refusedTick);
        continue;
      }

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
      } else if (def.timed && (def.pipeline === 'dot' || def.pipeline === 'hot')) {
        // A timed status (Burn, Renew): this round's percent, one round spent, gone with the last.
        const maxHp = maxHpOf(combatantId);
        const newDuration = (instance.duration ?? 1) - 1;
        if (def.pipeline === 'hot') {
          const healed = healFromStatus(working, round, combatantId, def, instance, maxHp, activeFieldEffectDef, statusDefs, { newDuration });
          working = healed.state;
          events.push(...healed.events);
        } else {
          const amount = dotTickAmount(def, instance, maxHp, activeFieldEffectDef);
          events.push({ type: 'StatusTicked', round, combatantId, statusId, kind: 'damage', amount, newDuration });
          const hpResult = applyHpDelta(working, round, combatantId, -amount, maxHp);
          working = hpResult.state;
          events.push(...hpResult.events);
        }
        if (!working.combatants[combatantId].statuses[statusId]) continue;
        if (newDuration <= 0) {
          const rm = removeStatus(working, round, combatantId, statusId, 'expired');
          working = rm.state;
          events.push(...rm.events);
        } else {
          working = setStatus(working, combatantId, statusId, { ...working.combatants[combatantId].statuses[statusId], duration: newDuration });
        }
      } else if (def.pipeline === 'dot' || def.pipeline === 'hot') {
        const maxHp = maxHpOf(combatantId);
        const magnitude = def.pipeline === 'dot' ? dotTickAmount(def, instance, maxHp) : hotTickAmount(def, instance, maxHp);
        const delta = def.pipeline === 'dot' ? -magnitude : magnitude;
        // undefined (not 0) for a non-decaying status, so the view never renders "Bleed 0".
        const decayedMagnitude = def.decay === 'halve' ? Math.floor((instance.magnitude ?? 0) * DEFAULT_DECAY_RETAIN) : undefined;

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

/** A Rest puts out every status with clearsOnRest (Burn, docs/status-ladders-and-fields.md §1). */
export function clearOnRest(state: CombatState, round: number, combatantId: string, statusDefs: Record<string, StatusDefinition>): StatusResult {
  return removeStatusesWhere(state, round, combatantId, statusDefs, (def) => def.clearsOnRest, 'rest');
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
  statusDefs: Record<string, StatusDefinition>,
  sourceCombatantId?: string
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
    events.push({ type: 'StatusDetonated', round, combatantId: targetId, sourceCombatantId, statusId: def.id, amount: bonus });
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
  maxHp: number,
  sourceCombatantId?: string
): { state: CombatState; amount: number; events: CombatEvent[] } {
  const def = statusDefs[statusId];
  const combatant = state.combatants[combatantId];
  if (!def || def.pipeline !== 'timer') return { state, amount: 0, events: [] };
  if (!combatant || combatant.fainted) return { state, amount: 0, events: [] };
  const instance = combatant.statuses[statusId];
  if (!instance) return { state, amount: 0, events: [] };

  const amount = Math.ceil((maxHp * (instance.magnitude ?? 0)) / 100);
  const events: CombatEvent[] = [{ type: 'StatusDetonated', round, combatantId, sourceCombatantId, statusId, amount }];

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
 * Haunt's hook, generic over `spreadTriggerTypes`: a singleEnemy damage move resolved to one
 * target that holds a matching status also hits that target's active partner — the echo follows
 * the hit, so focusing the Haunted hero is what spreads it (docs/blessings-and-statuses.md §2).
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

  const match = Object.values(statusDefs).find((def) => def.spreadTriggerTypes?.includes(moveType) && hasStatus(target, def.id));
  if (!match) return { targetIds: [...targetIds], spreadVia: {} };
  // spreadVia lets the caller stamp DamageDealt.viaStatusId on the dragged-in partner.
  const spreadVia: Record<string, StatusId> = {};
  const extra = state.active[target.side].filter((id): id is string => !!id && id !== targetIds[0] && !state.combatants[id]?.fainted);
  for (const id of extra) spreadVia[id] = match.id;

  return { targetIds: extra.length > 0 ? [...targetIds, ...extra] : [...targetIds], spreadVia };
}

/**
 * Haunt passing on (`passesOnFaint`): a knocked-out holder gives the status to its active partner,
 * or, with none free (no partner, or one already holding it), leaves it waiting for the next hero
 * to enter on that side (`pendingSideStatuses`, taken in switching.ts performSwitch). Removing it
 * from the fallen is what marks it passed, so the sweep can run at any point and runs once.
 */
export function passFaintedStatuses(
  state: CombatState,
  round: number,
  statusDefs: Record<string, StatusDefinition>
): StatusResult {
  let working = state;
  const events: CombatEvent[] = [];
  for (const fallen of Object.values(state.combatants)) {
    if (!fallen.fainted) continue;
    for (const statusId of Object.keys(fallen.statuses)) {
      const def = statusDefs[statusId];
      if (!def?.passesOnFaint) continue;
      const removed = removeStatus(working, round, fallen.combatantId, statusId, 'passed');
      working = removed.state;
      events.push(...removed.events);
      const partnerId = working.active[fallen.side].find(
        (id): id is string => !!id && id !== fallen.combatantId && !working.combatants[id].fainted && !hasStatus(working.combatants[id], statusId)
      );
      if (partnerId) {
        const applied = applyStatus(working, round, partnerId, def, {});
        working = applied.state;
        events.push(...applied.events);
      } else {
        const waiting = working.pendingSideStatuses?.[fallen.side] ?? [];
        if (!waiting.includes(statusId)) {
          working = { ...working, pendingSideStatuses: { ...working.pendingSideStatuses, [fallen.side]: [...waiting, statusId] } };
        }
      }
    }
  }
  return { state: working, events };
}

/**
 * Provoke's redirect (redirectsSingleTargetEnemyMoves): every singleEnemy move of ANY
 * kind is pulled onto the taunter on the caster's enemy side. The only retargeting layer
 * that pulls toward its holder; Haunt's spread runs after it.
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
/**
 * The blocking status this combatant is holding, or null — read off the flag, not off an id, so a
 * second guard status needs no second code path. First match wins; nothing today stacks two.
 */
export function blockingStatusId(
  state: CombatState,
  combatantId: string,
  statusDefs: Record<string, StatusDefinition>
): StatusId | null {
  const combatant = state.combatants[combatantId];
  if (!combatant) return null;
  for (const statusId of Object.keys(combatant.statuses)) {
    if (statusDefs[statusId]?.blocksIncomingMoves) return statusId;
  }
  return null;
}

export function statusGatedTargets(state: CombatState, move: MoveDefinition, targetIds: readonly string[]): string[] {
  const required = move.requiresTargetStatus;
  if (!required) return [...targetIds];
  return targetIds.filter((id) => {
    const combatant = state.combatants[id];
    return combatant != null && hasStatus(combatant, required);
  });
}

/**
 * Declaration-time counterpart to applyProvokeRedirect: a taunter narrows a singleEnemy
 * picker to itself, so the button shows where the move will actually land.
 */
export function selectableTargets(
  state: CombatState,
  targetMode: TargetMode,
  candidateIds: readonly string[],
  /** Omitted narrows nothing. */
  statusDefs?: Record<string, StatusDefinition>,
  /** Omitted = no ward is read; with it, a warded foe is left off a single-target picker while anyone else is on it. */
  passiveDefs?: Record<PassiveId, PassiveDefinition>
): string[] {
  if (statusDefs && targetMode === 'singleEnemy') {
    const taunts = tauntStatusIds(statusDefs);
    const taunter = candidateIds.find((id) => {
      const combatant = state.combatants[id];
      return !!combatant && !combatant.fainted && holdsAny(combatant, taunts);
    });
    if (taunter) return [taunter];
  }
  // A ward is permanent for as long as it holds, so unlike a Barrier it is never a guess worth
  // offering: the picker skips it. Only ever narrows — a pool that is all warded is left alone.
  if (passiveDefs && targetMode === 'singleEnemy') {
    const open = candidateIds.filter((id) => wardOn(state, id, passiveDefs) === null);
    if (open.length > 0) return open;
  }

  return [...candidateIds];
}
