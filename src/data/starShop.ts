import type { StarShopCatalog, StarShopOffer } from '../run/starShop';

/**
 * What stars buy (docs/constellation.md). The rule: a purchase widens what a run can draw from
 * and never carries power into one. Four Locations (data/locations.ts `unlock`), each a seal
 * drawn beside the base five once held; and the hero bundles (heroes.ts `unlock`), joining the
 * Collection once owned. No hero is sold singly: one outside every bundle comes by the Starfall,
 * which is not an offer — it has no fixed grant — and lives in run/starShop.ts.
 */
export const STAR_SHOP_OFFERS: readonly StarShopOffer[] = [
  {
    id: 'location.holySanctum',
    name: 'Holy Sanctum',
    description: 'A seventh seal on the road. Light, Spirit and Mind leak here, and the Seraph keeps it.',
    cost: 6,
    grant: { kind: 'location', locationId: 'holySanctum' },
  },
  {
    id: 'location.dreamingSpires',
    name: 'Dreaming Spires',
    description: 'Towers that lean on nothing. Mind, Arcane and Spirit leak here, and the Sphinx keeps it.',
    cost: 6,
    grant: { kind: 'location', locationId: 'dreamingSpires' },
  },
  {
    id: 'location.thunderAerie',
    name: 'Thunder Aerie',
    description: 'A peak the storm never leaves. Storm, Arcane and Beast leak here, and the Roc keeps it.',
    cost: 6,
    grant: { kind: 'location', locationId: 'thunderAerie' },
  },
  {
    id: 'location.frozenReach',
    name: 'Frozen Reach',
    description: 'Ice that took the ships. Frost, Water and Stone leak here, and the Wendigo keeps it.',
    cost: 6,
    grant: { kind: 'location', locationId: 'frozenReach' },
  },
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
