import type { PassiveDefinition } from '../../engine/content';

export const firePathPassives: Record<string, PassiveDefinition> = {
  // Cinder's Explosive. A Burn keeps the higher, so this is a floor under a fire already lit: it
  // keeps Immolate's triple live without ever stacking past what a move laid down.
  rekindle: {
    id: 'rekindle',
    name: 'Rekindle',
    description: 'When this hero lands a Fire attack on a Burning foe, that foe gains Burn 10%.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Fire' }, eventTargetHasStatus: 'Burn' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Burn', magnitude: 10 },
    },
  },
  // Crimson's Cinderveil.
  emberVeil: {
    id: 'emberVeil',
    name: 'Ember Veil',
    description: 'When this hero afflicts Burn, it gains Shield 20.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Burn' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Shield', magnitude: 20 },
    },
  },
  // Brimstone's Rotflame: the fire feeds the rot Grim Harvest reaps.
  witchsBrew: {
    id: 'witchsBrew',
    name: "Witch's Brew",
    description: 'When an enemy takes Burn damage, it gains Poison 5.',
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Burn', kind: 'damage' } },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Poison', magnitude: 5, duration: 3 },
    },
  },
  // Ashwing's Firebird.
  risingFlame: {
    id: 'risingFlame',
    name: 'Rising Flame',
    description: 'When this hero enters the battlefield, it gains Fire Force 15. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'FireForce', magnitude: 15 },
    },
  },
  // Ashwing's Ashen: Smoulder is what arms it.
  funeralPyre: {
    id: 'funeralPyre',
    name: 'Funeral Pyre',
    description: 'When this hero stands at 1 HP instead of being knocked out, both active enemies gain Burn 20%.',
    reactive: {
      hook: 'Endured',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Burn', magnitude: 20 },
    },
  },
  // Tinder's Headliner: Fire-Breather lights the whole far side, and this is what that is for.
  topBilling: {
    id: 'topBilling',
    name: 'Top Billing',
    description: 'This hero deals 30% more damage to a Burning foe.',
    damageModifier: { requiresTargetStatuses: ['Burn'], amount: 0.3 },
  },
  // Tinder's Limelight. Daze only bites before the foe has acted, which the roster's fastest hero usually is.
  footlights: {
    id: 'footlights',
    name: 'Footlights',
    description: 'When this hero lands a Fire attack, its target is Dazed 25% of the time.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Fire' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Daze' },
      chance: 0.25,
    },
  },
};
