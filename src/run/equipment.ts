// Items: an uncategorised list of slots per hero, attached to the roster slot (not
// the hero) so termination strips it. Owns the rarity budget and the act-scaled drop
// curve (docs/progression.md).

import type { PassiveId, StatKey, StatusGrant } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import { mergeStatMods } from './statMods';
import type { EncounterNodeKind } from './difficulty';

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
  /** The family this item belongs to; absent on a Unique, which sits outside the ladder (docs/equipment.md §6). */
  familyId?: EquipmentFamilyId;
  /** The bound element, if any. Uniques carry this too — they are enchantable, just not upgradeable. */
  enchantId?: EnchantmentId;
}

// --- Families, tiers and enchantments (docs/equipment.md) ---

/**
 * The 16 item families. An item's family decides its stat shape and its Awakening; its rarity
 * decides how much stat; its enchantment decides which element it feeds. Three axes, and the
 * player reads all three off three words: "Blazing Steel Spear".
 */
export const EQUIPMENT_FAMILIES = [
  'sword', 'dagger', 'greataxe', 'spear', 'bow',
  'staff', 'wand', 'tome', 'orb',
  'plate', 'shield', 'leathers', 'robe',
  'boots', 'ring', 'crest',
] as const;

export type EquipmentFamilyId = (typeof EQUIPMENT_FAMILIES)[number];

/**
 * An item's NAME is its family noun, and an enchanted one takes the enchant as a prefix:
 * "Sword", "Blazing Sword". Nothing in the name says which tier it is.
 *
 * A tier adjective (Iron/Steel/Etched/...) was tried first and dropped 2026-09-07, per user
 * direction — it overcomplicated the read for a distinction the UI already carries twice, in
 * the rarity colour every item box is bordered with and in the rarity label on every card. A
 * five-word item name is a worse answer to "which Sword is this?" than a purple border.
 */

/**
 * One per type EXCEPT Ancient (per user direction), matching the precedent the retired generated
 * type gear already set. The value is the `${type}Force` status the enchant grants.
 */
export const ENCHANTMENTS = {
  blazing: 'Fire',
  tidal: 'Water',
  rimed: 'Frost',
  thundering: 'Storm',
  granite: 'Stone',
  verdant: 'Nature',
  radiant: 'Light',
  umbral: 'Shadow',
  runed: 'Arcane',
  psionic: 'Mind',
  haunted: 'Spirit',
  tempered: 'Iron',
  geared: 'Mech',
  feral: 'Beast',
} as const;

export type EnchantmentId = keyof typeof ENCHANTMENTS;

export const ENCHANTMENT_IDS = Object.keys(ENCHANTMENTS) as readonly EnchantmentId[];

/** Display form of an enchant id — the adjective an item's name is built from ("blazing" -> "Blazing"). */
export function enchantLabel(enchantId: EnchantmentId): string {
  return enchantId.charAt(0).toUpperCase() + enchantId.slice(1);
}

/**
 * Elemental Force an enchant grants, by the item's tier. The ONE thing besides stats that still
 * scales with rarity — Awakenings are flat (§3) — which is what makes enchanting a Mythic worth
 * more than enchanting a Common, and what the Enchanter's tier-priced fee is charging for.
 *
 * Budgeted SEPARATELY from RARITY_BUDGET: an enchanted item is a base item plus a bolt-on, so
 * `equipmentBudgetProblems` still audits the base exactly as it always did.
 */
export const ENCHANT_FORCE_BY_RARITY: Record<EquipmentRarity, number> = {
  common: 5,
  rare: 10,
  epic: 15,
  legendary: 20,
  mythic: 25,
};

const ID_SEPARATOR = '.';

/** `sword.epic` or `sword.epic.blazing`; a Unique is `worldbreaker` or `worldbreaker.blazing`. */
export function equipmentIdFor(base: string, rarity: EquipmentRarity | null, enchantId?: EnchantmentId): string {
  return [base, rarity, enchantId].filter((part): part is string => Boolean(part)).join(ID_SEPARATOR);
}

