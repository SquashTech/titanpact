// Items: an uncategorised list of slots per hero, attached to the roster slot (not
// the hero) so termination strips it. Owns the rarity budget and the act-scaled drop
// curve (docs/progression.md).

import type { PassiveId, StatKey, StatusGrant } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import { mergeStatMods } from './statMods';

export type EquipmentRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY_ORDER: readonly EquipmentRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

export interface EquipmentDefinition {
  id: string;
  name: string;
  rarity: EquipmentRarity;
  statGrants: Partial<Record<StatKey, number>>;
  grantsPassiveIds?: readonly PassiveId[];
  /** Magnitude-shape statuses (Elemental Force) granted for the whole fight, applied at build time (statusGrants.ts). */
  grantsStatusIds?: readonly StatusGrant[];
}

// --- Item slots ---

/** What a hero holds unless `HeroDefinition.itemSlots` says otherwise — the per-hero balance dial. */
export const BASE_ITEM_SLOTS = 1;

/** Ceiling on base + Forge grants. Every slot past this is refused, so a Forge can go dead on one hero. */
export const MAX_ITEM_SLOTS = 5;

// --- The rarity budget ---

/**
 * Points each tier is worth; every catalog item spends it EXACTLY (equipmentBudgetProblems,
 * test/equipment.test.ts).
 *
 * Raised 2026-09-06 from 10/20/30/40/50, alongside the drop from three slots to one: a hero
 * that holds a THIRD as many items needs each of them to carry roughly three times as much,
 * or the rework makes gear weaker rather than more decisive. The steps are a uniform +20 and
 * every budget halves onto a multiple of 5, which the generated type gear needs.
 *
 * Note the tier RATIO compressed on purpose — Mythic was 5x Common and is now 3.7x. An Act-1
 * Common is a hero's whole item for a while, so it cannot read as a rounding error next to
 * what Act 4 hands out.
 */
export const RARITY_BUDGET: Record<EquipmentRarity, number> = {
  common: 30,
  rare: 50,
  epic: 70,
  legendary: 90,
  mythic: 110,
};

/**
 * Points one unit of each stat costs. HP is half (never in the damage ratio); MP Regen is
 * triple (every hero's base is 10, so +10 doubles it). The first knob to turn if tiers feel
 * wrong; nothing else reads this table.
 *
 * Mana Pool went 0.5 -> 1 with the 2026-09-06 budget pass. At half price the tripled budgets
 * bought +60 to +80 Mana on a single item against a roster whose pools are 50-65 — an item
 * that more than doubles a pool prices every move's mana cost out of meaning, and mana cost
 * is the primary balance lever on reliable moves (CLAUDE.md). HP has no equivalent problem:
 * it is not a resource that gates what a hero may cast.
 */
export const STAT_POINT_VALUE: Record<StatKey, number> = {
  hp: 0.5,
  attack: 1,
  defense: 1,
  intelligence: 1,
  wisdom: 1,
  speed: 1,
  manaPool: 1,
  mpRegen: 3,
};

/**
 * Points one magnitude of Elemental Force costs. Raised from 1 with the 2026-09-06 budget pass,
 * so magnitudes roughly DOUBLE where the budgets tripled. Force is authored as flat Base Power,
 * but Base Power is multiplied by the off/def ratio — so what it contributes is percentage-shaped
 * and grows with the hero, exactly like the type-locked damage passives. Left at 1 it would have
 * tripled into +45 Base Power on a Mythic, against a median move's 50.
 */
export const FORCE_POINT_VALUE = 2;

/**
 * From this tier up, an item must carry a granted passive or an Elemental Force worth at least
 * `EFFECT_FLOOR_SHARE` of its budget (2026-09-06, per user direction). The complaint the budget
 * pass answers is that items feel imperceptible, and a bigger number alone does not fix that —
 * a +110 Attack Mythic is still a stat stick. Below Epic there is no floor: a plain, legible
 * Common is what an Act-1 item should be.
 */
export const EFFECT_FLOOR_MIN_RARITY: EquipmentRarity = 'epic';
export const EFFECT_FLOOR_SHARE = 1 / 3;

/** A negative grant refunds its full value — a downside can fund a spike. Nothing caps how much of a tier drawbacks may pay for (open question, docs/progression.md). */
function statGrantCost(stat: StatKey, amount: number): number {
  return amount * STAT_POINT_VALUE[stat];
}

