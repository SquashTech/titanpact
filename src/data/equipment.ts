// Item catalog (docs/equipment.md). An item is a FAMILY (stat shape + Awakening), a TIER (how
// much stat), and optionally an ENCHANTMENT (which element it feeds). Nothing is hand-authored
// per tier: the 16 families generate 80 base items, each of which generates 14 enchanted
// variants, and a handful of Uniques sit outside the ladder.
//
// Every base item spends its rarity's budget exactly (RARITY_BUDGET, equipmentBudgetProblems —
// enforced by test/equipment.test.ts). An enchant is budgeted separately (ENCHANT_FORCE_BY_RARITY),
// so it never counts against the base.

import type { StatKey } from '../engine/content';
import type { EquipmentDefinition, EquipmentFamilyId, EnchantmentId } from '../run/equipment';
import {
  ENCHANTMENTS,
  ENCHANTMENT_IDS,
  ENCHANT_FORCE_BY_RARITY,
  EQUIPMENT_FAMILIES,
  HP_PER_POINT,
  RARITY_ORDER,
  STAT_POINT_VALUE,
  enchantLabel,
  equipmentIdFor,
  maybeEnchantDrop,
  pickWeightedEquipment,
  type EquipmentRarity,
} from '../run/equipment';

// --- 1. The families ---

/**
 * Stat points a tier spends, leaving room for the flat 20-point Awakening from Epic up
 * (docs/equipment.md §3). Monotone by construction, so an Anvil upgrade never lowers a number.
 */
const STAT_POINTS_BY_RARITY: Record<EquipmentRarity, number> = {
  common: 30,
  rare: 50,
  epic: 50,
  legendary: 70,
  mythic: 90,
};

/** From this tier up a family grants its Awakening — the moment the item becomes what it is named for. */
const AWAKENING_RARITY: EquipmentRarity = 'epic';

interface FamilyDefinition {
  /** The item's whole name. An enchanted variant prefixes the enchant; nothing names the tier. */
  noun: string;
  /** Stats the family grants, splitting STAT_POINTS_BY_RARITY evenly. Overridden below where an even split cannot land on multiples of 5. */
  stats: readonly StatKey[];
  /** Granted from AWAKENING_RARITY up. Flat — the same magnitude at Epic, Legendary and Mythic. */
  awakening: string;
}

const FAMILIES: Record<EquipmentFamilyId, FamilyDefinition> = {
  sword: { noun: 'Sword', stats: ['attack'], awakening: 'sunder' },
  dagger: { noun: 'Dagger', stats: ['attack', 'speed'], awakening: 'bloodthirst' },
  greataxe: { noun: 'Greataxe', stats: ['attack', 'hp'], awakening: 'vengefulEmblem' },
  spear: { noun: 'Spear', stats: ['attack', 'defense'], awakening: 'impale' },
  bow: { noun: 'Bow', stats: ['attack', 'wisdom'], awakening: 'marksman' },
  staff: { noun: 'Staff', stats: ['intelligence'], awakening: 'overchannel' },
  wand: { noun: 'Wand', stats: ['intelligence', 'speed'], awakening: 'quickening' },
  tome: { noun: 'Tome', stats: ['intelligence', 'wisdom'], awakening: 'purifyingWard' },
  orb: { noun: 'Orb', stats: ['intelligence', 'manaPool'], awakening: 'arcaneReservoir' },
  plate: { noun: 'Plate', stats: ['defense', 'hp'], awakening: 'wardensVigil' },
  shield: { noun: 'Shield', stats: ['defense'], awakening: 'secondSkin' },
  leathers: { noun: 'Leathers', stats: ['defense', 'speed'], awakening: 'barbs' },
  robe: { noun: 'Robe', stats: ['wisdom', 'manaPool'], awakening: 'manaWard' },
  boots: { noun: 'Boots', stats: ['speed'], awakening: 'quickening' },
  ring: { noun: 'Ring', stats: ['manaPool', 'mpRegen'], awakening: 'attunement' },
  crest: { noun: 'Crest', stats: ['attack', 'defense', 'intelligence', 'wisdom', 'speed'], awakening: 'rallyingStandard' },
};

