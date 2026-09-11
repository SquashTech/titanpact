// The Tutor node (docs/run-loop.md "The Tutor"): one hero, then ANY move off that hero's own
// level-up pool. No roll, no tier gate, and nothing burned by an offer the hero already declined
// — this file owns the one question the progression table can't answer on its own, which is what
// "everything this hero could ever have learned" means once its Evolution is behind it.

import type { MoveDefinition, MoveTier } from '../engine/content';
import { chosenEvolutionPaths, type ProgressionTable } from './progression';
import type { RosterEntry } from './state';

/** Display order for the offer list; an unauthored `tier` is Early, as everywhere else. */
const TIER_RANK: Record<MoveTier, number> = { early: 0, mid: 1, late: 2 };

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
  entry: RosterEntry
): string[] {
  const fromPaths = chosenEvolutionPaths(table, entry).flatMap((path) => [
    ...(path.learnableMoveIds ?? []),
    ...path.unlocksMoveIds,
  ]);
  const pool = [...new Set([...(table.moveTiers[entry.heroId] ?? []), ...fromPaths])].filter((id) => !!moves[id]);
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
  entry: RosterEntry
): number {
  return tutorMovePool(table, moves, entry).filter((id) => !entry.unlockedMoveIds.includes(id)).length;
}

// --- The Mentor (acts 1-3, docs/growth-overhaul.md §11) ---
//
// "Teaches any hero a powerful move": pick a hero, and the Mentor ROLLS one Mid-tier move from
// that hero's pool — a Scroll pour with the band fixed at Mid, un-rank-gated, ticking nothing. A
// Mid move in Act 1 is a powerful move, which is the whole of what the node needs to say. It used
// to be a curated pick from the hero's Early-and-Mid list (2026-09-11), and that read as a
// designer's screen on one of the first nodes a new player meets; a roll keeps the payoff and
// leaves WHO as the only decision.

/**
 * What the Mentor can roll for `entry`: Mid-tier moves in the hero's pool — the authored table
 * plus a chosen path's line — not held and not already offered. `offeredMoveIds` IS honoured,
 * unlike the Tutor: the Mentor's offer is a roll, and a rolled offer is spent by being made
 * (docs/leveling-and-ranks.md), so a Mid move a Scroll already burned stays burned.
 */
export function mentorMovePool(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  entry: RosterEntry
): string[] {
  const fromPaths = chosenEvolutionPaths(table, entry).flatMap((path) => path.learnableMoveIds ?? []);
  const pool = [...new Set([...(table.moveTiers[entry.heroId] ?? []), ...fromPaths])];
  return pool.filter(
    (id) =>
      moves[id]?.tier === 'mid' && !entry.unlockedMoveIds.includes(id) && !entry.offeredMoveIds.includes(id)
  );
}
