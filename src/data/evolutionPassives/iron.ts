import type { PassiveDefinition } from '../../engine/content';

export const ironPathPassives: Record<string, PassiveDefinition> = {
  // Warden's Lodestar: the blow it takes is the mending its partner gets.
  oathlight: {
    id: 'oathlight',
    name: 'Oathlight',
    description: "Whenever this hero takes damage, its partner heals 10% of its max HP.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'ally', amount: { kind: 'percentMaxHp', value: 0.1 } },
    },
  },
  swornShield: {
    id: 'swornShield',
    name: 'Sworn Shield',
    description: "Whenever this hero lands an attack, its partner gains Shield 20.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Shield', magnitude: 20 },
    },
  },
  gallop: {
    id: 'gallop',
    name: 'Gallop',
    description: 'Whenever this hero lands an attack, it gains 10 Speed.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'self', stat: 'speed', amount: 10 },
    },
  },
  // Scallywag's Seawise: the bench is where Broadside loads, and now where the crew mends too.
  safeHarbour: {
    id: 'safeHarbour',
    name: 'Safe Harbour',
    description: 'On the bench, this hero heals 10% of its max HP each round.',
    reactive: {
      hook: 'RoundEnded',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'percentMaxHp', value: 0.1 } },
      whileBenched: true,
    },
  },
  readyStance: {
    id: 'readyStance',
    name: 'Ready Stance',
    description: 'Whenever an enemy enters the battlefield, this hero gains 15 Attack.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'enemy' },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 15 },
    },
  },
  unseenCut: {
    id: 'unseenCut',
    name: 'Unseen Cut',
    description: 'Whenever this hero lands an attack, there is a 30% chance its target starts Bleeding.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Bleed' },
      chance: 0.3,
    },
  },
  // Ferra's Magnetar. Arcane, not Iron: an Iron hit's reactions run before its own detonation, so an
  // Iron-planted mark would go off on the hit that planted it. This one waits for the Conjured Sword.
  ironFilings: {
    id: 'ironFilings',
    name: 'Iron Filings',
    description: 'Whenever this hero lands an Arcane attack, its target is left Conducting.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Arcane' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Conduct' },
    },
  },
  // Read off the mark, not the striker: a partner's Storm or Mech hit feeds it too.
  induction: {
    id: 'induction',
    name: 'Induction',
    description: 'Whenever an enemy\'s Conduct mark is set off, this hero gains 15 Intelligence.',
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', amount: 15 },
    },
  },
};
