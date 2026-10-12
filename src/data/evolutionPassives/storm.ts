import type { PassiveDefinition } from '../../engine/content';

export const stormPathPassives: Record<string, PassiveDefinition> = {
  // Squall's Dust Devil: a sand-scoured Arrow opens the guard for the next one.
  grit: {
    id: 'grit',
    name: 'Grit',
    description: 'Every Arrow this hero lands takes DEF ▼ off its target.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', moveTag: 'arrow' },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'defense', stages: -1 },
    },
  },
  // Tempest's Ionosphere: a full pool held back is charge banked.
  storedCharge: {
    id: 'storedCharge',
    name: 'Stored Charge',
    description: "At the start of each round, if this hero's Mana is full, it gains Storm Force 10. Up to 3 times a fight.",
    reactive: {
      hook: 'RoundStarted',
      condition: { relativeTo: 'self', ownerManaFull: true },
      maxFiresPerFight: 3,
      effect: { kind: 'applyStatus', target: 'self', statusId: 'StormForce', magnitude: 10 },
    },
  },
  // Skyshear's Rimewing: the Freeze lands on the hero whose mark was just cashed.
  hailstrike: {
    id: 'hailstrike',
    name: 'Hailstrike',
    description: 'When this hero sets off Conduct, its target is Frozen.',
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Freeze' },
    },
  },
  // Nimbus's Anvilhead.
  anvilCrown: {
    id: 'anvilCrown',
    name: 'Anvil Crown',
    description: 'When this hero takes damage, it gains INT ▲.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', stages: 1 },
    },
  },
  // Nimbus's Sunshower: a partner's Conduct counts too; Anvil Cloud's own does not, a passive never chaining.
  sunbreak: {
    id: 'sunbreak',
    name: 'Sunbreak',
    description: "When an enemy becomes Conducting, this hero's partner heals 10% of its max HP.",
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'heal', target: 'ally', amount: { kind: 'percentMaxHp', value: 0.1 } },
    },
  },
  // Kite's Highflyer.
  updraft: {
    id: 'updraft',
    name: 'Updraft',
    description: "When this hero lands an attack, its partner's next attack goes at +1 priority.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Poised' },
    },
  },
  // Kite's Lantern Kite: the light it lends comes back to it.
  gildedString: {
    id: 'gildedString',
    name: 'Gilded String',
    description: 'When this hero uses a move that deals no damage, it heals 15% of its max HP.',
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', eventFieldEquals: { damaging: 'false' } },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'percentMaxHp', value: 0.15 } },
    },
  },
  // Raiju's Kaminari: every arrival, and a pivot is how it arrives.
  thunderstep: {
    id: 'thunderstep',
    name: 'Thunderstep',
    description: 'When this hero enters the battlefield, its next attack goes at +1 priority.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Poised' },
    },
  },
  // Raiju's Heat Lightning: Blazing Retreat lights the foe and leaves, and the flash stuns it.
  brushfire: {
    id: 'brushfire',
    name: 'Brushfire',
    description: 'When this hero switches out, every Burning enemy is Dazed.',
    reactive: {
      hook: 'SwitchedOut',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Daze', onlyWithStatus: 'Burn' },
    },
  },
  // Squall's Turbine: every shot winds the machine. The Arrows' Charges are its limit.
  flywheel: {
    id: 'flywheel',
    name: 'Flywheel',
    description: 'When this hero looses an Arrow, it gains Mech Force 10.',
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', moveTag: 'arrow' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'MechForce', magnitude: 10 },
    },
  },
  // Tempest's Lightning Rod: the mark comes back, so Metallic Blade stays free and Live Wire keeps firing.
  returnStroke: {
    id: 'returnStroke',
    name: 'Return Stroke',
    description: 'When this hero sets off Conduct, a random enemy starts Conducting. Up to 3 times a fight.',
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Conduct' },
      maxFiresPerFight: 3,
    },
  },
  // Skyshear's Farsight: any hand's burst leaves a Haunt, and Psyshock reaches both through it.
  afterimage: {
    id: 'afterimage',
    name: 'Afterimage',
    description: "When an enemy's Conduct is set off, that enemy is Haunted.",
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Haunt' },
    },
  },
  // Nimbus's Raincloud: Rainmaker's Downpour soaks both foes for Nimbus's Storm hits.
  staticRain: {
    id: 'staticRain',
    name: 'Static Rain',
    description: 'When Downpour is set, both active enemies start Conducting.',
    reactive: {
      hook: 'FieldEffectSet',
      condition: { relativeTo: 'self', eventFieldEquals: { fieldEffectId: 'downpour' } },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Conduct' },
    },
  },
  // Kite's Seedwind: every arrival is sown and slowed, which is what Outpace wants.
  windsown: {
    id: 'windsown',
    name: 'Windsown',
    description: 'When an enemy enters the battlefield, it gains Poison 10 and loses SPD ▼.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'enemy' },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Poison', magnitude: 10, duration: 3 },
      alsoEffect: { kind: 'statDelta', target: 'triggerSubject', stat: 'speed', stages: -1 },
    },
  },
  // Raiju's Kamaitachi: Brushfire's sibling at the other door, a cut on the way in.
  sickleWind: {
    id: 'sickleWind',
    name: 'Sickle Wind',
    description: 'When this hero enters the battlefield, a random enemy starts Bleeding.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Bleed' },
    },
  },
  // Squall's Windshear, two passives and no move: the last Arrow flies first, and a full quiver bites.
  lastGust: {
    id: 'lastGust',
    name: 'Last Gust',
    description: "An Arrow with one Charge left goes at +1 priority.",
    chargeRider: { moveTag: 'arrow', when: 'last', priorityBonus: 1 },
  },
  keenFletching: {
    id: 'keenFletching',
    name: 'Keen Fletching',
    description: 'An Arrow with all its Charges leaves its target Bleeding.',
    chargeRider: { moveTag: 'arrow', when: 'full', statusId: 'Bleed' },
  },
};
