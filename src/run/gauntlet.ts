// The Gauntlet (docs/gauntlet.md): six offers of three rolled heroes, one taken from each, five
// wins before two losses. Pure — the offers, the kit roll, the opponent, the record and its pay. A Gauntlet hero is
// the Trials' TeamSlot, so constructedSide fields it and the engine never learns a third mode.

import type { HeroDefinition, MoveCategory, TypeId } from '../engine/content';
import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import { resolveTypeMult, type TypeChart } from '../engine/damage/typeMult';
import { constructedMovePool, constructedPath, slotManaPool, slotTypes, TEAM_SIZE, type ConstructedContent, type TeamSlot } from './constructed';
import type { Profile } from './profile';
import { MOVE_CAP, signatureIdFor } from './progression';

/** Heroes an offer shows; one is taken. */
export const OFFER_SIZE = 3;
/** Heroes of one primary type a team may hold — an offer never shows a type the team is full of. */
export const TEAM_TYPE_LIMIT = 2;
/** A path the account has not starred, against a starred one's 1. */
export const UNSTARRED_WEIGHT = 3;
export const WINS_TO_CLEAR = 5;
export const LOSSES_TO_END = 2;
/** Each win, the next opponent's six are picked from this many more rolled heroes. */
export const ESCALATION_STEP = 3;
/** From this many wins the opponent is flown by the Trials' pilot (run/pilot.ts); below it, by Classic's AI (run/ai.ts). */
export const PILOT_FROM_WINS = 3;
export const GAUNTLET_CLEAR_BONUS = 5;
export const GAUNTLET_ENTRY_PRICE = 3;

const TIER_WEIGHT = { early: 1, mid: 2, late: 3 } as const;
/** A damage move swinging off the stat the hero does not lead with. */
const OFF_STAT_WEIGHT = 0.25;
const MIN_DAMAGE_MOVES = 2;

export interface GauntletContent extends ConstructedContent {
  typeChart: TypeChart;
}

export interface GauntletRun {
  /** Fixes every offer and every opponent, so a preview is the fight and a reload changes nothing. */
  seed: number;
  /** The three on offer; empty once the team is full. */
  offer: TeamSlot[];
  /** Every hero offered so far, taken or not — none is offered twice. */
  seen: string[];
  /** The heroes taken, one an offer, in order; the fights open at TEAM_SIZE. */
  team: TeamSlot[];
  wins: number;
  losses: number;
  /** Set as a fight starts and cleared as it resolves; found set on return, the fight was left — a loss. */
  fighting: boolean;
}

export interface GauntletResult {
  wins: number;
  losses: number;
  cleared: boolean;
  /** Path ids starred for the first time by this clear. */
  starsEarned: string[];
  bonus: number;
}

export class GauntletError extends Error {}

// --- Gate and entry ---

/** Opens on the first Cycle I clear, as the Trials do. */
export function isGauntletOpen(profile: Pick<Profile, 'cyclesCleared'>): boolean {
  return profile.cyclesCleared > 0;
}

