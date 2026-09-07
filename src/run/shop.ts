// Guild Hall commerce beyond recruitment: the one-time offer set a `shop` node
// presents, and equipment purchases. Offers are rolled ONCE at node-select
// time and carried on the Screen — a component-local roll would reroll on
// every ItemFoundScreen remount. Relics are reward-only, never sold.

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

/** Gold spend only; the caller still routes the item through ItemFoundScreen, where it is seated or bagged. */
export function buyEquipment(run: RunState, item: EquipmentDefinition): RunState {
  return spendGold(run, EQUIPMENT_PRICE_BY_RARITY[item.rarity], item.name);
}
