// Run state (docs/architecture.md "State shapes (three tiers)": the RUN
// tier). Roster (<=6), equipment loadouts, and the pooled level-up currency
// that persist across a run's fights. Combat state (one fight) is built FROM
// a RunState via buildCombatState.ts and does not write back to it — the two
// tiers have different lifetimes (CLAUDE.md, docs/architecture.md). Meta
// state (what survives a run — unlocks only, per the LOCKED "light
// meta-progression" decision, docs/progression.md) is out of scope here;
// this module models the run tier, which fully resets between runs.

import type { StatKey, TypeId } from '../engine/content';
import type { EquipmentLoadout } from './equipment';
import { createEmptyLoadout } from './equipment';
import type { RunMap } from './map';

/** CLAUDE.md "Roster hard cap = 6, doubling as the bring-6-pick-4 battle sideboard." */
export const ROSTER_CAP = 6;

/** How many acts (docs/run-loop.md "Multi-act sequencing") a run chains before "Run Complete" — per user direction (2026-08-17), 5. */
export const TOTAL_ACTS = 5;

export interface RosterEntry {
  rosterId: string;
  heroId: string;
  equipment: EquipmentLoadout;
  /** Starts as a copy of HeroDefinition.moveIds; grows via progression.ts levelUpHero/grantLevelUpMove. */
  unlockedMoveIds: string[];
  /**
   * Hero level (docs/leveling-and-ranks.md): incremented by one for every
   * Training Point spent on this hero (progression.ts levelUpHero). Starts at
   * 1 — not an XP bar, a plain count of how many times this hero has been
   * leveled this run. Also the sole gate on Evolution availability
   * (progression.ts EVOLUTION_LEVEL) — there is no separate progress counter.
   */
  level: number;
  /** Evolution path ids chosen so far, in order. Empty = not yet evolved. */
  chosenPathIds: string[];
  /**
   * Permanent stat grants accumulated from chosen Evolution paths
   * (docs/progression.md "Stat grants" — always multiples of 5/10). Kept
   * separate from equipment because Evolutions are "permanent within a run"
   * (CLAUDE.md) while equipment strips on termination.
   */
  evolutionStatGrants: Partial<Record<StatKey, number>>;
  /**
   * Permanent stat grants from map-node rewards (`hpBoostReward`/
   * `manaBoostReward` — runProgress.ts `grantStatBonus`), always multiples of
   * 5/10. Kept on its own field rather than folded into `evolutionStatGrants`
   * since it comes from neither an equipped item nor a chosen Evolution path
   * — a third, independent source of flat stat grants (buildCombatState.ts
   * merges all three at combat-build time).
   */
  bonusStatGrants: Partial<Record<StatKey, number>>;
  /**
   * The hero's current secondary-type-slot grant, if any, from the most
   * recently chosen type-graft Evolution path (docs/progression.md
   * "Type-graft paths"). null until first grafted; a later graft path SHIFTS
   * this (overwrites it) rather than stacking a third type — there is only
   * ever one secondary slot. The hero's authored innate primary type never
   * changes — this is the run-tier record of the current grant, carried into
   * combat state as Combatant.grantedTypes by buildCombatState.ts.
   */
  evolutionTypeGraft: TypeId | null;
}

export interface RunState {
  roster: RosterEntry[];
  /** Pooled, freely distributable across the roster (docs/progression.md), not a per-hero locked track. */
  levelUpPool: number;
  /**
   * Spent at a Guild Hall to recruit (docs/progression.md "The
   * raise-vs-recruit axis" — recruitment.ts). Recruit Contracts are claimed,
   * not bought, so they don't touch this field.
   */
  gold: number;
  /** Owned relic ids (docs/run-loop.md, src/run/relics.ts) — team-wide, stat-only for this pass. */
  relics: string[];
  /**
   * Recruit Contracts available to spend claiming a beaten enemy
   * (docs/progression.md "raise-vs-recruit axis" — recruitment.ts
   * claimContract). A scarce earn-and-spend currency, not unlimited: a run
   * starts with 1, one more is granted automatically at the end of every act
   * (App.tsx handleFightResolved, on the boss node — 2026-08-17 revision,
   * replacing the old contractReward map node), and more can be bought
   * (cheaper than a direct Guild Hall recruit) at a shop node.
   */
  recruitContracts: number;
  /**
   * The player's run map (docs/run-loop.md). Null for a RunState that never
   * gets a map of its own — e.g. the throwaway AI rosters enemyGen.ts builds
   * per fight, which only ever need `roster`. A run chains TOTAL_ACTS of
   * these, one at a time — runProgress.ts's advanceToNextAct replaces this
   * with a freshly generated map (and resets currentNodeId/visitedNodeIds)
   * once the current one's boss falls.
   */
  map: RunMap | null;
  /** The node currently occupied; null = map generated but not yet entered (still choosing among map.startNodeIds). */
  currentNodeId: string | null;
  /** Resolved node ids, in visit order — drives MapScreen's greyed-out/reachable rendering. Scoped to the CURRENT act's map only; advanceToNextAct clears it. */
  visitedNodeIds: string[];
  /**
   * Count of `fight`-type nodes entered so far this run (App.tsx, incremented
   * at node-select time alongside encounter generation). Drives the run's 2nd
   * fight being a smaller 2v2 breather (enemyGen.ts heroCountOverride) —
   * `elite`/`boss` nodes have their own fixed sizing and don't touch this.
   * Counts across the whole run, not reset per act — the breather is a
   * one-time onboarding beat, not a per-act one.
   */
  fightsStarted: number;
  /** 1-indexed current act (docs/run-loop.md "Multi-act sequencing"); increments on every boss-node win until TOTAL_ACTS, at which point beating the boss ends the run instead. */
  actNumber: number;
}

export function createRunState(levelUpPool = 0, gold = 0, recruitContracts = 1): RunState {
  return {
    roster: [],
    levelUpPool,
    gold,
    relics: [],
    recruitContracts,
    map: null,
    currentNodeId: null,
    visitedNodeIds: [],
    fightsStarted: 0,
    actNumber: 1,
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
    bonusStatGrants: {},
    evolutionTypeGraft: null,
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
