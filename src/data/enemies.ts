// ⚠️ TEST FIXTURE CONTENT — non-recruitable mob content (docs/run-loop.md
// "Non-recruitable enemy content"), authored specifically to be weaker than
// the draftable hero roster. Structurally identical to HeroDefinition (same
// stats/types/moves shape — a Goblin doesn't need a different schema, it
// needs different NUMBERS), but lives in its own pool, separate from
// src/data/heroes.ts, so src/run/recruitment.ts's isRecruitable check can
// exclude it: a Goblin KO'd in a fight never produces a Recruit Contract
// offer. This is what lets early map rows field an intentionally-losing-side
// encounter without "spending" a real hero concept as disposable fodder.

import type { HeroDefinition } from '../engine/content';

// `starter: false` on both entries below is never actually read — enemies live
// in their own pool, outside src/data/heroes.ts, so nothing iterates them
// looking for draft/Guild-Hall candidates in the first place (isRecruitable
// already excludes this whole file by pool membership, per the header above).
// It's set for type-shape compatibility with HeroDefinition, and because it's
// the semantically correct value anyway: a Goblin is never a draftable starter.
export const enemies: Record<string, HeroDefinition> = {
  goblinGrunt: {
    id: 'goblinGrunt',
    name: 'Goblin Grunt',
    types: ['Beast'],
    baseStats: { hp: 50, attack: 35, defense: 25, intelligence: 15, wisdom: 20, speed: 40, manaPool: 25, mpRegen: 3 },
    moveIds: ['fangRush', 'savageMaul'],
    starter: false,
  },
  goblinSkulker: {
    id: 'goblinSkulker',
    name: 'Goblin Skulker',
    types: ['Beast'],
    baseStats: { hp: 45, attack: 30, defense: 20, intelligence: 15, wisdom: 20, speed: 45, manaPool: 25, mpRegen: 3 },
    moveIds: ['fangRush', 'rendingClaw'],
    starter: false,
  },
};
