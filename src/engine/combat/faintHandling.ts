// The one place an HP change lands on state, so move damage, healing and
// status ticks all produce identical HpChanged/Fainted behaviour.

import type { CombatState } from '../state';
import type { CombatEvent } from '../events';

/**
 * Applies `delta` to currentHp (negative floors at 0 and can faint; positive caps at
 * maxHp). Emits HpChanged and, on a KO, Fainted (koCount incremented, slot cleared).
 * No-ops on an already-fainted target.
 */
export function applyHpDelta(
  state: CombatState,
  round: number,
  targetId: string,
  delta: number,
  maxHp: number
): { state: CombatState; events: CombatEvent[] } {
  const target = state.combatants[targetId];
  if (!target || target.fainted) return { state, events: [] };

  const previousHp = target.currentHp;
  const raw = previousHp + delta;
  const newHp = delta < 0 ? Math.max(0, raw) : Math.min(maxHp, raw);
  const fainted = delta < 0 && newHp <= 0;

  // damageTakenSinceLastTurn accumulates here (every HP loss passes through), counting
  // HP ACTUALLY removed. Healing never decrements it.
  const damageTaken = delta < 0 ? target.damageTakenSinceLastTurn + (previousHp - newHp) : target.damageTakenSinceLastTurn;

  let working: CombatState = {
    ...state,
    combatants: { ...state.combatants, [targetId]: { ...target, currentHp: newHp, fainted, damageTakenSinceLastTurn: damageTaken } },
  };
  const events: CombatEvent[] = [{ type: 'HpChanged', round, combatantId: targetId, previousHp, newHp, maxHp }];

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

  return { state: working, events };
}
