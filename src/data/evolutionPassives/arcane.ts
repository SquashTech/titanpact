import type { PassiveDefinition } from '../../engine/content';

export const arcanePathPassives: Record<string, PassiveDefinition> = {
  // Glyph's Machinist: the Rest its innate already pays for sets a Conduct for the Mech line to cash.
  capacitor: {
    id: 'capacitor',
    name: 'Capacitor',
    description: 'Whenever this hero Rests, a random enemy starts Conducting.',
    reactive: {
      hook: 'Rested',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Conduct' },
    },
  },
  // Zenith's Apex: a knockout refunds most of the cast that made it, so one Singularity can open the next.
  apogee: {
    id: 'apogee',
    name: 'Apogee',
    description: 'Whenever this hero knocks an enemy out, it gains 75 Mana, past its pool.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', finishingBlow: true },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 75 } },
    },
  },
  // Zenith's Oracle: its own buffs set the field that lets the slowest act first.
  foreordained: {
    id: 'foreordained',
    name: 'Foreordained',
    description: 'Whenever this hero uses a move that deals no damage, set Stasis Field.',
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', eventFieldEquals: { damaging: 'false' } },
      effect: { kind: 'setFieldEffect', fieldEffectId: 'stasisBubble' },
    },
  },
  glitter: {
    id: 'glitter',
    name: 'Glitter',
    description: 'At the end of each round, its partner gains 10 Speed.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'ally', stat: 'speed', amount: 10 },
    },
  },
  mirage: {
    id: 'mirage',
    name: 'Mirage',
    description: 'Whenever this hero takes damage, both active enemies lose 10 Attack and 10 Intelligence.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: ['attack', 'intelligence'], amount: -10 },
    },
  },
  // Folio's Magnum Opus: Twin Cast is two hits, so two pages a cast.
  crescendo: {
    id: 'crescendo',
    name: 'Crescendo',
    description: 'Whenever this hero lands a hit, it gains 10 Intelligence.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', amount: 10 },
    },
  },
  illumination: {
    id: 'illumination',
    name: 'Illumination',
    description: 'The first time this hero enters the battlefield during combat, a random enemy is Dazed.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Daze' },
      oncePerFight: true,
    },
  },
  // Thane's Spellsword: the mana it banks is what Arcane Overflow pays out as Attack.
  bladeChannel: {
    id: 'bladeChannel',
    name: 'Blade Channel',
    description: 'Whenever this hero lands a hit, it gains 15 Mana, past its pool.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 15 } },
    },
  },
  // Thane's Stormbrand: the Arcane edge plants the mark and the grafted Storm line cashes it.
  stormrune: {
    id: 'stormrune',
    name: 'Stormrune',
    description: 'Every Arcane attack this hero lands leaves its target Conducting.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Arcane' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Conduct' },
    },
  },
  // Trove's Bottomless Chest: a 45 pool cannot reach Font of Power's 100 without it.
  tithe: {
    id: 'tithe',
    name: 'Tithe',
    description: 'Whenever an enemy uses a move, this hero gains 10 Mana, past its pool.',
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'enemy' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 10 } },
    },
  },
  barbedLock: {
    id: 'barbedLock',
    name: 'Barbed Lock',
    description: 'Whenever this hero takes damage, both active enemies start Bleeding.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Bleed' },
    },
  },
};
