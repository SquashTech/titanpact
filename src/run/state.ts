// Run state (docs/architecture.md "State shapes (three tiers)": the RUN
// tier). Roster (<=6), equipment loadouts, and the pooled level-up currency
// that persist across a run's fights. Combat state (one fight) is built FROM
// a RunState via buildCombatState.ts and does not write back to it — the two
// tiers have different lifetimes (CLAUDE.md, docs/architecture.md). Meta
// state (what survives a run) is out of scope here; docs/architecture.md
// "Per-run reset vs meta-progression" is still 🔒 OPEN — this module doesn't
// assume either answer.

import type { StatKey } from '../engine/content';
import type { EquipmentLoadout } from './equipment';
import { createEmptyLoadout } from './equipment';

/** CLAUDE.md "Roster hard cap = 6, doubling as the bring-6-pick-4 battle sideboard." */
export const ROSTER_CAP = 6;

export interface RosterEntry {
  rosterId: string;
  heroId: string;
  equipment: EquipmentLoadout;
  /** Starts as a copy of HeroDefinition.moveIds; grows via progression.ts unlockTierMove. */
  unlockedMoveIds: string[];
  /** Points invested toward this hero's next rank-up threshold (progression.ts). */
  rankProgress: number;
  /** Rank-up branch ids chosen so far, in order. Empty = still base rank. */
  chosenBranchIds: string[];
  /**
   * Permanent stat grants accumulated from chosen rank-up branches
   * (docs/progression.md "Stat grants" — always multiples of 5/10). Kept
   * separate from equipment because rank-ups are "permanent within a run"
   * (CLAUDE.md) while equipment strips on termination.
   */
  rankStatGrants: Partial<Record<StatKey, number>>;
}

export interface RunState {
  roster: RosterEntry[];
  /** Pooled, freely distributable across the roster (docs/progression.md), not a per-hero locked track. */
  levelUpPool: number;
}

export function createRunState(levelUpPool = 0): RunState {
  return { roster: [], levelUpPool };
}

export function createRosterEntry(rosterId: string, heroId: string, startingMoveIds: readonly string[]): RosterEntry {
  return {
    rosterId,
    heroId,
    equipment: createEmptyLoadout(),
    unlockedMoveIds: [...startingMoveIds],
    rankProgress: 0,
    chosenBranchIds: [],
    rankStatGrants: {},
  };
}

export class RosterFullError extends Error {}

/**
 * Adds a hero to the roster. CLAUDE.md: "Gaining a hero requires terminating
 * an existing one" once at the cap — this function only enforces the cap
 * itself. Which acquisition path (Recruit Contract vs. Guild Hall) and their
 * costs are a separate, not-yet-built economy layer (gold, contract/guild
 * pools, decaying Guild Hall runway value per docs/progression.md) — out of
 * scope for this slice. Callers construct the RosterEntry however their
 * acquisition path dictates (e.g. a contract hero may start with branches
 * partially locked; a Guild Hall hero starts underleveled) — this function
 * doesn't encode either policy.
 */
export function addRosterEntry(run: RunState, entry: RosterEntry): RunState {
  if (run.roster.length >= ROSTER_CAP) {
    throw new RosterFullError(`Roster is at the ${ROSTER_CAP}-hero cap — terminate a hero before adding another`);
  }
  if (run.roster.some((r) => r.rosterId === entry.rosterId)) {
    throw new Error(`rosterId ${entry.rosterId} already exists on the roster`);
  }
  return { ...run, roster: [...run.roster, entry] };
}

/**
 * Termination (docs/progression.md "Equipment strips on contract
 * termination"): removes the hero and reclaims the roster slot. Because
 * equipment lives on the RosterEntry (not the hero), dropping the entry is
 * exactly "strips equipment" — there is no separate step. "No gold refund"
 * (CLAUDE.md) is a currency-layer consequence outside this module's scope.
 */
export function terminateRosterEntry(run: RunState, rosterId: string): RunState {
  return { ...run, roster: run.roster.filter((r) => r.rosterId !== rosterId) };
}
