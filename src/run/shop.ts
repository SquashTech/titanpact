// Guild Hall commerce beyond recruitment: the one-time offer set a `shop` node presents, and
// the prices gear is valued and worked at. Offers are rolled ONCE at node-select time and carried
// on the Screen — a component-local roll would reroll on re-render of the shop. The Gear counter
// sells SHOP_ITEM_COUNT pieces a visit, one of each, each bought straight onto the hero picked
// (docs/run-loop.md "The Guild Hall").

import { GATHERING_EXTRA_HIRES, isGathering } from './cycles';
import type { RunState } from './state';
import { rarityWeightsFor, type EquipmentDefinition, type EquipmentRarity } from './equipment';
import { rollEquipmentDrops } from '../data/equipment';
import type { GuildHallOffer } from './recruitment';
import { rollShelfGems, type Gem } from './gems';
import { heroes } from '../data/heroes';
import { TYPES } from '../data/typechart';
import type { TypeId } from '../engine/content';

/** What a tier is worth in gold: the Shop's shelf price (`shopItemPrice`) and the base `sellValueFor` reads. Untuned. */
export const EQUIPMENT_PRICE_BY_RARITY: Record<EquipmentRarity, number> = {
  common: 15,
  rare: 30,
  epic: 55,
  legendary: 90,
  mythic: 150,
};

/**
 * Share of the tier's value an unwanted item converts to on the who-screen's Sell button, or when
 * nobody can receive it (docs/gear-absorption.md §2). Half is the first-pass figure.
 */
export const EQUIPMENT_SELL_SHARE = 0.5;

export function sellValueFor(item: EquipmentDefinition): number {
  return Math.floor(EQUIPMENT_PRICE_BY_RARITY[item.rarity] * EQUIPMENT_SELL_SHARE);
}

/**
 * The Anvil: gold to lift an item to the keyed tier, repeatable and unbounded (docs/equipment.md
 * §5). Keyed by TARGET, so `ANVIL_PRICE_BY_TARGET.epic` is what Rare -> Epic costs; `common` is
 * unreachable and priced at 0 only so the record is total.
 *
 * The shelf it used to be priced against is gone (docs/gear-absorption.md §6), so the basis is
 * the run's other purchases now: Rare → Epic, the step that Awakens a family, costs about a hire
 * (50g); Legendary → Mythic about two and a half. Merging is the free route up a tier and the
 * Anvil is the paid one for a piece with no duplicate coming — deliberately dearer than the shelf
 * ever was, per tier, so gold is spent to keep THIS piece rather than to farm power. Untuned
 * against play (2026-09-15; the numbers stand from the shelf era). What is NOT free to retune is
 * the inequality in test/shop.test.ts: a lift must cost more than the tier it reaches sells for.
 */
export const ANVIL_PRICE_BY_TARGET: Record<EquipmentRarity, number> = {
  common: 0,
  rare: 25,
  epic: 45,
  legendary: 75,
  mythic: 130,
};

/** The Enchanter, priced by the item's own tier — a Mythic's enchant is worth more Force, so it costs more. Re-enchanting costs the same, and overwrites. */
export const ENCHANT_PRICE_BY_RARITY: Record<EquipmentRarity, number> = {
  common: 20,
  rare: 35,
  epic: 55,
  legendary: 80,
  mythic: 120,
};

export interface GuildHallOffers {
  /** GuildHallOffer.id values, 2 or 3 of them. */
  heroOfferIds: string[];
  /** The Shop's gear shelf: SHOP_ITEM_COUNT equipment ids, one of each for sale, never restocked. */
  itemIds: string[];
  /** The shelf's single Gems (run/gems.ts SHELF_GEM_COUNT), each sold once. */
  gems: Gem[];
}

/** The Gear counter's stock a visit, on the act's standard drop curve. */
export const SHOP_ITEM_COUNT = 4;

/** First pass: the tier's value, so a shelf piece costs twice what it would sell for. */
export function shopItemPrice(item: EquipmentDefinition): number {
  return EQUIPMENT_PRICE_BY_RARITY[item.rarity];
}

