import type { PassiveDefinition } from '../../engine/content';

export const waterPathPassives: Record<string, PassiveDefinition> = {
  // Riptide's Tidecaller. Both columns, since the line it swings is hedged 55 / 59.
  swell: {
    id: 'swell',
    name: 'Swell',
    description: 'When this hero lands a Water attack, it gains 5 Attack, 5 Intelligence and 5 Speed.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Water' } },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'intelligence', 'speed'], amount: 5 },
    },
  },
  // Pincer's Ironshell. Shield is scaled off Defense, so each plate thickens the next one.
  plating: {
    id: 'plating',
    name: 'Plating',
    description: 'When this hero gains Shield, it gains 10 Defense.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Shield' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'defense', amount: 10 },
    },
  },
  // Leviathan's Tidebreaker: Overchannel's overflow is what buys the big casts that feed it.
  tidalMass: {
    id: 'tidalMass',
    name: 'Tidal Mass',
    description: 'When this hero uses a move, it gains Water Force equal to a fifth of the Mana it spent. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'MoveUsed',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'WaterForce', magnitude: { kind: 'matchTriggerAmount', field: 'manaSpent', multiplier: 0.2 } },
    },
  },
  // Leviathan's Stormwyrm.
  stormDrinker: {
    id: 'stormDrinker',
    name: 'Storm Drinker',
    description: 'When this hero sets off Conduct, it gains 30 Mana, past its pool.',
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 30 } },
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
    description: 'When this hero is healed, its partner gains 10 Attack and 10 Intelligence.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'ally', stat: ['attack', 'intelligence'], amount: 10 },
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
  // Selkie's Roane.
  drownedGift: {
    id: 'drownedGift',
    name: 'Drowned Gift',
    description: "When a hit knocks out a foe, this hero's partner gains Renew 10%.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'enemy', finishingBlow: true },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Renew', magnitude: 10 },
    },
  },
};
