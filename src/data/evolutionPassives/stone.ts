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
  // Sentinel's Gloomwatch: the gargoyle draws the blow, and answers it.
  nightVigil: {
    id: 'nightVigil',
    name: 'Night Vigil',
    description: 'When this hero is hit while Provoking, it gains Ambush 20.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', eventTargetHasStatus: 'Provoke' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Ambush', magnitude: 20 },
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
  // Scree's Pangolin: curled tight, every scale a blade.
  scaleEdges: {
    id: 'scaleEdges',
    name: 'Scale Edges',
    description: 'When an enemy hits this hero, that enemy starts Bleeding.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'enemy', subjectRole: 'source', targetsOwner: true },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Bleed' },
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
  // Dune's Sandstorm: Storm Lash marks, and every Stone hit after it cashes the mark.
  staticSand: {
    id: 'staticSand',
    name: 'Static Sand',
    description: "This hero's Stone attacks also set off Conduct.",
    setsOffStatus: { statusId: 'Conduct', moveTypes: ['Stone'] },
  },
  // Cairn's Menhir: the stone is raised and the ground answers — its partner's blows ride the higher of Attack and Defense.
  standingStone: {
    id: 'standingStone',
    name: 'Standing Stone',
    description: 'When this hero enters the battlefield, it sets Bedrock.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'setFieldEffect', fieldEffectId: 'bedrock' },
    },
  },
  // Cairn's Barrow: whoever strikes the one it shelters is marked by the barrow's dead, and Soul Rend reaches its partner.
  graveWatch: {
    id: 'graveWatch',
    name: 'Grave Watch',
    description: "When an enemy hits this hero's partner, that enemy is Haunted.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'enemy', subjectRole: 'source', targetsPartner: true },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Haunt' },
    },
  },
  // Crag's Snowcap: the first blow shakes the peak loose, and Cold Snap cashes the freeze.
  snowpack: {
    id: 'snowpack',
    name: 'Snowpack',
    description: 'The first time this hero takes damage each fight, both active enemies are Frozen.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      oncePerFight: true,
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Freeze' },
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
    description: 'When this hero lands a Stone attack on a Burning foe, it gains Stone Force 10 and Fire Force 10. Up to 3 times a fight.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Stone' }, eventTargetHasStatus: 'Burn' },
      maxFiresPerFight: 3,
      effect: { kind: 'applyStatus', target: 'self', statusId: 'StoneForce', magnitude: 10 },
      alsoEffect: { kind: 'applyStatus', target: 'self', statusId: 'FireForce', magnitude: 10 },
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
  // Dune's Shimmer: the far side swings at a heat haze, and the worm arrives untouched.
  mirageStep: {
    id: 'mirageStep',
    name: 'Mirage Step',
    description: 'The first time this hero enters the battlefield each fight, it gains Barrier for the rest of the round.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      oncePerFight: true,
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Barrier' },
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
  // Crag's Rootwarden: struck, it roots deeper and mends.
  deepRoots: {
    id: 'deepRoots',
    name: 'Deep Roots',
    description: 'When this hero takes damage, it gains Renew.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Renew' },
    },
  },
};
