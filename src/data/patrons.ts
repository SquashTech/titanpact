// The patrons (docs/patrons.md). Every figure is a first pass. A patron move wears its holder's type
// (`typeFollowsUser`) and carries no tier, a patron passive and a patron Unique are in no other
// pool: `patronMoves` fold into data/moves.ts, `patronPassives` into data/passives.ts,
// `patronUniques` into data/equipment.ts (never into UNIQUE_EQUIPMENT, the Guardians' drops).

import type { MoveDefinition, PassiveDefinition } from '../engine/content';
import type { EquipmentDefinition } from '../run/equipment';
import type { PatronDefinition } from '../run/patrons';

export const patronMoves: Record<string, MoveDefinition> = {
  crescentCut: {
    id: 'crescentCut',
    name: 'Crescent Cut',
    type: 'Iron',
    typeFollowsUser: true,
    category: 'physical',
    kind: 'damage',
    basePower: 70,
    manaCost: 40,
    tags: ['slice'],
    priority: 0,
    target: 'singleEnemy',
  },
  galeSever: {
    id: 'galeSever',
    name: 'Gale Sever',
    type: 'Iron',
    typeFollowsUser: true,
    category: 'physical',
    kind: 'damage',
    basePower: 55,
    manaCost: 50,
    tags: ['slice'],
    priority: 0,
    target: 'bothEnemies',
  },
  arcaneLance: {
    id: 'arcaneLance',
    name: 'Arcane Lance',
    type: 'Arcane',
    typeFollowsUser: true,
    category: 'magical',
    kind: 'damage',
    basePower: 70,
    manaCost: 40,
    priority: 0,
    target: 'singleEnemy',
  },
  prismBurst: {
    id: 'prismBurst',
    name: 'Prism Burst',
    type: 'Arcane',
    typeFollowsUser: true,
    category: 'magical',
    kind: 'damage',
    basePower: 55,
    manaCost: 50,
    priority: 0,
    target: 'bothEnemies',
  },
};

export const patronPassives: Record<string, PassiveDefinition> = {
  honedEdge: {
    id: 'honedEdge',
    name: 'Honed',
    description: 'Gains Edge 15.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Edge', magnitude: 15 },
    },
  },
  starwell: {
    id: 'starwell',
    name: 'Starwell',
    description: 'Restores 25 Mana.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 25 } },
    },
  },
};

/** Mythic 110 each: 90 stats and a 20-point effect, as the Guardians' Uniques. */
export const patronUniques: Record<string, EquipmentDefinition> = {
  moonfang: {
    id: 'moonfang',
    name: 'Moonfang',
    rarity: 'mythic',
    statGrants: { attack: 60, speed: 30 },
    grantsStatusIds: [{ statusId: 'Edge', magnitude: 10 }],
  },
  astralStaff: {
    id: 'astralStaff',
    name: 'Astral Staff',
    rarity: 'mythic',
    statGrants: { intelligence: 60, manaPool: 30 },
    grantsPassiveIds: ['overchannel'],
  },
};

export const patrons: Record<string, PatronDefinition> = {
  swordsman: {
    id: 'swordsman',
    title: 'The Swordsman',
    name: 'Ren',
    hasStudent: true,
    rungs: [
      [{ kind: 'item', familyId: 'sword' }],
      [{ kind: 'move', moveId: 'crescentCut' }],
      [{ kind: 'passive', passiveId: 'honedEdge' }],
      [{ kind: 'liftItem', familyId: 'sword' }, { kind: 'move', moveId: 'galeSever' }],
      [{ kind: 'unique', familyId: 'sword', uniqueId: 'moonfang' }],
    ],
    lines: ['Hold it like you mean to keep it.', 'Again. Slower. Now faster.', 'A blade remembers every hand.'],
  },
  archmage: {
    id: 'archmage',
    title: 'The Archmage',
    name: 'Ysolde',
    hasStudent: true,
    rungs: [
      [{ kind: 'item', familyId: 'staff' }],
      [{ kind: 'move', moveId: 'arcaneLance' }],
      [{ kind: 'passive', passiveId: 'starwell' }],
      [{ kind: 'liftItem', familyId: 'staff' }, { kind: 'move', moveId: 'prismBurst' }],
      [{ kind: 'unique', familyId: 'staff', uniqueId: 'astralStaff' }],
    ],
    lines: ['Listen to the hum under everything.', 'Power is patience, spent all at once.', 'The stars keep better notes than I do.'],
  },
  headmaster: {
    id: 'headmaster',
    title: 'The Headmaster',
    name: 'Aldous',
    hasStudent: false,
    rungs: [
      [{ kind: 'class', count: 3 }],
      [{ kind: 'class', count: 3 }],
      [{ kind: 'class', count: 5, pick: true }],
      [{ kind: 'class', count: 3 }],
      [{ kind: 'masterClass', classIds: ['warlord', 'bastion', 'strategist'] }],
    ],
    lines: ['Every hero is a student of something.', 'Sit. The lesson is already underway.', 'I have taught kings. You will do.'],
  },
};
