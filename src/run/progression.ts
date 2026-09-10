// The pooled level-up currency — mechanism only; pool/path content is in
// src/data/progression.ts. Spec: docs/leveling-and-ranks.md.

import type { HeroDefinition, MoveDefinition, MoveTier, PassiveId, StatKey, TypeId } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import { BASE_ITEM_SLOTS, MAX_ITEM_SLOTS } from './equipment';
import type { RosterEntry, RunState } from './state';
import { mergeStatMods } from './statMods';

/** Past the cap, growth is substitution, never expansion. */
export const MOVE_CAP = 4;

/**
 * Ceiling on the level-up price. The raw triangular curve made deep levels unaffordable:
 * a full five-act run pays roughly 70 pooled points, and reaching MASTERY_LEVEL on ONE
 * hero cost 55 of them, so the late-tier movepool — every move costing 70+ mana — was
 * priced out of a real run.
 */
export const MAX_LEVEL_UP_COST = 5;

/**
 * A level-up costs as many points as the level being LEFT (CLAUDE.md), so a hero's first
 * level-up costs 1 — flattening at MAX_LEVEL_UP_COST rather than rising forever.
 */
export function levelUpCost(level: number): number {
  return Math.min(MAX_LEVEL_UP_COST, Math.max(1, level));
}

/** Triangular sum of levelUpCost over [fromLevel, toLevel). */
export function costToReachLevel(fromLevel: number, toLevel: number): number {
  let total = 0;
  for (let level = fromLevel; level < toLevel; level++) total += levelUpCost(level);
  return total;
}

/**
 * The gate every level-up screen must use instead of `levelUpPool > 0` — a
 * non-empty pool may buy nobody. Ignores an earned-but-unresolved Evolution;
 * callers check `availableEvolution` for that separately.
 */
export function canAffordAnyLevelUp(run: RunState): boolean {
  return run.roster.some((entry) => run.levelUpPool >= levelUpCost(entry.level));
}

/** Uniform Evolution trigger level for every hero (per-hero depth is deferred). */
export const EVOLUTION_LEVEL = 5;

// --- Mastery Rank: the gate on the movepool (docs/growth-overhaul.md §4) ---
//
// Rank sits BEHIND THE SPEND rather than behind a clock, and that is the whole point. Gate the
// tiers on the act and holding a Scroll always beats spending one; gate them on how many have
// gone into THIS hero and the incentive inverts. It also prices the carry build in breadth:
// concentrate and the ceiling rises, spread six ways and nobody ranks up.

/** Scrolls to climb one rank. Six maxes a hero. */
export const SCROLLS_PER_RANK = 3;

/**
 * Guaranteed income: what every Guardian pays. Ten over a run against the six that max one hero,
 * so the floor alone is one maxed hero and a second half-ranked — the Scroll Cache and the Guild
 * Hall are what turn that into a real spread-vs-concentrate call. First-pass figure for playtest.
 */
export const SCROLLS_PER_ACT = 2;

/**
 * What the `scrollReward` Scroll Cache pays. Two, so a cache is a whole rank's worth of a
 * decision rather than a top-up. First-pass figure for playtest.
 */
export const SCROLL_REWARD_COUNT = 2;

export const MAX_MASTERY_RANK = 3;

/**
 * DERIVED from `masteryScrollsSpent`, never stored (state.ts). Rank 1 at 0-2 spent, 2 at 3-5,
 * 3 from 6 on.
 */
export function masteryRank(entry: RosterEntry): number {
  return Math.min(MAX_MASTERY_RANK, 1 + Math.floor(entry.masteryScrollsSpent / SCROLLS_PER_RANK));
}

/** Scrolls still owed for the next rank; 0 at the cap. */
export function scrollsToNextRank(entry: RosterEntry): number {
  if (masteryRank(entry) >= MAX_MASTERY_RANK) return 0;
  return SCROLLS_PER_RANK - (entry.masteryScrollsSpent % SCROLLS_PER_RANK);
}

