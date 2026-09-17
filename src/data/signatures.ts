// The signature moves (docs/mastery.md §5): one authored move per hero, held only at ten Mastery
// pips — the move that says what the hero IS in one button. Riptide's Lizard Rush is the template:
// a solid hit plus the thing the hero does, never a bare nuke. Authored at the hero's innate
// primary type, so STAB is guaranteed without `typeFollowsUser`, and priced Late (45+, most 55;
// a second target or a second rider pays 60).
//
// The exclusivity rule, the Class-move rule's sibling (test/mastery.test.ts): a signature is in no
// type pool, no Mentor or Tutor pool, no graft's learnableMoveIds and no path's unlocksMoveIds —
// and carries no `tier`, since a tier gates offers and nothing ever offers one. `signatureMoves`
// fold into data/moves.ts; `HeroDefinition.signatureMoveId` is the pointer.
//
// DRAFT (2026-09-14, Mastery phase 4): every entry but Lizard Rush is a first pass for review.
// The rule each one was written to: the hit is sized like the type's Late moves, the verb is the
// hero's own — the thing its Evolution paths keep circling — and no two signatures share a verb.

import type { MoveDefinition } from '../engine/content';

export const signatureMoves: Record<string, MoveDefinition> = {
  // --- Fire ---
  // Cinder: the knight. Brings the hammer down glowing; what it hits catches, and the plate
  // comes off the anvil harder.
  hammerbrand: {
    id: 'hammerbrand',
    name: 'Hammerbrand',
    type: 'Fire',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    statusApplication: { statusId: 'Burn', magnitude: 40, target: 'moveTarget' },
    statDeltas: [{ stat: 'defense', amount: 20 }],
    statDeltaTarget: 'self',
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
    description: 'Brings the hammer down still glowing: what it hits catches, and the plate comes off the anvil harder (Burn 40; +20 Defense to self).',
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
    description: 'All of the fire at once. A burning target takes double, and stops burning — there is nothing left to.',
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
    statusApplication: { statusId: 'Burn', magnitude: 40, target: 'moveTarget' },
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
    description: 'Sets them alight and sits by it (Burn 40; heals 50% of the damage dealt).',
  },

  // --- Water ---
  // Riptide. It was Tidecaller's clause-5 grant and a Water pool move until 2026-09-14 (Mastery
  // phase 3, per user direction); Tidecaller grants Maelstrom now, and every Riptide reaches this
  // at ten.
  lizardRush: {
    id: 'lizardRush',
    name: 'Lizard Rush',
    type: 'Water',
    category: 'physical',
    kind: 'damage',
    basePower: 75,
    statusApplication: { statusId: 'Renew', magnitude: 25, target: 'bothAllies' },
    manaCost: 45,
    priority: 0,
    target: 'singleEnemy',
    description: 'A charge that drags the whole tide behind it (grants both allies Renew 25).',
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
    description: 'Closes on them and does not open — whatever was quick about them was in the part it has (-20 Speed).',
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
    description: 'The whole deep comes up behind the strike, and it does not go back down (Water Force 25 to self).',
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
    description: 'Cold that does not ask. Freezes, every time.',
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
    description: 'Two throws with no pause between them (2 hits; each 25% to Freeze).',
  },
  // Cube: everything it is, arriving slowly.
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
    description: 'All of it, at once, at whatever speed it can manage (swings with Defense).',
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
    description: 'Loosed before anyone else has moved, and at both of them (priority +1).',
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
    description: 'One bolt that splits — and the charge stays in both of them (marks both with Conduct).',
  },
  // Scallywag: no quarter, no guard.
  broadside: {
    id: 'broadside',
    name: 'Broadside',
    type: 'Storm',
    category: 'physical',
    kind: 'damage',
    basePower: 95,
    statDeltas: [{ stat: 'defense', amount: -20 }],
    statDeltaTarget: 'self',
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
    description: 'Everything it has, all at once, and nothing held back to hide behind (-20 Defense to self).',
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
    description: 'Splits the ground under the whole far side (-15 Speed to both).',
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
    description: 'Spreads its wings over the pair and draws every eye to itself (+30 Defense to both allies; Provoke this round).',
  },
  // Slate: throws the ground up under both of them, and what comes down is in reach of the staff.
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
    description: 'Throws the ground up under both of them, and what comes down is in reach of the staff (+20 Attack to self).',
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
      { statusId: 'Renew', magnitude: 25, target: 'bothAllies' },
    ],
    manaCost: 60,
    priority: 0,
    target: 'bothEnemies',
    description: 'Seeds the whole field: the far side rots and this side grows (Poison 10% to both foes; Renew 25 to both allies).',
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
      { statusId: 'Renew', magnitude: 30, target: 'self' },
    ],
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
    description: 'Opens them up and puts down roots in the gap (Bleed; Renew 30 to self).',
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
    description: 'The whole trunk, coming down last and landing hardest (priority -1).',
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
    statusApplication: { statusId: 'Renew', magnitude: 30, target: 'bothAllies' },
    manaCost: 60,
    priority: 0,
    target: 'bothAllies',
    description: 'Morning for the whole side: mends both, clears what they carry, and keeps mending (Renew 30).',
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
    description: 'Strikes with the shield-arm, and the shield comes up for both (+20 Defense to both allies).',
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
    description: 'Comes down out of the noon sky, and the ground where it lands is holy (sets Sanctuary).',
  },

  // --- Shadow ---
  // Vesper: lands first and is already gone into the next.
  duskStep: {
    id: 'duskStep',
    name: 'Dusk Step',
    type: 'Shadow',
    category: 'physical',
    kind: 'damage',
    basePower: 70,
    statusApplication: { statusId: 'Ambush', magnitude: 30, target: 'self' },
    manaCost: 55,
    priority: 1,
    target: 'singleEnemy',
    description: 'Lands before they have turned round, and is already setting up the next one (priority +1; Ambush 30 on self).',
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
    description: 'Takes the marrow out of them and keeps it (heals 100% of the damage dealt).',
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
    description: 'The one you do not see coming (50% Crit).',
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
    description: 'Writes over what both of them knew (-20 Intelligence to both).',
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
    description: 'Every cast raises the ceiling for the one after it (+20 Intelligence to self).',
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
    description: 'Draws the ring, and everyone inside it is quicker and fuller than they were (50 mana and +20 Speed to both allies; sets Surging Magic).',
  },

  // --- Mind ---
  // Cortex: strikes, and the pair it threads together runs hotter on both axes — the mixed
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
    description: 'A lance of thought that threads the two of you together, and both pipelines run hotter for it (+15 Attack and +15 Intelligence to both allies).',
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
    description: 'Empties the room behind their eyes (-30 Wisdom).',
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
    description: 'Gets there before they are awake, and half the time they stay that way (priority +1; 50% to Daze).',
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
    statusApplication: { statusId: 'Renew', magnitude: 20, target: 'bothAllies' },
    manaCost: 60,
    priority: 0,
    target: 'singleEnemy',
    description: 'Takes it back, and shares it out (heals 50% of the damage dealt; Renew 20 to both allies).',
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
    description: 'A wail with an edge on it, and it takes the fight out of both of them (-20 Attack to both).',
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
    description: 'Spreads its wings, and everything aimed at the pair finds feathers (Provoke this round; Shield 60 on self).',
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
    description: 'Hits from behind the shield and dares the far side to answer (Provoke this round).',
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
    description: 'A blow the whole line follows (+15 Attack to both allies).',
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
    description: 'The lance, and nothing behind it but the ground going past (priority +1; 25% recoil).',
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
    description: 'Winds tighter with every cast, and nobody is letting it down (+25 Base Power each use, to 140).',
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
      { statusId: 'Burn', magnitude: 40, target: 'moveTarget' },
      { statusId: 'Burn', magnitude: 30, target: 'self' },
    ],
    manaCost: 55,
    priority: 0,
    target: 'singleEnemy',
    description: 'Vents the whole boiler through the fist; some of it stays in the housing (Burn 40 to the target, Burn 30 to self).',
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
    description: 'Bites down and keeps what it takes; the boiler runs on it (heals 50% of damage dealt).',
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
    description: 'Bites, and the pack comes in behind it (+15 Speed to both allies).',
  },
  // Widow: one bite, two things in it.
  widowbite: {
    id: 'widowbite',
    name: 'Widowbite',
    type: 'Beast',
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
    description: 'One bite, two things in it (Bleed; Poison 15%).',
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
    description: 'Tightens until nothing about them works right (-20 Speed and -20 Defense).',
  },
};
