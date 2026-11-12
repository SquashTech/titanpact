// What gear is worth in gold, read by the who-screen's Sell (docs/gear-absorption.md §2). Goes with
// gold (docs/guild-hall-overhaul.md §1).

import type { EquipmentDefinition, EquipmentRarity } from './equipment';

/** What a tier is worth in gold, the base `sellValueFor` reads. Untuned. */
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
