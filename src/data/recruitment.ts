// Guild Hall offer pool: every hero in the run's pool, each hired for one Recruit Contract — the run's deck
// (run/deck.ts) once one is carried, so the shelf and the draft read one table. Heroes already on
// the roster are dropped where the shelf is rolled (run/shop.ts).

import type { HeroDefinition } from '../engine/content';
import type { GuildHallOffer } from '../run/recruitment';
import { heroPool } from '../run/recruitment';
import { heroes } from './heroes';

export function guildHallOffersFor(pool: Record<string, HeroDefinition>): GuildHallOffer[] {
  return Object.values(pool)
    .map((hero) => ({
      id: `guild-${hero.id}`,
      heroId: hero.id,
      startingMoveIds: hero.moveIds,
    }));
}

/** The base game's shelf — no bundle held. */
export const guildHallOffers: GuildHallOffer[] = guildHallOffersFor(heroPool(heroes));
