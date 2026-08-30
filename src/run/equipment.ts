// Equipment (docs/progression.md "Equipment (per-hero)"). 3 slots per hero:
// weapon, armor, accessory. Modeled as attached to the roster slot
// (RosterEntry, state.ts), not the hero object, so termination cleanly
// reclaims it: "Equipment strips on contract termination... Model equipment
// as attached to the hero's roster slot, not permanently bound to the hero
// object" (progression.md).
//
// SCOPE NOTE: stat grants below are the flat-additive half of the pipeline
// discipline (docs/architecture.md "two damage pipelines" / "Equipment and
// relics use the same hook-and-condition system as abilities", CLAUDE.md).
// The hook-and-condition system that note was waiting on now exists
// (engine/content.ts PassiveDefinition, engine/combat/passiveEngine.ts) —
// `grantsPassiveIds` below is equipment's side of that wiring.
//
// This file owns two economies on top of that model, both added 2026-08-30
// per user direction:
//   1. The RARITY BUDGET — what a tier is allowed to be worth at all
//      (RARITY_BUDGET / equipmentBudgetCost below).
//   2. The ACT-SCALED DROP CURVE — which tiers a given act can even roll
//      (RARITY_WEIGHTS_BY_TIER / ACT_RARITY_WINDOW / rarityWeightsFor below).

import type { PassiveId, StatKey, StatusGrant } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import { mergeStatMods } from './statMods';

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

/** Gray/blue/purple/gold/red — common through mythic, low to high. Drives the rarity budget (RARITY_BUDGET), the act-scaled drop odds (rarityWeightsFor) and the tier color shown in the UI (view/shared/EquipmentBox.tsx RARITY_COLOR_VARS). */
export type EquipmentRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY_ORDER: readonly EquipmentRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

export interface EquipmentDefinition {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  /** Flat additive grants (CLAUDE.md "Stat modifiers are flat additive integers, multiples of 5 or 10"). */
  statGrants: Partial<Record<StatKey, number>>;
  /** Passives (engine/content.ts PassiveDefinition, src/data/passives.ts) this item grants while equipped. Optional/omitted for plain stat-only gear. */
  grantsPassiveIds?: readonly PassiveId[];
  /** Persistent magnitude-shape statuses (currently Elemental Force — src/data/statuses.ts) this item grants for the whole fight while equipped, applied at fight-build time (src/run/statusGrants.ts, buildCombatState.ts). Optional/omitted for gear that doesn't grant one. */
  grantsStatusIds?: readonly StatusGrant[];
}

// ---------------------------------------------------------------------------
// The rarity budget
// ---------------------------------------------------------------------------

/**
 * What one item of each tier is worth, in POINTS (user direction 2026-08-30:
 * "common ... roughly 10 total stats. rare should be 20. epic 30. legendary
 * 40. mythic 50. OR equivalent in terms of powerful passives or other
 * effects"). Every item in src/data/equipment.ts spends its tier's budget
 * EXACTLY — see equipmentBudgetProblems, which the equipment test asserts
 * over the whole catalog, so a new item can't quietly come in under- or
 * over-curve.
 *
 * The budget is the balance contract for the whole slot economy: three slots
 * x 6 heroes means a late run can be carrying ~9 items of gear, and without a
 * per-tier ceiling the difference between two mythics is unbounded.
 */
export const RARITY_BUDGET: Record<EquipmentRarity, number> = {
  common: 10,
  rare: 20,
  epic: 30,
  legendary: 40,
  mythic: 50,
};

/**
 * Points one unit of each stat costs against RARITY_BUDGET.
 *
 * ⚠️ THIS IS THE ONE JUDGMENT CALL LAYERED ON TOP OF THE USER'S SPEC, and it
 * is the first knob to turn if the tiers feel wrong. The spec says "roughly
 * 10 total stats" for a common, which reads as 1 point per stat unit — and
 * that is exactly what the offensive/defensive five cost here. But the stat
 * line is not commensurate at 1:1:
 *
 *   - HP: heroes sit at 80-110 base, and HP never enters the damage ratio at
 *     all (CLAUDE.md's locked formula uses Attack/Defense or Int/Wisdom). 10
 *     HP on a 100-HP hero is a 10% swing; 10 Attack on a 70-Attack hero is
 *     ~14% MORE damage on every hit. At 1:1 every HP item would be a trap
 *     pick, which the north star ("no hero is a trap pick") forbids for the
 *     gear that makes heroes viable. So HP is priced at HALF.
 *   - manaPool: same reasoning — a tempo resource, not a damage term, and
 *     overflow (CLAUDE.md, Arcane) already lets mana exceed the pool. Half.
 *   - mpRegen: the opposite problem. EVERY hero has a base of exactly 10
 *     (src/data/heroes.ts), so +10 is a 100% swing in the resource-cycling
 *     engine the whole switching game runs on. Priced at TRIPLE.
 *
 * If the designer would rather have a literal flat count, set every entry to
 * 1 and re-budget the catalog; nothing else reads this table.
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

/**
 * Points one magnitude of an Elemental Force grant costs. Pinned at 1 by the
 * user's own worked example — "Torch | 5 Attack. 5 Fire Force. | Common" is a
 * 10-point common, so 5 Force must cost the same as 5 Attack.
 *
 * It holds up numerically: Force adds to BasePower BEFORE every multiplier
 * (engine/damage/damagePipeline.ts resolveElementalForceBonus), and moves sit
 * at 40-60 BasePower, so +5 Force is roughly +10% damage against +5 Attack's
 * ~+7% — but only on ONE of the 15 types, where Attack is unconditional.
 */
