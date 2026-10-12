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
    description: 'When this hero knocks an enemy out, both active enemies are Haunted.',
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
    description: 'When this hero grants Renew, whoever receives it gains ATK ▲ and INT ▲.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Renew' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: ['attack', 'intelligence'], stages: 1 },
    },
  },
  // Morel's Corpselight: the Poison plants the mark, the grafted Spirit line spreads through it.
  graveglow: {
    id: 'graveglow',
    name: 'Graveglow',
    description: 'When this hero Poisons an enemy, that enemy is Haunted.',
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
    description: 'When this hero lands a Nature attack, its target loses WIS ▼.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Nature' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'wisdom', stages: -1 },
    },
  },
  // Lotus's Moonpond: read off the tick, so a Renew pays on landing and twice more.
  moonwell: {
    id: 'moonwell',
    name: 'Moonwell',
    description: "When this hero's Renew heals it, it gains 10 Mana, past its pool.",
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Renew', kind: 'heal' } },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 10 } },
    },
  },
  // Sylva's Druid: the bear's claws still tend the grove.
  mossclaw: {
    id: 'mossclaw',
    name: 'Mossclaw',
    description: 'When this hero lands a Beast attack, its partner gains Renew.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Beast' } },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Renew' },
    },
  },
  // Mordrax's Ironbark: Bastion's plate hardens into the bark it strikes with.
  ironsap: {
    id: 'ironsap',
    name: 'Ironsap',
    description: 'When this hero gains Shield, it gains ATK ▲.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Shield' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', stages: 1 },
    },
  },
  // Hollowbark's Wraithwood: every blow it takes wakes something for Poltergeist to spread through.
  whisperingBoughs: {
    id: 'whisperingBoughs',
    name: 'Whispering Boughs',
    description: 'When this hero takes damage, a random enemy is Haunted.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Haunt' },
    },
  },
  // Tixwick's Reaper: Serrated Slice opens the wound, the scythe follows it in.
  reaping: {
    id: 'reaping',
    name: 'Reaping',
    description: 'This hero deals 30% more damage to a Bleeding foe.',
    damageModifier: { requiresTargetStatuses: ['Bleed'], amount: 0.3 },
  },
  // Morel's Deathcap: every Poison Grim Harvest reaps feeds the next.
  gravemould: {
    id: 'gravemould',
    name: 'Gravemould',
    description: 'When this hero sets off a Poison, it gains Shadow Force 15. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'StatusDetonated',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Poison' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'ShadowForce', magnitude: 15 },
    },
  },
  // Lotus's Enlightened: each mind Psionic Wave opens deepens the next wave.
  insight: {
    id: 'insight',
    name: 'Insight',
    description: "When an enemy's Wisdom drops, this hero gains Mind Force 10. Up to 3 times a fight.",
    reactive: {
      maxFiresPerFight: 3,
      hook: 'StatChanged',
      condition: { relativeTo: 'enemy', eventFieldEquals: { stat: 'wisdom' }, eventFieldNegative: 'delta' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'MindForce', magnitude: 10 },
    },
  },
};
