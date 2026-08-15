// The pooled level-up currency (docs/progression.md "The level-up currency
// (pooled, freely distributed)"). Spending a point does exactly one of two
// things — CLAUDE.md: "They do exactly two things: progress a hero toward a
// rank-up, and unlock moves from the current tier. They never directly raise
// stats" — modeled here as two distinct spend functions. Concrete tier/branch
// CONTENT (which moves, which thresholds, which stat grants) is fixture data
// in src/data/progression.ts, authored for a subset of the roster only — see
// the SCOPE NOTE there. This module only implements the generic mechanism.

import type { StatKey, TypeId } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import type { RosterEntry, RunState } from './state';
import { mergeStatMods } from './statMods';

export interface MoveTier {
  moveId: string;
  cost: number;
}

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
  /** heroId -> tiered moves purchasable beyond the hero's starting kit. */
  moveTiers: Record<string, MoveTier[]>;
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

/** Spends pooled points to unlock a specific tiered move for a roster entry. */
export function unlockTierMove(run: RunState, table: ProgressionTable, rosterId: string, moveId: string): RunState {
  const entry = requireEntry(run, rosterId);
  const tier = table.moveTiers[entry.heroId] ?? [];
  const node = tier.find((t) => t.moveId === moveId);
  if (!node) throw new ProgressionError(`${moveId} is not a tiered move for ${entry.heroId}`);
  if (entry.unlockedMoveIds.includes(moveId)) throw new ProgressionError(`${moveId} is already unlocked`);
  if (run.levelUpPool < node.cost) throw new ProgressionError('Not enough level-up points');

  return replaceEntry(run, rosterId, { ...entry, unlockedMoveIds: [...entry.unlockedMoveIds, moveId] }, node.cost);
}

/** Spends pooled points advancing a roster entry's progress toward its next rank-up. */
export function investRankProgress(run: RunState, rosterId: string, points: number): RunState {
  if (!Number.isInteger(points) || points <= 0) throw new ProgressionError('points must be a positive integer');
  const entry = requireEntry(run, rosterId);
  if (run.levelUpPool < points) throw new ProgressionError('Not enough level-up points');

  return replaceEntry(run, rosterId, { ...entry, rankProgress: entry.rankProgress + points }, points);
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
