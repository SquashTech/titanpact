// Bring-6-pick-4 squad selection (docs/combat.md "Bring-6-pick-4 sideboard",
// CLAUDE.md "Roster hard cap = 6, doubling as the bring-6-pick-4 battle
// sideboard"). Turns a chosen subset of the roster into the {active, bench}
// shape buildCombatState.ts needs to seed a CombatState. This module knows
// nothing about combat state or hero content — it only validates the pick.

import type { RosterEntry } from './state';

export interface Squad {
  /** Up to 2 active roster ids; null means that slot starts empty. */
  activeIds: [string | null, string | null];
  benchIds: string[];
}

export class SquadSelectionError extends Error {}

/** How many heroes a fight fields, given the current roster size — exactly 4 (2 active + 2 bench) once the roster reaches 4, or the whole roster below that (docs/combat.md "bring-6-pick-4"). A player must never be able to under-pick and leave a recruited hero benched by omission. */
export function requiredSquadSize(rosterSize: number): number {
  return Math.min(4, rosterSize);
}

/**
 * Picks a squad from the roster. A fight fields 4 (2 active + 2 bench) per
 * docs/combat.md; below 4 recruited heroes (early run), the whole roster must
 * be picked — no partial pick is legal, so a player can never accidentally
 * bench a hero by leaving them unselected. The first two picks become the
 * active pair; the rest start benched.
 */
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
