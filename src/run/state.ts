// Run-tier state (docs/architecture.md "State shapes (three tiers)"). Combat
// state is built FROM this (buildCombatState.ts) and never writes back.

import type { PassiveId, StatKey, TypeId } from '../engine/content';
import type { EquipmentLoadout } from './equipment';
import { createEmptyLoadout } from './equipment';
import type { RunMap } from './map';

export const ROSTER_CAP = 6;

export const TOTAL_ACTS = 5;

export interface RosterEntry {
  rosterId: string;
  heroId: string;
  equipment: EquipmentLoadout;
  /** Starts as a copy of HeroDefinition.moveIds; grows via progression.ts. */
  unlockedMoveIds: string[];
  /** A plain count of level-ups taken this run, starting at 1 — not an XP bar. Sole gate on Evolution. */
  level: number;
  /** Evolution path ids chosen so far, in order. */
  chosenPathIds: string[];
  // The four stat-grant sources below are kept separate (not folded into one)
  // so a hero sheet can answer "where did this Speed come from".
  /** Permanent grants from chosen Evolution paths. */
  evolutionStatGrants: Partial<Record<StatKey, number>>;
  /** Passives granted by chosen Evolution paths. */
  evolutionPassiveGrants: readonly PassiveId[];
  /** Passives granted by map events. Duplicates stack. */
  bonusPassiveGrants: readonly PassiveId[];
  /** Permanent grants from map-node rewards and event stat shifts. */
  bonusStatGrants: Partial<Record<StatKey, number>>;
  /** Permanent grants from mastery level-ups (progression.ts grantMasteryStat). */
  masteryStatGrants: Partial<Record<StatKey, number>>;
  /** Current secondary-type grant from the latest type-graft path; a later graft overwrites. Innate primary never changes. */
  evolutionTypeGraft: TypeId | null;
  /** One Class per run holds structurally — a single slot, and classes.ts grantClass replaces. */
  classId: PassiveId | null;
}

export interface RunState {
  roster: RosterEntry[];
  /** Pooled, freely distributable across the roster. */
  levelUpPool: number;
  /**
   * The player walked away from the Level Up screen with a spendable pool. Suppresses the
   * post-node gate so a banked pool is not re-offered at every node; any XP grant clears it.
   */
  levelUpDeferred: boolean;
  /** Spent at a Guild Hall; contracts are claimed, not bought with this. */
  gold: number;
  /** Owned relic ids — duplicates stack. */
  relics: string[];
  /** Starts at 1; +1 at the end of every act; purchasable at a shop. */
  recruitContracts: number;
  /** Null for a RunState that never gets a map (enemyGen.ts throwaway rosters). */
  map: RunMap | null;
  /** Null = map generated but not yet entered. */
  currentNodeId: string | null;
  /** Current act only; advanceToNextAct clears it. */
  visitedNodeIds: string[];
  /** `fight` nodes entered this run (whole run, not per act) — drives the one-time 2v2 breather. */
  fightsStarted: number;
  /** 1-indexed. */
  actNumber: number;
  /** One location id per act, index 0 = Act 1. Empty on throwaway RunStates; locationForAct falls back. */
  locationIds: readonly string[];
}

export function createRunState(levelUpPool = 0, gold = 0, recruitContracts = 1): RunState {
  return {
    roster: [],
    levelUpPool,
    levelUpDeferred: false,
    gold,
    relics: [],
    recruitContracts,
    map: null,
    currentNodeId: null,
    visitedNodeIds: [],
    fightsStarted: 0,
    actNumber: 1,
    locationIds: [],
  };
}

export function createRosterEntry(rosterId: string, heroId: string, startingMoveIds: readonly string[]): RosterEntry {
  return {
    rosterId,
    heroId,
    equipment: createEmptyLoadout(),
    unlockedMoveIds: [...startingMoveIds],
    level: 1,
    chosenPathIds: [],
    evolutionStatGrants: {},
    evolutionPassiveGrants: [],
    bonusPassiveGrants: [],
    bonusStatGrants: {},
    masteryStatGrants: {},
    evolutionTypeGraft: null,
    classId: null,
  };
}

export class RosterFullError extends Error {}

/** Enforces only the cap; acquisition policy (contract vs. Guild Hall) is the caller's. */
export function addRosterEntry(run: RunState, entry: RosterEntry): RunState {
  if (run.roster.length >= ROSTER_CAP) {
    throw new RosterFullError(`Roster is at the ${ROSTER_CAP}-hero cap — terminate a hero before adding another`);
  }
  if (run.roster.some((r) => r.rosterId === entry.rosterId)) {
    throw new Error(`rosterId ${entry.rosterId} already exists on the roster`);
  }
  return { ...run, roster: [...run.roster, entry] };
}

/** Equipment lives on the entry, so dropping it IS "strips equipment". */
export function terminateRosterEntry(run: RunState, rosterId: string): RunState {
  return { ...run, roster: run.roster.filter((r) => r.rosterId !== rosterId) };
}

/**
 * Roster-full swap, preserving order and never transiently exceeding the cap.
 * Does NOT strip equipment — the caller (recruitment.ts) copies the outgoing
 * hero's gear onto `newEntry` first.
 */
export function replaceRosterEntry(run: RunState, terminatedRosterId: string, newEntry: RosterEntry): RunState {
  if (!run.roster.some((r) => r.rosterId === terminatedRosterId)) {
    throw new Error(`rosterId ${terminatedRosterId} not found on roster`);
  }
  if (newEntry.rosterId !== terminatedRosterId && run.roster.some((r) => r.rosterId === newEntry.rosterId)) {
    throw new Error(`rosterId ${newEntry.rosterId} already exists on the roster`);
  }
  return { ...run, roster: run.roster.map((r) => (r.rosterId === terminatedRosterId ? newEntry : r)) };
}

/**
 * Rewrites roster ORDER (which seeds squad select and pickSquad); membership is
 * untouched. Tolerant of a partial/stale list: unknown ids are dropped, omitted
 * ids keep their relative position at the back, duplicates ignored after the first.
 */
export function reorderRoster(run: RunState, orderedRosterIds: readonly string[]): RunState {
  const byId = new Map(run.roster.map((r) => [r.rosterId, r]));
  const seen = new Set<string>();
  const front: RosterEntry[] = [];
  for (const id of orderedRosterIds) {
    if (seen.has(id)) continue;
    const entry = byId.get(id);
    if (!entry) continue;
    seen.add(id);
    front.push(entry);
  }
  return { ...run, roster: [...front, ...run.roster.filter((r) => !seen.has(r.rosterId))] };
}
