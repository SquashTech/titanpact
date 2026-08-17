// ⚠️ TEST FIXTURE CONTENT — a Guild Hall offer pool covering the fixture
// heroes not in the start-of-run draft, at flat, untuned gold costs. Not
// authored economy content: no decaying runway value curve
// (docs/progression.md "raise-vs-recruit axis") is modeled — these are
// constant offers, not the emergent late-run value curve the doc describes.
//
// Derived from `HeroDefinition.starter` (src/data/heroes.ts) rather than a
// hand-maintained id list, so the Guild Hall pool and the draft pool
// (src/run/draft.ts, via App.tsx) can never drift out of sync with each
// other — a hero is in exactly one of the two by construction
// (docs/types-and-heroes.md "Starters vs. recruit-only heroes").

import type { GuildHallOffer } from '../run/recruitment';
import { heroes } from './heroes';

/** Flat, untuned gold cost to buy a blank Recruit Contract at a Guild Hall — deliberately cheaper than the flat 20g hero-recruit offers below, since a contract still requires beating something to cash in. */
export const CONTRACT_PURCHASE_COST = 12;

/** Flat, untuned gold cost to recruit any single Guild Hall hero outright. */
const GUILD_HALL_RECRUIT_COST = 20;

export const guildHallOffers: GuildHallOffer[] = Object.values(heroes)
  .filter((hero) => !hero.starter)
  .map((hero) => ({
    id: `guild-${hero.id}`,
    heroId: hero.id,
    cost: GUILD_HALL_RECRUIT_COST,
    startingMoveIds: hero.moveIds,
  }));
