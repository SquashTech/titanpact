// Ichor — what leaks from the Titan, drunk by one hero: XP the player AIMS (docs/xp-overhaul.md
// §3; drafted there as Pokémon's EXP Candy and renamed 2026-09-13 per user direction). Encounter
// XP is roster-wide and automatic; an Ichor is the one place the player says who grows. Every source is a node that
// displaced another reward, so an Ichor is never free and never compounds — which is what keeps it
// from being the participation XP the growth overhaul rejected.
//
// Denominated in LEVELS-AT-PAR, not raw XP: an Ichor is the XP from par to par+N on the run's own
// curve, so it always crosses at least one level for any hero at or behind par — the behind gets
// more, since the same XP is worth more levels lower down the cube — and only a carry already
// ahead can ever see a partial. XP that lands no level-up is invisible, and an Ichor is a moment.

import type { HeroDefinition } from '../engine/content';
import type { MapNodeType } from './map';
import type { RosterEntry, RunState } from './state';
import { MAX_LEVEL, grantXp, levelAfterEncounters, levelForXp, levelOf, xpForLevel, type HeroLevelUp } from './growth';

export type IchorKind = 'ichor' | 'drop';

/** What each Ichor is worth, in levels at par. The Small is the commoner, smaller half of the same grant. */
export const ICHOR_LEVELS: Record<IchorKind, number> = { ichor: 2, drop: 1 };

/** The two reward nodes that pay an Ichor — the old Scroll Cache's and Lone Scroll's seats, weight for weight. */
export const ICHOR_NODE_KIND: Partial<Record<MapNodeType, IchorKind>> = {
  ichorReward: 'ichor',
  ichorDropReward: 'drop',
};

export class IchorError extends Error {}

/** The run's par: the level the curve has paid a hero that never missed a win. */
export function parLevel(run: Pick<RunState, 'encountersWon'>): number {
  return levelAfterEncounters(run.encountersWon);
}

/**
 * The XP an Ichor of `kind` is worth right now: `ICHOR_LEVELS` steps on the curve, starting at par
 * and ending no higher than the cap. Grows with the act because the cube does; an Ichor in Act 5
 * is the same two levels it was in Act 1, at that act's price.
 */
export function ichorXp(run: Pick<RunState, 'encountersWon'>, kind: IchorKind): number {
  const levels = ICHOR_LEVELS[kind];
  const from = Math.max(1, Math.min(parLevel(run), MAX_LEVEL - levels));
  return xpForLevel(from + levels) - xpForLevel(from);
}

/** A hero at the cap is refused rather than wasted — the one place the cap quietly pushes spread. */
export function canDrinkIchor(entry: Pick<RosterEntry, 'xp'>): boolean {
  return levelOf(entry) < MAX_LEVEL;
}

export function anyIchorEligible(roster: readonly RosterEntry[]): boolean {
  return roster.some(canDrinkIchor);
}

/** The level `entry` would stand on after an Ichor of `kind` — what the pick card promises. */
export function ichorLevelAfter(run: Pick<RunState, 'encountersWon'>, entry: Pick<RosterEntry, 'xp'>, kind: IchorKind): number {
  return levelForXp(entry.xp + ichorXp(run, kind));
}

/**
 * The Ichor, eaten: XP onto ONE hero, growth rolled per level crossed, and the same report row
 * the post-fight screen reads — the level-up report is where an Ichor pays out, same screen,
 * same rows.
 */
export function grantIchor(
  run: RunState,
  heroes: Record<string, HeroDefinition>,
  rosterId: string,
  kind: IchorKind,
  random: () => number = Math.random
): { run: RunState; report: HeroLevelUp } {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new IchorError(`${rosterId} is not on the roster`);
  if (!canDrinkIchor(entry)) throw new IchorError(`${rosterId} is already at level ${MAX_LEVEL}`);
  const { entry: fed, gained } = grantXp(entry, heroes[entry.heroId], ichorXp(run, kind), random);
  const report: HeroLevelUp = {
    rosterId,
    heroId: entry.heroId,
    fromLevel: levelOf(entry),
    toLevel: levelOf(fed),
    fromXp: entry.xp,
    toXp: fed.xp,
    gained,
  };
  return { run: { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? fed : r)) }, report };
}

/** Whether the Guild Hall shelf will sell another Small right now: gold, the visit's limit, and somebody to eat it. */
export function canBuyIchor(run: RunState, cost: number, bought: number, limit: number): boolean {
  return bought < limit && run.gold >= cost && anyIchorEligible(run.roster);
}

/** The shelf's charge — the Ichor itself lands through grantIchor once the player has said who. */
export function buyIchor(run: RunState, cost: number, bought: number, limit: number): RunState {
  if (bought >= limit) throw new IchorError(`the shelf sells ${limit} a visit`);
  if (run.gold < cost) throw new IchorError(`need ${cost} gold, have ${run.gold}`);
  if (!anyIchorEligible(run.roster)) throw new IchorError(`every hero is already at level ${MAX_LEVEL}`);
  return { ...run, gold: run.gold - cost };
}
