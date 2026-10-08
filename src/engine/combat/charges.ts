// Charges given back (docs/charges.md): one reader for a restoreCharge passive and a move's
// restoresCharges. Never past a move's count; a move with nothing spent is skipped.

import type { CombatState } from '../state';
import type { MoveDefinition, MoveTag } from '../content';
import type { CombatEvent } from '../events';

export interface ChargeRestore {
  amount: number | 'all';
  /** Only the target's moves carrying this tag. */
  moveTag?: MoveTag;
  /** Only this move (a passive's `triggeringMove`). */
  onlyMoveId?: string;
}

export function restoreCharges(
  state: CombatState,
  round: number,
  combatantId: string,
  moves: Record<string, MoveDefinition> | undefined,
  restore: ChargeRestore
): { state: CombatState; events: CombatEvent[] } {
  const target = state.combatants[combatantId];
  if (!target || target.fainted || !target.chargesSpent) return { state, events: [] };
  const events: CombatEvent[] = [];
  const spent = { ...target.chargesSpent };
  for (const [moveId, count] of Object.entries(target.chargesSpent)) {
    if (!count) continue;
    if (restore.onlyMoveId !== undefined && moveId !== restore.onlyMoveId) continue;
    const move = moves?.[moveId];
    if (!move || move.chargesPerFight == null) continue;
    if (restore.moveTag !== undefined && !move.tags?.includes(restore.moveTag)) continue;
    const restored = restore.amount === 'all' ? count : Math.min(count, restore.amount);
    if (restored <= 0) continue;
    spent[moveId] = count - restored;
    events.push({ type: 'ChargeRestored', round, combatantId, moveId, restored, chargesLeft: move.chargesPerFight - spent[moveId]! });
  }
  if (events.length === 0) return { state, events };
  return { state: { ...state, combatants: { ...state.combatants, [combatantId]: { ...target, chargesSpent: spent } } }, events };
}
