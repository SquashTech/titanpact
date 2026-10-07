// The Tutor (docs/run-loop.md "The Tutor"): pick a hero, and ONE Late move is ROLLED from that
// hero's pool — a schedule offer with the band fixed, un-gated by level, taking no schedule entry.
// The Mentor rolled Mid the same way until 2026-10-07; it pays XP now (run/mentor.ts).

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

/** The Tutor's roll: a Late move, guaranteed — the expensive half of the catalog, handed over rather than reached. */
export function tutorMovePool(table: ProgressionTable, moves: Record<string, MoveDefinition>, entry: RosterEntry): string[] {
  return tierMovePool(table, moves, entry, 'late');
}
