import type { PassiveDefinition } from '../../engine/content';

export const lightPathPassives: Record<string, PassiveDefinition> = {
  // Solace's Solstice.
  rimeMantle: {
    id: 'rimeMantle',
    name: 'Rime Mantle',
    description: 'Whenever this hero heals an ally, that ally gains Shield 20.',
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
    description: 'Whenever this hero takes a hit, it gains Ambush 15, up to 45.',
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
    description: 'Whenever this hero lands a hit, its partner is healed a third of the damage dealt.',
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
    description: 'Whenever this hero heals an ally, both active enemies lose 10 Speed.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'speed', amount: -10 },
    },
  },
  // Carillon's Knell: Enthrall's shape — the Light hit plants the mark, the grafted Spirit line cashes it.
  deathKnell: {
    id: 'deathKnell',
    name: 'Death Knell',
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
    description: 'Whenever this hero heals an ally, every affliction on that ally is washed away.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'cleanse', target: 'triggerTarget' },
    },
  },
  // Hart's Spirit Stag, fed by its own innate: every arrival lays Renew on the partner.
  deathwatch: {
    id: 'deathwatch',
    name: 'Deathwatch',
    description: "Whenever Renew mends one of this hero's allies, a random enemy loses 4% of its max HP.",
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'ally', eventFieldEquals: { statusId: 'Renew', kind: 'heal' }, eventFieldPositive: 'amount' },
      effect: { kind: 'damage', target: 'randomEnemy', percentMaxHp: 0.04 },
    },
  },
  // Aurum's Sunfire. A new Burn keeps the higher, so a steady Light hitter holds the foe at 6%.
  kindledMane: {
    id: 'kindledMane',
    name: 'Kindled Mane',
    description: 'Every Light attack this hero lands inflicts Burn 6%.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Light' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Burn', magnitude: 6 },
    },
  },
  // Aurum's Sunlord: a Daze is a flinch only when it lands first, so the sun climbing is what
  // turns Blazing Mane's odds into lost turns.
  highNoon: {
    id: 'highNoon',
    name: 'High Noon',
    description: 'Every Light attack this hero lands gives it 10 Speed.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Light' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'speed', amount: 10 },
    },
  },
};
