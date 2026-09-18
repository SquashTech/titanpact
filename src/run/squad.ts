// Squad selection: validates the fielded roster and its lead order for buildCombatState.ts.

import { ROSTER_CAP, type RosterEntry } from './state';

export interface Squad {
  /** Up to 2 active roster ids; null means that slot starts empty. */
  activeIds: [string | null, string | null];
  benchIds: string[];
  /**
   * Bench members that enter ONLY when the side's field is empty (docs/titan-eyes.md §6 — the
   * wide Eyes, phase 2). Benched for every other purpose: they regenerate, they are out of the
   * Clock's leak, they count toward the side's defeat. Player squads never carry any.
   */
  reserveIds?: string[];
}

export class SquadSelectionError extends Error {}

/**
 * Every fight fields the whole roster (2026-09-17, per user direction, FOR PLAYTEST — docs/combat.md
 * "The fielded roster"). It was bring-6-pick-4: against a fully scouted AI party the pick was a chart
 * lookup, not a decision, and roster-wide levelling had already made rotation free. Lock-in derives
 * from the side's size (engine/state.ts lockInThreshold), so six locks at 3 with nothing else touched.
 */
export const STANDARD_SQUAD_SIZE = ROSTER_CAP;

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
