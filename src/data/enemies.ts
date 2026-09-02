// Non-recruitable enemy content (docs/run-loop.md "Non-recruitable enemy content").
// Same shape as HeroDefinition but a separate pool from heroes.ts, which is what lets
// isRecruitable exclude it — a KO'd Goblin never produces a Recruit Contract offer.
//
// Grouped by faction: `factions` below is what a Location points at, so adding a
// faction is data plus one field on LocationDefinition (docs/locations.md §5.2).

import type { HeroDefinition } from '../engine/content';
import type { HeroLookup } from '../engine/state';

export const enemies: Record<string, HeroDefinition> = {
  // --- Goblins (Wild's Edge) — authored for Act 1 ---
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
  // Not in the faction's basics and not drawn by any generator. Stat total 600 is a playtest figure.
  goblinLord: {
    id: 'goblinLord',
    name: 'Goblin Lord',
    types: ['Beast', 'Ancient'],
    baseStats: { hp: 190, attack: 105, defense: 85, intelligence: 80, wisdom: 65, speed: 75, manaPool: 120, mpRegen: 20 },
    moveIds: ['thrash', 'momentumSwing', 'enfeeble', 'archonBlast'],
    starter: false,
  },

  // --- Cultists (Blighted Shrine) — authored for Act 2, scaled up from there ---
  // Every one is Shadow-primary: the faction reads as one cult, and its shared
  // weakness to Light and Spirit is the price of that legibility.
  cultBlade: {
    id: 'cultBlade',
    name: 'Cult Blade',
    types: ['Shadow', 'Iron'],
    baseStats: { hp: 75, attack: 60, defense: 50, intelligence: 20, wisdom: 30, speed: 45, manaPool: 50, mpRegen: 12 },
    moveIds: ['backstab', 'heavyBlow', 'pinDown'],
    starter: false,
  },
  dreadCultist: {
    id: 'dreadCultist',
    name: 'Dread Cultist',
    types: ['Shadow'],
    baseStats: { hp: 70, attack: 25, defense: 40, intelligence: 60, wisdom: 45, speed: 40, manaPool: 60, mpRegen: 12 },
    moveIds: ['umbraBolt', 'weaken', 'drain'],
    starter: false,
  },
  blightedCultist: {
    id: 'blightedCultist',
    name: 'Blighted Cultist',
    types: ['Shadow', 'Nature'],
    baseStats: { hp: 85, attack: 30, defense: 45, intelligence: 55, wisdom: 45, speed: 25, manaPool: 55, mpRegen: 12 },
    moveIds: ['toxicSpores', 'umbraBolt', 'blight'],
    starter: false,
  },
  // Deep Chill sets up Glaciate, which the AI will not declare without a Frozen target
  // (ai.ts hasLegalTarget) — the 65 mana pool is sized to fund both in consecutive rounds.
  frozenCultist: {
    id: 'frozenCultist',
    name: 'Frozen Cultist',
    types: ['Shadow', 'Frost'],
    baseStats: { hp: 70, attack: 30, defense: 45, intelligence: 60, wisdom: 45, speed: 30, manaPool: 65, mpRegen: 12 },
    moveIds: ['deepChill', 'glaciate', 'umbraBolt'],
    starter: false,
  },
  // Fields the "Monsters" battle node alongside 3 random basic Cultists; never randomly drawn.
  // Empower is the faction's tell: the Mystic pours 80 mana into a Cultist that cannot
  // otherwise afford its own best move.
  cultMystic: {
    id: 'cultMystic',
    name: 'Cult Mystic',
    types: ['Shadow', 'Arcane'],
    baseStats: { hp: 135, attack: 35, defense: 65, intelligence: 85, wisdom: 70, speed: 60, manaPool: 100, mpRegen: 16 },
    moveIds: ['magicBolt', 'umbralBeam', 'enfeeble', 'empower'],
    starter: false,
  },
  // The Blighted Shrine's Guardian reinforcement, the Goblin Lord's opposite number one
  // act later: 700 to his 600, and a magical line where his is physical.
  yugzulach: {
    id: 'yugzulach',
    name: 'Yugzulach',
    types: ['Shadow', 'Ancient'],
    baseStats: { hp: 220, attack: 90, defense: 100, intelligence: 120, wisdom: 95, speed: 75, manaPool: 140, mpRegen: 20 },
    moveIds: ['runicBlast', 'forgottenCurse', 'duskBlade', 'eclipse'],
    starter: false,
  },
};

/**
 * A Location's mob roster. `basicIds` is what the `fight` node draws 2 of and the
 * `battle` node draws 3 of; `leaderId` is always present in a `battle` and never
 * randomly drawn. The Guardian's champion is deliberately NOT here — it hangs off
 * the Location, because which champion walks out is a property of whose ground you
 * are on rather than of the faction alone (docs/locations.md `guardianFinalEnemyId`).
 */
export interface FactionRoster {
  id: string;
  name: string;
  /** The act these stat lines represent. `difficulty.ts` scales the pool up from here. */
  baselineAct: number;
  basicIds: readonly string[];
  leaderId: string;
}

export const factions: Record<string, FactionRoster> = {
  goblins: {
    id: 'goblins',
    name: 'Goblins',
    baselineAct: 2,
    basicIds: ['goblinGrunt', 'goblinSkulker', 'spookyGoblin', 'goblinWarrior', 'torchGoblin'],
    leaderId: 'goblinChief',
  },
  cultists: {
    id: 'cultists',
    name: 'Cultists',
    baselineAct: 2,
    basicIds: ['cultBlade', 'dreadCultist', 'blightedCultist', 'frozenCultist'],
    leaderId: 'cultMystic',
  },
};

/** The faction every location without an authored one still fields (docs/locations.md "The faction bill"). */
export const DEFAULT_FACTION_ID = 'goblins';

/** Pointed at by `LocationDefinition.guardianFinalEnemyId`. */
export const GOBLIN_LORD_ID = 'goblinLord';
export const YUGZULACH_ID = 'yugzulach';

/** `enemies` narrowed to one faction's basics, for the generators that must never draw its leader. */
export function basicEnemiesOf(faction: FactionRoster): HeroLookup {
  return Object.fromEntries(faction.basicIds.map((id) => [id, enemies[id]]));
}
