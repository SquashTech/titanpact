// Status grants — mirrors passives.ts's stat-grant aggregation pattern
// (equipmentPassiveGrants, relicTeamPassiveGrants, mergePassiveGrants), but
// summing MAGNITUDES (for Elemental Force's additive stacking, engine/state.ts
// StatusInstance.magnitude) instead of tallying passive stack counts. Two
// sources feed the same shape: equipment (per item) and relics (team-wide,
// applied identically to every combatant on a side — same broadcast as
// relicTeamStatModifiers). buildCombatState.ts merges both at fight-build
// time, same seam stat/passive grants already cross.
//
// Scoped to magnitude-shape statuses (Elemental Force is the only content
// using this today) — the fight-start grant is a flat magnitude sum, not a
// run through applyStatus's full per-status stacking-rule dispatch, so a
// StatusGrant on a boolean/duration-shape status wouldn't carry the meaning
// its `magnitude` field implies.

import type { StatusGrant, StatusId } from '../engine/content';
import type { StatusInstance } from '../engine/state';
import type { EquipmentDefinition, EquipmentLoadout } from './equipment';
import type { RelicDefinition } from './relics';

function addGrants(magnitudes: Record<StatusId, number>, grants: readonly StatusGrant[] | undefined): void {
  for (const grant of grants ?? []) magnitudes[grant.statusId] = (magnitudes[grant.statusId] ?? 0) + (grant.magnitude ?? 0);
}

/** Sums the status magnitudes granted by every equipped item into id -> total magnitude. */
export function equipmentStatusGrants(loadout: EquipmentLoadout, equipmentLookup: Record<string, EquipmentDefinition>): Record<StatusId, number> {
  const magnitudes: Record<StatusId, number> = {};
  for (const itemId of Object.values(loadout)) {
    if (!itemId) continue;
    addGrants(magnitudes, equipmentLookup[itemId]?.grantsStatusIds);
  }
  return magnitudes;
}

/** Sums the status magnitudes granted by every owned relic — same duplicate-stacks-additively pattern as relicTeamStatModifiers/relicTeamPassiveGrants. */
export function relicTeamStatusGrants(relicIds: readonly string[], relicLookup: Record<string, RelicDefinition>): Record<StatusId, number> {
  const magnitudes: Record<StatusId, number> = {};
  for (const id of relicIds) addGrants(magnitudes, relicLookup[id]?.grantsStatusIds);
  return magnitudes;
}

/** Merges any number of id -> magnitude maps (equipment, relics) additively — same shape as statMods.ts mergeStatMods, just for status magnitudes instead of stat deltas. */
export function mergeStatusGrants(...grants: readonly Record<StatusId, number>[]): Record<StatusId, number> {
  const out: Record<StatusId, number> = {};
  for (const grant of grants) {
    for (const [id, amount] of Object.entries(grant)) {
      out[id] = (out[id] ?? 0) + amount;
    }
  }
  return out;
}

/** Converts a merged id -> magnitude map into the shape Combatant.statuses (engine/state.ts) actually holds. */
export function toStatusInstances(magnitudes: Record<StatusId, number>): Record<StatusId, StatusInstance> {
  const out: Record<StatusId, StatusInstance> = {};
  for (const [statusId, magnitude] of Object.entries(magnitudes)) {
    if (magnitude > 0) out[statusId] = { statusId, magnitude };
  }
  return out;
}
