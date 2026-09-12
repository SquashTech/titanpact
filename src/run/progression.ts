// The movepool and the Evolution tree — mechanism only; pool/path content is in
// src/data/progression.ts. Spec: docs/leveling-and-ranks.md.
//
// Levels themselves are NOT here: they are automatic and roster-wide (run/growth.ts). What lives
// here is everything a level used to gate and no longer does — the Mastery Scroll faucet, the
// rank that gates its tiers, and the Evolution nodes.

import type { HeroDefinition, MoveDefinition, MoveTier, PassiveId, StatKey, TypeId } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import { BASE_ITEM_SLOTS, MAX_ITEM_SLOTS } from './equipment';
import type { RosterEntry, RunState } from './state';
import { mergeStatMods } from './statMods';

/** Past the cap, growth is substitution, never expansion. */
export const MOVE_CAP = 4;

/**
 * The level an Evolution node is authored at. **Nothing gates on it any more** (2026-09-10,
 * Growth Overhaul phase 4; re-homed 2026-09-11, §11): Evolutions left the level track for the
 * Scroll ladder — `EVOLUTION_RUNG`. Under automatic roster-wide levelling every hero crosses
 * any threshold on the same fight, so a level trigger IS a six-decision wall — the move was a
 * consequence, not a taste.
 *
 * Kept because `EvolutionNode.level` is still authored data and per-hero depth is still deferred;
 * the tutorial and the docs also date the fork by it. Do not re-attach a gate to it.
 */
export const EVOLUTION_LEVEL = 5;

// --- Mastery Rank: the gate on the movepool (docs/growth-overhaul.md §4, ladder §11, price §12) ---
//
// Rank sits BEHIND THE SPEND rather than behind a clock, and that is the whole point. Gate the
// tiers on the act and holding a Scroll always beats spending one; gate them on how many have
// gone into THIS hero and the incentive inverts. It also prices the carry build in breadth:
// concentrate and the ceiling rises, spread six ways and nobody ranks up.
//
// The ladder is climbed in RUNGS, and a rung has a PRICE in Scrolls that rises with the rung
// (2026-09-12, per user direction — the pre-overhaul level-up curve, brought back whole). A hero's
// first rung costs 1 Scroll, its second 2, then 3, 4, and every rung from the fifth costs
// MAX_SCROLL_COST. Income rises by act to match (difficulty.ts scrollsFor). A flat 1-a-rung price
// had made every Scroll the same size of decision; the curve makes the first rungs into a fresh
// hero cheap and the deep ones dear, which is what gives a recruit-over-raise pivot a price the
// player can feel.

/**
 * Ceiling on a rung's price. Unbounded, the triangular curve priced the Late band out of a real
 * run: reaching it cost 21 of the ~70 a pre-scaling run paid. At 5 the Late rung costs 20, and a
 * hero is never more than 5 Scrolls from its next rung.
 */
export const MAX_SCROLL_COST = 5;

/** What climbing from `rung` rungs climbed to the next costs: 1, 2, 3, 4, then MAX_SCROLL_COST. */
export function scrollCost(rung: number): number {
  return Math.min(MAX_SCROLL_COST, Math.max(1, rung + 1));
}

/** Triangular sum of scrollCost over the rungs below `rung`: what a hero standing there has poured in. */
export function scrollsToReachRung(rung: number): number {
  let total = 0;
  for (let r = 0; r < rung; r++) total += scrollCost(r);
  return total;
}

/**
 * Rungs climbed at which each rank opens. Rank 1 at 0, Rank 2 at 3, Rank 3 at 6 — and Rank 3 is
 * open-ended: past it every rung offers Late until the pool is dry (`canSpendScroll`). Authored
 * as thresholds rather than a per-rank count because the Evolution sits between two of them.
 * These are the old level curve's 4 / 7 as rungs (a level-1 hero had climbed none).
 */
export const RANK_THRESHOLDS: readonly number[] = [0, 3, 6];

/**
 * The rung that evolves a hero (2026-09-11, per user direction — replacing the Crucible, which
 * now grants a Class; re-priced 2026-09-12 onto the old curve's level 5). Mid-ladder rather
 * than at the top: the top rung stacking Evolution + Late + a graft's whole line onto one pour
 * made every rung below it a deposit. The 3rd rung changes what a hero can DO, the 4th what it
 * IS, the 6th opens the ceiling.
 */
