// Bring-6-pick-4 squad selection: validates the pick and shapes it for buildCombatState.ts.

import type { RosterEntry } from './state';

export interface Squad {
  /** Up to 2 active roster ids; null means that slot starts empty. */
  activeIds: [string | null, string | null];
  benchIds: string[];
}

export class SquadSelectionError extends Error {}

/** Exactly 4 once the roster reaches 4, the whole roster below that — a hero can never be benched by omission. */
export function requiredSquadSize(rosterSize: number): number {
  return Math.min(4, rosterSize);
}

/** The first two picks become the active pair; the rest start benched. */
export function pickSquad(roster: readonly RosterEntry[], pickedRosterIds: readonly string[]): Squad {
  const required = requiredSquadSize(roster.length);
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
