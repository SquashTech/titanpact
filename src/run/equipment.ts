// Equipment (docs/progression.md "Equipment (per-hero)"). 3 slots per hero:
// weapon, armor, accessory. Modeled as attached to the roster slot
// (RosterEntry, state.ts), not the hero object, so termination cleanly
// reclaims it: "Equipment strips on contract termination... Model equipment
// as attached to the hero's roster slot, not permanently bound to the hero
// object" (progression.md).
//
// SCOPE NOTE: this slice only wires the STAT-shaped half of the pipeline
// discipline (docs/architecture.md "two damage pipelines" / "Equipment and
// relics use the same hook-and-condition system as abilities", CLAUDE.md) —
// equipment here grants flat stat modifiers only. Damage-shaped equipment
// bonuses (the pipeline-2 multiplier term, engine/damage/damagePipeline.ts
// DamageModifier) require that same hook-and-condition system, which isn't
// built yet. Do not speculatively add a damage-modifier field to equipment
// until it lands — extend the engine's multiplier-term wiring first.

import type { StatKey } from '../engine/content';
import { isValidFlatStatGrant } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import { mergeStatMods } from './statMods';

export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

export interface EquipmentDefinition {
  id: string;
  name: string;
  slot: EquipmentSlot;
  /** Flat additive grants (CLAUDE.md "Stat modifiers are flat additive integers, multiples of 5 or 10"). */
  statGrants: Partial<Record<StatKey, number>>;
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

/** Equips an item into its own slot, replacing whatever was there (the replaced item is just dropped from the loadout — no inventory is modeled in this slice). */
export function equipItem(loadout: EquipmentLoadout, item: EquipmentDefinition): EquipmentLoadout {
  return { ...loadout, [item.slot]: item.id };
}

export function unequipSlot(loadout: EquipmentLoadout, slot: EquipmentSlot): EquipmentLoadout {
  return { ...loadout, [slot]: null };
}
