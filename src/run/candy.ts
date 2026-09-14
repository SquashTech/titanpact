// Candy: XP the player AIMS at one hero (docs/xp-overhaul.md §3). Encounter XP is roster-wide
// and automatic; a candy is the one place the player says who grows. Every source is a node that
// displaced another reward, so a candy is never free and never compounds — which is what keeps it
// from being the participation XP the growth overhaul rejected.
//
// Denominated in LEVELS-AT-PAR, not raw XP: a candy is the XP from par to par+N on the run's own
// curve, so it always crosses at least one level for any hero at or behind par — the behind gets
// more, since the same XP is worth more levels lower down the cube — and only a carry already
// ahead can ever see a partial. XP that lands no level-up is invisible, and a candy is a moment.

import type { HeroDefinition } from '../engine/content';
import type { MapNodeType } from './map';
import type { RosterEntry, RunState } from './state';
import { MAX_LEVEL, grantXp, levelAfterEncounters, levelForXp, levelOf, xpForLevel, type HeroLevelUp } from './growth';

export type CandyKind = 'candy' | 'small';

/** What each candy is worth, in levels at par. The Small is the commoner, smaller half of the same grant. */
export const CANDY_LEVELS: Record<CandyKind, number> = { candy: 2, small: 1 };

/** The two reward nodes that pay a candy — the old Scroll Cache's and Lone Scroll's seats, weight for weight. */
export const CANDY_NODE_KIND: Partial<Record<MapNodeType, CandyKind>> = {
  candyReward: 'candy',
  smallCandyReward: 'small',
};

export class CandyError extends Error {}

/** The run's par: the level the curve has paid a hero that never missed a win. */
export function parLevel(run: Pick<RunState, 'encountersWon'>): number {
  return levelAfterEncounters(run.encountersWon);
}

/**
 * The XP a candy of `kind` is worth right now: `CANDY_LEVELS` steps on the curve, starting at par
 * and ending no higher than the cap. Grows with the act because the cube does; a candy in Act 5
 * is the same two levels it was in Act 1, at that act's price.
 */
export function candyXp(run: Pick<RunState, 'encountersWon'>, kind: CandyKind): number {
  const levels = CANDY_LEVELS[kind];
  const from = Math.max(1, Math.min(parLevel(run), MAX_LEVEL - levels));
  return xpForLevel(from + levels) - xpForLevel(from);
}

/** A hero at the cap is refused rather than wasted — the one place the cap quietly pushes spread. */
export function canEatCandy(entry: Pick<RosterEntry, 'xp'>): boolean {
  return levelOf(entry) < MAX_LEVEL;
}

export function anyCandyEligible(roster: readonly RosterEntry[]): boolean {
  return roster.some(canEatCandy);
}

/** The level `entry` would stand on after a candy of `kind` — what the pick card promises. */
export function candyLevelAfter(run: Pick<RunState, 'encountersWon'>, entry: Pick<RosterEntry, 'xp'>, kind: CandyKind): number {
  return levelForXp(entry.xp + candyXp(run, kind));
}

/**
 * The candy, eaten: XP onto ONE hero, growth rolled per level crossed, and the same report row
 * the post-fight screen reads — the level-up report is where a candy pays out, same screen,
 * same rows.
 */
export function grantCandy(
  run: RunState,
  heroes: Record<string, HeroDefinition>,
  rosterId: string,
  kind: CandyKind,
  random: () => number = Math.random
): { run: RunState; report: HeroLevelUp } {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new CandyError(`${rosterId} is not on the roster`);
  if (!canEatCandy(entry)) throw new CandyError(`${rosterId} is already at level ${MAX_LEVEL}`);
  const { entry: fed, gained } = grantXp(entry, heroes[entry.heroId], candyXp(run, kind), random);
  const report: HeroLevelUp = {
    rosterId,
    heroId: entry.heroId,
    fromLevel: levelOf(entry),
    toLevel: levelOf(fed),
    gained,
  };
  return { run: { ...run, roster: run.roster.map((r) => (r.rosterId === rosterId ? fed : r)) }, report };
}

/** Whether the Guild Hall shelf will sell another Small right now: gold, the visit's limit, and somebody to eat it. */
export function canBuyCandy(run: RunState, cost: number, bought: number, limit: number): boolean {
  return bought < limit && run.gold >= cost && anyCandyEligible(run.roster);
}

/** The shelf's charge — the candy itself lands through grantCandy once the player has said who. */
export function buyCandy(run: RunState, cost: number, bought: number, limit: number): RunState {
  if (bought >= limit) throw new CandyError(`the shelf sells ${limit} a visit`);
  if (run.gold < cost) throw new CandyError(`need ${cost} gold, have ${run.gold}`);
  if (!anyCandyEligible(run.roster)) throw new CandyError(`every hero is already at level ${MAX_LEVEL}`);
  return { ...run, gold: run.gold - cost };
}
