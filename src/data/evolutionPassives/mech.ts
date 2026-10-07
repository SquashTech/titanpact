import type { PassiveDefinition } from '../../engine/content';

export const mechPathPassives: Record<string, PassiveDefinition> = {
  // Clockwork's Furnace: Spark Plug plants the mark, Piston Punch cashes it, and now it catches.
  ignition: {
    id: 'ignition',
    name: 'Ignition',
    description: 'When this hero sets off a Conduct, its target climbs a level of Burn.',
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Burn', magnitude: 1 },
    },
  },
  // Bellows' Bulkhead: Ironbound never leaves, so the partner beside it is always the one plated.
  blastDoor: {
    id: 'blastDoor',
    name: 'Blast Door',
    description: "At the end of each round, this hero's partner gains Shield 20.",
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
  // Patch's Coolant: a Mech partner burns itself to cast (Backfire, Overheat, Steam Vent).
  heatSink: {
    id: 'heatSink',
    name: 'Heat Sink',
    description: "When this hero's partner is Burned, the partner gains Renew 3.",
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'ally', eventFieldEquals: { statusId: 'Burn' } },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Renew', magnitude: 3 },
    },
  },
  // Abacus's Difference Engine: Perfect Creation lays both at once; Backfire and Malfunction build it.
  failureAnalysis: {
    id: 'failureAnalysis',
    name: 'Failure Analysis',
    description: 'Deals 50% more damage to an enemy that is both Burned and Poisoned.',
    damageModifier: { requiresTargetStatuses: ['Burn', 'Poison'], amount: 0.5 },
  },
  recitation: {
    id: 'recitation',
    name: 'Recitation',
    description: 'When this hero lands a magical attack, both active enemies lose 5 Wisdom.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { category: 'magical' } },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'wisdom', amount: -5 },
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
    description: 'When this hero lands an attack, it heals 5% of its max HP.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'percentMaxHp', value: 0.05 } },
    },
  },
};
