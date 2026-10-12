import type { PassiveDefinition } from '../../engine/content';

export const stonePathPassives: Record<string, PassiveDefinition> = {
  // Crag's Stonebreaker: the spread swing slows both.
  bury: {
    id: 'bury',
    name: 'Bury',
    description: 'When this hero lands a Stone attack, its target loses SPD ▼.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Stone' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'speed', stages: -1 },
    },
  },
  // Sentinel's Talonguard: every guard move is weight Body Crush swings with.
  gatheringWeight: {
    id: 'gatheringWeight',
    name: 'Gathering Weight',
    description: 'When this hero uses a move that deals no damage, it gains DEF ▲.',
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', eventFieldEquals: { damaging: 'false' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'defense', stages: 1 },
    },
  },
  // Sentinel's Gloomwatch: Ambush is flat Base Power, so it pays a hero with no Attack to speak of.
  nightVigil: {
    id: 'nightVigil',
    name: 'Night Vigil',
    description: "When this hero's partner is hit, this hero gains Ambush 15.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'ally' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Ambush', magnitude: 15 },
    },
  },
  // Petra's Runestone: Fault Line's Shields are what the runes drink.
  runicWard: {
    id: 'runicWard',
    name: 'Runic Ward',
    description: "When a hit lands on this hero's Shield, it gains Mana equal to what the Shield took, past its pool.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', eventFieldPositive: 'absorbed' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'matchTriggerAmount', field: 'absorbed' } },
    },
  },
  // Scree's Tor.
  leeward: {
    id: 'leeward',
    name: 'Leeward',
    description: 'When this hero takes damage, its partner gains Shield 10.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Shield', magnitude: 10 },
    },
  },
  // Scree's Riverstone.
  riverworn: {
    id: 'riverworn',
    name: 'Riverworn',
    description: 'At the end of each round, this hero is washed of one affliction.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'cleanse', target: 'self', count: 1 },
    },
  },
  // Dune's Worldworm: every crush adds to the bulk Body Crush swings with.
  desertBody: {
    id: 'desertBody',
    name: 'Desert Body',
    description: 'When this hero lands a Stone attack, it gains DEF ▲.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Stone' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'defense', stages: 1 },
    },
  },
  // Dune's Duneshade: Undermine's Defense drop, paid on the way under.
  sinkingSands: {
    id: 'sinkingSands',
    name: 'Sinking Sands',
    description: 'When this hero switches out, both active enemies lose DEF ▼.',
    reactive: {
      hook: 'SwitchedOut',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'defense', stages: -1 },
    },
  },
  // Cairn's Menhir: Body Blow swings with the Defense this stacks.
  settlingStone: {
    id: 'settlingStone',
    name: 'Settling Stone',
    description: 'At the end of each round, this hero gains DEF ▲.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: 'defense', stages: 1 },
    },
  },
  // Cairn's Barrow: Waystone lays the Shields, the Spirit line spends the Force.
  barrowCall: {
    id: 'barrowCall',
    name: 'Barrow-Call',
    description: "When a hit lands on this hero's partner's Shield, this hero gains Spirit Force 10. Up to 3 times a fight.",
    reactive: {
      maxFiresPerFight: 3,
      hook: 'DamageDealt',
      condition: { relativeTo: 'ally', eventFieldPositive: 'absorbed' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'SpiritForce', magnitude: 10 },
    },
  },
  // Crag's Mountainheart: Juggernaut's lost Speed comes back as armour.
  immovable: {
    id: 'immovable',
    name: 'Immovable',
    description: 'When this hero loses Speed, it gains Shield 30. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'StatChanged',
      condition: { relativeTo: 'self', eventFieldEquals: { stat: 'speed' }, eventFieldNegative: 'delta' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Shield', magnitude: 30 },
    },
  },
  // Sentinel's Cathedral: the wall it raises holds its partner up too.
  flyingButtress: {
    id: 'flyingButtress',
    name: 'Flying Buttress',
    description: "When this hero's Defense rises, its partner gains DEF ▲ and WIS ▲.",
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'self', eventFieldEquals: { stat: 'defense' }, eventFieldPositive: 'delta' },
      effect: { kind: 'statDelta', target: 'ally', stat: ['defense', 'wisdom'], stages: 1 },
    },
  },
  // Petra's Magma: Scorch lights the fire, the Stone line keeps it at its hottest.
  slagHeap: {
    id: 'slagHeap',
    name: 'Slag Heap',
    description: 'When this hero lands a Stone attack on a Burning foe, it sets that foe Burning again.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Stone' }, eventTargetHasStatus: 'Burn' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Burn' },
    },
  },
  // Scree's Ironscale: every taunt hardens the plates Shield Bash swings with.
  bristlingScales: {
    id: 'bristlingScales',
    name: 'Bristling Scales',
    description: 'When this hero becomes Provoking, it gains Iron Force 15. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Provoke' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'IronForce', magnitude: 15 },
    },
  },
  // Dune's Glassback: Firebrand's crits fuse the sand into burning glass.
  moltenGlass: {
    id: 'moltenGlass',
    name: 'Molten Glass',
    description: 'When this hero lands a critical hit, its target is set Burning.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { isCrit: 'true' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Burn' },
    },
  },
  // Cairn's Riverbed: the water under every Shield it lays.
  riverfed: {
    id: 'riverfed',
    name: 'Riverfed',
    description: 'When this hero grants Shield, whoever receives it also gains Renew.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Shield' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Renew' },
    },
  },
};
