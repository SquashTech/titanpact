// Gems (docs/run-loop.md "Gems"). Two halves: the income above — when a Gem is handed out and
// which ones an offer holds — and the per-hero allocation model below, which owns the caps and
// is the only thing that may write gemsEarned or gemAllocation.

import type { StatKey } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import { GEM_HP_GRANT, GEM_STAT_GRANT, gemRelics } from '../data/relics';
import type { XpNodeType } from './difficulty';
import type { RosterEntry, RunState } from './state';

/** A Gem offer is a 1-of-3; the Guardian's Banner is the same shape at 1-of-5. */
export const GEM_OFFER_COUNT = 3;

/**
 * Chance a won fight ALSO pays a Gem offer, by map node type. Every figure is a first-pass
 * placeholder for playtest; only the shape is decided — a Gem is the drip-feed that smooths the
 * player's power curve between the sparse Banner and Shrine grants, so a fight pays one often
 * enough to plan around and rarely enough that a run's Gem spread still differs.
 *
 * The Guardian pays none: it already pays a Banner, and stacking a Gem on top would blur which
 * grant the act-boundary spike came from. The finale ends the run.
 */
export const GEM_DROP_CHANCE: Record<XpNodeType, number> = {
  fight: 0.3,
  battle: 0.35,
  skirmish: 0.35,
  elite: 0.5,
  boss: 0,
  finale: 0,
};

/** The Act 1 opener always pays: the run's first Gem teaches the system rather than rolling for it. */
export function gemDropChanceFor(nodeType: XpNodeType, isRunOpener: boolean): number {
  return isRunOpener ? 1 : GEM_DROP_CHANCE[nodeType];
}

/** `count` distinct Gems, in random order. Ownership is never filtered — Gems are designed to stack. */
export function pickGemOffers(count: number = GEM_OFFER_COUNT, random: () => number = Math.random): string[] {
  const remaining = gemRelics.map((gem) => gem.id);
  const picked: string[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    picked.push(remaining.splice(Math.floor(random() * remaining.length), 1)[0]);
  }
  return picked;
}

/** `[]` when the roll fails; otherwise the ids the post-fight Gem screen offers. */
export function rollGemOffers(nodeType: XpNodeType, isRunOpener: boolean, random: () => number = Math.random): string[] {
  return random() < gemDropChanceFor(nodeType, isRunOpener) ? pickGemOffers(GEM_OFFER_COUNT, random) : [];
}

// --- The per-hero allocation model (docs/run-loop.md "Gems") ---

/**
 * The stats a Gem exists for: every stat but MP Regen. The exclusion is inherited from the
 * team-wide era and is worth re-asking now that a Gem is per-hero and competes against a cap
 * (docs/run-loop.md "Gems") — this list is the whole change if it comes back.
 */
export const GEM_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool'];

const GEM_STAT_SET: ReadonlySet<StatKey> = new Set(GEM_STATS);

export function isGemStat(stat: StatKey): boolean {
  return GEM_STAT_SET.has(stat);
}

/** One Gem's grant. HP is twice the figure because it is authored in the units the HP bar draws. */
export function gemGrant(stat: StatKey): number {
  return stat === 'hp' ? GEM_HP_GRANT : GEM_STAT_GRANT;
}

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

/** The hero's socketed Gems as stat deltas — the shape entryStatModifiers folds in. */
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
  return { ...run, gemsEarned: { ...run.gemsEarned, [stat]: (run.gemsEarned[stat] ?? 0) + count } };
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

/** Every Gem off one hero in a single call — what makes swapping a hero out cheap enough to actually do. */
export function pullGems(run: RunState, rosterId: string): RunState {
  return withEntry(run, rosterId, (entry) => ({ ...entry, gemAllocation: {} }));
}