/** Rank at which each move tier becomes offerable. Maps 1:1 onto the authored 6 Early / 6 Mid / 4 Late. */
export const MOVE_TIER_RANK: Record<MoveTier, number> = {
  early: 1,
  mid: 2,
  late: 3,
};

/**
 * Rank at which a tier stops being offerable. Early EXPIRES the moment Mid opens: a ranked-up
 * hero handed a starter-tier move is the ladder paying out backwards, and Early outnumbering
 * everything else is what buried the Late band under a random draw. Mid and Late accumulate
 * instead — the Late slates hold 4-5 moves a type, far too few to carry a band alone.
 */
export const MOVE_TIER_RANK_EXPIRY: Record<MoveTier, number> = {
  early: MOVE_TIER_RANK.mid,
  mid: Infinity,
  late: Infinity,
};

/** Whether `rank` has REACHED a tier at all. A move with no authored `tier` is ungated — Ancient has no slate yet. */
export function isMoveTierReached(move: MoveDefinition | undefined, rank: number): boolean {
  return rank >= MOVE_TIER_RANK[move?.tier ?? 'early'];
}

/**
 * Reached AND not expired — the gate on the base pool. A graft's line is gated on
 * isMoveTierReached instead: a graft can land on a hero already past rank 1, and applying the
 * expiry to it would make every Early move in the grafted type's line permanently unreachable.
 * The expiry stops the BASE pool paying starter moves late; a grafted type is new to this hero,
 * and its Early moves are the way into it.
 */
export function isMoveTierOfferable(move: MoveDefinition | undefined, rank: number): boolean {
  const tier = move?.tier;
  if (!tier) return true;
  return isMoveTierReached(move, rank) && rank < MOVE_TIER_RANK_EXPIRY[tier];
}

/** Last level whose level-up pays out a move; past it a level-up buys a stat (CLAUDE.md exemption). Same decision as data/progression.ts FLOOR — move one, move both. */
export const MASTERY_LEVEL = 10;

/** Flat grant per mastery level-up — a multiple of 10, so the 5/10 lock binds without exemption. */
export const MASTERY_STAT_AMOUNT = 10;

/**
 * The five combat stats only — HP/Mana/MP Regen are excluded because +10 is not
 * worth the same thing across all eight. Deliberately NOT imported from
 * data/moves.ts RANDOM_STAT_POOL: the two reels are independently authorable.
 */
export const MASTERY_STAT_POOL: readonly StatKey[] = ['attack', 'defense', 'intelligence', 'wisdom', 'speed'];

export function isValidMasteryStat(stat: StatKey): boolean {
  return MASTERY_STAT_POOL.includes(stat);
}

/** Stats offered per mastery level-up; the player picks one. */
export const MASTERY_CHOICE_COUNT = 3;

