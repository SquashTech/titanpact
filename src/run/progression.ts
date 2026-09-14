// The movepool and the Evolution tree — mechanism only; pool/path content is in
// src/data/progression.ts. Spec: docs/xp-overhaul.md §4, docs/leveling-and-ranks.md.
//
// Levels themselves are NOT here: they are automatic and roster-wide (run/growth.ts). What lives
// here is what a level PAYS: the per-hero schedule that says which levels roll a move offer, which
// band they roll from, and which one is the Evolution.

import type { HeroDefinition, LevelSchedule, MoveDefinition, MoveTier, PassiveId, StatKey, TypeId } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import { BASE_ITEM_SLOTS, MAX_ITEM_SLOTS } from './equipment';
import type { RosterEntry, RunState } from './state';
import { mergeStatMods } from './statMods';
import { levelOf, xpForLevel } from './growth';

/** Past the cap, growth is substitution, never expansion. */
export const MOVE_CAP = 4;

// --- The schedule: what a level pays (docs/xp-overhaul.md §4) ---
//
// One model for everybody. A roster hero, an enemy, a contract hero and a Guild hire all read the
// same per-hero schedule off the same number, their level: which levels roll a move offer, which
// band the offer rolls from, and which level is the Evolution. Nothing is held and nothing is
// spent, so there is no purse, no price and no gate to sit behind a spend — the ceiling sits
// behind the level, and the level is paid by what the roster won and what the player aimed
// (run/ichor.ts).
//
// Keep the roll, lose the currency: a level on `offerLevels` rolls ONE move from the band that
// level has opened, take it or decline, burned either way (the Scroll rung minus the Scroll). The
// schedule says WHEN, the band says FROM WHAT, the roll says WHICH — Charmander learns Ember at
// 12 every game, and in a roguelike that makes every Cinder the same Cinder.

/**
 * The default every hero ships on until its own is authored (phase 4): the table a generated
 * hero already read its ladder off — Mid at 10, the Evolution at 16, Late at 21 — with an offer
 * every three levels. Authored per hero, the spread is the identity the roster was missing: a
 * hero whose sheet says `evolves at 12` against one that says `evolves at 20`.
 */
export const DEFAULT_SCHEDULE: LevelSchedule = {
  offerLevels: [4, 7, 10, 13, 16, 19, 22, 25, 28],
  midLevel: 10,
  evolutionLevel: 16,
  lateLevel: 21,
};

export function scheduleFor(hero: HeroDefinition | undefined): LevelSchedule {
  return hero?.schedule ?? DEFAULT_SCHEDULE;
}

/**
 * What a schedule level pays. `offer` rolls a move from the open band; `evolution` raises the
 * hero's Evolution screen in its place — the Evolution is that level's whole reward, no offer
 * rolls behind it; `step` is the companion's tier-step (run/companion.ts), which stands where a
 * branch would and where the Late band opens, since the body that holds Late moves is the Late
 * body.
 */
export type ScheduleEntryKind = 'offer' | 'evolution' | 'step';

export interface ScheduleEntry {
  level: number;
  kind: ScheduleEntryKind;
}

/**
 * The schedule as the ordered list of things it pays. A hero walks it one entry at a time
 * (`RosterEntry.scheduleTaken`), which is what lets a raw hire arrive with its levels UN-crossed:
 * the entries below its level are still owed, and it takes one per level-up until it has caught
 * up. `mortal` is the companion, whose Evolution and Late levels are tier-steps.
 */
export function scheduleEntries(schedule: LevelSchedule, mortal = false): ScheduleEntry[] {
  const levels = new Set<number>([...schedule.offerLevels, schedule.evolutionLevel]);
  if (mortal) levels.add(schedule.lateLevel);
  return [...levels]
    .sort((a, b) => a - b)
    .map((level) => ({
      level,
      kind: mortal && (level === schedule.evolutionLevel || level === schedule.lateLevel) ? 'step' : level === schedule.evolutionLevel ? 'evolution' : 'offer',
    }));
}

/** Rank at which each move tier becomes offerable. Maps 1:1 onto the authored 6 Early / 6 Mid / 4 Late. */
export const MOVE_TIER_RANK: Record<MoveTier, number> = {
  early: 1,
  mid: 2,
  late: 3,
};

