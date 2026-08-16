// Shared "land an HP change on state" logic — the one place that owns how
// damage and healing actually mutate currentHp and trigger a faint, so move
// damage, move healing, and status DoT/HoT ticks (engine/combat/statusEngine.ts)
// all produce identical HpChanged/Fainted behavior instead of three copies of
// it. Extracted from the logic that used to live inline in resolveRound.ts's
// move-damage branch.

import type { CombatState } from '../state';
import type { CombatEvent } from '../events';
import { findCombatantSide } from './targeting';

/**
 * Applies `delta` to `targetId`'s currentHp (negative = damage, floors at 0
 * and can faint; positive = heal, caps at maxHp and never faints), emitting
 * HpChanged and — for a damage delta that brings HP to 0 — Fainted, mirroring
 * the KO-handling in resolveRound.ts (koCount increment, active slot cleared).
 * No-ops (returns state unchanged, no events) if the target is already fainted.
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

  let working: CombatState = {
    ...state,
    combatants: { ...state.combatants, [targetId]: { ...target, currentHp: newHp, fainted } },
  };
  const events: CombatEvent[] = [{ type: 'HpChanged', round, combatantId: targetId, previousHp, newHp, maxHp }];

  if (fainted) {
    const side = findCombatantSide(working, targetId);
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
