// Guild Hall commerce beyond recruitment: the one-time offer set a `shop` node presents, and
// the prices gear is valued and worked at. Offers are rolled ONCE at node-select time and carried
// on the Screen — a component-local roll would reroll on re-render of the shop. Nothing here
// sells an item: gear is found and absorbed (docs/gear-absorption.md §6).

import { ROSTER_CAP, type RunState } from './state';
import type { EquipmentDefinition, EquipmentRarity } from './equipment';
import type { GuildHallOffer } from './recruitment';

/** What a tier is worth in gold — the base `sellValueFor` reads. Untuned. Nothing buys an item at it any more. */
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
}

function sample<T>(pool: readonly T[], count: number): T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    picked.push(remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
  }
  return picked;
}

/** 2-3 heroes not already on the roster. No gear: every item in the run is found, and absorbed where it is found (docs/gear-absorption.md §6). */
export function rollGuildHallOffers(
  run: RunState,
  heroPool: readonly GuildHallOffer[],
  /** Act 6's Vigil: enough recruits to fill the roster plus one. */
  muster = false
): GuildHallOffers {
  const rosterHeroIds = new Set(run.roster.map((r) => r.heroId));
  const availableHeroes = heroPool.filter((o) => !rosterHeroIds.has(o.heroId));
  // Fill the gap and leave one spare, so the Vigil still poses a choice rather than a queue.
  const heroCount = muster ? Math.max(2, ROSTER_CAP - run.roster.length + 1) : Math.random() < 0.5 ? 2 : 3;
  return { heroOfferIds: sample(availableHeroes, heroCount).map((o) => o.id) };
}

/** The Tavern's first reroll a visit; each one after costs `TAVERN_REROLL_STEP` more. Untuned. */
export const TAVERN_REROLL_BASE_COST = 10;
export const TAVERN_REROLL_STEP = 10;

export function tavernRerollCost(rerollsThisVisit: number): number {
  return TAVERN_REROLL_BASE_COST + TAVERN_REROLL_STEP * rerollsThisVisit;
}

export class TavernRerollError extends Error {}

/**
 * A fresh Tavern shelf for gold, as many heroes as the visit first rolled. Heroes on the roster
 * never come back, and the ones just turned away don't either while the pool can spare them — a
 * reroll that hands back the same face is gold for nothing.
 */
export function rerollGuildHallOffers(
  run: RunState,
  heroPool: readonly GuildHallOffer[],
  offers: GuildHallOffers,
  rerollsThisVisit: number
): { run: RunState; offers: GuildHallOffers } {
  const cost = tavernRerollCost(rerollsThisVisit);
  if (run.gold < cost) throw new TavernRerollError(`A reroll costs ${cost}g; ${run.gold}g held.`);
  const rosterHeroIds = new Set(run.roster.map((r) => r.heroId));
  const shown = new Set(offers.heroOfferIds);
  const available = heroPool.filter((o) => !rosterHeroIds.has(o.heroId));
  const fresh = available.filter((o) => !shown.has(o.id));
  const count = offers.heroOfferIds.length;
  const picked = sample(fresh, count);
  // A pool too thin to fill the shelf with new faces tops up from the ones just shown.
  if (picked.length < count) picked.push(...sample(available.filter((o) => shown.has(o.id)), count - picked.length));
  return { run: { ...run, gold: run.gold - cost }, offers: { heroOfferIds: picked.map((o) => o.id) } };
}

