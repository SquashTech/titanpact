// The signature moves (docs/mastery.md §5): one authored move per hero, a GUARANTEED learn at the
// hero's own `schedule.signatureLevel` (2026-09-24, per user direction — it was the tenth Mastery
// pip's, which most heroes never reached) — the move that says what the hero IS in one button. Riptide's Lizard Rush is the template:
// a solid hit plus the thing the hero does, never a bare nuke. Authored at the hero's innate
// primary type, so STAB is guaranteed without `typeFollowsUser`, and priced Late (45+, most 55;
// a second target or a second rider pays 60).
//
// The exclusivity rule, the Class-move rule's sibling (test/mastery.test.ts): a signature is in no
// type pool, no Mentor or Tutor pool, no graft's learnableMoveIds and no path's unlocksMoveIds —
// and carries no `tier`, since a tier gates rolled offers and a signature is never rolled. `signatureMoves`
// fold into data/moves.ts; `HeroDefinition.signatureMoveId` is the pointer.
//
// DRAFT (2026-09-14, Mastery phase 4): every entry but Lizard Rush is a first pass for review.
// The rule each one was written to: the hit is sized like the type's Late moves, the verb is the
// hero's own — the thing its Evolution paths keep circling — and no two signatures share a verb.

import type { MoveDefinition } from '../engine/content';

