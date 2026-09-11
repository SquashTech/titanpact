import { typeChart } from '../../data/typechart';
import type { TypeId } from '../../engine/content';
import { resolveTypeMult } from '../../engine/damage/typeMult';

export type MatchupVerdict = 'up' | 'down' | null;

/**
 * One hero against one enemy, as an arrow (SquadSelectScreen, 2026-09-11, per user direction).
 * Read both ways through the same resolveTypeMult the damage pipeline uses: the hero's best STAB
 * type into the enemy's typing, and the enemy's best into the hero's. The two are set against
 * each other in doublings, so a 2× swing that is also a 2× exposure is a wash — an arrow only
 * shows when the hero comes out a full doubling ahead or behind.
 */
export function matchupVerdict(heroTypes: readonly TypeId[], enemyTypes: readonly TypeId[]): MatchupVerdict {
  const offense = Math.max(...heroTypes.map((t) => resolveTypeMult(typeChart, t, enemyTypes)));
  const defense = Math.max(...enemyTypes.map((t) => resolveTypeMult(typeChart, t, heroTypes)));
  const net = Math.log2(offense) - Math.log2(defense);
  if (net >= 1) return 'up';
  if (net <= -1) return 'down';
  return null;
}
