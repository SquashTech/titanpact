// Guild Hall commerce beyond recruitment: the one-time offer set a `shop` node
// presents, and equipment purchases. Offers are rolled ONCE at node-select
// time and carried on the Screen — a component-local roll would reroll on
// every forceEquip remount. Relics are reward-only, never sold.

import type { RunState } from './state';
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
  equipmentPool: readonly EquipmentDefinition[]
): GuildHallOffers {
  const rosterHeroIds = new Set(run.roster.map((r) => r.heroId));
  const availableHeroes = heroPool.filter((o) => !rosterHeroIds.has(o.heroId));
  const heroCount = Math.random() < 0.5 ? 2 : 3;
  return {
    heroOfferIds: sample(availableHeroes, heroCount).map((o) => o.id),
    equipmentOfferIds: pickWeightedEquipment(
      equipmentPool,
      GUILD_HALL_EQUIPMENT_OFFER_COUNT,
      rarityWeightsFor(run.actNumber, 'standard')
    ).map((i) => i.id),
  };
}

function spendGold(run: RunState, cost: number, what: string): RunState {
  if (run.gold < cost) {
    throw new ShopError(`${what} costs ${cost} gold, only ${run.gold} available`);
  }
  return { ...run, gold: run.gold - cost };
}

/** Gold spend only; the caller still routes the item through ForceEquipScreen. */
export function buyEquipment(run: RunState, item: EquipmentDefinition): RunState {
  return spendGold(run, EQUIPMENT_PRICE_BY_RARITY[item.rarity], item.name);
}
