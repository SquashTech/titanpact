import type { PassiveDefinition } from '../../engine/content';

export const frostPathPassives: Record<string, PassiveDefinition> = {
  // Flurry's Blizzard: the ice plants the mark, Chain Lightning's spread cashes it on both.
  thundersnow: {
    id: 'thundersnow',
    name: 'Thundersnow',
    description: 'When an enemy is Frozen, it starts Conducting.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Freeze' } },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Conduct' },
    },
  },
  // Rime's Hoarsteel: Bitter Cold's ATK, and the hoarfrost plating with it.
  coldIron: {
    id: 'coldIron',
    name: 'Cold Iron',
    description: 'Against a Frozen foe, it gains DEF ▲.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventTargetHasStatus: 'Freeze' },
      effect: { kind: 'statDelta', target: 'self', stat: 'defense', stages: 1 },
    },
  },
  // Rime's Snowbound.
  rollingSnow: {
    id: 'rollingSnow',
    name: 'Rolling Snow',
    description: 'Gains ATK ▲ and SPD ▲.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', finishingBlow: true },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'speed'], stages: 1 },
    },
  },
  // Floe's Icebreaker: the Defense that freezes a foe through Pack Ice also plates the partner.
  coldHousing: {
    id: 'coldHousing',
    name: 'Cold Housing',
    description: "When this hero's Defense rises, its partner gains Shield 30.",
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'self', eventFieldEquals: { stat: 'defense' }, eventFieldPositive: 'delta' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Shield', magnitude: 30 },
    },
  },
  // Igloo's Snowfort: every arrival, the opening lead included.
  coldFront: {
    id: 'coldFront',
    name: 'Cold Front',
    description: 'A random enemy is Frozen.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Freeze' },
    },
  },
  // Igloo's Hearthglow: it lights its own hearth on the way in, and the fire thinks for it.
  warmHearth: {
    id: 'warmHearth',
    name: 'Warm Hearth',
    description: 'Sets itself Burning and gains ATK ▲▲.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Burn' },
      alsoEffect: { kind: 'statDelta', target: 'self', stat: 'attack', stages: 2 },
    },
  },
  // Flurry's Avalanche, beside Killing Frost: the Rest is the snow settling.
  snowfall: {
    id: 'snowfall',
    name: 'Snowfall',
    description: 'A random enemy is Frozen.',
    reactive: {
      hook: 'Rested',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Freeze' },
    },
  },
  // Tusk's Ice Age: the cold comes in with it. Force never clears on a switch, so each arrival stacks.
  wintersWeight: {
    id: 'wintersWeight',
    name: "Winter's Weight",
    description: 'Gains Frost Force 10.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'FrostForce', magnitude: 10 },
    },
  },
  // Tusk's Matriarch.
  matriarchsFury: {
    id: 'matriarchsFury',
    name: "Matriarch's Fury",
    description: "When this hero's partner takes damage, both active allies gain ATK ▲.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'ally' },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', stages: 1 },
      alsoEffect: { kind: 'statDelta', target: 'ally', stat: 'attack', stages: 1 },
    },
  },
  // Hush's Tundra Hunter: the frozen cannot find the owl. A spread is not aimed, and still lands.
  stillPrey: {
    id: 'stillPrey',
    name: 'Still Prey',
    description: "Frozen enemies can't aim a move at this hero. Spread moves still hit.",
    untargetableByStatus: 'Freeze',
  },
  // Hush's Athene.
  owlsGaze: {
    id: 'owlsGaze',
    name: "Owl's Gaze",
    description: 'Target loses WIS ▼.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { category: 'magical' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'wisdom', stages: -1 },
    },
  },
  // Flurry's Snow Spirit: whoever freezes is haunted, so Soul Rend reaches its partner too.
  wraithfrost: {
    id: 'wraithfrost',
    name: 'Wraithfrost',
    description: 'When an enemy is Frozen, it is Haunted.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Freeze' } },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Haunt' },
    },
  },
  // Rime's Hydrofreeze: the first Water hit freezes, so Bitter Cold pays on the next one.
  blackIce: {
    id: 'blackIce',
    name: 'Black Ice',
    description: 'Target is Frozen.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Water' } },
      oncePerFight: true,
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Freeze' },
    },
  },
  // Floe's Cryolattice: Wardblade's own Shield, cast across to the partner.
  refraction: {
    id: 'refraction',
    name: 'Refraction',
    description: 'When this hero gains Shield, its partner gains Shield 30.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Shield' } },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Shield', magnitude: 30 },
    },
  },
  // Igloo's Aurora.
  polarLight: {
    id: 'polarLight',
    name: 'Polar Light',
    description: 'Partner is washed of one affliction.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'cleanse', target: 'ally', count: 1 },
    },
  },
  // Tusk's Erratic: once Stampede has carried it past everyone, the boulder keeps rolling.
  headOfTheHerd: {
    id: 'headOfTheHerd',
    name: 'Head of the Herd',
    description: 'While this hero is faster than every other hero on the field, it has +10 MP Regen.',
    conditionalStatGrants: { requiresFastest: true, statGrants: { mpRegen: 10 } },
  },
  // Hush's Night Owl: the opening leads count, so it starts the fight with a strike banked.
  nightWatch: {
    id: 'nightWatch',
    name: 'Night Watch',
    description: 'When an enemy enters the battlefield, this hero gains Ambush 20.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'enemy' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Ambush', magnitude: 20 },
    },
  },
};
