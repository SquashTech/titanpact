// The companion (docs/titanspawn-overhaul.md §5): the Fire Emblem trainee fused with death
// fodder. One of the two Early spawn the player beats in the run's first fight asks to join, and
// it does — there is no declining (per user direction). It takes a roster slot, levels roster-wide,
// takes its schedule's offers, holds items and restores between nodes like anyone; the Mastery
// pip that opens a hero's Evolution is a TIER-STEP for it (Early → Mid), and the pip that masters
// a hero's innate a second one (Mid → Late), in place of a branch (docs/mastery.md §2); and the only
// new rule is `RosterEntry.mortal` — a knockout removes it from the run, its pips and its gear
// with it (docs/gear-absorption.md §7).

import type { TypeId } from '../engine/content';
import type { HeroLookup } from '../engine/state';
import type { Encounter } from './enemyGen';
import { SPAWN_TIERS, spawnId, spawnPosition } from '../data/titanspawn';
import { levelOf, levelUpEntry } from './growth';
import { MASTERY_EVOLUTION, MASTERY_INNATE } from './mastery';
import { ROSTER_CAP, addRosterEntry, createRosterEntry, type RosterEntry, type RunState } from './state';
import { freshRosterId } from './recruitment';

/**
 * The companion by IDENTITY — a spawn body, which is on a roster only as the companion (the draft
 * is starters, the Guild Hall pool is `heroes`, a contract needs `isRecruitable`). `mortal` is the
 * RULE it lives under, and the two must never be read for each other: Ascension 1 makes every hero
 * mortal (docs/ascension.md §2) without making any of them the companion.
 */
export function isCompanion(entry: Pick<RosterEntry, 'heroId'>): boolean {
  return spawnPosition(entry.heroId) !== undefined;
}

export function companionOf(run: RunState): RosterEntry | null {
  return run.roster.find(isCompanion) ?? null;
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
export function joinCompanion(
  run: RunState,
  heroId: string,
  heroes: HeroLookup,
  random: () => number = Math.random,
  /** Its line woke to Ancient on an earlier run (profile.ts `ascendedSpawnTypes`): it joins already Ancient. */
  ascended = false
): RunState {
  const hero = heroes[heroId];
  if (!hero || !spawnPosition(heroId)) throw new Error(`${heroId} is not a spawn and cannot be the companion`);
  const par = run.roster.reduce((best, entry) => Math.max(best, levelOf(entry)), 1);
  const base = {
    ...createRosterEntry(freshRosterId(run, heroId), heroId, hero.moveIds),
    mortal: true,
    evolutionTypeGraft: ascended ? ANCIENT : null,
  };
  const entry = levelUpEntry(base, hero, par - 1, random).entry;
  return { ...addRosterEntry(run, entry), companionHeroId: heroId };
}

/** The type the companion wakes to: the Titan's own, in the secondary slot a hero's graft would fill. */
export const ANCIENT: TypeId = 'Ancient';

/**
 * The companion on the roster as the finale opens, when it has not yet woken — the one the
 * awakening beat is for. Null when there is none, or it already carries Ancient.
 */
export function companionToAwaken(run: RunState): RosterEntry | null {
  const entry = companionOf(run);
  return entry && entry.evolutionTypeGraft !== ANCIENT ? entry : null;
}

/**
 * The companion reaches its true potential: Ancient takes its secondary slot for the rest of the
 * run. Everything else carries; the body keeps its tier. A spawn line is mono, so nothing is traded.
 */
export function awakenCompanion(run: RunState): RunState {
  const entry = companionToAwaken(run);
  if (!entry) return run;
  return { ...run, roster: run.roster.map((r) => (r === entry ? { ...r, evolutionTypeGraft: ANCIENT } : r)) };
}

export interface Absorption {
  run: RunState;
  /** The companions the fight took, as they were — for the screen that shows them go. */
  absorbed: RosterEntry[];
}

/**
 * A KO'd companion is gone from the run: off the roster, and what it held goes with it — gear is
 * absorbed, never carried. Called on the fight's resolution, before the level report, so the
 * report never lists a hero that is already gone.
 */
export function absorbCompanions(run: RunState, koRosterIds: readonly string[]): Absorption {
  const absorbed = run.roster.filter((entry) => entry.mortal && koRosterIds.includes(entry.rosterId));
  if (absorbed.length === 0) return { run, absorbed };
  return { run: { ...run, roster: run.roster.filter((entry) => !absorbed.includes(entry)) }, absorbed };
}

/** The pip each body steps up at: an Early to Mid where a hero would evolve, a Mid to Late where a hero would master its innate. */
const STEP_PIPS: Record<string, number> = { early: MASTERY_EVOLUTION, mid: MASTERY_INNATE };

/**
 * The body the entry's Mastery has earned it, when it is standing in the one below: DERIVED off
 * the pips and the body it is in, so nothing is owed and nothing is taken — a Mid at ten pips is
 * a Late the moment anyone asks. Null for a hero, or a body with nowhere to step.
 */
export function companionTierStep(entry: RosterEntry): string | null {
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
