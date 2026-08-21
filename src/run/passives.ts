// Passive grants — mirrors equipment.ts/relics.ts's stat-grant aggregation
// pattern (equipmentStatModifiers, relicTeamStatModifiers), but tallying held
// PASSIVE COUNTS (for stacking, engine/state.ts PassiveInstance) instead of
// summing stat deltas. Four sources feed the same shape: equipment (per
// item), relics (team-wide, applied identically to every combatant on a
// side — same broadcast as relicTeamStatModifiers), Evolution paths
// (RosterEntry.evolutionPassiveGrants), and a Class (RosterEntry.classId,
// src/run/classes.ts — at most one, so it contributes a count of 0 or 1).
// buildCombatState.ts merges all four at fight-build time, same seam stat
// grants already cross. passiveStatModifiers (below) then reads back OUT of
// the merged counts to fold any passive-held statGrants (a Class's whole
// point) into the combatant's statModifiers — the one place this module
// produces stats instead of just counts.

import type { PassiveDefinition, PassiveId } from '../engine/content';
import type { PassiveInstance, StatModifiers } from '../engine/state';
import type { EquipmentDefinition, EquipmentLoadout } from './equipment';
import type { RelicDefinition } from './relics';
import { mergeStatMods } from './statMods';

function addGrants(counts: Record<PassiveId, number>, ids: readonly PassiveId[] | undefined): void {
  for (const id of ids ?? []) counts[id] = (counts[id] ?? 0) + 1;
}

/** Sums the passives granted by every equipped item into id -> stack count. */
export function equipmentPassiveGrants(loadout: EquipmentLoadout, equipmentLookup: Record<string, EquipmentDefinition>): Record<PassiveId, number> {
  const counts: Record<PassiveId, number> = {};
  for (const itemId of Object.values(loadout)) {
    if (!itemId) continue;
    addGrants(counts, equipmentLookup[itemId]?.grantsPassiveIds);
  }
  return counts;
}

/** Sums the passives granted by every owned relic into id -> stack count — same duplicate-stacks-additively pattern as relicTeamStatModifiers. */
export function relicTeamPassiveGrants(relicIds: readonly string[], relicLookup: Record<string, RelicDefinition>): Record<PassiveId, number> {
  const counts: Record<PassiveId, number> = {};
  for (const id of relicIds) addGrants(counts, relicLookup[id]?.grantsPassiveIds);
  return counts;
}

/** Merges any number of id -> count maps (equipment, relics, Evolution) additively — same shape as statMods.ts mergeStatMods, just for counts instead of numeric deltas. */
export function mergePassiveGrants(...grants: readonly Record<PassiveId, number>[]): Record<PassiveId, number> {
  const out: Record<PassiveId, number> = {};
  for (const grant of grants) {
    for (const [id, count] of Object.entries(grant)) {
      out[id] = (out[id] ?? 0) + count;
    }
  }
  return out;
}

/** Converts a merged id -> count map into the shape Combatant.passives (engine/state.ts) actually holds. */
export function toPassiveInstances(counts: Record<PassiveId, number>): Record<PassiveId, PassiveInstance> {
  const out: Record<PassiveId, PassiveInstance> = {};
  for (const [passiveId, stacks] of Object.entries(counts)) {
    if (stacks > 0) out[passiveId] = { passiveId, stacks };
  }
  return out;
}

/**
 * Sums the statGrants (engine/content.ts PassiveDefinition.statGrants) of
 * every held passive, scaled by stack count — same "N stacks resolves N
 * times" discipline the reactive/damage-modifier shapes already follow
 * (engine/state.ts PassiveInstance doc). Passives with no statGrants (the
 * common case) contribute nothing. buildCombatState.ts folds this into a
 * combatant's statModifiers alongside equipment/relic/Evolution grants — a
 * Class (src/data/classes.ts) is the first content this actually moves.
 */
export function passiveStatModifiers(counts: Record<PassiveId, number>, passiveDefs: Record<PassiveId, PassiveDefinition>): StatModifiers {
  const grants: StatModifiers[] = [];
  for (const [passiveId, stacks] of Object.entries(counts)) {
    const grant = passiveDefs[passiveId]?.statGrants;
    if (!grant || stacks <= 0) continue;
    for (let i = 0; i < stacks; i++) grants.push(grant);
  }
  return mergeStatMods(...grants);
}
