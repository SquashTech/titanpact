// Run state (docs/architecture.md "State shapes (three tiers)": the RUN
// tier). Roster (<=6), equipment loadouts, and the pooled level-up currency
// that persist across a run's fights. Combat state (one fight) is built FROM
// a RunState via buildCombatState.ts and does not write back to it — the two
// tiers have different lifetimes (CLAUDE.md, docs/architecture.md). Meta
// state (what survives a run — unlocks only, per the LOCKED "light
// meta-progression" decision, docs/progression.md) is out of scope here;
// this module models the run tier, which fully resets between runs.

import type { PassiveId, StatKey, TypeId } from '../engine/content';
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
   * Passives (engine/content.ts PassiveDefinition) granted by chosen Evolution
   * paths (progression.ts EvolutionPath.grantsPassiveIds), accumulated the
   * same way evolutionStatGrants is. Permanent within a run, same as any
   * other Evolution grant.
   */
  evolutionPassiveGrants: readonly PassiveId[];
  /**
   * Passives (engine/content.ts PassiveDefinition) granted by a map EVENT
   * (src/data/events.ts `grantPassive` — Assertiveness Training teaching
   * Imposing Presence). The passive-grant sibling of `bonusStatGrants` below,
   * and kept off `evolutionPassiveGrants` for exactly the same reason that
   * field is kept off the equipment loadout: it comes from neither an equipped
   * item nor a chosen Evolution path, and folding the three together would
   * make "where did this passive come from" unanswerable on a hero sheet.
   *
   * Duplicates are allowed and STACK (src/run/entryStats.ts counts them, and
   * engine/state.ts PassiveInstance resolves N stacks N times), so a hero
   * taught the same passive twice gets it twice — consistent with how
   * duplicate relics and duplicate item grants already behave.
   */
  bonusPassiveGrants: readonly PassiveId[];
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
   * Permanent stat grants from MASTERY level-ups — every Training Point spent
   * on a hero already past MASTERY_LEVEL (progression.ts), each one a flat
   * +MASTERY_STAT_AMOUNT to a randomly drawn combat stat. The one documented
   * exemption to CLAUDE.md's "level-ups never directly raise stats", added by
   * designer call on 2026-08-31 so a maxed hero is still worth investing in;
   * see progression.ts grantMasteryStat for the reasoning and the guardrails.
   *
   * A fourth independent stat-grant source rather than a fold into
   * `bonusStatGrants`, for the reason that field's own comment gives: three
   * sources with different lifetimes and different provenance already share
   * one merge (entryStats.ts entryStatModifiers), and collapsing them makes
   * "where did this Speed come from" unanswerable on a hero sheet. This one
   * is also the only source the player can aim at deliberately, so it is the
   * one most worth showing separately.
   */
  masteryStatGrants: Partial<Record<StatKey, number>>;
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
  /**
   * The hero's chosen Class this run, if any (CLAUDE.md-adjacent "Class
   * system": a Class is a Passive — engine/content.ts PassiveDefinition,
   * src/data/classes.ts — granting a flat, thematic two-stat buff). A single
   * nullable id rather than a list: "a hero can only get one Class per run"
   * holds structurally because there is only one slot to write into —
   * src/run/classes.ts grantClass REPLACES this rather than appending.
   * Permanent within a run once granted, same as an Evolution choice; carried
   * into combat state as a Passive grant + statGrants contribution by
   * buildCombatState.ts, same seam evolutionPassiveGrants already crosses.
   */
  classId: PassiveId | null;
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
  /**
   * Which Location each act happens in (docs/locations.md), ordered — index
   * 0 is Act 1, which is always Wild's Edge. Drawn once at run start by
   * src/run/locations.ts `generateItinerary` (without replacement, so a
   * location is never visited twice in one run) and never mutated after.
   *
   * Empty on a RunState that never plays a run of its own — the throwaway AI
   * rosters enemyGen.ts builds per fight, same as `map` being null there.
   * `locationForAct` falls back rather than throwing on an empty list, so
   * nothing downstream has to special-case those.
   */
  locationIds: readonly string[];
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

/**
 * Roster-full acquisition (CLAUDE.md "Gaining a hero requires terminating an
 * existing one" once at ROSTER_CAP, view/run/RosterReplaceScreen.tsx):
 * swaps `terminatedRosterId`'s slot for `newEntry` in one step, preserving
 * roster order and never transiently exceeding ROSTER_CAP the way
 * terminate-then-addRosterEntry would. Unlike plain termination, this does
 * NOT strip equipment on its own — the caller (src/run/recruitment.ts
 * recruitFromGuildHallReplacing/claimContractReplacing) is expected to have
 * already copied the outgoing hero's `equipment` onto `newEntry` per the
 * "new hero instantly inherits the terminated hero's gear" rule, since this
 * function only knows about roster membership, not that policy.
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
