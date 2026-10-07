import type { PassiveDefinition } from '../../engine/content';

export const firePathPassives: Record<string, PassiveDefinition> = {
  // Cinder's Explosive. A Burn keeps the higher, so this is a floor under a fire already lit: it
  // keeps Immolate's triple live without ever stacking past what a move laid down.
  rekindle: {
    id: 'rekindle',
    name: 'Rekindle',
    description: 'When this hero lands a Fire attack on a Burning foe, that foe climbs a level of Burn.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Fire' }, eventTargetHasStatus: 'Burn' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Burn', magnitude: 1 },
    },
  },
  // Crimson's Cinderveil: the Spirit graft's own spread, laid by every Fire hit.
  emberVeil: {
    id: 'emberVeil',
    name: 'Ember Veil',
    description: 'When this hero lands a Fire attack, its target is Haunted.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Fire' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Haunt' },
    },
  },
  // Crimson's Pyroclasm, beside Firestarter: the fire it starts never touches its own side.
  flameproof: {
    id: 'flameproof',
    name: 'Flameproof',
    description: 'While this hero is active, your active heroes are immune to Burn.',
    sideRefusesStatuses: ['Burn'],
  },
  // Brimstone's Hexfume: Sulphur's entry, in poison.
  hexfume: {
    id: 'hexfume',
    name: 'Hexfume',
    description: 'When this hero enters the battlefield, both active enemies gain Poison 10.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Poison', magnitude: 10, duration: 3 },
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
  // Ashwing's Sunbird: Consecrate's Sanctuary stokes the bird it came from.
  dawnfire: {
    id: 'dawnfire',
    name: 'Dawnfire',
    description: 'When Sanctuary is set, this hero gains Fire Force 15. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'FieldEffectSet',
      condition: { relativeTo: 'self', eventFieldEquals: { fieldEffectId: 'sanctuary' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'FireForce', magnitude: 15 },
    },
  },
  // Ashwing's Ashen: Smoulder is what arms it — the phoenix rises whole.
  funeralPyre: {
    id: 'funeralPyre',
    name: 'Funeral Pyre',
    description: 'When this hero stands at 1 HP instead of being knocked out, it heals to full HP and refills its Mana.',
    reactive: {
      hook: 'Endured',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'percentMaxHp', value: 1 } },
      alsoEffect: { kind: 'restoreMana', target: 'self' },
    },
  },
  // Tinder's Headliner: Fire-Breather leaves one foe Badly Burned; a partner's Burns climb the rest.
  topBilling: {
    id: 'topBilling',
    name: 'Top Billing',
    description: 'This hero deals 15% more damage to a Burning foe for each level of Burn it holds.',
    damageModifier: { perTargetStatusLevel: 'Burn', amount: 0.15 },
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
