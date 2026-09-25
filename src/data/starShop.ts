import type { StarShopCatalog, StarShopOffer } from '../run/starShop';

/**
 * What stars buy (docs/constellation.md). The rule: a purchase widens what a run can draw from
 * and never carries power into one. Three shelves — Starter Packs, Hero Bundles, Locations. Two
 * are stocked: four Locations (data/locations.ts `unlock`), each a seal drawn beside the base
 * five once held, and the first Hero Bundle (heroes.ts `unlock`), heroes outside the base
 * three-a-type that join the recruit pool once held. The pack shelf is the design still owed
 * (§3) and stands empty until an offer has a grant to make.
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
  // Priced at three a hero (§7), rounded down for the set.
  {
    id: 'bundle.freeCompany',
    name: 'Free Company',
    description: 'Blades for hire, sworn to no seal. They take contracts and Guild Hall coin like anyone, and never stand in the draft.',
    cost: 8,
    grant: { kind: 'heroBundle', heroIds: ['scallywag', 'patch', 'vex'] },
  },
  // Priced as the Free Company, for the three seats it will hold; Tixwick's is the one still open.
  {
    id: 'bundle.tallGrass',
    name: 'From the Tall Grass',
    description: 'Fire, water and green, come up out of the long grass at the road\'s edge. They take contracts and Guild Hall coin like anyone, and never stand in the draft.',
    cost: 8,
    grant: { kind: 'heroBundle', heroIds: ['drake', 'nautilus'] },
  },
];

export const starShopCatalog: StarShopCatalog = Object.fromEntries(STAR_SHOP_OFFERS.map((offer) => [offer.id, offer]));
