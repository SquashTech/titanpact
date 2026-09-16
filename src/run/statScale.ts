// The reference a stat bar is drawn against. A fixed ceiling was right when a stat was the
// authored base and wrong once it grew: by the end of Act 2 a hero's spiked stat sat past it
// and the bar read as full for the rest of the run. The reference walks with the run's PAR
// instead — the same level the enemy curve is set off (difficulty.ts) — so every hero on the
// roster is drawn against one reference at any moment, nothing saturates, and at level 1 it is
// the old fixed table, derived instead of authored.

import type { StatKey, StatLine } from '../engine/content';
import { STAT_ORDER } from '../engine/content';
import type { StatModifiers } from '../engine/state';
import { relics } from '../data/relics';
import { heroes } from '../data/heroes';
import { gradeExpectedPoints, gradesFor, GROWTH_STATS, growthUnitFor, levelAfterEncounters, levelOf } from './growth';
import { relicTeamStatModifiers } from './relics';
import type { RunState } from './state';

export interface StatScale {
  /** The level the reference stands at. */
  level: number;
  /** Where a bar is full: the pool's best expected line at that level, a loadout margin over it, the team's grants on top. */
  ceiling: StatLine;
  /** Where a typical hero of the pool stands at that level, grants excluded — the tick on the track. */
  par: StatLine;
}

/**
 * Headroom over the pool's best line for what a loadout adds: three sockets and an Evolution's
 * grants. Team-wide grants are added outright rather than priced into this, since five stacked
 * Warcries are +200 Attack and no ratio over base survives that. A single outlier past the
 * ceiling clamps, which is acceptable; the roster as a whole is what must not.
 */
export const STAT_SCALE_LOADOUT_MARGIN = 1.35;

/** A hero's expected stat at a level under mean growth, no loadout — the line the reference is built from. */
function expectedStat(baseStats: StatLine, grades: ReturnType<typeof gradesFor>, stat: StatKey, level: number): number {
  const grade = (GROWTH_STATS as readonly StatKey[]).includes(stat) ? grades[stat as keyof typeof grades] : undefined;
  if (!grade) return baseStats[stat];
  return baseStats[stat] + gradeExpectedPoints(grade) * growthUnitFor(stat) * (level - 1);
}

const POOL = Object.values(heroes);

/** The reference at a par level, with the team's relic grants (RunState.relics) folded into the ceiling. */
export function statScaleAt(level: number, teamGrants: StatModifiers = {}): StatScale {
  const ceiling = {} as StatLine;
  const par = {} as StatLine;
  for (const stat of STAT_ORDER) {
    const line = POOL.map((hero) => expectedStat(hero.baseStats, gradesFor(hero), stat, level)).sort((a, b) => a - b);
    ceiling[stat] = Math.round(line[line.length - 1] * STAT_SCALE_LOADOUT_MARGIN + Math.max(0, teamGrants[stat] ?? 0));
    par[stat] = Math.round(line[Math.floor(line.length / 2)]);
  }
  return { level, ceiling, par };
}

/**
 * The run's par as the roster stands: everyone but a late joiner under automatic levelling.
 * Read off the roster rather than the curve so it is right for a hero the curve does not
 * describe — a contract recruit arriving at act level, or a fixture — falling back to the curve
 * for an empty one.
 */
export function rosterPar(run: Pick<RunState, 'roster' | 'encountersWon'>): number {
  return run.roster.reduce((best, entry) => Math.max(best, levelOf(entry)), levelAfterEncounters(run.encountersWon));
}

/** The reference for this run: its par, its Banners. */
export function statScaleFor(run: Pick<RunState, 'roster' | 'encountersWon' | 'relics'>): StatScale {
  return statScaleAt(rosterPar(run), relicTeamStatModifiers(run.relics, relics));
}

/** Level 1, nothing held: the draft's and the Compendium's reference. */
export const BASE_STAT_SCALE: StatScale = statScaleAt(1);
