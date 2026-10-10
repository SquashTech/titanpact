import type { PassiveDefinition } from '../../engine/content';

export const spiritPathPassives: Record<string, PassiveDefinition> = {
  // Revenant's Wraithblade: the hands plant the mark Ghostlight reads, so the rewired ghost feeds itself.
  graveHands: {
    id: 'graveHands',
    name: 'Grave Hands',
    description: 'When this hero lands a physical attack, its target is Haunted.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { category: 'physical' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Haunt' },
    },
  },
  // Sorrow's Banshee: on the roster's fastest blade, a flinch that usually lands before the foe moves.
  shriek: {
    id: 'shriek',
    name: 'Shriek',
    description: 'When this hero lands an attack, there is a 30% chance its target is Dazed.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Daze' },
      chance: 0.3,
    },
  },
  carrion: {
    id: 'carrion',
    name: 'Carrion',
    description: 'When this hero lands an attack on a Haunted foe, it heals 10% of its max HP.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventTargetHasStatus: 'Haunt' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'percentMaxHp', value: 0.1 } },
    },
  },
  // Kitsu's Ninetails: Foxfire lights them, this is what the lighting was for.
  oldFire: {
    id: 'oldFire',
    name: 'Old Fire',
    description: 'Deals 30% bonus damage to a Burning foe.',
    damageModifier: { requiresTargetStatuses: ['Burn'], amount: 0.3 },
  },
  // Kitsu's Trickster: the decoy left behind binds the pair, for the partner's Spirit and Mind hits to spread.
  borrowedFace: {
    id: 'borrowedFace',
    name: 'Borrowed Face',
    description: 'When this hero switches out, both active enemies are Haunted.',
    reactive: {
      hook: 'SwitchedOut',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Haunt' },
    },
  },
  eldestFace: {
    id: 'eldestFace',
    name: 'Eldest Face',
    description: "When this hero's partner lands an attack, this hero gains INT ▲. Once a round, up to 3 times a fight.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'ally', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', stages: 1, perFight: 3 },
    },
  },
  spiritPack: {
    id: 'spiritPack',
    name: 'Spirit Pack',
    description: "At the end of each round, this hero's partner gains ATK ▲ and SPD ▲. Up to 3 times a fight.",
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'ally', stat: ['attack', 'speed'], stages: 1, perFight: 3 },
    },
  },
  // Keen's Harbinger: Last Rites costs 50, so a kill pays for the next one.
  deathKnell: {
    id: 'deathKnell',
    name: 'Death Knell',
    description: 'When this hero knocks out a foe, it gains 50 Mana, past its pool.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', finishingBlow: true },
      effect: { kind: 'manaGrant', target: 'self', amount: { kind: 'flat', value: 50 } },
    },
  },
  graveFrost: {
    id: 'graveFrost',
    name: 'Grave Frost',
    description: 'When this hero Freezes an enemy, that enemy is Haunted.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Freeze' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Haunt' },
    },
  },
  // Revenant's Soulbinder: Wicked Fear binds the soul, and every hit on it wears the will thinner.
  soulChain: {
    id: 'soulChain',
    name: 'Soul Chain',
    description: 'When this hero lands an attack on a Haunted foe, that foe loses WIS ▼. Once a round, up to 3 times a fight.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventTargetHasStatus: 'Haunt' },
      effect: { kind: 'statDelta', target: 'triggerTarget', stat: 'wisdom', stages: -1, perFight: 3 },
    },
  },
  // Sorrow's Dirge: Torment marks the pair, Psionic Wave sings to both, and the song swells.
  mourningSong: {
    id: 'mourningSong',
    name: 'Mourning Song',
    description: 'When this hero lands an attack on a Haunted foe, it gains INT ▲. Once a round, up to 3 times a fight.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventTargetHasStatus: 'Haunt' },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', stages: 1, perFight: 3 },
    },
  },
  // Dread's Ironfeather: Reinforce raises its Defense, and the wings close over the partner.
  mantling: {
    id: 'mantling',
    name: 'Mantling',
    description: "When this hero's Defense rises, its partner gains Shield 30. Up to 3 times a fight.",
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'self', eventFieldEquals: { stat: 'defense' }, eventFieldPositive: 'delta' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Shield', magnitude: 30 },
      maxFiresPerFight: 3,
    },
  },
  // Kitsu's Emberfox: Foxfire lights the one it hits, and the fire jumps to its partner.
  spreadingFlame: {
    id: 'spreadingFlame',
    name: 'Spreading Flame',
    description: 'When this hero lands an attack on a Burning foe, both active enemies are set Burning, unless they already are.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventTargetHasStatus: 'Burn' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Burn', onlyIfAbsent: true },
    },
  },
  // Totem's Old Growth: every mend it gives grows a ring of bark on the old pole.
  livingBark: {
    id: 'livingBark',
    name: 'Living Bark',
    description: 'When this hero heals, it gains Shield equal to the HP it restored. Up to 4 times a fight.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Shield', magnitude: { kind: 'matchTriggerAmount' } },
      maxFiresPerFight: 4,
    },
  },
  // Keen's Shroud: it steps out of the dark untouchable, long enough to cast.
  nightveil: {
    id: 'nightveil',
    name: 'Nightveil',
    description: 'When this hero enters the battlefield, it gains Barrier for the rest of the round. Twice a fight.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Barrier' },
      maxFiresPerFight: 2,
    },
  },
};
