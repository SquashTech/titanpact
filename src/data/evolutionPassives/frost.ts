import type { PassiveDefinition } from '../../engine/content';

export const frostPathPassives: Record<string, PassiveDefinition> = {
  // Flurry's Blizzard: a live grant, so it holds exactly as long as her Deep Chill does.
  bedrockIce: {
    id: 'bedrockIce',
    name: 'Bedrock Ice',
    description: 'This hero has +20 Defense and +20 Wisdom while an enemy is Frozen.',
    conditionalStatGrants: {
      requiresEnemyStatus: 'Freeze',
      statGrants: { defense: 20, wisdom: 20 },
    },
  },
  // Rime's Snowbound.
  rollingSnow: {
    id: 'rollingSnow',
    name: 'Rolling Snow',
    description: 'When this hero knocks out an enemy, it gains 20 Attack and 20 Speed.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', finishingBlow: true },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'speed'], amount: 20 },
    },
  },
  // Floe's Icebreaker.
  coldHousing: {
    id: 'coldHousing',
    name: 'Cold Housing',
    description: 'At the end of each round, this hero gains Shield 20.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Shield', magnitude: 20 },
    },
  },
  // Igloo's Snowfort: every arrival, the opening lead included.
  coldFront: {
    id: 'coldFront',
    name: 'Cold Front',
    description: 'When this hero enters the battlefield, a random enemy is Frozen.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Freeze' },
    },
  },
  // Igloo's Hearthglow: target-role StatusApplied, so its own Provoke arms it — the hearth bites whoever comes knocking.
  portcullis: {
    id: 'portcullis',
    name: 'Warm Hearth',
    description: 'When this hero becomes Provoking, both active enemies are set Burning.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Provoke' } },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Burn' },
    },
  },
  // Flurry's Avalanche, beside Killing Frost: the Rest is the snow settling.
  snowfall: {
    id: 'snowfall',
    name: 'Snowfall',
    description: 'When this hero Rests, a random enemy is Frozen.',
    reactive: {
      hook: 'Rested',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Freeze' },
    },
  },
  // Tusk's Ice Age: rolled per Frost hit, so a slow body buys the turn order back.
  wintersWeight: {
    id: 'wintersWeight',
    name: "Winter's Weight",
    description: 'When this hero lands a Frost attack, there is a 30% chance its target is Frozen.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Frost' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Freeze' },
      chance: 0.3,
    },
  },
  // Tusk's Matriarch.
  matriarchsFury: {
    id: 'matriarchsFury',
    name: "Matriarch's Fury",
    description: "When this hero's partner takes damage, both active allies gain 10 Attack.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'ally' },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 10 },
      alsoEffect: { kind: 'statDelta', target: 'ally', stat: 'attack', amount: 10 },
    },
  },
  // Hush's Tundra Hunter.
  stillPrey: {
    id: 'stillPrey',
    name: 'Still Prey',
    description: "This hero's attacks deal 30% more damage to a Frozen enemy.",
    damageModifier: { requiresTargetStatuses: ['Freeze'], amount: 0.3 },
  },
  // Hush's Athene.
  owlsGaze: {
    id: 'owlsGaze',
    name: "Owl's Gaze",
    description: 'When this hero lands a magical attack, its target loses 10 Wisdom.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { category: 'magical' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'wisdom', amount: -10 },
    },
  },
};