export interface ParsedEquipmentId {
  /** The family id, or the Unique's own id. */
  base: string;
  /** null for a Unique, whose rarity is authored rather than encoded. */
  rarity: EquipmentRarity | null;
  enchantId?: EnchantmentId;
}

const FAMILY_SET: ReadonlySet<string> = new Set(EQUIPMENT_FAMILIES);

/** Splits a composite id back into its axes. Tolerates a Unique, whose middle segment is absent. */
export function parseEquipmentId(id: string): ParsedEquipmentId {
  const parts = id.split(ID_SEPARATOR);
  const base = parts[0];
  if (FAMILY_SET.has(base)) {
    return {
      base,
      rarity: (parts[1] as EquipmentRarity) ?? null,
      ...(parts[2] ? { enchantId: parts[2] as EnchantmentId } : {}),
    };
  }
  return { base, rarity: null, ...(parts[1] ? { enchantId: parts[1] as EnchantmentId } : {}) };
}

/** The same item without its enchant — the identity a merge and an Anvil upgrade are measured on. */
export function unenchantedIdOf(id: string): string {
  const parsed = parseEquipmentId(id);
  return equipmentIdFor(parsed.base, parsed.rarity);
}

// --- Item slots ---

/** What every hero holds at the start of a run. There is no per-hero override; the Forge is the only way up (itemSlotsFor). */
export const BASE_ITEM_SLOTS = 1;

/**
 * Ceiling on base + Forge grants. Every slot past this is refused, so a Forge can go dead on one
 * hero — which is what makes spending it a choice.
 *
 * 5 -> 3 (2026-09-07, per user direction). Manage Roster lays the squad out two cards across with
 * a slot row under each hero, and three is what a half-width card seats on a phone; five wrapped
 * to a second row that was empty on almost every hero. The knock-on is real and intended: the
 * nine heroes authored at `itemSlots` 2 are now **one Forge from the cap** rather than three, so
 * the node goes dead across a roster sooner and lands harder while it still bites.
 */
export const MAX_ITEM_SLOTS = 3;

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
 * Points one unit of each stat costs. HP is a quarter (never in the damage ratio, and authored
 * in the doubled units the HP bar draws); MP Regen is triple (every hero's base is 10, so +10
 * doubles it). The first knob to turn if tiers feel wrong; nothing else reads this table.
 *
 * Mana Pool went 0.5 -> 1 with the 2026-09-06 budget pass. At half price the tripled budgets
 * bought +60 to +80 Mana on a single item against a roster whose pools are 50-65 — an item
 * that more than doubles a pool prices every move's mana cost out of meaning, and mana cost
 * is the primary balance lever on reliable moves (CLAUDE.md). HP has no equivalent problem:
 * it is not a resource that gates what a hero may cast.
 *
 * HP went 0.5 -> 0.25 when the HP x2 was baked into the authored lines: the same item, the same
 * budget, twice the printed figure. Whether a quarter is the RIGHT price is a separate and older
 * question — the hero roster charges 1.0 since 2026-09-09 and enemy lines 0.5, so the three
 * disagree by 4x and the measured break-even (~0.33) is nearest this one. Deliberate, not drift:
 * docs/progression.md "Pricing HP".
 */
