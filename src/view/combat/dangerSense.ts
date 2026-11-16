import type { HeroDefinition, MoveDefinition } from '../../engine/content';
import type { Action } from '../../engine/combat/actions';
import { resolveTargets } from '../../engine/combat/targeting';
import { moveForHero, resolveTargetMode, type CombatState, type Side } from '../../engine/state';

/** At or above this a hit is super effective, and the hero it is aimed at senses it. */
export const SENSE_THRESHOLD = 2;

function isDamaging(move: MoveDefinition): boolean {
  return move.kind === 'damage' || move.basePower != null || move.randomBasePower != null;
}

/**
 * The player's heroes that sense danger this round (docs/danger-sense.md): each one a declared enemy
 * move would hit super effectively. Never who or what. A random-target move marks every hero it might pick.
 */
export function sensedDanger(
  state: CombatState,
  actions: readonly Action[],
  moves: Record<string, MoveDefinition>,
  heroes: Record<string, HeroDefinition>,
  playerSide: Side,
  effectiveness: (move: MoveDefinition, defenderId: string) => number
): Set<string> {
  const out = new Set<string>();
  for (const action of actions) {
    if (action.kind !== 'move') continue;
    const authored = moves[action.moveId];
    const caster = state.combatants[action.combatantId];
    if (!authored || !caster) continue;
    const move = moveForHero(authored, heroes[caster.heroId]);
    if (!isDamaging(move)) continue;
    let targets: string[];
    try {
      targets = resolveTargets(state, action.combatantId, resolveTargetMode(state, move), action.declaredTarget);
    } catch {
      continue;
    }
    for (const id of targets) {
      if (state.combatants[id]?.side !== playerSide) continue;
      if (effectiveness(move, id) >= SENSE_THRESHOLD) out.add(id);
    }
  }
  return out;
}
