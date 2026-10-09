// The run -> combat seam: a picked Squad per side becomes a CombatState.
// Equipment/Evolution/relic grants land as baselineStatModifiers (kept apart
// from statModifiers, which is reserved for in-combat deltas).

import type { HeroLookup, CombatState, Side, Combatant, StatModifiers } from '../engine/state';
import { createCombatant, getMaxHp, getMaxMana, withCalledCaster } from '../engine/state';
import { combatantIdFor, koRosterIdsOf, rosterIdOfCombatant } from './combatantIds';
import { woundedHp } from './wounds';

export { koRosterIdsOf, rosterIdOfCombatant };
import { createRng } from '../engine/rng/seededRng';
import type { PassiveDefinition, PassiveId, StatusId } from '../engine/content';
import type { RosterEntry } from './state';
import type { Squad } from './squad';
import type { EquipmentDefinition } from './equipment';
import { entryPassiveCounts, entryStatModifiers } from './entryStats';
import { innatePassiveIdsFor } from './innate';
import { formIdFor, scheduleFor } from './progression';
import { levelOf } from './growth';
import { moves as moveCatalog } from '../data/moves';
import type { MoveTier } from '../engine/content';
import { turnedCurse } from './curse';
import { enduranceOf, sideImmunitiesOf, switchLockOf, toPassiveInstances } from './passives';
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
  /** The side's purse, for a goldStatGrants passive (Gilded Mane). Omitted = none: the AI holds no gold. */
  gold?: number;
  /** The side's companion, seated as its Called caster (run/companion.ts companionCallFor). Omitted = no Call. */
  call?: CallPlacement | null;
}

/** An off-field caster for one side (docs/companion-call.md §7): the entry it is built from, its one move, its Calls. */
export interface CallPlacement {
  entry: RosterEntry;
  moveId: string;
  calls: number;
  /** Calls added when a later phase of the fight begins. */
  phaseGrant?: number;
}

// Mana starts full (docs/mana.md); HP starts where the act's wounds left it (run/wounds.ts).
// Both computed AFTER grants, so a +HP item raises the fight's starting resources.
function placeEntry(
  entry: RosterEntry,
  side: Side,
  heroes: HeroLookup,
  equipmentLookup: Record<string, EquipmentDefinition>,
  passiveDefs: Record<PassiveId, PassiveDefinition>,
  teamStatModifiers: StatModifiers,
  teamPassiveGrants: Record<PassiveId, number>,
  teamStatusGrants: Record<StatusId, number>,
  gold: number
): Combatant {
  const hero = heroes[entry.heroId];
  // Both halves come from entryStats.ts, shared with the hero sheet — never recompute inline.
  const passiveCounts = entryPassiveCounts(entry, equipmentLookup, teamPassiveGrants, innatePassiveIdsFor(hero, entry));
  const passives = toPassiveInstances(passiveCounts);
  const baselineStatModifiers = entryStatModifiers(entry, equipmentLookup, passiveDefs, passiveCounts, teamStatModifiers, gold);
  const baselineStatusMagnitudes = mergeStatusGrants(equipmentStatusGrants(entry.equipment, equipmentLookup), entry.bonusStatusGrants, teamStatusGrants);
  const statuses = toStatusInstances(baselineStatusMagnitudes);
  const grantedTypes = entry.evolutionTypeGraft ? [entry.evolutionTypeGraft] : [];
  const formPathId = formIdFor(entry);
  const withMods = {
    ...createCombatant(combatantIdFor(side, entry.rosterId), entry.heroId, side, 0, 0),
    baselineStatModifiers,
    grantedTypes,
    baselineStatusMagnitudes,
    passives,
    statuses,
    enduresLeft: enduranceOf(passiveCounts, passiveDefs),
    switchLocked: switchLockOf(passiveCounts, passiveDefs),
    ...(sideImmunitiesOf(passiveCounts, passiveDefs) ? { sideStatusImmunities: sideImmunitiesOf(passiveCounts, passiveDefs) } : {}),
    ...(entry.blessed ? { blessed: true } : {}),
    ...(turnedCurse(entry) ? { typeOverride: turnedCurse(entry)!.types } : {}),
    ...(formPathId ? { formPathId } : {}),
    ...quiverStamp(entry, hero),
  };
  return { ...withMods, currentHp: woundedHp(getMaxHp(hero, withMods), entry.wounds), currentMana: getMaxMana(hero, withMods) };
}

/**
 * A kit holding a locking metamorphic move (Quiver, docs/archers.md) carries the kit itself — so a cast
 * can tell a face from a held move — and the tiers the hero's level has opened, the bands its offers
 * read. Nothing is stamped for any other kit.
 */
export function quiverStamp(entry: RosterEntry, hero: HeroLookup[string]): { kitMoveIds?: readonly string[]; openTiers?: readonly MoveTier[] } {
  const kit = entry.unlockedMoveIds.length > 0 ? entry.unlockedMoveIds : hero.moveIds;
  if (!kit.some((id) => typeof moveCatalog[id]?.metamorphic === 'object')) return {};
  const schedule = scheduleFor(hero);
  const level = levelOf(entry);
  const openTiers: MoveTier[] = ['early'];
  if (level >= schedule.midLevel) openTiers.push('mid');
  if (level >= schedule.lateLevel) openTiers.push('late');
  return { kitMoveIds: [...kit], openTiers };
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

  const calls: { combatant: Combatant; placement: CallPlacement }[] = [];
  for (const { side, squad, roster, teamStatModifiers, teamPassiveGrants, teamStatusGrants, gold, call } of placements) {
    // Built bare — no gear, no team grants, no purse: the Call is the line at par, nothing the roster carries.
    if (call) calls.push({ combatant: placeEntry(call.entry, side, heroes, equipmentLookup, passiveDefs, {}, {}, {}, 0), placement: call });
    active[side] = squad.activeIds.map((id) => (id ? combatantIdFor(side, id) : null)) as [string | null, string | null];
    const phaseOf = new Map<string, number>();
    (squad.reserves ?? []).forEach((phase, i) => phase.forEach((id) => phaseOf.set(id, i + 1)));
    const reserveIds = [...phaseOf.keys()];
    bench[side] = [...squad.benchIds, ...reserveIds].map((id) => combatantIdFor(side, id));
    const entriesById = new Map(roster.map((r) => [r.rosterId, r]));

    const downIds = new Set(squad.downIds ?? []);
    for (const rosterId of [...squad.activeIds, ...squad.benchIds, ...reserveIds, ...downIds]) {
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
        teamStatusGrants ?? {},
        gold ?? 0
      );
      const reservePhase = phaseOf.get(rosterId);
      // A hero the act left down enters fallen, on no slot and no bench: there for a Revive to find.
      if (downIds.has(rosterId)) combatants[combatant.combatantId] = { ...combatant, fainted: true, enteredDown: true, currentHp: 0 };
      else combatants[combatant.combatantId] = reservePhase !== undefined ? { ...combatant, reservePhase } : combatant;
    }
  }

  const built: CombatState = {
    seed,
    rngState: createRng(seed),
    round: 1,
    active,
    bench,
    combatants,
    koCount: { A: 0, B: 0 },
    activeFieldEffect: null,
  };
  return calls.reduce(
    (state, { combatant, placement }) => withCalledCaster(state, combatant, placement.moveId, placement.calls, placement.phaseGrant ?? 0),
    built
  );
}
