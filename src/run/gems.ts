// Gems (docs/run-loop.md "Gems"). Per-hero stat investment: a run pays them out UNPLACED, and
// the player pours them into whichever heroes they want, against two caps. This file owns the
// income and the caps; the catalog — names, colours, what one is worth — is src/data/gems.ts.

import type { StatKey } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import { gemForStat, gemList } from '../data/gems';
import type { XpNodeType } from './difficulty';
import type { RosterEntry, RunState } from './state';

// --- The catalog, as the run layer reads it ---

/** The stats a Gem exists for, in STAT_ORDER: every stat but MP Regen (src/data/gems.ts). */
export const GEM_STATS: readonly StatKey[] = gemList.map((gem) => gem.stat);

const GEM_STAT_SET: ReadonlySet<StatKey> = new Set(GEM_STATS);

export function isGemStat(stat: StatKey): boolean {
  return GEM_STAT_SET.has(stat);
}

/** What one Gem of `stat` is worth, socketed. */
export function gemGrant(stat: StatKey): number {
  return gemForStat[stat]?.grant ?? 0;
}

// --- Income ---

/** An offer is a 1-of-3, whatever its size. The Guardian's Banner is the same beat at 1-of-5. */
export const GEM_OFFER_COUNT = 3;

/**
 * Gems a won encounter pays, by map node type. Every figure is a first-pass placeholder for
 * playtest; only the shape is decided.
 *
 * Every win pays, where the team-wide era rolled a 30-50% chance. The roll was there to keep two
 * runs from holding the same Gems, and the player choosing the stat does that job better — so a
 * fight paying nothing would now just be a fight that skipped its reward.
 *
 * The Guardian pays none: it already pays a Banner, and a Gem on top would blur which grant the
 * act-boundary spike came from. The finale pays none because the run ends on it.
 */
export const GEM_FIGHT_STACK: Record<XpNodeType, number> = {
  fight: 2,
  battle: 2,
  skirmish: 2,
  elite: 3,
  boss: 0,
  finale: 0,
};

/**
 * What the Gem Cache and the Mana Well hand over. Bigger than a fight's stack because a whole map
 * node bought it — the node is where a run commits to a stat rather than collects one.
 */
export const GEM_NODE_STACK = 4;

export function gemStackFor(nodeType: XpNodeType): number {
  return GEM_FIGHT_STACK[nodeType] ?? 0;
}

/** `count` distinct stats, in random order — what an offer puts in front of the player. */
export function pickGemOffers(count: number = GEM_OFFER_COUNT, random: () => number = Math.random): StatKey[] {
  const remaining = [...GEM_STATS];
  const picked: StatKey[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    picked.push(remaining.splice(Math.floor(random() * remaining.length), 1)[0]);
  }
  return picked;
}

// --- The per-hero allocation model ---

/** Gems one hero can hold across every stat at once. */
export const GEM_CAP_PER_HERO = 20;

/** Gems one hero can hold in a SINGLE stat. 20/8 is what forces at least three stats to fill a hero. */
export const GEM_CAP_PER_STAT = 8;

export class GemError extends Error {}

/**
 * The one place a hero's Gem capacity is decided (the same rule as itemSlotsFor). Flat on
 * purpose: the cap's job is limiting concentration, and a cap that grew with level would grow
 * with the thing players concentrate.
 */
export function gemCapacityFor(_entry: RosterEntry): number {
  return GEM_CAP_PER_HERO;
}

export function gemsOn(entry: RosterEntry, stat: StatKey): number {
  return entry.gemAllocation[stat] ?? 0;
}

export function gemsHeldBy(entry: RosterEntry): number {
  return GEM_STATS.reduce((total, stat) => total + gemsOn(entry, stat), 0);
}

/** Gems of `stat` this hero can still take, before the pool is consulted. Both caps, whichever binds first. */
export function gemHeadroom(entry: RosterEntry, stat: StatKey): number {
  if (!isGemStat(stat)) return 0;
  return Math.max(0, Math.min(GEM_CAP_PER_STAT - gemsOn(entry, stat), gemCapacityFor(entry) - gemsHeldBy(entry)));
}

