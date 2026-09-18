// Run-tier state (docs/architecture.md "State shapes (three tiers)"). Combat
// state is built FROM this (buildCombatState.ts) and never writes back.

import type { PassiveId, StatKey, StatusId, TypeId } from '../engine/content';
import type { EquipmentLoadout } from './equipment';
import { createEmptyLoadout } from './equipment';
import type { RunMap } from './map';
import { STARTING_CONSUMABLES, type ConsumablePurse } from './consumables';
import { xpForLevel } from './growth';

export const ROSTER_CAP = 6;

/** 5 acts of the run-loop.md §1 shape, then the finale act. */
export const TOTAL_ACTS = 6;

/** Acts that break a seal — the ones with a Guardian, a location draw and a §1 map. */
export const SEAL_ACTS = 5;

/** Act 6: the Vigil and the final battle (docs/run-loop.md §4). */
export const FINALE_ACT = TOTAL_ACTS;

export interface RosterEntry {
  rosterId: string;
  heroId: string;
  equipment: EquipmentLoadout;
  /** Starts as a copy of HeroDefinition.moveIds; grows via progression.ts. */
  unlockedMoveIds: string[];
  /**
   * Every move already offered to this hero — taught, declined, or taught and later swapped
   * away. levelUpMovePool filters these out: an offer is spent by being made, not by being taken.
   */
  offeredMoveIds: readonly string[];
  /**
   * Cumulative XP on the run's one curve (growth.ts xpForLevel). Level is DERIVED from it
   * (growth.ts levelOf), never stored beside it: two figures for one fact drift.
   */
  xp: number;
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
  /**
   * Magnitude-shape statuses the hero itself carries into every fight — the Ley Line's Elemental
   * Force (runProgress.ts grantLeyLine), summed with its gear's at build (statusGrants.ts). Kept
   * apart from the gear so the sheet can say which is which.
   */
  bonusStatusGrants: Record<StatusId, number>;
  /** Everything this hero's levels have rolled up (run/growth.ts). Automatic; never a decision. */
  growthStatGrants: Partial<Record<StatKey, number>>;
  /**
   * How many of this hero's schedule entries it has taken, in order (progression.ts
   * scheduleEntries). What is owed is DERIVED — the next entry, once the level has reached it.
   * A contract hero arrives with everything below its level taken; a Guild hire with none.
   */
  scheduleTaken: number;
  /**
   * Pips toward the Evolution (at MASTERY_EVOLUTION) and the signature (at MASTERY_CAP),
   * run/mastery.ts. Bought one Scroll each on the map, never in a fight; an enemy, a contract
   * hero and a hire read theirs off the act (masteryForAct).
   */
  mastery: number;
  /** Current secondary-type grant from the latest type-graft path; a later graft overwrites. Innate primary never changes. */
  evolutionTypeGraft: TypeId | null;
  /** One Class per run holds structurally — a single slot, and classes.ts grantClass replaces. */
  classId: string | null;
  /** The Class's passive, when it grants one — recorded so entryStats.ts can count it without the Class catalog. Written only by grantClass. */
  classPassiveId: PassiveId | null;
  /**
   * The companion (run/companion.ts, docs/titanspawn-overhaul.md §5): a hero in every respect
   * but one — a knockout removes it from the run. The ONLY rule the flag carries; everything
   * else it does, it does by being on the roster.
   */
  mortal: boolean;
  /**
   * HP missing going into the next node (run/wounds.ts): a fight writes it, the act's end clears
   * it, and buildCombatState places the hero that far down.
   */
  wounds: number;
  /**
   * Knocked out and still down (run/wounds.ts, 2026-09-17): a fight that KO'd the hero wrote it,
   * and until a Rest, the Guild Hall's mend, a Revive or the act's end clears it the hero is not
   * fielded. Its own flag rather than `wounds >= max`, so a max that rises mid-act (a growth
   * roll) cannot quietly stand a downed hero back up.
   */
  down: boolean;
}

