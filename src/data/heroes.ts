// Hero roster, grouped by primary type in typechart.ts TYPES order.
// Starting kit is exactly three moves: one low-power main-type move plus two supports
// (heal/buff/status) — MOVE_CAP is 4, so one slot is left to grow into on level-up.
// Every line sums to exactly 550 at face value across seven stats (HP + Mana + the five battle
// stats; MP Regen is a flat 10 outside it) — the same number the Stat Total row prints, HP
// included at 1:1 (2026-09-09). A specialist is signalled by spiking one stat past anything else
// in the roster, never by coming in under the total — Bellows' 105 Attack against its 5 Speed is
// the shape. The re-base took its points out of HP and left Speed alone, so the turn order the
// roster was tuned around is the one it still has.
//
// No hero authors its own item-slot count: every one starts at BASE_ITEM_SLOTS and reaches 2 and
// 3 through the Forge alone (2026-09-08). See itemSlotsFor for why the per-hero dial was removed.
//
// GROWTH GRADES (2026-09-10) are the second budget: every line sums to GRADE_BUDGET = 28 the way
// the stat line sums to 550. A grade's chance is exactly linear in its cost, so an on-budget line
// buys every hero the SAME 4.55 successes a level — a grade line decides WHERE a hero grows and
// never how much. Both archetypes are therefore about placement, not size:
//
//   LATE BLOOMER — the budget piles onto the hero's own offensive stat and its speed, where growth
//   compounds through the damage ratio. Riptide's hedged 55/59 resolves upward into a fast caster;
//   Pincer's 80 Attack ends behind its 90 Defense at 135. Behind early and ahead late, which is
//   what makes a Guild Hall hire arriving underlevelled a build rather than a discount.
//
//   FRONT-LOADED — the spike the hero was drafted for is the spike it keeps (B or C), and the
//   budget goes to bulk, Wisdom or mana instead. Bellows, Marrow and Runescribe are strong the
//   hour you get them and change character rather than scale.
//
// Two rules hold across both. A hero's DUMP stat stays dumped (E/F) — it is what the 550 charged
// for, and growth must not quietly refund it. And a stat a hero genuinely swings or defends with
// never goes below C: a dead defensive stat makes a trap pick, which the north star forbids.
// Authoring rationale and the measurement: docs/types-and-heroes.md "Growth grades".

import type { HeroDefinition } from '../engine/content';