/** The hero's socketed Gems as flat stats — the shape entryStatModifiers folds in. */
export function gemStatModifiers(entry: RosterEntry): StatModifiers {
  const out: StatModifiers = {};
  for (const stat of GEM_STATS) {
    const count = gemsOn(entry, stat);
    if (count) out[stat] = count * gemGrant(stat);
  }
  return out;
}

/** Gems of `stat` the roster currently holds, benched heroes included. */
export function gemsAllocated(run: RunState, stat: StatKey): number {
  return run.roster.reduce((total, entry) => total + gemsOn(entry, stat), 0);
}

/** Derived, never stored: earned minus placed. Non-zero stats only. */
export function gemPool(run: RunState): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  for (const stat of GEM_STATS) {
    const spare = (run.gemsEarned[stat] ?? 0) - gemsAllocated(run, stat);
    if (spare) out[stat] = spare;
  }
  return out;
}

/** Unspent Gems across every stat — the map's badge figure. */
export function gemPoolTotal(run: RunState): number {
  return GEM_STATS.reduce((total, stat) => total + Math.max(0, (run.gemsEarned[stat] ?? 0) - gemsAllocated(run, stat)), 0);
}

function requireGemStat(stat: StatKey): void {
  if (!isGemStat(stat)) throw new GemError(`no Gem carries ${stat}`);
}

function requireCount(count: number): void {
  if (!Number.isInteger(count) || count < 1) throw new GemError(`${count} is not a Gem count`);
}

function withEntry(run: RunState, rosterId: string, next: (entry: RosterEntry) => RosterEntry): RunState {
  const at = run.roster.findIndex((entry) => entry.rosterId === rosterId);
  if (at < 0) throw new GemError(`no roster entry "${rosterId}"`);
  const roster = [...run.roster];
  roster[at] = next(roster[at]);
  return { ...run, roster };
}

/** Income. Lands in the pool unplaced — a Gem is never granted straight onto a hero. */
export function grantGems(run: RunState, stat: StatKey, count: number = 1): RunState {
  requireGemStat(stat);
  requireCount(count);
  return {
    ...run,
    gemsEarned: { ...run.gemsEarned, [stat]: (run.gemsEarned[stat] ?? 0) + count },
    gemsUnseen: run.gemsUnseen + count,
  };
}

export function socketGems(run: RunState, rosterId: string, stat: StatKey, count: number = 1): RunState {
  requireGemStat(stat);
  requireCount(count);
  const spare = gemPool(run)[stat] ?? 0;
  if (count > spare) throw new GemError(`the pool holds ${spare} ${stat} Gems, not ${count}`);
  return withEntry(run, rosterId, (entry) => {
    const headroom = gemHeadroom(entry, stat);
    if (count > headroom) throw new GemError(`${entry.rosterId} has room for ${headroom} more ${stat} Gems, not ${count}`);
    return { ...entry, gemAllocation: { ...entry.gemAllocation, [stat]: gemsOn(entry, stat) + count } };
  });
}

export function unsocketGems(run: RunState, rosterId: string, stat: StatKey, count: number = 1): RunState {
  requireGemStat(stat);
  requireCount(count);
  return withEntry(run, rosterId, (entry) => {
    const held = gemsOn(entry, stat);
    if (count > held) throw new GemError(`${entry.rosterId} holds ${held} ${stat} Gems, not ${count}`);
    return { ...entry, gemAllocation: { ...entry.gemAllocation, [stat]: held - count } };
  });
}

/** Opening the Gems board is looking at all of them; there is nothing finer to mark. */
export function markGemsSeen(run: RunState): RunState {
  return run.gemsUnseen === 0 ? run : { ...run, gemsUnseen: 0 };
}

/** Every Gem off one hero in a single call — what makes swapping a hero out cheap enough to actually do. */
export function pullGems(run: RunState, rosterId: string): RunState {
  return withEntry(run, rosterId, (entry) => ({ ...entry, gemAllocation: {} }));
}
