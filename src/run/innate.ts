// The innate passive (docs/innate-passives.md): the one verb a hero was born with, held on
// HeroDefinition.passiveIds and read here by every surface that names it — the draft card, the
// hero sheet, the scouted chip. A Titanspawn's one is its type's Mark; the Titan's pieces hold
// several and are not "innate" in this sense, so this reads the FIRST that is not a Mark.

import type { HeroDefinition, PassiveDefinition, PassiveId } from '../engine/content';
import { isTitansMark, passives } from '../data/passives';
import { isInnateMastered } from './mastery';
import type { RosterEntry } from './state';

/** The hero's innate, or null for a definition that holds none (a Titan's piece, a fixture). A two-card innate (Broadside's load and its firing) is read by its first. */
export function innatePassiveOf(hero: Pick<HeroDefinition, 'passiveIds'>): PassiveDefinition | null {
  for (const id of hero.passiveIds ?? []) {
    if (!isTitansMark(id) && passives[id]) return passives[id];
  }
  return null;
}

/** The Mark a spawn or a Guardian carries, or null. The chip reads it as the Titan's, not the creature's. */
export function titansMarkOf(hero: Pick<HeroDefinition, 'passiveIds'>): PassiveDefinition | null {
  for (const id of hero.passiveIds ?? []) {
    if (isTitansMark(id) && passives[id]) return passives[id];
  }
  return null;
}

// --- The mastered innate (docs/mastery.md §5b) ---
//
// The tenth Mastery pip REPLACES the born card with its authored upgrade — the same verb, a
// sizable step louder — rather than stacking a second card beside it: a hero holds one innate,
// mastered or not. A definition with no upgrade (a spawn, a Titan's piece) keeps what it has.

/** The passive ids this hero fights with as its own: the mastered set once the tenth pip has landed, the born set before. */
export function innatePassiveIdsFor(
  hero: Pick<HeroDefinition, 'passiveIds' | 'masteredPassiveIds'>,
  entry: Pick<RosterEntry, 'mastery'> | undefined
): readonly PassiveId[] | undefined {
  if (entry && isInnateMastered(entry) && hero.masteredPassiveIds && hero.masteredPassiveIds.length > 0) return hero.masteredPassiveIds;
  return hero.passiveIds;
}

/** The upgrade the tenth pip teaches, read by its first card, or null for a definition with none. */
export function masteredInnateOf(hero: Pick<HeroDefinition, 'masteredPassiveIds'>): PassiveDefinition | null {
  return innatePassiveOf({ passiveIds: hero.masteredPassiveIds });
}

/** The innate as it stands on THIS roster entry — mastered once the tenth pip has landed. What an entry-aware surface names. */
export function currentInnateOf(
  hero: Pick<HeroDefinition, 'passiveIds' | 'masteredPassiveIds'>,
  entry: Pick<RosterEntry, 'mastery'> | undefined
): PassiveDefinition | null {
  return innatePassiveOf({ passiveIds: innatePassiveIdsFor(hero, entry) });
}
