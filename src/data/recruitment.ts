// Guild Hall offer pool: every hero in the run's pool at a flat, untuned cost — the run's deck
// (run/deck.ts) once one is carried, so the shelf and the draft read one table. Heroes already on
// the roster are dropped where the shelf is rolled (run/shop.ts).

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
    .map((hero) => ({
      id: `guild-${hero.id}`,
      heroId: hero.id,
      cost: GUILD_HALL_RECRUIT_COST,
      startingMoveIds: hero.moveIds,
    }));
}

/** The base game's shelf — no bundle held. */
export const guildHallOffers: GuildHallOffer[] = guildHallOffersFor(heroPool(heroes));