export const MAX_BAND_RANK = MOVE_TIER_RANK.late;

/** The band a level has opened, as the rank the tier gate reads: 1 below midLevel, 2 below lateLevel, 3 past it. */
export function bandRank(schedule: LevelSchedule, level: number): number {
  if (level >= schedule.lateLevel) return MOVE_TIER_RANK.late;
  if (level >= schedule.midLevel) return MOVE_TIER_RANK.mid;
  return MOVE_TIER_RANK.early;
}

export function entryBandRank(hero: HeroDefinition | undefined, entry: RosterEntry): number {
  return bandRank(scheduleFor(hero), levelOf(entry));
}

/**
 * Rank at which a tier stops being offerable. **Each band offers its own tier and nothing else**
 * (2026-09-13, XP Overhaul phase 6): Early EXPIRES the moment Mid opens, and Mid the moment Late
 * does. A hero past midLevel handed a starter-tier move is the schedule paying out backwards, and
 * a Late-band offer rolled from Mid+Late was Late only ~40% of the time — with 4 Late a slate
 * against 6 Mid, the band that exists to teach the expensive half of the catalog mostly did not.
 * Mid used to accumulate because the Late slates were too thin to carry an open-ended band;
 * under a schedule the Late band makes two offers a hero, and four moves carry two.
 */
export const MOVE_TIER_RANK_EXPIRY: Record<MoveTier, number> = {
  early: MOVE_TIER_RANK.mid,
  mid: MOVE_TIER_RANK.late,
  late: Infinity,
};

/** Whether `rank` has REACHED a tier at all. A move with no authored `tier` is ungated — Ancient has no slate yet. */
export function isMoveTierReached(move: MoveDefinition | undefined, rank: number): boolean {
  return rank >= MOVE_TIER_RANK[move?.tier ?? 'early'];
}

/**
 * Reached AND not expired — the gate on the base pool. A graft's line is gated on
 * isMoveTierReached instead: a graft can land on a hero already past midLevel, and applying the
 * expiry to it would make every Early move in the grafted type's line permanently unreachable.
 * The expiry stops the BASE pool paying starter moves late; a grafted type is new to this hero,
 * and its Early moves are the way into it.
 */
export function isMoveTierOfferable(move: MoveDefinition | undefined, rank: number): boolean {
  const tier = move?.tier;
  if (!tier) return true;
  return isMoveTierReached(move, rank) && rank < MOVE_TIER_RANK_EXPIRY[tier];
}

/**
 * Floor on a hero's move pool, by band: each band offers its own tier, so what a band has to
 * survive is exactly the offers the schedule makes from it — Early is every offer below midLevel,
 * Mid every offer from midLevel to below lateLevel (the Evolution offers nothing, so it is not
 * counted), Late every offer from lateLevel. Ichor can pull offers forward but never adds one, so
 * the schedule bounds the drain exactly. In practice every pool is authored well past these
 * (6 Early / 6 Mid / 4 Late against 2 / 2 / 2). Enforced by test/moveTiers.test.ts.
 */
export interface MovePoolFloor {
  /** Below midLevel. */
  early: number;
  /** From midLevel, where Mid has opened and Early has expired. */
  mid: number;
  /** From lateLevel, where Late has opened and Mid has expired. */
  late: number;
}

export function movePoolFloor(schedule: LevelSchedule = DEFAULT_SCHEDULE): MovePoolFloor {
  const offers = scheduleEntries(schedule).filter((e) => e.kind === 'offer');
  return {
    early: offers.filter((e) => e.level < schedule.midLevel).length,
    mid: offers.filter((e) => e.level >= schedule.midLevel && e.level < schedule.lateLevel).length,
    late: offers.filter((e) => e.level >= schedule.lateLevel).length,
  };
}

export interface EvolutionPath {
  id: string;
  heroId: string;
  /** Documentation of intent ("differ in kind"), not a mechanical multiplier. */
  kind: 'defensive' | 'offensive' | 'utility';
  name: string;
  /** Shown on the Evolution choice screen. */
  description?: string;
  statGrants: Partial<Record<StatKey, number>>;
  /** Granted outright the moment the path is chosen, up to MOVE_CAP — see applyEvolutionMoves for the overflow. */
  unlocksMoveIds: string[];
  /** Join the hero's level-up pool (still tier-gated) rather than being granted — a set of futures, not a loadout. */
  learnableMoveIds?: readonly string[];
  /** Secondary-type grant; only legal on a mono-type hero (enforced in chooseEvolutionPath). A later graft overwrites, never stacks. */
  typeGraft?: TypeId;
  grantsPassiveIds?: readonly PassiveId[];
}

