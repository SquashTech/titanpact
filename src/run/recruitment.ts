// Recruitment mechanism (docs/progression.md "The raise-vs-recruit axis").
// Guild Hall: gold for a fresh entry. Recruit Contract: claim a beaten enemy's
// build, ungeared (an assumption — neither doc specifies captured gear).
// Costs and the offer pool are content (src/data/recruitment.ts).

import type { RosterEntry, RunState } from './state';
import { addRosterEntry, replaceRosterEntry } from './state';
import { createEmptyLoadout } from './equipment';
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

export interface GuildHallOffer {
  id: string;
  heroId: string;
  cost: number;
  startingMoveIds: readonly string[];
}

/** A defeated hero's build, minus what a new roster slot supplies itself. */
export type ContractOffer = Omit<RosterEntry, 'rosterId' | 'equipment'>;

export function recruitFromGuildHall(run: RunState, offer: GuildHallOffer, rosterId: string): RunState {
  if (run.gold < offer.cost) {
    throw new RecruitmentError(`Guild Hall recruit costs ${offer.cost} gold, only ${run.gold} available`);
  }
  const withGoldSpent: RunState = { ...run, gold: run.gold - offer.cost };
  return addRosterEntry(withGoldSpent, guildHallEntry(run, offer, rosterId));
}

/** Carries level, moves, paths, grants and type-graft — the "partially locked" veteran build — but not equipment or rosterId. */
export function deriveContractOffer(defeated: RosterEntry): ContractOffer {
  const { rosterId: _rosterId, equipment: _equipment, ...carried } = defeated;
  return carried;
}

export function claimContract(run: RunState, offer: ContractOffer, rosterId: string): RunState {
  if (run.recruitContracts <= 0) {
    throw new RecruitmentError('No Recruit Contracts available');
  }
  const entry: RosterEntry = { ...offer, rosterId, equipment: createEmptyLoadout() };
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

/** Roster-full variant: the incoming hero inherits the outgoing hero's equipment (unlike plain termination, which strips it). */
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
  const entry: RosterEntry = { ...guildHallEntry(run, offer, rosterId), equipment: terminated.equipment };
  return replaceRosterEntry({ ...run, gold: run.gold - offer.cost }, terminatedRosterId, entry);
}

/** Roster-full variant of claimContract — same equipment inheritance as recruitFromGuildHallReplacing. */
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
