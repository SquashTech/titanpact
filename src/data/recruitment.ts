// Guild Hall offer pool: every `starter: false` hero at a flat, untuned cost. Derived from
// heroes.ts so the draft pool and the Guild Hall pool can never drift apart.

import type { GuildHallOffer } from '../run/recruitment';
import { heroes } from './heroes';

/** Gold cost of a blank Recruit Contract at a Guild Hall. */
export const CONTRACT_PURCHASE_COST = 20;

/**
 * A Drop of Ichor off the Guild Hall shelf — one level at par for one hero (run/ichor.ts), where
 * the shelf sold a Scroll bundle until the XP Overhaul's phase 2 (docs/xp-overhaul.md §3). Priced
 * where the bundle was: gold is the one currency that buys either objective power or growth, so
 * the conversion is the decision. First-pass figure for playtest.
 */
export const ICHOR_PURCHASE_COST = 35;

/**
 * How many one Guild Hall visit sells (2026-09-11, per user direction). An uncapped shelf let a
 * rich run turn the whole purse into levels in one stop; two keeps the conversion a decision
 * rather than a dump, and two Drops is a purchased +2 for one hero — watch it against the 50g
 * hire (docs/xp-overhaul.md §10). First-pass figure for playtest.
 */
export const ICHOR_PURCHASE_LIMIT = 2;

/** Gold cost to recruit any Guild Hall hero outright. */
export const GUILD_HALL_RECRUIT_COST = 50;

export const guildHallOffers: GuildHallOffer[] = Object.values(heroes)
  .filter((hero) => !hero.starter)
  .map((hero) => ({
    id: `guild-${hero.id}`,
    heroId: hero.id,
    cost: GUILD_HALL_RECRUIT_COST,
    startingMoveIds: hero.moveIds,
  }));