export const heroes: Record<string, HeroDefinition> = {
  // --- Fire ---
  cinderKnight: {
    id: 'cinderKnight',
    name: 'Cinder',
    types: ['Fire', 'Iron'],
    baseStats: { hp: 220, attack: 85, defense: 75, intelligence: 25, wisdom: 40, speed: 55, manaPool: 50, mpRegen: 10 },
    moveIds: ['singe', 'sharpen', 'kindle'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'A', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'B' },
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    types: ['Fire'],
    baseStats: { hp: 200, attack: 30, defense: 38, intelligence: 80, wisdom: 75, speed: 62, manaPool: 65, mpRegen: 10 },
    moveIds: ['ember', 'weaken', 'stokeTheFlames'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'A' },
  },
  brimstone: {
    id: 'brimstone',
    name: 'Brimstone',
    types: ['Fire', 'Shadow'],
    baseStats: { hp: 190, attack: 45, defense: 50, intelligence: 85, wisdom: 55, speed: 60, manaPool: 65, mpRegen: 10 },
    moveIds: ['ember', 'umbraBolt', 'weaken'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'E', defense: 'A', intelligence: 'D', wisdom: 'A', speed: 'B', manaPool: 'A' },
  },

  // --- Water ---
  tidecaller: {
    id: 'tidecaller',
    name: 'Riptide',
    types: ['Water'],
    baseStats: { hp: 210, attack: 55, defense: 55, intelligence: 59, wisdom: 40, speed: 66, manaPool: 65, mpRegen: 10 },
    moveIds: ['splash', 'tideGuard', 'refresh'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'C', speed: 'S', manaPool: 'A' },
  },
  pincer: {
    id: 'pincer',
    name: 'Pincer',
    types: ['Water'],
    baseStats: { hp: 230, attack: 80, defense: 90, intelligence: 20, wisdom: 45, speed: 35, manaPool: 50, mpRegen: 10 },
    moveIds: ['undertow', 'tideGuard', 'openingStrike'],
    starter: false,
    growthGrades: { hp: 'A', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'B' },
  },

  // --- Frost ---
  glacialWarden: {
    id: 'glacialWarden',
    name: 'Flurry',
    types: ['Frost'],
    baseStats: { hp: 230, attack: 25, defense: 60, intelligence: 80, wisdom: 50, speed: 40, manaPool: 65, mpRegen: 10 },
    moveIds: ['rimeWind', 'frostArmor', 'deepChill'],
    starter: false,
    growthGrades: { hp: 'A', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'B' },
  },
  rime: {
    id: 'rime',
    name: 'Rime',
    types: ['Frost'],
    // 90/40 rather than the 65/65 it shipped with: Frost authors a split slate and Flurry already
    // owns the magical half, so a hedged Rime had no spike and half its level-ups paid in a stat it
    // was not swinging with. Same 550.
    baseStats: { hp: 210, attack: 90, defense: 55, intelligence: 40, wisdom: 53, speed: 42, manaPool: 60, mpRegen: 10 },
    moveIds: ['iceShard', 'deepChill', 'secondWind'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'B', defense: 'A', intelligence: 'D', wisdom: 'B', speed: 'A', manaPool: 'B' },
  },
  cube: {
    id: 'cube',
    name: 'Cube',
    types: ['Frost'],
    baseStats: { hp: 250, attack: 60, defense: 115, intelligence: 25, wisdom: 40, speed: 10, manaPool: 50, mpRegen: 10 },
    moveIds: ['iceShard', 'frostArmor', 'pinDown'],
    starter: false,
    growthGrades: { hp: 'A', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'S', speed: 'C', manaPool: 'C' },
  },

  // --- Storm ---
  stormRanger: {
    id: 'stormRanger',
    name: 'Squall',
    types: ['Storm'],
    baseStats: { hp: 190, attack: 85, defense: 45, intelligence: 30, wisdom: 45, speed: 105, manaPool: 50, mpRegen: 10 },
    moveIds: ['thunderclap', 'risingStatic', 'rally'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'A', defense: 'A', intelligence: 'D', wisdom: 'B', speed: 'B', manaPool: 'B' },
  },
  tempest: {
    id: 'tempest',
    name: 'Tempest',
    types: ['Storm'],
    baseStats: { hp: 190, attack: 70, defense: 45, intelligence: 70, wisdom: 35, speed: 65, manaPool: 75, mpRegen: 10 },
    moveIds: ['jolt', 'charge', 'rally'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'S', defense: 'C', intelligence: 'S', wisdom: 'C', speed: 'C', manaPool: 'C' },
  },
  scallywag: {
    id: 'scallywag',
    name: 'Scallywag',
    types: ['Storm'],
    baseStats: { hp: 210, attack: 95, defense: 50, intelligence: 25, wisdom: 40, speed: 80, manaPool: 50, mpRegen: 10 },
    moveIds: ['thunderclap', 'swiftBlow', 'rally'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'A', speed: 'A', manaPool: 'B' },
  },

  // --- Stone ---
  crag: {
    id: 'crag',
    name: 'Crag',
    types: ['Stone'],
    baseStats: { hp: 240, attack: 90, defense: 75, intelligence: 20, wisdom: 35, speed: 40, manaPool: 50, mpRegen: 10 },
    moveIds: ['rockToss', 'toughenUp', 'secondWind'],
    starter: true,
    growthGrades: { hp: 'A', attack: 'S', defense: 'A', intelligence: 'E', wisdom: 'A', speed: 'B', manaPool: 'D' },
  },
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    types: ['Stone'],
    baseStats: { hp: 250, attack: 50, defense: 110, intelligence: 20, wisdom: 50, speed: 20, manaPool: 50, mpRegen: 10 },
    moveIds: ['mudBall', 'provoke', 'fortify'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'B', defense: 'A', intelligence: 'F', wisdom: 'S', speed: 'C', manaPool: 'B' },
  },

  // --- Nature ---
  wildOracle: {
    id: 'wildOracle',
    name: 'Sylva',
    types: ['Nature'],
    baseStats: { hp: 180, attack: 45, defense: 60, intelligence: 60, wisdom: 60, speed: 65, manaPool: 80, mpRegen: 10 },
    moveIds: ['seedShot', 'regrowth', 'toxicSpores'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'D', defense: 'C', intelligence: 'A', wisdom: 'A', speed: 'B', manaPool: 'A' },
  },
  mordax: {
    id: 'mordax',
    name: 'Mordrax',
    types: ['Nature'],
    baseStats: { hp: 220, attack: 90, defense: 65, intelligence: 25, wisdom: 45, speed: 55, manaPool: 50, mpRegen: 10 },
    moveIds: ['vineLash', 'regrowth', 'rally'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'C' },
  },
  hollowbark: {
    id: 'hollowbark',
    name: 'Hollowbark',
    types: ['Nature'],
    baseStats: { hp: 240, attack: 80, defense: 90, intelligence: 20, wisdom: 40, speed: 30, manaPool: 50, mpRegen: 10 },
    moveIds: ['ivySpike', 'fortify', 'secondWind'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'A', defense: 'A', intelligence: 'E', wisdom: 'A', speed: 'B', manaPool: 'D' },
  },

  // --- Light ---
  dawnwarden: {
    id: 'dawnwarden',
    name: 'Solace',
    types: ['Light'],
    baseStats: { hp: 210, attack: 29, defense: 50, intelligence: 60, wisdom: 70, speed: 61, manaPool: 70, mpRegen: 10 },
    moveIds: ['glimmer', 'mend', 'purify'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'B', wisdom: 'S', speed: 'B', manaPool: 'S' },
  },
  aegis: {
    id: 'aegis',
    name: 'Aegis',
    types: ['Light'],
    baseStats: { hp: 230, attack: 45, defense: 85, intelligence: 35, wisdom: 80, speed: 25, manaPool: 50, mpRegen: 10 },
    moveIds: ['holyStrike', 'mend', 'secondWind'],
    starter: false,
    growthGrades: { hp: 'A', attack: 'D', defense: 'A', intelligence: 'B', wisdom: 'A', speed: 'C', manaPool: 'B' },
  },

  // --- Shadow ---
  shadowMonk: {
    id: 'shadowMonk',
    name: 'Vesper',
    types: ['Shadow'],
    baseStats: { hp: 200, attack: 95, defense: 55, intelligence: 30, wisdom: 45, speed: 75, manaPool: 50, mpRegen: 10 },
    moveIds: ['fadeStrike', 'lieInWait', 'secondWind'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'A', speed: 'A', manaPool: 'B' },
  },
  marrow: {
    id: 'marrow',
    name: 'Marrow',
    types: ['Shadow'],
    baseStats: { hp: 190, attack: 30, defense: 50, intelligence: 95, wisdom: 55, speed: 65, manaPool: 65, mpRegen: 10 },
    moveIds: ['umbraBolt', 'weaken', 'purify'],
    starter: false,
    growthGrades: { hp: 'D', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'A', speed: 'S', manaPool: 'S' },
  },
  nightshade: {
    id: 'nightshade',
    name: 'Nightshade',
    types: ['Shadow'],
    baseStats: { hp: 190, attack: 80, defense: 30, intelligence: 65, wisdom: 40, speed: 85, manaPool: 60, mpRegen: 10 },
    moveIds: ['backstab', 'lieInWait', 'weaken'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'S', defense: 'B', intelligence: 'C', wisdom: 'C', speed: 'A', manaPool: 'C' },
  },

  // --- Arcane ---
  runescribe: {
    id: 'runescribe',
    name: 'Glyph',
    types: ['Arcane'],
    baseStats: { hp: 180, attack: 25, defense: 32, intelligence: 90, wisdom: 80, speed: 58, manaPool: 85, mpRegen: 10 },
    moveIds: ['magicBolt', 'focus', 'barrier'],
    starter: true,
    growthGrades: { hp: 'S', attack: 'E', defense: 'A', intelligence: 'B', wisdom: 'A', speed: 'D', manaPool: 'A' },
  },
  zenith: {
    id: 'zenith',
    name: 'Zenith',
    types: ['Arcane'],
    baseStats: { hp: 190, attack: 20, defense: 45, intelligence: 85, wisdom: 65, speed: 50, manaPool: 95, mpRegen: 10 },
    moveIds: ['manaTap', 'barrier', 'empower'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'S' },
  },

  // --- Mind ---
  mindweaver: {
    id: 'mindweaver',
    name: 'Cortex',
    types: ['Mind'],
    baseStats: { hp: 200, attack: 53, defense: 45, intelligence: 55, wisdom: 55, speed: 67, manaPool: 75, mpRegen: 10 },
    moveIds: ['psiBolt', 'barrier', 'dopamine'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'A', defense: 'D', intelligence: 'A', wisdom: 'C', speed: 'A', manaPool: 'B' },
  },
  lucius: {
    id: 'lucius',
    name: 'Lucius',
    types: ['Mind'],
    baseStats: { hp: 200, attack: 30, defense: 50, intelligence: 90, wisdom: 55, speed: 60, manaPool: 65, mpRegen: 10 },
    moveIds: ['psiBolt', 'wickedFear', 'mentalFortress'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'A' },
  },
  trance: {
    id: 'trance',
    name: 'Trance',
    types: ['Mind'],
    baseStats: { hp: 200, attack: 25, defense: 55, intelligence: 85, wisdom: 60, speed: 55, manaPool: 70, mpRegen: 10 },
    moveIds: ['psiBolt', 'enervate', 'lull'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'E', defense: 'B', intelligence: 'A', wisdom: 'S', speed: 'C', manaPool: 'A' },
  },

  // --- Spirit ---
  revenant: {
    id: 'revenant',
    name: 'Revenant',
    types: ['Spirit'],
    baseStats: { hp: 180, attack: 56, defense: 47, intelligence: 77, wisdom: 46, speed: 64, manaPool: 80, mpRegen: 10 },
    moveIds: ['wisp', 'secondWind', 'unbound'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'F', defense: 'A', intelligence: 'S', wisdom: 'B', speed: 'B', manaPool: 'A' },
  },
  sorrow: {
    id: 'sorrow',
    name: 'Sorrow',
    types: ['Spirit'],
    baseStats: { hp: 180, attack: 95, defense: 45, intelligence: 30, wisdom: 45, speed: 100, manaPool: 55, mpRegen: 10 },
    moveIds: ['phantomStrike', 'torment', 'secondWind'],
    starter: false,
    growthGrades: { hp: 'C', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'A', speed: 'S', manaPool: 'B' },
  },

  // --- Iron ---
  ironWarden: {
    id: 'ironWarden',
    name: 'Warden',
    types: ['Iron'],
    baseStats: { hp: 240, attack: 60, defense: 100, intelligence: 20, wisdom: 50, speed: 30, manaPool: 50, mpRegen: 10 },
    moveIds: ['swiftBlow', 'openingStrike', 'fortify'],
    starter: false,
    growthGrades: { hp: 'A', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'A', speed: 'B', manaPool: 'B' },
  },
  valor: {
    id: 'valor',
    name: 'Valor',
    types: ['Iron'],
    baseStats: { hp: 220, attack: 60, defense: 65, intelligence: 40, wisdom: 45, speed: 60, manaPool: 60, mpRegen: 10 },
    moveIds: ['ironFist', 'sharpen', 'rally'],
    starter: true,
    growthGrades: { hp: 'A', attack: 'A', defense: 'B', intelligence: 'C', wisdom: 'B', speed: 'B', manaPool: 'C' },
  },
  gallant: {
    id: 'gallant',
    name: 'Gallant',
    types: ['Iron'],
    baseStats: { hp: 210, attack: 95, defense: 60, intelligence: 20, wisdom: 40, speed: 75, manaPool: 50, mpRegen: 10 },
    moveIds: ['heavyBlow', 'openingStrike', 'rally'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'B', defense: 'A', intelligence: 'D', wisdom: 'A', speed: 'A', manaPool: 'C' },
  },

  // --- Mech ---
  forgewright: {
    id: 'forgewright',
    name: 'Clockwork',
    types: ['Mech'],
    baseStats: { hp: 230, attack: 60, defense: 70, intelligence: 45, wisdom: 40, speed: 55, manaPool: 50, mpRegen: 10 },
    moveIds: ['pistonPunch', 'overclock', 'kickstart'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'S', defense: 'A', intelligence: 'A', wisdom: 'C', speed: 'B', manaPool: 'E' },
  },
  steamColossus: {
    id: 'steamColossus',
    name: 'Bellows',
    types: ['Mech', 'Iron'],
    baseStats: { hp: 250, attack: 105, defense: 90, intelligence: 15, wisdom: 35, speed: 5, manaPool: 50, mpRegen: 10 },
    moveIds: ['cogBop', 'ironFist', 'sharpen'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'A', defense: 'S', intelligence: 'F', wisdom: 'S', speed: 'C', manaPool: 'D' },
  },

  // --- Beast ---
  packAlpha: {
    id: 'packAlpha',
    name: 'Fang',
    types: ['Beast'],
    baseStats: { hp: 200, attack: 90, defense: 55, intelligence: 20, wisdom: 50, speed: 80, manaPool: 55, mpRegen: 10 },
    moveIds: ['claw', 'venomBite', 'rally'],
    starter: true,
    growthGrades: { hp: 'A', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'B', speed: 'A', manaPool: 'B' },
  },
  widow: {
    id: 'widow',
    name: 'Widow',
    types: ['Beast', 'Shadow'],
    baseStats: { hp: 190, attack: 100, defense: 45, intelligence: 20, wisdom: 45, speed: 100, manaPool: 50, mpRegen: 10 },
    moveIds: ['venomBite', 'lieInWait', 'prowl'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'B', defense: 'A', intelligence: 'D', wisdom: 'A', speed: 'B', manaPool: 'D' },
  },
  coil: {
    id: 'coil',
    name: 'Coil',
    types: ['Beast', 'Mind'],
    baseStats: { hp: 190, attack: 25, defense: 55, intelligence: 90, wisdom: 65, speed: 60, manaPool: 65, mpRegen: 10 },
    moveIds: ['psiBolt', 'lull', 'rally'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'E', defense: 'A', intelligence: 'A', wisdom: 'A', speed: 'D', manaPool: 'B' },
  },
};
