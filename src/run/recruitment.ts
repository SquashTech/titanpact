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
//   chosenPathIds model (progression.ts) — nothing extra to enforce here.
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
// The run-loop trigger is a won fight: App.tsx's handleFightResolved samples
// the beaten AI roster (pickContractOffers below, filtered by isRecruitable)
// and opens RecruitScreen with it — but only when the run actually holds a
// contract to spend, since an offer that cannot be taken is a screen worth
// skipping (docs/run-loop.md "Winning a fight: the post-fight gates").

import type { RosterEntry, RunState } from './state';
import { createRosterEntry, addRosterEntry, replaceRosterEntry } from './state';
import { createEmptyLoadout } from './equipment';

export class RecruitmentError extends Error {}

/** Guarantees a rosterId that doesn't collide with an existing entry, even if the same heroId is claimed or recruited more than once across a run. */
export function freshRosterId(run: RunState, heroId: string): string {
  if (!run.roster.some((r) => r.rosterId === heroId)) return heroId;
  let n = 2;
  while (run.roster.some((r) => r.rosterId === `${heroId}-${n}`)) n++;
  return `${heroId}-${n}`;
}

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
 * carries over its heroId, unlocked moves, and Evolution state (level,
 * chosen paths, stat grants, type-graft) — the "partially locked" veteran
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
 * free: contracts are earned (1 at run start, 1 more at the end of every act,
 * or a cheaper Guild Hall purchase), not unlimited.
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

/**
 * What's arriving when the roster is already at ROSTER_CAP and needs a
 * termination to make room (view/run/RosterReplaceScreen.tsx): a fresh Guild
 * Hall recruit, or a Recruit Contract claim off a beaten enemy's build.
 */
export type RosterReplaceCandidate =
  | { source: 'guildHall'; offer: GuildHallOffer }
  | { source: 'contract'; offer: ContractOffer };

/**
 * Roster-full variant of recruitFromGuildHall: spends gold exactly the same
 * way, but replaces `terminatedRosterId`'s slot instead of appending a new
 * one. Per user direction, the incoming hero instantly inherits the outgoing
 * hero's equipment — unlike a plain termination (state.ts
 * terminateRosterEntry), which just strips it — so the gear isn't lost, only
 * handed to whoever takes the slot. Nothing else about the outgoing hero
 * carries over: the new hero is exactly the fresh, 0-progress RosterEntry
 * recruitFromGuildHall would have built, with only `equipment` overridden.
 */
export function recruitFromGuildHallReplacing(
  run: RunState,
  offer: GuildHallOffer,
  rosterId: string,
  terminatedRosterId: string
): RunState {
  if (run.gold < offer.cost) {
    throw new RecruitmentError(`Guild Hall recruit costs ${offer.cost} gold, only ${run.gold} available`);
  }
  const terminated = run.roster.find((r) => r.rosterId === terminatedRosterId);
  if (!terminated) {
    throw new RecruitmentError(`No roster entry ${terminatedRosterId} to terminate`);
  }
  const entry: RosterEntry = { ...createRosterEntry(rosterId, offer.heroId, offer.startingMoveIds), equipment: terminated.equipment };
  return replaceRosterEntry({ ...run, gold: run.gold - offer.cost }, terminatedRosterId, entry);
}

/** Roster-full variant of claimContract — same equipment-inheritance behavior as recruitFromGuildHallReplacing above, see its doc comment. */
export function claimContractReplacing(run: RunState, offer: ContractOffer, rosterId: string, terminatedRosterId: string): RunState {
  if (run.recruitContracts <= 0) {
    throw new RecruitmentError('No Recruit Contracts available');
  }
  const terminated = run.roster.find((r) => r.rosterId === terminatedRosterId);
  if (!terminated) {
    throw new RecruitmentError(`No roster entry ${terminatedRosterId} to terminate`);
  }
  const entry: RosterEntry = { ...offer, rosterId, equipment: terminated.equipment };
  return replaceRosterEntry({ ...run, recruitContracts: run.recruitContracts - 1 }, terminatedRosterId, entry);
}

/**
 * How many beaten heroes a win may offer on a Recruit Contract (user
 * direction, 2026-08-21) — a 4v4 elite/boss fight would otherwise dump every
 * recruitable enemy on the player at once.
 */
export const MAX_CONTRACT_OFFERS = 2;

/**
 * Random, order-independent sample of up to `max` claimable entries. Called
 * once per resolved fight (App.tsx handleFightResolved) and stored on the
 * screen, not recomputed per render, so the offer can't reshuffle out from
 * under a selection.
 */
export function pickContractOffers(entries: readonly RosterEntry[], max = MAX_CONTRACT_OFFERS): RosterEntry[] {
  if (entries.length <= max) return [...entries];
  const pool = [...entries];
  const picks: RosterEntry[] = [];
  while (picks.length < max && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks;
}