export const STAT_POINT_VALUE: Record<StatKey, number> = {
  hp: 0.25,
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
 * `EFFECT_FLOOR` points (2026-09-06, per user direction). The complaint the budget pass answers
 * is that items feel imperceptible, and a bigger number alone does not fix that — a +110 Attack
 * Mythic is still a stat stick. Below Epic there is no floor: a plain, legible Common is what an
 * Act-1 item should be.
 *
 * FLAT rather than a share of the budget (2026-09-07, per user direction). A share requires the
 * effect column to grow every tier, and an Awakening is flat by design — the tier buys stats,
 * the family buys the effect (docs/equipment.md §3). 20 is exactly one Awakening, so the floor
 * reads as "an Epic or better owes at least one effect" rather than as an arithmetic hurdle.
 */
export const EFFECT_FLOOR_MIN_RARITY: EquipmentRarity = 'epic';
export const EFFECT_FLOOR = 20;

/** A negative grant refunds its full value — a downside can fund a spike. Nothing caps how much of a tier drawbacks may pay for (open question, docs/progression.md). */
function statGrantCost(stat: StatKey, amount: number): number {
  return amount * STAT_POINT_VALUE[stat];
}

/**
 * The item with its enchant stripped — what the rarity budget is measured against, since an
 * enchant is a bolt-on with its own separate budget (ENCHANT_FORCE_BY_RARITY). Removes exactly
 * one matching Force grant, so a Unique that already grants Force of the same type keeps its own.
 */
export function baseItemOf(item: EquipmentDefinition): EquipmentDefinition {
  if (!item.enchantId) return item;
  const forceStatusId = `${ENCHANTMENTS[item.enchantId]}Force`;
  const magnitude = ENCHANT_FORCE_BY_RARITY[item.rarity];
  let stripped = false;
  const grantsStatusIds = (item.grantsStatusIds ?? []).filter((grant) => {
    if (!stripped && grant.statusId === forceStatusId && grant.magnitude === magnitude) {
      stripped = true;
      return false;
    }
    return true;
  });
  const { enchantId, ...rest } = item;
  return { ...rest, grantsStatusIds };
}

/** `passiveCosts` is src/data/passives.ts PASSIVE_ITEM_COST. Returns NaN for an unpriced passive so it fails validation rather than being silently free. */
export function equipmentBudgetCost(item: EquipmentDefinition, passiveCosts: Readonly<Record<string, number>>): number {
  const base = baseItemOf(item);
  let cost = 0;
  for (const [stat, amount] of Object.entries(base.statGrants) as [StatKey, number | undefined][]) {
    if (amount === undefined) continue;
    cost += statGrantCost(stat, amount);
  }
  for (const grant of base.grantsStatusIds ?? []) {
    cost += (grant.magnitude ?? 0) * FORCE_POINT_VALUE;
  }
  for (const passiveId of base.grantsPassiveIds ?? []) {
    const priced = passiveCosts[passiveId];
    cost += priced === undefined ? NaN : priced;
  }
  return cost;
}

/** The part of an item's spend that is NOT stats — what the effect floor measures. NaN for an unpriced passive, same as the total. */
export function equipmentEffectSpend(item: EquipmentDefinition, passiveCosts: Readonly<Record<string, number>>): number {
  const base = baseItemOf(item);
  let cost = 0;
  for (const grant of base.grantsStatusIds ?? []) cost += (grant.magnitude ?? 0) * FORCE_POINT_VALUE;
  for (const passiveId of base.grantsPassiveIds ?? []) {
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
    if (Number.isFinite(effects) && effects < EFFECT_FLOOR) {
      problems.push(
        `spends ${effects} on effects, under the floor of ${EFFECT_FLOOR} — an ${item.rarity} may not be stats alone`
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

/**
 * The best tier an act allows, whatever the path. `ACT_RARITY_WINDOW` began life capping DROPS
 * only; with a purchasable Anvil and a free merge, a rich or lucky player would simply buy or
 * merge past it, so every path is measured against this one rule instead of three new ones
 * (docs/equipment.md §5). Holding a pair of Legendaries through Act 2 waiting for the window to
 * open is anticipation, not a bug.
 */
export function maxRarityForAct(actNumber: number): EquipmentRarity {
  return ACT_RARITY_WINDOW[clamp(actNumber, 1, ACT_RARITY_WINDOW.length - 1)][1];
}

/** Whether an act permits an item to reach `rarity` at all — the gate on the Anvil and on a merge. */
export function actAllowsRarity(actNumber: number, rarity: EquipmentRarity): boolean {
  return RARITY_ORDER.indexOf(rarity) <= RARITY_ORDER.indexOf(maxRarityForAct(actNumber));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lootTierFor(actNumber: number, source: LootSource = 'standard'): number {
  return clamp(actNumber + (source === 'elite' ? 1 : 0), 1, MAX_LOOT_TIER);
}

/**
 * Chance a won encounter pays an item, by map node type. Monsters always drop; Skirmish rolls.
 *
 * Raised 2026-09-08 (skirmish 0.25 -> 0.60, elite 0.55 -> 0.80, boss 0.70 -> 0.95) to pay back the
 * difficulty the universal one-slot change cost: removing the nine heroes' second slot took the
 * measured full-clear rate from 11.4% to 7.5%. `fight` and `battle` were already at 1 and had no
 * headroom, so the whole correction lands on the three that did.
 *
 * This table and LOOT_SOURCE lived in BOTH App.tsx and scripts/sim/run.ts until this pass, hand-
 * synced. They are here now because a simulator measuring different drop odds than the game ships
 * is worse than no simulator.
 */
export const EQUIPMENT_DROP_CHANCE: Record<EncounterNodeKind, number> = {
  fight: 1,
  battle: 1,
  skirmish: 0.6,
  elite: 0.8,
  boss: 0.95,
  finale: 0,
};

/** Elite and Guardian roll one loot tier ahead (lootTierFor). */
export const LOOT_SOURCE: Record<EncounterNodeKind, LootSource> = {
  fight: 'standard',
  battle: 'standard',
  skirmish: 'standard',
  elite: 'elite',
  boss: 'elite',
  finale: 'elite',
};

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
 * How often a dropped item arrives already enchanted — "sometimes a player may find an enchanted
 * Spear that replaces their normal Spear". This is the ONLY way an enchanted item reaches the
 * drop table: the pool itself holds bases only, since leaving all 14 variants in would make an
 * enchanted item 14x commoner than a plain one rather than a quarter as common.
 *
 * Untuned first-pass figure.
 */
export const ENCHANT_DROP_CHANCE = 0.25;

/** Rolls an enchant onto a freshly dropped item. Already-enchanted items and unknown variants pass through unchanged. */
export function maybeEnchantDrop(
  item: EquipmentDefinition,
  equipmentLookup: Record<string, EquipmentDefinition>,
  chance: number = ENCHANT_DROP_CHANCE
): EquipmentDefinition {
  if (item.enchantId !== undefined || Math.random() >= chance) return item;
  const enchantId = ENCHANTMENT_IDS[Math.floor(Math.random() * ENCHANTMENT_IDS.length)];
  const id = equipmentIdFor(item.familyId ?? item.id, item.familyId ? item.rarity : null, enchantId);
  return equipmentLookup[id] ?? item;
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

/**
 * A hero never holds two items of the same FAMILY — not merely two of the same id. Every tier of
 * a family grants the same Awakening, so an Etched Sword beside a Godforged one would count-stack
 * Sunder while both cards show it once. Comparing the id's BASE covers a Unique too, which has no
 * family: Worldbreaker and Blazing Worldbreaker are still one item.
 */
export function holdsItem(loadout: EquipmentLoadout, itemId: string): boolean {
  const base = parseEquipmentId(itemId).base;
  return loadout.some((held) => parseEquipmentId(held).base === base);
}

// --- Merging ---

/**
 * Two items of the same family and tier combine into one of the next tier, free (docs/equipment.md
 * §5). Enchantments are ignored for eligibility — if either input carries one the player picks
 * which survives — so an enchanted duplicate is always good news rather than a blocker.
 *
 * A Mythic has nothing above it, and a Unique has no ladder to climb.
 */
export function canMergeItems(a: EquipmentDefinition, b: EquipmentDefinition): boolean {
  if (a.familyId === undefined || b.familyId === undefined) return false;
  if (a.familyId !== b.familyId) return false;
  if (a.rarity !== b.rarity) return false;
  return nextRarity(a.rarity) !== null;
}

export function nextRarity(rarity: EquipmentRarity): EquipmentRarity | null {
  return RARITY_ORDER[RARITY_ORDER.indexOf(rarity) + 1] ?? null;
}

/** The id a merge produces. `keepEnchantId` is the player's pick between the two inputs' enchants. */
export function mergeResultId(item: EquipmentDefinition, keepEnchantId?: EnchantmentId): string | null {
  const up = nextRarity(item.rarity);
  if (up === null || item.familyId === undefined) return null;
  return equipmentIdFor(item.familyId, up, keepEnchantId);
}

/** The enchants a merge may keep — at most one, so two enchanted inputs pose a choice and two plain ones pose none. */
export function mergeEnchantChoices(a: EquipmentDefinition, b: EquipmentDefinition): EnchantmentId[] {
  const choices = [a.enchantId, b.enchantId].filter((id): id is EnchantmentId => id !== undefined);
  return [...new Set(choices)];
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

/** Appends into the next free slot, or overwrites `replaceIndex` when the hero is full. Whatever it overwrites goes to the stash — callers read the displaced id first (runProgress.ts equipToRoster). */
export function equipItem(loadout: EquipmentLoadout, itemId: string, replaceIndex?: number): EquipmentLoadout {
  if (replaceIndex === undefined) return [...loadout, itemId];
  return loadout.map((held, i) => (i === replaceIndex ? itemId : held));
}

/** Drops the item in `index`; the slots above it shift down, since the list stays compact. */
export function unequipSlot(loadout: EquipmentLoadout, index: number): EquipmentLoadout {
  return loadout.filter((_, i) => i !== index);
}

// --- The stash ---

/**
 * Unequipped items the player is carrying (docs/progression.md "The stash"). Unlike a loadout
 * it MAY hold two of the same item — one copy per hero is the rule, and two heroes may want it.
 */
export type Stash = readonly string[];

/**
 * The bag is UNCAPPED (2026-09-08, per user direction), so this never refuses. `STASH_CAPACITY`
 * and `stashIsFull` are gone with the cap — see docs/progression.md "The uncapped bag".
 */
export function addToStash(stash: Stash, itemId: string): Stash {
  return [...stash, itemId];
}

export function removeFromStash(stash: Stash, index: number): Stash {
  return stash.filter((_, i) => i !== index);
}

/**
 * Bag items the player has not looked at yet (docs/progression.md "The bag notification").
 * Held as item IDS, not bag indices: merging, selling and equipping all reshuffle indices, and
 * a parallel array would have to be rewritten by each of them to stay aligned. Two copies of one
 * id share one mark, which is the honest reading anyway — what is unchecked is the ITEM, not the
 * slot it happens to be sitting in.
 */
export type UnseenItems = readonly string[];

export function markItemUnseen(unseen: UnseenItems, itemId: string): UnseenItems {
  return unseen.includes(itemId) ? unseen : [...unseen, itemId];
}

export function markItemSeen(unseen: UnseenItems, itemId: string): UnseenItems {
  return unseen.includes(itemId) ? unseen.filter((id) => id !== itemId) : unseen;
}

/** Drops marks whose item has left the bag, so a mark never outlives what it points at. */
export function pruneUnseen(unseen: UnseenItems, stash: Stash): UnseenItems {
  return unseen.length === 0 ? unseen : unseen.filter((id) => stash.includes(id));
}

/** What the badge prints. Pruned rather than trusted, so a stale mark can never light it. */
export function unseenCount(unseen: UnseenItems, stash: Stash): number {
  return pruneUnseen(unseen, stash).length;
}
