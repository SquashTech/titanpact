// The Tutor (docs/tutor.md): one forced seat in act 4. Pick a hero, then pick ANY move it can
// learn and does not hold — the run's one curated move, for the hole a kit still has that late.
// Late first, since that is what the run is short of by then. The Mentor rolled Mid moves until
// 2026-10-07; it pays XP now (run/mentor.ts).

import type { MoveDefinition, MoveTier } from '../engine/content';
import { chosenEvolutionPaths, type ProgressionTable } from './progression';
import type { RosterEntry } from './state';
import { rosterHeroes } from '../data/content';

const TIER_ORDER: Record<MoveTier, number> = { late: 0, mid: 1, early: 2 };

/**
 * Every move this hero could learn and does not hold: its starting kit, its level-up pool, and a
 * chosen path's moves (the granted and the learnable line). A move once offered and declined is
 * NOT burned here — this is a pick, not a roll. No signature and no Class move: neither is in any
 * of these lists. Late, then Mid, then Early.
 */
export function tutorMovePool(table: ProgressionTable, moves: Record<string, MoveDefinition>, entry: RosterEntry): string[] {
  const paths = chosenEvolutionPaths(table, entry);
  const pool = [
    ...new Set([
      ...(rosterHeroes[entry.heroId]?.moveIds ?? []),
      ...(table.moveTiers[entry.heroId] ?? []),
      ...paths.flatMap((path) => [...path.unlocksMoveIds, ...(path.learnableMoveIds ?? [])]),
    ]),
  ];
  const rank = (id: string) => TIER_ORDER[moves[id].tier ?? 'early'];
  return pool.filter((id) => moves[id] && !entry.unlockedMoveIds.includes(id)).sort((a, b) => rank(a) - rank(b));
}
