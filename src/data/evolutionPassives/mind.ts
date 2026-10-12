import type { PassiveDefinition } from '../../engine/content';

export const mindPathPassives: Record<string, PassiveDefinition> = {
  // Reverie's Blindspot: target-role on the partner, so it waits out the blow aimed next to it.
  inTheGap: {
    id: 'inTheGap',
    name: 'In the Gap',
    description: 'When its partner takes damage, this hero gains Ambush 20.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'ally' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Ambush', magnitude: 20 },
    },
  },
  gorge: {
    id: 'gorge',
    name: 'Gorge',
    description: 'When this hero knocks an enemy out, it heals half its max HP.',
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
    description: "When this hero lands a hit, every move its target holds costs 5 more Mana for the rest of the fight, up to 20.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'manaSurcharge', target: 'triggerTarget', amount: 5, max: 20 },
    },
  },
  sleepwalk: {
    id: 'sleepwalk',
    name: 'Sleepwalk',
    description: 'When this hero Rests, it heals a quarter of its max HP.',
    reactive: {
      hook: 'Rested',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'percentMaxHp', value: 0.25 } },
    },
  },
  stingingCells: {
    id: 'stingingCells',
    name: 'Stinging Cells',
    description: 'When this hero takes damage, both active enemies gain Poison 5.',
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
    description: 'When this hero lands a hit, its partner gains Ambush 15.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Ambush', magnitude: 15 },
    },
  },
  hubris: {
    id: 'hubris',
    name: 'Hubris',
    description: "When an enemy's stat rises, it loses DEF ▼ and WIS ▼.",
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'enemy', eventFieldPositive: 'delta' },
      effect: { kind: 'statDelta', target: 'triggerSubject', stat: ['defense', 'wisdom'], stages: -1 },
    },
  },
  // Koan's Third Eye: a 45 pool Rests often, and every Rest is a sitting.
  stillness: {
    id: 'stillness',
    name: 'Stillness',
    description: 'When this hero Rests, every affliction on it is washed away.',
    reactive: {
      hook: 'Rested',
      condition: { relativeTo: 'self' },
      effect: { kind: 'cleanse', target: 'self' },
    },
  },
  innerLight: {
    id: 'innerLight',
    name: 'Inner Light',
    description: 'When this hero takes damage, it heals a quarter of what it lost.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'matchTriggerAmount', multiplier: 0.25 } },
    },
  },
  // Reverie's Construct: Cerebral Shock plants the mark, Cog Slam cashes it, and the machine tightens.
  clockworkMind: {
    id: 'clockworkMind',
    name: 'Clockwork Mind',
    description: 'When this hero sets off Conduct, it gains ATK ▲ and DEF ▲.',
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'defense'], stages: 1 },
    },
  },
  // Lucius's Voidcaller: every bite drags a foe toward the half where Eclipse doubles.
  voidGnaw: {
    id: 'voidGnaw',
    name: 'Void Gnaw',
    description: 'When this hero lands a hit, its target loses 5% of its max HP.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'damage', target: 'triggerTarget', percentMaxHp: 0.05 },
    },
  },
  // Trance's Ringmaster: Blinding Flash stops the act, and the partner takes the stage.
  centerRing: {
    id: 'centerRing',
    name: 'Center Ring',
    description: "When an enemy is Dazed, this hero's partner gains Ambush 30.",
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Daze' } },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Ambush', magnitude: 30 },
    },
  },
  // Drift's Deepbloom: the bell of the bloom closes over its partner as the tide goes out.
  bellVeil: {
    id: 'bellVeil',
    name: 'Bell Veil',
    description: 'When this hero lands a Water attack, its partner gains Shield 20.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Water' } },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Shield', magnitude: 20 },
    },
  },
  // Motley's Conjurer: now you see the partner, now you don't.
  vanishingAct: {
    id: 'vanishingAct',
    name: 'Vanishing Act',
    description: 'When this hero enters the battlefield, its partner gains Barrier for the rest of the round. Up to 2 times a fight.',
    reactive: {
      maxFiresPerFight: 2,
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Barrier' },
    },
  },
  // Koan's Crane: Rending Leap opens the wound, and every strike after it rises higher.
  whiteCrane: {
    id: 'whiteCrane',
    name: 'White Crane',
    description: 'When this hero lands an attack on a Bleeding foe, it gains ATK ▲ and SPD ▲.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventTargetHasStatus: 'Bleed' },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'speed'], stages: 1 },
    },
  },
};
