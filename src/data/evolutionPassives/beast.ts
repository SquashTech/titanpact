import type { PassiveDefinition } from '../../engine/content';

export const beastPathPassives: Record<string, PassiveDefinition> = {
  // Fang's Ironhide: Force is typed Base Power, so what it takes comes back only on an Iron swing.
  ironHide: {
    id: 'ironHide',
    name: 'Iron Hide',
    description: 'Gains Iron Force 10. Up to 3 times a fight.',
    reactive: {
      maxFiresPerFight: 3,
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'IronForce', magnitude: 10 },
    },
  },
  // Ursa's Ursa Major: the great bear's kill lifts the whole sky.
  greatBear: {
    id: 'greatBear',
    name: 'Great Bear',
    description: 'Both allies gain ATK ▲.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', finishingBlow: true },
      effect: { kind: 'statDelta', target: 'bothAllies', stat: 'attack', stages: 1 },
    },
  },
  // Coil's Mesmer: StatChanged carries no source, so a partner's Lull arms it too. Serpent's Eye
  // is a passive's change and never chains into it.
  mesmerize: {
    id: 'mesmerize',
    name: 'Mesmerize',
    description: "When an enemy's Intelligence drops, that enemy is Dazed. Up to 3 times a fight.",
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'enemy', eventFieldEquals: { stat: 'intelligence' }, eventFieldNegative: 'delta' },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Daze' },
      maxFiresPerFight: 3,
    },
  },
  // Vex's Sonar: the echo finds the gap the wound opened.
  echo: {
    id: 'echo',
    name: 'Echo',
    description: 'When this hero applies Bleed, that target also loses DEF ▼.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Bleed' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'defense', stages: -1 },
    },
  },
  troopLeader: {
    id: 'troopLeader',
    name: 'Troop Leader',
    description: 'When this hero attacks, its partner gains ATK ▲ and SPD ▲.',
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', eventFieldEquals: { damaging: 'true' } },
      effect: { kind: 'statDelta', target: 'ally', stat: ['attack', 'speed'], stages: 1 },
    },
  },
  // Chest Beat on the way in, the canopy on the way out.
  closingCanopy: {
    id: 'closingCanopy',
    name: 'Closing Canopy',
    description: 'Both foes lose SPD ▼▼.',
    reactive: {
      hook: 'SwitchedOut',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'speed', stages: -2 },
    },
  },
  broadBack: {
    id: 'broadBack',
    name: 'Broad Back',
    description: "When this hero's partner takes damage, the partner gains Shield 15.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'ally' },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Shield', magnitude: 15 },
    },
  },
  // Mellow's Hot Spring: the soak is paid for with the turn a Rest spends (docs/timed-statuses.md §6).
  warmSpring: {
    id: 'warmSpring',
    name: 'Warm Spring',
    description: 'Both allies gain Renew.',
    reactive: {
      hook: 'Rested',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Renew' },
      alsoEffect: { kind: 'applyStatus', target: 'ally', statusId: 'Renew' },
    },
  },
  // Mellow's Meadow: Sow's Renew settles the partner as well as mending it.
  greenPasture: {
    id: 'greenPasture',
    name: 'Green Pasture',
    description: "When this hero's partner gains Renew, the partner gains DEF ▲ and WIS ▲.",
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'ally', eventFieldEquals: { statusId: 'Renew' } },
      effect: { kind: 'statDelta', target: 'triggerSubject', stat: ['defense', 'wisdom'], stages: 1 },
    },
  },
  // Fang's Warhowl: Pack Hunter in reverse — its Haunt arms the partner whose hits arm it.
  ghostChorus: {
    id: 'ghostChorus',
    name: 'Ghost Chorus',
    description: 'When this hero Haunts a foe, its partner gains ATK ▲ and INT ▲.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Haunt' } },
      effect: { kind: 'statDelta', target: 'ally', stat: ['attack', 'intelligence'], stages: 1 },
    },
  },
  // Ursa's Polar: any hand's Freeze is a seal on the ice, and the slow bear closes in.
  sealHunt: {
    id: 'sealHunt',
    name: 'Seal Hunt',
    description: 'When an enemy is Frozen, this hero gains ATK ▲ and SPD ▲.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Freeze' } },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'speed'], stages: 1 },
    },
  },
  // Coil's Spitfire: the venom burns, and what it burns cannot strike back as hard.
  hoodFlare: {
    id: 'hoodFlare',
    name: 'Hood Flare',
    description: 'Target loses ATK ▼.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Fire' } },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'attack', stages: -1 },
    },
  },
  // Vex's Vampyr: Dusk Blade opens the vein the next bite drinks from.
  nightThirst: {
    id: 'nightThirst',
    name: 'Night Thirst',
    description: 'This hero deals 30% more damage to a Bleeding foe.',
    damageModifier: { requiresTargetStatuses: ['Bleed'], amount: 0.3 },
  },
  // Kong's Stonefist: what Rubble Rush breaks off the ground hits both of them.
  flyingRubble: {
    id: 'flyingRubble',
    name: 'Flying Rubble',
    description: 'Both foes lose 5% of their max HP.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Stone' } },
      effect: { kind: 'damage', target: 'activeEnemies', percentMaxHp: 0.05 },
    },
  },
};
