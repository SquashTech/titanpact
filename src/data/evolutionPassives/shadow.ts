import type { PassiveDefinition } from '../../engine/content';

export const shadowPathPassives: Record<string, PassiveDefinition> = {
  // Marrow's Carrion: tends the rot so Eclipse arrives on a foe already half gone.
  festering: {
    id: 'festering',
    name: 'Festering',
    description: 'Against a Poisoned foe, that foe gains Poison 10.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventTargetHasStatus: 'Poison' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Poison', magnitude: 10, duration: 3 },
    },
  },
  // Marrow's Ashenwell.
  ashenPyre: {
    id: 'ashenPyre',
    name: 'Pyre',
    description: 'When an enemy takes Poison damage, it is Burned.',
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Poison', kind: 'damage' } },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Burn' },
    },
  },
  // Nightshade's Penumbra: beside Shadowmeld's arrival Ambush, the loaded blow also goes first.
  halfSeen: {
    id: 'halfSeen',
    name: 'Half-Seen',
    description: 'Becomes Poised.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Poised' },
    },
  },
  // Jinx's Black Cat: Deepgrip's verb on every hit.
  misfortune: {
    id: 'misfortune',
    name: 'Misfortune',
    description: 'Every move its target holds costs 10 more Mana for the rest of the fight, up to 30.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'manaSurcharge', target: 'triggerTarget', amount: 10, max: 30 },
    },
  },
  // Jinx's Nekomata.
  secondTail: {
    id: 'secondTail',
    name: 'Second Tail',
    description: 'The first time this hero would be knocked out each fight, it stands at 1 HP instead, and both active enemies are Haunted.',
    enduresOnce: true,
    reactive: {
      hook: 'Endured',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Haunt' },
    },
  },
  // Murk's Lurker: Murk's shallow pool makes it Rest often, and Shadowstrike cashes the wait first.
  stillWater: {
    id: 'stillWater',
    name: 'Still Water',
    description: 'Gains Ambush 40.',
    reactive: {
      hook: 'Rested',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Ambush', magnitude: 40 },
    },
  },
  // Murk's Drowner.
  heldUnder: {
    id: 'heldUnder',
    name: 'Held Under',
    description: 'Target loses DEF ▼ and SPD ▼.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: ['defense', 'speed'], stages: -1 },
    },
  },
  // Rook's Coven: any curse counts, her partner's included — a table of witches, not one.
  witchmark: {
    id: 'witchmark',
    name: 'Witchmark',
    description: 'When a move lowers an enemy stat, that enemy gains Poison 5.',
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'enemy', eventFieldNegative: 'delta' },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Poison', magnitude: 5, duration: 3 },
    },
  },
  // Rook's Hedge Witch: every curse it lays feeds the dark it casts with (per user direction, 2026-10-12).
  hexcraft: {
    id: 'hexcraft',
    name: 'Hexcraft',
    description: "When this hero lowers an enemy's stat, it gains Shadow Force 10.",
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldNegative: 'delta' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'ShadowForce', magnitude: 10 },
    },
  },
  // Widow's Carapace: the shell takes the first blow, and Apex Predator doubles the step.
  chitin: {
    id: 'chitin',
    name: 'Chitin',
    description: 'Gains Shield 30 and ATK ▲.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Shield', magnitude: 30 },
      alsoEffect: { kind: 'statDelta', target: 'self', stat: 'attack', stages: 1 },
    },
  },
  // Marrow's Ossuary: a Poison that goes off seeds the next, and Necrosis drinks each one.
  charnel: {
    id: 'charnel',
    name: 'Charnel',
    description: 'When an enemy takes Poison damage, both active enemies gain Poison 10. Up to 3 times a fight.',
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Poison', kind: 'damage' } },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Poison', magnitude: 10, duration: 3 },
      maxFiresPerFight: 3,
    },
  },
  // Nightshade's Hemlock: Corrode's Poison numbs before the foe can swing.
  paralytic: {
    id: 'paralytic',
    name: 'Paralytic',
    description: 'When this hero Poisons an enemy, that enemy is Dazed. Up to 2 times a fight.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Poison' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Daze' },
      maxFiresPerFight: 2,
    },
  },
  // Jinx's Lucky Cat: Bad Luck's mirror, fortune for its own side.
  beckoningPaw: {
    id: 'beckoningPaw',
    name: 'Beckoning Paw',
    description: '20% chance both allies gain ▲ to every stat.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'bothAllies', stat: ['attack', 'defense', 'intelligence', 'wisdom', 'speed'], stages: 1 },
      chance: 0.2,
    },
  },
  // Murk's Bog Iron: the swamp rusts a hide onto the slow wall, a layer a blow.
  rustcoat: {
    id: 'rustcoat',
    name: 'Rustcoat',
    description: 'Gains Shield 10.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Shield', magnitude: 10 },
    },
  },
  // Rook's Augur: every curse marks a soul, and a Mind attack carries across it.
  crowsign: {
    id: 'crowsign',
    name: 'Crowsign',
    description: 'When this hero uses a move that deals no damage, a random enemy is Haunted.',
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', eventFieldEquals: { damaging: 'false' } },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Haunt' },
    },
  },
};
