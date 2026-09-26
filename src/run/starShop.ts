// The Constellation's rules (the star shop): what a star buys, and the ledger that says what has been bought.
// Offers are content (src/data/starShop.ts); this file is the mechanism, the same split as
// progression.ts against data/progression.ts.
//
// Stars are EARNED per Evolution path (profile.ts `evolutionStars`) and that record is
// permanent — the Compendium shows a star whether or not it has been spent. Spending is a
// separate ledger, `Profile.purchases`, and the balance is earned minus the cost of what is
// held. So a star is never taken off a hero; it is the count that is drawn down.

import { totalStars, type Profile } from './profile';
import { rungOf } from './ascension';
import { heroes } from '../data/heroes';
import { ownsHero, summonedId } from './recruitment';

/**
 * What a purchase unlocks (docs/constellation.md §4, §8): a discriminant a pool edge reads once.
 * A Location joins the itinerary draw (run/locations.ts `locationPool`); a hero — singly or in a
 * bundle — joins the Collection (run/recruitment.ts `ownsHero`, off the hero's own `unlock`, which
 * a test holds to the bundle's list). `starterPack` has no offers since packs became deck presets.
 */
export type StarShopGrant =
  | { kind: 'location'; locationId: string }
  | { kind: 'starterPack' }
  | { kind: 'heroBundle'; heroIds: readonly string[] }
  | { kind: 'hero'; heroId: string };

export interface StarShopOffer {
  id: string;
  name: string;
  /** What the player gets, in a sentence. */
  description: string;
  /** In stars. */
  cost: number;
  grant: StarShopGrant;
}

export type StarShopCatalog = Record<string, StarShopOffer>;

/** A blind draw of one hero the account does not own (docs/collection.md §4): under a single hero's price, because the choice is given up. */
export const SUMMON_PRICE = 2;

/** Every star the profile has been paid: hero and companion stars, and clear bonuses. */
export function starsEarned(profile: Profile): number {
  return totalStars(profile) + profile.bonusStars;
}

/** Purchases, Summonings and entry fees. */
export function starsSpent(profile: Profile, catalog: StarShopCatalog): number {
  let spent = profile.feesPaid;
  for (const id of profile.purchases) spent += id.startsWith(summonedId('')) ? SUMMON_PRICE : catalog[id]?.cost ?? 0;
  return spent;
}

/** Earned minus spent. A purchase whose offer this build no longer ships costs nothing. */
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

/** Whether what the offer grants is already the account's — a hero bought singly or drawn counts, however it came. */
export function offerHeld(profile: Profile, offer: StarShopOffer): boolean {
  if (isPurchased(profile, offer.id)) return true;
  if (offer.grant.kind === 'hero') return owned(profile, offer.grant.heroId);
  if (offer.grant.kind === 'heroBundle') return offer.grant.heroIds.every((id) => owned(profile, id));
  return false;
}

/**
 * A bundle is sold only while none of it is owned: past that its heroes are singles, so no hero
 * is ever paid for twice and no price has to move (docs/collection.md §4).
 */
export function offerWithdrawn(profile: Profile, offer: StarShopOffer): boolean {
  return offer.grant.kind === 'heroBundle' && !offerHeld(profile, offer) && offer.grant.heroIds.some((id) => owned(profile, id));
}

export function canBuy(profile: Profile, catalog: StarShopCatalog, offer: StarShopOffer): boolean {
  return !offerHeld(profile, offer) && !offerWithdrawn(profile, offer) && starBalance(profile, catalog) >= offer.cost;
}

/** Whether the balance covers a rung's entry fee (run/ascension.ts). Classic always does. */
export function canEnterRung(profile: Profile, catalog: StarShopCatalog, rung: number): boolean {
  return starBalance(profile, catalog) >= rungOf(rung).entryFee;
}

export class StarShopError extends Error {}

/** One purchase, once: an offer already held, withdrawn, or past the balance is refused. */
export function buyOffer(profile: Profile, catalog: StarShopCatalog, offer: StarShopOffer): Profile {
  if (offerHeld(profile, offer)) throw new StarShopError(`${offer.id} is already held`);
  if (offerWithdrawn(profile, offer)) throw new StarShopError(`${offer.id} is off sale: part of it is already owned`);
  if (starBalance(profile, catalog) < offer.cost) throw new StarShopError(`${offer.id} costs ${offer.cost}, balance is ${starBalance(profile, catalog)}`);
  return { ...profile, purchases: [...profile.purchases, offer.id] };
}

/** The heroes a Summoning can draw: every one outside the base roster the account does not own, in catalog order. */
export function summonPool(profile: Profile): string[] {
  return Object.values(heroes)
    .filter((hero) => hero.unlock && !owned(profile, hero.id))
    .map((hero) => hero.id);
}

export function canSummon(profile: Profile, catalog: StarShopCatalog): boolean {
  return summonPool(profile).length > 0 && starBalance(profile, catalog) >= SUMMON_PRICE;
}

/** One blind draw — never a hero already owned, so never a duplicate. `random` is in [0, 1). */
export function summon(profile: Profile, catalog: StarShopCatalog, random: number): { profile: Profile; heroId: string } {
  const pool = summonPool(profile);
  if (pool.length === 0) throw new StarShopError('every hero is already owned');
  if (starBalance(profile, catalog) < SUMMON_PRICE) throw new StarShopError(`a Summoning costs ${SUMMON_PRICE}, balance is ${starBalance(profile, catalog)}`);
  const heroId = pool[Math.min(pool.length - 1, Math.floor(random * pool.length))];
  return { profile: { ...profile, purchases: [...profile.purchases, summonedId(heroId)] }, heroId };
}