export interface EvolutionNode {
  /** Exactly three, differing in kind. The level it opens at is the hero's schedule's evolutionLevel. */
  paths: EvolutionPath[];
}

export interface ProgressionTable {
  /** heroId -> moves offerable on level-up beyond the starting kit. */
  moveTiers: Record<string, string[]>;
  /** heroId -> ordered Evolution nodes (currently one per hero). */
  evolutions: Record<string, EvolutionNode[]>;
}

/**
 * A path's granted moves fill open slots in order; the rest are refused by MOVE_CAP and
 * returned as `overflow` for the caller to offer as a replace-or-decline, exactly like a
 * level-up move offered to a hero already at the cap. By the Evolution level a hero is
 * normally at the cap, so the overflow branch is the usual one, not the edge case.
 */
export function applyEvolutionMoves(
  unlockedMoveIds: readonly string[],
  unlocksMoveIds: readonly string[]
): { unlockedMoveIds: string[]; overflow: string[] } {
  const kept = [...unlockedMoveIds];
  const overflow: string[] = [];
  for (const id of unlocksMoveIds) {
    if (kept.includes(id)) continue;
    if (kept.length >= MOVE_CAP) overflow.push(id);
    else kept.push(id);
  }
  return { unlockedMoveIds: kept, overflow };
}

export class ProgressionError extends Error {}

function requireEntry(run: RunState, rosterId: string): RosterEntry {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new ProgressionError(`${rosterId} is not on the roster`);
  return entry;
}

function replaceEntry(run: RunState, rosterId: string, next: RosterEntry): RunState {
  return { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? next : r)) };
}

function withOffers(entry: RosterEntry, moveIds: readonly string[]): readonly string[] {
  return [...new Set([...entry.offeredMoveIds, ...moveIds])];
}

/** Starting kit plus everything the table can ever offer, deduped and NOT tier-gated — Quick Battle's random-loadout surface. */
export function fullMovepool(table: ProgressionTable, hero: HeroDefinition): string[] {
  return [...new Set([...hero.moveIds, ...(table.moveTiers[hero.id] ?? [])])];
}

/**
 * Table pool plus chosen paths' learnableMoveIds, minus unlocked, minus already offered, minus
 * tiers above the band the hero's LEVEL has opened. Pass the post-level entry: the level that
 * reaches midLevel is the one whose offer rolls from Mid.
 */
export function levelMovePool(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  hero: HeroDefinition | undefined,
  entry: RosterEntry
): string[] {
  const rank = entryBandRank(hero, entry);
  const grafted = new Set(chosenEvolutionPaths(table, entry).flatMap((path) => path.learnableMoveIds ?? []));
  const pool = [...new Set([...(table.moveTiers[entry.heroId] ?? []), ...grafted])];
  return pool.filter(
    (id) =>
      !entry.unlockedMoveIds.includes(id) &&
      !entry.offeredMoveIds.includes(id) &&
      (grafted.has(id) ? isMoveTierReached(moves[id], rank) : isMoveTierOfferable(moves[id], rank))
  );
}

/**
 * The schedule entry this hero is owed right now — the next one it has not taken, once its level
 * has reached it — or null. One entry a level-up: a hero at par crosses at most one (offers sit
 * three levels apart and par moves one or two a fight), and a raw hire with several owed works
 * them off one fight at a time, which is what its runway is.
 */
export function pendingScheduleEntry(hero: HeroDefinition | undefined, entry: RosterEntry): ScheduleEntry | null {
  const next = scheduleEntries(scheduleFor(hero), entry.mortal)[entry.scheduleTaken];
  return next && next.level <= levelOf(entry) ? next : null;
}

/** How many entries a hero arriving at `level` with everything already taken has behind it — a contract hero, an enemy. */
export function scheduleEntriesBelow(hero: HeroDefinition | undefined, level: number, mortal = false): number {
  return scheduleEntries(scheduleFor(hero), mortal).filter((e) => e.level <= level).length;
}

