// Squad selection: validates the fielded roster and its lead order for buildCombatState.ts.

import { ROSTER_CAP, type RosterEntry } from './state';
import { standingRoster } from './wounds';

export interface Squad {
  /** Up to 2 active roster ids; null means that slot starts empty. */
  activeIds: [string | null, string | null];
  benchIds: string[];
  /**
   * Later PHASES of the fight, in order: each inner list enters only once nothing of an earlier
   * phase stands (docs/titan-eyes.md §6, §10 — the half-lidded Eyes, then the wide pair). Benched
   * for every other purpose: they regenerate, they are out of the Clock's leak, they count toward
   * the side's defeat. Player squads never carry any.
   */
  reserves?: readonly (readonly string[])[];
}

export class SquadSelectionError extends Error {}

/**
 * Every fight fields the whole roster (2026-09-17, per user direction, FOR PLAYTEST — docs/combat.md
 * "The fielded roster"). It was bring-6-pick-4: against a fully scouted AI party the pick was a chart
 * lookup, not a decision, and roster-wide levelling had already made rotation free. Lock-in derives
 * from the side's size (engine/state.ts lockInThreshold), so six locks at 3 with nothing else touched.
 */
export const STANDARD_SQUAD_SIZE = ROSTER_CAP;

/** Exactly `maxSize` once the standing roster reaches it, all of it below that — a hero can never be benched by omission. */
export function requiredSquadSize(standingSize: number, maxSize: number = STANDARD_SQUAD_SIZE): number {
  return Math.min(maxSize, standingSize);
}

/**
 * The first two picks become the active pair; the rest start benched. The pick is every STANDING
 * hero (run/wounds.ts): a hero a fight left down stays on the roster and off the field.
 */
export function pickSquad(
  roster: readonly RosterEntry[],
  pickedRosterIds: readonly string[],
  maxSize: number = STANDARD_SQUAD_SIZE
): Squad {
  const standing = standingRoster(roster);
  const required = requiredSquadSize(standing.length, maxSize);
  if (pickedRosterIds.length !== required) {
    throw new SquadSelectionError(`Pick exactly ${required} heroes for this fight, got ${pickedRosterIds.length}`);
  }
  if (new Set(pickedRosterIds).size !== pickedRosterIds.length) {
    throw new SquadSelectionError('Squad selection contains a duplicate rosterId');
  }
  const rosterIds = new Set(roster.map((r) => r.rosterId));
  const standingIds = new Set(standing.map((r) => r.rosterId));
  for (const id of pickedRosterIds) {
    if (!rosterIds.has(id)) throw new SquadSelectionError(`${id} is not on the roster`);
    if (!standingIds.has(id)) throw new SquadSelectionError(`${id} is down`);
  }

  const [a, b, ...bench] = pickedRosterIds;
  return { activeIds: [a ?? null, b ?? null], benchIds: bench };
}
