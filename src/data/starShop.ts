import type { StarShopCatalog, StarShopOffer } from '../run/starShop';
import { heroOfferId } from '../run/recruitment';
import { heroes } from './heroes';

/** A single hero's price (docs/constellation.md §7). */
export const HERO_PRICE = 3;

/**
 * What stars buy (docs/constellation.md). The rule: a purchase widens what a run can draw from
 * and never carries power into one. Four Locations (data/locations.ts `unlock`), each a seal
 * drawn beside the base five once held; the heroes outside the base three-a-type (heroes.ts
 * `unlock`), each sold singly and in its bundle, joining the Collection once owned. The Summoning
 * is not an offer — it has no fixed grant — and lives in run/starShop.ts.
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
  // Priced as the Free Company: three a hero, rounded down for the set.
  {
    id: 'bundle.tallGrass',
    name: 'From the Tall Grass',
    description: 'Fire, water and green, come up out of the long grass at the road\'s edge. They take contracts and Guild Hall coin like anyone, and never stand in the draft.',
    cost: 8,
    grant: { kind: 'heroBundle', heroIds: ['drake', 'nautilus', 'tixwick'] },
  },
  // Every hero outside the base roster, one at a time (docs/collection.md §4) — a bundle is the
  // same heroes a star cheaper, while none of them is owned.
  ...Object.values(heroes)
    .filter((hero) => hero.unlock)
    .map(
      (hero): StarShopOffer => ({
        id: heroOfferId(hero.id),
        name: hero.name,
        description: `${hero.name} joins your Collection.`,
        cost: HERO_PRICE,
        grant: { kind: 'hero', heroId: hero.id },
      })
    ),
];

export const starShopCatalog: StarShopCatalog = Object.fromEntries(STAR_SHOP_OFFERS.map((offer) => [offer.id, offer]));
