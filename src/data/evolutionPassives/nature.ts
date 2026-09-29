import type { PassiveDefinition } from '../../engine/content';

export const naturePathPassives: Record<string, PassiveDefinition> = {
  // Mordrax's Wildheart: Impale poisons every hit, so a Beast hit sets the table for both.
  feralRend: {
    id: 'feralRend',
    name: 'Feral Rend',
    description: 'Every Beast attack this hero lands leaves its target Bleeding.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Beast' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Bleed' },
    },
  },
  // Hollowbark's Rootstone: an absorbed hit is still a hit, so Barbs keeps firing behind it.
  petrified: {
    id: 'petrified',
    name: 'Petrified',
    description: 'At the end of each round, this hero gains Shield 15.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Shield', magnitude: 15 },
    },
  },
  // Tixwick's Ghost Mantis.
  deadLeaf: {
    id: 'deadLeaf',
    name: 'Dead Leaf',
    description: 'Whenever this hero knocks an enemy out, both active enemies are Haunted.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', finishingBlow: true },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Haunt' },
    },
  },
  // Morel's Toadstool: per grant, so Wild Bloom pays both allies.
  sporeRing: {
    id: 'sporeRing',
    name: 'Spore Ring',
    description: 'Whenever this hero grants Renew, whoever receives it gains 10 Attack and 10 Intelligence.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Renew' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: ['attack', 'intelligence'], amount: 10 },
    },
  },
  // Morel's Corpselight: the Poison plants the mark, the grafted Spirit line spreads through it.
  graveglow: {
    id: 'graveglow',
    name: 'Graveglow',
    description: 'Whenever this hero Poisons an enemy, that enemy is Haunted.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Poison' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Haunt' },
    },
  },
  // Lotus's Thousand Petals.
  petalStorm: {
    id: 'petalStorm',
    name: 'Petal Storm',
    description: 'Whenever this hero lands a Nature attack, its target loses 10 Wisdom.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Nature' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'wisdom', amount: -10 },
    },
  },
  // Lotus's Moonpond: read off the tick, so a Renew pays on landing and twice more.
  moonwell: {
    id: 'moonwell',
    name: 'Moonwell',
    description: "Whenever this hero's Renew heals it, it gains 10 Mana, past its pool.",
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Renew', kind: 'heal' } },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 10 } },
    },
  },
};
