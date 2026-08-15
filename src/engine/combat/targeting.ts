// The targeting model (docs/combat.md "Action declaration & targeting").
// Moves target a specific slot on the 2v2 grid, or a fixed group. No spread
// damage reduction exists anywhere downstream of this — a move hitting two
// targets deals full damage to each.

import type { TargetMode } from '../content';
import type { CombatState, Side } from '../state';

export function oppositeSide(side: Side): Side {
  return side === 'A' ? 'B' : 'A';
}

export function findCombatantSide(state: CombatState, combatantId: string): Side {
  const combatant = state.combatants[combatantId];
  if (!combatant) throw new Error(`Unknown combatant: ${combatantId}`);
  return combatant.side;
}

function activeOf(state: CombatState, side: Side): string[] {
  return state.active[side].filter((id): id is string => id !== null && !state.combatants[id]?.fainted);
}

/**
 * Resolves a TargetMode into concrete combatant ids.
 * `declaredTarget` is required for singleEnemy/singleAlly (the player's choice
 * of slot) and ignored for fixed-group modes.
 */
export function resolveTargets(
  state: CombatState,
  actorCombatantId: string,
  targetMode: TargetMode,
  declaredTarget?: string | null
): string[] {
  const side = findCombatantSide(state, actorCombatantId);
  const enemySide = oppositeSide(side);

  switch (targetMode) {
    case 'self':
      return [actorCombatantId];

    case 'bothEnemies':
      return activeOf(state, enemySide);

    case 'bothAllies':
      return activeOf(state, side);

    case 'allOthers':
      return [...activeOf(state, enemySide), ...activeOf(state, side).filter((id) => id !== actorCombatantId)];

    case 'singleEnemy': {
      if (!declaredTarget) throw new Error('singleEnemy move requires a declared target');
      if (!activeOf(state, enemySide).includes(declaredTarget)) {
        throw new Error(`Declared target ${declaredTarget} is not an active enemy`);
      }
      return [declaredTarget];
    }

    case 'singleAlly': {
      if (!declaredTarget) throw new Error('singleAlly move requires a declared target');
      if (!activeOf(state, side).includes(declaredTarget)) {
        throw new Error(`Declared target ${declaredTarget} is not an active ally`);
      }
      return [declaredTarget];
    }
  }
}
