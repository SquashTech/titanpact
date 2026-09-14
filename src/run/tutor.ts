// The Mentor and the Tutor (docs/run-loop.md "The Mentor", "The Tutor"): one beat, two bands.
// Pick a hero, and ONE move of a fixed tier is ROLLED from that hero's pool — a schedule offer
// with the band fixed, un-gated by level, taking no schedule entry. The Mentor rolls Mid in acts
// 1-3; the Tutor rolls Late in acts 4-5 (2026-09-13, per user direction — it used to be a curated
// pick of ANY move off the pool, which was the run's strongest reward and its longest screen).
// Together they are the only way to a move AHEAD of its schedule: a Mid move in Act 1, a Late
// move before the band opens, or a second Late move once it has.

import type { MoveDefinition, MoveTier } from '../engine/content';
import { chosenEvolutionPaths, type ProgressionTable } from './progression';
import type { RosterEntry } from './state';

/**
 * What a roll at `tier` can land for `entry`: moves of that tier in the hero's pool — the
 * authored table plus a chosen path's line — not held and not already offered. `offeredMoveIds`
 * IS honoured: a rolled offer is spent by being made (docs/leveling-and-ranks.md), so a move a
 * level's offer already burned stays burned.
 */
export function tierMovePool(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  entry: RosterEntry,
  tier: MoveTier
): string[] {
  const fromPaths = chosenEvolutionPaths(table, entry).flatMap((path) => path.learnableMoveIds ?? []);
  const pool = [...new Set([...(table.moveTiers[entry.heroId] ?? []), ...fromPaths])];
  return pool.filter(
    (id) => moves[id]?.tier === tier && !entry.unlockedMoveIds.includes(id) && !entry.offeredMoveIds.includes(id)
  );
}

/** The Mentor's roll: a Mid move. A Mid move in Act 1 is a powerful move, which is the whole of what the node needs to say. */
export function mentorMovePool(table: ProgressionTable, moves: Record<string, MoveDefinition>, entry: RosterEntry): string[] {
  return tierMovePool(table, moves, entry, 'mid');
}

/** The Tutor's roll: a Late move, guaranteed — the expensive half of the catalog, handed over rather than reached. */
export function tutorMovePool(table: ProgressionTable, moves: Record<string, MoveDefinition>, entry: RosterEntry): string[] {
  return tierMovePool(table, moves, entry, 'late');
}
