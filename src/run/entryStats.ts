// The single definition of a roster entry's flat stat/passive totals. Both
// buildCombatState.ts and the out-of-combat hero sheet read this; any new
// grant source belongs here, not in either caller.

import type { PassiveDefinition, PassiveId } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import type { RosterEntry } from './state';
import type { EquipmentDefinition } from './equipment';
import { equipmentStatModifiers } from './equipment';
import { equipmentPassiveGrants, mergePassiveGrants, passiveStatModifiers } from './passives';
import { mergeStatMods } from './statMods';

/** id -> stack count across equipment, Evolution, events, Class and team relics. */
export function entryPassiveCounts(
  entry: RosterEntry,
  equipmentLookup: Record<string, EquipmentDefinition>,
  teamPassiveGrants: Record<PassiveId, number> = {}
): Record<PassiveId, number> {
  const evolutionGrants: Record<PassiveId, number> = {};
  for (const id of entry.evolutionPassiveGrants) evolutionGrants[id] = (evolutionGrants[id] ?? 0) + 1;
  const eventGrants: Record<PassiveId, number> = {};
  for (const id of entry.bonusPassiveGrants) eventGrants[id] = (eventGrants[id] ?? 0) + 1;
  const classGrants: Record<PassiveId, number> = entry.classId ? { [entry.classId]: 1 } : {};
  return mergePassiveGrants(
    equipmentPassiveGrants(entry.equipment, equipmentLookup),
    evolutionGrants,
    eventGrants,
    classGrants,
    teamPassiveGrants
  );
}

/** Full flat delta over base stats. Takes the counts from `entryPassiveCounts` so callers needing both compute them once. */
export function entryStatModifiers(
  entry: RosterEntry,
  equipmentLookup: Record<string, EquipmentDefinition>,
  passiveDefs: Record<PassiveId, PassiveDefinition>,
  passiveCounts: Record<PassiveId, number>,
  teamStatModifiers: StatModifiers = {}
): StatModifiers {
  return mergeStatMods(
    equipmentStatModifiers(entry.equipment, equipmentLookup),
    entry.evolutionStatGrants,
    entry.bonusStatGrants,
    entry.masteryStatGrants,
    teamStatModifiers,
    passiveStatModifiers(passiveCounts, passiveDefs)
  );
}

/** The relic slice alone (including relic-granted passives' stats), for the UI's "from relics" readout. */
export function relicStatContribution(
  teamStatModifiers: StatModifiers,
  teamPassiveGrants: Record<PassiveId, number>,
  passiveDefs: Record<PassiveId, PassiveDefinition>
): StatModifiers {
  const merged = mergeStatMods(teamStatModifiers, passiveStatModifiers(teamPassiveGrants, passiveDefs));
  const out: StatModifiers = {};
  for (const [key, amount] of Object.entries(merged)) {
    if (amount) out[key as keyof StatModifiers] = amount;
  }
  return out;
}
