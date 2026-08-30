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
    // Mana raised from 25/3 when Beast's authored movepool landed
    // (src/data/moves.ts, 2026-08-30): its old kit was fangRush (8) and
    // savageMaul (16), and the slate's cheapest attack is 20, so at the old
    // pool this goblin could open once and then Rest most of the fight. 40/10
    // is the same fix and the same number Torch Goblin, Goblin Skulker,
    // Spooky Goblin and Goblin Warrior all got — the fifth time, which makes
    // it the standard basic-enemy pool rather than a per-case patch. Stat
    // line otherwise untouched.
    baseStats: { hp: 50, attack: 35, defense: 25, intelligence: 15, wisdom: 20, speed: 40, manaPool: 40, mpRegen: 10 },
    // Both at 20, which is what 40/10 sustains, and between them they teach
    // Beast's two clocks from the side of the field the player is fighting:
    // Claw's chanced Bleed and Venom Bite's guaranteed Poison, neither of
    // which the player can switch away from.
    moveIds: ['claw', 'venomBite'],
    starter: false,
  },
  // Retyped Beast -> Shadow (per user direction) so the opening Goblin fight
  // draws from 5 distinct basic types instead of 2 mono-Beast Goblins.
  // Moveset swapped to Shadow-type moves accordingly (STAB).
  goblinSkulker: {
    id: 'goblinSkulker',
    name: 'Goblin Skulker',
    types: ['Shadow'],
    // Mana raised from 25/3 when Shadow's authored movepool landed
    // (src/data/moves.ts): the cheapest Shadow damage move is now 20, not 11,
    // and Weaken went 9 -> 15, so at the old pool this goblin could open once
    // and then Rest most of the fight. Same fix, same reason, as Torch Goblin
    // below. Stat line otherwise untouched.
    baseStats: { hp: 45, attack: 30, defense: 20, intelligence: 15, wisdom: 20, speed: 45, manaPool: 40, mpRegen: 10 },
    moveIds: ['backstab', 'weaken'],
    starter: false,
  },
  spookyGoblin: {
    id: 'spookyGoblin',
    name: 'Spooky Goblin',
    types: ['Spirit'],
    // Mana raised from 30/4 when Spirit's authored movepool landed
    // (src/data/moves.ts): its old kit was soulRend (11) and spectralBind
    // (12), and the slate reprices soulRend to 50 and deletes spectralBind
    // entirely, so on the old pool this goblin could not cast its own opener
    // at all. Same fix and same numbers as Torch Goblin and Goblin Skulker
    // before it. Stat line otherwise untouched.
    baseStats: { hp: 42, attack: 20, defense: 20, intelligence: 35, wisdom: 30, speed: 42, manaPool: 40, mpRegen: 10 },
    // Both at 20, which is what 40/10 can actually sustain — and between them
    // they demonstrate Haunt end to end on the side of the field the player is
    // fighting: Wisp plants the mark, and Drain (any Spirit damage move) then
    // spreads onto the holder when it hits the partner. Spirit is the first
    // authored type since Storm whose signature status the player can learn by
    // having it used against them.
    moveIds: ['wisp', 'drain'],
    starter: false,
  },
  goblinWarrior: {
    id: 'goblinWarrior',
    name: 'Goblin Warrior',
    types: ['Iron'],
    // Mana raised from 20/2 when Iron's authored movepool landed
    // (src/data/moves.ts, 2026-08-30): the cheapest Iron move is now 15 and
    // the cheapest Iron ATTACK is 20, where Quick Jab used to cost 4, so at
    // the old pool this goblin could act about once every five rounds. 40/10
    // is the same fix and the same number Torch Goblin, Goblin Skulker and
    // Spooky Goblin all got — enemies have no relics, equipment or Evolution,
    // so their pools are fixed for the whole game. Stat line otherwise
    // untouched.
    //
    // Opening Strike beside Iron Fist deliberately: it is the type's whole
    // identity (shrink the Defense, then swing) demonstrated from the side of
    // the field the player is fighting, which is the thing Nature, Arcane and
    // Mind each shipped without.
    baseStats: { hp: 55, attack: 35, defense: 35, intelligence: 10, wisdom: 15, speed: 30, manaPool: 40, mpRegen: 10 },
    moveIds: ['ironFist', 'openingStrike'],
    starter: false,
  },
  torchGoblin: {
    id: 'torchGoblin',
    name: 'Torch Goblin',
    types: ['Fire'],
    // Mana raised from 28/4 when Fire's authored movepool landed
    // (src/data/moves.ts): the cheapest Fire damage move is now 20, not 10,
    // so at the old pool this goblin could act roughly every third round and
    // Rest the rest of the fight. Stat line otherwise untouched.
    baseStats: { hp: 42, attack: 32, defense: 18, intelligence: 25, wisdom: 18, speed: 48, manaPool: 40, mpRegen: 10 },
    moveIds: ['ember', 'singe'],
    starter: false,
  },
  // Considerably stronger than the basic 5 (docs/run-loop.md "Per-act
  // difficulty scaling" — the first tougher-tier monster content). Fields
  // the "Monsters" battle node (map row 4, next to Elite) alongside 3 random
  // basic Goblins, per user direction.
  goblinChief: {
    id: 'goblinChief',
    name: 'Goblin Chief',
    types: ['Beast'],
    // Mana raised from 50/6 with the Beast slate (src/data/moves.ts,
    // 2026-08-30). Its old kit was savageMaul (16) and warHorn (24) and both
    // died; the replacements cost 35 and 40, so the old pool could open once
    // and then Rest for four rounds. 70/14 rather than the basics' 40/10
    // because this is the tougher tier and its rows are Mid-tier ones —
    // it opens, answers, and then has to wait, which is the right shape for
    // a fight the player is meant to survive rather than win on tempo.
    baseStats: { hp: 110, attack: 60, defense: 45, intelligence: 25, wisdom: 35, speed: 50, manaPool: 70, mpRegen: 14 },
    // The Chief fights alongside 3 basic Goblins, one of which can be the
    // Beast Grunt above — so it is the one enemy in the game that can satisfy
    // Pack Hunt's partner condition, and pressing it beside a Grunt is 80
    // base power for 40 mana. That is deliberate: the pack condition is the
    // slate's signature and the player's own roster can only reach it through
    // a type-graft Evolution (docs/authoring-moves.md §10), so this is where
    // they see it work. Lacerate is the Bleed the whole type is built on.
    moveIds: ['lacerate', 'packHunt'],
    starter: false,
  },
};

/** The 5 basic, opener-tier Goblin types (docs/run-loop.md) — row 0's opening fight draws 2 of these; the "Monsters" battle node (row 4) draws 3 alongside `GOBLIN_CHIEF_ID`. Excludes `goblinChief`, which is never randomly drawn — it's always present in its own encounter. */
export const BASIC_GOBLIN_IDS = ['goblinGrunt', 'goblinSkulker', 'spookyGoblin', 'goblinWarrior', 'torchGoblin'] as const;

export const GOBLIN_CHIEF_ID = 'goblinChief';

/** `enemies` filtered to just `BASIC_GOBLIN_IDS`, for encounter generation that must never draw the Chief. */
export const basicGoblins: Record<string, HeroDefinition> = Object.fromEntries(
  BASIC_GOBLIN_IDS.map((id) => [id, enemies[id]])
);
