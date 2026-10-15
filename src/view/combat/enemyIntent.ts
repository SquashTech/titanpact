import type { MoveDefinition } from '../../engine/content';
import type { Action } from '../../engine/combat/actions';
import { resolveTargets } from '../../engine/combat/targeting';
import { resolveTargetMode, type CombatState, type Side } from '../../engine/state';

const STORAGE_KEY = 'titanpact.enemyIntent';

/** A draft behind the Dev menu: off unless switched on there. */
export function readEnemyIntent(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeEnemyIntent(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Private-mode Safari throws on localStorage access.
  }
}

/**
 * Who each enemy is aiming at this round, never with what (docs/enemy-intent.md): for each of the
 * player's heroes, the enemies whose declared move would land on it. A move aimed only at the
 * enemy's own side, a switch and a Rest say nothing. A random-target move marks every hero it
 * might pick.
 */
export function aimedAt(state: CombatState, actions: readonly Action[], moves: Record<string, MoveDefinition>, playerSide: Side): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const action of actions) {
    if (action.kind !== 'move') continue;
    const move = moves[action.moveId];
    if (!move) continue;
    let targets: string[];
    try {
      targets = resolveTargets(state, action.combatantId, resolveTargetMode(state, move), action.declaredTarget);
    } catch {
      continue;
    }
    for (const id of targets) {
      if (state.combatants[id]?.side !== playerSide) continue;
      (out[id] ??= []).push(action.combatantId);
    }
  }
  return out;
}
