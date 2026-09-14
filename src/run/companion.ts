// The companion (docs/titanspawn-overhaul.md §5): the Fire Emblem trainee fused with death
// fodder. One of the two Early spawn the player beats in the run's first fight asks to join, and
// it does — there is no declining (per user direction). It takes a roster slot, levels roster-wide,
// takes its schedule's offers, holds items and restores between nodes like anyone; the Mastery
// pip that opens a hero's Evolution is a TIER-STEP for it (Early → Mid), and the pip that offers
// the signature a second one (Mid → Late), in place of a branch (docs/mastery.md §2); and the only
// new rule is `RosterEntry.mortal` — a knockout removes it from the run, its pips with it. What it
// held strips to the bag.

import type { HeroLookup } from '../engine/state';
import type { EquipmentDefinition } from './equipment';
import type { Encounter } from './enemyGen';
import { SPAWN_TIERS, spawnId, spawnPosition } from '../data/titanspawn';
import { levelOf, levelUpEntry } from './growth';
import { MASTERY_EVOLUTION, MASTERY_SIGNATURE } from './mastery';
import { stashItem } from './runProgress';
import { ROSTER_CAP, addRosterEntry, createRosterEntry, type RosterEntry, type RunState } from './state';
import { freshRosterId } from './recruitment';

export function companionOf(run: RunState): RosterEntry | null {
  return run.roster.find((entry) => entry.mortal) ?? null;
}

/** True once, on the run's first fight: a `fight` node, nothing joined yet, and no companion ever taken. */
export function companionJoinDue(run: RunState, mapNodeType: string): boolean {
  return mapNodeType === 'fight' && run.fightsStarted === 1 && run.companionHeroId === null && run.roster.length < ROSTER_CAP;
}

/** The body that asks: the beaten side's lead, if it is an Early spawn — which the first fight's always are. */
export function companionCandidate(encounter: Encounter): string | null {
  const order = [...encounter.squad.activeIds.filter((id): id is string => id !== null), ...encounter.squad.benchIds];
  for (const rosterId of order) {
    const entry = encounter.run.roster.find((r) => r.rosterId === rosterId);
    const position = entry && spawnPosition(entry.heroId);
    if (position?.tier === 'early') return entry!.heroId;
  }
  return null;
}

/**
 * It joins at the roster's par with the growth those levels would have rolled — RAW is unbuilt,
 * not hollow (CLAUDE.md "Recruitment") — holding its authored kit, mortal.
 */
export function joinCompanion(run: RunState, heroId: string, heroes: HeroLookup, random: () => number = Math.random): RunState {
  const hero = heroes[heroId];
  if (!hero || !spawnPosition(heroId)) throw new Error(`${heroId} is not a spawn and cannot be the companion`);
  const par = run.roster.reduce((best, entry) => Math.max(best, levelOf(entry)), 1);
  const base = { ...createRosterEntry(freshRosterId(run, heroId), heroId, hero.moveIds), mortal: true };
  const entry = levelUpEntry(base, hero, par - 1, random).entry;
  return { ...addRosterEntry(run, entry), companionHeroId: heroId };
}

export interface Absorption {
  run: RunState;
  /** The companions the fight took, as they were — for the screen that shows them go. */
  absorbed: RosterEntry[];
}

/**
 * A KO'd companion is gone from the run: off the roster, its items to the bag (§10, decided —
 * the unit is the price, the item is not). Called on the fight's resolution, before the level
 * report, so the report never lists a hero that is already gone.
 */
export function absorbCompanions(run: RunState, koRosterIds: readonly string[], equipmentLookup: Record<string, EquipmentDefinition>): Absorption {
  const absorbed = run.roster.filter((entry) => entry.mortal && koRosterIds.includes(entry.rosterId));
  if (absorbed.length === 0) return { run, absorbed };
  let next: RunState = { ...run, roster: run.roster.filter((entry) => !absorbed.includes(entry)) };
  for (const entry of absorbed) for (const itemId of entry.equipment) next = stashItem(next, itemId, equipmentLookup);
  return { run: next, absorbed };
}

/** The pip each body steps up at: an Early to Mid where a hero would evolve, a Mid to Late where a hero would take its signature. */
const STEP_PIPS: Record<string, number> = { early: MASTERY_EVOLUTION, mid: MASTERY_SIGNATURE };

/**
 * The body the entry's Mastery has earned it, when it is standing in the one below: DERIVED off
 * the pips and the body it is in, so nothing is owed and nothing is taken — a Mid at ten pips is
 * a Late the moment anyone asks. Null for a hero, an immortal, or a body with nowhere to step.
 */
export function companionTierStep(entry: RosterEntry): string | null {
  if (!entry.mortal) return null;
  const position = spawnPosition(entry.heroId);
  if (!position) return null;
  const pip = STEP_PIPS[position.tier];
  if (pip === undefined || entry.mastery < pip) return null;
  const nextTier = SPAWN_TIERS[SPAWN_TIERS.indexOf(position.tier) + 1];
  return nextTier ? spawnId(position.line, nextTier) : null;
}

/**
 * The step itself: the same entry in the next body. Everything it has — moves, items, levels,
 * growth — carries; only the base line and the figure change, which is what an objective upgrade
 * in the Squirtle/Wartortle/Blastoise sense means.
 */
export function applyCompanionTierStep(run: RunState, rosterId: string): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  const nextId = entry && companionTierStep(entry);
  if (!entry || !nextId) return run;
  return { ...run, roster: run.roster.map((r) => (r === entry ? { ...r, heroId: nextId } : r)) };
}
