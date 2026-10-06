// The Constellation's rules (the star shop): what a star buys, and the ledger that says what has been bought.
// Offers are content (src/data/starShop.ts); this file is the mechanism, the same split as
// progression.ts against data/progression.ts.
//
// Stars are EARNED per Evolution path (profile.ts `evolutionStars`) and that record is
// permanent — the Constellation's Stars page shows a star whether or not it has been spent. Spending is a
// separate ledger, `Profile.purchases`, and the balance is earned minus the cost of what is
// held. So a star is never taken off a hero; it is the count that is drawn down.

import { totalStars, trialStars, type Profile } from './profile';
import { heroes } from '../data/heroes';
import { ownsHero, starfallLedgerId } from './recruitment';

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
  /** In stars — a bundle's full price, before what is already owned comes off it. */
  cost: number;
  grant: StarShopGrant;
}

export type StarShopCatalog = Record<string, StarShopOffer>;

/** One blind draw of a hero the account does not own (docs/collection.md §4): the choice given up is the discount. */
export const STARFALL_PRICE = 2;

/** Every star the profile has been paid: hero and companion stars, and clear bonuses. */
export function starsEarned(profile: Profile): number {
  return totalStars(profile) + profile.bonusStars + trialStars(profile);
}

/**
 * A bundle's price against what a ledger already owns: its cost times the share of its heroes
 * still to get, rounded up — a bundle whose last hero is all that is left costs that hero's share.
 */
function bundlePriceAgainst(offer: StarShopOffer, purchases: readonly string[]): number {
  if (offer.grant.kind !== 'heroBundle') return offer.cost;
  const { heroIds } = offer.grant;
  const missing = heroIds.filter((id) => !heroes[id] || !ownsHero(id, heroes[id], purchases)).length;
  return Math.ceil((offer.cost * missing) / heroIds.length);
}

/** What the offer costs this profile now — a bundle less what of it is already owned. */
export function offerPrice(profile: Profile, offer: StarShopOffer): number {
  return bundlePriceAgainst(offer, profile.purchases);
}

/**
 * Purchases, Starfalls and entry fees. The ledger is replayed in order, so a bundle is charged
 * what it cost the day it was bought. A purchase whose offer this build no longer ships costs
 * nothing — a single hero from before singles were withdrawn, the Free Company — and is refunded.
 */
export function starsSpent(profile: Profile, catalog: StarShopCatalog): number {
  let spent = profile.feesPaid;
  profile.purchases.forEach((id, at) => {
    if (id.startsWith(starfallLedgerId(''))) spent += STARFALL_PRICE;
    else if (catalog[id]) spent += bundlePriceAgainst(catalog[id], profile.purchases.slice(0, at));
  });
  return spent;
}

/** Earned minus spent. */
export function starBalance(profile: Profile, catalog: StarShopCatalog): number {
  return starsEarned(profile) - starsSpent(profile, catalog);
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
  return !offerHeld(profile, offer) && starBalance(profile, catalog) >= offerPrice(profile, offer);
}

export class StarShopError extends Error {}

/** One purchase, once: an offer already held or past the balance is refused. */
export function buyOffer(profile: Profile, catalog: StarShopCatalog, offer: StarShopOffer): Profile {
  if (offerHeld(profile, offer)) throw new StarShopError(`${offer.id} is already held`);
  const price = offerPrice(profile, offer);
  if (starBalance(profile, catalog) < price) throw new StarShopError(`${offer.id} costs ${price}, balance is ${starBalance(profile, catalog)}`);
  return { ...profile, purchases: [...profile.purchases, offer.id] };
}

/** The heroes a Starfall can draw: every one outside the base roster the account does not own, in catalog order. */
export function starfallPool(profile: Profile): string[] {
  return Object.values(heroes)
    .filter((hero) => hero.unlock && !owned(profile, hero.id))
    .map((hero) => hero.id);
}

export function canCallStarfall(profile: Profile, catalog: StarShopCatalog): boolean {
  return starfallPool(profile).length > 0 && starBalance(profile, catalog) >= STARFALL_PRICE;
}

/** One blind draw — never a hero already owned, so never a duplicate. `random` is in [0, 1). */
export function starfall(profile: Profile, catalog: StarShopCatalog, random: number): { profile: Profile; heroId: string } {
  const pool = starfallPool(profile);
  if (pool.length === 0) throw new StarShopError('every hero is already owned');
  if (starBalance(profile, catalog) < STARFALL_PRICE) throw new StarShopError(`a Starfall costs ${STARFALL_PRICE}, balance is ${starBalance(profile, catalog)}`);
  const heroId = pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
  return { profile: { ...profile, purchases: [...profile.purchases, starfallLedgerId(heroId)] }, heroId };
}
