// Ichor — what leaks from the Titan, drunk by one hero: XP the player AIMS (docs/xp-overhaul.md
// §3; drafted there as Pokémon's EXP Candy and renamed 2026-09-13 per user direction). Encounter
// XP is roster-wide and automatic; an Ichor is the one place the player says who grows. Every
// source is a node that displaced another reward, so an Ichor is never free and never compounds —
// which is what keeps it from being the participation XP the growth overhaul rejected.
//
// Priced in FIGHTS (2026-09-14, per user direction): an Ichor is `ICHOR_FIGHTS[kind]` times the
// act's base encounter XP, the same figure the player just watched a Skirmish pay and the same
// bar it moved. It was denominated in levels-at-par — the XP from par to par+2 on the curve — a
// second currency read off a par the player never saw, built for a world where XP was invisible
// and a grant had to land a level to exist at all. Sized to what two levels at par cost at each
// act's END (≈2.5 fights in every act since 2026-09-14, when an act went to three fights and the
// base fight grew ×1.25 to pay for it; ≈3 before); flat within the act where the old figure grew
// with par, so early in an act it is up to a level richer than it was — the direction
// docs/xp-overhaul.md §10's "worth its seat" question leans. A partial bar is a real outcome now,
// so nothing promises a level.

import type { HeroDefinition } from '../engine/content';
import type { MapNodeType } from './map';
import type { RosterEntry, RunState } from './state';
import { MAX_LEVEL, encounterXpForAct, grantXp, levelForXp, levelOf, type HeroLevelUp } from './growth';

export type IchorKind = 'ichor' | 'drop';

/** What each Ichor is worth, in the act's ordinary fights. The Drop is the commoner, smaller half of the same grant. */
export const ICHOR_FIGHTS: Record<IchorKind, number> = { ichor: 2.5, drop: 1.25 };

/** The two reward nodes that pay an Ichor — the old Scroll Cache's and Lone Scroll's seats, weight for weight. */
export const ICHOR_NODE_KIND: Partial<Record<MapNodeType, IchorKind>> = {
  ichorReward: 'ichor',
  ichorDropReward: 'drop',
};

export class IchorError extends Error {}

/** The XP an Ichor of `kind` pays in `actNumber` — `ICHOR_FIGHTS` of that act's base fight. Grows with the act because the fights do. */
export function ichorXpForAct(actNumber: number, kind: IchorKind): number {
  return Math.round(ICHOR_FIGHTS[kind] * encounterXpForAct(actNumber));
}

/** The XP an Ichor of `kind` is worth right now. */
export function ichorXp(run: Pick<RunState, 'actNumber'>, kind: IchorKind): number {
  return ichorXpForAct(run.actNumber, kind);
}

/** A hero at the cap is refused rather than wasted — the one place the cap quietly pushes spread. */
export function canDrinkIchor(entry: Pick<RosterEntry, 'xp'>): boolean {
  return levelOf(entry) < MAX_LEVEL;
}

export function anyIchorEligible(roster: readonly RosterEntry[]): boolean {
  return roster.some(canDrinkIchor);
}

/** The level `entry` would stand on after an Ichor of `kind` — what the pick card promises. */
export function ichorLevelAfter(run: Pick<RunState, 'actNumber'>, entry: Pick<RosterEntry, 'xp'>, kind: IchorKind): number {
  return levelForXp(entry.xp + ichorXp(run, kind));
}

/**
 * The Ichor, eaten: XP onto ONE hero, growth rolled per level crossed, and the same report row
 * the post-fight screen reads — the level-up report is where an Ichor pays out, same screen,
 * same rows, same bar.
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

/** Whether the Guild Hall shelf will sell another Drop right now: gold, the visit's limit, and somebody to eat it. */
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
