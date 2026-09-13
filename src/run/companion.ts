// The companion (docs/titanspawn-overhaul.md §5): the Fire Emblem trainee fused with death
// fodder. One of the two Early spawn the player beats in the run's first fight asks to join, and
// it does — there is no declining (per user direction). It takes a roster slot, levels roster-wide,
// takes Scrolls, holds items and restores between nodes like anyone; its ladder's Evolution rung
// is a TIER-STEP (Early → Mid, then Mid → Late) in place of a branch; and the only new rule is
// `RosterEntry.mortal` — a knockout removes it from the run. What it held strips to the bag.

import type { HeroLookup } from '../engine/state';
import type { EquipmentDefinition } from './equipment';
import type { Encounter } from './enemyGen';
import { SPAWN_TIERS, spawnId, spawnPosition, type SpawnTier } from '../data/titanspawn';
import { levelOf, levelUpEntry } from './growth';
import { EVOLUTION_RUNG, RANK_THRESHOLDS, masteryRung } from './progression';
import { stashItem } from './runProgress';
import { ROSTER_CAP, addRosterEntry, createRosterEntry, type RosterEntry, type RunState } from './state';
import { freshRosterId } from './recruitment';

/**
 * Where on the ladder the body changes. The first is the EVOLUTION_RUNG — the rung every hero's
 * branch sits on; the second is where the Late band opens, so the body that holds Late moves is
 * the Late body (§10: the second step had no threshold to borrow, and this is the one it takes).
 */
export const COMPANION_TIER_STEP_RUNGS: Readonly<Record<SpawnTier, number | null>> = {
  early: EVOLUTION_RUNG,
  mid: RANK_THRESHOLDS[2],
  late: null,
};

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

/** The body the entry's next tier-step turns it into, when it stands on one; null otherwise. */
export function companionTierStep(entry: RosterEntry): string | null {
  if (!entry.mortal) return null;
  const position = spawnPosition(entry.heroId);
  if (!position) return null;
  const at = COMPANION_TIER_STEP_RUNGS[position.tier];
  if (at === null || masteryRung(entry) !== at) return null;
  const nextTier = SPAWN_TIERS[SPAWN_TIERS.indexOf(position.tier) + 1];
  return nextTier ? spawnId(position.line, nextTier) : null;
}

/**
 * The step itself: the same entry in the next body. Everything it has — moves, items, levels,
 * growth, Scrolls — carries; only the base line and the figure change, which is what an objective
 * upgrade in the Squirtle/Wartortle/Blastoise sense means.
 */
export function applyCompanionTierStep(run: RunState, rosterId: string): RunState {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  const nextId = entry && companionTierStep(entry);
  if (!entry || !nextId) return run;
  return { ...run, roster: run.roster.map((r) => (r === entry ? { ...r, heroId: nextId } : r)) };
}
