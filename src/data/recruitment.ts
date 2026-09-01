// Guild Hall offer pool: every `starter: false` hero at a flat, untuned cost. Derived from
// heroes.ts so the draft pool and the Guild Hall pool can never drift apart.

import type { GuildHallOffer } from '../run/recruitment';
import { heroes } from './heroes';

/** Gold cost of a blank Recruit Contract at a Guild Hall. */
export const CONTRACT_PURCHASE_COST = 20;

/** Gold cost to recruit any Guild Hall hero outright. */
const GUILD_HALL_RECRUIT_COST = 50;

export const guildHallOffers: GuildHallOffer[] = Object.values(heroes)
  .filter((hero) => !hero.starter)
  .map((hero) => ({
    id: `guild-${hero.id}`,
    heroId: hero.id,
    cost: GUILD_HALL_RECRUIT_COST,
    startingMoveIds: hero.moveIds,
  }));
