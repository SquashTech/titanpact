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

/** The ledger entry a Starfall leaves (docs/collection.md §4). Stored as `summon.`, the Starfall's first name. */
export const starfallLedgerId = (heroId: string): string => `summon.${heroId}`;
/** A single hero bought before singles were withdrawn (2026-09-26): still owned, refunded by the ledger. */
const legacySingleId = (heroId: string): string => `hero.${heroId}`;
/** A hero given free by a profile migration (run/profile.ts); costs nothing against the balance. */
export const grantLedgerId = (heroId: string): string => `grant.${heroId}`;

/**
 * Whether an account holds a hero: the base roster always; one outside it (`HeroDefinition.unlock`)
 * by its bundle or a Starfall — both entries in `Profile.purchases`.
 */
export function ownsHero(heroId: string, hero: { unlock?: string }, purchases: readonly string[]): boolean {
  return !hero.unlock || purchases.includes(hero.unlock) || purchases.includes(starfallLedgerId(heroId)) || purchases.includes(legacySingleId(heroId)) || purchases.includes(grantLedgerId(heroId));
}

/**
 * Every hero an account owns — the Collection, which the deck is built from (run/deck.ts). Read
 * once where the pool is read, the way `locationPool` is (run/locations.ts); the sim and the
 * tests pass nothing and get the base game.
 */
export function heroPool<T extends { unlock?: string }>(all: Record<string, T>, purchases: readonly string[] = []): Record<string, T> {
  return Object.fromEntries(Object.entries(all).filter(([id, hero]) => ownsHero(id, hero, purchases)));
}

/** A Tavern hire. Its price is always one Recruit Contract, as a claim's is (docs/run-loop.md "Contracts"). */
export interface GuildHallOffer {
  id: string;
  heroId: string;
  startingMoveIds: readonly string[];
}

/** A defeated hero's build — gear included — minus the rosterId a new slot supplies itself. */
export type ContractOffer = Omit<RosterEntry, 'rosterId'>;

function spendContract(run: RunState): RunState {
  if (run.recruitContracts <= 0) {
    throw new RecruitmentError('No Recruit Contracts available');
  }
  return { ...run, recruitContracts: run.recruitContracts - 1 };
}

export function recruitFromGuildHall(run: RunState, offer: GuildHallOffer, rosterId: string): RunState {
  return addRosterEntry(spendContract(run), guildHallEntry(run, offer, rosterId));
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
  return addRosterEntry(spendContract(run), { ...offer, rosterId });
}

/** The Tavern's first contract of the run, and what each one bought adds to the next. First-pass figures. */
export const CONTRACT_BASE_PRICE = 40;
export const CONTRACT_PRICE_STEP = 20;

/** Rises across the RUN, not the visit: buying your way to a full roster is possible and dearer each time. */
export function contractPrice(run: Pick<RunState, 'contractsBought'>): number {
  return CONTRACT_BASE_PRICE + CONTRACT_PRICE_STEP * run.contractsBought;
}

export function buyContract(run: RunState): RunState {
  const cost = contractPrice(run);
  if (run.gold < cost) {
    throw new RecruitmentError(`A Recruit Contract costs ${cost} gold, only ${run.gold} available`);
  }
  return { ...run, gold: run.gold - cost, recruitContracts: run.recruitContracts + 1, contractsBought: run.contractsBought + 1 };
}

/** The map's Contract node (`contractReward`). */
export function grantContract(run: RunState, amount = 1): RunState {
  return { ...run, recruitContracts: run.recruitContracts + amount };
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
  const spent = spendContract(run);
  if (!run.roster.some((r) => r.rosterId === terminatedRosterId)) {
    throw new RecruitmentError(`No roster entry ${terminatedRosterId} to terminate`);
  }
  return replaceRosterEntry(spent, terminatedRosterId, guildHallEntry(run, offer, rosterId));
}

/** Roster-full variant of claimContract: the incoming hero keeps its own gear, the outgoing hero's goes with it. */
export function claimContractReplacing(run: RunState, offer: ContractOffer, rosterId: string, terminatedRosterId: string): RunState {
  const spent = spendContract(run);
  if (!run.roster.some((r) => r.rosterId === terminatedRosterId)) {
    throw new RecruitmentError(`No roster entry ${terminatedRosterId} to terminate`);
  }
  return replaceRosterEntry(spent, terminatedRosterId, { ...offer, rosterId });
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
