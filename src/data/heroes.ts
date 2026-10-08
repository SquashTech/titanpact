// Hero roster, grouped by primary type in typechart.ts TYPES order.
// Starting kit is exactly three moves: one low-power main-type move plus two supports
// (heal/buff/status) — MOVE_CAP is 4, so one slot is left to grow into on level-up.
// Every line sums to exactly 550 at face value across seven stats (HP + Mana + the five battle
// stats; MP Regen is a flat 10 outside it) — the same number the sheet prints as Power, HP
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
// `signatureLevel` (2026-09-24, per user direction) is the level the hero's signature move is a
// GUARANTEED learn at, set by how hard the move hits (docs/mastery.md §5) in three windows:
//   14-16  the lighter ones — a rider-led hit, a buff, a cheap move (Lizard Rush, Roost Guard,
//          Icefall, Oathstrike, Nevermore): Act 2's Guardian into Act 3;
//   18-20  the standard Late-sized hit with one real rider (Emberlance, Rootrend, Erasure): late Act 3;
//   22-24  the heaviest — 95+ Base Power, a lockout, a double-on-a-status, a whole-side heal or
//          a pool refill (Overbear, Hoarfrost, Flashover, Daybreak, Fairy Ring): Act 4.
// Never on one of the hero's own offer levels, so a report pays it as a beat of its own
// (test/mastery.test.ts pins the windows and the stagger).
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
    moveIds: ['singe', 'setAlight'],
    growthGrades: { hp: 'S', attack: 'A', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'B' },
    schedule: { offerLevels: [6, 10, 11, 18, 24], midLevel: 11, lateLevel: 21, signatureLevel: 19 },
    signatureMoveId: 'hammerbrand',
    passiveIds: ['kindling'],
    masteredPassiveIds: ['forgeheart'],
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson',
    types: ['Fire'],
    baseStats: { hp: 200, attack: 30, defense: 38, intelligence: 80, wisdom: 75, speed: 62, manaPool: 65, mpRegen: 10 },
    moveIds: ['ember', 'weaken'],
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [6, 10, 11, 19, 24], midLevel: 11, lateLevel: 21, signatureLevel: 23 },
    signatureMoveId: 'flashover',
    passiveIds: ['stoke'],
    masteredPassiveIds: ['wildfire'],
  },
  brimstone: {
    id: 'brimstone',
    name: 'Brimstone',
    types: ['Fire', 'Shadow'],
    baseStats: { hp: 190, attack: 45, defense: 50, intelligence: 85, wisdom: 55, speed: 60, manaPool: 65, mpRegen: 10 },
    moveIds: ['umbraBolt', 'weaken'],
    unlock: 'starfall',
    growthGrades: { hp: 'A', attack: 'E', defense: 'A', intelligence: 'C', wisdom: 'A', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 11, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 16 },
    signatureMoveId: 'hearthfire',
    passiveIds: ['sulphur'],
    masteredPassiveIds: ['hellmouth'],
  },
  // From the Tall Grass (docs/constellation.md §4): the fire dragon. Fire's physical column swung
  // hard on a thin pool — it runs dry, sleeps, and wakes with the breath held (Slumber).
  drake: {
    id: 'drake',
    name: 'Drake',
    types: ['Fire'],
    baseStats: { hp: 210, attack: 105, defense: 60, intelligence: 20, wisdom: 45, speed: 60, manaPool: 50, mpRegen: 10 },
    moveIds: ['singe', 'kindle'],
    unlock: 'bundle.tallGrass',
    growthGrades: { hp: 'A', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'A', speed: 'B', manaPool: 'C' },
    schedule: { offerLevels: [6, 10, 11, 19, 24], midLevel: 11, lateLevel: 21, signatureLevel: 22 },
    signatureMoveId: 'wyrmfire',
    passiveIds: ['slumber'],
    masteredPassiveIds: ['dragonsDream'],
  },

  // --- Water ---
  tidecaller: {
    id: 'tidecaller',
    name: 'Riptide',
    types: ['Water'],
    baseStats: { hp: 210, attack: 55, defense: 55, intelligence: 59, wisdom: 40, speed: 66, manaPool: 65, mpRegen: 10 },
    moveIds: ['splash', 'tideGuard'],
    unlock: 'starfall',
    // Mana takes the point the line was over by (29 -> GRADE_BUDGET's 28). Of the three A's it is
    // the one the reshape cares least about: this is no longer the S-Intelligence caster whose
    // ceiling was its pool, and 65 base is already comfortable. Attack stays C and Intelligence
    // stays B — those are the two the reshape exists to lift off the floor.
    growthGrades: { hp: 'A', attack: 'C', defense: 'B', intelligence: 'B', wisdom: 'C', speed: 'A', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 11, 17, 21], midLevel: 10, lateLevel: 19, signatureLevel: 14 },
    signatureMoveId: 'lizardRush',
    passiveIds: ['drag'],
    masteredPassiveIds: ['ripCurrent'],
  },
  pincer: {
    id: 'pincer',
    name: 'Pincer',
    types: ['Water'],
    baseStats: { hp: 230, attack: 80, defense: 90, intelligence: 20, wisdom: 45, speed: 35, manaPool: 50, mpRegen: 10 },
    moveIds: ['undertow', 'tideGuard'],
    growthGrades: { hp: 'A', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 11, 17, 21], midLevel: 10, lateLevel: 19, signatureLevel: 16 },
    signatureMoveId: 'vise',
    passiveIds: ['carapace'],
    masteredPassiveIds: ['exoskeleton'],
  },
  leviathan: {
    id: 'leviathan',
    name: 'Leviathan',
    types: ['Water'],
    // The roster's top Intelligence: Water's slate is magical sixteen deep and nobody was swinging
    // it at full weight — Riptide hedged, Pincer is the physical wall. Everything else is thin.
    baseStats: { hp: 190, attack: 30, defense: 40, intelligence: 100, wisdom: 45, speed: 75, manaPool: 70, mpRegen: 10 },
    moveIds: ['siphon', 'undercurrent'],
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'C', speed: 'A', manaPool: 'S' },
    schedule: { offerLevels: [4, 8, 11, 17, 21], midLevel: 10, lateLevel: 19, signatureLevel: 23 },
    signatureMoveId: 'deepsurge',
    passiveIds: ['overchannel'],
    masteredPassiveIds: ['abyssalWell'],
  },
  // From the Tall Grass: the octopus. Water's control hand on a Wisdom-and-Intelligence body — it
  // clouds the water and slips out through it (Ink), and its opener Dazes the whole enemy line.
  nautilus: {
    id: 'nautilus',
    name: 'Nautilus',
    types: ['Water'],
    baseStats: { hp: 210, attack: 30, defense: 60, intelligence: 75, wisdom: 75, speed: 40, manaPool: 60, mpRegen: 10 },
    moveIds: ['splash', 'inkCloud'],
    unlock: 'bundle.tallGrass',
    growthGrades: { hp: 'A', attack: 'F', defense: 'A', intelligence: 'A', wisdom: 'S', speed: 'C', manaPool: 'B' },
    schedule: { offerLevels: [6, 10, 11, 19, 24], midLevel: 11, lateLevel: 20, signatureLevel: 15 },
    signatureMoveId: 'inkBlast',
    passiveIds: ['ink'],
    masteredPassiveIds: ['abyssalInk'],
  },

  // --- Frost ---
  glacialWarden: {
    id: 'glacialWarden',
    name: 'Flurry',
    types: ['Frost'],
    baseStats: { hp: 230, attack: 25, defense: 60, intelligence: 80, wisdom: 50, speed: 40, manaPool: 65, mpRegen: 10 },
    moveIds: ['frostBolt', 'deepChill'],
    unlock: 'starfall',
    growthGrades: { hp: 'A', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'B' },
    schedule: { offerLevels: [6, 10, 11, 19, 24], midLevel: 11, lateLevel: 21, signatureLevel: 23 },
    signatureMoveId: 'hoarfrost',
    passiveIds: ['frostbite'],
    masteredPassiveIds: ['frostbitePlus'],
  },
  rime: {
    id: 'rime',
    name: 'Rime',
    types: ['Frost'],
    // 90/40 rather than the 65/65 it shipped with: Frost authors a split slate and Flurry already
    // owns the magical half, so a hedged Rime had no spike and half its level-ups paid in a stat it
    // was not swinging with. Same 550.
    baseStats: { hp: 210, attack: 90, defense: 55, intelligence: 40, wisdom: 53, speed: 42, manaPool: 60, mpRegen: 10 },
    moveIds: ['iceShard', 'deepChill'],
    growthGrades: { hp: 'B', attack: 'B', defense: 'A', intelligence: 'D', wisdom: 'B', speed: 'A', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 12, 17, 21], midLevel: 9, lateLevel: 18, signatureLevel: 15 },
    signatureMoveId: 'icefall',
    passiveIds: ['coldSnap'],
    masteredPassiveIds: ['shatterpoint'],
  },
  cube: {
    id: 'cube',
    name: 'Floe',
    types: ['Frost'],
    baseStats: { hp: 250, attack: 60, defense: 115, intelligence: 25, wisdom: 40, speed: 10, manaPool: 50, mpRegen: 10 },
    moveIds: ['iceShard', 'frostArmor'],
    growthGrades: { hp: 'A', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'S', speed: 'C', manaPool: 'C' },
    schedule: { offerLevels: [6, 11, 13, 18, 24], midLevel: 13, lateLevel: 22, signatureLevel: 19 },
    signatureMoveId: 'coldMass',
    passiveIds: ['absoluteZero'],
    masteredPassiveIds: ['zeroKelvin'],
  },

  // --- Storm ---
  stormRanger: {
    id: 'stormRanger',
    name: 'Squall',
    types: ['Storm'],
    baseStats: { hp: 190, attack: 85, defense: 45, intelligence: 30, wisdom: 45, speed: 105, manaPool: 50, mpRegen: 10 },
    moveIds: ['thunderclap', 'risingStatic'],
    growthGrades: { hp: 'B', attack: 'A', defense: 'A', intelligence: 'D', wisdom: 'B', speed: 'B', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 11, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 20 },
    signatureMoveId: 'galeVolley',
    passiveIds: ['tailwind'],
    masteredPassiveIds: ['jetstream'],
  },
  tempest: {
    id: 'tempest',
    name: 'Tempest',
    types: ['Storm'],
    baseStats: { hp: 190, attack: 70, defense: 45, intelligence: 70, wisdom: 35, speed: 65, manaPool: 75, mpRegen: 10 },
    moveIds: ['jolt', 'risingStatic'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'S', defense: 'C', intelligence: 'S', wisdom: 'C', speed: 'C', manaPool: 'C' },
    schedule: { offerLevels: [5, 8, 11, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 22 },
    signatureMoveId: 'twinbolt',
    passiveIds: ['liveWire'],
    masteredPassiveIds: ['thunderhead'],
  },
  // Storm's third since 2026-09-19 (Scallywag's old seat): the storm eagle, the slate's magical
  // column swung at full weight — Squall is the physical half, Tempest hedges.
  skyshear: {
    id: 'skyshear',
    name: 'Skyshear',
    types: ['Storm'],
    baseStats: { hp: 175, attack: 30, defense: 40, intelligence: 95, wisdom: 50, speed: 100, manaPool: 60, mpRegen: 10 },
    moveIds: ['jolt', 'staticCharge'],
    growthGrades: { hp: 'B', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'B', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 12, 17, 21], midLevel: 9, lateLevel: 18, signatureLevel: 19 },
    signatureMoveId: 'stoop',
    passiveIds: ['stormveil'],
    masteredPassiveIds: ['stormveilPlus', 'stormveilPartner'],
  },
  // --- Stone ---
  crag: {
    id: 'crag',
    name: 'Crag',
    types: ['Stone'],
    baseStats: { hp: 240, attack: 90, defense: 75, intelligence: 20, wisdom: 35, speed: 40, manaPool: 50, mpRegen: 10 },
    moveIds: ['rockToss', 'toughenUp'],
    growthGrades: { hp: 'A', attack: 'S', defense: 'A', intelligence: 'E', wisdom: 'A', speed: 'B', manaPool: 'D' },
    schedule: { offerLevels: [5, 8, 12, 17, 21], midLevel: 9, lateLevel: 18, signatureLevel: 16 },
    signatureMoveId: 'groundsplit',
    passiveIds: ['vengefulEmblem'],
    masteredPassiveIds: ['bedrockWrath'],
  },
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    types: ['Stone'],
    baseStats: { hp: 250, attack: 50, defense: 110, intelligence: 20, wisdom: 50, speed: 20, manaPool: 50, mpRegen: 10 },
    moveIds: ['mudBall', 'provoke'],
    growthGrades: { hp: 'S', attack: 'B', defense: 'A', intelligence: 'F', wisdom: 'S', speed: 'C', manaPool: 'B' },
    schedule: { offerLevels: [6, 11, 12, 19, 24], midLevel: 12, lateLevel: 22, signatureLevel: 14 },
    signatureMoveId: 'roostGuard',
    passiveIds: ['stoneWall'],
    masteredPassiveIds: ['fortress'],
  },
  slate: {
    id: 'slate',
    name: 'Petra',
    types: ['Stone'],
    // Stone's magical column (Tremor, Rockfall, Landslide) is all spread and had no caster to
    // swing it. An 80/80 mixed line: the quake softens both, the staff finishes one. Bulk is what
    // it costs — the first Stone hero under 240 HP.
    baseStats: { hp: 190, attack: 80, defense: 55, intelligence: 80, wisdom: 35, speed: 50, manaPool: 60, mpRegen: 10 },
    moveIds: ['tremor', 'toughenUp'],
    growthGrades: { hp: 'C', attack: 'A', defense: 'C', intelligence: 'A', wisdom: 'D', speed: 'B', manaPool: 'S' },
    schedule: { offerLevels: [7, 9, 11, 18, 25], midLevel: 10, lateLevel: 20, signatureLevel: 19 },
    signatureMoveId: 'upheaval',
    passiveIds: ['faultLine'],
    masteredPassiveIds: ['tectonic'],
  },

  // --- Nature ---
  wildOracle: {
    id: 'wildOracle',
    name: 'Sylva',
    types: ['Nature'],
    baseStats: { hp: 180, attack: 45, defense: 60, intelligence: 60, wisdom: 60, speed: 65, manaPool: 80, mpRegen: 10 },
    moveIds: ['seedShot', 'regrowth'],
    growthGrades: { hp: 'B', attack: 'D', defense: 'C', intelligence: 'A', wisdom: 'A', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 11, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 18 },
    signatureMoveId: 'blightbloom',
    passiveIds: ['verdurous'],
    masteredPassiveIds: ['rampantBloom'],
  },
  mordax: {
    id: 'mordax',
    name: 'Mordrax',
    types: ['Nature'],
    baseStats: { hp: 220, attack: 90, defense: 65, intelligence: 25, wisdom: 45, speed: 55, manaPool: 50, mpRegen: 10 },
    moveIds: ['vineLash', 'regrowth'],
    growthGrades: { hp: 'S', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'C' },
    schedule: { offerLevels: [5, 8, 11, 17, 21], midLevel: 10, lateLevel: 19, signatureLevel: 19 },
    signatureMoveId: 'rootrend',
    passiveIds: ['impale'],
    masteredPassiveIds: ['skewer'],
  },
  hollowbark: {
    id: 'hollowbark',
    name: 'Hollowbark',
    types: ['Nature'],
    baseStats: { hp: 240, attack: 80, defense: 90, intelligence: 20, wisdom: 40, speed: 30, manaPool: 50, mpRegen: 10 },
    moveIds: ['ivySpike', 'fortify'],
    growthGrades: { hp: 'S', attack: 'A', defense: 'A', intelligence: 'E', wisdom: 'A', speed: 'B', manaPool: 'D' },
    schedule: { offerLevels: [6, 10, 11, 19, 24], midLevel: 11, lateLevel: 21, signatureLevel: 23 },
    signatureMoveId: 'deadfall',
    passiveIds: ['barbs'],
    masteredPassiveIds: ['thornmail'],
  },
  // From the Tall Grass: the mantis. The roster's top Attack short of the bears, on Speed 45 —
  // slow, and first anyway: every move that deals no damage leaves it Poised to strike early.
  tixwick: {
    id: 'tixwick',
    name: 'Tixwick',
    types: ['Nature'],
    baseStats: { hp: 200, attack: 105, defense: 50, intelligence: 20, wisdom: 50, speed: 45, manaPool: 80, mpRegen: 10 },
    moveIds: ['ivySpike', 'lieInWait'],
    unlock: 'bundle.tallGrass',
    growthGrades: { hp: 'A', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'A', speed: 'D', manaPool: 'S' },
    schedule: { offerLevels: [6, 10, 11, 19, 24], midLevel: 11, lateLevel: 20, signatureLevel: 18 },
    signatureMoveId: 'guillotine',
    passiveIds: ['poised'],
    masteredPassiveIds: ['deathtrap', 'deathtrapEdge'],
  },

  // --- Light ---
  dawnwarden: {
    id: 'dawnwarden',
    name: 'Solace',
    types: ['Light'],
    baseStats: { hp: 210, attack: 29, defense: 50, intelligence: 60, wisdom: 70, speed: 61, manaPool: 70, mpRegen: 10 },
    moveIds: ['glimmer', 'mend'],
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'B', wisdom: 'S', speed: 'B', manaPool: 'S' },
    schedule: { offerLevels: [6, 10, 11, 19, 24], midLevel: 11, lateLevel: 21, signatureLevel: 23 },
    signatureMoveId: 'daybreak',
    passiveIds: ['dawnlight'],
    masteredPassiveIds: ['dawnlightPlus'],
  },
  aegis: {
    id: 'aegis',
    name: 'Aegis',
    types: ['Light'],
    baseStats: { hp: 230, attack: 45, defense: 85, intelligence: 35, wisdom: 80, speed: 25, manaPool: 50, mpRegen: 10 },
    moveIds: ['holyStrike', 'mend'],
    growthGrades: { hp: 'A', attack: 'D', defense: 'A', intelligence: 'B', wisdom: 'A', speed: 'C', manaPool: 'B' },
    schedule: { offerLevels: [6, 11, 12, 19, 24], midLevel: 12, lateLevel: 21, signatureLevel: 16 },
    signatureMoveId: 'bulwarkStrike',
    passiveIds: ['consecrate'],
    masteredPassiveIds: ['sanctified'],
  },
  empyrean: {
    id: 'empyrean',
    name: 'Empyrean',
    types: ['Light'],
    // Light had two supports and no attacker. Speed 100 is the point: Daze is a flinch cleared at
    // the round's end, so a Daze rider only costs the foe a turn when it lands FIRST — the slate's
    // three Daze attacks were riders on heroes too slow to cash them.
    baseStats: { hp: 180, attack: 30, defense: 40, intelligence: 90, wisdom: 55, speed: 100, manaPool: 55, mpRegen: 10 },
    moveIds: ['glimmer', 'hallow'],
    growthGrades: { hp: 'C', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'B', speed: 'S', manaPool: 'S' },
    schedule: { offerLevels: [5, 8, 11, 17, 21], midLevel: 10, lateLevel: 19, signatureLevel: 19 },
    signatureMoveId: 'sundive',
    passiveIds: ['halo'],
    masteredPassiveIds: ['corona'],
  },

  // --- Shadow ---
  widow: {
    id: 'widow',
    name: 'Widow',
    types: ['Shadow'],
    baseStats: { hp: 190, attack: 100, defense: 45, intelligence: 20, wisdom: 45, speed: 100, manaPool: 50, mpRegen: 10 },
    moveIds: ['backstab', 'venomBite'],
    growthGrades: { hp: 'S', attack: 'B', defense: 'A', intelligence: 'D', wisdom: 'A', speed: 'B', manaPool: 'D' },
    schedule: { offerLevels: [5, 6, 11, 17, 21], midLevel: 10, lateLevel: 19, signatureLevel: 18 },
    signatureMoveId: 'widowbite',
    passiveIds: ['lethalBite'],
    masteredPassiveIds: ['blackWidowBleed', 'blackWidowPoison'],
  },
  marrow: {
    id: 'marrow',
    name: 'Marrow',
    types: ['Shadow'],
    baseStats: { hp: 190, attack: 30, defense: 50, intelligence: 95, wisdom: 55, speed: 65, manaPool: 65, mpRegen: 10 },
    moveIds: ['umbraBolt', 'weaken'],
    growthGrades: { hp: 'D', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'A', speed: 'S', manaPool: 'S' },
    schedule: { offerLevels: [6, 10, 12, 19, 24], midLevel: 12, lateLevel: 22, signatureLevel: 22 },
    signatureMoveId: 'deathdrink',
    passiveIds: ['necrosis'],
    masteredPassiveIds: ['lichsDraught'],
  },
  nightshade: {
    id: 'nightshade',
    name: 'Nightshade',
    types: ['Shadow'],
    baseStats: { hp: 190, attack: 80, defense: 30, intelligence: 65, wisdom: 40, speed: 85, manaPool: 60, mpRegen: 10 },
    moveIds: ['backstab', 'lieInWait'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'S', defense: 'B', intelligence: 'C', wisdom: 'C', speed: 'A', manaPool: 'C' },
    schedule: { offerLevels: [5, 8, 12, 16, 21], midLevel: 9, lateLevel: 17, signatureLevel: 23 },
    signatureMoveId: 'nightfall',
    passiveIds: ['shadowmeld'],
    masteredPassiveIds: ['umbralVeil'],
  },

  // --- Arcane ---
  runescribe: {
    id: 'runescribe',
    name: 'Glyph',
    types: ['Arcane'],
    baseStats: { hp: 180, attack: 25, defense: 32, intelligence: 90, wisdom: 80, speed: 58, manaPool: 85, mpRegen: 10 },
    moveIds: ['magicBolt', 'focus'],
    growthGrades: { hp: 'S', attack: 'E', defense: 'A', intelligence: 'B', wisdom: 'A', speed: 'D', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 10, 15, 20, 24], midLevel: 10, lateLevel: 21, signatureLevel: 19 },
    signatureMoveId: 'erasure',
    passiveIds: ['arcaneRepose'],
    masteredPassiveIds: ['arcaneBastion'],
  },
  zenith: {
    id: 'zenith',
    name: 'Zenith',
    types: ['Arcane'],
    baseStats: { hp: 190, attack: 20, defense: 45, intelligence: 85, wisdom: 65, speed: 50, manaPool: 95, mpRegen: 10 },
    moveIds: ['manaFont', 'magicBolt'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'S' },
    schedule: { offerLevels: [6, 10, 12, 19, 24], midLevel: 12, lateLevel: 22, signatureLevel: 20 },
    signatureMoveId: 'culmination',
    passiveIds: ['surgingIntellect'],
    masteredPassiveIds: ['surgingIntellectPlus'],
  },
  pixie: {
    id: 'pixie',
    name: 'Pixie',
    types: ['Arcane'],
    // The support Arcane: Wisdom is what a buff scales off (docs/stat-scaling.md), so 85 makes
    // every grant land bigger, and Speed 90 lands it before the partner swings. The kit is the
    // Surging Magic loop end to end — the setter, the reader and the pour.
    baseStats: { hp: 180, attack: 20, defense: 45, intelligence: 60, wisdom: 85, speed: 90, manaPool: 70, mpRegen: 10 },
    moveIds: ['resonantBolt', 'infuse'],
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'C', wisdom: 'S', speed: 'A', manaPool: 'S' },
    schedule: { offerLevels: [6, 9, 11, 19, 24], midLevel: 11, lateLevel: 20, signatureLevel: 23 },
    signatureMoveId: 'fairyRing',
    passiveIds: ['manaChime'],
    masteredPassiveIds: ['manaChimePlus'],
  },

  // --- Mind ---
  mindweaver: {
    id: 'mindweaver',
    name: 'Reverie',
    types: ['Mind'],
    baseStats: { hp: 200, attack: 53, defense: 45, intelligence: 55, wisdom: 55, speed: 67, manaPool: 75, mpRegen: 10 },
    moveIds: ['psiBolt', 'dopamine'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'A', defense: 'D', intelligence: 'A', wisdom: 'C', speed: 'A', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 12, 17, 21], midLevel: 9, lateLevel: 18, signatureLevel: 20 },
    signatureMoveId: 'mindlink',
    passiveIds: ['neuroplastic'],
    masteredPassiveIds: ['mindthief'],
  },
  lucius: {
    id: 'lucius',
    name: 'Lucius',
    types: ['Mind'],
    baseStats: { hp: 200, attack: 30, defense: 50, intelligence: 90, wisdom: 55, speed: 60, manaPool: 65, mpRegen: 10 },
    moveIds: ['psiBolt', 'distort'],
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [6, 10, 11, 19, 24], midLevel: 11, lateLevel: 21, signatureLevel: 16 },
    signatureMoveId: 'hollowing',
    passiveIds: ['hunger'],
    masteredPassiveIds: ['insatiable'],
  },
  trance: {
    id: 'trance',
    name: 'Trance',
    types: ['Mind'],
    baseStats: { hp: 200, attack: 25, defense: 55, intelligence: 85, wisdom: 60, speed: 55, manaPool: 70, mpRegen: 10 },
    moveIds: ['psiBolt', 'lull'],
    growthGrades: { hp: 'B', attack: 'E', defense: 'B', intelligence: 'A', wisdom: 'S', speed: 'C', manaPool: 'A' },
    schedule: { offerLevels: [6, 10, 12, 19, 24], midLevel: 12, lateLevel: 22, signatureLevel: 16 },
    signatureMoveId: 'sandman',
    passiveIds: ['lullaby'],
    masteredPassiveIds: ['deepSlumber'],
  },

  // --- Spirit ---
  revenant: {
    id: 'revenant',
    name: 'Revenant',
    types: ['Spirit'],
    baseStats: { hp: 180, attack: 56, defense: 47, intelligence: 77, wisdom: 46, speed: 64, manaPool: 80, mpRegen: 10 },
    moveIds: ['wisp', 'torment'],
    growthGrades: { hp: 'B', attack: 'F', defense: 'A', intelligence: 'S', wisdom: 'B', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [6, 10, 11, 18, 24], midLevel: 11, lateLevel: 21, signatureLevel: 19 },
    signatureMoveId: 'soulTithe',
    passiveIds: ['ghostlight'],
    masteredPassiveIds: ['wraithfire'],
  },
  sorrow: {
    id: 'sorrow',
    name: 'Sorrow',
    types: ['Spirit'],
    baseStats: { hp: 180, attack: 95, defense: 45, intelligence: 30, wisdom: 45, speed: 100, manaPool: 55, mpRegen: 10 },
    moveIds: ['phantomStrike', 'torment'],
    growthGrades: { hp: 'C', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'A', speed: 'S', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 11, 17, 21], midLevel: 10, lateLevel: 19, signatureLevel: 18 },
    signatureMoveId: 'dirgeOfAsh',
    passiveIds: ['lament'],
    masteredPassiveIds: ['keening', 'keeningShare'],
  },
  dread: {
    id: 'dread',
    name: 'Dread',
    types: ['Spirit'],
    // The Spirit body that can PAY the slate's prices: Revenant and Sorrow are both 180 HP, and
    // Soul Offering, Spite and Vengeance all read the caster's own HP. Fifty points of bulk over
    // either, on a line that hits harder the lower it has been taken.
    baseStats: { hp: 230, attack: 40, defense: 80, intelligence: 50, wisdom: 65, speed: 30, manaPool: 55, mpRegen: 10 },
    moveIds: ['spite', 'torment'],
    growthGrades: { hp: 'A', attack: 'E', defense: 'S', intelligence: 'C', wisdom: 'A', speed: 'C', manaPool: 'A' },
    schedule: { offerLevels: [6, 10, 12, 19, 24], midLevel: 12, lateLevel: 21, signatureLevel: 14 },
    signatureMoveId: 'nevermore',
    passiveIds: ['nightmare'],
    masteredPassiveIds: ['nightTerror'],
  },

  // --- Iron ---
  ironWarden: {
    id: 'ironWarden',
    name: 'Warden',
    types: ['Iron'],
    baseStats: { hp: 240, attack: 60, defense: 100, intelligence: 20, wisdom: 50, speed: 30, manaPool: 50, mpRegen: 10 },
    moveIds: ['ironFist', 'fortify'],
    growthGrades: { hp: 'A', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'A', speed: 'B', manaPool: 'B' },
    schedule: { offerLevels: [6, 11, 12, 19, 24], midLevel: 12, lateLevel: 21, signatureLevel: 16 },
    signatureMoveId: 'wallStrike',
    passiveIds: ['rivet'],
    masteredPassiveIds: ['rivetedLine'],
  },
  valor: {
    id: 'valor',
    name: 'Valor',
    types: ['Iron'],
    baseStats: { hp: 220, attack: 60, defense: 65, intelligence: 40, wisdom: 45, speed: 60, manaPool: 60, mpRegen: 10 },
    moveIds: ['ironFist', 'sharpen'],
    growthGrades: { hp: 'A', attack: 'A', defense: 'B', intelligence: 'C', wisdom: 'B', speed: 'B', manaPool: 'C' },
    schedule: { offerLevels: [5, 8, 12, 16, 21], midLevel: 9, lateLevel: 17, signatureLevel: 14 },
    signatureMoveId: 'oathstrike',
    passiveIds: ['rallyingStandard'],
    masteredPassiveIds: ['clarionCall'],
  },
  gallant: {
    id: 'gallant',
    name: 'Gallant',
    types: ['Iron'],
    baseStats: { hp: 210, attack: 95, defense: 60, intelligence: 20, wisdom: 40, speed: 75, manaPool: 50, mpRegen: 10 },
    moveIds: ['heavyBlow', 'pinDown'],
    growthGrades: { hp: 'B', attack: 'B', defense: 'A', intelligence: 'D', wisdom: 'A', speed: 'A', manaPool: 'C' },
    schedule: { offerLevels: [5, 6, 12, 17, 21], midLevel: 9, lateLevel: 18, signatureLevel: 23 },
    signatureMoveId: 'fullTilt',
    passiveIds: ['breach'],
    masteredPassiveIds: ['shatterlance'],
  },
  // The first bundle hero (docs/constellation.md §4): outside the base three-a-type, in a run's
  // pools only while the Free Company is held. Storm-born; the Stormrunner path is the way back.
  scallywag: {
    id: 'scallywag',
    name: 'Scallywag',
    types: ['Iron'],
    baseStats: { hp: 210, attack: 95, defense: 50, intelligence: 25, wisdom: 40, speed: 80, manaPool: 50, mpRegen: 10 },
    moveIds: ['heavyBlow', 'pinDown'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'A', speed: 'A', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 12, 17, 21], midLevel: 9, lateLevel: 18, signatureLevel: 22 },
    signatureMoveId: 'broadside',
    passiveIds: ['broadside', 'broadsideFire'],
    masteredPassiveIds: ['grandBroadside', 'broadsideFire'],
  },

  // --- Mech ---
  forgewright: {
    id: 'forgewright',
    name: 'Clockwork',
    types: ['Mech'],
    baseStats: { hp: 230, attack: 60, defense: 70, intelligence: 45, wisdom: 40, speed: 55, manaPool: 50, mpRegen: 10 },
    // Spark Plug plants the mark and Piston Punch cashes it — the Conduct loop from the draft.
    moveIds: ['pistonPunch', 'kickstart'],
    growthGrades: { hp: 'B', attack: 'S', defense: 'A', intelligence: 'A', wisdom: 'C', speed: 'B', manaPool: 'E' },
    schedule: { offerLevels: [5, 8, 11, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 18 },
    signatureMoveId: 'overwind',
    passiveIds: ['boiler'],
    masteredPassiveIds: ['boilingPoint'],
  },
  steamColossus: {
    id: 'steamColossus',
    name: 'Bellows',
    types: ['Mech', 'Iron'],
    // The Burden (docs/innate-passives.md §4): Ironbound, and BURDEN_SURPLUS over the 550 for it — into the body, never the Speed.
    baseStats: { hp: 280, attack: 120, defense: 105, intelligence: 15, wisdom: 35, speed: 5, manaPool: 50, mpRegen: 10 },
    moveIds: ['cogBop', 'overclock'],
    unlock: 'starfall',
    growthGrades: { hp: 'S', attack: 'A', defense: 'S', intelligence: 'F', wisdom: 'S', speed: 'C', manaPool: 'D' },
    schedule: { offerLevels: [6, 10, 13, 19, 24], midLevel: 13, lateLevel: 22, signatureLevel: 22 },
    signatureMoveId: 'boilerBlow',
    passiveIds: ['ironbound'],
    masteredPassiveIds: ['ironMountain', 'ironMountainPressure'],
  },
  rex: {
    id: 'rex',
    name: 'Rex',
    types: ['Mech'],
    // The roster's top Attack, and unlike Bellows it gets there before the round is over: 110 at
    // Speed 70 against 105 at 5. It pays in every other column, and Speed grows S so the gap
    // between it and the things it eats only widens.
    baseStats: { hp: 220, attack: 100, defense: 55, intelligence: 15, wisdom: 35, speed: 70, manaPool: 55, mpRegen: 10 },
    // Spark Plug then Steam Vent: the spread cashes the mark and hits the partner beside it.
    moveIds: ['steamVent', 'overclock'],
    growthGrades: { hp: 'B', attack: 'A', defense: 'B', intelligence: 'F', wisdom: 'B', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [3, 7, 12, 17, 21], midLevel: 9, lateLevel: 18, signatureLevel: 23 },
    signatureMoveId: 'devour',
    passiveIds: ['tyrantsDue'],
    masteredPassiveIds: ['apexTyrant'],
  },
  // Free Company (docs/constellation.md §11 phase 6): the medic drone. The roster's Wisdom-85 body
  // on Mech's repair column, which nobody in the base three holds as a healer; Spark Plug is the
  // one attack — the mark is its job, not the hit.
  patch: {
    id: 'patch',
    name: 'Patch',
    types: ['Mech'],
    baseStats: { hp: 190, attack: 20, defense: 65, intelligence: 55, wisdom: 85, speed: 60, manaPool: 75, mpRegen: 10 },
    moveIds: ['sparkPlug', 'kickstart'],
    growthGrades: { hp: 'B', attack: 'F', defense: 'A', intelligence: 'C', wisdom: 'S', speed: 'B', manaPool: 'S' },
    schedule: { offerLevels: [5, 8, 10, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 16 },
    signatureMoveId: 'overhaul',
    passiveIds: ['upkeep'],
    masteredPassiveIds: ['upkeepPlus'],
  },

  // --- Beast ---
  packAlpha: {
    id: 'packAlpha',
    name: 'Fang',
    types: ['Beast'],
    baseStats: { hp: 200, attack: 90, defense: 55, intelligence: 20, wisdom: 50, speed: 80, manaPool: 55, mpRegen: 10 },
    moveIds: ['claw', 'howl'],
    growthGrades: { hp: 'A', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'B', speed: 'A', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 12, 17, 21], midLevel: 9, lateLevel: 18, signatureLevel: 15 },
    signatureMoveId: 'packCall',
    passiveIds: ['packHunter'],
    masteredPassiveIds: ['alphasCall', 'alphasCallFollow'],
  },
  ursa: {
    id: 'ursa',
    name: 'Ursa',
    types: ['Beast'],
    // The roster's top Attack on its second-slowest body: a bear. Provoke is the Stone off-type
    // the kit telegraphs — it draws the hit Thick Hide and Stoneheart both want.
    baseStats: { hp: 235, attack: 115, defense: 70, intelligence: 15, wisdom: 45, speed: 20, manaPool: 50, mpRegen: 10 },
    moveIds: ['claw', 'prowl'],
    growthGrades: { hp: 'S', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'A', speed: 'E', manaPool: 'A' },
    schedule: { offerLevels: [6, 8, 11, 19, 25], midLevel: 11, lateLevel: 21, signatureLevel: 24 },
    signatureMoveId: 'overbear',
    passiveIds: ['feast'],
    masteredPassiveIds: ['glut', 'glutRage'],
  },
  coil: {
    id: 'coil',
    name: 'Coil',
    types: ['Beast', 'Mind'],
    baseStats: { hp: 190, attack: 25, defense: 55, intelligence: 90, wisdom: 65, speed: 60, manaPool: 65, mpRegen: 10 },
    moveIds: ['psiBolt', 'lull'],
    growthGrades: { hp: 'S', attack: 'E', defense: 'A', intelligence: 'A', wisdom: 'A', speed: 'D', manaPool: 'B' },
    schedule: { offerLevels: [6, 10, 12, 19, 24], midLevel: 12, lateLevel: 22, signatureLevel: 16 },
    signatureMoveId: 'stranglehold',
    passiveIds: ['serpentsEye'],
    masteredPassiveIds: ['petrifyingStare'],
  },
  // Free Company: the vampire bat. The roster's top Speed on its thinnest body, Beast-born — the
  // Bleed column is what it feeds on, and the Shadow turn is a path, not the start.
  vex: {
    id: 'vex',
    name: 'Vex',
    types: ['Beast'],
    baseStats: { hp: 170, attack: 90, defense: 35, intelligence: 30, wisdom: 45, speed: 110, manaPool: 70, mpRegen: 10 },
    moveIds: ['claw', 'howl'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'S', defense: 'C', intelligence: 'F', wisdom: 'B', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 12, 18, 21], midLevel: 9, lateLevel: 19, signatureLevel: 19 },
    signatureMoveId: 'exsanguinate',
    passiveIds: ['sanguine'],
    masteredPassiveIds: ['hemophage', 'hemophageFrenzy'],
  },

  // --- Added 2026-09-27/28, per user direction; `unlock` marks the Starfall-only ones ---
  // The psychic jellyfish: Mind's attrition caster, every hit it lands taking a little Attack with it.
  drift: {
    id: 'drift',
    name: 'Drift',
    types: ['Mind'],
    baseStats: { hp: 200, attack: 20, defense: 50, intelligence: 90, wisdom: 80, speed: 45, manaPool: 65, mpRegen: 10 },
    moveIds: ['psiBolt', 'lull'],
    growthGrades: { hp: 'A', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'A', speed: 'C', manaPool: 'A' },
    schedule: { offerLevels: [5, 9, 11, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 18 },
    signatureMoveId: 'stingingBloom',
    passiveIds: ['nettle'],
    masteredPassiveIds: ['nettlestorm'],
  },
  // The igloo golem: Frost's wall, sheltering whoever stands beside it.
  rimehold: {
    id: 'rimehold',
    name: 'Igloo',
    types: ['Frost'],
    baseStats: { hp: 250, attack: 70, defense: 100, intelligence: 20, wisdom: 45, speed: 15, manaPool: 50, mpRegen: 10 },
    moveIds: ['iceShard', 'provoke'],
    unlock: 'starfall',
    growthGrades: { hp: 'S', attack: 'A', defense: 'A', intelligence: 'F', wisdom: 'A', speed: 'D', manaPool: 'A' },
    schedule: { offerLevels: [6, 10, 11, 19, 24], midLevel: 11, lateLevel: 21, signatureLevel: 23 },
    signatureMoveId: 'whiteout',
    passiveIds: ['shelter'],
    masteredPassiveIds: ['hearthwall'],
  },
  // The bell friar: Light's physical tank, every blow rung out as a mend for its partner.
  carillon: {
    id: 'carillon',
    name: 'Carillon',
    types: ['Light'],
    baseStats: { hp: 230, attack: 85, defense: 75, intelligence: 20, wisdom: 60, speed: 30, manaPool: 50, mpRegen: 10 },
    moveIds: ['holyStrike', 'bless'],
    unlock: 'starfall',
    growthGrades: { hp: 'S', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'A', speed: 'D', manaPool: 'B' },
    schedule: { offerLevels: [5, 8, 10, 17, 21], midLevel: 10, lateLevel: 19, signatureLevel: 22 },
    signatureMoveId: 'greatToll',
    passiveIds: ['onTheHour', 'onTheHourMana'],
    masteredPassiveIds: ['onTheHourPlus', 'onTheHourPlusMana'],
  },
  // The radiant stag: Light's second healer, arriving with a mend already on its partner.
  hart: {
    id: 'hart',
    name: 'Hart',
    types: ['Light'],
    baseStats: { hp: 200, attack: 40, defense: 45, intelligence: 55, wisdom: 85, speed: 65, manaPool: 60, mpRegen: 10 },
    moveIds: ['mend', 'glimmer'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'D', defense: 'C', intelligence: 'B', wisdom: 'S', speed: 'A', manaPool: 'B' },
    schedule: { offerLevels: [4, 8, 10, 17, 21], midLevel: 10, lateLevel: 19, signatureLevel: 15 },
    signatureMoveId: 'antlerCrown',
    passiveIds: ['hallowedStep'],
    masteredPassiveIds: ['springtide'],
  },
  // The phoenix: Fire's fast mender, and the one hero that will not stay down.
  ashwing: {
    id: 'ashwing',
    name: 'Ashwing',
    types: ['Fire'],
    baseStats: { hp: 190, attack: 25, defense: 45, intelligence: 85, wisdom: 70, speed: 80, manaPool: 55, mpRegen: 10 },
    moveIds: ['ember', 'mend'],
    growthGrades: { hp: 'A', attack: 'F', defense: 'C', intelligence: 'A', wisdom: 'A', speed: 'S', manaPool: 'B' },
    schedule: { offerLevels: [4, 8, 10, 17, 21], midLevel: 10, lateLevel: 19, signatureLevel: 18 },
    signatureMoveId: 'risingPyre',
    passiveIds: ['smoulder'],
    masteredPassiveIds: ['rebirth'],
  },
  // The river imp: Water's brawler, stronger every time the dish on its head is topped up.
  kappa: {
    id: 'kappa',
    name: 'Kappa',
    types: ['Water'],
    baseStats: { hp: 210, attack: 100, defense: 70, intelligence: 20, wisdom: 55, speed: 50, manaPool: 45, mpRegen: 10 },
    moveIds: ['undertow', 'refresh'],
    unlock: 'starfall',
    growthGrades: { hp: 'A', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'B' },
    schedule: { offerLevels: [5, 9, 11, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 15 },
    signatureMoveId: 'pullUnder',
    passiveIds: ['brimming'],
    masteredPassiveIds: ['bottomlessDish'],
  },
  // The woolly mammoth: Frost's slow heavy hitter, harder to stop every round it stays on its feet.
  tusk: {
    id: 'tusk',
    name: 'Tusk',
    types: ['Frost'],
    baseStats: { hp: 235, attack: 115, defense: 70, intelligence: 20, wisdom: 45, speed: 15, manaPool: 50, mpRegen: 10 },
    moveIds: ['iceShard', 'hoarfrostEdge'],
    unlock: 'starfall',
    growthGrades: { hp: 'S', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'D', manaPool: 'A' },
    schedule: { offerLevels: [6, 10, 11, 19, 25], midLevel: 11, lateLevel: 21, signatureLevel: 24 },
    signatureMoveId: 'mammothCharge',
    passiveIds: ['stampede'],
    masteredPassiveIds: ['glacialAdvance'],
  },
  // The court fool: Mind's chaos, its turn decided by the round (Motley's Trick, docs/wild-innates-and-events.md §1).
  // Five identical combat stats so no face is a dud roll, physical or magical; the roster's deepest
  // pool, because the price of whatever it rolled is the whole balance of the card.
  motley: {
    id: 'motley',
    name: 'Motley',
    types: ['Mind'],
    baseStats: { hp: 170, attack: 50, defense: 50, intelligence: 50, wisdom: 50, speed: 50, manaPool: 130, mpRegen: 10 },
    moveIds: ['motleysTrick', 'psiBolt'],
    unlock: 'starfall',
    growthGrades: { hp: 'C', attack: 'B', defense: 'B', intelligence: 'B', wisdom: 'B', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [5, 9, 11, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 15 },
    signatureMoveId: 'tragicomedy',
    passiveIds: ['motleysTrick'],
    masteredPassiveIds: ['motleysTrickMastered'],
  },
  // The living spellbook: Arcane's volley caster, every rune it lands wearing the target's guard thinner.
  folio: {
    id: 'folio',
    name: 'Folio',
    types: ['Arcane'],
    baseStats: { hp: 180, attack: 20, defense: 35, intelligence: 105, wisdom: 55, speed: 75, manaPool: 80, mpRegen: 10 },
    moveIds: ['magicBolt', 'focus'],
    unlock: 'starfall',
    growthGrades: { hp: 'A', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'B', speed: 'A', manaPool: 'A' },
    schedule: { offerLevels: [6, 8, 10, 17, 24], midLevel: 10, lateLevel: 22, signatureLevel: 19 },
    signatureMoveId: 'runeVolley',
    passiveIds: ['inscribe'],
    masteredPassiveIds: ['palimpsest'],
  },
  // The wandering samurai: Iron's first strike, the blade out of the scabbard before the far side moves.
  ronin: {
    id: 'ronin',
    name: 'Ronin',
    types: ['Iron'],
    baseStats: { hp: 210, attack: 105, defense: 50, intelligence: 20, wisdom: 45, speed: 70, manaPool: 50, mpRegen: 10 },
    moveIds: ['heavyBlow', 'sharpen'],
    unlock: 'starfall',
    growthGrades: { hp: 'A', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'B', speed: 'A', manaPool: 'B' },
    schedule: { offerLevels: [4, 8, 12, 17, 21], midLevel: 9, lateLevel: 18, signatureLevel: 19 },
    signatureMoveId: 'drawCut',
    passiveIds: ['iaido'],
    masteredPassiveIds: ['iaijutsu', 'iaijutsuEdge'],
  },
  // The gorilla: Beast's mid-speed bruiser, arriving with a chest-beat that takes the fight out of both foes.
  kong: {
    id: 'kong',
    name: 'Kong',
    types: ['Beast'],
    baseStats: { hp: 215, attack: 95, defense: 70, intelligence: 15, wisdom: 45, speed: 60, manaPool: 50, mpRegen: 10 },
    moveIds: ['claw', 'howl'],
    unlock: 'starfall',
    growthGrades: { hp: 'A', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'B' },
    schedule: { offerLevels: [7, 9, 11, 19, 25], midLevel: 10, lateLevel: 20, signatureLevel: 18 },
    signatureMoveId: 'groundPound',
    passiveIds: ['chestBeat'],
    masteredPassiveIds: ['thunderchest'],
  },
  // The mushroom folk: Nature's spore caster, every Poison it plants taking the edge off its victim.
  morel: {
    id: 'morel',
    name: 'Morel',
    types: ['Nature'],
    baseStats: { hp: 210, attack: 20, defense: 60, intelligence: 80, wisdom: 70, speed: 40, manaPool: 70, mpRegen: 10 },
    moveIds: ['toxicSpores', 'seedShot'],
    unlock: 'starfall',
    growthGrades: { hp: 'A', attack: 'F', defense: 'B', intelligence: 'A', wisdom: 'A', speed: 'C', manaPool: 'S' },
    schedule: { offerLevels: [6, 9, 11, 18, 24], midLevel: 10, lateLevel: 19, signatureLevel: 16 },
    signatureMoveId: 'sporestorm',
    passiveIds: ['sporefall'],
    masteredPassiveIds: ['sporefallPlus'],
  },
  // The granite pangolin: Stone's curl-and-charge tank, harder with every hit and swinging that hardness back.
  scree: {
    id: 'scree',
    name: 'Scree',
    types: ['Stone'],
    baseStats: { hp: 220, attack: 40, defense: 100, intelligence: 15, wisdom: 55, speed: 45, manaPool: 75, mpRegen: 10 },
    moveIds: ['bodyBlow', 'provoke'],
    unlock: 'starfall',
    growthGrades: { hp: 'S', attack: 'D', defense: 'S', intelligence: 'F', wisdom: 'A', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [8, 10, 11, 19, 25], midLevel: 11, lateLevel: 21, signatureLevel: 20 },
    signatureMoveId: 'rollout',
    passiveIds: ['curl'],
    masteredPassiveIds: ['hardball'],
  },
  // The sun-maned lion: Light's physical striker, its mane gilded by the gold the pact carries (Gilded Mane).
  aurum: {
    id: 'aurum',
    name: 'Aurum',
    types: ['Light'],
    baseStats: { hp: 190, attack: 105, defense: 50, intelligence: 20, wisdom: 45, speed: 85, manaPool: 55, mpRegen: 10 },
    moveIds: ['holyStrike', 'blind'],
    unlock: 'starfall',
    growthGrades: { hp: 'A', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'B', speed: 'A', manaPool: 'B' },
    schedule: { offerLevels: [5, 9, 11, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 19 },
    signatureMoveId: 'solarPounce',
    passiveIds: ['gildedMane'],
    masteredPassiveIds: ['gildedManeMastered'],
  },
  // The black cat: Shadow's fast striker, and whoever its path crosses comes off a little worse.
  jinx: {
    id: 'jinx',
    name: 'Jinx',
    types: ['Shadow'],
    baseStats: { hp: 180, attack: 85, defense: 40, intelligence: 20, wisdom: 50, speed: 105, manaPool: 70, mpRegen: 10 },
    moveIds: ['lieInWait', 'fadeStrike'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'A', defense: 'B', intelligence: 'F', wisdom: 'B', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [4, 7, 10, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 15 },
    signatureMoveId: 'crossedPath',
    passiveIds: ['badLuck'],
    masteredPassiveIds: ['calamity'],
  },
  // The kitsune: Spirit's fast caster, every ghost-fire volley leaving the target burning.
  kitsu: {
    id: 'kitsu',
    name: 'Kitsu',
    types: ['Spirit'],
    baseStats: { hp: 180, attack: 20, defense: 40, intelligence: 95, wisdom: 55, speed: 100, manaPool: 60, mpRegen: 10 },
    moveIds: ['wisp', 'torment'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'B', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [6, 8, 11, 17, 24], midLevel: 11, lateLevel: 19, signatureLevel: 18 },
    signatureMoveId: 'tailfireVolley',
    passiveIds: ['foxfire'],
    masteredPassiveIds: ['kitsunebi'],
  },
  // The fire-eater: Fire's fast caster, every flame it breathes fanning out across the whole far side.
  tinder: {
    id: 'tinder',
    name: 'Tinder',
    types: ['Fire'],
    baseStats: { hp: 185, attack: 20, defense: 35, intelligence: 90, wisdom: 50, speed: 105, manaPool: 65, mpRegen: 10 },
    moveIds: ['ember', 'stokeTheFlames'],
    unlock: 'starfall',
    growthGrades: { hp: 'A', attack: 'F', defense: 'C', intelligence: 'A', wisdom: 'B', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [4, 7, 12, 18, 21], midLevel: 9, lateLevel: 19, signatureLevel: 16 },
    signatureMoveId: 'grandFinale',
    passiveIds: ['fireBreather'],
    masteredPassiveIds: ['showstopper'],
  },
  // The seal-maiden: Water's Wisdom healer, and every Renew she grants washes something off.
  selkie: {
    id: 'selkie',
    name: 'Selkie',
    types: ['Water'],
    baseStats: { hp: 210, attack: 20, defense: 55, intelligence: 50, wisdom: 90, speed: 60, manaPool: 65, mpRegen: 10 },
    moveIds: ['refresh', 'splash'],
    growthGrades: { hp: 'A', attack: 'F', defense: 'A', intelligence: 'C', wisdom: 'S', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 10, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 14 },
    signatureMoveId: 'sealskinCloak',
    passiveIds: ['saltTears'],
    masteredPassiveIds: ['seaOfTears'],
  },
  // The snowy owl: Frost's fast magical striker, coming down harder on whatever it has frozen.
  hush: {
    id: 'hush',
    name: 'Hush',
    types: ['Frost'],
    baseStats: { hp: 190, attack: 20, defense: 45, intelligence: 95, wisdom: 50, speed: 95, manaPool: 55, mpRegen: 10 },
    moveIds: ['deepChill', 'frostBolt'],
    growthGrades: { hp: 'B', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'B', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [4, 8, 10, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 18 },
    signatureMoveId: 'silentDescent',
    passiveIds: ['silentWings'],
    masteredPassiveIds: ['moonlessGlide'],
  },
  // The lotus mystic: Nature's magical nuker, opening wider every time the water feeds it.
  lotus: {
    id: 'lotus',
    name: 'Lotus',
    types: ['Nature'],
    baseStats: { hp: 185, attack: 20, defense: 45, intelligence: 105, wisdom: 60, speed: 55, manaPool: 80, mpRegen: 10 },
    moveIds: ['seedShot', 'regrowth'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'F', defense: 'C', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'S' },
    schedule: { offerLevels: [6, 9, 11, 19, 24], midLevel: 11, lateLevel: 20, signatureLevel: 22 },
    signatureMoveId: 'petalfall',
    passiveIds: ['unfurl'],
    masteredPassiveIds: ['fullBloom'],
  },
  // The thunderhead giant: Storm's bulky caster, and every blow it soaks charges the storm it hurls back.
  nimbus: {
    id: 'nimbus',
    name: 'Nimbus',
    types: ['Storm'],
    baseStats: { hp: 240, attack: 15, defense: 55, intelligence: 85, wisdom: 65, speed: 30, manaPool: 60, mpRegen: 10 },
    moveIds: ['jolt', 'refresh'],
    growthGrades: { hp: 'S', attack: 'F', defense: 'A', intelligence: 'A', wisdom: 'A', speed: 'D', manaPool: 'A' },
    schedule: { offerLevels: [7, 10, 15, 19, 24], midLevel: 10, lateLevel: 21, signatureLevel: 18 },
    signatureMoveId: 'cloudburst',
    passiveIds: ['anvilCloud'],
    masteredPassiveIds: ['cumulonimbus'],
  },
  // The windcaller boy: Storm's support, the wind at his side's back and in the other side's face.
  kite: {
    id: 'kite',
    name: 'Kite',
    types: ['Storm'],
    baseStats: { hp: 190, attack: 25, defense: 45, intelligence: 60, wisdom: 75, speed: 105, manaPool: 50, mpRegen: 10 },
    moveIds: ['risingStatic', 'jolt'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'B', wisdom: 'A', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [6, 9, 11, 18, 24], midLevel: 10, lateLevel: 19, signatureLevel: 14 },
    signatureMoveId: 'stormkite',
    passiveIds: ['outpace'],
    masteredPassiveIds: ['outpacePlus'],
  },
  // The thunder weasel: Storm's pivot, in and out in a flash, and the static it leaves is its partner's to cash.
  raiju: {
    id: 'raiju',
    name: 'Raiju',
    types: ['Storm'],
    baseStats: { hp: 190, attack: 90, defense: 50, intelligence: 20, wisdom: 45, speed: 100, manaPool: 55, mpRegen: 10 },
    moveIds: ['thunderclap', 'risingStatic'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'A', defense: 'B', intelligence: 'F', wisdom: 'B', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 10, 17, 21], midLevel: 10, lateLevel: 18, signatureLevel: 20 },
    signatureMoveId: 'relayStrike',
    passiveIds: ['staticWake'],
    masteredPassiveIds: ['ballLightning'],
  },
  // The sand wyrm: Stone's mid-speed striker, coming up from under a foe where its armour does not reach.
  dune: {
    id: 'dune',
    name: 'Dune',
    types: ['Stone'],
    baseStats: { hp: 210, attack: 100, defense: 70, intelligence: 15, wisdom: 45, speed: 65, manaPool: 45, mpRegen: 10 },
    moveIds: ['rockToss', 'lieInWait'],
    unlock: 'starfall',
    growthGrades: { hp: 'A', attack: 'S', defense: 'A', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'B' },
    schedule: { offerLevels: [6, 9, 11, 18, 24], midLevel: 11, lateLevel: 20, signatureLevel: 19 },
    signatureMoveId: 'sandbreach',
    passiveIds: ['undermine'],
    masteredPassiveIds: ['sinkhole'],
  },
  // The stone shaman: Stone's warder, a fresh stone laid on his partner's guard every round.
  cairn: {
    id: 'cairn',
    name: 'Cairn',
    types: ['Stone'],
    baseStats: { hp: 200, attack: 20, defense: 90, intelligence: 60, wisdom: 75, speed: 35, manaPool: 70, mpRegen: 10 },
    moveIds: ['tremor', 'toughenUp'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'F', defense: 'S', intelligence: 'A', wisdom: 'A', speed: 'C', manaPool: 'A' },
    schedule: { offerLevels: [6, 9, 11, 18, 24], midLevel: 11, lateLevel: 21, signatureLevel: 19 },
    signatureMoveId: 'raiseTheCairn',
    passiveIds: ['waystone'],
    masteredPassiveIds: ['standingStones'],
  },
  // The bog troll: Shadow's bulk, slow and heavy, and knitting itself back together in the mire.
  murk: {
    id: 'murk',
    name: 'Murk',
    types: ['Shadow'],
    baseStats: { hp: 245, attack: 95, defense: 70, intelligence: 15, wisdom: 50, speed: 25, manaPool: 50, mpRegen: 10 },
    moveIds: ['hamstring', 'lieInWait'],
    growthGrades: { hp: 'S', attack: 'A', defense: 'A', intelligence: 'F', wisdom: 'A', speed: 'D', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 10, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 23 },
    signatureMoveId: 'bogslam',
    passiveIds: ['bogblood'],
    masteredPassiveIds: ['peatHeart'],
  },
  // The crow witch: Shadow's hexer, her crow pecking at whoever she has just cursed.
  rook: {
    id: 'rook',
    name: 'Rook',
    types: ['Shadow'],
    baseStats: { hp: 185, attack: 20, defense: 45, intelligence: 85, wisdom: 70, speed: 75, manaPool: 70, mpRegen: 10 },
    moveIds: ['umbraBolt', 'weaken'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'F', defense: 'C', intelligence: 'A', wisdom: 'A', speed: 'A', manaPool: 'S' },
    schedule: { offerLevels: [5, 9, 11, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 15 },
    signatureMoveId: 'evilEye',
    passiveIds: ['peckingCrow'],
    masteredPassiveIds: ['murderOfCrows'],
  },
  // The blind monk: Mind's first fist, answering every blow before the next one lands.
  koan: {
    id: 'koan',
    name: 'Koan',
    types: ['Mind'],
    baseStats: { hp: 200, attack: 90, defense: 55, intelligence: 20, wisdom: 70, speed: 70, manaPool: 45, mpRegen: 10 },
    moveIds: ['kiStrike', 'brainWard'],
    unlock: 'starfall',
    growthGrades: { hp: 'A', attack: 'A', defense: 'C', intelligence: 'F', wisdom: 'A', speed: 'S', manaPool: 'B' },
    schedule: { offerLevels: [6, 10, 11, 18, 24], midLevel: 11, lateLevel: 22, signatureLevel: 19 },
    signatureMoveId: 'foreseenBlow',
    passiveIds: ['foresight'],
    masteredPassiveIds: ['satori', 'satoriStrike'],
  },
  // The spellblade knight: Arcane's first physical attacker, every spell it casts loading the blade.
  thane: {
    id: 'thane',
    name: 'Thane',
    types: ['Arcane'],
    baseStats: { hp: 200, attack: 100, defense: 60, intelligence: 30, wisdom: 45, speed: 60, manaPool: 55, mpRegen: 10 },
    moveIds: ['runeslash', 'barrier'],
    growthGrades: { hp: 'A', attack: 'S', defense: 'B', intelligence: 'F', wisdom: 'B', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [4, 8, 10, 17, 21], midLevel: 10, lateLevel: 19, signatureLevel: 18 },
    signatureMoveId: 'runebreaker',
    passiveIds: ['etchedRunes'],
    masteredPassiveIds: ['runesAblaze'],
  },
  // The mimic chest: Arcane's bulk, and the glitter that makes every foe overspend.
  trove: {
    id: 'trove',
    name: 'Trove',
    types: ['Arcane'],
    baseStats: { hp: 230, attack: 75, defense: 85, intelligence: 20, wisdom: 70, speed: 25, manaPool: 45, mpRegen: 10 },
    moveIds: ['runeslash', 'provoke'],
    unlock: 'starfall',
    growthGrades: { hp: 'S', attack: 'A', defense: 'S', intelligence: 'F', wisdom: 'A', speed: 'E', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 11, 17, 21], midLevel: 11, lateLevel: 21, signatureLevel: 19 },
    signatureMoveId: 'mimicsMaw',
    passiveIds: ['glitteringHoard'],
    masteredPassiveIds: ['foolsGold'],
  },
  // The ancestor totem: Spirit's slow support, the carved faces guiding its partner's every blow.
  totem: {
    id: 'totem',
    name: 'Totem',
    types: ['Spirit'],
    baseStats: { hp: 230, attack: 20, defense: 70, intelligence: 50, wisdom: 85, speed: 20, manaPool: 75, mpRegen: 10 },
    moveIds: ['wisp', 'bless'],
    unlock: 'starfall',
    growthGrades: { hp: 'A', attack: 'F', defense: 'A', intelligence: 'B', wisdom: 'S', speed: 'D', manaPool: 'S' },
    schedule: { offerLevels: [6, 9, 11, 19, 24], midLevel: 11, lateLevel: 21, signatureLevel: 15 },
    signatureMoveId: 'ancestorsRise',
    passiveIds: ['ancestralGuidance'],
    masteredPassiveIds: ['councilOfElders'],
  },
  // The banshee: Spirit's wail, every Spirit hit she lands taking the fight out of both foes.
  keen: {
    id: 'keen',
    name: 'Keen',
    types: ['Spirit'],
    baseStats: { hp: 185, attack: 20, defense: 40, intelligence: 100, wisdom: 60, speed: 70, manaPool: 75, mpRegen: 10 },
    moveIds: ['wisp', 'torment'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'B', speed: 'B', manaPool: 'S' },
    schedule: { offerLevels: [5, 7, 10, 17, 21], midLevel: 10, lateLevel: 19, signatureLevel: 22 },
    signatureMoveId: 'lastKeen',
    passiveIds: ['deathWail'],
    masteredPassiveIds: ['graveChorus'],
  },
  // The magnet sorceress: Iron's first magical hero, charging both foes on the way in for the plate beside her to cash.
  ferra: {
    id: 'ferra',
    name: 'Ferra',
    types: ['Iron'],
    baseStats: { hp: 190, attack: 20, defense: 55, intelligence: 95, wisdom: 65, speed: 65, manaPool: 60, mpRegen: 10 },
    moveIds: ['jolt', 'ironSkin'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'A', speed: 'B', manaPool: 'A' },
    schedule: { offerLevels: [5, 9, 11, 17, 21], midLevel: 10, lateLevel: 20, signatureLevel: 19 },
    signatureMoveId: 'ferrousCrush',
    passiveIds: ['lodestone'],
    masteredPassiveIds: ['lodestorm', 'lodestormPull'],
  },
  // The calculating engine: Mech's slow magical caster, working the far side out a little more with every move it watches.
  abacus: {
    id: 'abacus',
    name: 'Abacus',
    types: ['Mech'],
    baseStats: { hp: 185, attack: 15, defense: 55, intelligence: 100, wisdom: 70, speed: 45, manaPool: 80, mpRegen: 10 },
    moveIds: ['backfire', 'distort'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'F', defense: 'B', intelligence: 'S', wisdom: 'A', speed: 'C', manaPool: 'S' },
    schedule: { offerLevels: [6, 8, 11, 19, 24], midLevel: 11, lateLevel: 21, signatureLevel: 20 },
    signatureMoveId: 'foregoneConclusion',
    passiveIds: ['tally'],
    masteredPassiveIds: ['calculus'],
  },
  // The clockwork hummingbird: Mech's fastest body, every dart it lands winding up the next.
  whirr: {
    id: 'whirr',
    name: 'Whirr',
    types: ['Mech'],
    baseStats: { hp: 180, attack: 90, defense: 40, intelligence: 20, wisdom: 45, speed: 110, manaPool: 65, mpRegen: 10 },
    moveIds: ['pistonPunch', 'overclock'],
    unlock: 'starfall',
    growthGrades: { hp: 'B', attack: 'S', defense: 'C', intelligence: 'F', wisdom: 'B', speed: 'S', manaPool: 'A' },
    schedule: { offerLevels: [4, 7, 11, 17, 21], midLevel: 9, lateLevel: 18, signatureLevel: 16 },
    signatureMoveId: 'wingbeatBarrage',
    passiveIds: ['flit'],
    masteredPassiveIds: ['blur'],
  },
  // The capybara: Beast's support, the calm friend everyone sits on, and nobody stays angry near it.
  mellow: {
    id: 'mellow',
    name: 'Mellow',
    types: ['Beast'],
    baseStats: { hp: 240, attack: 40, defense: 70, intelligence: 30, wisdom: 80, speed: 35, manaPool: 55, mpRegen: 10 },
    moveIds: ['mudBall', 'howl'],
    unlock: 'starfall',
    growthGrades: { hp: 'S', attack: 'C', defense: 'A', intelligence: 'E', wisdom: 'S', speed: 'D', manaPool: 'A' },
    schedule: { offerLevels: [5, 8, 10, 17, 22], midLevel: 10, lateLevel: 22, signatureLevel: 15 },
    signatureMoveId: 'allAboard',
    passiveIds: ['unbothered'],
    masteredPassiveIds: ['serene'],
  },
};
