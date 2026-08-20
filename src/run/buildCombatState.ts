// The seam between run state and combat state (docs/architecture.md "State
// shapes (three tiers)"). Converts a picked Squad, per side, into a
// CombatState — applying equipped items' and Evolution grants' flat stat
// modifiers as each Combatant's starting statModifiers. This is the only
// place run-tier content crosses into the engine's combat tier, and it only
// ever produces plain CombatState/Combatant data — never reaches back into
// /src/engine internals.

import type { HeroLookup, CombatState, Side, Combatant, StatModifiers } from '../engine/state';
import { createCombatant, getMaxHp, getMaxMana } from '../engine/state';
import { createRng } from '../engine/rng/seededRng';
import type { PassiveId } from '../engine/content';
import type { RosterEntry } from './state';
import type { Squad } from './squad';
import type { EquipmentDefinition } from './equipment';
import { equipmentStatModifiers } from './equipment';
import { mergeStatMods } from './statMods';
import { equipmentPassiveGrants, mergePassiveGrants, toPassiveInstances } from './passives';

export interface SquadPlacement {
  side: Side;
  squad: Squad;
  /** The roster the squad's ids are drawn from — pass the AI's own fixture roster for the non-player side. */
  roster: readonly RosterEntry[];
  /**
   * Team-wide flat stat grants (docs/run-loop.md — src/run/relics.ts) applied
   * identically to every combatant placed on this side. Relics are a
   * separate axis from equipment (docs/progression.md "Relics (team-wide)"),
   * so this is merged in alongside, not instead of, each entry's own
   * equipment/Evolution modifiers. Omitted (or empty) for sides with no relics.
   */
  teamStatModifiers?: StatModifiers;
  /** Team-wide Passive grants (src/run/relics.ts relicTeamPassiveGrants) — same broadcast as teamStatModifiers, just counted stacks instead of summed stats. Omitted (or empty) for sides with no passive-granting relics. */
  teamPassiveGrants?: Record<PassiveId, number>;
}

function combatantIdFor(side: Side, rosterId: string): string {
  return `${side}:${rosterId}`;
}

/**
 * Starting HP/mana are an explicit, full-resources choice made HERE, not an
 * engine default — matches the LOCKED starting-mana decision (docs/mana.md
 * "Resolved": full pool) and the every-node full-heal decision
 * (docs/run-loop.md "HP/mana fully restore between map nodes"). "Full" is
 * computed AFTER equipment/Evolution stat modifiers are applied, so a +HP or
 * +Mana item actually raises the fight's starting resources, not just an
 * unreached cap.
 */
function placeEntry(
  rosterId: string,
  roster: readonly RosterEntry[],
  side: Side,
  heroes: HeroLookup,
  equipmentLookup: Record<string, EquipmentDefinition>,
  teamStatModifiers: StatModifiers,
  teamPassiveGrants: Record<PassiveId, number>
): Combatant {
  const entry = roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new Error(`${rosterId} is not on the roster`);
  const hero = heroes[entry.heroId];
  const statModifiers = mergeStatMods(
    equipmentStatModifiers(entry.equipment, equipmentLookup),
    entry.evolutionStatGrants,
    entry.bonusStatGrants,
    teamStatModifiers
  );
  const evolutionGrants: Record<PassiveId, number> = {};
  for (const id of entry.evolutionPassiveGrants) evolutionGrants[id] = (evolutionGrants[id] ?? 0) + 1;
  const passives = toPassiveInstances(
    mergePassiveGrants(equipmentPassiveGrants(entry.equipment, equipmentLookup), evolutionGrants, teamPassiveGrants)
  );
  const grantedTypes = entry.evolutionTypeGraft ? [entry.evolutionTypeGraft] : [];
  const withMods = { ...createCombatant(combatantIdFor(side, rosterId), entry.heroId, side, 0, 0), statModifiers, grantedTypes, passives };
  return { ...withMods, currentHp: getMaxHp(hero, withMods), currentMana: getMaxMana(hero, withMods) };
}

export function buildCombatState(
  seed: number,
  heroes: HeroLookup,
  equipmentLookup: Record<string, EquipmentDefinition>,
  placements: readonly SquadPlacement[]
): CombatState {
  const combatants: CombatState['combatants'] = {};
  const active: CombatState['active'] = { A: [null, null], B: [null, null] };
  const bench: CombatState['bench'] = { A: [], B: [] };

  for (const { side, squad, roster, teamStatModifiers, teamPassiveGrants } of placements) {
    active[side] = squad.activeIds.map((id) => (id ? combatantIdFor(side, id) : null)) as [string | null, string | null];
    bench[side] = squad.benchIds.map((id) => combatantIdFor(side, id));

    for (const rosterId of [...squad.activeIds, ...squad.benchIds]) {
      if (!rosterId) continue;
      const combatant = placeEntry(rosterId, roster, side, heroes, equipmentLookup, teamStatModifiers ?? {}, teamPassiveGrants ?? {});
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
  };
}

/** The move ids a given combatant may currently use — pulled from the roster entry, not the static HeroDefinition, so tier unlocks and Evolution grants are reflected. */
export function unlockedMoveIdsFor(roster: readonly RosterEntry[], rosterId: string): readonly string[] {
  const entry = roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new Error(`${rosterId} is not on the roster`);
  return entry.unlockedMoveIds;
}
