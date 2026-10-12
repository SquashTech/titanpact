import type { PassiveDefinition } from '../../engine/content';

export const lightPathPassives: Record<string, PassiveDefinition> = {
  // Solace's Solstice.
  rimeMantle: {
    id: 'rimeMantle',
    name: 'Rime Mantle',
    description: 'When this hero heals an ally, that ally gains Shield 20.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Shield', magnitude: 20 },
    },
  },
  // Aegis's Vanguard: the slowest hero on the side is hit before it swings, so what it soaks loads the blade.
  answeringBlade: {
    id: 'answeringBlade',
    name: 'Answering Blade',
    description: 'When this hero takes a hit, it gains Ambush 15, up to 45.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Ambush', magnitude: 15, maxMagnitude: 45 },
    },
  },
  // Empyrean's Seraph.
  radiantVessel: {
    id: 'radiantVessel',
    name: 'Radiant Vessel',
    description: 'When this hero lands a hit, its partner is healed a third of the damage dealt.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'heal', target: 'ally', amount: { kind: 'matchTriggerAmount', multiplier: 0.33 } },
    },
  },
  // Carillon's Great Bell.
  reverberation: {
    id: 'reverberation',
    name: 'Reverberation',
    description: 'When this hero heals an ally, both active enemies lose SPD ▼.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'speed', stages: -1 },
    },
  },
  // Carillon's Knell: the Light hit plants the mark, the grafted Spirit line cashes it.
  lastToll: {
    id: 'lastToll',
    name: 'Last Toll',
    description: 'Every Light attack this hero lands leaves its target Haunted.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Light' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Haunt' },
    },
  },
  // Hart's White Hart.
  unblemished: {
    id: 'unblemished',
    name: 'Unblemished',
    description: 'When this hero heals an ally, every affliction on that ally is washed away.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'cleanse', target: 'triggerTarget' },
    },
  },
  // Hart's Dream Stag, fed by its own innate: every arrival lays Renew on the partner.
  deathwatch: {
    id: 'deathwatch',
    name: 'Deathwatch',
    description: "When Renew mends one of this hero's allies, a random enemy loses as much HP as it mended.",
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'ally', eventFieldEquals: { statusId: 'Renew', kind: 'heal' }, eventFieldPositive: 'amount' },
      effect: { kind: 'damage', target: 'randomEnemy', amount: { kind: 'matchTriggerAmount' } },
    },
  },
  // Aurum's Sunfire: a fresh Burn re-lights at 15%, so every Light hit stokes the fire.
  kindledMane: {
    id: 'kindledMane',
    name: 'Kindled Mane',
    description: 'Every Light attack this hero lands sets its target Burning.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Light' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Burn' },
    },
  },
  // Aurum's Sunlord: the sun climbs with every strike.
  highNoon: {
    id: 'highNoon',
    name: 'High Noon',
    description: 'Every Light attack this hero lands gives it ATK ▲.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Light' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', stages: 1 },
    },
  },
  // Solace's Dewfall: Light's Mana battery — a refill, never past the pool (Arcane owns overflow).
  morningDew: {
    id: 'morningDew',
    name: 'Morning Dew',
    description: 'When this hero heals an ally, that ally gains 20 Mana, up to its pool.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'manaGrant', target: 'triggerTarget', amount: { kind: 'flat', value: 20 }, capped: true },
    },
  },
  // Aegis's Cornerstone: a broken wall turns into a swing (▲▲ per user direction, 2026-10-12).
  keystone: {
    id: 'keystone',
    name: 'Keystone',
    description: "When this hero's Shield is broken, it gains ATK ▲▲.",
    reactive: {
      hook: 'StatusRemoved',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Shield', reason: 'broken' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', stages: 2 },
    },
  },
  // Empyrean's Stormwing: arrives with the marks its Electric Burst jumps the queue on.
  chargedPlumes: {
    id: 'chargedPlumes',
    name: 'Charged Plumes',
    description: 'When this hero enters the battlefield, both active enemies start Conducting.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Conduct' },
    },
  },
  // Carillon's Bellfounder: the bell rings at the start of the round The Bell Tolls closes.
  bronzePeal: {
    id: 'bronzePeal',
    name: 'Bronze Peal',
    description: 'At the start of every third round, the bell rings out and a random enemy is Dazed.',
    reactive: {
      hook: 'RoundStarted',
      condition: { relativeTo: 'self', everyNRounds: 3 },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Daze' },
    },
  },
  // Hart's Greenwood: Hallowed Step and Sow lay the Renew; every mend grows bark.
  barkskin: {
    id: 'barkskin',
    name: 'Barkskin',
    description: "When Renew mends this hero's partner, the partner gains DEF ▲ and WIS ▲.",
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'ally', eventFieldEquals: { statusId: 'Renew', kind: 'heal' }, eventFieldPositive: 'amount' },
      effect: { kind: 'statDelta', target: 'ally', stat: ['defense', 'wisdom'], stages: 1 },
    },
  },
  // Aurum's Pride: Rampage takes the kill, the pride shares it.
  lionsShare: {
    id: 'lionsShare',
    name: "Lion's Share",
    description: 'When this hero knocks an enemy out, both allies heal a quarter of their max HP and gain ATK ▲. Up to 3 times a fight.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', finishingBlow: true },
      effect: { kind: 'heal', target: 'bothAllies', amount: { kind: 'percentMaxHp', value: 0.25 } },
      alsoEffect: { kind: 'statDelta', target: 'bothAllies', stat: 'attack', stages: 1 },
      maxFiresPerFight: 3,
    },
  },
};
