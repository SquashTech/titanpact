// The pooled level-up currency (docs/progression.md "The level-up currency
// (pooled, freely distributed)"; docs/leveling-and-ranks.md is the
// authoritative spec for the mechanic below — this module implements it).
// Each Training Point spent on a hero does exactly one thing — level them up
// — and a level-up always does two things as a consequence: it moves the
// hero one step closer to (and eventually triggers) a rank-up, and it offers
// a random move from the hero's remaining pool. There is no separate
// "invest toward rank-up" spend and no per-move gold-style cost anymore —
// that older two-independent-spends model is what this file replaces
// (docs/leveling-and-ranks.md flagged the rewrite; CLAUDE.md "Each Training
// Point levels up a hero..." is the signed-off design). Concrete pool/branch
// CONTENT (which moves, which thresholds, which stat grants) is fixture data
// in src/data/progression.ts, authored for a subset of the roster only — see
// the SCOPE NOTE there. This module only implements the generic mechanism.

import type { StatKey, TypeId } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import type { RosterEntry, RunState } from './state';
import { mergeStatMods } from './statMods';

/** A hero holds at most 4 moves (docs/leveling-and-ranks.md "The four-move cap"). Past the cap, growth is substitution, never expansion. */
export const MOVE_CAP = 4;

export interface RankUpBranch {
  id: string;
  heroId: string;
  /**
   * Branches "differ in kind, not degree" (docs/progression.md) — this label
   * is documentation of that intent, not a mechanical multiplier or type.
   */
  kind: 'defensive' | 'offensive' | 'utility';
  name: string;
  statGrants: Partial<Record<StatKey, number>>;
  unlocksMoveIds: string[];
  /**
   * Optional secondary-type grant/shift (docs/progression.md "Type-graft
   * branches"). Only legal when the hero is mono-type by design — enforced in
   * chooseRankUpBranch, not just by authoring convention. A later branch's
   * typeGraft overwrites (shifts) any earlier one; it's not additive.
   */
  typeGraft?: TypeId;
}

export interface RankUpNode {
  /** rankProgress threshold at which this branch choice becomes available. */
  threshold: number;
  branches: RankUpBranch[];
}

export interface ProgressionTable {
  /** heroId -> pool of moves that can be randomly offered on level-up, beyond the hero's starting kit. */
  moveTiers: Record<string, string[]>;
  /** heroId -> ordered rank-up nodes (docs/progression.md "Rank-ups (LOCKED rules)"). */
  rankUps: Record<string, RankUpNode[]>;
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
 * Spends one pooled Training Point leveling up a hero (docs/leveling-and-ranks.md,
 * CLAUDE.md "Each Training Point levels up a hero"): increments level and
 * rank-up progress by one. Does not touch the movepool itself — the caller
 * resolves the random move offer (rolling from levelUpMovePool, and asking
 * the player to accept a replacement or decline if the hero is already at
 * MOVE_CAP) and applies it separately via grantLevelUpMove, since that's a
 * player decision rather than a mechanical consequence of spending the point.
 */
export function levelUpHero(run: RunState, rosterId: string): RunState {
  const entry = requireEntry(run, rosterId);
  if (run.levelUpPool < 1) throw new ProgressionError('Not enough training points');

  return replaceEntry(run, rosterId, { ...entry, level: entry.level + 1, rankProgress: entry.rankProgress + 1 }, 1);
}

/**
 * Applies a level-up's move offer to a roster entry: adds `moveId` outright
 * if there's room under MOVE_CAP, or swaps it in for `replaceMoveId` if the
 * hero is already at the cap and the player accepted the replacement. Free —
 * the point was already spent via levelUpHero; this only resolves what that
 * level-up's move offer turned into (accept, swap, or the caller simply never
 * calls this at all if the player declined).
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

/** The rank-up branch choice currently on offer for a roster entry, or null if none is available yet (or all nodes are already chosen). */
export function availableRankUp(table: ProgressionTable, entry: RosterEntry): RankUpNode | null {
  const nodes = table.rankUps[entry.heroId] ?? [];
  const node = nodes[entry.chosenBranchIds.length];
  if (!node) return null;
  return entry.rankProgress >= node.threshold ? node : null;
}

/**
 * Applies a chosen rank-up branch: grants permanent stats (validated as
 * multiples of 5/10, CLAUDE.md "Stat modifiers are flat additive integers,
 * multiples of 5 or 10"), unlocks its moves, and grafts/shifts the secondary
 * type slot if the branch carries a typeGraft (docs/progression.md
 * "Type-graft branches") — a later graft overwrites an earlier one rather
 * than stacking. Free — spending the points to reach the threshold already
 * cost the pool via investRankProgress; choosing the branch itself is not a
 * second charge. Requires the hero lookup solely to validate a type-graft
 * against the hero's innate types, which are never themselves modified.
 */
export function chooseRankUpBranch(
  run: RunState,
  table: ProgressionTable,
  heroes: HeroLookup,
  rosterId: string,
  branchId: string
): RunState {
  const entry = requireEntry(run, rosterId);
  const node = availableRankUp(table, entry);
  if (!node) throw new ProgressionError(`No rank-up branch is currently available for ${rosterId}`);
  const branch = node.branches.find((b) => b.id === branchId);
  if (!branch) throw new ProgressionError(`${branchId} is not one of the offered branches`);
  for (const amount of Object.values(branch.statGrants)) {
    if (amount !== undefined && !isValidFlatStatGrant(amount)) {
      throw new ProgressionError(`Rank-up stat grant ${amount} must be a multiple of 5 or 10`);
    }
  }

  let rankTypeGraft = entry.rankTypeGraft;
  if (branch.typeGraft) {
    const hero = heroes[entry.heroId];
    if (!hero) throw new ProgressionError(`Unknown hero ${entry.heroId}`);
    if (hero.types.length !== 1) {
      throw new ProgressionError(`${entry.heroId} is already dual-typed — a type-graft branch cannot be offered`);
    }
    if (hero.types.includes(branch.typeGraft)) {
      throw new ProgressionError(`Type-graft ${branch.typeGraft} duplicates ${entry.heroId}'s innate type`);
    }
    // A later graft branch SHIFTS the secondary type slot rather than stacking
    // a third type (docs/progression.md "Type-graft branches", 2026-08-15): it
    // simply overwrites whatever was grafted before, if anything.
    rankTypeGraft = branch.typeGraft;
  }

  const nextEntry: RosterEntry = {
    ...entry,
    chosenBranchIds: [...entry.chosenBranchIds, branch.id],
    unlockedMoveIds: [...new Set([...entry.unlockedMoveIds, ...branch.unlocksMoveIds])],
    rankStatGrants: mergeStatMods(entry.rankStatGrants, branch.statGrants),
    rankTypeGraft,
  };
  return replaceEntry(run, rosterId, nextEntry, 0);
}
