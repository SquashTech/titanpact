// The run -> combat seam: a picked Squad per side becomes a CombatState.
// Equipment/Evolution/relic grants land as baselineStatModifiers (kept apart
// from statModifiers, which is reserved for in-combat deltas).

import type { HeroLookup, CombatState, Side, Combatant, StatModifiers } from '../engine/state';
import { createCombatant, getMaxHp, getMaxMana } from '../engine/state';
import { createRng } from '../engine/rng/seededRng';
import type { PassiveDefinition, PassiveId, StatusId } from '../engine/content';
import type { RosterEntry } from './state';
import type { Squad } from './squad';
import type { EquipmentDefinition } from './equipment';
import { entryPassiveCounts, entryStatModifiers } from './entryStats';
import { toPassiveInstances } from './passives';
import { equipmentStatusGrants, mergeStatusGrants, toStatusInstances } from './statusGrants';

export interface SquadPlacement {
  side: Side;
  squad: Squad;
  /** The roster the squad's ids are drawn from — the AI's own fixture roster for the non-player side. */
  roster: readonly RosterEntry[];
  /** Team-wide relic stat grants, applied to every combatant on this side alongside its own equipment/Evolution grants. */
  teamStatModifiers?: StatModifiers;
  /** Team-wide passive grants (relics), as stack counts. */
  teamPassiveGrants?: Record<PassiveId, number>;
  /** Team-wide status-magnitude grants (relics — currently Elemental Force only). */
  teamStatusGrants?: Record<StatusId, number>;
}

function combatantIdFor(side: Side, rosterId: string): string {
  return `${side}:${rosterId}`;
}

// Starting HP/mana are full (docs/mana.md, docs/run-loop.md), computed AFTER
// grants so a +HP item raises the fight's starting resources.
function placeEntry(
  entry: RosterEntry,
  side: Side,
  heroes: HeroLookup,
  equipmentLookup: Record<string, EquipmentDefinition>,
  passiveDefs: Record<PassiveId, PassiveDefinition>,
  teamStatModifiers: StatModifiers,
  teamPassiveGrants: Record<PassiveId, number>,
  teamStatusGrants: Record<StatusId, number>
): Combatant {
  const hero = heroes[entry.heroId];
  // Both halves come from entryStats.ts, shared with the hero sheet — never recompute inline.
  const passiveCounts = entryPassiveCounts(entry, equipmentLookup, teamPassiveGrants);
  const passives = toPassiveInstances(passiveCounts);
  const baselineStatModifiers = entryStatModifiers(entry, equipmentLookup, passiveDefs, passiveCounts, teamStatModifiers);
  const baselineStatusMagnitudes = mergeStatusGrants(equipmentStatusGrants(entry.equipment, equipmentLookup), teamStatusGrants);
  const statuses = toStatusInstances(baselineStatusMagnitudes);
  const grantedTypes = entry.evolutionTypeGraft ? [entry.evolutionTypeGraft] : [];
  const withMods = {
    ...createCombatant(combatantIdFor(side, entry.rosterId), entry.heroId, side, 0, 0),
    baselineStatModifiers,
    grantedTypes,
    baselineStatusMagnitudes,
    passives,
    statuses,
  };
  return { ...withMods, currentHp: getMaxHp(hero, withMods), currentMana: getMaxMana(hero, withMods) };
}

export function buildCombatState(
  seed: number,
  heroes: HeroLookup,
  equipmentLookup: Record<string, EquipmentDefinition>,
  placements: readonly SquadPlacement[],
  /** Omitted (most tests) = no passive-held stat contribution. Real fights pass the full data/passives.ts catalog. */
  passiveDefs: Record<PassiveId, PassiveDefinition> = {}
): CombatState {
  const combatants: CombatState['combatants'] = {};
  const active: CombatState['active'] = { A: [null, null], B: [null, null] };
  const bench: CombatState['bench'] = { A: [], B: [] };

  for (const { side, squad, roster, teamStatModifiers, teamPassiveGrants, teamStatusGrants } of placements) {
    active[side] = squad.activeIds.map((id) => (id ? combatantIdFor(side, id) : null)) as [string | null, string | null];
    bench[side] = squad.benchIds.map((id) => combatantIdFor(side, id));
    const entriesById = new Map(roster.map((r) => [r.rosterId, r]));

    for (const rosterId of [...squad.activeIds, ...squad.benchIds]) {
      if (!rosterId) continue;
      const entry = entriesById.get(rosterId);
      if (!entry) throw new Error(`${rosterId} is not on the roster`);
      const combatant = placeEntry(
        entry,
        side,
        heroes,
        equipmentLookup,
        passiveDefs,
        teamStatModifiers ?? {},
        teamPassiveGrants ?? {},
        teamStatusGrants ?? {}
      );
      combatants[combatant.combatantId] = combatant;
    }
  }

  return {
    seed,
    rngState: createRng(seed),
    round: 1,
    active,
    bench,
    combatants,
    koCount: { A: 0, B: 0 },
    activeFieldEffect: null,
  };
}
