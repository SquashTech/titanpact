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

/**
 * Picks a squad from the roster. A fight fields 4 (2 active + 2 bench) per
 * docs/combat.md, but this accepts 1-4 picks so a roster smaller than 4
 * (early run, before 4 heroes are recruited) still produces a legal squad.
 * The first two picks become the active pair; the rest start benched.
 */
export function pickSquad(roster: readonly RosterEntry[], pickedRosterIds: readonly string[]): Squad {
  if (pickedRosterIds.length < 1 || pickedRosterIds.length > 4) {
    throw new SquadSelectionError(`Pick 1-4 heroes for a fight, got ${pickedRosterIds.length}`);
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
