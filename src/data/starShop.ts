import type { StarShopCatalog, StarShopOffer } from '../run/starShop';

/**
 * What stars buy (docs/constellation.md). The rule: a purchase widens what a run can draw from
 * and never carries power into one: the hero bundles (heroes.ts `unlock`), joining the Collection
 * once owned. The four places it sold are granted by the Cycles now (docs/cycles.md §6). No hero
 * is sold singly: one outside every bundle comes by the Starfall, which is not an offer — it has
 * no fixed grant — and lives in run/starShop.ts.
 */
export const STAR_SHOP_OFFERS: readonly StarShopOffer[] = [
  // Three a hero, rounded down for the set; what is already owned comes off it (run/starShop.ts offerPrice).
  {
    id: 'bundle.tallGrass',
    name: 'From the Tall Grass',
    description: 'Fire, water and green, come up out of the long grass at the road\'s edge. Into the Collection, to deck like anyone.',
    cost: 8,
    grant: { kind: 'heroBundle', heroIds: ['drake', 'nautilus', 'tixwick'] },
  },
];

export const starShopCatalog: StarShopCatalog = Object.fromEntries(STAR_SHOP_OFFERS.map((offer) => [offer.id, offer]));
