// The Constellation's rules (the star shop): what Stardust buys, and the ledger that says what has been bought.
// Offers are content (src/data/starShop.ts); this file is the mechanism, the same split as
// progression.ts against data/progression.ts.
//
// Stars are EARNED per Evolution path (profile.ts `evolutionStars`), each paying STARDUST_PER_STAR,
// and that record is permanent. Spending is a separate ledger, `Profile.purchases`, and the balance
// is earned minus the cost of what is held, so a star is never taken off a hero.

import { STARDUST_PER_STAR, totalStars, trialStardust, type Profile } from './profile';
import { heroes } from '../data/heroes';
import { ownsHero, starfallLedgerId } from './recruitment';
import { shortTypes } from './deck';
import { GAUNTLET_ENTRY_PRICE } from './gauntlet';
import { skyStardust } from './sky';
import { sky } from '../data/sky';

/**
 * What a purchase unlocks (docs/constellation.md §4, §8): a discriminant a pool edge reads once.
 * A bundle's heroes join the Collection (run/recruitment.ts `ownsHero`, off the hero's own `unlock`, which a test holds
 * to the bundle's list). A hero outside every bundle is reached by the Starfall alone.
 */
export type StarShopGrant = { kind: 'heroBundle'; heroIds: readonly string[] };

export interface StarShopOffer {
  id: string;
  name: string;
  /** What the player gets, in a sentence. */
  description: string;
  /** In Stardust — a bundle's full price, before what is already owned comes off it. */
  cost: number;
  grant: StarShopGrant;
}

export type StarShopCatalog = Record<string, StarShopOffer>;

/** One blind draw of a hero the account does not own (docs/collection.md §4): the choice given up is the discount. */
export const STARFALL_PRICE = 100;

/** Ten draws at once (docs/the-sky.md §5): spectacle and convenience, at exactly ten singles' price. */
export const STARFALL_TEN = 10;

/** `HeroDefinition.unlock` for a hero the Starfall alone draws. */
export const STARFALL_UNLOCK = 'starfall';

/** Every Stardust the profile has been paid: its lit stars, clear bonuses, Trials and lit constellations. */
export function stardustEarned(profile: Profile): number {
  return totalStars(profile) * STARDUST_PER_STAR + profile.bonusStardust + trialStardust(profile) + skyStardust(profile, sky);
}

/**
 * A bundle's price against what a ledger already owns: its cost times the share of its heroes
 * still to get, rounded up to a whole star's worth — a bundle whose last hero is all that is left
 * costs that hero's share.
 */
function bundlePriceAgainst(offer: StarShopOffer, purchases: readonly string[]): number {
  if (offer.grant.kind !== 'heroBundle') return offer.cost;
  const { heroIds } = offer.grant;
  const missing = heroIds.filter((id) => !heroes[id] || !ownsHero(id, heroes[id], purchases)).length;
  return Math.ceil((offer.cost * missing) / heroIds.length / STARDUST_PER_STAR) * STARDUST_PER_STAR;
}

/** What the offer costs this profile now — a bundle less what of it is already owned. */
export function offerPrice(profile: Profile, offer: StarShopOffer): number {
  return bundlePriceAgainst(offer, profile.purchases);
}

/**
 * Purchases, Starfalls, entry fees and bought Gauntlet entries. The ledger is replayed in order, so a bundle is charged
 * what it cost the day it was bought. A purchase whose offer this build no longer ships costs
 * nothing — a single hero from before singles were withdrawn, the Free Company — and is refunded.
 */
export function stardustSpent(profile: Profile, catalog: StarShopCatalog): number {
  let spent = profile.feesPaid + profile.gauntletEntriesBought * GAUNTLET_ENTRY_PRICE;
  profile.purchases.forEach((id, at) => {
    if (id.startsWith(starfallLedgerId(''))) spent += STARFALL_PRICE;
    else if (catalog[id]) spent += bundlePriceAgainst(catalog[id], profile.purchases.slice(0, at));
  });
  return spent;
}

/** Earned minus spent. */
export function stardustBalance(profile: Profile, catalog: StarShopCatalog): number {
  return stardustEarned(profile) - stardustSpent(profile, catalog);
}

export function isPurchased(profile: Profile, offerId: string): boolean {
  return profile.purchases.includes(offerId);
}

