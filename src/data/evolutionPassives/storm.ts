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
    description: 'When this hero takes damage, it gains 10 Intelligence.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', amount: 10 },
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
    description: "When this hero uses a move that deals no damage, its partner gains 15 Attack and 15 Intelligence.",
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', eventFieldEquals: { damaging: 'false' } },
      effect: { kind: 'statDelta', target: 'ally', stat: ['attack', 'intelligence'], amount: 15 },
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
};
