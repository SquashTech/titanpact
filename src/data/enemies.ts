// Non-recruitable enemy content (docs/run-loop.md "Non-recruitable enemy content").
// Same shape as HeroDefinition but a separate pool from heroes.ts, which is what lets
// isRecruitable exclude it — a KO'd Goblin never produces a Recruit Contract offer.

import type { HeroDefinition } from '../engine/content';

export const enemies: Record<string, HeroDefinition> = {
  goblinGrunt: {
    id: 'goblinGrunt',
    name: 'Goblin Grunt',
    types: ['Beast'],
    baseStats: { hp: 50, attack: 35, defense: 25, intelligence: 15, wisdom: 20, speed: 40, manaPool: 40, mpRegen: 10 },
    moveIds: ['claw', 'venomBite'],
    starter: false,
  },
  goblinSkulker: {
    id: 'goblinSkulker',
    name: 'Goblin Skulker',
    types: ['Shadow'],
    baseStats: { hp: 45, attack: 30, defense: 20, intelligence: 15, wisdom: 20, speed: 45, manaPool: 40, mpRegen: 10 },
    moveIds: ['backstab', 'weaken'],
    starter: false,
  },
  spookyGoblin: {
    id: 'spookyGoblin',
    name: 'Spooky Goblin',
    types: ['Spirit'],
    baseStats: { hp: 42, attack: 20, defense: 20, intelligence: 35, wisdom: 30, speed: 42, manaPool: 40, mpRegen: 10 },
    moveIds: ['wisp', 'drain'],
    starter: false,
  },
  goblinWarrior: {
    id: 'goblinWarrior',
    name: 'Goblin Warrior',
    types: ['Iron'],
    baseStats: { hp: 55, attack: 35, defense: 35, intelligence: 10, wisdom: 15, speed: 30, manaPool: 40, mpRegen: 10 },
    moveIds: ['ironFist', 'openingStrike'],
    starter: false,
  },
  torchGoblin: {
    id: 'torchGoblin',
    name: 'Torch Goblin',
    types: ['Fire'],
    baseStats: { hp: 42, attack: 32, defense: 18, intelligence: 25, wisdom: 18, speed: 48, manaPool: 40, mpRegen: 10 },
    moveIds: ['ember', 'singe'],
    starter: false,
  },
  // Fields the "Monsters" battle node alongside 3 random basic Goblins; never randomly drawn.
  goblinChief: {
    id: 'goblinChief',
    name: 'Goblin Chief',
    types: ['Beast'],
    baseStats: { hp: 110, attack: 60, defense: 45, intelligence: 25, wisdom: 35, speed: 50, manaPool: 70, mpRegen: 14 },
    moveIds: ['lacerate', 'packHunt'],
    starter: false,
  },
  // Wild's Edge's Guardian reinforcement: held on the enemy bench so the fight's first KO
  // brings him in (enemyGen.ts `appendFinalEnemy`, locations.ts `guardianFinalEnemyId`).
  // Not in BASIC_GOBLIN_IDS and not drawn by any generator. Stat total 600 is a playtest figure.
  goblinLord: {
    id: 'goblinLord',
    name: 'Goblin Lord',
    types: ['Beast', 'Ancient'],
    baseStats: { hp: 190, attack: 105, defense: 85, intelligence: 80, wisdom: 65, speed: 75, manaPool: 120, mpRegen: 20 },
    moveIds: ['thrash', 'momentumSwing', 'enfeeble', 'archonBlast'],
    starter: false,
  },
};

/** The 5 basic Goblins: the opening fight draws 2, the "Monsters" battle node draws 3 beside the Chief. */
export const BASIC_GOBLIN_IDS = ['goblinGrunt', 'goblinSkulker', 'spookyGoblin', 'goblinWarrior', 'torchGoblin'] as const;

export const GOBLIN_CHIEF_ID = 'goblinChief';

/** Pointed at by `LocationDefinition.guardianFinalEnemyId` (Wild's Edge only). */
export const GOBLIN_LORD_ID = 'goblinLord';

/** `enemies` filtered to `BASIC_GOBLIN_IDS`, for generators that must never draw the Chief. */
export const basicGoblins: Record<string, HeroDefinition> = Object.fromEntries(
  BASIC_GOBLIN_IDS.map((id) => [id, enemies[id]])
);
