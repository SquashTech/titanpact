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
 */
export type HpLossSource = 'hit' | 'direct';

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
 */
export function applyHpDelta(
  state: CombatState,
  round: number,
  targetId: string,
  delta: number,
  maxHp: number,
  loss?: HpLossOptions
): { state: CombatState; events: CombatEvent[]; absorbed: number; shieldBroken: boolean } {
  const target = state.combatants[targetId];
  if (!target || target.fainted) return { state, events: [], absorbed: 0, shieldBroken: false };

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
  const newHp = delta < 0 ? Math.max(0, raw) : Math.min(maxHp, raw);
  const fainted = delta < 0 && newHp <= 0;

  // damageTakenSinceLastTurn accumulates here (every HP loss passes through), counting
  // HP ACTUALLY removed. Healing never decrements it, and a Shield's absorb never adds.
  const damageTaken = delta < 0 ? target.damageTakenSinceLastTurn + (previousHp - newHp) : target.damageTakenSinceLastTurn;

  const current = working.combatants[targetId];
  working = {
    ...working,
    combatants: { ...working.combatants, [targetId]: { ...current, currentHp: newHp, fainted, damageTakenSinceLastTurn: damageTaken } },
  };
  events.push({ type: 'HpChanged', round, combatantId: targetId, previousHp, newHp, maxHp });

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

  return { state: working, events, absorbed, shieldBroken };
}
