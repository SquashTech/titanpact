import type { PassiveDefinition } from '../../engine/content';

export const mechPathPassives: Record<string, PassiveDefinition> = {
  // Clockwork's Furnace: Spark Plug plants the mark, Piston Punch cashes it, and now it catches.
  ignition: {
    id: 'ignition',
    name: 'Ignition',
    description: 'When this hero sets off a Conduct, its target is Burned.',
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Burn' },
    },
  },
  // Bellows' Bulkhead: Ironbound never leaves, so the partner beside it is always the one plated.
  blastDoor: {
    id: 'blastDoor',
    name: 'Blast Door',
    description: 'Partner gains Shield 20.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Shield', magnitude: 20 },
    },
  },
  unearthed: {
    id: 'unearthed',
    name: 'Unearthed',
    description: 'The first time this hero would be knocked out each fight, it stands at 1 HP instead and gains Shield 50.',
    enduresOnce: true,
    reactive: {
      hook: 'Endured',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Shield', magnitude: 50 },
    },
  },
  // Patch's Coolant: the heat Short Circuit and Backfire put into the enemy is drawn off to the partner.
  heatExchanger: {
    id: 'heatExchanger',
    name: 'Heat Exchanger',
    description: "When an enemy takes Burn damage, this hero's partner heals for the same amount.",
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Burn', kind: 'damage' } },
      effect: { kind: 'heal', target: 'ally', amount: { kind: 'matchTriggerAmount' } },
    },
  },
  // Abacus's Difference Engine: Perfect Creation lays both at once; Backfire and Malfunction build it.
  failureAnalysis: {
    id: 'failureAnalysis',
    name: 'Failure Analysis',
    description: 'Deals 50% more damage to an enemy that is both Burned and Poisoned.',
    damageModifier: { requiresTargetStatuses: ['Burn', 'Poison'], amount: 0.5 },
  },
  // Abacus's Arithmancer: the sum pays for the next — Mana, not a second ratio on top of Tally's.
  recitation: {
    id: 'recitation',
    name: 'Recitation',
    description: 'Gains 15 Mana, past its pool.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Arcane' } },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 15 } },
    },
  },
  // Whirr's Gyre: the refund is uncapped like every mana grant, which is how a 65 pool reaches Overdrive.
  mainspring: {
    id: 'mainspring',
    name: 'Mainspring',
    description: 'When this hero attacks, it gets back half the mana it spent.',
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', eventFieldEquals: { damaging: 'true' } },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'matchTriggerAmount', field: 'manaSpent', multiplier: 0.5 } },
    },
  },
  nectar: {
    id: 'nectar',
    name: 'Nectar',
    description: 'Heals 5% of its max HP.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'percentMaxHp', value: 0.05 } },
    },
  },
  // Clockwork's Cryogenics: the coolant lines frost over whatever it shields.
  rimePlating: {
    id: 'rimePlating',
    name: 'Rime Plating',
    description: 'When this hero gains Shield, its partner gains Shield 15.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Shield' } },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Shield', magnitude: 15 },
    },
  },
  // Bellows' Overpressure: Ironbound never leaves, so the valve blows where it stands.
  blowoffValve: {
    id: 'blowoffValve',
    name: 'Blowoff Valve',
    description: 'A random enemy is set Burning. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Burn' },
    },
  },
  // Rex's Primal: a lead or a replacement is fresh prey, and the first blow lands on it.
  scentOfPrey: {
    id: 'scentOfPrey',
    name: 'Scent of Prey',
    description: "When an enemy enters the battlefield, this hero's next attack goes at +1 priority.",
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'enemy' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Poised' },
    },
  },
  // Patch's Beacon: Consecrate lights both allies, and both move first after it.
  guidingLight: {
    id: 'guidingLight',
    name: 'Guiding Light',
    description: "When this hero heals an ally, that ally's next attack goes at +1 priority.",
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Poised' },
    },
  },
  // Abacus's Prognosticator: every swing it sees coming, the partner is braced for the next.
  forewarning: {
    id: 'forewarning',
    name: 'Forewarning',
    description: "When an enemy attacks, this hero's partner gains Shield 10.",
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'enemy', eventFieldEquals: { damaging: 'true' } },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Shield', magnitude: 10 },
    },
  },
  // Whirr's Sparkwing: the spark jumps on. The count stops a mark that re-arms itself.
  arcJump: {
    id: 'arcJump',
    name: 'Arc Jump',
    description: 'When this hero sets off a Conduct, a random enemy starts Conducting. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'StatusDetonated',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Conduct' },
    },
  },
};
