// The lessons' own cast (data/lessons.ts): battlefield-only, in no pool, deck or draft. Valor before
// her sword, Wild's Edge's wildlife, and the Endbringer as the Faceless. The creatures sit under the 550
// on purpose: they are the world before the Titan, not heroes.

import type { HeroDefinition, MoveDefinition } from '../engine/content';
import { STORY_UNDYING_ID } from './passives';

export const STORY_CAST_IDS = {
  valor: 'valorPrologue',
  stag: 'stag',
  fox: 'fox',
  endbringer: 'endbringerPrologue',
} as const;

/** The cast's own moves: untiered, in no pool — a Story creature is their only holder. */
export const storyMoves: Record<string, MoveDefinition> = {
  // The White Stag's opener: the cold saps both hunters, so Fang's Howl is the turn that wins round 2.
  wintersBreath: {
    id: 'wintersBreath',
    name: "Winter's Breath",
    type: 'Frost',
    category: 'magical',
    kind: 'buff',
    statDeltas: [{ stat: 'attack', stages: -1 }],
    manaCost: 20,
    priority: 0,
    target: 'bothEnemies',
  },
};

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
  // The Hunt's second lesson: Iron cuts it, Beast barely scratches it, and once its breath has
  // sapped both hunters Valor only drops it after Fang's Howl. Storm for the quarter Beast does.
  [STORY_CAST_IDS.stag]: {
    id: STORY_CAST_IDS.stag,
    name: 'White Stag',
    types: ['Frost', 'Storm'],
    baseStats: { hp: 220, attack: 30, defense: 35, intelligence: 35, wisdom: 30, speed: 45, manaPool: 70, mpRegen: 10 },
    moveIds: ['wintersBreath'],
  },
  // Takes both hunters' hits to drop: neither one alone finishes it.
  [STORY_CAST_IDS.fox]: {
    id: STORY_CAST_IDS.fox,
    name: 'Fox',
    types: ['Beast'],
    baseStats: { hp: 200, attack: 45, defense: 30, intelligence: 20, wisdom: 30, speed: 70, manaPool: 40, mpRegen: 10 },
    moveIds: ['pounce'],
  },
  // The Herald before the Titan falls: it can't be knocked out, and the fight ends when it is held at 1.
  [STORY_CAST_IDS.endbringer]: {
    id: STORY_CAST_IDS.endbringer,
    name: 'The Faceless',
    types: ['Ancient'],
    baseStats: { hp: 250, attack: 60, defense: 60, intelligence: 70, wisdom: 60, speed: 40, manaPool: 200, mpRegen: 25 },
    moveIds: ['erode', 'transfix'],
    passiveIds: [STORY_UNDYING_ID],
  },
};
