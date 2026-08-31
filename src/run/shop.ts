// Guild Hall commerce beyond hero recruitment (recruitment.ts covers raising
// a hero and buying Recruit Contracts): rolling the one-time offer set a
// `shop` map node presents, and the gold-spend mechanics for buying
// equipment outright.
//
// Relics used to be a third shelf here and are no longer sold at all (user
// direction, 2026-08-31). They stay in the run as a reward-only axis (the
// Relic Shrine node and the Guardian's Banner), which is what keeps them
// reading as a team-wide *axis* rather than a stat purchase: a shop that
// sells one of everything makes gold the only real decision on the screen.
// The equipment shelf absorbed the freed room (3 offers -> 4).
//
// Offers are rolled ONCE per shop-node visit (App.tsx handleSelectNode, at
// node-select time) and carried on the `shop` Screen variant rather than
// re-rolled inside GuildHallPanel's own component state. Buying a piece of
// equipment routes through the same forced equip-or-trash gate every other
// equipment grant uses (ForceEquipScreen, per "the unequipped-item inventory
// was removed" — docs/run-loop.md), which means App.tsx flips `screen.kind`
// to 'forceEquip' and back to 'shop' on every purchase, unmounting and
// remounting ShopNodeScreen/GuildHallPanel. A component-local useState roll
// would reroll every offer (including ones the player hasn't bought yet) on
// that remount — rolling once at node-select time and passing the result
// down as data sidesteps that entirely.

import type { RunState } from './state';
import { pickWeightedEquipment, rarityWeightsFor, type EquipmentDefinition, type EquipmentRarity } from './equipment';
import type { GuildHallOffer } from './recruitment';

export class ShopError extends Error {}

/**
 * Flat, untuned gold price per equipment rarity tier (RARITY_ORDER, common
 * through mythic) — climbing with the same tier the item's color/icon
 * already communicates elsewhere (RARITY_COLOR_VARS).
 */
export const EQUIPMENT_PRICE_BY_RARITY: Record<EquipmentRarity, number> = {
  common: 15,
  rare: 30,
  epic: 55,
  legendary: 90,
  mythic: 150,
};

/** How many of each good a shop node's Guild Hall offers, per visit — heroes stay capped low (2-3) per user direction; equipment gets a small rotating shelf alongside them, widened to 4 (2026-08-31) when the relic shelf was removed. */
export const GUILD_HALL_EQUIPMENT_OFFER_COUNT = 4;

export interface GuildHallOffers {
  /** GuildHallOffer.id values (src/data/recruitment.ts), 2 or 3 of them. */
  heroOfferIds: string[];
  /** EquipmentDefinition.id values. */
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

/**
 * Rolls a shop node's one-time offer set: 2-3 heroes not already on the
 * roster (a curated pick rather than the full non-starter catalog — user
 * direction 2026-08-18) and a shelf of equipment.
 *
 * The equipment shelf is the one place a player can BUY a specific tier, so
 * it rolls the same act curve every drop does (rarityWeightsFor,
 * src/run/equipment.ts) rather than sampling the catalog uniformly — an Act-1
 * Guild Hall stocking a Mythic would let gold skip the whole progression, and
 * an Act-5 one stocking Commons would just waste two thirds of the shelf.
 * Pricing stays flat per tier (EQUIPMENT_PRICE_BY_RARITY), so the act
 * controls what is on offer and gold controls whether you can afford it.
 */
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

/**
 * Spends gold for a Guild Hall equipment purchase, priced by rarity. The
 * caller (App.tsx) still routes the bought item through ForceEquipScreen,
 * same as any other equipment grant — this only handles the gold spend.
 */
export function buyEquipment(run: RunState, item: EquipmentDefinition): RunState {
  return spendGold(run, EQUIPMENT_PRICE_BY_RARITY[item.rarity], item.name);
}
