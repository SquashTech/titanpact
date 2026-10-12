import type { PassiveDefinition } from '../../engine/content';

export const ironPathPassives: Record<string, PassiveDefinition> = {
  // Warden's Lodestar: the blow it takes is the mending its partner gets.
  oathlight: {
    id: 'oathlight',
    name: 'Oathlight',
    description: "When this hero takes damage, its partner heals 10% of its max HP.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'ally', amount: { kind: 'percentMaxHp', value: 0.1 } },
    },
  },
  swornShield: {
    id: 'swornShield',
    name: 'Sworn Shield',
    description: "When this hero lands an attack, its partner gains Shield 20.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Shield', magnitude: 20 },
    },
  },
  gallop: {
    id: 'gallop',
    name: 'Gallop',
    description: 'When this hero lands an attack, it gains SPD ▲.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'self', stat: 'speed', stages: 1 },
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
    description: 'When an enemy enters the battlefield, this hero gains ATK ▲.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'enemy' },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', stages: 1 },
    },
  },
  unseenCut: {
    id: 'unseenCut',
    name: 'Unseen Cut',
    description: 'When this hero lands an attack, there is a 30% chance its target starts Bleeding.',
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
    description: 'When this hero lands an Arcane attack, its target is left Conducting.',
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
    description: "When an enemy\'s Conduct mark is set off, this hero gains INT ▲.",
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', stages: 1 },
    },
  },
  // Warden's Sunderer: the wall built to open other walls.
  shieldbreaker: {
    id: 'shieldbreaker',
    name: 'Shieldbreaker',
    description: 'Deals 50% bonus damage to a Shielded foe.',
    damageModifier: { requiresTargetStatuses: ['Shield'], amount: 0.5 },
  },
  // Valor's Galvanize: Storm Lash marks, Iron Fist sets it off, and the partner charges in behind.
  rallyingSpark: {
    id: 'rallyingSpark',
    name: 'Rallying Spark',
    description: 'When this hero sets off a Conduct mark, its partner gains Ambush 25.',
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Ambush', magnitude: 25 },
    },
  },
  // Gallant's Oathbound: the knight who mends rides harder for it.
  vowOfArms: {
    id: 'vowOfArms',
    name: 'Vow of Arms',
    description: 'When this hero heals, it gains ATK ▲ and SPD ▲.',
    reactive: {
      hook: 'Healed',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'speed'], stages: 1 },
    },
  },
  // Scallywag's Stormrunner: every mark it blows loads a gun for Broadside. 4 is Broadside's magazine.
  powderRun: {
    id: 'powderRun',
    name: 'Powder Run',
    description: 'When this hero sets off a Conduct mark, it loads a cannonball (up to 4).',
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Cannonball', magnitude: 1, maxMagnitude: 4 },
    },
  },
  // Ronin's Raijin: each bolt that fells one comes down faster and harder on the next.
  rollingThunder: {
    id: 'rollingThunder',
    name: 'Rolling Thunder',
    description: 'When this hero knocks out a foe, it gains ATK ▲ and SPD ▲.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', finishingBlow: true },
      effect: { kind: 'statDelta', target: 'self', stat: ['attack', 'speed'], stages: 1 },
    },
  },
  // Ferra's Railgun: Lodestone marks both, and each burst charges the coils for Overheat.
  coilGun: {
    id: 'coilGun',
    name: 'Coil Gun',
    description: 'When this hero sets off a Conduct mark, it gains Mech Force 10. Up to 3 times a fight.',
    reactive: {
      hook: 'StatusDetonated',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'MechForce', magnitude: 10 },
      maxFiresPerFight: 3,
    },
  },
};
