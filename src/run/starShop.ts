// The Constellation's rules (the star shop): what a star buys, and the ledger that says what has been bought.
// Offers are content (src/data/starShop.ts); this file is the mechanism, the same split as
// progression.ts against data/progression.ts.
//
// Stars are EARNED per Evolution path (profile.ts `evolutionStars`) and that record is
// permanent — the Compendium shows a star whether or not it has been spent. Spending is a
// separate ledger, `Profile.purchases`, and the balance is earned minus the cost of what is
// held. So a star is never taken off a hero; it is the count that is drawn down.

import { totalStars, type Profile } from './profile';

export interface StarShopOffer {
  id: string;
  name: string;
  /** What the player gets, in a sentence. */
  description: string;
  /** In stars. */
  cost: number;
}

export type StarShopCatalog = Record<string, StarShopOffer>;

export function starsSpent(profile: Profile, catalog: StarShopCatalog): number {
  let spent = 0;
  for (const id of profile.purchases) spent += catalog[id]?.cost ?? 0;
  return spent;
}

/** Earned minus spent. A purchase whose offer this build no longer ships costs nothing. */
export function starBalance(profile: Profile, catalog: StarShopCatalog): number {
  return totalStars(profile) - starsSpent(profile, catalog);
}

export function isPurchased(profile: Profile, offerId: string): boolean {
  return profile.purchases.includes(offerId);
}

export function canBuy(profile: Profile, catalog: StarShopCatalog, offer: StarShopOffer): boolean {
  return !isPurchased(profile, offer.id) && starBalance(profile, catalog) >= offer.cost;
}

export class StarShopError extends Error {}

/** One purchase, once: an offer already held or one the balance cannot cover is refused. */
export function buyOffer(profile: Profile, catalog: StarShopCatalog, offer: StarShopOffer): Profile {
  if (isPurchased(profile, offer.id)) throw new StarShopError(`${offer.id} is already held`);
  if (starBalance(profile, catalog) < offer.cost) throw new StarShopError(`${offer.id} costs ${offer.cost}, balance is ${starBalance(profile, catalog)}`);
  return { ...profile, purchases: [...profile.purchases, offer.id] };
}
