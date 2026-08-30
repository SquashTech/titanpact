// ⚠️ TEST FIXTURE CONTENT — heroes sufficient to run a 2v2 fight and exercise
// bring-6-pick-4 squad selection (src/run) through the engine. Not the
// authored 53-concept roster (docs/types-and-heroes.md); typings here are
// still arbitrary. The 14 STARTER stat lines are authored and tuned to a
// 450 base Stat Total budget (HP + manaPool + the five battle stats) as of 2026-08-28 — do not nudge one without rebalancing its budget.
// Recruit-only stat lines are still untuned.
//
// STARTING KITS ARE EXACTLY THREE MOVES, for every hero, with no exceptions
// (2026-08-26). A low-power move of the hero's main type plus two supports —
// heal/buff/status. Two reasons it's a rule rather than a habit:
//
//   1. The draft screen (src/view/run/DraftScreen.tsx) puts four candidates'
//      kits side by side and lets the player read each move before
//      committing; one hero carrying a fourth move makes that comparison
//      lopsided before the player has learned what any of the moves do.
//   2. MOVE_CAP is 4 (src/run/progression.ts), so a 3-move kit leaves exactly
//      one slot to grow into via level-up. A hero starting AT the cap could
//      never take a level-up move outright — every offer would arrive as a
//      replacement.
//
// The rest of each hero's thematic movepool lives in src/data/progression.ts'
// moveTiers, offered randomly on level-up. That includes the five Field
// Effect setters (docs/field-effects.md), which used to be granted here as a
// fourth starting move and are now level-up unlocks for the same starters.
//
// `starter` (docs/types-and-heroes.md "Starters vs. recruit-only heroes") is
// the single source of truth for the start-of-run draft pool
// (src/run/draft.ts) vs. the Guild Hall's recruit-only offer pool
// (src/data/recruitment.ts derives its offers from `starter: false` heroes
// here, so the two pools can never drift out of sync with each other).
//
// FILE ORDER: grouped by the hero's PRIMARY type, in src/data/typechart.ts'
// TYPES order — the same order CompendiumScreen renders, so reading this
// file and reading that screen agree (2026-08-26). Design happens per type,
// so a new hero goes in its type's section rather than at the end. Nothing
// reads this order: every consumer either sorts for itself or keys by id.
// Within a section, order is arbitrary — the Compendium's sort is stable, so
// whatever order a section is in here is the order it shows there.

import type { HeroDefinition } from '../engine/content';

