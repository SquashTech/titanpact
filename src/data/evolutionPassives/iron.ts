import type { PassiveDefinition } from '../../engine/content';

export const ironPathPassives: Record<string, PassiveDefinition> = {
  // Warden's Lodestar: the blow it takes is the mending its partner gets.
  oathlight: {
    id: 'oathlight',
    name: 'Oathlight',
    description: 'Partner heals 10% of its max HP.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'ally', amount: { kind: 'percentMaxHp', value: 0.1 } },
    },
  },
  swornShield: {
    id: 'swornShield',
    name: 'Sworn Shield',
    description: 'Partner gains Shield 20.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Shield', magnitude: 20 },
    },
  },
  gallop: {
    id: 'gallop',
    name: 'Gallop',
    description: "The target's partner loses DEF ▼.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'statDelta', target: 'triggerTargetPartner', stat: 'defense', stages: -1 },
    },
  },
  // Scallywag's Seawise: putting into harbour mends the crew — on the switch, not from the bench (no bench passives).
  safeHarbour: {
    id: 'safeHarbour',
    name: 'Safe Harbour',
    description: 'Heals 25% of its max HP.',
    reactive: {
      hook: 'SwitchedOut',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'percentMaxHp', value: 0.25 } },
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
    description: 'The first on each foe leaves it Bleeding.',
    reactive: {
      oncePerTarget: true,
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source' },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Bleed' },
    },
  },
  // Ferra's Magnetar. Arcane, not Iron: an Iron hit's reactions run before its own detonation, so an
  // Iron-planted mark would go off on the hit that planted it. This one waits for the Conjured Sword.
  ironFilings: {
    id: 'ironFilings',
    name: 'Iron Filings',
    description: 'Target is left Conducting.',
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
  // Warden's Rootbreaker: the wall built to open other walls — a Shield is no wall to it.
  shieldbreaker: {
    id: 'shieldbreaker',
    name: 'Shieldbreaker',
    description: "This hero's attacks go straight through Shield, and deal 30% more damage to a Shielded foe.",
    piercesShield: true,
    damageModifier: { requiresTargetStatuses: ['Shield'], amount: 0.3 },
  },
  // Valor's Forgeheart: Molten Lash lights the foe, and the partner charges in behind the flame.
  rallyingFlame: {
    id: 'rallyingFlame',
    name: 'Rallying Flame',
    description: 'When this hero sets a foe Burning, its partner gains Ambush 25.',
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Burn' } },
      effect: { kind: 'applyStatus', target: 'ally', statusId: 'Ambush', magnitude: 25 },
    },
  },
  // Gallant's Dullahan: the headless rider arrives, and both foes are marked for it.
  dreadCharge: {
    id: 'dreadCharge',
    name: 'Dread Charge',
    description: 'Both foes are Haunted.',
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'activeEnemies', statusId: 'Haunt' },
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
  // Ronin's Winter Edge: each cut that fells one comes down faster and harder on the next.
  rollingThunder: {
    id: 'rollingThunder',
    name: 'Cold Steel',
    description: 'Gains ATK ▲ and SPD ▲.',
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