/** The entry is taken — whatever it paid. Declining an offer takes it exactly as learning does. */
export function takeScheduleEntry(run: RunState, rosterId: string): RunState {
  const entry = requireEntry(run, rosterId);
  return replaceEntry(run, rosterId, { ...entry, scheduleTaken: entry.scheduleTaken + 1 });
}

/**
 * Whether anything on the schedule is still ahead of this hero: an offer it has not reached, or
 * one it has reached and not taken. False only past the last entry — the hero is finished
 * learning from levels, and only the Tutor can teach it more.
 */
export function scheduleRemaining(hero: HeroDefinition | undefined, entry: RosterEntry): boolean {
  return entry.scheduleTaken < scheduleEntries(scheduleFor(hero), entry.mortal).length;
}

/**
 * A fixture helper: the entry stood at its Evolution — level raised to the schedule's
 * evolutionLevel if it is below it, and every entry before the Evolution taken. What the sandbox
 * and the tests use to evolve a hero without walking it there.
 */
export function atEvolution(hero: HeroDefinition | undefined, entry: RosterEntry): RosterEntry {
  const schedule = scheduleFor(hero);
  const entries = scheduleEntries(schedule, entry.mortal);
  const index = entries.findIndex((e) => e.kind !== 'offer');
  return {
    ...entry,
    xp: Math.max(entry.xp, xpForLevel(schedule.evolutionLevel)),
    scheduleTaken: index < 0 ? entries.length : index,
  };
}

/**
 * Free. Adds `moveId`, or swaps it in for `replaceMoveId` at the cap. Does NOT spend a
 * level-up offer: this is the faucet for moves that arrive from outside the pool — an event's
 * gift, a scripted grant — which the player was never asked to choose against.
 */
export function grantMove(run: RunState, rosterId: string, moveId: string, replaceMoveId?: string): RunState {
  const entry = requireEntry(run, rosterId);
  if (replaceMoveId && !entry.unlockedMoveIds.includes(replaceMoveId)) {
    throw new ProgressionError(`${replaceMoveId} is not currently unlocked on ${rosterId}`);
  }
  const unlockedMoveIds = replaceMoveId
    ? entry.unlockedMoveIds.map((id) => (id === replaceMoveId ? moveId : id))
    : [...entry.unlockedMoveIds, moveId];
  return replaceEntry(run, rosterId, { ...entry, unlockedMoveIds });
}

/** A schedule offer, taken. Grants, and spends the offer — swapping the move away later does not put it back in the pool. */
export function grantOfferedMove(run: RunState, rosterId: string, moveId: string, replaceMoveId?: string): RunState {
  return recordMoveOffer(grantMove(run, rosterId, moveId, replaceMoveId), rosterId, [moveId]);
}

/**
 * Burns a move out of the hero's offer pool without granting it — the decline half of a
 * replace-or-decline. An offer is spent by being MADE, so the screen calls this the moment
 * it puts a move in front of the player, not when the player answers.
 */
export function recordMoveOffer(run: RunState, rosterId: string, moveIds: readonly string[]): RunState {
  const entry = requireEntry(run, rosterId);
  return replaceEntry(run, rosterId, { ...entry, offeredMoveIds: withOffers(entry, moveIds) });
}

/** The next unresolved Evolution node regardless of level ("where is this hero headed"); null once all are resolved. */
export function pendingEvolution(table: ProgressionTable, entry: RosterEntry): EvolutionNode | null {
  const nodes = table.evolutions[entry.heroId] ?? [];
  return nodes[entry.chosenPathIds.length] ?? null;
}

/**
 * The node this hero can take NOW, or null: the next unresolved one, when the schedule entry it
 * is owed is the Evolution (docs/xp-overhaul.md §4). Gated on the entry, not on a beat — the
 * level that reaches `evolutionLevel` raises the Evolution screen for that one hero, from the
 * level-up report. A generated hero walks the same entries (enemyGen.ts) and passes the same gate.
 */
export function availableEvolution(table: ProgressionTable, hero: HeroDefinition | undefined, entry: RosterEntry): EvolutionNode | null {
  return pendingScheduleEntry(hero, entry)?.kind === 'evolution' ? pendingEvolution(table, entry) : null;
}

