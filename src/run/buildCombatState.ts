// The seam between run state and combat state (docs/architecture.md "State
// shapes (three tiers)"). Converts a picked Squad, per side, into a
// CombatState — applying equipped items' and rank-up grants' flat stat
// modifiers as each Combatant's starting statModifiers. This is the only
// place run-tier content crosses into the engine's combat tier, and it only
// ever produces plain CombatState/Combatant data — never reaches back into
// /src/engine internals.

import type { HeroLookup, CombatState, Side, Combatant, StatModifiers } from '../engine/state';
import { createCombatant, getMaxHp, getMaxMana } from '../engine/state';
import { createRng } from '../engine/rng/seededRng';
import type { RosterEntry } from './state';
import type { Squad } from './squad';
import type { EquipmentDefinition } from './equipment';
import { equipmentStatModifiers } from './equipment';
import { mergeStatMods } from './statMods';

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
   * equipment/rank-up modifiers. Omitted (or empty) for sides with no relics.
   */
  teamStatModifiers?: StatModifiers;
}

function combatantIdFor(side: Side, rosterId: string): string {
  return `${side}:${rosterId}`;
}

/** Inverse of combatantIdFor — the rosterId a combatant was placed from (runProgress.ts's syncRosterVitals). */
export function rosterIdFromCombatantId(combatantId: string): string {
  return combatantId.slice(combatantId.indexOf(':') + 1);
}

/**
 * Starting HP/mana are an explicit, full-resources choice made HERE, not an
 * engine default — matches the LOCKED starting-mana decision (docs/mana.md
 * "Resolved": full pool). "Full" is computed AFTER equipment/rank-up stat
 * modifiers are applied, so a +HP or +Mana item actually starts the fight
 * topped up, not just raising an unreached cap.
 */
function placeEntry(
  rosterId: string,
  roster: readonly RosterEntry[],
  side: Side,
  heroes: HeroLookup,
  equipmentLookup: Record<string, EquipmentDefinition>,
  teamStatModifiers: StatModifiers
): Combatant {
  const entry = roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new Error(`${rosterId} is not on the roster`);
  const hero = heroes[entry.heroId];
  const statModifiers = mergeStatMods(equipmentStatModifiers(entry.equipment, equipmentLookup), entry.rankStatGrants, teamStatModifiers);
  const grantedTypes = entry.rankTypeGraft ? [entry.rankTypeGraft] : [];
  const withMods = { ...createCombatant(combatantIdFor(side, rosterId), entry.heroId, side, 0, 0), statModifiers, grantedTypes };
  const maxHp = getMaxHp(hero, withMods);
  const maxMana = getMaxMana(hero, withMods);
  // Persisted HP/mana between map nodes (docs/run-loop.md): a non-null snapshot from the
  // hero's last fight is clamped to the current max (never healed by a cap increase, e.g.
  // a mid-run rank-up) rather than reset to full. null (fresh recruit/contract claim, or
  // never-fielded roster member) keeps the LOCKED "full starting pool" behavior (docs/mana.md).
  return {
    ...withMods,
    currentHp: entry.currentHp !== null ? Math.min(entry.currentHp, maxHp) : maxHp,
    currentMana: entry.currentMana !== null ? Math.min(entry.currentMana, maxMana) : maxMana,
  };
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

  for (const { side, squad, roster, teamStatModifiers } of placements) {
    active[side] = squad.activeIds.map((id) => (id ? combatantIdFor(side, id) : null)) as [string | null, string | null];
    bench[side] = squad.benchIds.map((id) => combatantIdFor(side, id));

    for (const rosterId of [...squad.activeIds, ...squad.benchIds]) {
      if (!rosterId) continue;
      const combatant = placeEntry(rosterId, roster, side, heroes, equipmentLookup, teamStatModifiers ?? {});
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

/** The move ids a given combatant may currently use — pulled from the roster entry, not the static HeroDefinition, so tier unlocks and rank-up grants are reflected. */
export function unlockedMoveIdsFor(roster: readonly RosterEntry[], rosterId: string): readonly string[] {
  const entry = roster.find((r) => r.rosterId === rosterId);
  if (!entry) throw new Error(`${rosterId} is not on the roster`);
  return entry.unlockedMoveIds;
}