export const FORCE_POINT_VALUE = 1;

/** A negative stat grant refunds its full point value back into the budget, letting a downside fund a spike (Berserker's Cleaver, src/data/equipment.ts). See docs/progression.md for the open question this leaves — nothing currently caps how much of a tier can be paid for with drawbacks. */
function statGrantCost(stat: StatKey, amount: number): number {
  return amount * STAT_POINT_VALUE[stat];
}

/**
 * What an item actually spends. `passiveCosts` prices the hook-driven half of
 * the economy — the user's "OR equivalent in terms of powerful passives or
 * other effects" — and lives in src/data/passives.ts (PASSIVE_ITEM_COST)
 * rather than on PassiveDefinition, because what a passive is WORTH IN AN ITEM
 * is an equipment-economy question the engine has no opinion about.
 *
 * Returns NaN when the item grants a passive nobody has priced — deliberately
 * loud, so an unpriced passive fails validation instead of being silently
 * free.
 */
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

/** Every way an item can violate the two rules that govern authored gear: flat grants must be multiples of 5 (CLAUDE.md), and the item must spend its tier's budget exactly. Returns [] for a valid item; the equipment test runs this over the whole catalog. */
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

// ---------------------------------------------------------------------------
// The act-scaled drop curve
// ---------------------------------------------------------------------------

/**
 * Drop odds by LOOT TIER, not by act directly — `rarityWeightsFor` maps an act
 * (and whether the source is an elite/Guardian) onto a tier, so "an elite
 * rolls one act ahead" is one rule rather than a second table. Rows are
 * indexed 1..6 (index 0 is unused padding) and each sums to 100, so a row
 * reads as a percentage.
 *
 * The shape is the user's brief: "spawn rates ... adjust as the run goes on
 * ... to account for increasing power levels of enemies". Common is the bulk
 * of act 1 and gone by act 5; legendary/mythic start at zero and become the
 * bulk of the end of the run.
 */
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

/**
 * The rarities an act can produce AT ALL, whatever the source. This is the
 * hard half of the brief — "Legendary and Mythic equipment should be
 * impossible to find in Act 1, but common items should be impossible to find
 * in Act 5" — and it is deliberately separate from the weight rows above so
 * the elite tier bump can never punch through it. An act-1 elite rolls tier 2
 * odds, which include 5% legendary; this window zeroes that back out.
 *
 * Entries are inclusive [min, max] indices into RARITY_ORDER.
 */
export const ACT_RARITY_WINDOW: readonly (readonly [EquipmentRarity, EquipmentRarity])[] = [
  ['common', 'mythic'], // index 0 — unused
  ['common', 'epic'], // act 1 — no legendary, no mythic
  ['common', 'legendary'], // act 2 — mythic still out of reach
  ['common', 'mythic'],
  ['common', 'mythic'],
  ['rare', 'mythic'], // act 5 — commons are gone
];

/** Where an item drop comes from. `elite` covers Elite nodes and the act's Guardian — both roll one loot tier ahead of a plain fight (still clamped by ACT_RARITY_WINDOW). */
export type LootSource = 'standard' | 'elite';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** The loot tier an act/source pair rolls on. Split out from rarityWeightsFor so the "elites roll one act ahead" rule is stated once and testable on its own. */
export function lootTierFor(actNumber: number, source: LootSource = 'standard'): number {
  return clamp(actNumber + (source === 'elite' ? 1 : 0), 1, MAX_LOOT_TIER);
}

/**
 * The drop weights an act/source pair actually rolls against: the tier row,
 * intersected with the act's hard rarity window. Every roll site in the game
 * goes through this — equipment reward caches (NodeRewardScreen), the
 * per-slot reward nodes and post-fight drops (App.tsx), and the Guild Hall
 * shelf (run/shop.ts) — so there is one curve, not four.
 */
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

/** Act-1 standard odds, the weights a caller gets if it names none — the gentlest curve in the game, so an un-threaded call site is conservative rather than jackpot-y. */
export const RARITY_DROP_WEIGHTS: Record<EquipmentRarity, number> = rarityWeightsFor(1, 'standard');

/**
 * Weighted sample of `count` distinct items from `pool`, biased per `weights`
 * (defaults to act-1 standard odds).
 *
 * Zero-weight rarities are FILTERED OUT rather than left in at weight 0:
 * "impossible to find in Act 1" has to mean impossible, and a plain weighted
 * walk can still land on a zero-weight entry through float drift or a
 * zero-total pool. The unfiltered pool is the fallback only when the filter
 * empties it, so a caller that asks for an item always gets one.
 */
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

/** Rolls a single item restricted to one slot, same weighting as `pickWeightedEquipment` — used by the `weaponReward`/`armorReward`/`accessoryReward` map nodes (App.tsx), which grant one guaranteed item of a fixed slot rather than a 3-choice pick across mixed slots. */
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

/** Sums the stat grants of every equipped item into the shape the stat pipeline consumes. */
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

/** Equips an item into its own slot, replacing whatever was there. Callers that care what got replaced (there is no stash to fall back on — see runProgress.ts equipToRoster) should read the slot before calling this. */
export function equipItem(loadout: EquipmentLoadout, item: EquipmentDefinition): EquipmentLoadout {
  return { ...loadout, [item.slot]: item.id };
}

export function unequipSlot(loadout: EquipmentLoadout, slot: EquipmentSlot): EquipmentLoadout {
  return { ...loadout, [slot]: null };
}
