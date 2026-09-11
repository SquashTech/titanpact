// The Class catalog (docs/growth-overhaul.md §11): nine verbs, three a kind, tempered into one
// hero at each Guardian's Crucible. A Class is a role any hero can take — the doubles toolkit no
// single type slate covers evenly. A class move wears the HOLDER's type (`typeFollowsUser`, so STAB is
// guaranteed and the tile is the hero's colour) and is authored as a role verb rather than a nuke,
// and a class passive is exclusive to its Class (never in the Boon pool: run/boons.ts).
//
// `classMoves` fold into data/moves.ts and `classPassives` into data/passives.ts. Class moves
// carry no `tier`: they are in no Scroll pool and no Tutor pool (test/moveTiers.test.ts).

import type { MoveDefinition, PassiveDefinition } from '../engine/content';
import type { ClassDefinition } from '../run/classes';

export const classMoves: Record<string, MoveDefinition> = {
  feint: {
    id: 'feint',
    name: 'Feint',
    type: 'Iron',
    typeFollowsUser: true,
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    statusApplication: { statusId: 'Daze', target: 'moveTarget' },
    manaCost: 30,
    manaCostGainOnUse: 20,
    priority: 2,
    target: 'singleEnemy',
    description: 'A quick strike before anything else moves, and the foe loses the round to it (inflicts Daze). Each cast costs 20 more Mana for the rest of the fight.',
  },
  volley: {
    id: 'volley',
    name: 'Volley',
    type: 'Nature',
    typeFollowsUser: true,
    category: 'physical',
    kind: 'damage',
    basePower: 55,
    manaCost: 30,
    priority: 0,
    target: 'bothEnemies',
    description: 'A flight of shafts across the whole enemy line.',
  },
  intercept: {
    id: 'intercept',
    name: 'Intercept',
    type: 'Iron',
    typeFollowsUser: true,
    category: 'physical',
    kind: 'buff',
    statusApplication: { statusId: 'Provoke', duration: 1, target: 'self' },
    statDeltas: [{ stat: 'defense', amount: 10 }],
    statDeltaTarget: 'self',
    manaCost: 30,
    priority: 1,
    target: 'self',
    description: 'Steps in front of the partner — single-target enemy moves aimed at either ally land here this round, and the guard holds (+10 Defense).',
  },
  succor: {
    id: 'succor',
    name: 'Succor',
    type: 'Light',
    typeFollowsUser: true,
    category: 'magical',
    kind: 'heal',
    healPower: 50,
    manaCost: 30,
    priority: 0,
    target: 'singleAlly',
    description: 'Closes an ally’s wounds.',
  },
  vanish: {
    id: 'vanish',
    name: 'Vanish',
    type: 'Shadow',
    typeFollowsUser: true,
    category: 'physical',
    kind: 'damage',
    basePower: 50,
    switchesUserOut: true,
    manaCost: 25,
    priority: 0,
    target: 'singleEnemy',
    description: 'A cut on the way out — the user withdraws to the bench after striking.',
  },
};

export const classPassives: Record<string, PassiveDefinition> = {
  berserker: {
    id: 'berserker',
    name: 'Frenzy',
    description: 'Every hit this hero lands raises its Attack and Intelligence by 5.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'intelligence'], amount: 5 },
    },
  },
  warden: {
    id: 'warden',
    name: 'Stalwart',
    description: 'When this hero enters the battlefield, it gains 10 Defense and 10 Wisdom.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: ['defense', 'wisdom'], amount: 10 },
    },
  },
  monk: {
    id: 'monk',
    name: 'Inner Focus',
    description: 'Every hit this hero takes restores 10 Mana.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 10 } },
    },
  },
  herald: {
    id: 'herald',
    name: 'Wayfinder',
    description: 'Whenever a partner enters the battlefield beside this hero, that partner gains 20 Mana.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'ally' },
      effect: { kind: 'manaGrant', target: 'triggerSubject', amount: { kind: 'flat', value: 20 } },
    },
  },
};

export const classes: Record<string, ClassDefinition> = {
  // --- Offensive ---
  duelist: {
    id: 'duelist',
    name: 'Duelist',
    kind: 'offensive',
    description: 'Learns Feint: a priority strike that Dazes its target, dearer every cast.',
    grantsMoveId: 'feint',
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    kind: 'offensive',
    description: 'Frenzy: every hit landed raises Attack and Intelligence.',
    grantsPassiveId: 'berserker',
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    kind: 'offensive',
    description: 'Learns Volley: a physical strike across both foes.',
    grantsMoveId: 'volley',
  },
  // --- Defensive ---
  guardian: {
    id: 'guardian',
    name: 'Guardian',
    kind: 'defensive',
    description: 'Learns Intercept: pull every single-target enemy move onto yourself this round.',
    grantsMoveId: 'intercept',
  },
  warden: {
    id: 'warden',
    name: 'Warden',
    kind: 'defensive',
    description: 'Stalwart: arrive on the field braced, +10 Defense and +10 Wisdom.',
    grantsPassiveId: 'warden',
  },
  cleric: {
    id: 'cleric',
    name: 'Cleric',
    kind: 'defensive',
    description: 'Learns Succor: a single-ally heal, whatever your type.',
    grantsMoveId: 'succor',
  },
  // --- Utility ---
  monk: {
    id: 'monk',
    name: 'Monk',
    kind: 'utility',
    description: 'Inner Focus: every hit taken restores 10 Mana.',
    grantsPassiveId: 'monk',
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    kind: 'utility',
    description: 'Learns Vanish: strike, then withdraw to the bench in the same turn.',
    grantsMoveId: 'vanish',
  },
  herald: {
    id: 'herald',
    name: 'Herald',
    kind: 'utility',
    description: 'Wayfinder: every partner that enters beside you arrives with 20 extra Mana.',
    grantsPassiveId: 'herald',
  },
};
