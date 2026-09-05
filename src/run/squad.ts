// Bring-6-pick-4 squad selection: validates the pick and shapes it for buildCombatState.ts.

import type { RosterEntry } from './state';

export interface Squad {
  /** Up to 2 active roster ids; null means that slot starts empty. */
  activeIds: [string | null, string | null];
  benchIds: string[];
}

export class SquadSelectionError extends Error {}

/** Bring-6-pick-4 everywhere except the finale, which fields the whole roster (docs/run-loop.md §4). */
export const STANDARD_SQUAD_SIZE = 4;

/** Exactly `maxSize` once the roster reaches it, the whole roster below that — a hero can never be benched by omission. */
export function requiredSquadSize(rosterSize: number, maxSize: number = STANDARD_SQUAD_SIZE): number {
  return Math.min(maxSize, rosterSize);
}

/** The first two picks become the active pair; the rest start benched. */
export function pickSquad(
  roster: readonly RosterEntry[],
  pickedRosterIds: readonly string[],
  maxSize: number = STANDARD_SQUAD_SIZE
): Squad {
  const required = requiredSquadSize(roster.length, maxSize);
  if (pickedRosterIds.length !== required) {
    throw new SquadSelectionError(`Pick exactly ${required} heroes for this fight, got ${pickedRosterIds.length}`);
  }
  if (new Set(pickedRosterIds).size !== pickedRosterIds.length) {
    throw new SquadSelectionError('Squad selection contains a duplicate rosterId');
  }
  const rosterIds = new Set(roster.map((r) => r.rosterId));
  for (const id of pickedRosterIds) {
    if (!rosterIds.has(id)) throw new SquadSelectionError(`${id} is not on the roster`);
  }

  const [a, b, ...bench] = pickedRosterIds;
  return { activeIds: [a ?? null, b ?? null], benchIds: bench };
}