/** The primary plus the current graft — the out-of-combat mirror of engine/state.ts effectiveTypes, and it must stay identical to it. UI must read this, not `hero.types`. */
export function rosterEntryTypes(hero: HeroDefinition, entry: RosterEntry): readonly TypeId[] {
  return entry.evolutionTypeGraft ? [hero.types[0], entry.evolutionTypeGraft] : hero.types;
}

/**
 * BASE_ITEM_SLOTS plus the entry's Forge grants, capped. The ONE place slot capacity is decided —
 * UI, save and runProgress all read this.
 *
 * There is deliberately no per-hero dial (2026-09-08). Nine heroes used to author `itemSlots: 2`
 * for being at Speed <= 40, but Speed and HP are anti-correlated across this roster, so the rule
 * read as a Speed rule and landed as an HP rule: those nine were also the nine bulkiest. Measured,
 * a second item is worth 79.3% in a mirror match — several times the largest stat grant tested —
 * so the compensation dwarfed the disadvantage it was paying for, and nothing priced it against
 * the stat budget (`scripts/statprice.ts`, docs/progression.md "Pricing HP"). `hero` stays in the
 * signature because capacity is a per-hero question even when every hero currently answers it the
 * same way.
 */
export function itemSlotsFor(hero: HeroDefinition, entry: RosterEntry): number {
  void hero;
  return Math.min(MAX_ITEM_SLOTS, BASE_ITEM_SLOTS + entry.bonusItemSlots);
}

export function chosenEvolutionPaths(table: ProgressionTable, entry: RosterEntry): EvolutionPath[] {
  const allPaths = (table.evolutions[entry.heroId] ?? []).flatMap((node) => node.paths);
  return entry.chosenPathIds
    .map((id) => allPaths.find((p) => p.id === id))
    .filter((p): p is EvolutionPath => p !== undefined);
}

/** Free — the level paid for it. Takes the schedule entry. `heroes` also validates a type-graft against innate types. */
export function chooseEvolutionPath(
  run: RunState,
  table: ProgressionTable,
  heroes: HeroLookup,
  rosterId: string,
  pathId: string
): RunState {
  const entry = requireEntry(run, rosterId);
  const node = availableEvolution(table, heroes[entry.heroId], entry);
  if (!node) throw new ProgressionError(`No Evolution is currently available for ${rosterId}`);
  const path = node.paths.find((p) => p.id === pathId);
  if (!path) throw new ProgressionError(`${pathId} is not one of the offered paths`);
  for (const amount of Object.values(path.statGrants)) {
    if (amount !== undefined && !isValidFlatStatGrant(amount)) {
      throw new ProgressionError(`Evolution stat grant ${amount} must be a multiple of 5 or 10`);
    }
  }

  let evolutionTypeGraft = entry.evolutionTypeGraft;
  if (path.typeGraft) {
    const hero = heroes[entry.heroId];
    if (!hero) throw new ProgressionError(`Unknown hero ${entry.heroId}`);
    if (hero.types.includes(path.typeGraft)) {
      throw new ProgressionError(`Type-graft ${path.typeGraft} duplicates ${entry.heroId}'s innate type`);
    }
    // The graft OWNS the secondary slot (rosterEntryTypes): a mono hero gains a second type, an
    // innately dual one TRADES the one it was born with, and a later graft shifts whatever is
    // there. The primary is untouched in every case, and nothing ever reaches three types.
    evolutionTypeGraft = path.typeGraft;
  }

  const nextEntry: RosterEntry = {
    ...entry,
    scheduleTaken: entry.scheduleTaken + 1,
    chosenPathIds: [...entry.chosenPathIds, path.id],
    unlockedMoveIds: applyEvolutionMoves(entry.unlockedMoveIds, path.unlocksMoveIds).unlockedMoveIds,
    // Both halves are spent: what the cap took, and the overflow the caller is about to offer.
    offeredMoveIds: withOffers(entry, path.unlocksMoveIds),
    evolutionStatGrants: mergeStatMods(entry.evolutionStatGrants, path.statGrants),
    evolutionPassiveGrants: [...new Set([...entry.evolutionPassiveGrants, ...(path.grantsPassiveIds ?? [])])],
    evolutionTypeGraft,
  };
  return replaceEntry(run, rosterId, nextEntry);
}