const owned = (profile: Profile, heroId: string): boolean => {
  const hero = heroes[heroId];
  return !!hero && ownsHero(heroId, hero, profile.purchases);
};

/** Whether what the offer grants is already the account's — a bundle whose every hero was drawn counts. */
export function offerHeld(profile: Profile, offer: StarShopOffer): boolean {
  if (isPurchased(profile, offer.id)) return true;
  if (offer.grant.kind === 'heroBundle') return offer.grant.heroIds.every((id) => owned(profile, id));
  return false;
}

/** The bundle's heroes the account already owns — what its price is discounted by. */
export function bundleOwnedHeroIds(profile: Profile, offer: StarShopOffer): string[] {
  return offer.grant.kind === 'heroBundle' ? offer.grant.heroIds.filter((id) => owned(profile, id)) : [];
}

export function canBuy(profile: Profile, catalog: StarShopCatalog, offer: StarShopOffer): boolean {
  return !offerHeld(profile, offer) && stardustBalance(profile, catalog) >= offerPrice(profile, offer);
}

export class StarShopError extends Error {}

/** One purchase, once: an offer already held or past the balance is refused. */
export function buyOffer(profile: Profile, catalog: StarShopCatalog, offer: StarShopOffer): Profile {
  if (offerHeld(profile, offer)) throw new StarShopError(`${offer.id} is already held`);
  const price = offerPrice(profile, offer);
  if (stardustBalance(profile, catalog) < price) throw new StarShopError(`${offer.id} costs ${price}, balance is ${stardustBalance(profile, catalog)}`);
  return { ...profile, purchases: [...profile.purchases, offer.id] };
}

/**
 * The heroes a Starfall can draw, in catalog order: the Starfall's own heroes the account does not
 * own (a bundle's come only in the bundle), and of those only the types it owns fewer than a deck
 * row of, while any type is short.
 */
export function starfallPool(profile: Profile): string[] {
  const unowned = Object.values(heroes).filter((hero) => hero.unlock === STARFALL_UNLOCK && !owned(profile, hero.id));
  const short = shortTypes(heroes, profile.purchases);
  const filling = unowned.filter((hero) => short.includes(hero.types[0]));
  return (filling.length > 0 ? filling : unowned).map((hero) => hero.id);
}

export function canCallStarfall(profile: Profile, catalog: StarShopCatalog): boolean {
  return starfallPool(profile).length > 0 && stardustBalance(profile, catalog) >= STARFALL_PRICE;
}

/** Ten at once needs ten heroes left to draw; past that the Starfall is called one at a time. */
export function canCallStarfallTen(profile: Profile, catalog: StarShopCatalog): boolean {
  return starfallPool(profile).length >= STARFALL_TEN && stardustBalance(profile, catalog) >= STARFALL_PRICE * STARFALL_TEN;
}

/** One blind draw — never a hero already owned, so never a duplicate. `random` is in [0, 1). */
export function starfall(profile: Profile, catalog: StarShopCatalog, random: number): { profile: Profile; heroId: string } {
  const pool = starfallPool(profile);
  if (pool.length === 0) throw new StarShopError('every hero is already owned');
  if (stardustBalance(profile, catalog) < STARFALL_PRICE) throw new StarShopError(`a Starfall costs ${STARFALL_PRICE}, balance is ${stardustBalance(profile, catalog)}`);
  const heroId = pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
  return { profile: { ...profile, purchases: [...profile.purchases, starfallLedgerId(heroId)] }, heroId };
}

/** Ten single draws in one call, each against the pool the last one left, so the ten never repeat. */
export function starfallTen(profile: Profile, catalog: StarShopCatalog, randoms: readonly number[]): { profile: Profile; heroIds: string[] } {
  if (!canCallStarfallTen(profile, catalog)) throw new StarShopError(`ten Starfalls cost ${STARFALL_PRICE * STARFALL_TEN} and need ten heroes left`);
  const heroIds: string[] = [];
  let current = profile;
  for (let i = 0; i < STARFALL_TEN; i++) {
    const drawn = starfall(current, catalog, randoms[i] ?? 0);
    current = drawn.profile;
    heroIds.push(drawn.heroId);
  }
  return { profile: current, heroIds };
}
