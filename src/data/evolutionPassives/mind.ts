import type { PassiveDefinition } from '../../engine/content';

export const mindPathPassives: Record<string, PassiveDefinition> = {
  // Reverie's Blindspot: target-role on the partner, so it waits out the blow aimed next to it.
  inTheGap: {
    id: 'inTheGap',
    name: 'In the Gap',
    description: 'Whenever its partner takes damage, this hero gains Ambush 20.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'ally' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Ambush', magnitude: 20 },
    },
  },
  gorge: {
    id: 'gorge',
    name: 'Gorge',
    description: 'Whenever this hero knocks an enemy out, it heals half its max HP.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', finishingBlow: true },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'percentMaxHp', value: 0.5 } },
    },
  },
  // Lucius's Cipher: Glittering Hoard's surcharge, earned a hit at a time on the foe it reads.
  sealedScript: {
    id: 'sealedScript',
    name: 'Sealed Script',
    description: "Whenever this hero lands a hit, every move its target holds costs 5 more Mana for the rest of the fight, up to 20.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'manaSurcharge', target: 'triggerTarget', amount: 5, max: 20 },
    },
  },
  sleepwalk: {
    id: 'sleepwalk',
    name: 'Sleepwalk',
    description: 'Whenever this hero Rests, it heals a quarter of its max HP.',
    reactive: {
      hook: 'Rested',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'percentMaxHp', value: 0.25 } },
    },
  },
  stingingCells: {
    id: 'stingingCells',
    name: 'Stinging Cells',
    description: 'Whenever this hero takes damage, both active enemies gain Poison 5.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Poison', magnitude: 5, duration: 3 },
    },
  },
  moonglow: {
    id: 'moonglow',
    name: 'Moonglow',
    description: 'At the end of each round, its partner heals 5% of its max HP.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'ally', amount: { kind: 'percentMaxHp', value: 0.05 } },
    },
  },
  // Motley's Harlequin: the fastest hero on the field hits first, so the partner swings second and loaded.
  setup: {
    id: 'setup',
    name: 'Setup',
    description: 'Whenever this hero lands a hit, its partner gains Ambush 15.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Ambush', magnitude: 15 },
    },
  },
  hubris: {
    id: 'hubris',
    name: 'Hubris',
    description: "Whenever an enemy's stat rises, it loses 15 Defense and 15 Wisdom.",
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'enemy', eventFieldPositive: 'delta' },
      effect: { kind: 'statDelta', target: 'triggerSubject', stat: ['defense', 'wisdom'], amount: -15 },
    },
  },
  // Koan's Third Eye: a 45 pool Rests often, and every Rest is a sitting.
  stillness: {
    id: 'stillness',
    name: 'Stillness',
    description: 'Whenever this hero Rests, every affliction on it is washed away.',
    reactive: {
      hook: 'Rested',
      condition: { relativeTo: 'self' },
      effect: { kind: 'cleanse', target: 'self' },
    },
  },
  innerLight: {
    id: 'innerLight',
    name: 'Inner Light',
    description: 'Whenever this hero takes damage, it heals a quarter of what it lost.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'matchTriggerAmount', multiplier: 0.25 } },
    },
  },
};