/**
 * One Guardian's fall, recorded so the finale can field it again at the power it was
 * beaten at (docs/lore.md §6). Level and the act-scaling roll are the ONLY things that
 * ever differ from the authored champion (`enemyGen.ts appendFinalEnemy` sets exactly
 * those two), so snapshotting them is snapshotting the fight.
 */
export interface BrokenSeal {
  /** 1-indexed, and also the order the seals return in — Act 1's first, Act 5's last. */
  actNumber: number;
  locationId: string;
  /** The sealed (Ancient-second) id. The finale fields `unsealedIdFor` it. */
  championId: string;
  level: number;
  /** The champion's flat grants (the tutorial's, if any) and what its level rolled — the power it was beaten at. */
  statGrants: Partial<Record<StatKey, number>>;
  growthStatGrants: Partial<Record<StatKey, number>>;
}

export interface RunState {
  roster: RosterEntry[];
  /** Spent at a Guild Hall; contracts are claimed, not bought with this. */
  gold: number;
  /** Owned relic ids — duplicates stack. */
  relics: string[];
  /** Starts at 1; +1 at the end of every act; purchasable at a shop. */
  recruitContracts: number;
  /** The potions, a TEAM purse capped per kind (run/consumables.ts). Spent only in a fight. */
  consumables: ConsumablePurse;
  /**
   * The companion this run took, by the body it joined as (run/companion.ts) — kept after its
   * death, since one per run is the rule and a replacement is not (docs/titanspawn-overhaul.md
   * §10). Null until the join beat.
   */
  companionHeroId: string | null;
  /** Null for a RunState that never gets a map (enemyGen.ts throwaway rosters). */
  map: RunMap | null;
  /** Null = map generated but not yet entered. */
  currentNodeId: string | null;
  /** Current act only; advanceToNextAct clears it. */
  visitedNodeIds: string[];
  /** `fight` nodes entered this run (whole run, not per act) — drives the one-time 2v2 breather. */
  fightsStarted: number;
  /**
   * Encounters won this run, every node kind included. Display only (the run summary) — kept
   * apart from `fightsStarted`, which is a gameplay flag that deliberately counts less.
   */
  encountersWon: number;
  /** 1-indexed. */
  actNumber: number;
  /** One location id per act, index 0 = Act 1. Empty on throwaway RunStates; locationForAct falls back. */
  locationIds: readonly string[];
  /** Appended on each Guardian win, in act order — the Pact Seal's filled sockets and the finale's enemy side. */
  brokenSeals: readonly BrokenSeal[];
  /**
   * The scripted first run (docs/tutorial.md). Pins the drafted pair, Act 1's map and Act 1's
   * encounters and payouts; acts 2-6 are an ordinary run, so everything keyed on it also checks
   * the act (`isTutorialAct`).
   */
  tutorial: boolean;
  /** Tutorial beats already played, so neither a re-render nor a reload repeats one. */
  tutorialSeenBeatIds: readonly string[];
}

export function createRunState(gold = 0, recruitContracts = 1): RunState {
  return {
    roster: [],
    gold,
    relics: [],
    recruitContracts,
    consumables: { ...STARTING_CONSUMABLES },
    companionHeroId: null,
    map: null,
    currentNodeId: null,
    visitedNodeIds: [],
    fightsStarted: 0,
    encountersWon: 0,
    actNumber: 1,
    locationIds: [],
    brokenSeals: [],
    tutorial: false,
    tutorialSeenBeatIds: [],
  };
}

export function createRosterEntry(rosterId: string, heroId: string, startingMoveIds: readonly string[]): RosterEntry {
  return {
    rosterId,
    heroId,
    equipment: createEmptyLoadout(),
    unlockedMoveIds: [...startingMoveIds],
    offeredMoveIds: [],
    xp: xpForLevel(1),
    chosenPathIds: [],
    evolutionStatGrants: {},
    evolutionPassiveGrants: [],
    bonusPassiveGrants: [],
    bonusStatGrants: {},
    bonusStatusGrants: {},
    growthStatGrants: {},
    scheduleTaken: 0,
    mastery: 0,
    evolutionTypeGraft: null,
    classId: null,
    classPassiveId: null,
    mortal: false,
    wounds: 0,
    down: false,
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
