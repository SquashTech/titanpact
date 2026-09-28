// The one place an HP change lands on state, so move damage, healing and
// status ticks all produce identical HpChanged/Fainted behaviour.

import type { StatusDefinition } from '../content';
import type { CombatState } from '../state';
import type { CombatEvent } from '../events';
import { absorbIntoShield } from '../status/shield';

/**
 * Where an HP loss came from (docs/shield.md §3.2). Only a 'hit' — a move's hit and the
 * detonation that rides it — is taken from a Shield first; everything else is 'direct' and
 * goes straight to HP, which is also the default so an unlabelled call never absorbs.
 * 'clock' (the Pact Clock) and 'cost' (recoil, a self-HP price) are direct losses a Blessing
 * never answers (docs/blessings-and-statuses.md §1.3).
 */
export type HpLossSource = 'hit' | 'direct' | 'clock' | 'cost';

export interface HpLossOptions {
  source: HpLossSource;
  /** Needed to find the Shield; a 'hit' without it is direct. */
  statusDefs?: Record<string, StatusDefinition>;
  /** The striker, carried on a 'broken' StatusRemoved. */
  sourceCombatantId?: string;
}

/**
 * Applies `delta` to currentHp (negative floors at 0 and can faint; positive caps at
 * maxHp). Emits HpChanged and, on a KO, Fainted (koCount incremented, slot cleared).
 * No-ops on an already-fainted target. A negative delta from a 'hit' is absorbed by the
 * target's Shield first; `absorbed` is what the pool took, and the HpChanged that follows
 * is the remainder (a fully absorbed hit still emits it, unchanged, as a 0 hit does).
 * `prevented` is what a Blessing turned aside: the whole loss that would have knocked out.
 */
export function applyHpDelta(
  state: CombatState,
  round: number,
  targetId: string,
  delta: number,
  maxHp: number,
  loss?: HpLossOptions
): { state: CombatState; events: CombatEvent[]; absorbed: number; shieldBroken: boolean; prevented: number } {
  const target = state.combatants[targetId];
  if (!target || target.fainted) return { state, events: [], absorbed: 0, shieldBroken: false, prevented: 0 };

  let working: CombatState = state;
  const events: CombatEvent[] = [];
  let absorbed = 0;
  let shieldBroken = false;
  if (delta < 0 && loss?.source === 'hit' && loss.statusDefs) {
    const shield = absorbIntoShield(working, round, targetId, -delta, loss.statusDefs, loss.sourceCombatantId);
    working = shield.state;
    events.push(...shield.events);
    absorbed = shield.absorbed;
    shieldBroken = shield.broken;
    delta += absorbed;
  }

  const previousHp = target.currentHp;
  const raw = previousHp + delta;
  let newHp = delta < 0 ? Math.max(0, raw) : Math.min(maxHp, raw);
  let fainted = delta < 0 && newHp <= 0;
  // Lingering (PassiveDefinition.enduresOnce): a KO is refused and the hero stands at 1. A floor,
  // not a trigger — every loss source reads it, the Pact Clock included.
  let enduresLeft = target.enduresLeft;
  const endured = fainted && (enduresLeft ?? 0) > 0;
  if (endured) {
    newHp = 1;
    fainted = false;
    enduresLeft = (enduresLeft as number) - 1;
  }
  // A Blessing (docs/blessings-and-statuses.md §1): after the Shield and after Lingering, the
  // knockout's whole loss is prevented and the Blessing is spent. Never the Clock, never a cost.
  const source = loss?.source ?? 'direct';
  const blessed = fainted && target.blessed === true && source !== 'clock' && source !== 'cost';
  const prevented = blessed ? -delta : 0;
  if (blessed) {
    newHp = previousHp;
    fainted = false;
  }

  // damageTakenSinceLastTurn accumulates here (every HP loss passes through), counting
  // HP ACTUALLY removed. Healing never decrements it, and a Shield's absorb never adds.
  const damageTaken = delta < 0 ? target.damageTakenSinceLastTurn + (previousHp - newHp) : target.damageTakenSinceLastTurn;

  const current = working.combatants[targetId];
  working = {
    ...working,
    combatants: {
      ...working.combatants,
      [targetId]: { ...current, currentHp: newHp, fainted, damageTakenSinceLastTurn: damageTaken, enduresLeft, ...(blessed ? { blessed: false } : {}) },
    },
  };
  events.push({ type: 'HpChanged', round, combatantId: targetId, previousHp, newHp, maxHp });
  if (endured) events.push({ type: 'Endured', round, combatantId: targetId });
  if (blessed) events.push({ type: 'BlessingSpent', round, combatantId: targetId, prevented });

  if (fainted) {
    const side = target.side;
    const koCount = working.koCount[side] + 1;
    working = {
      ...working,
      koCount: { ...working.koCount, [side]: koCount },
      active: {
        ...working.active,
        [side]: working.active[side].map((id) => (id === targetId ? null : id)) as [string | null, string | null],
      },
    };
    events.push({ type: 'Fainted', round, combatantId: targetId, side, koCount });
  }

  return { state: working, events, absorbed, shieldBroken, prevented };
}
