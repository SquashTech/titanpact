import type { StarShopCatalog, StarShopOffer } from '../run/starShop';

/**
 * What stars buy. EMPTY on purpose (2026-09-16): the shop's plumbing is built — the ledger, the
 * balance, the screen — and what an offer grants is the design still owed (docs/progression.md
 * "Per-run reset vs. meta-progression": stars must buy UNLOCKS that widen what a run can draw
 * from, never power carried into one). An offer goes here once it has a grant to make, and the
 * shape below grows a `grant` field with it.
 */
export const STAR_SHOP_OFFERS: readonly StarShopOffer[] = [];

export const starShopCatalog: StarShopCatalog = Object.fromEntries(STAR_SHOP_OFFERS.map((offer) => [offer.id, offer]));
