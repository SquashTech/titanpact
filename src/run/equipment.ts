// Equipment: 3 slots per hero, attached to the roster slot (not the hero) so
// termination strips it. Owns the rarity budget and the act-scaled drop curve
// (docs/progression.md).

import type { PassiveId, StatKey, StatusGrant } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import { mergeStatMods } from './statMods';

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

export type EquipmentRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY_ORDER: readonly EquipmentRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

export interface EquipmentDefinition {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  statGrants: Partial<Record<StatKey, number>>;
  grantsPassiveIds?: readonly PassiveId[];
  /** Magnitude-shape statuses (Elemental Force) granted for the whole fight, applied at build time (statusGrants.ts). */
  grantsStatusIds?: readonly StatusGrant[];
}

// --- The rarity budget ---

/** Points each tier is worth; every catalog item spends it EXACTLY (equipmentBudgetProblems, test/equipment.test.ts). */
export const RARITY_BUDGET: Record<EquipmentRarity, number> = {
  common: 10,
  rare: 20,
  epic: 30,
  legendary: 40,
  mythic: 50,
};

/**
 * Points one unit of each stat costs. HP/Mana are half (never in the damage
 * ratio); MP Regen is triple (every hero's base is 10, so +10 doubles it).
 * The first knob to turn if tiers feel wrong; nothing else reads this table.
 */
export const STAT_POINT_VALUE: Record<StatKey, number> = {
  hp: 0.5,
  attack: 1,
  defense: 1,
  intelligence: 1,
  wisdom: 1,
  speed: 1,
  manaPool: 0.5,
  mpRegen: 3,
};

/** Points one magnitude of Elemental Force costs — pinned by the "Torch: 5 Attack, 5 Fire Force = Common" example. */
export const FORCE_POINT_VALUE = 1;

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

/** [] for a valid item: flat grants are multiples of 5, and the tier's budget is spent exactly. */
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

/** One item of a fixed slot (the weapon/armor/accessoryReward nodes). */
export function pickWeightedEquipmentBySlot(
  pool: readonly EquipmentDefinition[],
  slot: EquipmentSlot,
  weights: Record<EquipmentRarity, number> = RARITY_DROP_WEIGHTS
): EquipmentDefinition | undefined {
  return pickWeightedEquipment(
    pool.filter((item) => item.slot === slot),
    1,
    weights
  )[0];
}

export type EquipmentLoadout = Record<EquipmentSlot, string | null>;

export function createEmptyLoadout(): EquipmentLoadout {
  return { weapon: null, armor: null, accessory: null };
}

export function isValidEquipmentDefinition(item: EquipmentDefinition): boolean {
  return Object.values(item.statGrants).every((amount) => amount === undefined || isValidFlatStatGrant(amount));
}

export function equipmentStatModifiers(
  loadout: EquipmentLoadout,
  equipmentLookup: Record<string, EquipmentDefinition>
): StatModifiers {
  const grants: StatModifiers[] = [];
  for (const slot of Object.keys(loadout) as EquipmentSlot[]) {
    const id = loadout[slot];
    if (!id) continue;
    const item = equipmentLookup[id];
    if (!item) continue;
    grants.push(item.statGrants);
  }
  return mergeStatMods(...grants);
}

/** Replaces whatever was in the slot; there is no stash, so callers that care read the slot first (runProgress.ts equipToRoster). */
export function equipItem(loadout: EquipmentLoadout, item: EquipmentDefinition): EquipmentLoadout {
  return { ...loadout, [item.slot]: item.id };
}

export function unequipSlot(loadout: EquipmentLoadout, slot: EquipmentSlot): EquipmentLoadout {
  return { ...loadout, [slot]: null };
}
