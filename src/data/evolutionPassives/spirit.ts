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
    description: "When this hero's partner lands an attack, this hero gains 10 Intelligence.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'ally', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', amount: 10 },
    },
  },
  spiritPack: {
    id: 'spiritPack',
    name: 'Spirit Pack',
    description: "At the end of each round, this hero's partner gains 10 Attack and 10 Speed.",
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'ally', stat: ['attack', 'speed'], amount: 10 },
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
};
