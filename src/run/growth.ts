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

/**
 * What one level can do to one stat, per grade: the odds (in %) of gaining 0, 1, 2, 3 or 4
 * POINTS, indexed by the points. A grade is both how often a stat grows and how far it can jump —
 * an S rarely misses and reaches +4; an F almost always misses and never passes +2.
 *
 * Every row's mean is exactly `0.1 + 0.3 × GRADE_COST`, the figure the flat +2 roll paid, so the
 * grade budget still buys every on-budget line the same growth and the difficulty curve fitted
 * against the flat roll still holds. Only the shape changed: a level is a roll, not a schedule
 * (docs/growth-overhaul.md §3).
 */
export const GRADE_ROLL: Record<GrowthGrade, readonly number[]> = {
  S: [10, 24, 38, 22, 6],
  A: [18, 30, 30, 18, 4],
  B: [30, 28, 28, 10, 4],
  C: [40, 28, 24, 8],
  D: [52, 30, 14, 4],
  E: [68, 24, 8],
  F: [92, 6, 2],
};

/** Chance a level's roll for that stat lands at all — everything in the row past the miss. */
export const GRADE_CHANCE: Record<GrowthGrade, number> = Object.fromEntries(
  (Object.entries(GRADE_ROLL) as [GrowthGrade, readonly number[]][]).map(([grade, row]) => [grade, (100 - row[0]) / 100])
) as Record<GrowthGrade, number>;

/** Mean points a level pays that stat. Linear in cost — see GRADE_ROLL. */
export function gradeExpectedPoints(grade: GrowthGrade): number {
  return GRADE_ROLL[grade].reduce((sum, weight, points) => sum + (weight / 100) * points, 0);
}

/** The most points one level can land on a stat of that grade. */
export function gradeMaxPoints(grade: GrowthGrade): number {
  return GRADE_ROLL[grade].length - 1;
}

/**
 * What a grade costs against the grade budget. The SECOND budget: the 550 stat rule alone stops
 * being enough to say a hero is fairly costed the moment growth exists, because a low base with
 * S-grades outruns a high base with F-grades however the 550 is spent.
 */
export const GRADE_COST: Record<GrowthGrade, number> = { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };

/** Every hero's grades sum to exactly this — seven stats at an average of B. */
export const GRADE_BUDGET = 28;

/**
 * What one POINT of a roll is worth on the stat line. HP is NOT a special case: CLAUDE.md's own
 * measured break-even is ≈0.33 a point, so 3 HP is 1 point's worth of anything else.
 */
export const GROWTH_UNIT = 1;
export const GROWTH_UNIT_HP = 3;

export function growthUnitFor(stat: StatKey): number {
  return stat === 'hp' ? GROWTH_UNIT_HP : GROWTH_UNIT;
}

/** One stat's roll: the points the grade's row lands on, for one uniform draw. */
export function rollGradePoints(grade: GrowthGrade, random: () => number = Math.random): number {
  const row = GRADE_ROLL[grade];
  const draw = random();
  let cumulative = 0;
  for (let points = 0; points < row.length; points++) {
    cumulative += row[points];
    if (draw < cumulative / 100) return points;
  }
  return row.length - 1;
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
    const points = rollGradePoints(grades[stat], random);
    if (points > 0) gained[stat] = points * growthUnitFor(stat);
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

/**
 * What one won encounter did to ONE hero. The roll is destructive — a grade is a coin, not a
 * schedule — so what it produced has to be carried out of the grant rather than read back off the
 * entry afterwards. The post-battle screen is the only reader.
 */
export interface HeroLevelUp {
  rosterId: string;
  heroId: string;
  fromLevel: number;
  /** Equal to `fromLevel` for a hero already at MAX_LEVEL; it is still on the roster and still reported. */
  toLevel: number;
  gained: Partial<Record<StatKey, number>>;
}

/**
 * What one won encounter does to the whole roster — benched heroes included, which is the point —
 * and the per-hero report of what it rolled.
 */
export function applyEncounterLevels(
  run: RunState,
  heroLookup: Record<string, HeroDefinition>,
  random: () => number = Math.random
): { run: RunState; report: HeroLevelUp[] } {
  const levels = levelsForEncounter(run.encountersWon);
  if (levels <= 0) return { run, report: [] };
  const report: HeroLevelUp[] = [];
  const roster = run.roster.map((entry) => {
    const { entry: levelled, gained } = levelUpEntry(entry, heroLookup[entry.heroId], levels, random);
    report.push({
      rosterId: entry.rosterId,
      heroId: entry.heroId,
      fromLevel: entry.level,
      toLevel: levelled.level,
      gained,
    });
    return levelled;
  });
  return { run: { ...run, roster }, report };
}

/** The same grant, for a caller with nowhere to report it (the simulator, the tests). */
export function grantEncounterLevels(
  run: RunState,
  heroLookup: Record<string, HeroDefinition>,
  random: () => number = Math.random
): RunState {
  return applyEncounterLevels(run, heroLookup, random).run;
}
