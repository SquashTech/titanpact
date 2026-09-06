// Passive grants tallied as id -> stack count (engine/state.ts PassiveInstance)
// from equipment, relics, Evolution paths and Class. passiveStatModifiers reads
// back OUT of the counts to fold passive-held statGrants into the stat pipeline.

import type { PassiveDefinition, PassiveId } from '../engine/content';
import type { PassiveInstance, StatModifiers } from '../engine/state';
import type { EquipmentDefinition, EquipmentLoadout } from './equipment';
import type { RelicDefinition } from './relics';
import { mergeStatMods } from './statMods';

function addGrants(counts: Record<PassiveId, number>, ids: readonly PassiveId[] | undefined): void {
  for (const id of ids ?? []) counts[id] = (counts[id] ?? 0) + 1;
}

export function equipmentPassiveGrants(loadout: EquipmentLoadout, equipmentLookup: Record<string, EquipmentDefinition>): Record<PassiveId, number> {
  const counts: Record<PassiveId, number> = {};
  for (const itemId of loadout) {
    addGrants(counts, equipmentLookup[itemId]?.grantsPassiveIds);
  }
  return counts;
}

/** Duplicates stack additively. */
export function relicTeamPassiveGrants(relicIds: readonly string[], relicLookup: Record<string, RelicDefinition>): Record<PassiveId, number> {
  const counts: Record<PassiveId, number> = {};
  for (const id of relicIds) addGrants(counts, relicLookup[id]?.grantsPassiveIds);
  return counts;
}

export function mergePassiveGrants(...grants: readonly Record<PassiveId, number>[]): Record<PassiveId, number> {
  const out: Record<PassiveId, number> = {};
  for (const grant of grants) {
    for (const [id, count] of Object.entries(grant)) {
      out[id] = (out[id] ?? 0) + count;
    }
  }
  return out;
}

export function toPassiveInstances(counts: Record<PassiveId, number>): Record<PassiveId, PassiveInstance> {
  const out: Record<PassiveId, PassiveInstance> = {};
  for (const [passiveId, stacks] of Object.entries(counts)) {
    if (stacks > 0) out[passiveId] = { passiveId, stacks };
  }
  return out;
}

/** Sums every held passive's statGrants, N stacks N times. */
export function passiveStatModifiers(counts: Record<PassiveId, number>, passiveDefs: Record<PassiveId, PassiveDefinition>): StatModifiers {
  const grants: StatModifiers[] = [];
  for (const [passiveId, stacks] of Object.entries(counts)) {
    const grant = passiveDefs[passiveId]?.statGrants;
    if (!grant || stacks <= 0) continue;
    for (let i = 0; i < stacks; i++) grants.push(grant);
  }
  return mergeStatMods(...grants);
}