export const heroes: Record<string, HeroDefinition> = {
  // --- Fire --------------------------------------------------------------
  cinderKnight: {
    id: 'cinderKnight',
    name: 'Cinder',
    types: ['Fire', 'Iron'],
    baseStats: { hp: 100, attack: 70, defense: 60, intelligence: 30, wisdom: 40, speed: 50, manaPool: 60, mpRegen: 10 },
    moveIds: ['singe', 'fortify', 'restoreVigor'],
    starter: false,
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    types: ['Fire'],
    baseStats: { hp: 100, attack: 30, defense: 38, intelligence: 80, wisdom: 75, speed: 62, manaPool: 65, mpRegen: 10 },
    moveIds: ['ember', 'weaken', 'restoreVigor'],
    starter: true,
  },
  brimstone: {
    id: 'brimstone',
    name: 'Brimstone',
    types: ['Fire', 'Shadow'],
    baseStats: { hp: 80, attack: 55, defense: 35, intelligence: 60, wisdom: 35, speed: 60, manaPool: 55, mpRegen: 10 },
    moveIds: ['ember', 'shadowVeil', 'weaken'],
    starter: false,
  },

  // --- Water -------------------------------------------------------------
  tidecaller: {
    id: 'tidecaller',
    name: 'Riptide',
    types: ['Water'],
    baseStats: { hp: 110, attack: 55, defense: 55, intelligence: 59, wisdom: 40, speed: 66, manaPool: 65, mpRegen: 10 },
    // Water's authored pool (src/data/moves.ts, 2026-08-30). Splash is the
    // magical opener (Int 59 > Atk 55), and both supports are now Water rather
    // than borrowed Nature/Shadow — Riptide is the only Water STARTER, so its
    // three moves are what a player learns the type from.
    moveIds: ['splash', 'tideGuard', 'refresh'],
    starter: true,
  },
  pincer: {
    id: 'pincer',
    name: 'Pincer',
    types: ['Water'],
    // Mana raised from 40 when Water's authored movepool landed: the cheapest
    // Water move is now 15 and its cheapest physical attack 25, against a
    // 7-mana Aqua Jet before — at the old pool Pincer opened with Undertow and
    // then had nothing legal for two rounds. Same fix (and same reason) as
    // Torch Goblin's when Fire landed; stat line otherwise untouched, and 430
    // is still inside the 450 budget the tuned starters use.
    baseStats: { hp: 125, attack: 70, defense: 85, intelligence: 20, wisdom: 45, speed: 30, manaPool: 55, mpRegen: 10 },
    // The physical read of the same pool (Atk 70 / Int 20): Undertow rather
    // than Splash, and Tide Guard on the hero with 85 Defense already, whose
    // job is to make the OTHER slot survivable too.
    moveIds: ['undertow', 'tideGuard', 'stunningBlow'],
    starter: false,
  },

  // --- Frost -------------------------------------------------------------
  glacialWarden: {
    id: 'glacialWarden',
    name: 'Flurry',
    types: ['Frost'],
    baseStats: { hp: 140, attack: 30, defense: 55, intelligence: 70, wisdom: 60, speed: 45, manaPool: 70, mpRegen: 10 },
    moveIds: ['rimeWind', 'frostArmor', 'deepChill'],
    starter: false,
  },
  rime: {
    id: 'rime',
    name: 'Rime',
    types: ['Frost'],
    baseStats: { hp: 110, attack: 65, defense: 55, intelligence: 65, wisdom: 53, speed: 42, manaPool: 60, mpRegen: 10 },
    moveIds: ['iceShard', 'deepChill', 'secondWind'],
    starter: true,
  },
  cube: {
    id: 'cube',
    name: 'Cube',
    types: ['Frost'],
    baseStats: { hp: 90, attack: 50, defense: 80, intelligence: 40, wisdom: 50, speed: 25, manaPool: 45, mpRegen: 10 },
    moveIds: ['iceShard', 'frostArmor', 'fortify'],
    starter: false,
  },

  // --- Storm -------------------------------------------------------------
  stormRanger: {
    id: 'stormRanger',
    name: 'Squall',
    types: ['Storm'],
    baseStats: { hp: 90, attack: 65, defense: 40, intelligence: 35, wisdom: 35, speed: 90, manaPool: 50, mpRegen: 10 },
    moveIds: ['thunderclap', 'risingStatic', 'rally'],
    starter: false,
  },
  tempest: {
    id: 'tempest',
    name: 'Tempest',
    types: ['Storm'],
    baseStats: { hp: 90, attack: 70, defense: 45, intelligence: 70, wisdom: 35, speed: 65, manaPool: 75, mpRegen: 10 },
    moveIds: ['jolt', 'charge', 'rally'],
    starter: true,
  },
  scallywag: {
    id: 'scallywag',
    name: 'Scallywag',
    types: ['Storm'],
    baseStats: { hp: 95, attack: 75, defense: 40, intelligence: 30, wisdom: 35, speed: 80, manaPool: 50, mpRegen: 10 },
    moveIds: ['thunderclap', 'quickJab', 'rally'],
    starter: false,
  },

  // --- Stone -------------------------------------------------------------
  crag: {
    id: 'crag',
    name: 'Crag',
    types: ['Stone'],
    baseStats: { hp: 140, attack: 90, defense: 75, intelligence: 20, wisdom: 35, speed: 40, manaPool: 50, mpRegen: 10 },
    moveIds: ['rockToss', 'toughenUp', 'secondWind'],
    starter: true,
  },
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    types: ['Stone'],
    baseStats: { hp: 150, attack: 45, defense: 100, intelligence: 15, wisdom: 50, speed: 15, manaPool: 30, mpRegen: 10 },
    moveIds: ['mudBall', 'provoke', 'fortify'],
    starter: false,
  },

  // --- Nature ------------------------------------------------------------
  // Re-kitted for the authored Nature slate (src/data/moves.ts, 2026-08-30),
  // split by the stat each hero actually attacks with: Sylva (Int 60 / Atk 45)
  // takes the magical line, Mordrax and Hollowbark (Atk 70, Int 35 and 20) the
  // physical one. Every kit is a Nature attack plus two supports, and every kit
  // carries a Renew source — that is not decoration, it is the type's damage
  // condition (moves.ts Seed Shot, Branch Slam).
  wildOracle: {
    id: 'wildOracle',
    name: 'Sylva',
    types: ['Nature'],
    baseStats: { hp: 80, attack: 45, defense: 60, intelligence: 60, wisdom: 60, speed: 65, manaPool: 80, mpRegen: 10 },
    // The whole type in three moves: Regrowth turns Seed Shot from a 30 BP poke
    // into a 60 BP one, and Toxic Spores starts the timer the pool's Mid/Late
    // half exists to cash in. 65 of an 80 pool, so the opening round is a real
    // choice between two of the three rather than a script.
    moveIds: ['seedShot', 'regrowth', 'toxicSpores'],
    starter: true,
  },
  mordax: {
    id: 'mordax',
    name: 'Mordrax',
    types: ['Nature'],
    baseStats: { hp: 105, attack: 70, defense: 55, intelligence: 35, wisdom: 45, speed: 50, manaPool: 50, mpRegen: 10 },
    moveIds: ['vineLash', 'regrowth', 'rally'],
    starter: false,
  },
  hollowbark: {
    id: 'hollowbark',
    name: 'Hollowbark',
    types: ['Nature'],
    baseStats: { hp: 135, attack: 70, defense: 80, intelligence: 20, wisdom: 45, speed: 30, manaPool: 40, mpRegen: 10 },
    // Ivy Spike at 15 is the cheapest move in the slate, which is what a 40
    // pool wants; Second Wind is its Renew (Spirit, so no STAB) and therefore
    // its route into Branch Slam later.
    moveIds: ['ivySpike', 'fortify', 'secondWind'],
    starter: false,
  },

  // --- Light -------------------------------------------------------------
  dawnwarden: {
    id: 'dawnwarden',
    name: 'Solace',
    types: ['Light'],
    baseStats: { hp: 110, attack: 29, defense: 50, intelligence: 60, wisdom: 70, speed: 61, manaPool: 70, mpRegen: 10 },
    moveIds: ['radiantBeam', 'restoreVigor', 'purify'],
    starter: true,
  },
  aegis: {
    id: 'aegis',
    name: 'Aegis',
    types: ['Light'],
    baseStats: { hp: 120, attack: 45, defense: 80, intelligence: 40, wisdom: 75, speed: 35, manaPool: 70, mpRegen: 10 },
    moveIds: ['radiantBeam', 'fortify', 'secondWind'],
    starter: false,
  },

  // --- Shadow ------------------------------------------------------------
  shadowMonk: {
    id: 'shadowMonk',
    name: 'Vesper',
    types: ['Shadow'],
    baseStats: { hp: 85, attack: 75, defense: 45, intelligence: 40, wisdom: 40, speed: 70, manaPool: 45, mpRegen: 10 },
    moveIds: ['vanish', 'secondWind', 'purify'],
    starter: false,
  },
  marrow: {
    id: 'marrow',
    name: 'Marrow',
    types: ['Shadow'],
    baseStats: { hp: 85, attack: 75, defense: 45, intelligence: 40, wisdom: 40, speed: 70, manaPool: 45, mpRegen: 10 },
    moveIds: ['vanish', 'secondWind', 'purify'],
    starter: false,
  },
  lucius: {
    id: 'lucius',
    name: 'Lucius',
    types: ['Shadow', 'Mind'],
    baseStats: { hp: 100, attack: 35, defense: 40, intelligence: 75, wisdom: 55, speed: 65, manaPool: 70, mpRegen: 10 },
    moveIds: ['shadowVeil', 'curseMind', 'spectralBind'],
    starter: false,
  },
  nightshade: {
    id: 'nightshade',
    name: 'Nightshade',
    types: ['Shadow'],
    baseStats: { hp: 90, attack: 80, defense: 30, intelligence: 65, wisdom: 40, speed: 85, manaPool: 60, mpRegen: 10 },
    moveIds: ['duskStrike', 'vanish', 'nightmareGrasp'],
    starter: true,
  },

  // --- Arcane ------------------------------------------------------------
  runescribe: {
    id: 'runescribe',
    name: 'Glyph',
    types: ['Arcane'],
    baseStats: { hp: 80, attack: 25, defense: 32, intelligence: 90, wisdom: 80, speed: 58, manaPool: 85, mpRegen: 10 },
    moveIds: ['arcaneBolt', 'manaBurst', 'curseMind'],
    starter: true,
  },
  zenith: {
    id: 'zenith',
    name: 'Zenith',
    types: ['Arcane'],
    baseStats: { hp: 95, attack: 20, defense: 45, intelligence: 85, wisdom: 65, speed: 50, manaPool: 90, mpRegen: 10 },
    moveIds: ['arcaneBolt', 'manaBurst', 'arcaneSurge'],
    starter: false,
  },

  // --- Mind --------------------------------------------------------------
  mindweaver: {
    id: 'mindweaver',
    name: 'Cortex',
    types: ['Mind'],
    baseStats: { hp: 100, attack: 53, defense: 45, intelligence: 55, wisdom: 55, speed: 67, manaPool: 75, mpRegen: 10 },
    moveIds: ['psychicLance', 'mindSpike', 'curseMind'],
    starter: true,
  },

  // --- Spirit ------------------------------------------------------------
  revenant: {
    id: 'revenant',
    name: 'Revenant',
    types: ['Spirit'],
    baseStats: { hp: 80, attack: 56, defense: 47, intelligence: 77, wisdom: 46, speed: 64, manaPool: 80, mpRegen: 10 },
    moveIds: ['soulRend', 'secondWind', 'mendWounds'],
    starter: true,
  },

  // --- Iron --------------------------------------------------------------
  ironWarden: {
    id: 'ironWarden',
    name: 'Warden',
    types: ['Iron'],
    baseStats: { hp: 135, attack: 55, defense: 90, intelligence: 20, wisdom: 50, speed: 30, manaPool: 40, mpRegen: 10 },
    moveIds: ['quickJab', 'stunningBlow', 'curseMind'],
    starter: false,
  },
  valor: {
    id: 'valor',
    name: 'Valor',
    types: ['Iron'],
    baseStats: { hp: 120, attack: 60, defense: 65, intelligence: 40, wisdom: 45, speed: 60, manaPool: 60, mpRegen: 10 },
    moveIds: ['ironFist', 'fortify', 'restoreVigor'],
    starter: true,
  },
  gallant: {
    id: 'gallant',
    name: 'Gallant',
    types: ['Iron'],
    baseStats: { hp: 110, attack: 80, defense: 55, intelligence: 20, wisdom: 35, speed: 70, manaPool: 45, mpRegen: 10 },
    moveIds: ['ironFist', 'quickJab', 'rally'],
    starter: false,
  },

  // --- Mech --------------------------------------------------------------
  forgewright: {
    id: 'forgewright',
    name: 'Clockwork',
    types: ['Mech'],
    baseStats: { hp: 130, attack: 60, defense: 70, intelligence: 45, wisdom: 40, speed: 55, manaPool: 50, mpRegen: 10 },
    moveIds: ['moltenHammer', 'sparkForge', 'fortify'],
    starter: true,
  },
  steamColossus: {
    id: 'steamColossus',
    name: 'Bellows',
    types: ['Mech', 'Iron'],
    baseStats: { hp: 145, attack: 90, defense: 80, intelligence: 15, wisdom: 35, speed: 15, manaPool: 40, mpRegen: 10 },
    moveIds: ['moltenHammer', 'shrapnelBlast', 'fortify'],
    starter: false,
  },

  // --- Beast -------------------------------------------------------------
  packAlpha: {
    id: 'packAlpha',
    name: 'Fang',
    types: ['Beast'],
    baseStats: { hp: 100, attack: 90, defense: 55, intelligence: 20, wisdom: 50, speed: 80, manaPool: 55, mpRegen: 10 },
    moveIds: ['fangRush', 'savageMaul', 'rally'],
    starter: true,
  },
};
