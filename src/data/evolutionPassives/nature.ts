import type { PassiveDefinition } from '../../engine/content';

export const naturePathPassives: Record<string, PassiveDefinition> = {
  // Mordrax's Wildfire: Impale poisons every hit, so the thorns are always primed to catch.
  brushburn: {
    id: 'brushburn',
    name: 'Brushburn',
    description: 'When this hero hits a Poisoned foe, it is set Burning.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventTargetHasStatus: 'Poison' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Burn' },
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
  // Tixwick's Ghost Mantis: each cut marks a foe, so Spooky Slice carries through to its partner.
  deadLeaf: {
    id: 'deadLeaf',
    name: 'Dead Leaf',
    description: 'When this hero lands a Slice, its target is Haunted.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', moveTag: 'slice' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Haunt' },
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
  // Morel's Fairy Ring: Sporefall poisons every round, so this is about 10 Mana a round.
  fairyTithe: {
    id: 'fairyTithe',
    name: 'Fairy Tithe',
    description: 'When this hero Poisons an enemy, it gains 10 Mana, past its pool.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Poison' } },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 10 } },
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
  // Mordrax's Ironbark: Parry's plate hardens into the bark it strikes with.
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
  // Hollowbark's Rimewood: the slowest tank in the type drags its attackers down to its pace.
  numbingRime: {
    id: 'numbingRime',
    name: 'Numbing Rime',
    description: 'When an enemy hits this hero, that enemy loses SPD ▼.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'enemy', subjectRole: 'source', targetsOwner: true },
      effect: { kind: 'statDelta', target: 'triggerSubject', stat: 'speed', stages: -1 },
    },
  },
  // Tixwick's Thresher: the harvester's blades grind keener every round they turn (docs/edge-and-aim.md).
  grindstone: {
    id: 'grindstone',
    name: 'Grindstone',
    description: 'At the end of each round, this hero gains Edge 5. Up to 4 times a fight.',
    reactive: {
      maxFiresPerFight: 4,
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Edge', magnitude: 5 },
    },
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