/** `passiveCosts` is src/data/passives.ts PASSIVE_ITEM_COST. Returns NaN for an unpriced passive so it fails validation rather than being silently free. */
export function equipmentBudgetCost(item: EquipmentDefinition, passiveCosts: Readonly<Record<string, number>>): number {
  let cost = 0;
  for (const [stat, amount] of Object.entries(item.statGrants) as [StatKey, number | undefined][]) {
    if (amount === undefined) continue;
    cost += statGrantCost(stat, amount);
  }
  for (const grant of item.grantsStatusIds ?? []) {
    cost += (grant.magnitude ?? 0) * FORCE_POINT_VALUE;
  }
  for (const passiveId of item.grantsPassiveIds ?? []) {
    const priced = passiveCosts[passiveId];
    cost += priced === undefined ? NaN : priced;
  }
  return cost;
}

/** The part of an item's spend that is NOT stats — what the effect floor measures. NaN for an unpriced passive, same as the total. */
export function equipmentEffectSpend(item: EquipmentDefinition, passiveCosts: Readonly<Record<string, number>>): number {
  let cost = 0;
  for (const grant of item.grantsStatusIds ?? []) cost += (grant.magnitude ?? 0) * FORCE_POINT_VALUE;
  for (const passiveId of item.grantsPassiveIds ?? []) {
    const priced = passiveCosts[passiveId];
    cost += priced === undefined ? NaN : priced;
  }
  return cost;
}

/** Epic and above owe an effect; everything below is free to be plain. */
function owesAnEffect(rarity: EquipmentRarity): boolean {
  return RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(EFFECT_FLOOR_MIN_RARITY);
}

/** [] for a valid item: flat grants are multiples of 5, the tier's budget is spent exactly, and Epic+ clears the effect floor. */
export function equipmentBudgetProblems(
  item: EquipmentDefinition,
  passiveCosts: Readonly<Record<string, number>>
): string[] {
  const problems: string[] = [];
  for (const [stat, amount] of Object.entries(item.statGrants) as [StatKey, number | undefined][]) {
    if (amount !== undefined && !isValidFlatStatGrant(amount)) {
      problems.push(`${stat} grant ${amount} is not a multiple of 5`);
    }
  }
  for (const passiveId of item.grantsPassiveIds ?? []) {
    if (passiveCosts[passiveId] === undefined) problems.push(`passive '${passiveId}' has no PASSIVE_ITEM_COST entry`);
  }
  const cost = equipmentBudgetCost(item, passiveCosts);
  const budget = RARITY_BUDGET[item.rarity];
  if (Number.isFinite(cost) && cost !== budget) {
    problems.push(`spends ${cost} of its ${item.rarity} budget of ${budget}`);
  }

  if (owesAnEffect(item.rarity)) {
    const effects = equipmentEffectSpend(item, passiveCosts);
    const floor = budget * EFFECT_FLOOR_SHARE;
    if (Number.isFinite(effects) && effects < floor) {
      problems.push(
        `spends ${effects} on effects, under the ${item.rarity} floor of ${Math.ceil(floor)} — an ${item.rarity} may not be stats alone`
      );
    }
  }
  return problems;
}

// --- The act-scaled drop curve ---

/** Drop odds by LOOT TIER (index 0 unused; each row sums to 100). rarityWeightsFor maps act + source onto a tier, so "elites roll one act ahead" is one rule. */
export const RARITY_WEIGHTS_BY_TIER: readonly Record<EquipmentRarity, number>[] = [
  { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 }, // index 0 — unused
  { common: 65, rare: 30, epic: 5, legendary: 0, mythic: 0 },
  { common: 35, rare: 40, epic: 20, legendary: 5, mythic: 0 },
  { common: 15, rare: 35, epic: 30, legendary: 15, mythic: 5 },
  { common: 5, rare: 20, epic: 35, legendary: 27, mythic: 13 },
  { common: 0, rare: 10, epic: 30, legendary: 35, mythic: 25 },
  { common: 0, rare: 5, epic: 20, legendary: 40, mythic: 35 }, // tier 6 — act 5 elites/Guardian only
];

export const MAX_LOOT_TIER = RARITY_WEIGHTS_BY_TIER.length - 1;