/** `count` DISTINCT stats from MASTERY_STAT_POOL via partial Fisher-Yates; `random` is injected so tests can pin a draw. */
export function drawMasteryStats(random: () => number, count: number = MASTERY_CHOICE_COUNT): StatKey[] {
  const bag = [...MASTERY_STAT_POOL];
  const draw = Math.min(count, bag.length);
  for (let i = 0; i < draw; i++) {
    const j = i + Math.floor(random() * (bag.length - i));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag.slice(0, draw);
}

/**
 * Floor on a hero's move pool, by OFFERABLE SET rather than by cumulative band — Early expiring
 * at Mid means the three sets are Early alone, Mid alone, and Mid+Late.
 *
 * It is no longer DERIVED from a curve, because there is no curve: Scrolls make offers-per-hero
 * player-controlled and unbounded, so no depth can promise a pool "cannot be emptied" the way
 * MOVE_POOL_MARGIN did (docs/growth-overhaul.md §4). Running a band dry is now a legal state the
 * spend refuses rather than a data bug — and `SCROLLS_PER_RANK` offers is what a band has to
 * survive to get the hero out of it, which is what these numbers are. In practice every pool is
 * authored well past them (6 Early / 6 Mid / 4 Late). Enforced by test/moveTiers.test.ts.
 */
export interface MovePoolFloor {
  /** Early alone: rank 1. */
  early: number;
  /** Mid alone: rank 2, where Mid has opened and Early has expired. */
  mid: number;
  /** Mid and Late together: rank 3. */
  midLate: number;
}

export function movePoolFloor(): MovePoolFloor {
  return { early: SCROLLS_PER_RANK, mid: SCROLLS_PER_RANK, midLate: SCROLLS_PER_RANK };
}

/**
 * What a level-up pays out, read off the POST-level-up entry. Moves left the level track on
 * 2026-09-10 (Growth Overhaul phase 2) — a Scroll is the only faucet — so a level either
 * surfaces an Evolution or falls through to the stat reel. Phase 3 replaces the reel with
 * per-level growth-grade rolls and this collapses further.
 */
export type LevelUpPayout = 'evolution' | 'mastery';

export function levelUpPayout(
  table: ProgressionTable,
  _moves: Record<string, MoveDefinition>,
  entry: RosterEntry
): LevelUpPayout {
  return availableEvolution(table, entry) ? 'evolution' : 'mastery';
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
  /** Currently always EVOLUTION_LEVEL. */
  level: number;
  /** Exactly three, differing in kind. */
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

function replaceEntry(run: RunState, rosterId: string, next: RosterEntry, spend: number): RunState {
  return {
    ...run,
    levelUpPool: run.levelUpPool - spend,
    roster: run.roster.map((r) => (r.rosterId === rosterId ? next : r)),
  };
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
 * tiers above the hero's Mastery Rank. Pass the POST-spend entry: the Scroll ticks the rank
 * before it rolls, so the third one into a hero is the one that opens Mid.
 */
export function masteryMovePool(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  entry: RosterEntry
): string[] {
  const rank = masteryRank(entry);
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
 * What a Scroll spent on this hero would open up — the POST-tick pool, which is what the spend
 * actually rolls from.
 */
export function scrollMovePool(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  entry: RosterEntry
): string[] {
  return masteryMovePool(table, moves, { ...entry, masteryScrollsSpent: entry.masteryScrollsSpent + 1 });
}

/**
 * Whether a Scroll can legally be poured into this hero. Refused only when it would buy
 * LITERALLY nothing: the band is dry AND the rank cannot rise.
 *
 * The dry-band case is otherwise allowed on purpose, and it is the fix for a real dead end. A
 * band can empty — an event's gifts fill the loadout out of the hero's own pool, and offers burn
 * whether taken or declined — and refusing there would strand the hero at that rank forever,
 * since the rank tick is the only thing that opens the next band. So below the cap a Scroll
 * always buys the tick; only at MAX_MASTERY_RANK with nothing left to teach is the hero finished
 * (docs/growth-overhaul.md §4).
 */
export function canSpendScroll(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  run: RunState,
  entry: RosterEntry
): boolean {
  if (run.masteryScrolls < 1) return false;
  return scrollMovePool(table, moves, entry).length > 0 || masteryRank(entry) < MAX_MASTERY_RANK;
}

/** Spends levelUpCost(entry.level) and increments level. The move/Evolution payout is resolved separately by the caller. */
export function levelUpHero(run: RunState, rosterId: string): RunState {
  const entry = requireEntry(run, rosterId);
  const cost = levelUpCost(entry.level);
  if (run.levelUpPool < cost) throw new ProgressionError('Not enough training points');

  return replaceEntry(run, rosterId, { ...entry, level: entry.level + 1 }, cost);
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
  return replaceEntry(run, rosterId, { ...entry, unlockedMoveIds }, 0);
}

/** The Scroll was spent by spendMasteryScroll. Grants, and spends the offer — swapping the move away later does not put it back in the pool. */
export function grantOfferedMove(run: RunState, rosterId: string, moveId: string, replaceMoveId?: string): RunState {
  return recordMoveOffer(grantMove(run, rosterId, moveId, replaceMoveId), rosterId, [moveId]);
}

/**
 * Pours one Mastery Scroll into a hero: takes it off the run's pool and ticks the rank bar.
 * The move it offers is the caller's roll off the POST-spend entry (scrollMovePool) — the tick
 * lands FIRST, so the third Scroll into a hero is the one that opens Mid. That is what makes
 * every third spend the bigger moment rather than a silent deposit.
 *
 * The offer itself is banked by recordMoveOffer, as a level-up's was: an offer is spent by
 * being MADE, so declining still burns the move.
 */
export function spendMasteryScroll(run: RunState, rosterId: string): RunState {
  const entry = requireEntry(run, rosterId);
  if (run.masteryScrolls < 1) throw new ProgressionError('No Mastery Scrolls to spend');
  const next = replaceEntry(run, rosterId, { ...entry, masteryScrollsSpent: entry.masteryScrollsSpent + 1 }, 0);
  return { ...next, masteryScrolls: next.masteryScrolls - 1 };
}

/** Income. Scrolls land on the RUN, never on a hero — who they go to is the whole decision. */
export function grantMasteryScrolls(run: RunState, count: number = 1): RunState {
  if (!Number.isInteger(count) || count < 1) throw new ProgressionError(`${count} is not a Scroll count`);
  return { ...run, masteryScrolls: run.masteryScrolls + count };
}

/**
 * Burns a move out of the hero's offer pool without granting it — the decline half of a
 * replace-or-decline. An offer is spent by being MADE, so the screen calls this the moment
 * it puts a move in front of the player, not when the player answers.
 */
export function recordMoveOffer(run: RunState, rosterId: string, moveIds: readonly string[]): RunState {
  const entry = requireEntry(run, rosterId);
  return replaceEntry(run, rosterId, { ...entry, offeredMoveIds: withOffers(entry, moveIds) }, 0);
}

/** Free, like grantLevelUpMove. The roll is the caller's; the reel restriction is enforced here so a caller can't reintroduce +10 MP Regen. */
export function grantMasteryStat(run: RunState, rosterId: string, stat: StatKey): RunState {
  const entry = requireEntry(run, rosterId);
  if (!isValidMasteryStat(stat)) {
    throw new ProgressionError(`${stat} is not a mastery stat`);
  }
  const nextEntry: RosterEntry = {
    ...entry,
    masteryStatGrants: mergeStatMods(entry.masteryStatGrants, { [stat]: MASTERY_STAT_AMOUNT }),
  };
  return replaceEntry(run, rosterId, nextEntry, 0);
}

/** The next unresolved Evolution node regardless of level ("where is this hero headed"); null once all are resolved. */
export function pendingEvolution(table: ProgressionTable, entry: RosterEntry): EvolutionNode | null {
  const nodes = table.evolutions[entry.heroId] ?? [];
  return nodes[entry.chosenPathIds.length] ?? null;
}

/** The gate: the pending node only once its level is reached. */
export function availableEvolution(table: ProgressionTable, entry: RosterEntry): EvolutionNode | null {
  const node = pendingEvolution(table, entry);
  if (!node) return null;
  return entry.level >= node.level ? node : null;
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

/** Free — reaching the trigger level already cost the pool. `heroes` is needed only to validate a type-graft against innate types. */
export function chooseEvolutionPath(
  run: RunState,
  table: ProgressionTable,
  heroes: HeroLookup,
  rosterId: string,
  pathId: string
): RunState {
  const entry = requireEntry(run, rosterId);
  const node = availableEvolution(table, entry);
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
    chosenPathIds: [...entry.chosenPathIds, path.id],
    unlockedMoveIds: applyEvolutionMoves(entry.unlockedMoveIds, path.unlocksMoveIds).unlockedMoveIds,
    // Both halves are spent: what the cap took, and the overflow the caller is about to offer.
    offeredMoveIds: withOffers(entry, path.unlocksMoveIds),
    evolutionStatGrants: mergeStatMods(entry.evolutionStatGrants, path.statGrants),
    evolutionPassiveGrants: [...new Set([...entry.evolutionPassiveGrants, ...(path.grantsPassiveIds ?? [])])],
    evolutionTypeGraft,
  };
  return replaceEntry(run, rosterId, nextEntry, 0);
}
