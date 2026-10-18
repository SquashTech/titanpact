// The Story cast (docs/stories.md §3, §7): battlefield-only, in no pool, deck or draft. Valor's
// prologue form, her father and brother, Wild's Edge's wildlife before the fall, and the Endbringer
// as the family first meets it. The creatures sit under the 550 on purpose: they are the world before
// the Titan, not heroes.

import type { HeroDefinition } from '../engine/content';
import { STORY_UNDYING_ID } from './passives';

export const STORY_CAST_IDS = {
  valor: 'valorPrologue',
  ren: 'ren',
  will: 'will',
  stag: 'stag',
  fox: 'fox',
  boar: 'boar',
  crow: 'crow',
  endbringer: 'endbringerPrologue',
  mira: 'mira',
} as const;

export const storyCast: Record<string, HeroDefinition> = {
  // Valor before the sword: her own line and grades, her fists.
  [STORY_CAST_IDS.valor]: {
    id: STORY_CAST_IDS.valor,
    name: 'Valor',
    types: ['Iron'],
    baseStats: { hp: 220, attack: 60, defense: 65, intelligence: 40, wisdom: 45, speed: 60, manaPool: 60, mpRegen: 10 },
    moveIds: ['ironFist', 'fortify'],
    growthGrades: { hp: 'A', attack: 'A', defense: 'B', intelligence: 'C', wisdom: 'B', speed: 'B', manaPool: 'C' },
  },
  // Ren, the Swordsman: Iron, his patron cuts' type (docs/stories.md §12).
  [STORY_CAST_IDS.ren]: {
    id: STORY_CAST_IDS.ren,
    name: 'Ren',
    types: ['Iron'],
    baseStats: { hp: 200, attack: 100, defense: 65, intelligence: 20, wisdom: 50, speed: 60, manaPool: 55, mpRegen: 10 },
    moveIds: ['crescentCut', 'galeSever'],
    growthGrades: { hp: 'B', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'B', speed: 'A', manaPool: 'C' },
  },
  // Will: Storm, quick and light, trained in his father's cut (docs/stories.md §12).
  [STORY_CAST_IDS.will]: {
    id: STORY_CAST_IDS.will,
    name: 'Will',
    types: ['Storm'],
    baseStats: { hp: 180, attack: 80, defense: 50, intelligence: 40, wisdom: 45, speed: 100, manaPool: 55, mpRegen: 10 },
    moveIds: ['thunderclap', 'zap'],
    growthGrades: { hp: 'C', attack: 'A', defense: 'C', intelligence: 'B', wisdom: 'C', speed: 'S', manaPool: 'B' },
  },
  // Mira, a hedge-mage from a chapel the Titan's wake swallowed (name and type PROPOSED, docs/stories.md §15):
  // the party's first caster, so its first magical damage, heal and status.
  [STORY_CAST_IDS.mira]: {
    id: STORY_CAST_IDS.mira,
    name: 'Mira',
    types: ['Light'],
    baseStats: { hp: 190, attack: 20, defense: 45, intelligence: 95, wisdom: 85, speed: 60, manaPool: 55, mpRegen: 10 },
    moveIds: ['glimmer', 'mend', 'blind'],
    growthGrades: { hp: 'C', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'A' },
  },
  [STORY_CAST_IDS.stag]: {
    id: STORY_CAST_IDS.stag,
    name: 'Stag',
    types: ['Nature'],
    baseStats: { hp: 120, attack: 40, defense: 35, intelligence: 25, wisdom: 30, speed: 45, manaPool: 40, mpRegen: 10 },
    moveIds: ['ivySpike'],
  },
  [STORY_CAST_IDS.fox]: {
    id: STORY_CAST_IDS.fox,
    name: 'Fox',
    types: ['Beast'],
    baseStats: { hp: 100, attack: 45, defense: 30, intelligence: 20, wisdom: 30, speed: 70, manaPool: 40, mpRegen: 10 },
    moveIds: ['pounce'],
  },
  [STORY_CAST_IDS.boar]: {
    id: STORY_CAST_IDS.boar,
    name: 'Boar',
    types: ['Beast'],
    baseStats: { hp: 150, attack: 50, defense: 50, intelligence: 15, wisdom: 30, speed: 35, manaPool: 40, mpRegen: 10 },
    moveIds: ['gash'],
  },
  [STORY_CAST_IDS.crow]: {
    id: STORY_CAST_IDS.crow,
    name: 'Crow',
    types: ['Storm'],
    baseStats: { hp: 80, attack: 20, defense: 30, intelligence: 45, wisdom: 35, speed: 80, manaPool: 40, mpRegen: 10 },
    moveIds: ['zap'],
  },
  // The Herald before the Titan falls: it can't be knocked out, and the fight ends when it is held at 1.
  [STORY_CAST_IDS.endbringer]: {
    id: STORY_CAST_IDS.endbringer,
    name: 'The Faceless',
    types: ['Ancient'],
    baseStats: { hp: 200, attack: 60, defense: 60, intelligence: 70, wisdom: 60, speed: 40, manaPool: 200, mpRegen: 25 },
    moveIds: ['erode', 'transfix'],
    passiveIds: [STORY_UNDYING_ID],
  },
};
