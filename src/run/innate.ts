// The innate passive (docs/innate-passives.md): the one verb a hero was born with, held on
// HeroDefinition.passiveIds and read here by every surface that names it — the draft card, the
// hero sheet, the scouted chip. A Titanspawn's one is its type's Mark; the Titan's pieces hold
// several and are not "innate" in this sense, so this reads the FIRST that is not a Mark.

import type { HeroDefinition, PassiveDefinition } from '../engine/content';
import { isTitansMark, passives } from '../data/passives';

/** The hero's innate, or null for a definition that holds none (a Titan's piece, a fixture). */
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
