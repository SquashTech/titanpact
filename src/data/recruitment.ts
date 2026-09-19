// Guild Hall offer pool: every `starter: false` hero in the run's pool at a flat, untuned cost.
// Derived from heroes.ts so the draft pool and the Guild Hall pool can never drift apart, and
// from the POOL (run/recruitment.ts `heroPool`) so a bundle hero is on the shelf exactly when
// its offer is held.

import type { HeroDefinition } from '../engine/content';
import type { GuildHallOffer } from '../run/recruitment';
import { heroPool } from '../run/recruitment';
import { heroes } from './heroes';

/** Gold cost of a blank Recruit Contract at a Guild Hall. */
export const CONTRACT_PURCHASE_COST = 20;

/** Gold cost to recruit any Guild Hall hero outright. */
export const GUILD_HALL_RECRUIT_COST = 50;

export function guildHallOffersFor(pool: Record<string, HeroDefinition>): GuildHallOffer[] {
  return Object.values(pool)
    .filter((hero) => !hero.starter)
    .map((hero) => ({
      id: `guild-${hero.id}`,
      heroId: hero.id,
      cost: GUILD_HALL_RECRUIT_COST,
      startingMoveIds: hero.moveIds,
    }));
}

/** The base game's shelf — no bundle held. */
export const guildHallOffers: GuildHallOffer[] = guildHallOffersFor(heroPool(heroes));