/**
 * The two families an even split cannot serve, hand-tabled instead.
 *
 * Ring holds MP Regen, which costs 3 points a unit — only point totals divisible by 15 land on a
 * multiple of 5, which an even split never does. Crest holds five stats, and a fifth of 30 is 6.
 * Both spend their tier exactly; test/equipment.test.ts checks that rather than trusting it.
 */
const STAT_OVERRIDES: Partial<Record<EquipmentFamilyId, Record<EquipmentRarity, Partial<Record<StatKey, number>>>>> = {
  ring: {
    common: { manaPool: 15, mpRegen: 5 },
    rare: { manaPool: 35, mpRegen: 5 },
    epic: { manaPool: 35, mpRegen: 5 },
    legendary: { manaPool: 40, mpRegen: 10 },
    mythic: { manaPool: 60, mpRegen: 10 },
  },
  crest: {
    common: { attack: 5, defense: 5, intelligence: 5, wisdom: 5, speed: 5, hp: 15 },
    rare: { attack: 10, defense: 10, intelligence: 10, wisdom: 10, speed: 10 },
    epic: { attack: 10, defense: 10, intelligence: 10, wisdom: 10, speed: 10 },
    legendary: { attack: 10, defense: 10, intelligence: 10, wisdom: 10, speed: 10, hp: 60 },
    mythic: { attack: 15, defense: 15, intelligence: 15, wisdom: 15, speed: 15, hp: 45 },
  },
};

/** An even split of the tier's stat points, converted to amounts through each stat's own price. */
function evenSplit(stats: readonly StatKey[], points: number): Partial<Record<StatKey, number>> {
  const each = points / stats.length;
  const grants: Partial<Record<StatKey, number>> = {};
  for (const stat of stats) grants[stat] = stat === 'hp' ? each * HP_PER_POINT : each / STAT_POINT_VALUE[stat];
  return grants;
}

function awakeningFor(family: FamilyDefinition, rarity: EquipmentRarity): readonly string[] | undefined {
  if (RARITY_ORDER.indexOf(rarity) < RARITY_ORDER.indexOf(AWAKENING_RARITY)) return undefined;
  return [family.awakening];
}

const baseEquipment: Record<string, EquipmentDefinition> = {};
for (const familyId of EQUIPMENT_FAMILIES) {
  const family = FAMILIES[familyId];
  for (const rarity of RARITY_ORDER) {
    const id = equipmentIdFor(familyId, rarity);
    const grantsPassiveIds = awakeningFor(family, rarity);
    baseEquipment[id] = {
      id,
      name: family.noun,
      rarity,
      statGrants: STAT_OVERRIDES[familyId]?.[rarity] ?? evenSplit(family.stats, STAT_POINTS_BY_RARITY[rarity]),
      familyId,
      ...(grantsPassiveIds ? { grantsPassiveIds } : {}),
    };
  }
}

// --- 2. Uniques ---

/**
 * Outside the family system: Mythic only, no family, no Awakening ladder, dropped by Guardians.
 * Not upgradeable or mergeable — being Mythic already, both are moot rather than forbidden — but
 * enchantable like anything else (docs/equipment.md §6).
 *
 * Each spends the Mythic 110 as 90 stats + one 20-point passive, or 70 + two.
 */
