// ⚠️ TEST FIXTURE CONTENT — heroes sufficient to run a 2v2 fight and exercise
// bring-6-pick-4 squad selection (src/run) through the engine. Not the
// authored 53-concept roster (docs/types-and-heroes.md); stat lines and
// typings here are arbitrary and untuned.
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
    baseStats: { hp: 100, attack: 70, defense: 60, intelligence: 30, wisdom: 40, speed: 50, manaPool: 60, mpRegen: 5 },
    moveIds: ['cinderBite', 'fortify', 'restoreVigor'],
    starter: false,
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    types: ['Fire'],
    baseStats: { hp: 90, attack: 25, defense: 35, intelligence: 80, wisdom: 45, speed: 60, manaPool: 85, mpRegen: 9 },
    moveIds: ['flareBurst', 'weaken', 'restoreVigor'],
    starter: true,
  },
  brimstone: {
    id: 'brimstone',
    name: 'Brimstone',
    types: ['Fire', 'Shadow'],
    baseStats: { hp: 80, attack: 55, defense: 35, intelligence: 60, wisdom: 35, speed: 60, manaPool: 55, mpRegen: 10 },
    moveIds: ['cinderBite', 'shadowVeil', 'weaken'],
    starter: false,
  },

  // --- Water -------------------------------------------------------------
  tidecaller: {
    id: 'tidecaller',
    name: 'Riptide',
    types: ['Water'],
    baseStats: { hp: 105, attack: 40, defense: 50, intelligence: 75, wisdom: 65, speed: 55, manaPool: 80, mpRegen: 8 },
    moveIds: ['tidalBolt', 'healingRain', 'weaken'],
    starter: true,
  },
  pincer: {
    id: 'pincer',
    name: 'Pincer',
    types: ['Water'],
    baseStats: { hp: 125, attack: 70, defense: 85, intelligence: 20, wisdom: 45, speed: 30, manaPool: 40, mpRegen: 10 },
    moveIds: ['aquaJet', 'stunningBlow', 'fortify'],
    starter: false,
  },

  // --- Frost -------------------------------------------------------------
  glacialWarden: {
    id: 'glacialWarden',
    name: 'Flurry',
    types: ['Frost'],
    baseStats: { hp: 140, attack: 30, defense: 55, intelligence: 70, wisdom: 60, speed: 45, manaPool: 70, mpRegen: 7 },
    moveIds: ['glacialSpike', 'frostLock', 'secondWind'],
    starter: false,
  },
  rime: {
    id: 'rime',
    name: 'Rime',
    types: ['Frost'],
    baseStats: { hp: 95, attack: 60, defense: 40, intelligence: 45, wisdom: 60, speed: 85, manaPool: 55, mpRegen: 6 },
    moveIds: ['frostBite', 'rendingClaw', 'secondWind'],
    starter: true,
  },
  cube: {
    id: 'cube',
    name: 'Cube',
    types: ['Frost'],
    baseStats: { hp: 90, attack: 50, defense: 80, intelligence: 40, wisdom: 50, speed: 25, manaPool: 45, mpRegen: 5 },
    moveIds: ['frostBite', 'fortify', 'stunningBlow'],
    starter: false,
  },

  // --- Storm -------------------------------------------------------------
  stormRanger: {
    id: 'stormRanger',
    name: 'Squall',
    types: ['Storm'],
    baseStats: { hp: 90, attack: 65, defense: 40, intelligence: 35, wisdom: 35, speed: 90, manaPool: 50, mpRegen: 6 },
    moveIds: ['galeShot', 'rally', 'thunderclap'],
    starter: false,
  },
  tempest: {
    id: 'tempest',
    name: 'Tempest',
    types: ['Storm'],
    baseStats: { hp: 90, attack: 65, defense: 40, intelligence: 35, wisdom: 35, speed: 90, manaPool: 50, mpRegen: 6 },
    moveIds: ['galeShot', 'rally', 'thunderclap'],
    starter: true,
  },
  scallywag: {
    id: 'scallywag',
    name: 'Scallywag',
    types: ['Storm'],
    baseStats: { hp: 95, attack: 75, defense: 40, intelligence: 30, wisdom: 35, speed: 80, manaPool: 50, mpRegen: 10 },
    moveIds: ['galeShot', 'quickJab', 'rally'],
    starter: false,
  },

  // --- Stone -------------------------------------------------------------
  crag: {
    id: 'crag',
    name: 'Crag',
    types: ['Stone'],
    baseStats: { hp: 140, attack: 60, defense: 95, intelligence: 15, wisdom: 55, speed: 20, manaPool: 35, mpRegen: 4 },
    moveIds: ['boulderToss', 'fortify', 'secondWind'],
    starter: true,
  },
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    types: ['Stone'],
    baseStats: { hp: 150, attack: 45, defense: 100, intelligence: 15, wisdom: 50, speed: 15, manaPool: 30, mpRegen: 10 },
    moveIds: ['boulderToss', 'fortify', 'stunningBlow'],
    starter: false,
  },

  // --- Nature ------------------------------------------------------------
  wildOracle: {
    id: 'wildOracle',
    name: 'Sylva',
    types: ['Nature'],
    baseStats: { hp: 100, attack: 35, defense: 45, intelligence: 80, wisdom: 70, speed: 65, manaPool: 90, mpRegen: 10 },
    moveIds: ['venomousBite', 'mendWounds', 'secondWind'],
    starter: true,
  },
  mordax: {
    id: 'mordax',
    name: 'Mordrax',
    types: ['Nature'],
    baseStats: { hp: 105, attack: 70, defense: 55, intelligence: 35, wisdom: 45, speed: 50, manaPool: 50, mpRegen: 5 },
    moveIds: ['vineLash', 'rendingClaw', 'rally'],
    starter: false,
  },
  hollowbark: {
    id: 'hollowbark',
    name: 'Hollowbark',
    types: ['Nature'],
    baseStats: { hp: 135, attack: 70, defense: 80, intelligence: 20, wisdom: 45, speed: 30, manaPool: 40, mpRegen: 10 },
    moveIds: ['vineLash', 'fortify', 'secondWind'],
    starter: false,
  },

  // --- Light -------------------------------------------------------------
  dawnwarden: {
    id: 'dawnwarden',
    name: 'Solace',
    types: ['Light'],
    baseStats: { hp: 100, attack: 40, defense: 65, intelligence: 55, wisdom: 85, speed: 40, manaPool: 85, mpRegen: 9 },
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
    baseStats: { hp: 85, attack: 75, defense: 45, intelligence: 40, wisdom: 40, speed: 70, manaPool: 45, mpRegen: 5 },
    moveIds: ['vanish', 'secondWind', 'purify'],
    starter: false,
  },
  marrow: {
    id: 'marrow',
    name: 'Marrow',
    types: ['Shadow'],
    baseStats: { hp: 85, attack: 75, defense: 45, intelligence: 40, wisdom: 40, speed: 70, manaPool: 45, mpRegen: 5 },
    moveIds: ['vanish', 'secondWind', 'purify'],
    starter: false,
  },
  lucius: {
    id: 'lucius',
    name: 'Lucius',
    types: ['Shadow', 'Mind'],
    baseStats: { hp: 100, attack: 35, defense: 40, intelligence: 75, wisdom: 55, speed: 65, manaPool: 70, mpRegen: 7 },
    moveIds: ['shadowVeil', 'curseMind', 'spectralBind'],
    starter: false,
  },
  nightshade: {
    id: 'nightshade',
    name: 'Nightshade',
    types: ['Shadow'],
    baseStats: { hp: 85, attack: 80, defense: 35, intelligence: 30, wisdom: 35, speed: 85, manaPool: 45, mpRegen: 10 },
    moveIds: ['duskStrike', 'vanish', 'nightmareGrasp'],
    starter: true,
  },

  // --- Arcane ------------------------------------------------------------
  runescribe: {
    id: 'runescribe',
    name: 'Glyph',
    types: ['Arcane'],
    baseStats: { hp: 80, attack: 25, defense: 35, intelligence: 85, wisdom: 45, speed: 60, manaPool: 95, mpRegen: 10 },
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
    baseStats: { hp: 90, attack: 30, defense: 40, intelligence: 75, wisdom: 65, speed: 55, manaPool: 65, mpRegen: 7 },
    moveIds: ['psychicLance', 'mindSpike', 'curseMind'],
    starter: true,
  },

  // --- Spirit ------------------------------------------------------------
  revenant: {
    id: 'revenant',
    name: 'Revenant',
    types: ['Spirit'],
    baseStats: { hp: 90, attack: 25, defense: 40, intelligence: 70, wisdom: 75, speed: 60, manaPool: 75, mpRegen: 8 },
    moveIds: ['soulRend', 'secondWind', 'mendWounds'],
    starter: true,
  },

  // --- Iron --------------------------------------------------------------
  ironWarden: {
    id: 'ironWarden',
    name: 'Warden',
    types: ['Iron'],
    baseStats: { hp: 135, attack: 55, defense: 90, intelligence: 20, wisdom: 50, speed: 30, manaPool: 40, mpRegen: 4 },
    moveIds: ['quickJab', 'stunningBlow', 'curseMind'],
    starter: false,
  },
  valor: {
    id: 'valor',
    name: 'Valor',
    types: ['Iron'],
    baseStats: { hp: 120, attack: 75, defense: 65, intelligence: 25, wisdom: 45, speed: 55, manaPool: 50, mpRegen: 6 },
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
    baseStats: { hp: 120, attack: 75, defense: 70, intelligence: 25, wisdom: 40, speed: 35, manaPool: 45, mpRegen: 5 },
    moveIds: ['moltenHammer', 'sparkForge', 'fortify'],
    starter: true,
  },
  steamColossus: {
    id: 'steamColossus',
    name: 'Steam Colossus',
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
    baseStats: { hp: 110, attack: 80, defense: 45, intelligence: 20, wisdom: 30, speed: 75, manaPool: 40, mpRegen: 4 },
    moveIds: ['fangRush', 'savageMaul', 'rally'],
    starter: true,
  },
};
