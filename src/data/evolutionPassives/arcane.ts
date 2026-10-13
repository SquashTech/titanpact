import type { PassiveDefinition } from '../../engine/content';

export const arcanePathPassives: Record<string, PassiveDefinition> = {
  // Glyph's Machinist: the Rest its innate already pays for sets a Conduct for the Mech line to cash.
  capacitor: {
    id: 'capacitor',
    name: 'Capacitor',
    description: 'A random enemy starts Conducting.',
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
    description: 'Gains 75 Mana, past its pool.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', finishingBlow: true },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 75 } },
    },
  },
  // Zenith's Oracle: it arrives into the field that lets the slowest act first (on entry, so Mana Font's Surging Magic is not overwritten by its own cast).
  foreordained: {
    id: 'foreordained',
    name: 'Foreordained',
    description: 'Set Stasis Field.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'setFieldEffect', fieldEffectId: 'stasisBubble' },
    },
  },
  glitter: {
    id: 'glitter',
    name: 'Glitter',
    description: 'Partner gains SPD ▲.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'ally', stat: 'speed', stages: 1 },
    },
  },
  mirage: {
    id: 'mirage',
    name: 'Mirage',
    description: 'Both foes lose ATK ▼ and INT ▼.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: ['attack', 'intelligence'], stages: -1 },
    },
  },
  // Folio's Magnum Opus: the long build to one enormous round (per user direction, 2026-10-12).
  crescendo: {
    id: 'crescendo',
    name: 'Crescendo',
    description: 'At the end of every fifth round this hero stands on the field, its Arcane moves gain 100 Base Power for the next round.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self', everyNRoundsOnField: 5 },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Crescendo', magnitude: 100 },
    },
  },
  illumination: {
    id: 'illumination',
    name: 'Illumination',
    description: 'A random enemy is Dazed.',
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
    description: 'Gains 15 Mana, past its pool.',
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
    description: 'The first on each foe leaves it Conducting.',
    reactive: {
      oncePerTarget: true,
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
    description: 'Both foes start Bleeding.',
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
    description: 'Target loses 20 Mana.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'loseMana', target: 'triggerTarget', amount: 20 },
    },
  },
  // Zenith's Corona: every fire it lights pays Mana back, and Surging Intellect turns the grant into Intelligence.
  sunspot: {
    id: 'sunspot',
    name: 'Sunspot',
    description: 'When this hero sets a foe Burning, it gains 10 Mana, past its pool.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Burn' } },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 10 } },
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
  // Thane's Rimesworn: Etched Runes' trigger, paid into the grafted Frost line.
  frostOath: {
    id: 'frostOath',
    name: 'Frost Oath',
    description: 'When this hero uses a move that deals no damage, it gains Frost Force 10. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', eventFieldEquals: { damaging: 'false' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'FrostForce', magnitude: 10 },
    },
  },
  // Trove's Mimic: a Provoking wall, so the curse on the vault is paid by whoever is near it.
  vaultCurse: {
    id: 'vaultCurse',
    name: 'Vault Curse',
    description: 'A random enemy loses 5% of its max HP. Up to 4 times a fight.',
    reactive: {
      maxFiresPerFight: 4,
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'damage', target: 'randomEnemy', percentMaxHp: 0.05 },
    },
  },
};
