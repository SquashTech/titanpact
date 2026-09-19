import type { StarShopCatalog, StarShopOffer } from '../run/starShop';

/**
 * What stars buy (docs/constellation.md). The rule: a purchase widens what a run can draw from
 * and never carries power into one. Three shelves — Starter Packs, Hero Bundles, Locations — and
 * the first stocked one is Locations: four places (data/locations.ts `unlock`), each a seal
 * drawn beside the base five once held. The pack and bundle shelves are the design still
 * owed (§3), and stand empty until an offer has a grant to make.
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
];

export const starShopCatalog: StarShopCatalog = Object.fromEntries(STAR_SHOP_OFFERS.map((offer) => [offer.id, offer]));
