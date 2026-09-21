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
//
// SCHEDULES (2026-09-13, docs/xp-overhaul.md §4) are the third axis, and deliberately NOT aligned
// with the grade archetype. Offers are TWO FROM EVERY BAND — six a hero, seven for Glyph — fewer
// than the ladder's open-ended nine (phase 3 measured nine as 41 decisions a run, §8), and each
// band offers its own tier, so the two Late offers ARE two Late moves. Late opens 17-22 so that
// both land inside Act 5 on every hero: the expensive half of the catalog has to be reachable in
// a run that ends (phase 6). The Evolution is NOT on the schedule since 2026-09-14 (docs/mastery.md):
// every hero turns at five Mastery pips, so the per-hero timing that was `evolutionLevel` lives on
// the signature move instead. Rules pinned in test/moveTiers.test.ts: sorted, Mid before Late, an
// offer from every band.
//
// Offer levels are STAGGERED ACROSS THE ROSTER (2026-09-16, per user direction). Levels are
// roster-wide, so every hero whose offer sits in the same fight's par window fires on the same
// report — and the first pass put 33 of 36 heroes on the opener and 30 on Act 2's Guardian, which
// played as six move screens in a row. Each level here is the par reached by a fight
// (LEVEL_AFTER_ENCOUNTER: 5 6 8 / 10 11 14 / 15 17 19 / 20 21 24 / 25 26 28), chosen so the
// 36 heroes' offers fall 13-20 to a fight rather than 4-33: a random six now averages ~2 offers a
// report and five-or-more went from 15% of reports to 3%. A hero's first offer is inside Act 1,
// its last is no later than the Act 5 Guardian (so both Late moves serve the finale), and its
// offers are 1-4 fights apart. Pinned in test/moveTiers.test.ts ("staggered").

import type { HeroDefinition } from '../engine/content';

