// Guild Hall commerce beyond recruitment: the one-time offer set a `shop` node
// presents, and equipment purchases. Offers are rolled ONCE at node-select
// time and carried on the Screen — a component-local roll would reroll on
// re-render of the shop. Relics are reward-only, never sold.

import { ROSTER_CAP, type RunState } from './state';
import { pickWeightedEquipment, rarityWeightsFor, type EquipmentDefinition, type EquipmentRarity } from './equipment';
import type { GuildHallOffer } from './recruitment';

export class ShopError extends Error {}

/** Flat, untuned gold price per rarity tier. */
export const EQUIPMENT_PRICE_BY_RARITY: Record<EquipmentRarity, number> = {
  common: 15,
  rare: 30,
  epic: 55,
  legendary: 90,
  mythic: 150,
};

/**
 * Share of the buy price an unwanted item sells back for, anywhere (docs/progression.md
 * "The stash"). Half is the first-pass figure; the shape is what matters — a full bag is a
 * choice between two items rather than a flat loss, and gold gets a second faucet that
 * scales with how picky the player is.
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
 * Deliberately dearer than buying that tier outright — 275 lifts a Common to Mythic against 150
 * to buy one off the shelf. You are paying to keep THIS item, its family, its Awakening and its
 * enchant. Merging is the efficient route to power, and it is free.
 *
 * Both tables are untuned. What is NOT free to retune is the pair of inequalities in
 * test/shop.test.ts: no path from gold back to gold may profit.
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

/**
 * The Blacksmith's item slot, keyed by the slot being bought — 2 is a hero's second, 3 its third
 * (MAX_ITEM_SLOTS). Deliberately the dearest thing in the run (2026-09-08, per user direction):
 * an act pays roughly 50-120g, so the second slot is most of an act's income and the third most
 * of two, and the Blacksmith is only on the map from act 3.
 *
 * It has to be. A slot is permanent and compounds with every drop after it, and the reward row
 * keeps forgeReward at the lowest weight it carries precisely to keep slots scarce. Gold must be
 * a way to PAY for that scarcity, never a way around it — the same relationship the Anvil above
 * has to buying a tier outright.
 */
export const SLOT_PRICE_BY_TARGET: Record<number, number> = {
  2: 120,
  3: 200,
};

export const GUILD_HALL_EQUIPMENT_OFFER_COUNT = 4;

export interface GuildHallOffers {
  /** GuildHallOffer.id values, 2 or 3 of them. */
  heroOfferIds: string[];
  equipmentOfferIds: string[];
}

function sample<T>(pool: readonly T[], count: number): T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    picked.push(remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
  }
  return picked;
}

/** 2-3 heroes not already on the roster, and a shelf rolled on the same act curve every drop uses — the act controls what is on offer, gold whether you can afford it. */
export function rollGuildHallOffers(
  run: RunState,
  heroPool: readonly GuildHallOffer[],
  equipmentPool: readonly EquipmentDefinition[],
  /** Act 6's Vigil: enough recruits to fill the roster plus one, and the run's last shelf. */
  muster = false
): GuildHallOffers {
  const rosterHeroIds = new Set(run.roster.map((r) => r.heroId));
  const availableHeroes = heroPool.filter((o) => !rosterHeroIds.has(o.heroId));
  // Fill the gap and leave one spare, so the Vigil still poses a choice rather than a queue.
  const heroCount = muster ? Math.max(2, ROSTER_CAP - run.roster.length + 1) : Math.random() < 0.5 ? 2 : 3;
  return {
    heroOfferIds: sample(availableHeroes, heroCount).map((o) => o.id),
    equipmentOfferIds: pickWeightedEquipment(
      equipmentPool,
      GUILD_HALL_EQUIPMENT_OFFER_COUNT,
      rarityWeightsFor(run.actNumber, muster ? 'elite' : 'standard')
    ).map((i) => i.id),
  };
}

function spendGold(run: RunState, cost: number, what: string): RunState {
  if (run.gold < cost) {
    throw new ShopError(`${what} costs ${cost} gold, only ${run.gold} available`);
  }
  return { ...run, gold: run.gold - cost };
}

/** Gold spend only; the caller drops the bought item into the bag (App.tsx `stashItem`). */
export function buyEquipment(run: RunState, item: EquipmentDefinition): RunState {
  return spendGold(run, EQUIPMENT_PRICE_BY_RARITY[item.rarity], item.name);
}
