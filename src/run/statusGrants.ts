// Status grants summed as id -> magnitude (Elemental Force's additive stacking)
// from equipment and relics. Scoped to magnitude-shape statuses: this is a flat
// sum at fight start, not a run through applyStatus's stacking dispatch.

import type { StatusGrant, StatusId } from '../engine/content';
import type { StatusInstance } from '../engine/state';
import type { EquipmentDefinition, EquipmentLoadout } from './equipment';
import type { RelicDefinition } from './relics';

function addGrants(magnitudes: Record<StatusId, number>, grants: readonly StatusGrant[] | undefined): void {
  for (const grant of grants ?? []) magnitudes[grant.statusId] = (magnitudes[grant.statusId] ?? 0) + (grant.magnitude ?? 0);
}

export function equipmentStatusGrants(loadout: EquipmentLoadout, equipmentLookup: Record<string, EquipmentDefinition>): Record<StatusId, number> {
  const magnitudes: Record<StatusId, number> = {};
  for (const itemId of Object.values(loadout)) {
    if (!itemId) continue;
    addGrants(magnitudes, equipmentLookup[itemId]?.grantsStatusIds);
  }
  return magnitudes;
}

export function relicTeamStatusGrants(relicIds: readonly string[], relicLookup: Record<string, RelicDefinition>): Record<StatusId, number> {
  const magnitudes: Record<StatusId, number> = {};
  for (const id of relicIds) addGrants(magnitudes, relicLookup[id]?.grantsStatusIds);
  return magnitudes;
}

export function mergeStatusGrants(...grants: readonly Record<StatusId, number>[]): Record<StatusId, number> {
  const out: Record<StatusId, number> = {};
  for (const grant of grants) {
    for (const [id, amount] of Object.entries(grant)) {
      out[id] = (out[id] ?? 0) + amount;
    }
  }
  return out;
}

export function toStatusInstances(magnitudes: Record<StatusId, number>): Record<StatusId, StatusInstance> {
  const out: Record<StatusId, StatusInstance> = {};
  for (const [statusId, magnitude] of Object.entries(magnitudes)) {
    if (magnitude > 0) out[statusId] = { statusId, magnitude };
  }
  return out;
}
