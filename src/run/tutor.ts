// The Tutor node (docs/run-loop.md "The Tutor") and its early sibling the Mentor (docs/growth-
// overhaul.md §11): one hero, then ANY move off that hero's own pool — up to a tier ceiling for
// the Mentor. No roll, no rank gate, and nothing burned by an offer the hero already declined —
// this file owns the one question the progression table can't answer on its own, which is what
// "everything this hero could ever have learned" means once its Evolution is behind it.

import type { MoveDefinition, MoveTier } from '../engine/content';
import { chosenEvolutionPaths, type ProgressionTable } from './progression';
import type { RosterEntry } from './state';

/** Display order for the offer list; an unauthored `tier` is Early, as everywhere else. */
const TIER_RANK: Record<MoveTier, number> = { early: 0, mid: 1, late: 2 };

/**
 * The Mentor's ceiling (acts 1-3): Early and Mid, never Late. Un-rank-gated on purpose — rank
 * progress and the Evolution both live only on the Scroll, so a Mentor move fills a slot and ticks
 * nothing; what it buys is an answer to the Acts 1-2 wall, chosen rather than rolled.
 */
export const MENTOR_TIER_CEILING: MoveTier = 'mid';

/**
 * Everything `entry` could ever have learned by levelling: its authored pool, plus every move
 * the Evolution paths it actually took brought with them — both the ones a path JOINS to the
 * pool (`learnableMoveIds`) and the ones it GRANTED outright (`unlocksMoveIds`), since a grant
 * refused at MOVE_CAP is otherwise gone for the rest of the run and this is the one node that
 * can hand it back.
 *
 * Deliberately NOT filtered by `offeredMoveIds` — a declined offer is exactly the hole the Tutor
 * exists to fill — NOT tier-gated, and NOT filtered by what the hero currently holds: the screen
 * greys those in place rather than hiding them, so the list reads as the whole repertoire. The
 * starting kit is absent because it was never learned from a level-up.
 *
 * Sorted tier, then mana cost, then name, so the list climbs the curve the pool was authored to.
 */
export function tutorMovePool(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  entry: RosterEntry,
  tierCeiling: MoveTier = 'late'
): string[] {
  const fromPaths = chosenEvolutionPaths(table, entry).flatMap((path) => [
    ...(path.learnableMoveIds ?? []),
    ...path.unlocksMoveIds,
  ]);
  const pool = [...new Set([...(table.moveTiers[entry.heroId] ?? []), ...fromPaths])].filter(
    (id) => !!moves[id] && TIER_RANK[moves[id].tier ?? 'early'] <= TIER_RANK[tierCeiling]
  );
  return pool.sort((a, b) => {
    const tier = TIER_RANK[moves[a].tier ?? 'early'] - TIER_RANK[moves[b].tier ?? 'early'];
    if (tier !== 0) return tier;
    const mana = moves[a].manaCost - moves[b].manaCost;
    if (mana !== 0) return mana;
    return moves[a].name.localeCompare(moves[b].name);
  });
}

/** How many of the pool this hero does not already hold — the hero card's "worth spending it here" line. */
export function tutorTeachableCount(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  entry: RosterEntry,
  tierCeiling: MoveTier = 'late'
): number {
  return tutorMovePool(table, moves, entry, tierCeiling).filter((id) => !entry.unlockedMoveIds.includes(id)).length;
}
