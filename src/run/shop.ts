// Guild Hall commerce: the one-time offer set a `shop` node presents, and the prices gear is
// valued and worked at. Offers are rolled ONCE at node-select time and carried on the Screen — a
// component-local roll would reroll on re-render of the shop. The Gear counter sells
// SHOP_ITEM_COUNT pieces a visit, one of each, each bought straight onto the hero picked
// (docs/run-loop.md "The Guild Hall").

import type { RunState } from './state';
import { rarityWeightsFor, type EquipmentDefinition, type EquipmentRarity } from './equipment';
import { rollEquipmentDrops } from '../data/equipment';
import { rollShelfGems, type Gem } from './gems';

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

export interface GuildHallOffers {
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

/** The shelf's Gems and the gear shelf's pieces. */
export function rollGuildHallOffers(run: RunState): GuildHallOffers {
  const itemIds = rollEquipmentDrops(SHOP_ITEM_COUNT, rarityWeightsFor(run.actNumber, 'standard')).map((item) => item.id);
  return { itemIds, gems: rollShelfGems(run.actNumber) };
}