export class ShopItemError extends Error {}

/** Charges the shelf price; the who-screen absorbs the piece after. */
export function buyShopItem(run: RunState, item: EquipmentDefinition): RunState {
  const price = shopItemPrice(item);
  if (run.gold < price) throw new ShopItemError(`${item.name} costs ${price}g; ${run.gold}g held.`);
  return { ...run, gold: run.gold - price };
}

function sample<T>(pool: readonly T[], count: number): T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    picked.push(remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
  }
  return picked;
}

/** 2-3 heroes not already on the roster, the shelf's Gems and the gear shelf's pieces. */
export function rollGuildHallOffers(
  run: RunState,
  heroPool: readonly GuildHallOffer[],
  /** Act 6's Vigil recruits nobody: the finale is fought by the roster the run kept. */
  muster = false
): GuildHallOffers {
  const itemIds = rollEquipmentDrops(SHOP_ITEM_COUNT, rarityWeightsFor(run.actNumber, 'standard')).map((item) => item.id);
  const gems = rollShelfGems(run.actNumber);
  if (muster) return { heroOfferIds: [], itemIds, gems };
  const rosterHeroIds = new Set(run.roster.map((r) => r.heroId));
  const availableHeroes = heroPool.filter((o) => !rosterHeroIds.has(o.heroId));
  const hires = (Math.random() < 0.5 ? 2 : 3) + (isGathering(run) ? GATHERING_EXTRA_HIRES : 0);
  return { heroOfferIds: sample(availableHeroes, hires).map((o) => o.id), itemIds, gems };
}

/** The Tavern's call: gold to send word for a TYPE, once a visit. Untuned. */
export const TAVERN_CALL_PRICE = 25;

export class TavernCallError extends Error {}

/** Who would answer a call for `type`: the pool's heroes of that innate type, neither on the roster nor on the board. */
function answering(run: RunState, heroPool: readonly GuildHallOffer[], offers: GuildHallOffers, type: TypeId): GuildHallOffer[] {
  const rosterHeroIds = new Set(run.roster.map((r) => r.heroId));
  return heroPool.filter((o) => heroes[o.heroId]?.types[0] === type && !rosterHeroIds.has(o.heroId) && !offers.heroOfferIds.includes(o.id));
}

/** The types a call can be sent for, in chart order: somebody of that type is still out there. */
export function callableTypes(run: RunState, heroPool: readonly GuildHallOffer[], offers: GuildHallOffers): TypeId[] {
  return TYPES.filter((type) => answering(run, heroPool, offers, type).length > 0);
}

/**
 * Word sent for a type: one hero of it —
 * which one is not the player's to say — takes the last poster on the board, or a seat on an
 * empty one. The type is aimed, the hero is not, so the call fills a gap and never a comp.
 */
export function callForType(
  run: RunState,
  heroPool: readonly GuildHallOffer[],
  offers: GuildHallOffers,
  type: TypeId,
  random: () => number = Math.random
): { run: RunState; offers: GuildHallOffers; offerId: string } {
  if (run.gold < TAVERN_CALL_PRICE) throw new TavernCallError(`A call costs ${TAVERN_CALL_PRICE}g; ${run.gold}g held.`);
  const pool = answering(run, heroPool, offers, type);
  if (pool.length === 0) throw new TavernCallError(`Nobody of ${type} is left to answer.`);
  const called = pool[Math.floor(random() * pool.length)];
  const rosterHeroIds = new Set(run.roster.map((r) => r.heroId));
  const posted = offers.heroOfferIds.filter((id) => !rosterHeroIds.has(heroPool.find((o) => o.id === id)?.heroId ?? ''));
  const heroOfferIds = posted.length > 0 ? offers.heroOfferIds.map((id) => (id === posted[posted.length - 1] ? called.id : id)) : [...offers.heroOfferIds, called.id];
  return { run: { ...run, gold: run.gold - TAVERN_CALL_PRICE }, offers: { ...offers, heroOfferIds }, offerId: called.id };
}