/** The rarities an act can produce AT ALL, whatever the source — the elite tier bump can never punch through it. Inclusive [min, max] into RARITY_ORDER; index 0 unused. */
export const ACT_RARITY_WINDOW: readonly (readonly [EquipmentRarity, EquipmentRarity])[] = [
  ['common', 'mythic'], // index 0 — unused
  ['common', 'epic'], // act 1 — no legendary, no mythic
  ['common', 'legendary'], // act 2 — mythic still out of reach
  ['common', 'mythic'],
  ['common', 'mythic'],
  ['rare', 'mythic'], // act 5 — commons are gone
];

/** `elite` covers Elite nodes and the act's Guardian — both roll one loot tier ahead. */
export type LootSource = 'standard' | 'elite';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lootTierFor(actNumber: number, source: LootSource = 'standard'): number {
  return clamp(actNumber + (source === 'elite' ? 1 : 0), 1, MAX_LOOT_TIER);
}

/** The tier row intersected with the act's hard window. Every roll site in the game goes through this — one curve, not four. */
export function rarityWeightsFor(actNumber: number, source: LootSource = 'standard'): Record<EquipmentRarity, number> {
  const tier = lootTierFor(actNumber, source);
  const [minRarity, maxRarity] = ACT_RARITY_WINDOW[clamp(actNumber, 1, ACT_RARITY_WINDOW.length - 1)];
  const minIndex = RARITY_ORDER.indexOf(minRarity);
  const maxIndex = RARITY_ORDER.indexOf(maxRarity);
  const row = RARITY_WEIGHTS_BY_TIER[tier];
  const out = {} as Record<EquipmentRarity, number>;
  RARITY_ORDER.forEach((rarity, index) => {
    out[rarity] = index >= minIndex && index <= maxIndex ? row[rarity] : 0;
  });
  return out;
}

/** Act-1 standard odds — the default, so an un-threaded call site is conservative. */
export const RARITY_DROP_WEIGHTS: Record<EquipmentRarity, number> = rarityWeightsFor(1, 'standard');

/** Weighted sample of `count` distinct items. Zero-weight rarities are filtered out (not left in at 0 — float drift); the unfiltered pool is the fallback only if the filter empties it. */
export function pickWeightedEquipment(
  pool: readonly EquipmentDefinition[],
  count: number,
  weights: Record<EquipmentRarity, number> = RARITY_DROP_WEIGHTS
): EquipmentDefinition[] {
  const eligible = pool.filter((item) => weights[item.rarity] > 0);
  const remaining = eligible.length > 0 ? eligible : [...pool];
  const picked: EquipmentDefinition[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    const total = remaining.reduce((sum, item) => sum + weights[item.rarity], 0);
    let roll = Math.random() * total;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= weights[remaining[i].rarity];
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picked.push(remaining.splice(index, 1)[0]);
  }
  return picked;
}

/**
 * Held item ids in the order they were equipped. Compact — index N IS the Nth slot and a
 * hero never holds a hole, so the list's length is what fills the slot boxes. Capacity is
 * not stored here: it comes from the hero plus the entry's Forge grants (itemSlotsFor).
 */
export type EquipmentLoadout = readonly string[];

export function createEmptyLoadout(): EquipmentLoadout {
  return [];
}

/** A hero never holds two of the same item — the passive/Force grants count-stack, and one legible copy is the point. */
export function holdsItem(loadout: EquipmentLoadout, itemId: string): boolean {
  return loadout.includes(itemId);
}

export function isValidEquipmentDefinition(item: EquipmentDefinition): boolean {
  return Object.values(item.statGrants).every((amount) => amount === undefined || isValidFlatStatGrant(amount));
}

export function equipmentStatModifiers(
  loadout: EquipmentLoadout,
  equipmentLookup: Record<string, EquipmentDefinition>
): StatModifiers {
  const grants: StatModifiers[] = [];
  for (const id of loadout) {
    const item = equipmentLookup[id];
    if (!item) continue;
    grants.push(item.statGrants);
  }
  return mergeStatMods(...grants);
}

/** Appends into the next free slot, or overwrites `replaceIndex` when the hero is full. There is no stash, so callers that care read the displaced id first (runProgress.ts equipToRoster). */
export function equipItem(loadout: EquipmentLoadout, itemId: string, replaceIndex?: number): EquipmentLoadout {
  if (replaceIndex === undefined) return [...loadout, itemId];
  return loadout.map((held, i) => (i === replaceIndex ? itemId : held));
}

/** Drops the item in `index`; the slots above it shift down, since the list stays compact. */
export function unequipSlot(loadout: EquipmentLoadout, index: number): EquipmentLoadout {
  return loadout.filter((_, i) => i !== index);
}