export const heroes: Record<string, HeroDefinition> = {
  // --- Fire ---
  cinderKnight: {
    id: 'cinderKnight',
    name: 'Cinder',
    types: ['Fire'],
    baseStats: { hp: 220, attack: 85, defense: 75, intelligence: 25, wisdom: 40, speed: 55, manaPool: 50, mpRegen: 10 },
    moveIds: ['singe', 'setAlight', 'kindle'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'A', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'B' },
    schedule: { offerLevels: [6, 10, 17, 20, 24, 26], midLevel: 11, lateLevel: 21 },
    signatureMoveId: 'hammerbrand',
    passiveIds: ['kindling'],
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    types: ['Fire'],
    baseStats: { hp: 200, attack: 30, defense: 38, intelligence: 80, wisdom: 75, speed: 62, manaPool: 65, mpRegen: 10 },
    moveIds: ['ember', 'weaken', 'infuse'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [6, 10, 17, 20, 25, 28], midLevel: 11, lateLevel: 21 },
    signatureMoveId: 'flashover',
    passiveIds: ['stoke'],
  },
  brimstone: {
    id: 'brimstone',
    name: 'Brimstone',
    types: ['Fire', 'Shadow'],
    baseStats: { hp: 190, attack: 45, defense: 50, intelligence: 85, wisdom: 55, speed: 60, manaPool: 65, mpRegen: 10 },
    moveIds: ['ember', 'umbraBolt', 'weaken'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'E', defense: 'A', intelligence: 'D', wisdom: 'A', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 11, 15, 20, 25], midLevel: 10, lateLevel: 20 },
    signatureMoveId: 'hearthfire',
    passiveIds: ['sulphur'],
  },

  // --- Water ---
  tidecaller: {
    id: 'tidecaller',
    name: 'Riptide',
    types: ['Water'],
    baseStats: { hp: 210, attack: 55, defense: 55, intelligence: 59, wisdom: 40, speed: 66, manaPool: 65, mpRegen: 10 },
    moveIds: ['splash', 'tideGuard', 'refresh'],
    starter: true,
    // Mana takes the point the line was over by (29 -> GRADE_BUDGET's 28). Of the three A's it is
    // the one the reshape cares least about: this is no longer the S-Intelligence caster whose
    // ceiling was its pool, and 65 base is already comfortable. Attack stays C and Intelligence
    // stays B — those are the two the reshape exists to lift off the floor.
    growthGrades: { hp: 'A', attack: 'C', defense: 'B', intelligence: 'B', wisdom: 'C', speed: 'A', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 11, 17, 20, 26], midLevel: 10, lateLevel: 19 },
    signatureMoveId: 'lizardRush',
    passiveIds: ['drag'],
  },
  pincer: {
    id: 'pincer',
    name: 'Pincer',
    types: ['Water'],
    baseStats: { hp: 230, attack: 80, defense: 90, intelligence: 20, wisdom: 45, speed: 35, manaPool: 50, mpRegen: 10 },
    moveIds: ['undertow', 'tideGuard', 'openingStrike'],
    starter: false,
    growthGrades: { hp: 'A', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 11, 17, 24, 26], midLevel: 10, lateLevel: 19 },
    signatureMoveId: 'vise',
    passiveIds: ['carapace'],
  },
  leviathan: {
    id: 'leviathan',
    name: 'Leviathan',
    types: ['Water'],
    // The roster's top Intelligence: Water's slate is magical sixteen deep and nobody was swinging
    // it at full weight — Riptide hedged, Pincer is the physical wall. Everything else is thin.
    baseStats: { hp: 190, attack: 30, defense: 40, intelligence: 100, wisdom: 45, speed: 75, manaPool: 70, mpRegen: 10 },
    moveIds: ['siphon', 'undercurrent', 'tideGuard'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'C', speed: 'A', manaPool: 'S' },
    schedule: { offerLevels: [4, 8, 12, 16, 21, 26], midLevel: 10, lateLevel: 19 },
    signatureMoveId: 'deepsurge',
    passiveIds: ['overchannel'],
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
    schedule: { offerLevels: [6, 10, 14, 17, 24, 26], midLevel: 11, lateLevel: 21 },
    signatureMoveId: 'hoarfrost',
    passiveIds: ['glaciate'],
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
    schedule: { offerLevels: [5, 8, 14, 17, 21, 28], midLevel: 9, lateLevel: 18 },
    signatureMoveId: 'icefall',
    passiveIds: ['coldSnap'],
  },
  cube: {
    id: 'cube',
    name: 'Cube',
    types: ['Frost'],
    baseStats: { hp: 250, attack: 60, defense: 115, intelligence: 25, wisdom: 40, speed: 10, manaPool: 50, mpRegen: 10 },
    moveIds: ['iceShard', 'frostArmor', 'pinDown'],
    starter: false,
    growthGrades: { hp: 'A', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'S', speed: 'C', manaPool: 'C' },
    schedule: { offerLevels: [6, 11, 15, 21, 25, 28], midLevel: 13, lateLevel: 22 },
    signatureMoveId: 'coldMass',
    passiveIds: ['absoluteZero'],
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
    schedule: { offerLevels: [5, 8, 15, 19, 21, 25], midLevel: 10, lateLevel: 20 },
    signatureMoveId: 'galeVolley',
    passiveIds: ['tailwind'],
  },
  tempest: {
    id: 'tempest',
    name: 'Tempest',
    types: ['Storm'],
    baseStats: { hp: 190, attack: 70, defense: 45, intelligence: 70, wisdom: 35, speed: 65, manaPool: 75, mpRegen: 10 },
    moveIds: ['jolt', 'charge', 'risingStatic'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'S', defense: 'C', intelligence: 'S', wisdom: 'C', speed: 'C', manaPool: 'C' },
    schedule: { offerLevels: [5, 8, 14, 17, 24, 28], midLevel: 10, lateLevel: 20 },
    signatureMoveId: 'twinbolt',
    passiveIds: ['liveWire'],
  },
  // Storm's third since 2026-09-19 (Scallywag's old seat): the storm eagle, the slate's magical
  // column swung at full weight — Squall is the physical half, Tempest hedges.
  skyshear: {
    id: 'skyshear',
    name: 'Skyshear',
    types: ['Storm'],
    baseStats: { hp: 175, attack: 30, defense: 40, intelligence: 95, wisdom: 50, speed: 100, manaPool: 60, mpRegen: 10 },
    moveIds: ['zap', 'charge', 'staticCharge'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'B', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 14, 17, 20, 26], midLevel: 9, lateLevel: 18 },
    signatureMoveId: 'stoop',
    passiveIds: ['staticField'],
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
    schedule: { offerLevels: [5, 8, 11, 15, 21, 28], midLevel: 9, lateLevel: 18 },
    signatureMoveId: 'groundsplit',
    passiveIds: ['vengefulEmblem'],
  },
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    types: ['Stone'],
    baseStats: { hp: 250, attack: 50, defense: 110, intelligence: 20, wisdom: 50, speed: 20, manaPool: 50, mpRegen: 10 },
    moveIds: ['mudBall', 'provoke', 'fortify'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'B', defense: 'A', intelligence: 'F', wisdom: 'S', speed: 'C', manaPool: 'B' },
    schedule: { offerLevels: [6, 11, 15, 20, 24, 26], midLevel: 12, lateLevel: 22 },
    signatureMoveId: 'roostGuard',
    passiveIds: ['stoneWall'],
  },
  slate: {
    id: 'slate',
    name: 'Slate',
    types: ['Stone'],
    // Stone's magical column (Tremor, Rockfall, Landslide) is all spread and had no caster to
    // swing it. An 80/80 mixed line: the quake softens both, the staff finishes one. Bulk is what
    // it costs — the first Stone hero under 240 HP.
    baseStats: { hp: 190, attack: 80, defense: 55, intelligence: 80, wisdom: 35, speed: 50, manaPool: 60, mpRegen: 10 },
    moveIds: ['tremor', 'toughenUp', 'focus'],
    starter: false,
    growthGrades: { hp: 'C', attack: 'A', defense: 'C', intelligence: 'A', wisdom: 'D', speed: 'B', manaPool: 'S' },
    schedule: { offerLevels: [7, 9, 14, 18, 23, 28], midLevel: 10, lateLevel: 20 },
    signatureMoveId: 'upheaval',
    passiveIds: ['faultLine'],
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
    schedule: { offerLevels: [5, 8, 15, 19, 24, 28], midLevel: 10, lateLevel: 20 },
    signatureMoveId: 'blightbloom',
    passiveIds: ['verdurous'],
  },
  mordax: {
    id: 'mordax',
    name: 'Mordrax',
    types: ['Nature'],
    baseStats: { hp: 220, attack: 90, defense: 65, intelligence: 25, wisdom: 45, speed: 55, manaPool: 50, mpRegen: 10 },
    moveIds: ['vineLash', 'regrowth', 'rally'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'C' },
    schedule: { offerLevels: [5, 8, 14, 17, 20, 26], midLevel: 10, lateLevel: 19 },
    signatureMoveId: 'rootrend',
    passiveIds: ['impale'],
  },
  hollowbark: {
    id: 'hollowbark',
    name: 'Hollowbark',
    types: ['Nature'],
    baseStats: { hp: 240, attack: 80, defense: 90, intelligence: 20, wisdom: 40, speed: 30, manaPool: 50, mpRegen: 10 },
    moveIds: ['ivySpike', 'fortify', 'secondWind'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'A', defense: 'A', intelligence: 'E', wisdom: 'A', speed: 'B', manaPool: 'D' },
    schedule: { offerLevels: [6, 10, 15, 19, 21, 28], midLevel: 11, lateLevel: 21 },
    signatureMoveId: 'deadfall',
    passiveIds: ['barbs'],
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
    schedule: { offerLevels: [6, 10, 15, 19, 21, 26], midLevel: 11, lateLevel: 21 },
    signatureMoveId: 'daybreak',
    passiveIds: ['grace'],
  },
  aegis: {
    id: 'aegis',
    name: 'Aegis',
    types: ['Light'],
    baseStats: { hp: 230, attack: 45, defense: 85, intelligence: 35, wisdom: 80, speed: 25, manaPool: 50, mpRegen: 10 },
    moveIds: ['holyStrike', 'mend', 'secondWind'],
    starter: false,
    growthGrades: { hp: 'A', attack: 'D', defense: 'A', intelligence: 'B', wisdom: 'A', speed: 'C', manaPool: 'B' },
    schedule: { offerLevels: [6, 11, 15, 20, 24, 28], midLevel: 12, lateLevel: 21 },
    signatureMoveId: 'bulwarkStrike',
    passiveIds: ['consecrate'],
  },
  empyrean: {
    id: 'empyrean',
    name: 'Empyrean',
    types: ['Light'],
    // Light had two supports and no attacker. Speed 100 is the point: Daze is a flinch cleared at
    // the round's end, so a Daze rider only costs the foe a turn when it lands FIRST — the slate's
    // three Daze attacks were riders on heroes too slow to cash them.
    baseStats: { hp: 180, attack: 30, defense: 40, intelligence: 90, wisdom: 55, speed: 100, manaPool: 55, mpRegen: 10 },
    moveIds: ['glimmer', 'blind', 'hallow'],
    starter: false,
    growthGrades: { hp: 'C', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'B', speed: 'S', manaPool: 'S' },
    schedule: { offerLevels: [5, 8, 11, 17, 20, 26], midLevel: 10, lateLevel: 19 },
    signatureMoveId: 'sundive',
    passiveIds: ['halo'],
  },

  // --- Shadow ---
  widow: {
    id: 'widow',
    name: 'Widow',
    types: ['Shadow'],
    baseStats: { hp: 190, attack: 100, defense: 45, intelligence: 20, wisdom: 45, speed: 100, manaPool: 50, mpRegen: 10 },
    moveIds: ['backstab', 'venomBite', 'lieInWait'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'B', defense: 'A', intelligence: 'D', wisdom: 'A', speed: 'B', manaPool: 'D' },
    schedule: { offerLevels: [5, 6, 10, 14, 19, 25], midLevel: 10, lateLevel: 19 },
    signatureMoveId: 'widowbite',
    passiveIds: ['lethalBite'],
  },
  marrow: {
    id: 'marrow',
    name: 'Marrow',
    types: ['Shadow'],
    baseStats: { hp: 190, attack: 30, defense: 50, intelligence: 95, wisdom: 55, speed: 65, manaPool: 65, mpRegen: 10 },
    moveIds: ['umbraBolt', 'weaken', 'purify'],
    starter: false,
    growthGrades: { hp: 'D', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'A', speed: 'S', manaPool: 'S' },
    schedule: { offerLevels: [6, 10, 14, 20, 24, 28], midLevel: 12, lateLevel: 22 },
    signatureMoveId: 'deathdrink',
    passiveIds: ['necrosis'],
  },
  nightshade: {
    id: 'nightshade',
    name: 'Nightshade',
    types: ['Shadow'],
    baseStats: { hp: 190, attack: 80, defense: 30, intelligence: 65, wisdom: 40, speed: 85, manaPool: 60, mpRegen: 10 },
    moveIds: ['backstab', 'lieInWait', 'weaken'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'S', defense: 'B', intelligence: 'C', wisdom: 'C', speed: 'A', manaPool: 'C' },
    schedule: { offerLevels: [5, 8, 11, 15, 20, 26], midLevel: 9, lateLevel: 17 },
    signatureMoveId: 'nightfall',
    passiveIds: ['shadowmeld'],
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
    schedule: { offerLevels: [5, 8, 11, 17, 20, 24, 28], midLevel: 10, lateLevel: 21 },
    signatureMoveId: 'erasure',
    passiveIds: ['arcaneRepose'],
  },
  zenith: {
    id: 'zenith',
    name: 'Zenith',
    types: ['Arcane'],
    baseStats: { hp: 190, attack: 20, defense: 45, intelligence: 85, wisdom: 65, speed: 50, manaPool: 95, mpRegen: 10 },
    moveIds: ['manaTap', 'barrier', 'empower'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'S' },
    schedule: { offerLevels: [6, 10, 14, 19, 24, 26], midLevel: 12, lateLevel: 22 },
    signatureMoveId: 'culmination',
    passiveIds: ['arcaneReservoir'],
  },
  pixie: {
    id: 'pixie',
    name: 'Pixie',
    types: ['Arcane'],
    // The support Arcane: Wisdom is what a buff scales off (docs/stat-scaling.md), so 85 makes
    // every grant land bigger, and Speed 90 lands it before the partner swings. The kit is the
    // Surging Magic loop end to end — the setter, the reader and the pour.
    baseStats: { hp: 180, attack: 20, defense: 45, intelligence: 60, wisdom: 85, speed: 90, manaPool: 70, mpRegen: 10 },
    moveIds: ['resonantBolt', 'infuse', 'manaFont'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'C', wisdom: 'S', speed: 'A', manaPool: 'S' },
    schedule: { offerLevels: [6, 9, 13, 17, 22, 27], midLevel: 11, lateLevel: 20 },
    signatureMoveId: 'fairyRing',
    passiveIds: ['attunement'],
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
    schedule: { offerLevels: [5, 8, 14, 17, 21, 26], midLevel: 9, lateLevel: 18 },
    signatureMoveId: 'mindlink',
    passiveIds: ['neuroplastic'],
  },
  lucius: {
    id: 'lucius',
    name: 'Lucius',
    types: ['Mind'],
    baseStats: { hp: 200, attack: 30, defense: 50, intelligence: 90, wisdom: 55, speed: 60, manaPool: 65, mpRegen: 10 },
    moveIds: ['psiBolt', 'wickedFear', 'mentalFortress'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [6, 10, 14, 19, 21, 25], midLevel: 11, lateLevel: 21 },
    signatureMoveId: 'hollowing',
    passiveIds: ['hunger'],
  },
  trance: {
    id: 'trance',
    name: 'Trance',
    types: ['Mind'],
    baseStats: { hp: 200, attack: 25, defense: 55, intelligence: 85, wisdom: 60, speed: 55, manaPool: 70, mpRegen: 10 },
    moveIds: ['psiBolt', 'enervate', 'lull'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'E', defense: 'B', intelligence: 'A', wisdom: 'S', speed: 'C', manaPool: 'A' },
    schedule: { offerLevels: [6, 10, 15, 19, 24, 28], midLevel: 12, lateLevel: 22 },
    signatureMoveId: 'sandman',
    passiveIds: ['lullaby'],
  },

  // --- Spirit ---
  revenant: {
    id: 'revenant',
    name: 'Revenant',
    types: ['Spirit'],
    baseStats: { hp: 180, attack: 56, defense: 47, intelligence: 77, wisdom: 46, speed: 64, manaPool: 80, mpRegen: 10 },
    moveIds: ['wisp', 'torment', 'unbound'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'F', defense: 'A', intelligence: 'S', wisdom: 'B', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [6, 10, 17, 20, 24, 28], midLevel: 11, lateLevel: 21 },
    signatureMoveId: 'soulTithe',
    passiveIds: ['ghostlight'],
  },
  sorrow: {
    id: 'sorrow',
    name: 'Sorrow',
    types: ['Spirit'],
    baseStats: { hp: 180, attack: 95, defense: 45, intelligence: 30, wisdom: 45, speed: 100, manaPool: 55, mpRegen: 10 },
    moveIds: ['phantomStrike', 'torment', 'secondWind'],
    starter: false,
    growthGrades: { hp: 'C', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'A', speed: 'S', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 11, 15, 21, 25], midLevel: 10, lateLevel: 19 },
    signatureMoveId: 'dirgeOfAsh',
    passiveIds: ['lament'],
  },
  dread: {
    id: 'dread',
    name: 'Dread',
    types: ['Spirit'],
    // The Spirit body that can PAY the slate's prices: Revenant and Sorrow are both 180 HP, and
    // Soul Offering, Spite and Vengeance all read the caster's own HP. Fifty points of bulk over
    // either, on a line that hits harder the lower it has been taken.
    baseStats: { hp: 230, attack: 40, defense: 80, intelligence: 50, wisdom: 65, speed: 30, manaPool: 55, mpRegen: 10 },
    moveIds: ['spite', 'torment', 'secondWind'],
    starter: false,
    growthGrades: { hp: 'A', attack: 'E', defense: 'S', intelligence: 'C', wisdom: 'A', speed: 'C', manaPool: 'A' },
    schedule: { offerLevels: [6, 10, 15, 19, 24, 28], midLevel: 12, lateLevel: 21 },
    signatureMoveId: 'nevermore',
    passiveIds: ['nightmare'],
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
    schedule: { offerLevels: [6, 11, 15, 19, 21, 25], midLevel: 12, lateLevel: 21 },
    signatureMoveId: 'wallStrike',
    passiveIds: ['rivet'],
  },
  valor: {
    id: 'valor',
    name: 'Valor',
    types: ['Iron'],
    baseStats: { hp: 220, attack: 60, defense: 65, intelligence: 40, wisdom: 45, speed: 60, manaPool: 60, mpRegen: 10 },
    moveIds: ['ironFist', 'sharpen', 'provoke'],
    starter: true,
    growthGrades: { hp: 'A', attack: 'A', defense: 'B', intelligence: 'C', wisdom: 'B', speed: 'B', manaPool: 'C' },
    schedule: { offerLevels: [5, 8, 11, 15, 21, 25], midLevel: 9, lateLevel: 17 },
    signatureMoveId: 'oathstrike',
    passiveIds: ['rallyingStandard'],
  },
  gallant: {
    id: 'gallant',
    name: 'Gallant',
    types: ['Iron'],
    baseStats: { hp: 210, attack: 95, defense: 60, intelligence: 20, wisdom: 40, speed: 75, manaPool: 50, mpRegen: 10 },
    moveIds: ['heavyBlow', 'openingStrike', 'rally'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'B', defense: 'A', intelligence: 'D', wisdom: 'A', speed: 'A', manaPool: 'C' },
    schedule: { offerLevels: [5, 6, 10, 14, 19, 25], midLevel: 9, lateLevel: 18 },
    signatureMoveId: 'fullTilt',
    passiveIds: ['sunder'],
  },
  // The first bundle hero (docs/constellation.md §4): outside the base three-a-type, in a run's
  // pools only while the Free Company is held. Storm-born; the Stormrunner path is the way back.
  scallywag: {
    id: 'scallywag',
    name: 'Scallywag',
    types: ['Iron'],
    baseStats: { hp: 210, attack: 95, defense: 50, intelligence: 25, wisdom: 40, speed: 80, manaPool: 50, mpRegen: 10 },
    moveIds: ['swiftBlow', 'pinDown', 'sharpen'],
    starter: false,
    unlock: 'bundle.freeCompany',
    growthGrades: { hp: 'B', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'A', speed: 'A', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 14, 17, 20, 26], midLevel: 9, lateLevel: 18 },
    signatureMoveId: 'broadside',
    passiveIds: ['quickening'],
  },

  // --- Mech ---
  forgewright: {
    id: 'forgewright',
    name: 'Clockwork',
    types: ['Mech'],
    baseStats: { hp: 230, attack: 60, defense: 70, intelligence: 45, wisdom: 40, speed: 55, manaPool: 50, mpRegen: 10 },
    // Spark Plug plants the mark and Piston Punch cashes it — the Conduct loop from the draft.
    moveIds: ['pistonPunch', 'sparkPlug', 'kickstart'],
    starter: true,
    growthGrades: { hp: 'B', attack: 'S', defense: 'A', intelligence: 'A', wisdom: 'C', speed: 'B', manaPool: 'E' },
    schedule: { offerLevels: [5, 8, 11, 19, 21, 25], midLevel: 10, lateLevel: 20 },
    signatureMoveId: 'overwind',
    passiveIds: ['boiler'],
  },
  steamColossus: {
    id: 'steamColossus',
    name: 'Bellows',
    types: ['Mech', 'Iron'],
    // The Burden (docs/innate-passives.md §4): Ironbound, and BURDEN_SURPLUS over the 550 for it — into the body, never the Speed.
    baseStats: { hp: 280, attack: 120, defense: 105, intelligence: 15, wisdom: 35, speed: 5, manaPool: 50, mpRegen: 10 },
    moveIds: ['cogBop', 'ironFist', 'sharpen'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'A', defense: 'S', intelligence: 'F', wisdom: 'S', speed: 'C', manaPool: 'D' },
    schedule: { offerLevels: [6, 10, 14, 17, 24, 26], midLevel: 13, lateLevel: 22 },
    signatureMoveId: 'boilerBlow',
    passiveIds: ['ironbound'],
  },
  rex: {
    id: 'rex',
    name: 'Rex',
    types: ['Mech'],
    // The roster's top Attack, and unlike Bellows it gets there before the round is over: 110 at
    // Speed 70 against 105 at 5. It pays in every other column, and Speed grows S so the gap
    // between it and the things it eats only widens.
    baseStats: { hp: 210, attack: 110, defense: 55, intelligence: 15, wisdom: 35, speed: 70, manaPool: 55, mpRegen: 10 },
    // Spark Plug then Steam Vent: the spread cashes the mark and hits the partner beside it.
    moveIds: ['steamVent', 'sparkPlug', 'overclock'],
    starter: false,
    growthGrades: { hp: 'B', attack: 'A', defense: 'B', intelligence: 'F', wisdom: 'B', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [3, 7, 11, 15, 20, 25], midLevel: 9, lateLevel: 18 },
    signatureMoveId: 'devour',
    passiveIds: ['tyrantsDue'],
  },
  // Free Company (docs/constellation.md §11 phase 6): the medic drone. The roster's Wisdom-85 body
  // on Mech's repair column, which nobody in the base three holds as a healer; Spark Plug is the
  // one attack — the mark is its job, not the hit.
  patch: {
    id: 'patch',
    name: 'Patch',
    types: ['Mech'],
    baseStats: { hp: 190, attack: 20, defense: 65, intelligence: 55, wisdom: 85, speed: 60, manaPool: 75, mpRegen: 10 },
    moveIds: ['sparkPlug', 'kickstart', 'overclock'],
    starter: false,
    unlock: 'bundle.freeCompany',
    growthGrades: { hp: 'B', attack: 'F', defense: 'A', intelligence: 'C', wisdom: 'S', speed: 'B', manaPool: 'S' },
    schedule: { offerLevels: [5, 8, 14, 19, 24, 28], midLevel: 10, lateLevel: 20 },
    signatureMoveId: 'overhaul',
    passiveIds: ['fieldRepair'],
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
    schedule: { offerLevels: [5, 8, 11, 17, 20, 25], midLevel: 9, lateLevel: 18 },
    signatureMoveId: 'packCall',
    passiveIds: ['packHunter'],
  },
  ursa: {
    id: 'ursa',
    name: 'Ursa',
    types: ['Beast'],
    // The roster's top Attack on its second-slowest body: a bear. Provoke is the Stone off-type
    // the kit telegraphs — it draws the hit Thick Hide and Stoneheart both want.
    baseStats: { hp: 235, attack: 115, defense: 70, intelligence: 15, wisdom: 45, speed: 20, manaPool: 50, mpRegen: 10 },
    moveIds: ['claw', 'prowl', 'provoke'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'A', speed: 'E', manaPool: 'A' },
    schedule: { offerLevels: [6, 8, 11, 15, 21, 26], midLevel: 11, lateLevel: 21 },
    signatureMoveId: 'overbear',
    passiveIds: ['feast'],
  },
  coil: {
    id: 'coil',
    name: 'Coil',
    types: ['Beast', 'Mind'],
    baseStats: { hp: 190, attack: 25, defense: 55, intelligence: 90, wisdom: 65, speed: 60, manaPool: 65, mpRegen: 10 },
    moveIds: ['psiBolt', 'lull', 'rally'],
    starter: false,
    growthGrades: { hp: 'S', attack: 'E', defense: 'A', intelligence: 'A', wisdom: 'A', speed: 'D', manaPool: 'B' },
    schedule: { offerLevels: [6, 10, 14, 19, 25, 28], midLevel: 12, lateLevel: 22 },
    signatureMoveId: 'stranglehold',
    passiveIds: ['serpentsEye'],
  },
  // Free Company: the vampire bat. The roster's top Speed on its thinnest body, Beast-born — the
  // Bleed column is what it feeds on, and the Shadow turn is a path, not the start.
  vex: {
    id: 'vex',
    name: 'Vex',
    types: ['Beast'],
    baseStats: { hp: 170, attack: 90, defense: 35, intelligence: 30, wisdom: 45, speed: 110, manaPool: 70, mpRegen: 10 },
    moveIds: ['claw', 'howl', 'lieInWait'],
    starter: false,
    unlock: 'bundle.freeCompany',
    growthGrades: { hp: 'B', attack: 'S', defense: 'C', intelligence: 'F', wisdom: 'B', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 11, 17, 21, 26], midLevel: 9, lateLevel: 19 },
    signatureMoveId: 'exsanguinate',
    passiveIds: ['sanguine'],
  },
};
