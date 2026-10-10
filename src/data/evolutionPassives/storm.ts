import type { PassiveDefinition } from '../../engine/content';

export const stormPathPassives: Record<string, PassiveDefinition> = {
  // Squall's Dust Devil: per hit, so a spread pays on both foes.
  thornshot: {
    id: 'thornshot',
    name: 'Thornshot',
    description: 'Every attack this hero lands leaves Poison 10 on its target.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Poison', magnitude: 10, duration: 3 },
    },
  },
  // Tempest's Ionosphere: an uncapped grant, so the overflow is what reaches the Late column.
  storedCharge: {
    id: 'storedCharge',
    name: 'Stored Charge',
    description: 'At the end of each round, this hero gains 10 mana, past its pool.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 10 } },
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
    description: 'When this hero takes damage, it gains INT ▲. Once a round, up to 3 times a fight.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', stages: 1, perFight: 3 },
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
  // Kite's Lantern Kite: Headwind's trigger, pointed at its own side.
  gildedString: {
    id: 'gildedString',
    name: 'Gilded String',
    description: 'When this hero uses a move that deals no damage, its partner gains ATK ▲ and INT ▲. Once a round, up to 3 times a fight.',
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', eventFieldEquals: { damaging: 'false' } },
      effect: { kind: 'statDelta', target: 'ally', stat: ['attack', 'intelligence'], stages: 1, perFight: 3 },
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
  // Raiju's Heat Lightning: Static Wake's moment, leaving fire where it left static.
  brushfire: {
    id: 'brushfire',
    name: 'Brushfire',
    description: 'When this hero switches out, both active enemies are set Burning.',
    reactive: {
      hook: 'SwitchedOut',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Burn' },
    },
  },
  // Squall's Turbine: Rising Static plants, Cog Slam or an Arrow cashes, the quiver winds back.
  autoloader: {
    id: 'autoloader',
    name: 'Autoloader',
    description: 'When this hero sets off Conduct, each of its Arrows gets a Charge back. Up to 3 times a fight.',
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'restoreCharge', target: 'self', amount: 1, moveTag: 'arrow' },
      maxFiresPerFight: 3,
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
};