const authoredSignatures: Record<string, MoveDefinition> = {
  // --- Fire ---
  // Cinder: the salamander. Drives the spear in white-hot; what it hits catches, and the shield
  // comes up harder.
  hammerbrand: {
    id: 'hammerbrand',
    name: 'Emberlance',
    type: 'Fire',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    statusApplication: { statusId: 'Burn', magnitude: 2, target: 'moveTarget' },
    statDeltas: [{ stat: 'defense', amount: 20 }],
    statDeltaTarget: 'self',
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Crimson: the fire-setter. Everything she lit, at once.
  flashover: {
    id: 'flashover',
    name: 'Flashover',
    type: 'Fire',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    conditionalPower: { requiresTargetStatus: 'Burn', multiplier: 2, consumesStatus: true },
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Brimstone: the caster that stays. Burns them and warms itself on it.
  hearthfire: {
    id: 'hearthfire',
    name: 'Hearthfire',
    type: 'Fire',
    category: 'magical',
    kind: 'damage',
    basePower: 65,
    drainPercent: 0.5,
    statusApplication: { statusId: 'Burn', magnitude: 2, target: 'moveTarget' },
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Drake: the breath it woke up holding. The only physical Fire move that takes both foes, so an
  // Ambush from Slumber lands on each of them.
  wyrmfire: {
    id: 'wyrmfire',
    name: 'Wyrmfire',
    type: 'Fire',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    statusApplication: { statusId: 'Burn', magnitude: 1, target: 'moveTarget' },
    manaCost: 70,
    priority: 0,
    target: 'bothEnemies',
  },

  // --- Water ---
  // Riptide. It was Tidecaller's clause-5 grant and a Water pool move until 2026-09-14 (Mastery
  // phase 3, per user direction); Tidecaller grants Maelstrom now, and every Riptide learns this
  // at its signatureLevel.
  lizardRush: {
    id: 'lizardRush',
    name: 'Lizard Rush',
    type: 'Water',
    category: 'physical',
    kind: 'damage',
    basePower: 75,
    statusApplication: { statusId: 'Renew', magnitude: 2, target: 'bothAllies' },
    manaCost: 45,
    priority: 0,
    target: 'singleEnemy',
  },
  // Pincer: the slow crab. Closes, and does not open.
  vise: {
    id: 'vise',
    name: 'Vise',
    type: 'Water',
    category: 'physical',
    kind: 'damage',
    basePower: 85,
    statDeltas: [{ stat: 'speed', amount: -20 }],
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Leviathan: the whole deep comes up behind the strike, and stays up.
  deepsurge: {
    id: 'deepsurge',
    name: 'Deepsurge',
    type: 'Water',
    category: 'magical',
    kind: 'damage',
    basePower: 85,
    statusApplication: { statusId: 'WaterForce', magnitude: 25, target: 'self' },
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Nautilus: the whole ink sac at once, then gone behind it. Both foes flinch; the retreat fires
  // Ink on the way out. Gated three ways because a double flinch is a free turn: the round it comes
  // in, once a fight, and every drop of Mana it holds.
  inkBlast: {
    id: 'inkBlast',
    name: 'Ink Blast',
    type: 'Water',
    category: 'magical',
    kind: 'buff',
    statDeltas: [],
    statusApplication: { statusId: 'Daze', target: 'moveTarget' },
    manaCost: 45,
    manaCostAll: true,
    oncePerFight: true,
    firstTurnOnly: true,
    switchesUserOut: true,
    priority: 2,
    target: 'bothEnemies',
  },

  // --- Frost ---
  // Flurry: cold that does not wait to be let in.
  hoarfrost: {
    id: 'hoarfrost',
    name: 'Hoarfrost',
    type: 'Frost',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    statusApplication: { statusId: 'Freeze', target: 'moveTarget' },
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Rime: the thrower. Two throws, no pause between them.
  icefall: {
    id: 'icefall',
    name: 'Icefall',
    type: 'Frost',
    category: 'physical',
    kind: 'damage',
    basePower: 45,
    hitCount: 2,
    statusApplication: { statusId: 'Freeze', target: 'moveTarget', chance: 0.25 },
    manaCost: 50,
    priority: 0,
    target: 'singleEnemy',
  },
  // Floe: everything it is, arriving slowly.
  coldMass: {
    id: 'coldMass',
    name: 'Cold Mass',
    type: 'Frost',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    offStatOverride: 'defense',
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },

  // --- Storm ---
  // Squall: the ranger. Arrives before the weather does, on both of them.
  galeVolley: {
    id: 'galeVolley',
    name: 'Gale Volley',
    type: 'Storm',
    category: 'physical',
    kind: 'damage',
    basePower: 55,
    manaCost: 60,
    priority: 1,
    target: 'bothEnemies',
  },
  // Tempest: one bolt, both of them, and the charge stays in.
  twinbolt: {
    id: 'twinbolt',
    name: 'Twinbolt',
    type: 'Storm',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    statusApplication: { statusId: 'Conduct', target: 'moveTarget' },
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
  },
  // Skyshear: the hunting dive — down out of the sky before they have looked up.
  stoop: {
    id: 'stoop',
    name: 'Stoop',
    type: 'Storm',
    category: 'magical',
    kind: 'damage',
    basePower: 65,
    statusApplication: { statusId: 'Conduct', target: 'moveTarget' },
    manaCost: 60,
    priority: 1,
    target: 'singleEnemy',
  },

  // --- Stone ---
  // Crag: the ground goes out from under both of them.
  groundsplit: {
    id: 'groundsplit',
    name: 'Groundsplit',
    type: 'Stone',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    statDeltas: [{ stat: 'speed', amount: -15 }],
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
  },
  // Sentinel: stands in front of both, and says so.
  roostGuard: {
    id: 'roostGuard',
    name: 'Roost Guard',
    type: 'Stone',
    category: 'physical',
    kind: 'buff',
    statDeltas: [{ stat: 'defense', amount: 30 }],
    statDeltaTarget: 'bothAllies',
    statusApplication: { statusId: 'Provoke', duration: 1, target: 'self' },
    manaCost: 55,
    priority: 0,
    target: 'bothAllies',
  },
  // Petra: throws the ground up under both of them, and what comes down is in reach of the staff.
  upheaval: {
    id: 'upheaval',
    name: 'Upheaval',
    type: 'Stone',
    category: 'magical',
    kind: 'damage',
    basePower: 65,
    statDeltas: [{ stat: 'attack', amount: 20 }],
    statDeltaTarget: 'self',
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
  },

  // --- Nature ---
  // Sylva: everything on the far side rots, everything on this side grows.
  blightbloom: {
    id: 'blightbloom',
    name: 'Blightbloom',
    type: 'Nature',
    category: 'magical',
    kind: 'damage',
    basePower: 50,
    statusApplication: [
      { statusId: 'Poison', magnitude: 10, duration: 3, target: 'moveTarget' },
      { statusId: 'Renew', magnitude: 2, target: 'bothAllies' },
    ],
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
  },
  // Mordrax: opens them up and puts down roots in the gap.
  rootrend: {
    id: 'rootrend',
    name: 'Rootrend',
    type: 'Nature',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    statusApplication: [
      { statusId: 'Bleed', target: 'moveTarget' },
      { statusId: 'Renew', magnitude: 2, target: 'self' },
    ],
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Hollowbark: slow, heavy, and it does not stop coming.
  deadfall: {
    id: 'deadfall',
    name: 'Deadfall',
    type: 'Nature',
    category: 'physical',
    kind: 'damage',
    basePower: 100,
    manaCost: 50,
    priority: -1,
    target: 'singleEnemy',
  },
  // Tixwick: the strike the stance was for — first, and twice as hard on what is already failing.
  guillotine: {
    id: 'guillotine',
    name: 'Guillotine',
    type: 'Nature',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    statusApplication: { statusId: 'Bleed', target: 'moveTarget' },
    conditionalPower: { requiresTargetHpBelow: 0.5, multiplier: 2 },
    manaCost: 55,
    priority: 1,
    target: 'singleEnemy',
  },

  // --- Light ---
  // Solace: morning for the whole side.
  daybreak: {
    id: 'daybreak',
    name: 'Daybreak',
    type: 'Light',
    category: 'magical',
    kind: 'heal',
    healPower: 60,
    cleanses: true,
    statusApplication: { statusId: 'Renew', magnitude: 2, target: 'bothAllies' },
    manaCost: 60,
    priority: 0,
    target: 'bothAllies',
  },
  // Aegis: strikes, and the shield goes up for both.
  bulwarkStrike: {
    id: 'bulwarkStrike',
    name: 'Bulwark Strike',
    type: 'Light',
    category: 'physical',
    kind: 'damage',
    basePower: 70,
    statDeltas: [{ stat: 'defense', amount: 20 }],
    statDeltaTarget: 'bothAllies',
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Empyrean: comes down out of the noon sky, and the ground where it lands is holy.
  sundive: {
    id: 'sundive',
    name: 'Sundive',
    type: 'Light',
    category: 'magical',
    kind: 'damage',
    basePower: 80,
    fieldEffectApplication: 'sanctuary',
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },

  // --- Shadow ---
  // Widow: one bite, two things in it.
  widowbite: {
    id: 'widowbite',
    name: 'Widowbite',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 75,
    statusApplication: [
      { statusId: 'Bleed', target: 'moveTarget' },
      { statusId: 'Poison', magnitude: 15, duration: 3, target: 'moveTarget' },
    ],
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
  },
  // Marrow: takes the marrow out of them and keeps it.
  deathdrink: {
    id: 'deathdrink',
    name: 'Deathdrink',
    type: 'Shadow',
    category: 'magical',
    kind: 'damage',
    basePower: 75,
    drainPercent: 1,
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Nightshade: the one you do not see coming.
  nightfall: {
    id: 'nightfall',
    name: 'Nightfall',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 85,
    critChance: 0.5,
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },

  // --- Arcane ---
  // Glyph: overwrites what both of them knew.
  erasure: {
    id: 'erasure',
    name: 'Erasure',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 65,
    statDeltas: [{ stat: 'intelligence', amount: -20 }],
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
  },
  // Zenith: each cast sets the figure higher for the next.
  culmination: {
    id: 'culmination',
    name: 'Culmination',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    statDeltas: [{ stat: 'intelligence', amount: 20 }],
    statDeltaTarget: 'self',
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Pixie: the whole side, faster and fuller, and the air singing. The support signature — the
  // one buff in the set — priced 60 for its second rider, as Roost Guard's shape is.
  fairyRing: {
    id: 'fairyRing',
    name: 'Fairy Ring',
    type: 'Arcane',
    category: 'magical',
    kind: 'buff',
    manaGrant: 50,
    statDeltas: [{ stat: 'speed', amount: 20 }],
    fieldEffectApplication: 'surgingMagic',
    manaCost: 60,
    priority: 0,
    target: 'bothAllies',
  },

  // --- Mind ---
  // Reverie: strikes, and the pair it threads together runs hotter on both axes — the mixed
  // attacker's verb. It was the buff alone at 50, which Oathstrike beat with a hit attached.
  mindlink: {
    id: 'mindlink',
    name: 'Mindlink',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    statDeltas: [
      { stat: 'attack', amount: 15 },
      { stat: 'intelligence', amount: 15 },
    ],
    statDeltaTarget: 'bothAllies',
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Lucius: empties the room behind their eyes.
  hollowing: {
    id: 'hollowing',
    name: 'Hollowing',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 80,
    statDeltas: [{ stat: 'wisdom', amount: -30 }],
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Trance: they were asleep before they knew they were tired.
  sandman: {
    id: 'sandman',
    name: 'Sandman',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 65,
    statusApplication: { statusId: 'Daze', target: 'moveTarget', chance: 0.5 },
    manaCost: 55,
    priority: 1,
    target: 'singleEnemy',
  },

  // --- Spirit ---
  // Revenant: takes it back, and shares it.
  soulTithe: {
    id: 'soulTithe',
    name: 'Soul Tithe',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 65,
    drainPercent: 0.5,
    statusApplication: { statusId: 'Renew', magnitude: 2, target: 'bothAllies' },
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
  },
  // Sorrow: a wail that takes the strength out of both of them.
  dirgeOfAsh: {
    id: 'dirgeOfAsh',
    name: 'Dirge of Ash',
    type: 'Spirit',
    category: 'physical',
    kind: 'damage',
    basePower: 65,
    statDeltas: [{ stat: 'attack', amount: -20 }],
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
  },
  // Dread: spreads its wings, and everything aimed at the pair finds feathers. The Shield reads
  // the caster's Defense (docs/shield.md), which is the one stat this line spiked.
  nevermore: {
    id: 'nevermore',
    name: 'Nevermore',
    type: 'Spirit',
    category: 'magical',
    kind: 'buff',
    statusApplication: [
      { statusId: 'Provoke', duration: 1, target: 'self' },
      { statusId: 'Shield', magnitude: 60, target: 'self' },
    ],
    manaCost: 55,
    priority: 1,
    target: 'self',
  },

  // --- Iron ---
  // Warden: holds the line, and hits from it.
  wallStrike: {
    id: 'wallStrike',
    name: 'Wall Strike',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 75,
    statusApplication: { statusId: 'Provoke', duration: 1, target: 'self' },
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Valor: a blow the whole line follows.
  oathstrike: {
    id: 'oathstrike',
    name: 'Oathstrike',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 70,
    statDeltas: [{ stat: 'attack', amount: 15 }],
    statDeltaTarget: 'bothAllies',
    manaCost: 50,
    priority: 0,
    target: 'singleEnemy',
  },
  // Gallant: first in, hardest in, and it hurts to stop.
  fullTilt: {
    id: 'fullTilt',
    name: 'Full Tilt',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 95,
    recoilPercent: 0.25,
    manaCost: 60,
    priority: 1,
    target: 'singleEnemy',
  },
  // Scallywag: no quarter, no guard.
  broadside: {
    id: 'broadside',
    name: 'Broadside',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 95,
    statDeltas: [{ stat: 'defense', amount: -20 }],
    statDeltaTarget: 'self',
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },

  // --- Mech ---
  // Clockwork: winds tighter every time.
  overwind: {
    id: 'overwind',
    name: 'Overwind',
    type: 'Mech',
    category: 'physical',
    kind: 'damage',
    basePower: 60,
    basePowerGainOnUse: { amount: 25, max: 140 },
    manaCost: 50,
    priority: 0,
    target: 'singleEnemy',
  },
  // Bellows: vents the whole boiler through the fist.
  boilerBlow: {
    id: 'boilerBlow',
    name: 'Boiler Blow',
    type: 'Mech',
    category: 'physical',
    kind: 'damage',
    basePower: 100,
    statusApplication: [
      { statusId: 'Burn', magnitude: 2, target: 'moveTarget' },
      { statusId: 'Burn', magnitude: 1, target: 'self' },
    ],
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Rex: bites down and keeps what it takes. Mech's first drain; the boiler runs on it.
  devour: {
    id: 'devour',
    name: 'Devour',
    type: 'Mech',
    category: 'physical',
    kind: 'damage',
    basePower: 90,
    drainPercent: 0.5,
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Patch: strips it down and builds it back.
  overhaul: {
    id: 'overhaul',
    name: 'Overhaul',
    type: 'Mech',
    category: 'magical',
    kind: 'heal',
    healPower: 75,
    statDeltas: [{ stat: 'defense', amount: 20 }],
    manaCost: 55,
    priority: 0,
    target: 'singleAlly',
  },

  // --- Beast ---
  // Fang: bites, and the pack comes in behind it.
  packCall: {
    id: 'packCall',
    name: 'Pack Call',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 65,
    statDeltas: [{ stat: 'speed', amount: 15 }],
    statDeltaTarget: 'bothAllies',
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Ursa: the whole weight of it, once.
  overbear: {
    id: 'overbear',
    name: 'Overbear',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 105,
    recoilPercent: 0.25,
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
  },
  // Coil: tightens until nothing about them works right.
  stranglehold: {
    id: 'stranglehold',
    name: 'Stranglehold',
    type: 'Beast',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    statDeltas: [
      { stat: 'speed', amount: -20 },
      { stat: 'defense', amount: -20 },
    ],
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Vex: opens them and drinks what comes out.
  exsanguinate: {
    id: 'exsanguinate',
    name: 'Exsanguinate',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 70,
    drainPercent: 0.5,
    statusApplication: { statusId: 'Bleed', target: 'moveTarget' },
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
  },

  // --- Starfall ---
  // Drift: every tendril at once.
  stingingBloom: {
    id: 'stingingBloom',
    name: 'Stinging Bloom',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    statDeltas: [{ stat: 'attack', amount: -10 }],
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
  },
  // Igloo: the whole house comes down, and the walls stay up.
  whiteout: {
    id: 'whiteout',
    name: 'Whiteout',
    type: 'Frost',
    category: 'physical',
    kind: 'damage',
    basePower: 85,
    statusApplication: { statusId: 'Shield', magnitude: 40, target: 'self' },
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Carillon: the great bell, swung.
  greatToll: {
    id: 'greatToll',
    name: 'Great Toll',
    type: 'Light',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    manaCost: 70,
    priority: 0,
    target: 'bothEnemies',
  },
  // Hart: the antlers lit.
  antlerCrown: {
    id: 'antlerCrown',
    name: 'Antler Crown',
    type: 'Light',
    category: 'magical',
    kind: 'heal',
    healPower: 45,
    statusApplication: { statusId: 'Renew', magnitude: 2, target: 'bothAllies' },
    manaCost: 55,
    priority: 0,
    target: 'bothAllies',
  },
  // Ashwing: the dive out of its own fire.
  risingPyre: {
    id: 'risingPyre',
    name: 'Rising Pyre',
    type: 'Fire',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    statusApplication: { statusId: 'Renew', magnitude: 2, target: 'self' },
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Kappa: drags them under and drinks what the river gives back.
  pullUnder: {
    id: 'pullUnder',
    name: 'Pull Under',
    type: 'Water',
    category: 'physical',
    kind: 'damage',
    basePower: 75,
    drainPercent: 0.5,
    manaCost: 50,
    priority: 0,
    target: 'singleEnemy',
  },
  // Tusk: the whole herd's weight, through both of them.
  mammothCharge: {
    id: 'mammothCharge',
    name: 'Mammoth Charge',
    type: 'Frost',
    category: 'physical',
    kind: 'damage',
    basePower: 90,
    manaCost: 75,
    priority: 0,
    target: 'bothEnemies',
  },
  // Motley: both faces of the mask at once.
  tragicomedy: {
    id: 'tragicomedy',
    name: 'Tragicomedy',
    type: 'Mind',
    category: 'magical',
    kind: 'damage',
    basePower: 55,
    statDeltas: [
      { stat: 'attack', amount: -15 },
      { stat: 'intelligence', amount: -15 },
    ],
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
  },
  // Folio: every page at once.
  runeVolley: {
    id: 'runeVolley',
    name: 'Rune Volley',
    type: 'Arcane',
    category: 'magical',
    kind: 'damage',
    basePower: 30,
    hitCount: 3,
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
  },
  // Ronin: the draw.
  drawCut: {
    id: 'drawCut',
    name: 'Draw Cut',
    type: 'Iron',
    category: 'physical',
    kind: 'damage',
    basePower: 75,
    manaCost: 55,
    priority: 2,
    target: 'singleEnemy',
  },
  // Kong: both fists into the ground.
  groundPound: {
    id: 'groundPound',
    name: 'Ground Pound',
    type: 'Beast',
    category: 'physical',
    kind: 'damage',
    basePower: 65,
    statDeltas: [{ stat: 'attack', amount: -10 }],
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
  },
  // Morel: the whole cap opens.
  sporestorm: {
    id: 'sporestorm',
    name: 'Sporestorm',
    type: 'Nature',
    category: 'magical',
    kind: 'damage',
    basePower: 55,
    statusApplication: { statusId: 'Poison', magnitude: 10, duration: 3, target: 'moveTarget' },
    statDeltas: [{ stat: 'speed', amount: -10 }],
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
  },
  // Scree: curled, and coming.
  rollout: {
    id: 'rollout',
    name: 'Rollout',
    type: 'Stone',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    offStatOverride: 'defense',
    statDeltas: [{ stat: 'defense', amount: 20 }],
    statDeltaTarget: 'self',
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
  },
  // Aurum: the noon sun, landing on one of them.
  solarPounce: {
    id: 'solarPounce',
    name: 'Solar Pounce',
    type: 'Light',
    category: 'physical',
    kind: 'damage',
    basePower: 85,
    statusApplication: { statusId: 'Daze', chance: 0.5, target: 'moveTarget' },
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Jinx: whatever it crosses, something goes wrong.
  crossedPath: {
    id: 'crossedPath',
    name: 'Crossed Path',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 70,
    randomStatusApplication: [
      { statusId: 'Bleed', target: 'moveTarget' },
      { statusId: 'Poison', magnitude: 15, duration: 3, target: 'moveTarget' },
      { statusId: 'Daze', target: 'moveTarget' },
      { statusId: 'Haunt', target: 'moveTarget' },
    ],
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Kitsu: every tail at once.
  tailfireVolley: {
    id: 'tailfireVolley',
    name: 'Tailfire Volley',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 35,
    hitCount: 2,
    manaCost: 65,
    priority: 0,
    target: 'bothEnemies',
  },
  // Tinder: the last trick of the act, and the biggest breath.
  grandFinale: {
    id: 'grandFinale',
    name: 'Grand Finale',
    type: 'Fire',
    category: 'magical',
    kind: 'damage',
    basePower: 55,
    statusApplication: { statusId: 'Burn', magnitude: 1, target: 'moveTarget' },
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
  },
  // Selkie: the pelt, thrown over someone else.
  sealskinCloak: {
    id: 'sealskinCloak',
    name: 'Sealskin Cloak',
    type: 'Water',
    category: 'magical',
    kind: 'heal',
    healPower: 70,
    statusApplication: { statusId: 'Renew', magnitude: 3, target: 'moveTarget' },
    manaCost: 50,
    priority: 0,
    target: 'singleAlly',
  },
  // Hush: down out of the dark without a sound.
  silentDescent: {
    id: 'silentDescent',
    name: 'Silent Descent',
    type: 'Frost',
    category: 'magical',
    kind: 'damage',
    basePower: 65,
    statusApplication: { statusId: 'Freeze', chance: 0.5, target: 'moveTarget' },
    manaCost: 55,
    priority: 1,
    target: 'singleEnemy',
  },
  // Lotus: every petal at once.
  petalfall: {
    id: 'petalfall',
    name: 'Petalfall',
    type: 'Nature',
    category: 'magical',
    kind: 'damage',
    basePower: 90,
    statusApplication: { statusId: 'Renew', magnitude: 2, target: 'self' },
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
  },
  // Nimbus: the lightning falls on their side and the rain on its own.
  cloudburst: {
    id: 'cloudburst',
    name: 'Cloudburst',
    type: 'Storm',
    category: 'magical',
    kind: 'damage',
    basePower: 55,
    statusApplication: [
      { statusId: 'Conduct', target: 'moveTarget' },
      { statusId: 'Renew', magnitude: 2, target: 'bothAllies' },
    ],
    manaCost: 65,
    priority: 0,
    target: 'bothEnemies',
  },
  // Kite: flies the kite up into the storm and lets the string go.
  stormkite: {
    id: 'stormkite',
    name: 'Stormkite',
    type: 'Storm',
    category: 'magical',
    kind: 'buff',
    statDeltas: [{ stat: 'speed', amount: -20 }],
    statusApplication: { statusId: 'Conduct', target: 'moveTarget' },
    manaCost: 45,
    priority: 0,
    target: 'bothEnemies',
  },
  // Raiju: the strike, the mark, and the hand-off.
  relayStrike: {
    id: 'relayStrike',
    name: 'Relay Strike',
    type: 'Storm',
    category: 'physical',
    kind: 'damage',
    basePower: 65,
    statusApplication: { statusId: 'Conduct', target: 'moveTarget' },
    switchesUserOut: true,
    manaCost: 50,
    priority: 0,
    target: 'singleEnemy',
  },
  // Dune: up through the sand under one foe.
  sandbreach: {
    id: 'sandbreach',
    name: 'Sandbreach',
    type: 'Stone',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    manaCost: 60,
    priority: 1,
    target: 'singleEnemy',
  },
  // Cairn: the stone laid on the pile, and the pile standing over both of them.
  raiseTheCairn: {
    id: 'raiseTheCairn',
    name: 'Raise the Cairn',
    type: 'Stone',
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    statusApplication: { statusId: 'Shield', magnitude: 40, target: 'bothAllies' },
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
  },
  // Murk: the whole bog, on top of one of them.
  bogslam: {
    id: 'bogslam',
    name: 'Bogslam',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 90,
    statDeltas: [
      { stat: 'attack', amount: -20 },
      { stat: 'speed', amount: -20 },
    ],
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
  },
  // Rook: the witch looks at you, and the crow does too.
  evilEye: {
    id: 'evilEye',
    name: 'Evil Eye',
    type: 'Shadow',
    category: 'magical',
    kind: 'damage',
    basePower: 60,
    statDeltas: [
      { stat: 'attack', amount: -20 },
      { stat: 'intelligence', amount: -20 },
    ],
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Koan: the blow already answered, and the guard already up.
  foreseenBlow: {
    id: 'foreseenBlow',
    name: 'Foreseen Blow',
    type: 'Mind',
    category: 'physical',
    kind: 'damage',
    basePower: 70,
    statusApplication: { statusId: 'Shield', magnitude: 30, target: 'self' },
    manaCost: 60,
    priority: 1,
    target: 'singleEnemy',
  },
  // Thane: the rune that breaks the guard it lands on.
  runebreaker: {
    id: 'runebreaker',
    name: 'Runebreaker',
    type: 'Arcane',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    statDeltas: [{ stat: 'defense', amount: -20 }],
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Trove: the lid springs.
  mimicsMaw: {
    id: 'mimicsMaw',
    name: "Mimic's Maw",
    type: 'Arcane',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    drainPercent: 0.3,
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Totem: every face on the pole wakes at once.
  ancestorsRise: {
    id: 'ancestorsRise',
    name: 'Ancestors Rise',
    type: 'Spirit',
    category: 'magical',
    kind: 'buff',
    statDeltas: [
      { stat: 'attack', amount: 25 },
      { stat: 'intelligence', amount: 25 },
    ],
    statusApplication: { statusId: 'Renew', magnitude: 2, target: 'moveTarget' },
    manaCost: 60,
    priority: 0,
    target: 'bothAllies',
  },
  // Keen: the keen for the dead, sung over the living.
  lastKeen: {
    id: 'lastKeen',
    name: 'Last Keen',
    type: 'Spirit',
    category: 'magical',
    kind: 'damage',
    basePower: 65,
    statDeltas: [
      { stat: 'attack', amount: -15 },
      { stat: 'intelligence', amount: -15 },
    ],
    manaCost: 65,
    priority: 0,
    target: 'bothEnemies',
  },
  // Ferra: every scrap of metal on the foe, pulled in at once.
  ferrousCrush: {
    id: 'ferrousCrush',
    name: 'Ferrous Crush',
    type: 'Iron',
    category: 'magical',
    kind: 'damage',
    basePower: 80,
    conditionalPower: { requiresTargetStatus: 'Shield', multiplier: 2 },
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Abacus: the answer, already on the page.
  foregoneConclusion: {
    id: 'foregoneConclusion',
    name: 'Foregone Conclusion',
    type: 'Mech',
    category: 'magical',
    kind: 'damage',
    basePower: 75,
    conditionalPower: { requiresTargetStatReduction: true, multiplier: 1.5 },
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
  },
  // Whirr: too many wingbeats to count.
  wingbeatBarrage: {
    id: 'wingbeatBarrage',
    name: 'Wingbeat Barrage',
    type: 'Mech',
    category: 'physical',
    kind: 'damage',
    basePower: 25,
    hitCount: 3,
    manaCost: 55,
    priority: 1,
    target: 'singleEnemy',
  },
  // Mellow: everybody climbs on.
  allAboard: {
    id: 'allAboard',
    name: 'All Aboard',
    type: 'Beast',
    category: 'physical',
    kind: 'buff',
    statusApplication: [
      { statusId: 'Shield', magnitude: 35, target: 'moveTarget' },
      { statusId: 'Renew', magnitude: 2, target: 'moveTarget' },
    ],
    manaCost: 55,
    priority: 0,
    target: 'bothAllies',
  },
};

/**
 * A rewire's signature (2026-10-05, per user direction, docs/mastery.md §5c): the same move on the
 * other column, so a hero that traded Attack and Intelligence still swings its signature with its
 * strong hand. Derived, never authored — same name, power and riders, the category flipped.
 */
export function rewiredSignatureId(signatureId: string): string {
  return `${signatureId}Rewired`;
}

const rewiredSignatures: Record<string, MoveDefinition> = Object.fromEntries(
  Object.values(authoredSignatures).map((move) => [
    rewiredSignatureId(move.id),
    { ...move, id: rewiredSignatureId(move.id), category: move.category === 'physical' ? 'magical' : 'physical' },
  ])
);

/** Every signature and its rewired twin; the twins fold into data/moves.ts with the rest. */
export const signatureMoves: Record<string, MoveDefinition> = { ...authoredSignatures, ...rewiredSignatures };

/** The twin's original, for a surface that tags a signature. */
export const rewiredSignatureOrigin: Readonly<Record<string, string>> = Object.fromEntries(Object.keys(authoredSignatures).map((id) => [rewiredSignatureId(id), id]));
