// The pooled level-up currency (docs/progression.md "The level-up currency
// (pooled, freely distributed)"; docs/leveling-and-ranks.md is the
// authoritative spec for the mechanic below — this module implements it).
// Each Training Point spent on a hero does exactly one thing — level them up
// — and a level-up always does one of two things as a consequence: below
// EVOLUTION_LEVEL it offers a random move from the hero's remaining pool;
// AT EVOLUTION_LEVEL it instead surfaces the hero's Evolution — no move is
// rolled that level-up (docs/leveling-and-ranks.md "Evolution replaces that
// level-up's move offer"). Concrete pool/path CONTENT (which moves, which
// paths, which stat grants) is fixture data in src/data/progression.ts,
// authored for a subset of the roster only — see the SCOPE NOTE there. This
// module only implements the generic mechanism.

import type { StatKey, TypeId } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import type { RosterEntry, RunState } from './state';
import { mergeStatMods } from './statMods';

/** A hero holds at most 4 moves (docs/leveling-and-ranks.md "The four-move cap"). Past the cap, growth is substitution, never expansion. */
export const MOVE_CAP = 4;

/**
 * The flat, uniform hero level at which every hero's (single, for now)
 * Evolution becomes available (docs/leveling-and-ranks.md "Trigger").
 * CLAUDE.md's variable evolution depth (Capstone = 0, Single = 1, Deep line
 * = 2+) is the eventual per-hero-authored design; this constant is the
 * current scoped-down implementation of the "Single" shape applied
 * uniformly across the whole roster. A per-hero-authored trigger level (and
 * multiple ordered Evolutions for deep-line heroes) is deferred, not
 * abandoned — see leveling-and-ranks.md's scope note.
 */
export const EVOLUTION_LEVEL = 5;

export interface EvolutionPath {
  id: string;
  heroId: string;
  /**
   * Paths "differ in kind, not degree" (docs/progression.md) — this label
   * is documentation of that intent, not a mechanical multiplier or type.
   */
  kind: 'defensive' | 'offensive' | 'utility';
  /** Single identifiable name (docs/leveling-and-ranks.md), e.g. "Explosive", "Ironclad", "Thunderblaze". */
  name: string;
  statGrants: Partial<Record<StatKey, number>>;
  unlocksMoveIds: string[];
  /**
   * Optional secondary-type grant/shift (docs/progression.md "Type-graft
   * paths"). Only legal when the hero is mono-type by design — enforced in
   * chooseEvolutionPath, not just by authoring convention. A later path's
   * typeGraft overwrites (shifts) any earlier one; it's not additive.
   */
  typeGraft?: TypeId;
}

export interface EvolutionNode {
  /** Hero level at which this path choice becomes available. Currently always EVOLUTION_LEVEL for every hero. */
  level: number;
  /** Exactly three paths, differing in kind (CLAUDE.md "the player is presented with a choice of three options"). */
  paths: EvolutionPath[];
}

export interface ProgressionTable {
  /** heroId -> pool of moves that can be randomly offered on level-up, beyond the hero's starting kit. */
  moveTiers: Record<string, string[]>;
  /** heroId -> ordered Evolution nodes (docs/leveling-and-ranks.md Part 2). Currently exactly one node per hero, at EVOLUTION_LEVEL. */
  evolutions: Record<string, EvolutionNode[]>;
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

/** The moves still available to offer this hero on level-up: the table's pool minus whatever's already unlocked. */
export function levelUpMovePool(table: ProgressionTable, entry: RosterEntry): string[] {
  const pool = table.moveTiers[entry.heroId] ?? [];
  return pool.filter((id) => !entry.unlockedMoveIds.includes(id));
}

/**
 * Spends one pooled Training Point leveling up a hero
 * (docs/leveling-and-ranks.md, CLAUDE.md "Each Training Point levels up a
 * hero"): increments level by one. Does not touch the movepool itself — the
 * caller checks availableEvolution() against the new level first: if an
 * Evolution just became available, no move is rolled this level-up at all
 * (grantLevelUpMove is simply never called); otherwise the caller resolves
 * the random move offer (rolling from levelUpMovePool, and asking the
 * player to accept a replacement or decline if the hero is already at
 * MOVE_CAP) and applies it separately via grantLevelUpMove, since that's a
 * player decision rather than a mechanical consequence of spending the point.
 */
export function levelUpHero(run: RunState, rosterId: string): RunState {
  const entry = requireEntry(run, rosterId);
  if (run.levelUpPool < 1) throw new ProgressionError('Not enough training points');

  return replaceEntry(run, rosterId, { ...entry, level: entry.level + 1 }, 1);
}

/**
 * Applies a level-up's move offer to a roster entry: adds `moveId` outright
 * if there's room under MOVE_CAP, or swaps it in for `replaceMoveId` if the
 * hero is already at the cap and the player accepted the replacement. Free —
 * the point was already spent via levelUpHero; this only resolves what that
 * level-up's move offer turned into (accept, swap, or the caller simply never
 * calls this at all if the player declined, or if the level-up triggered an
 * Evolution instead of a move offer).
 */
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

/** The Evolution node currently on offer for a roster entry, or null if none is available yet (or it's already been chosen). */
export function availableEvolution(table: ProgressionTable, entry: RosterEntry): EvolutionNode | null {
  const nodes = table.evolutions[entry.heroId] ?? [];
  const node = nodes[entry.chosenPathIds.length];
  if (!node) return null;
  return entry.level >= node.level ? node : null;
}

/**
 * Applies a chosen Evolution path: grants permanent stats (validated as
 * multiples of 5/10, CLAUDE.md "Stat modifiers are flat additive integers,
 * multiples of 5 or 10"), unlocks its moves, and grafts/shifts the secondary
 * type slot if the path carries a typeGraft (docs/progression.md
 * "Type-graft paths") — a later graft overwrites an earlier one rather than
 * stacking. Free — spending the points to reach the trigger level already
 * cost the pool; choosing the path itself is not a second charge. Requires
 * the hero lookup solely to validate a type-graft against the hero's innate
 * types, which are never themselves modified.
 */
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
    if (hero.types.length !== 1) {
      throw new ProgressionError(`${entry.heroId} is already dual-typed — a type-graft path cannot be offered`);
    }
    if (hero.types.includes(path.typeGraft)) {
      throw new ProgressionError(`Type-graft ${path.typeGraft} duplicates ${entry.heroId}'s innate type`);
    }
    // A later graft path SHIFTS the secondary type slot rather than stacking
    // a third type (docs/progression.md "Type-graft paths", 2026-08-15): it
    // simply overwrites whatever was grafted before, if anything.
    evolutionTypeGraft = path.typeGraft;
  }

  const nextEntry: RosterEntry = {
    ...entry,
    chosenPathIds: [...entry.chosenPathIds, path.id],
    unlockedMoveIds: [...new Set([...entry.unlockedMoveIds, ...path.unlocksMoveIds])],
    evolutionStatGrants: mergeStatMods(entry.evolutionStatGrants, path.statGrants),
    evolutionTypeGraft,
  };
  return replaceEntry(run, rosterId, nextEntry, 0);
}
