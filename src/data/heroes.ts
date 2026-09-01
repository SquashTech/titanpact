// Hero roster, grouped by primary type in typechart.ts TYPES order.
// Starting kit is exactly three moves: one low-power main-type move plus two supports
// (heal/buff/status) — MOVE_CAP is 4, so one slot is left to grow into on level-up.
// Starter stat lines are tuned to a 450 stat-total budget (HP + Mana + the five battle
// stats); recruit-only lines are untuned.

import type { HeroDefinition } from '../engine/content';

export const heroes: Record<string, HeroDefinition> = {
  // --- Fire ---
  cinderKnight: {
    id: 'cinderKnight',
    name: 'Cinder',
    types: ['Fire', 'Iron'],
    baseStats: { hp: 100, attack: 70, defense: 60, intelligence: 30, wisdom: 40, speed: 50, manaPool: 60, mpRegen: 10 },
    moveIds: ['singe', 'sharpen', 'kindle'],
    starter: false,
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    types: ['Fire'],
    baseStats: { hp: 100, attack: 30, defense: 38, intelligence: 80, wisdom: 75, speed: 62, manaPool: 65, mpRegen: 10 },
    moveIds: ['ember', 'weaken', 'stokeTheFlames'],
    starter: true,
  },
  brimstone: {
    id: 'brimstone',
    name: 'Brimstone',
    types: ['Fire', 'Shadow'],
    baseStats: { hp: 80, attack: 55, defense: 35, intelligence: 60, wisdom: 35, speed: 60, manaPool: 55, mpRegen: 10 },
    moveIds: ['ember', 'umbraBolt', 'weaken'],
    starter: false,
  },

  // --- Water ---
  tidecaller: {
    id: 'tidecaller',
    name: 'Riptide',
    types: ['Water'],
    baseStats: { hp: 110, attack: 55, defense: 55, intelligence: 59, wisdom: 40, speed: 66, manaPool: 65, mpRegen: 10 },
    moveIds: ['splash', 'tideGuard', 'refresh'],
    starter: true,
  },
  pincer: {
    id: 'pincer',
    name: 'Pincer',
    types: ['Water'],
    baseStats: { hp: 125, attack: 70, defense: 85, intelligence: 20, wisdom: 45, speed: 30, manaPool: 55, mpRegen: 10 },
    moveIds: ['undertow', 'tideGuard', 'openingStrike'],
    starter: false,
  },

  // --- Frost ---
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
    moveIds: ['iceShard', 'frostArmor', 'pinDown'],
    starter: false,
  },

  // --- Storm ---
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
    moveIds: ['thunderclap', 'swiftBlow', 'rally'],
    starter: false,
  },

  // --- Stone ---
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

  // --- Nature ---
  wildOracle: {
    id: 'wildOracle',
    name: 'Sylva',
    types: ['Nature'],
    baseStats: { hp: 80, attack: 45, defense: 60, intelligence: 60, wisdom: 60, speed: 65, manaPool: 80, mpRegen: 10 },
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
    moveIds: ['ivySpike', 'fortify', 'secondWind'],
    starter: false,
  },

  // --- Light ---
  dawnwarden: {
    id: 'dawnwarden',
    name: 'Solace',
    types: ['Light'],
    baseStats: { hp: 110, attack: 29, defense: 50, intelligence: 60, wisdom: 70, speed: 61, manaPool: 70, mpRegen: 10 },
    moveIds: ['glimmer', 'mend', 'purify'],
    starter: true,
  },
  aegis: {
    id: 'aegis',
    name: 'Aegis',
    types: ['Light'],
    baseStats: { hp: 120, attack: 45, defense: 80, intelligence: 40, wisdom: 75, speed: 35, manaPool: 70, mpRegen: 10 },
    moveIds: ['holyStrike', 'mend', 'secondWind'],
    starter: false,
  },

  // --- Shadow ---
  shadowMonk: {
    id: 'shadowMonk',
    name: 'Vesper',
    types: ['Shadow'],
    baseStats: { hp: 85, attack: 75, defense: 45, intelligence: 40, wisdom: 40, speed: 70, manaPool: 45, mpRegen: 10 },
    moveIds: ['fadeStrike', 'vanish', 'secondWind'],
    starter: false,
  },
  marrow: {
    id: 'marrow',
    name: 'Marrow',
    types: ['Shadow'],
    baseStats: { hp: 85, attack: 40, defense: 45, intelligence: 75, wisdom: 40, speed: 70, manaPool: 65, mpRegen: 10 },
    moveIds: ['umbraBolt', 'weaken', 'purify'],
    starter: false,
  },
  lucius: {
    id: 'lucius',
    name: 'Lucius',
    types: ['Shadow', 'Mind'],
    baseStats: { hp: 100, attack: 35, defense: 40, intelligence: 75, wisdom: 55, speed: 65, manaPool: 70, mpRegen: 10 },
    moveIds: ['umbraBolt', 'enervate', 'wickedFear'],
    starter: false,
  },
  nightshade: {
    id: 'nightshade',
    name: 'Nightshade',
    types: ['Shadow'],
    baseStats: { hp: 90, attack: 80, defense: 30, intelligence: 65, wisdom: 40, speed: 85, manaPool: 60, mpRegen: 10 },
    moveIds: ['backstab', 'vanish', 'weaken'],
    starter: true,
  },

  // --- Arcane ---
  runescribe: {
    id: 'runescribe',
    name: 'Glyph',
    types: ['Arcane'],
    baseStats: { hp: 80, attack: 25, defense: 32, intelligence: 90, wisdom: 80, speed: 58, manaPool: 85, mpRegen: 10 },
    moveIds: ['magicBolt', 'focus', 'infuse'],
    starter: true,
  },
  zenith: {
    id: 'zenith',
    name: 'Zenith',
    types: ['Arcane'],
    baseStats: { hp: 95, attack: 20, defense: 45, intelligence: 85, wisdom: 65, speed: 50, manaPool: 90, mpRegen: 10 },
    moveIds: ['manaTap', 'infuse', 'empower'],
    starter: false,
  },

  // --- Mind ---
  mindweaver: {
    id: 'mindweaver',
    name: 'Cortex',
    types: ['Mind'],
    baseStats: { hp: 100, attack: 53, defense: 45, intelligence: 55, wisdom: 55, speed: 67, manaPool: 75, mpRegen: 10 },
    moveIds: ['psiBolt', 'brainWard', 'dopamine'],
    starter: true,
  },
  trance: {
    id: 'trance',
    name: 'Trance',
    types: ['Mind'],
    baseStats: { hp: 95, attack: 25, defense: 50, intelligence: 60, wisdom: 55, speed: 55, manaPool: 80, mpRegen: 10 },
    moveIds: ['psiBolt', 'enervate', 'lull'],
    starter: false,
  },

  // --- Spirit ---
  revenant: {
    id: 'revenant',
    name: 'Revenant',
    types: ['Spirit'],
    baseStats: { hp: 80, attack: 56, defense: 47, intelligence: 77, wisdom: 46, speed: 64, manaPool: 80, mpRegen: 10 },
    moveIds: ['wisp', 'secondWind', 'unbound'],
    starter: true,
  },
  sorrow: {
    id: 'sorrow',
    name: 'Sorrow',
    types: ['Spirit'],
    baseStats: { hp: 75, attack: 80, defense: 38, intelligence: 45, wisdom: 50, speed: 90, manaPool: 62, mpRegen: 10 },
    moveIds: ['phantomStrike', 'torment', 'secondWind'],
    starter: false,
  },

  // --- Iron ---
  ironWarden: {
    id: 'ironWarden',
    name: 'Warden',
    types: ['Iron'],
    baseStats: { hp: 135, attack: 55, defense: 90, intelligence: 20, wisdom: 50, speed: 30, manaPool: 40, mpRegen: 10 },
    moveIds: ['swiftBlow', 'openingStrike', 'fortify'],
    starter: false,
  },
  valor: {
    id: 'valor',
    name: 'Valor',
    types: ['Iron'],
    baseStats: { hp: 120, attack: 60, defense: 65, intelligence: 40, wisdom: 45, speed: 60, manaPool: 60, mpRegen: 10 },
    moveIds: ['ironFist', 'sharpen', 'rally'],
    starter: true,
  },
  gallant: {
    id: 'gallant',
    name: 'Gallant',
    types: ['Iron'],
    baseStats: { hp: 110, attack: 80, defense: 55, intelligence: 20, wisdom: 35, speed: 70, manaPool: 45, mpRegen: 10 },
    moveIds: ['heavyBlow', 'openingStrike', 'rally'],
    starter: false,
  },

  // --- Mech ---
  forgewright: {
    id: 'forgewright',
    name: 'Clockwork',
    types: ['Mech'],
    baseStats: { hp: 130, attack: 60, defense: 70, intelligence: 45, wisdom: 40, speed: 55, manaPool: 50, mpRegen: 10 },
    moveIds: ['pistonPunch', 'overclock', 'kickstart'],
    starter: true,
  },
  steamColossus: {
    id: 'steamColossus',
    name: 'Bellows',
    types: ['Mech', 'Iron'],
    baseStats: { hp: 145, attack: 90, defense: 80, intelligence: 15, wisdom: 35, speed: 15, manaPool: 40, mpRegen: 10 },
    moveIds: ['cogBop', 'ironFist', 'sharpen'],
    starter: false,
  },

  // --- Beast ---
  packAlpha: {
    id: 'packAlpha',
    name: 'Fang',
    types: ['Beast'],
    baseStats: { hp: 100, attack: 90, defense: 55, intelligence: 20, wisdom: 50, speed: 80, manaPool: 55, mpRegen: 10 },
    moveIds: ['claw', 'venomBite', 'rally'],
    starter: true,
  },
  widow: {
    id: 'widow',
    name: 'Widow',
    types: ['Beast', 'Shadow'],
    baseStats: { hp: 75, attack: 85, defense: 35, intelligence: 25, wisdom: 40, speed: 90, manaPool: 50, mpRegen: 10 },
    moveIds: ['venomBite', 'vanish', 'prowl'],
    starter: false,
  },
  coil: {
    id: 'coil',
    name: 'Coil',
    types: ['Beast', 'Mind'],
    baseStats: { hp: 85, attack: 30, defense: 45, intelligence: 75, wisdom: 60, speed: 60, manaPool: 65, mpRegen: 10 },
    moveIds: ['psiBolt', 'lull', 'rally'],
    starter: false,
  },
};
