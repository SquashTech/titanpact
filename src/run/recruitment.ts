// Recruitment mechanism (docs/progression.md "The raise-vs-recruit axis").
// Guild Hall: gold for a fresh entry. Recruit Contract: claim a beaten enemy's build, the gear
// it wore included (docs/gear-absorption.md §7). Costs and the offer pool are content
// (src/data/recruitment.ts).

import type { RosterEntry, RunState } from './state';
import { addRosterEntry, replaceRosterEntry } from './state';
import { guildHallEntry } from './guildRecruit';

export class RecruitmentError extends Error {}

/** A rosterId that doesn't collide even when the same heroId is acquired more than once. */
export function freshRosterId(run: RunState, heroId: string): string {
  if (!run.roster.some((r) => r.rosterId === heroId)) return heroId;
  let n = 2;
  while (run.roster.some((r) => r.rosterId === `${heroId}-${n}`)) n++;
  return `${heroId}-${n}`;
}

/** Membership in the caller's recruitable pool (not whatever pool the fight drew from) — Goblins never satisfy it. */
export function isRecruitable(heroId: string, recruitablePool: Record<string, unknown>): boolean {
  return heroId in recruitablePool;
}

/** A single hero's Constellation offer, and the ledger entry a Summoning leaves (docs/collection.md §4). */
export const heroOfferId = (heroId: string): string => `hero.${heroId}`;
export const summonedId = (heroId: string): string => `summon.${heroId}`;

/**
 * Whether an account holds a hero: the base roster always; one outside it (`HeroDefinition.unlock`)
 * by its bundle, its own offer, or a Summoning — all three entries in `Profile.purchases`.
 */
export function ownsHero(heroId: string, hero: { unlock?: string }, purchases: readonly string[]): boolean {
  return !hero.unlock || purchases.includes(hero.unlock) || purchases.includes(heroOfferId(heroId)) || purchases.includes(summonedId(heroId));
}

/**
 * Every hero an account owns — the Collection, which the deck is built from (run/deck.ts). Read
 * once where the pool is read, the way `locationPool` is (run/locations.ts); the sim and the
 * tests pass nothing and get the base game.
 */
export function heroPool<T extends { unlock?: string }>(all: Record<string, T>, purchases: readonly string[] = []): Record<string, T> {
  return Object.fromEntries(Object.entries(all).filter(([id, hero]) => ownsHero(id, hero, purchases)));
}

export interface GuildHallOffer {
  id: string;
  heroId: string;
  cost: number;
  startingMoveIds: readonly string[];
}

/** A defeated hero's build — gear included — minus the rosterId a new slot supplies itself. */
export type ContractOffer = Omit<RosterEntry, 'rosterId'>;

export function recruitFromGuildHall(run: RunState, offer: GuildHallOffer, rosterId: string): RunState {
  if (run.gold < offer.cost) {
    throw new RecruitmentError(`Guild Hall recruit costs ${offer.cost} gold, only ${run.gold} available`);
  }
  const withGoldSpent: RunState = { ...run, gold: run.gold - offer.cost };
  return addRosterEntry(withGoldSpent, guildHallEntry(run, offer, rosterId));
}

/**
 * Carries level, moves, paths, grants, type-graft AND gear — the finished veteran build, on every
 * axis (docs/gear-absorption.md §7: a contract arrives armed, a hire arrives bare) — but not the
 * rosterId.
 */
export function deriveContractOffer(defeated: RosterEntry): ContractOffer {
  const { rosterId: _rosterId, ...carried } = defeated;
  return carried;
}

export function claimContract(run: RunState, offer: ContractOffer, rosterId: string): RunState {
  if (run.recruitContracts <= 0) {
    throw new RecruitmentError('No Recruit Contracts available');
  }
  const entry: RosterEntry = { ...offer, rosterId };
  return addRosterEntry({ ...run, recruitContracts: run.recruitContracts - 1 }, entry);
}

export function buyContract(run: RunState, cost: number): RunState {
  if (run.gold < cost) {
    throw new RecruitmentError(`A Recruit Contract costs ${cost} gold, only ${run.gold} available`);
  }
  return { ...run, gold: run.gold - cost, recruitContracts: run.recruitContracts + 1 };
}

/** What's arriving when the roster is at ROSTER_CAP (RosterReplaceScreen). */
export type RosterReplaceCandidate =
  | { source: 'guildHall'; offer: GuildHallOffer }
  | { source: 'contract'; offer: ContractOffer };

/** Roster-full variant. The outgoing hero's gear goes with it — gear is absorbed, never handed on (docs/gear-absorption.md §7). */
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
  return replaceRosterEntry({ ...run, gold: run.gold - offer.cost }, terminatedRosterId, guildHallEntry(run, offer, rosterId));
}

/** Roster-full variant of claimContract: the incoming hero keeps its own gear, the outgoing hero's goes with it. */
export function claimContractReplacing(run: RunState, offer: ContractOffer, rosterId: string, terminatedRosterId: string): RunState {
  if (run.recruitContracts <= 0) {
    throw new RecruitmentError('No Recruit Contracts available');
  }
  const terminated = run.roster.find((r) => r.rosterId === terminatedRosterId);
  if (!terminated) {
    throw new RecruitmentError(`No roster entry ${terminatedRosterId} to terminate`);
  }
  const entry: RosterEntry = { ...offer, rosterId };
  return replaceRosterEntry({ ...run, recruitContracts: run.recruitContracts - 1 }, terminatedRosterId, entry);
}

/** Cap on contract offers per win — a 4v4 would otherwise dump every enemy on the player. */
export const MAX_CONTRACT_OFFERS = 2;

/** Called once per resolved fight and stored on the screen, never per render, so the offer can't reshuffle under a selection. */
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
