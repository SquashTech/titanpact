// The pooled level-up currency — mechanism only; pool/path content is in
// src/data/progression.ts. Spec: docs/leveling-and-ranks.md.

import type { HeroDefinition, MoveDefinition, MoveTier, PassiveId, StatKey, TypeId } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import type { RosterEntry, RunState } from './state';
import { mergeStatMods } from './statMods';

/** Past the cap, growth is substitution, never expansion. */
export const MOVE_CAP = 4;

/** A level-up costs as many points as the level being LEFT (CLAUDE.md), so a hero's first level-up costs 1. */
export function levelUpCost(level: number): number {
  return Math.max(1, level);
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

/** Level at which each move tier becomes offerable. Cumulative: reaching a tier adds it, never closes the tier below. Placeholder curve. */
export const MOVE_TIER_LEVEL: Record<MoveTier, number> = {
  early: 1,
  mid: 4,
  late: 7,
};

/** A move with no authored `tier` counts as Early (ungated). */
export function isMoveTierUnlocked(move: MoveDefinition | undefined, level: number): boolean {
  return level >= MOVE_TIER_LEVEL[move?.tier ?? 'early'];
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
 * What a level-up pays out, read off the POST-level-up entry. Precedence:
 * evolution > move > mastery. `mastery` below MASTERY_LEVEL means the move pool
 * came up empty — a data bug (the FLOOR should prevent it), not the gate working.
 */
export type LevelUpPayout = 'evolution' | 'move' | 'mastery';

export function levelUpPayout(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  entry: RosterEntry
): LevelUpPayout {
  if (availableEvolution(table, entry)) return 'evolution';
  if (entry.level > MASTERY_LEVEL) return 'mastery';
  return levelUpMovePool(table, moves, entry).length > 0 ? 'move' : 'mastery';
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

/** Starting kit plus everything the table can ever offer, deduped and NOT tier-gated — Quick Battle's random-loadout surface. */
export function fullMovepool(table: ProgressionTable, hero: HeroDefinition): string[] {
  return [...new Set([...hero.moveIds, ...(table.moveTiers[hero.id] ?? [])])];
}

/**
 * Table pool plus chosen paths' learnableMoveIds, minus unlocked, minus tiers
 * above `entry.level`. Pass the POST-level-up entry, or the level-up that
 * reaches 4 is still offered an Early-only pool.
 */
export function levelUpMovePool(
  table: ProgressionTable,
  moves: Record<string, MoveDefinition>,
  entry: RosterEntry
): string[] {
  const grafted = chosenEvolutionPaths(table, entry).flatMap((path) => path.learnableMoveIds ?? []);
  const pool = [...new Set([...(table.moveTiers[entry.heroId] ?? []), ...grafted])];
  return pool.filter((id) => !entry.unlockedMoveIds.includes(id) && isMoveTierUnlocked(moves[id], entry.level));
}

/** Spends levelUpCost(entry.level) and increments level. The move/Evolution payout is resolved separately by the caller. */
export function levelUpHero(run: RunState, rosterId: string): RunState {
  const entry = requireEntry(run, rosterId);
  const cost = levelUpCost(entry.level);
  if (run.levelUpPool < cost) throw new ProgressionError('Not enough training points');

  return replaceEntry(run, rosterId, { ...entry, level: entry.level + 1 }, cost);
}

/** Free — the point was spent by levelUpHero. Adds `moveId`, or swaps it in for `replaceMoveId` at the cap. */
export function grantLevelUpMove(run: RunState, rosterId: string, moveId: string, replaceMoveId?: string): RunState {
  const entry = requireEntry(run, rosterId);
  if (replaceMoveId && !entry.unlockedMoveIds.includes(replaceMoveId)) {
    throw new ProgressionError(`${replaceMoveId} is not currently unlocked on ${rosterId}`);
  }
  const unlockedMoveIds = replaceMoveId
    ? entry.unlockedMoveIds.map((id) => (id === replaceMoveId ? moveId : id))
    : [...entry.unlockedMoveIds, moveId];
  return replaceEntry(run, rosterId, { ...entry, unlockedMoveIds }, 0);
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
    evolutionStatGrants: mergeStatMods(entry.evolutionStatGrants, path.statGrants),
    evolutionPassiveGrants: [...new Set([...entry.evolutionPassiveGrants, ...(path.grantsPassiveIds ?? [])])],
    evolutionTypeGraft,
  };
  return replaceEntry(run, rosterId, nextEntry, 0);
}
