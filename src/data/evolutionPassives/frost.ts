import type { PassiveDefinition } from '../../engine/content';

export const frostPathPassives: Record<string, PassiveDefinition> = {
  // Flurry's Glacier: a live grant, so it holds exactly as long as her Deep Chill does.
  bedrockIce: {
    id: 'bedrockIce',
    name: 'Bedrock Ice',
    description: 'This hero has +20 Defense and +20 Wisdom while an enemy is Frozen.',
    conditionalStatGrants: {
      requiresEnemyStatus: 'Freeze',
      statGrants: { defense: 20, wisdom: 20 },
    },
  },
  // Rime's Avalanche.
  rollingSnow: {
    id: 'rollingSnow',
    name: 'Rolling Snow',
    description: 'Whenever this hero knocks out an enemy, it gains 20 Attack and 20 Speed.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', finishingBlow: true },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'speed'], amount: 20 },
    },
  },
  // Floe's Permafrost Core.
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
  // Igloo's Glacier: every arrival, the opening lead included.
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
  // Igloo's Keep: target-role StatusApplied, so its own Provoke (or the Stone line's Bodyguard) arms it.
  portcullis: {
    id: 'portcullis',
    name: 'Portcullis',
    description: 'Whenever this hero becomes Provoking, it gains Shield 30.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Provoke' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Shield', magnitude: 30 },
    },
  },
  // Tusk's Ice Age: rolled per Frost hit, so a slow body buys the turn order back.
  wintersWeight: {
    id: 'wintersWeight',
    name: "Winter's Weight",
    description: 'Whenever this hero lands a Frost attack, there is a 30% chance its target is Frozen.',
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
    description: "Whenever this hero's partner takes damage, this hero gains 10 Attack.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'ally' },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 10 },
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
    description: 'Whenever this hero lands a magical attack, its target loses 10 Wisdom.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { category: 'magical' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'wisdom', amount: -10 },
    },
  },
};
