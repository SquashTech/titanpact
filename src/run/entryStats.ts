// The single definition of "what a roster entry's stats actually are right
// now" — every flat grant source folded together in one place: equipment,
// Evolution, map-node stat bonuses, Class, and team-wide relic grants.
//
// This exists because there are two callers that MUST agree and previously
// didn't: buildCombatState.ts (the run -> combat seam, which fed the engine
// relic grants) and the out-of-combat hero sheet (HeroPreviewOverlay, which
// didn't — so a relic's +Speed was real in a fight but invisible on the
// roster screen). Any new grant source belongs here, not in either caller.
//
// Still just the flat-additive stat pipeline (CLAUDE.md "two-pipeline
// separation"): nothing here touches damage-pipeline multipliers, and
// live in-combat deltas stay on Combatant.statModifiers, apart from this
// baseline.

import type { PassiveDefinition, PassiveId } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import type { RosterEntry } from './state';
import type { EquipmentDefinition } from './equipment';
import { equipmentStatModifiers } from './equipment';
import { equipmentPassiveGrants, mergePassiveGrants, passiveStatModifiers } from './passives';
import { mergeStatMods } from './statMods';

/**
 * Every passive this entry holds, as id -> stack count: equipment grants,
 * Evolution grants, its Class (at most one), plus whatever the team's relics
 * broadcast to everyone on the side.
 */
export function entryPassiveCounts(
  entry: RosterEntry,
  equipmentLookup: Record<string, EquipmentDefinition>,
  teamPassiveGrants: Record<PassiveId, number> = {}
): Record<PassiveId, number> {
  const evolutionGrants: Record<PassiveId, number> = {};
  for (const id of entry.evolutionPassiveGrants) evolutionGrants[id] = (evolutionGrants[id] ?? 0) + 1;
  const classGrants: Record<PassiveId, number> = entry.classId ? { [entry.classId]: 1 } : {};
  return mergePassiveGrants(equipmentPassiveGrants(entry.equipment, equipmentLookup), evolutionGrants, classGrants, teamPassiveGrants);
}

/**
 * The entry's full flat stat delta over its hero's base stats. Pass the
 * already-merged passive counts from `entryPassiveCounts` so callers that
 * also need the counts (buildCombatState, for Combatant.passives) compute
 * them once.
 */
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
    teamStatModifiers,
    passiveStatModifiers(passiveCounts, passiveDefs)
  );
}

/**
 * What the team's relics alone contribute to one combatant's stats — the
 * relic slice of `entryStatModifiers`, broken out so the UI can show
 * "this much of your Speed is coming from relics" rather than silently
 * folding it into the total. Includes the stats held by relic-GRANTED
 * passives, not just the relic's own statGrants.
 */
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
