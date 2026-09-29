import type { PassiveDefinition } from '../../engine/content';

export const beastPathPassives: Record<string, PassiveDefinition> = {
  // Fang's Stonehide: Force is typed Base Power, so what it takes comes back only on a Stone swing.
  bedrockHide: {
    id: 'bedrockHide',
    name: 'Bedrock Hide',
    description: 'Whenever this hero takes damage, it gains Stone Force 10.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'StoneForce', magnitude: 10 },
    },
  },
  wellFed: {
    id: 'wellFed',
    name: 'Well Fed',
    description: 'Whenever this hero gains Renew, it gains 10 Attack.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Renew' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 10 },
    },
  },
  // Coil's Mesmer: StatChanged carries no source, so a partner's Lull arms it too. Serpent's Eye
  // is a passive's change and never chains into it.
  mesmerize: {
    id: 'mesmerize',
    name: 'Mesmerize',
    description: "Whenever an enemy's Intelligence drops, that enemy is Dazed.",
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'enemy', eventFieldEquals: { stat: 'intelligence' }, eventFieldNegative: 'delta' },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Daze' },
    },
  },
  graveMark: {
    id: 'graveMark',
    name: 'Grave Mark',
    description: 'Whenever this hero applies Bleed, that target is also Haunted.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Bleed' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Haunt' },
    },
  },
  troopLeader: {
    id: 'troopLeader',
    name: 'Troop Leader',
    description: "Whenever this hero attacks, its partner gains 10 Attack and 10 Speed.",
    reactive: {
      hook: 'MoveUsed',
      condition: { relativeTo: 'self', eventFieldEquals: { damaging: 'true' } },
      effect: { kind: 'statDelta', target: 'ally', stat: ['attack', 'speed'], amount: 10 },
    },
  },
  // Chest Beat on the way in, the canopy on the way out.
  closingCanopy: {
    id: 'closingCanopy',
    name: 'Closing Canopy',
    description: 'When this hero switches out, both active enemies lose 20 Speed.',
    reactive: {
      hook: 'SwitchedOut',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'speed', amount: -20 },
    },
  },
  broadBack: {
    id: 'broadBack',
    name: 'Broad Back',
    description: "Whenever this hero's partner takes damage, the partner gains Shield 15.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'ally' },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Shield', magnitude: 15 },
    },
  },
  // Renew heals what each application adds and lapses after two rounds, so the cap is a ceiling
  // the soak rises to and falls from, never a standing 10% a round.
  warmSpring: {
    id: 'warmSpring',
    name: 'Warm Spring',
    description: "At the end of each round, this hero's partner gains Renew 5%, up to 10%.",
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Renew', magnitude: 5, maxMagnitude: 10 },
    },
  },
};