export const EVOLUTION_RUNG = 4;

/** Scrolls poured by the time a hero evolves: 1 + 2 + 3 + 4. Derived; the rung is what is authored. */
export const EVOLUTION_SCROLLS = scrollsToReachRung(EVOLUTION_RUNG);

/**
 * What the `scrollReward` Scroll Cache pays. Two, flat across acts and deliberately under one
 * fight's pay: a cache is a top-up the player can take instead of gold or an item, not a
 * substitute for fighting. First-pass figure for playtest.
 */
export const SCROLL_REWARD_COUNT = 2;

/**
 * What the `loneScrollReward` node pays. One — the commoner, smaller half of the same grant
 * (2026-09-10, per user direction). It was the XP Cache until levels went automatic and there
 * was no pool left to pay into; it kept its seat rather than being deleted because the reward
 * rows were already down to six types.
 */
export const LONE_SCROLL_COUNT = 1;

export const MAX_MASTERY_RANK = RANK_THRESHOLDS.length;

/** The rung that reaches the top rank — the pips the board draws. Not a cap on climbing. */
export const RUNGS_TO_MAX_RANK = RANK_THRESHOLDS[RANK_THRESHOLDS.length - 1];

/** Scrolls poured by the time a hero reaches the top rank. Derived. */
export const SCROLLS_TO_MAX_RANK = scrollsToReachRung(RUNGS_TO_MAX_RANK);

/**
 * Rungs climbed, DERIVED from `masteryScrollsSpent` (state.ts) — the only thing stored is how
 * many Scrolls went in, and every spend lands exactly on a rung, so the inversion is exact.
 * A figure set by hand (a fixture, enemyGen) that falls between rungs counts the rungs completed.
 */
export function masteryRung(entry: RosterEntry): number {
  let rung = 0;
  let paid = 0;
  while (paid + scrollCost(rung) <= entry.masteryScrollsSpent) {
    paid += scrollCost(rung);
    rung++;
  }
  return rung;
}

/** What this hero's NEXT rung costs. */
export function nextScrollCost(entry: RosterEntry): number {
  return scrollCost(masteryRung(entry));
}

/** DERIVED, never stored: the rungs the climb has crossed. */
export function masteryRank(entry: RosterEntry): number {
  const rung = masteryRung(entry);
  return RANK_THRESHOLDS.filter((at) => rung >= at).length;
}

/** Rungs still owed for the next rank; 0 at the cap. */
export function rungsToNextRank(entry: RosterEntry): number {
  const rung = masteryRung(entry);
  const next = RANK_THRESHOLDS.find((at) => at > rung);
  return next === undefined ? 0 : next - rung;
}