const uniqueEquipment: Record<string, EquipmentDefinition> = {
  worldbreaker: {
    id: 'worldbreaker',
    name: 'Worldbreaker',
    rarity: 'mythic',
    statGrants: { attack: 50, hp: 60 },
    grantsStatusIds: [{ statusId: 'IronForce', magnitude: 20 }],
  },
  guardianPlate: {
    id: 'guardianPlate',
    name: 'Guardian Plate',
    rarity: 'mythic',
    statGrants: { hp: 105, defense: 55 },
    grantsPassiveIds: ['secondSkin'],
  },
  aegisEternal: {
    id: 'aegisEternal',
    name: 'Aegis Eternal',
    rarity: 'mythic',
    statGrants: { hp: 90, defense: 40 },
    grantsPassiveIds: ['wardensVigil', 'purifyingWard'],
  },
  archonsStaff: {
    id: 'archonsStaff',
    name: "Archon's Staff",
    rarity: 'mythic',
    statGrants: { intelligence: 70, manaPool: 20 },
    grantsPassiveIds: ['arcaneReservoir'],
  },
  duskreaverScythe: {
    id: 'duskreaverScythe',
    name: 'Duskreaver Scythe',
    rarity: 'mythic',
    statGrants: { attack: 55, speed: 35 },
    grantsPassiveIds: ['bloodthirst'],
  },
  crownOfTheAncients: {
    id: 'crownOfTheAncients',
    name: 'Crown of the Ancients',
    rarity: 'mythic',
    statGrants: { hp: 90, attack: 15, defense: 15, intelligence: 15, wisdom: 15 },
    grantsPassiveIds: ['rallyingStandard'],
  },
};

// --- 3. Enchanted variants ---

/** Every base item crossed with every enchant. Lookup only — drops roll a base and enchant it (rollEnchantment). */
function enchantedVariants(item: EquipmentDefinition): Record<string, EquipmentDefinition> {
  const out: Record<string, EquipmentDefinition> = {};
  for (const enchantId of ENCHANTMENT_IDS) {
    const parsed = item.familyId ? item.familyId : item.id;
    const id = equipmentIdFor(parsed, item.familyId ? item.rarity : null, enchantId);
    out[id] = {
      ...item,
      id,
      name: `${enchantLabel(enchantId)} ${item.name}`,
      enchantId,
      grantsStatusIds: [
        ...(item.grantsStatusIds ?? []),
        { statusId: `${ENCHANTMENTS[enchantId]}Force`, magnitude: ENCHANT_FORCE_BY_RARITY[item.rarity] },
      ],
    };
  }
  return out;
}

const enchanted: Record<string, EquipmentDefinition> = {};
for (const item of [...Object.values(baseEquipment), ...Object.values(uniqueEquipment)]) {
  Object.assign(enchanted, enchantedVariants(item));
}

// --- Exports ---

/** Every item that exists, keyed by id — the lookup, not the drop table. */
export const equipment: Record<string, EquipmentDefinition> = {
  ...baseEquipment,
  ...uniqueEquipment,
  ...enchanted,
};

/**
 * What a drop may roll: the 80 unenchanted family items. Uniques are Guardian-only and enchanted
 * variants are reached by rolling an enchant ON a drop, not by sitting in the pool — leaving them
 * in would make an enchanted item 14x commoner than a plain one.
 */
export const EQUIPMENT_DROP_POOL: readonly EquipmentDefinition[] = Object.values(baseEquipment);

/** Guardian rewards, one per act (docs/equipment.md §6). */
export const UNIQUE_EQUIPMENT: readonly EquipmentDefinition[] = Object.values(uniqueEquipment);

export const EQUIPMENT_FAMILY_NOUNS: Readonly<Record<EquipmentFamilyId, string>> = Object.fromEntries(
  EQUIPMENT_FAMILIES.map((id) => [id, FAMILIES[id].noun])
) as Record<EquipmentFamilyId, string>;

/**
 * What every drop site rolls: `count` distinct family items on the act's curve, each with a
 * chance of arriving already enchanted. The one place the pool and the enchant roll are composed,
 * so no call site can accidentally sample the 1,200-entry lookup.
 */
export function rollEquipmentDrops(
  count: number,
  weights: Record<EquipmentRarity, number>,
  enchantChance?: number
): EquipmentDefinition[] {
  return pickWeightedEquipment(EQUIPMENT_DROP_POOL, count, weights).map((item) =>
    maybeEnchantDrop(item, equipment, enchantChance)
  );
}