/** The local calendar day, the free entry's clock. */
export function localDay(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function freeEntryAvailable(profile: Pick<Profile, 'gauntletFreeDay'>, today: string): boolean {
  return profile.gauntletFreeDay !== today;
}

export function canEnterGauntlet(profile: Profile, balance: number, today: string): boolean {
  return isGauntletOpen(profile) && !profile.gauntlet && (freeEntryAvailable(profile, today) || balance >= GAUNTLET_ENTRY_PRICE);
}

/** Spends today's free entry if it is there, else GAUNTLET_ENTRY_PRICE stars, and rolls the first offer. */
export function enterGauntlet(profile: Profile, content: GauntletContent, ownedHeroIds: readonly string[], seed: number, today: string, balance: number): Profile {
  if (!isGauntletOpen(profile)) throw new GauntletError('the Gauntlet opens on the first Cycle I clear');
  if (profile.gauntlet) throw new GauntletError('a Gauntlet is already open');
  const free = freeEntryAvailable(profile, today);
  if (!free && balance < GAUNTLET_ENTRY_PRICE) throw new GauntletError(`an entry costs ${GAUNTLET_ENTRY_PRICE}, balance is ${balance}`);
  const draft = { seed: seed >>> 0, team: [], seen: [] };
  const run: GauntletRun = { ...draft, offer: rollOffer(content, ownedHeroIds, profile.evolutionStars, draft), wins: 0, losses: 0, fighting: false };
  return {
    ...profile,
    gauntlet: run,
    gauntletFreeDay: free ? today : profile.gauntletFreeDay,
    gauntletEntriesBought: profile.gauntletEntriesBought + (free ? 0 : 1),
    gauntletEntered: profile.gauntletEntered + 1,
  };
}

// --- Rolling ---

function pick<T>(state: RngState, items: readonly T[], weight: (item: T) => number): { item: T | null; state: RngState } {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  const { value, nextState } = nextFloat(state);
  if (total <= 0) return { item: null, state: nextState };
  let roll = value * total;
  for (const item of items) {
    roll -= weight(item);
    if (roll < 0) return { item, state: nextState };
  }
  return { item: items[items.length - 1], state: nextState };
}

function pathsOf(content: ConstructedContent, heroId: string): string[] {
  return (content.table.evolutions[heroId] ?? []).flatMap((node) => node.paths).map((p) => p.id);
}

/** Attack or Intelligence, whichever the hero leads with in this form; null for an even split. */
function leadCategory(hero: HeroDefinition, swapped: boolean): MoveCategory | null {
  const { attack, intelligence } = hero.baseStats;
  if (attack === intelligence) return null;
  return (attack > intelligence) !== swapped ? 'physical' : 'magical';
}

/**
 * One hero in one form: the signature and the path's move held, the rest rolled for fit (§3). No
 * items. Nothing over the form's Mana pool is ever dealt — a move it could never cast.
 */
export function rollGauntletSlot(content: GauntletContent, heroId: string, pathId: string, state: RngState): { slot: TeamSlot; state: RngState } {
  const hero = content.heroes[heroId];
  const path = constructedPath(content.table, heroId, pathId);
  const mana = slotManaPool(content, { heroId, pathId, moveIds: [], itemIds: [] });
  const pool = constructedMovePool(content, { heroId, pathId }).filter((id) => content.moves[id] && content.moves[id].manaCost <= mana);
  const signature = signatureIdFor(hero, { offenseSwapped: !!path?.swapsOffense });
  const held = [...new Set([signature, ...(path?.unlocksMoveIds ?? [])])].filter((id): id is string => !!id && pool.includes(id)).slice(0, MOVE_CAP);

  const lead = leadCategory(hero, !!path?.swapsOffense);
  const isDamage = (id: string) => content.moves[id].kind === 'damage';
  const weight = (id: string) => {
    const move = content.moves[id];
    const fit = isDamage(id) && lead && move.category !== lead ? OFF_STAT_WEIGHT : 1;
    return TIER_WEIGHT[move.tier ?? 'early'] * fit;
  };

  let rest = pool.filter((id) => !held.includes(id));
  while (held.length < MOVE_CAP && rest.length > 0) {
    const short = held.filter(isDamage).length < MIN_DAMAGE_MOVES && MOVE_CAP - held.length <= MIN_DAMAGE_MOVES - held.filter(isDamage).length;
    const candidates = short && rest.some(isDamage) ? rest.filter(isDamage) : rest;
    const roll = pick(state, candidates, weight);
    state = roll.state;
    if (!roll.item) break;
    held.push(roll.item);
    rest = rest.filter((id) => id !== roll.item);
  }
  return { slot: { heroId, pathId, moveIds: held, itemIds: [] }, state };
}

/**
 * The next three: owned heroes not yet offered, one form each, three primary types, none the team
 * already holds TEAM_TYPE_LIMIT of, unstarred paths weighted up (§2). Fixed by the seed and the pick
 * number. Where the owned heroes run short, the type rules give way before the offer does.
 */
export function rollOffer(
  content: GauntletContent,
  ownedHeroIds: readonly string[],
  stars: Record<string, readonly string[]>,
  run: Pick<GauntletRun, 'seed' | 'team' | 'seen'>
): TeamSlot[] {
  let state = createRng((run.seed ^ Math.imul(run.team.length + 1, 0xc2b2ae35)) >>> 0);
  type Pair = { heroId: string; pathId: string; type: TypeId };
  const typeOf = (heroId: string) => content.heroes[heroId].types[0];
  const taken = new Set([...run.seen, ...run.team.map((s) => s.heroId)]);
  let pairs: Pair[] = ownedHeroIds
    .filter((id) => content.heroes[id] && !taken.has(id))
    .flatMap((heroId) => pathsOf(content, heroId).map((pathId) => ({ heroId, pathId, type: typeOf(heroId) })));
  const full = new Set(run.team.map((s) => typeOf(s.heroId)).filter((t, _, all) => all.filter((u) => u === t).length >= TEAM_TYPE_LIMIT));
  const offer: TeamSlot[] = [];
  while (offer.length < OFFER_SIZE && pairs.length > 0) {
    const shown = new Set(offer.map((s) => typeOf(s.heroId)));
    const fresh = pairs.filter((p) => !full.has(p.type) && !shown.has(p.type));
    const open = fresh.length > 0 ? fresh : pairs.filter((p) => !full.has(p.type)).length > 0 ? pairs.filter((p) => !full.has(p.type)) : pairs;
    const roll = pick(state, open, (p) => (stars[p.heroId]?.includes(p.pathId) ? 1 : UNSTARRED_WEIGHT));
    state = roll.state;
    if (!roll.item) break;
    const { heroId, pathId } = roll.item;
    pairs = pairs.filter((p) => p.heroId !== heroId);
    const rolled = rollGauntletSlot(content, heroId, pathId, state);
    state = rolled.state;
    offer.push(rolled.slot);
  }
  return offer;
}

// --- The draft ---

/** One of the three onto the team; the next offer rolls until the team is TEAM_SIZE. */
export function draftPick(
  content: GauntletContent,
  ownedHeroIds: readonly string[],
  stars: Record<string, readonly string[]>,
  run: GauntletRun,
  offerIndex: number
): GauntletRun {
  if (run.team.length >= TEAM_SIZE) throw new GauntletError('the team is already drafted');
  const slot = run.offer[offerIndex];
  if (!slot) throw new GauntletError('a pick is off the offer');
  const next = { ...run, team: [...run.team, slot], seen: [...run.seen, ...run.offer.map((s) => s.heroId)] };
  return { ...next, offer: next.team.length < TEAM_SIZE ? rollOffer(content, ownedHeroIds, stars, next) : [] };
}

// --- The opponent ---

/** How well one typing answers another, in doublings: its best STAB type in, less the other's best back. */
function typingEdge(chart: TypeChart, mine: readonly TypeId[], theirs: readonly TypeId[]): number {
  const offense = Math.max(...mine.map((t) => resolveTypeMult(chart, t, theirs)));
  const defense = Math.max(...theirs.map((t) => resolveTypeMult(chart, t, mine)));
  return Math.log2(offense) - Math.log2(defense);
}

/**
 * The next fight's six, off the run's seed and the fight's number: `TEAM_SIZE + ESCALATION_STEP ×
 * wins` heroes rolled from the whole catalog, the six whose typing best answers the player's team
 * kept, the best two leading (§4).
 */
export function gauntletOpponent(content: GauntletContent, run: GauntletRun): { team: TeamSlot[]; leads: [string, string] } {
  const fight = run.wins + run.losses;
  let state = createRng((run.seed ^ Math.imul(fight + 1, 0x9e3779b1)) >>> 0);
  let heroIds = Object.keys(content.heroes).filter((id) => pathsOf(content, id).length > 0);
  const want = Math.min(heroIds.length, TEAM_SIZE + ESCALATION_STEP * run.wins);

  const candidates: TeamSlot[] = [];
  while (candidates.length < want) {
    const hero = pick(state, heroIds, () => 1);
    state = hero.state;
    if (!hero.item) break;
    heroIds = heroIds.filter((id) => id !== hero.item);
    const path = pick(state, pathsOf(content, hero.item), () => 1);
    state = path.state;
    const rolled = rollGauntletSlot(content, hero.item, path.item!, state);
    state = rolled.state;
    candidates.push(rolled.slot);
  }

  const theirTypes = run.team.map((slot) => slotTypes(content, slot));
  const score = (slot: TeamSlot) => {
    const mine = slotTypes(content, slot);
    return theirTypes.reduce((sum, types) => sum + typingEdge(content.typeChart, mine, types), 0);
  };
  // Stable by roll order, so equal scores keep the seed's order rather than the catalog's.
  const team = candidates
    .map((slot, i) => ({ slot, i, score: score(slot) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, TEAM_SIZE)
    .map((c) => c.slot);
  return { team, leads: [team[0].heroId, team[1].heroId] };
}

/** Where the next fight stands, off the same seed as its opponent: backdrop and music only. */
export function gauntletLocationId(run: GauntletRun, candidates: readonly string[]): string | null {
  if (candidates.length === 0) return null;
  const fight = run.wins + run.losses;
  const { value } = nextFloat(createRng((run.seed ^ Math.imul(fight + 1, 0x85ebca6b)) >>> 0));
  return candidates[Math.floor(value * candidates.length)];
}

/** The AI is the escalation's second half: Classic's for the early fights, the Trials' pilot from PILOT_FROM_WINS. */
export function gauntletAiPilot(run: Pick<GauntletRun, 'wins'>, pilotFromWins = PILOT_FROM_WINS): boolean {
  return run.wins >= pilotFromWins;
}

// --- The record ---

export function startGauntletFight(profile: Profile): Profile {
  const run = profile.gauntlet;
  if (!run || run.team.length !== TEAM_SIZE) throw new GauntletError('no drafted Gauntlet to fight');
  return { ...profile, gauntlet: { ...run, fighting: true } };
}

/** A fight's result onto the record; at five wins or two losses the run ends and pays (§5). */
export function recordGauntletFight(profile: Profile, outcome: 'win' | 'loss'): { profile: Profile; result: GauntletResult | null } {
  const run = profile.gauntlet;
  if (!run) throw new GauntletError('no Gauntlet is open');
  const next: GauntletRun = { ...run, fighting: false, wins: run.wins + (outcome === 'win' ? 1 : 0), losses: run.losses + (outcome === 'loss' ? 1 : 0) };
  if (next.wins >= WINS_TO_CLEAR || next.losses >= LOSSES_TO_END) return endGauntlet({ ...profile, gauntlet: next });
  return { profile: { ...profile, gauntlet: next }, result: null };
}

/** A fight found unfinished on return is a loss (§4). Nothing to settle, nothing changes. */
export function settleLeftFight(profile: Profile): { profile: Profile; result: GauntletResult | null; forfeited: boolean } {
  if (!profile.gauntlet?.fighting) return { profile, result: null, forfeited: false };
  return { ...recordGauntletFight(profile, 'loss'), forfeited: true };
}

/** Ends the open run at its record — a retire, or the last fight. Pays only at WINS_TO_CLEAR. */
export function endGauntlet(profile: Profile): { profile: Profile; result: GauntletResult } {
  const run = profile.gauntlet;
  if (!run) throw new GauntletError('no Gauntlet is open');
  const cleared = run.wins >= WINS_TO_CLEAR;
  const evolutionStars = { ...profile.evolutionStars };
  const starsEarned: string[] = [];
  if (cleared) {
    for (const slot of run.team) {
      if (!slot.pathId) continue;
      const held = evolutionStars[slot.heroId] ?? [];
      if (held.includes(slot.pathId)) continue;
      evolutionStars[slot.heroId] = [...held, slot.pathId];
      starsEarned.push(slot.pathId);
    }
  }
  const bonus = cleared ? GAUNTLET_CLEAR_BONUS : 0;
  return {
    profile: {
      ...profile,
      gauntlet: null,
      evolutionStars,
      bonusStars: profile.bonusStars + bonus,
      gauntletClears: profile.gauntletClears + (cleared ? 1 : 0),
    },
    result: { wins: run.wins, losses: run.losses, cleared, starsEarned, bonus },
  };
}

/** Starred on this account — the offer card's mark. */
export function isSlotStarred(profile: Pick<Profile, 'evolutionStars'>, slot: TeamSlot): boolean {
  return !!slot.pathId && (profile.evolutionStars[slot.heroId]?.includes(slot.pathId) ?? false);
}
