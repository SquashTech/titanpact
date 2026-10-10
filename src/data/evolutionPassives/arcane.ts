import type { PassiveDefinition } from '../../engine/content';

export const arcanePathPassives: Record<string, PassiveDefinition> = {
  // Glyph's Machinist: the Rest its innate already pays for sets a Conduct for the Mech line to cash.
  capacitor: {
    id: 'capacitor',
    name: 'Capacitor',
    description: 'When this hero Rests, a random enemy starts Conducting.',
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
    description: 'When this hero knocks an enemy out, it gains 75 Mana, past its pool.',
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
    description: 'When this hero uses a move that deals no damage, set Stasis Field.',
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', eventFieldEquals: { damaging: 'false' } },
      effect: { kind: 'setFieldEffect', fieldEffectId: 'stasisBubble' },
    },
  },
  glitter: {
    id: 'glitter',
    name: 'Glitter',
    description: 'At the end of each round, its partner gains SPD ▲. Up to 3 times a fight.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'ally', stat: 'speed', stages: 1, perFight: 3 },
    },
  },
  mirage: {
    id: 'mirage',
    name: 'Mirage',
    description: 'When this hero takes damage, both active enemies lose ATK ▼ and INT ▼. Once a round, up to 3 times a fight.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: ['attack', 'intelligence'], stages: -1, perFight: 3 },
    },
  },
  // Folio's Magnum Opus: Twin Cast is two hits, so two pages a cast.
  crescendo: {
    id: 'crescendo',
    name: 'Crescendo',
    description: 'When this hero lands a hit, it gains INT ▲. Once a round, up to 3 times a fight.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', stages: 1, perFight: 3 },
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
    description: 'When this hero lands a hit, it gains 15 Mana, past its pool.',
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
    description: 'When an enemy uses a move, this hero gains 10 Mana, past its pool.',
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'enemy' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 10 } },
    },
  },
  barbedLock: {
    id: 'barbedLock',
    name: 'Barbed Lock',
    description: 'When this hero takes damage, both active enemies start Bleeding.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Bleed' },
    },
  },
  // Glyph's Blackletter: every line it writes blots out a foe's spellcraft, and Enfeeble takes the rest.
  blottedPage: {
    id: 'blottedPage',
    name: 'Blotted Page',
    description: 'When this hero lands a hit, its target loses 20 Mana.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'loseMana', target: 'triggerTarget', amount: 20 },
    },
  },
  // Zenith's Halo: Consecrate's mend keeps glowing on both allies after the cast.
  lingeringLight: {
    id: 'lingeringLight',
    name: 'Lingering Light',
    description: 'When this hero heals a hero, that hero gains Renew.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Renew' },
    },
  },
  // Pixie's Wisplight: a lifted partner swings loaded, and Soul Offering lifts two stats at once.
  guidingWisp: {
    id: 'guidingWisp',
    name: 'Guiding Wisp',
    description: "When its partner's stat rises, its partner gains Ambush 20.",
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'ally', eventFieldPositive: 'delta' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Ambush', magnitude: 20 },
    },
  },
  // Folio's Prophecy: the glass cannon foresaw the blow, and answers it first.
  writtenFate: {
    id: 'writtenFate',
    name: 'Written Fate',
    description: 'The first time this hero would be knocked out each fight, it stands at 1 HP instead and its next attack goes at +1 priority.',
    enduresOnce: true,
    reactive: {
      hook: 'Endured',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Poised' },
    },
  },
  // Thane's Ironsworn: Etched Runes' trigger, paid into the grafted Iron line.
  ironOath: {
    id: 'ironOath',
    name: 'Iron Oath',
    description: 'When this hero uses a move that deals no damage, it gains Iron Force 10. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', eventFieldEquals: { damaging: 'false' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'IronForce', magnitude: 10 },
    },
  },
  // Trove's Vaultshade: a Provoking wall, so the curse on the vault is paid by whoever is near it.
  vaultCurse: {
    id: 'vaultCurse',
    name: 'Vault Curse',
    description: 'When this hero takes damage, a random enemy loses 5% of its max HP. Up to 4 times a fight.',
    reactive: {
      maxFiresPerFight: 4,
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'damage', target: 'randomEnemy', percentMaxHp: 0.05 },
    },
  },
};
