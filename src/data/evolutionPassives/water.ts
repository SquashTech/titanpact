import type { PassiveDefinition } from '../../engine/content';

export const waterPathPassives: Record<string, PassiveDefinition> = {
  // Riptide's Tidecaller. The line is hedged 55 / 59, so each hand feeds the other: alternate, and both grow.
  swell: {
    id: 'swell',
    name: 'Swell',
    description: 'When this hero lands a physical move, it gains 10 Intelligence. When it lands a magical move, it gains 10 Attack.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { category: 'physical' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', amount: 10 },
    },
    alsoReactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { category: 'magical' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 10 },
    },
  },
  // Pincer's Ironshell. Shield is scaled off Defense, so each plate thickens the next one.
  plating: {
    id: 'plating',
    name: 'Plating',
    description: 'When this hero gains Shield, it gains Iron Force 10. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Shield' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'IronForce', magnitude: 10 },
    },
  },
  // Leviathan's Tidebreaker: the rain is the tide coming in.
  tidalMass: {
    id: 'tidalMass',
    name: 'Tidal Mass',
    description: 'When Downpour is set, this hero gains Water Force 20. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'FieldEffectSet',
      condition: { relativeTo: 'self', eventFieldEquals: { fieldEffectId: 'downpour' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'WaterForce', magnitude: 20 },
    },
  },
  // Leviathan's Deepfrost: the rain freezes as it falls, and Glaciate is what breaks it.
  deepfrostRain: {
    id: 'deepfrostRain',
    name: 'Freezing Rain',
    description: 'When Downpour is set, both active enemies are Frozen.',
    reactive: {
      hook: 'FieldEffectSet',
      condition: { relativeTo: 'self', eventFieldEquals: { fieldEffectId: 'downpour' } },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Freeze' },
    },
  },
  // Leviathan's Stormwyrm: the Water hit plants the mark the Storm line cashes.
  stormDrinker: {
    id: 'stormDrinker',
    name: 'Storm Drinker',
    description: 'Every Water attack this hero lands leaves its target Conducting.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Water' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Conduct' },
    },
  },
  // Nautilus's Inkmind: every arrival clouds the water.
  inkCloud: {
    id: 'inkCloud',
    name: 'Ink Cloud',
    description: 'When this hero enters the battlefield, both active enemies lose 10 Intelligence and 10 Speed.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: ['intelligence', 'speed'], amount: -10 },
    },
  },
  // Kappa's Deep Pool: Brimming, shared with whoever stands beside it.
  sharedDish: {
    id: 'sharedDish',
    name: 'Shared Dish',
    description: 'When this hero is healed, Renew included, its partner gains 10 Attack and 10 Intelligence.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'ally', stat: ['attack', 'intelligence'], amount: 10 },
    },
    alsoReactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Renew', kind: 'heal' }, eventFieldPositive: 'amount' },
      effect: { kind: 'statDelta', target: 'ally', stat: ['attack', 'intelligence'], amount: 10 },
    },
  },
  // Kappa's Yokai: the dish spills over into a haunting.
  yokaiDish: {
    id: 'yokaiDish',
    name: 'Spilled Dish',
    description: 'When this hero is healed, Renew included, a random enemy is Haunted.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Haunt' },
    },
    alsoReactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Renew', kind: 'heal' }, eventFieldPositive: 'amount' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Haunt' },
    },
  },
  // Kappa's Snapper: the Water hit opens the wound the Beast line's Maul and Eviscerate double on.
  snappingJaw: {
    id: 'snappingJaw',
    name: 'Snapping Jaw',
    description: 'When this hero lands a Water attack, its target starts Bleeding.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Water' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Bleed' },
    },
  },
  // Selkie's Tidewife: rides the same trigger as Salt Tears, so a Renew she grants washes and walls.
  highWater: {
    id: 'highWater',
    name: 'High Water',
    description: 'When this hero grants Renew, whoever receives it also gains Shield 20.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Renew' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Shield', magnitude: 20 },
    },
  },
  // Selkie's Roane: the seal-wife slipping her skin on and off, leaving a blessing each time she comes ashore.
  drownedGift: {
    id: 'drownedGift',
    name: 'Drowned Gift',
    description: "When this hero enters the battlefield, its partner gains Renew 3.",
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Renew', magnitude: 3 },
    },
  },
};
