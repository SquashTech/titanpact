// Automatic levelling and growth grades (docs/growth-overhaul.md §3). Every roster hero levels
// every won encounter, fielded or benched, and every level rolls each stat independently against
// that hero's authored grade for it. There is no pool, no allocation and no screen: Level is what
// a hero IS, and the only lane of growth the player never touches.
//
// Roster-wide rather than participation-based (Fire Emblem's actual model) on purpose. Per-hero XP
// produces the runaway where your best four level, your sideboard rots, and by Act 4 you cannot
// rotate. This gets the screen removal without buying that problem — a hero rotated in is at
// parity, so rotating is free, which is BETTER for strategic churn than participation XP.

import type { GrowthStatKey, HeroDefinition, StatKey } from '../engine/content';
import type { RosterEntry, RunState } from './state';
import { mergeStatMods } from './statMods';

export const MAX_LEVEL = 30;

/** The stats a grade exists for: the seven the 550 budget covers. MP Regen is excluded, as it is from every other per-hero grant. */
export const GROWTH_STATS: readonly GrowthStatKey[] = [
  'hp',
  'attack',
  'defense',
  'intelligence',
  'wisdom',
  'speed',
  'manaPool',
];

export type GrowthGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** Chance a level's roll for that stat SUCCEEDS. */
export const GRADE_CHANCE: Record<GrowthGrade, number> = {
  S: 0.95,
  A: 0.8,
  B: 0.65,
  C: 0.5,
  D: 0.35,
  E: 0.2,
  F: 0.05,
};

/**
 * What a grade costs against the grade budget. The SECOND budget: the 550 stat rule alone stops
 * being enough to say a hero is fairly costed the moment growth exists, because a low base with
 * S-grades outruns a high base with F-grades however the 550 is spent.
 */
export const GRADE_COST: Record<GrowthGrade, number> = { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };

/** Every hero's grades sum to exactly this — seven stats at an average of B. */
export const GRADE_BUDGET = 28;

/**
 * What one success grants. HP is NOT a special case: CLAUDE.md's own measured break-even is
 * ≈0.33 a point, so 6 HP is 2 points' worth of anything else.
 */
export const GROWTH_STEP = 2;
export const GROWTH_STEP_HP = 6;

export function growthStepFor(stat: StatKey): number {
  return stat === 'hp' ? GROWTH_STEP_HP : GROWTH_STEP;
}

export type GrowthGrades = Record<GrowthStatKey, GrowthGrade>;

/**
 * The fallback for a hero with no authored line. Every one of the 36 authors its own as of
 * 2026-09-10 and test/roster.test.ts refuses a hero that does not, so this is reached only by a
 * hero definition mid-authoring. All-B is exactly the budget, so such a hero is fairly costed
 * rather than free.
 */
export const DEFAULT_GRADES: GrowthGrades = Object.fromEntries(
  GROWTH_STATS.map((stat) => [stat, 'B' as GrowthGrade])
) as GrowthGrades;

export function gradesFor(hero: HeroDefinition | undefined): GrowthGrades {
  return hero?.growthGrades ?? DEFAULT_GRADES;
}

export function gradeBudgetOf(grades: GrowthGrades): number {
  return GROWTH_STATS.reduce((total, stat) => total + GRADE_COST[grades[stat]], 0);
}

// --- The level curve ---

/** Acts 1-5 each run four: the forced fight, the Skirmish, the Elite-or-Battle, the Guardian. */
export const ENCOUNTERS_PER_ACT = 4;

/**
 * Cumulative level after N won encounters, roster-wide. Authored outright rather than derived
 * from a per-fight rate: the act-end figures are the decided shape (6 / 12 / 18 / 23 / 28 / 30,
 * docs/growth-overhaul.md §3) and a rate would only approximate them. Four encounters an act
 * for acts 1-5 — forced fight, Skirmish, Elite-or-Battle, Guardian — then the finale.
 *
 * Level 5 lands on the THIRD encounter of act 1, which is where the Evolution surfaces until
 * phase 4 moves it to the Crucible.
 *
 * Every figure is a first-pass placeholder for playtest; only the shape is decided.
 */
export const LEVEL_AFTER_ENCOUNTER: readonly number[] = [
  1, // nothing won yet
  3, 5, 7, 8, // act 1
  10, 11, 13, 14, // act 2
  16, 17, 18, 19, // act 3
  21, 22, 23, 24, // act 4
  25, 26, 27, 28, // act 5
  30, // the finale
];

/** The curve's level at `encountersWon`, flat at MAX_LEVEL past the end of the table. */
export function levelAfterEncounters(encountersWon: number): number {
  const at = Math.max(0, Math.min(encountersWon, LEVEL_AFTER_ENCOUNTER.length - 1));
  return Math.min(MAX_LEVEL, LEVEL_AFTER_ENCOUNTER[at]);
}

/**
 * Levels one won encounter pays. A DELTA, never a target: a hero that joined late has missed the
 * grants before it and stays behind permanently, which is what keeps "arrives underlevelled" a
 * real archetype for a Guild Hall hire (docs/growth-overhaul.md §6) instead of a rounding error.
 */
export function levelsForEncounter(encountersWon: number): number {
  return Math.max(0, levelAfterEncounters(encountersWon) - levelAfterEncounters(encountersWon - 1));
}

// --- The roll ---

/** One level's worth of growth for one hero: each stat rolled independently against its grade. */
export function rollLevelGrowth(
  grades: GrowthGrades,
  random: () => number = Math.random
): Partial<Record<StatKey, number>> {
  const gained: Partial<Record<StatKey, number>> = {};
  for (const stat of GROWTH_STATS) {
    if (random() < GRADE_CHANCE[grades[stat]]) gained[stat] = growthStepFor(stat);
  }
  return gained;
}

/**
 * `levels` levels onto one hero, capped at MAX_LEVEL, rolling growth for each. Returns the entry
 * and what it gained, so a caller can report it without re-deriving.
 */
export function levelUpEntry(
  entry: RosterEntry,
  hero: HeroDefinition | undefined,
  levels: number,
  random: () => number = Math.random
): { entry: RosterEntry; gained: Partial<Record<StatKey, number>> } {
  const grades = gradesFor(hero);
  const target = Math.min(MAX_LEVEL, entry.level + Math.max(0, levels));
  let gained: Partial<Record<StatKey, number>> = {};
  for (let level = entry.level; level < target; level++) {
    gained = mergeStatMods(gained, rollLevelGrowth(grades, random));
  }
  return {
    entry: { ...entry, level: target, growthStatGrants: mergeStatMods(entry.growthStatGrants, gained) },
    gained,
  };
}

/** What one won encounter does to the whole roster — benched heroes included, which is the point. */
export function grantEncounterLevels(
  run: RunState,
  heroLookup: Record<string, HeroDefinition>,
  random: () => number = Math.random
): RunState {
  const levels = levelsForEncounter(run.encountersWon);
  if (levels <= 0) return run;
  return {
    ...run,
    roster: run.roster.map((entry) => levelUpEntry(entry, heroLookup[entry.heroId], levels, random).entry),
  };
}
