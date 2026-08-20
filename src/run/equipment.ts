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

import type { PassiveId, StatKey, StatusGrant } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import { mergeStatMods } from './statMods';

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

/** Gray/blue/purple/gold/red — common through mythic, low to high. Drives both reward-roll odds (RARITY_DROP_WEIGHTS below) and the tier color shown in the UI (view/shared/EquipmentBox.tsx RARITY_COLOR_VARS). */
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

/** Reward-roll weights per rarity — higher tiers are proportionally rarer finds (pickWeightedEquipment below). */
export const RARITY_DROP_WEIGHTS: Record<EquipmentRarity, number> = {
  common: 50,
  rare: 30,
  epic: 14,
  legendary: 5,
  mythic: 1,
};

/** Weighted sample of `count` distinct items from `pool`, biased toward common gear per RARITY_DROP_WEIGHTS — used by equipmentReward nodes (NodeRewardScreen) to roll the 3 choices offered. */
export function pickWeightedEquipment(pool: readonly EquipmentDefinition[], count: number): EquipmentDefinition[] {
  const remaining = [...pool];
  const picked: EquipmentDefinition[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    const total = remaining.reduce((sum, item) => sum + RARITY_DROP_WEIGHTS[item.rarity], 0);
    let roll = Math.random() * total;
    let index = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= RARITY_DROP_WEIGHTS[remaining[i].rarity];
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    picked.push(remaining.splice(index, 1)[0]);
  }
  return picked;
}

/** Rolls a single item restricted to one slot, same rarity weighting as `pickWeightedEquipment` — used by the `weaponReward`/`armorReward`/`accessoryReward` map nodes (App.tsx), which grant one guaranteed item of a fixed slot rather than a 3-choice pick across mixed slots. */
export function pickWeightedEquipmentBySlot(pool: readonly EquipmentDefinition[], slot: EquipmentSlot): EquipmentDefinition | undefined {
  return pickWeightedEquipment(
    pool.filter((item) => item.slot === slot),
    1
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