/** Whether the ladder has reached the Evolution rung — the gate `availableEvolution` applies. */
export function evolutionRungReached(entry: RosterEntry): boolean {
  return masteryRung(entry) >= EVOLUTION_RUNG;
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

/**
 * Floor on a hero's move pool, by OFFERABLE SET rather than by cumulative band — Early expiring
 * at Mid means the three sets are Early alone, Mid alone, and Mid+Late.
 *
 * It is no longer DERIVED from a curve, because there is no curve: Scrolls make offers-per-hero
 * player-controlled and unbounded, so no depth can promise a pool "cannot be emptied" the way
 * MOVE_POOL_MARGIN did (docs/growth-overhaul.md §4). Running a band dry is now a legal state the
 * spend refuses rather than a data bug — and the offers it takes to climb OUT of a band is what
 * the band has to survive, read off `RANK_THRESHOLDS`: Early is offered by the rungs before the
 * one that opens Mid, Mid by every rung from that one to the one that opens Late (one of which is
 * the Evolution, which offers nothing — so this over-counts Mid by one, on the safe side). Rank 3
 * is open-ended, so Mid+Late only has to offer once. In practice every pool is authored well past
 * these (6 Early / 6 Mid / 4 Late). Enforced by test/moveTiers.test.ts.
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
  return { early: RANK_THRESHOLDS[1] - 1, mid: RANK_THRESHOLDS[2] - RANK_THRESHOLDS[1], midLate: 1 };
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
 * tiers above the hero's Mastery Rank. Pass the POST-spend entry: the rung ticks the rank
 * before it rolls, so the third rung into a hero is the one that opens Mid.
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
 * What the next rung into this hero would open up — the POST-tick pool, which is what the spend
 * actually rolls from.
 */
export function scrollMovePool(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  entry: RosterEntry
): string[] {
  return masteryMovePool(table, moves, { ...entry, masteryScrollsSpent: entry.masteryScrollsSpent + nextScrollCost(entry) });
}

/**
 * Whether the run can buy this hero's next rung: the purse covers its price (nextScrollCost),
 * and the rung buys something. Refused only when it would buy LITERALLY nothing: the band is
 * dry AND the rank cannot rise.
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
  if (run.masteryScrolls < nextScrollCost(entry)) return false;
  return scrollMovePool(table, moves, entry).length > 0 || masteryRank(entry) < MAX_MASTERY_RANK;
}

/**
 * The gate every Mastery screen must use instead of `masteryScrolls > 0` — a non-empty purse
 * may buy nobody. A leftover that buys nobody BANKS; it is normal, and it is the whole reason
 * the purse exists (docs/growth-overhaul.md §12).
 */
export function canAffordAnyScroll(table: ProgressionTable, moves: Record<string, MoveDefinition>, run: RunState): boolean {
  return run.roster.some((entry) => canSpendScroll(table, moves, run, entry));
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

/** The Scroll was spent by spendMasteryScroll. Grants, and spends the offer — swapping the move away later does not put it back in the pool. */
export function grantOfferedMove(run: RunState, rosterId: string, moveId: string, replaceMoveId?: string): RunState {
  return recordMoveOffer(grantMove(run, rosterId, moveId, replaceMoveId), rosterId, [moveId]);
}

/**
 * Buys a hero its next rung: takes the rung's price (nextScrollCost) off the run's purse and
 * pours it into the hero, which ticks the rank bar. The move it offers is the caller's roll off
 * the POST-spend entry (scrollMovePool) — the tick lands FIRST, so the third rung into a hero is
 * the one that opens Mid. That is what makes that spend the bigger moment rather than a silent
 * deposit.
 *
 * The offer itself is banked by recordMoveOffer, as a level-up's was: an offer is spent by
 * being MADE, so declining still burns the move.
 */
export function spendMasteryScroll(run: RunState, rosterId: string): RunState {
  const entry = requireEntry(run, rosterId);
  const cost = nextScrollCost(entry);
  if (run.masteryScrolls < cost) {
    throw new ProgressionError(`${rosterId}'s next rung costs ${cost} Mastery Scrolls, only ${run.masteryScrolls} held`);
  }
  const next = replaceEntry(run, rosterId, { ...entry, masteryScrollsSpent: entry.masteryScrollsSpent + cost });
  return { ...next, masteryScrolls: next.masteryScrolls - cost };
}

/**
 * Income. Scrolls land on the RUN, never on a hero — who they go to is the whole decision. New
 * Scrolls always re-open the Mastery gate, whatever the player banked before them: banking is
 * never a dead end because the next win re-asks.
 */
export function grantMasteryScrolls(run: RunState, count: number = 1): RunState {
  if (!Number.isInteger(count) || count < 1) throw new ProgressionError(`${count} is not a Scroll count`);
  return { ...run, masteryScrolls: run.masteryScrolls + count, masteryDeferred: false };
}

/** The player chose to bank rather than spend (MasteryScreen's Bank button). Suppresses the gate until the next grant. */
export function deferMastery(run: RunState): RunState {
  return { ...run, masteryDeferred: true };
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
 * The node this hero can take NOW, or null: the next unresolved one, once the ladder has reached
 * `EVOLUTION_RUNG` (docs/growth-overhaul.md §11). Gated on the spend, not on level and not on
 * a beat — the 4th rung into a hero raises the Evolution screen for that one hero, so there is
 * no wall to cross. A generated hero reads its spend off level (enemyGen.ts) and passes the same
 * gate.
 */
export function availableEvolution(table: ProgressionTable, entry: RosterEntry): EvolutionNode | null {
  return evolutionRungReached(entry) ? pendingEvolution(table, entry) : null;
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
  return replaceEntry(run, rosterId, nextEntry);
}
