// Recruitment economy (docs/progression.md "The raise-vs-recruit axis").
// Two acquisition paths for growing the roster beyond its starting heroes:
//
// - Guild Hall (raise): spend gold to add a hero pulled from a data-driven
//   offer pool. Arrives "underleveled and fully customizable"
//   (progression.md) — a fresh RosterEntry via createRosterEntry, same as any
//   other roster addition.
// - Recruit Contract (recruit): claim a hero straight off a beaten enemy's
//   RosterEntry, for free. "Arrives with branches partially locked"
//   (CLAUDE.md) falls out for free from the existing one-shot
//   chosenBranchIds model (progression.ts) — nothing extra to enforce here.
//   Equipment is deliberately NOT carried over: gear is modeled as attached
//   to the roster slot, not the hero (equipment.ts), and neither CLAUDE.md
//   nor progression.md specifies what happens to a captured hero's gear —
//   treating them as arriving ungeared is the conservative reading, flagged
//   here as an assumption rather than a cited rule.
//
// Cost curve, the offer pool, and the decaying Guild Hall runway value
// (progression.md "raise-vs-recruit axis") are CONTENT — this module only
// implements the generic mechanism the data drives (architecture.md "Content
// vs. code"). src/data/recruitment.ts is fixture-status, same as the rest of
// /src/data (README "Known gaps") — flat costs, no runway decay modeled yet.
//
// NOT YET WIRED INTO A RUN LOOP: the natural trigger for a Recruit Contract
// offer is winning a fight against the hero being claimed. The
// escalating-fight run loop that would generate that trigger organically
// isn't built yet (README "Next steps" #4) — deriveContractOffer just takes
// a defeated enemy's RosterEntry directly, so a caller can wire it to
// whatever fight-outcome hook exists (currently: the single demo fight in
// src/app/App.tsx).

import type { RosterEntry, RunState } from './state';
import { createRosterEntry, addRosterEntry } from './state';
import { createEmptyLoadout } from './equipment';

export class RecruitmentError extends Error {}

/**
 * Whether a defeated combatant is eligible for a Recruit Contract — gated on
 * membership in the caller's recruitable-heroes pool (typically src/data/
 * heroes.ts), not whatever combined pool a fight actually drew its AI roster
 * from. Non-recruitable enemy-only content (docs/run-loop.md "Non-recruitable
 * enemy content" — Goblins, etc.) never satisfies this, so it can never
 * produce a contract offer. Kept content-agnostic like the rest of this
 * module: the caller supplies the recruitable pool rather than this importing
 * fixture data directly.
 */
export function isRecruitable(heroId: string, recruitablePool: Record<string, unknown>): boolean {
  return heroId in recruitablePool;
}

export interface GuildHallOffer {
  id: string;
  heroId: string;
  cost: number;
  startingMoveIds: readonly string[];
}

/** A defeated hero's build, stripped of the fields a new roster slot must supply itself. */
export type ContractOffer = Omit<RosterEntry, 'rosterId' | 'equipment'>;

/** Spends gold to add a fresh (0-progress, ungeared) RosterEntry from a Guild Hall offer. */
export function recruitFromGuildHall(run: RunState, offer: GuildHallOffer, rosterId: string): RunState {
  if (run.gold < offer.cost) {
    throw new RecruitmentError(`Guild Hall recruit costs ${offer.cost} gold, only ${run.gold} available`);
  }
  const withGoldSpent: RunState = { ...run, gold: run.gold - offer.cost };
  return addRosterEntry(withGoldSpent, createRosterEntry(rosterId, offer.heroId, offer.startingMoveIds));
}

/**
 * Derives a claimable contract offer from a defeated enemy's RosterEntry:
 * carries over its heroId, unlocked moves, and rank-up state (progress,
 * chosen branches, stat grants, type-graft) — the "partially locked" veteran
 * build — but not its equipment or its rosterId (the caller assigns a fresh
 * one for the player's roster).
 */
export function deriveContractOffer(defeated: RosterEntry): ContractOffer {
  const { rosterId: _rosterId, equipment: _equipment, ...carried } = defeated;
  return carried;
}

/**
 * Claims a derived contract offer onto the roster, ungeared (see module
 * header) — spends one Recruit Contract from the run's scarce
 * `recruitContracts` pool (docs/progression.md "raise-vs-recruit axis"). Not
 * free: contracts are earned (1 at run start, more via contractReward map
 * nodes or a cheaper Guild Hall purchase), not unlimited.
 */
export function claimContract(run: RunState, offer: ContractOffer, rosterId: string): RunState {
  if (run.recruitContracts <= 0) {
    throw new RecruitmentError('No Recruit Contracts available');
  }
  const entry: RosterEntry = { ...offer, rosterId, equipment: createEmptyLoadout() };
  return addRosterEntry({ ...run, recruitContracts: run.recruitContracts - 1 }, entry);
}

/** Guild Hall (raise-side venue) also sells Recruit Contracts directly — cheaper than recruiting a specific hero outright, per its "raise vs recruit" role as a discount on the recruit path. */
export function buyContract(run: RunState, cost: number): RunState {
  if (run.gold < cost) {
    throw new RecruitmentError(`A Recruit Contract costs ${cost} gold, only ${run.gold} available`);
  }
  return { ...run, gold: run.gold - cost, recruitContracts: run.recruitContracts + 1 };
}
