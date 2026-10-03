// A curse on a roster entry (data/curses.ts): `curseId` is the mark the event leaves, `curseTurned`
// the Turn itself. Everything the Turn changes — typing, base line, innate, art — reads `turnedCurse`,
// so a marked hero is exactly itself until the beat that turns it.

import { curses, type CurseDefinition } from '../data/curses';
import type { HeroDefinition, StatKey } from '../engine/content';
import { MASTERY_CAP } from './mastery';
import type { RosterEntry } from './state';

type CurseFields = Partial<Pick<RosterEntry, 'curseId' | 'curseTurned'>>;

/** The curse this entry carries, turned or not. */
export function curseOf(entry: CurseFields): CurseDefinition | null {
  return entry.curseId ? curses[entry.curseId] ?? null : null;
}

/** The curse, once it has Turned the hero; null before, and for every uncursed hero. */
export function turnedCurse(entry: CurseFields): CurseDefinition | null {
  return entry.curseTurned ? curseOf(entry) : null;
}

/** Marked, at or past the Turn's pip, and not yet turned: the beat is owed (masteryFlow raises it). */
export function curseTurnOwed(entry: CurseFields & Pick<RosterEntry, 'mastery'>): boolean {
  const curse = curseOf(entry);
  return !!curse && !entry.curseTurned && entry.mastery >= curse.turnAt;
}

/** The innate a Turned hero fights with: the curse's, its mastered form from the tenth pip. */
export function curseInnateIds(entry: CurseFields & Pick<RosterEntry, 'mastery'>): readonly string[] | null {
  const curse = turnedCurse(entry);
  if (!curse) return null;
  return entry.mastery >= MASTERY_CAP && curse.masteredPassiveIds.length > 0 ? curse.masteredPassiveIds : curse.passiveIds;
}

/**
 * The flat delta that replaces the hero's own base line with the curse's: the curse's figure less
 * the hero's, read against the base as a rewire left it (a rewire's base trade is already in the
 * entry's evolution grants, so it is measured out here and the Werewolf's line lands as written).
 */
export function curseStatDelta(hero: HeroDefinition | undefined, entry: CurseFields & Pick<RosterEntry, 'offenseSwapped'>): Partial<Record<StatKey, number>> {
  const curse = turnedCurse(entry);
  if (!curse || !hero) return {};
  const base: Record<string, number> = { ...hero.baseStats };
  if (entry.offenseSwapped) [base.attack, base.intelligence] = [base.intelligence, base.attack];
  const delta: Partial<Record<StatKey, number>> = {};
  for (const [stat, figure] of Object.entries(curse.baseStats) as [StatKey, number][]) {
    const step = figure - base[stat];
    if (step !== 0) delta[stat] = step;
  }
  return delta;
}
