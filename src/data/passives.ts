// Passive catalog, grouped by where a passive comes from. `passives` is the single lookup every
// screen and resolveRound import, so the Class catalog (classes.ts) is merged in here too.

import type { PassiveDefinition } from '../engine/content';
import { classes } from './classes';

// --- Fixture passives (sanguine: Lucius's Evolution; emberheart: relic) ---
const fixturePassives: Record<string, PassiveDefinition> = {
  sanguine: {
    id: 'sanguine',
    name: 'Sanguine',
    description: 'Whenever an enemy takes Bleed damage, this hero heals for the same amount.',
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Bleed', kind: 'damage' } },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'matchTriggerAmount' } },
    },
  },
  emberheart: {
    id: 'emberheart',
    name: 'Emberheart',
    description: 'Deals 20% bonus damage with Fire-type moves.',
    damageModifier: { eventFieldEquals: { moveType: 'Fire' }, amount: 0.2 },
  },
};

// --- Equipment-granted (equipment.ts grantsPassiveIds) ---
const equipmentPassives: Record<string, PassiveDefinition> = {
  bloodthirst: {
    id: 'bloodthirst',
    name: 'Bloodthirst',
    description: "Whenever this hero's side deals damage to an enemy, heal this hero for 15% of that damage.",
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'enemy' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'matchTriggerAmount', multiplier: 0.15 } },
    },
  },
  wardensVigil: {
    id: 'wardensVigil',
    name: "Warden's Vigil",
    description: 'Whenever this hero takes damage, heal for 10% of that damage.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'matchTriggerAmount', multiplier: 0.1 } },
    },
  },
  vengefulEmblem: {
    id: 'vengefulEmblem',
    name: 'Vengeful Emblem',
    description: 'Whenever this hero takes damage, gain +5 Attack.',
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 5 },
    },
  },
  stormcallersFocus: {
    id: 'stormcallersFocus',
    name: "Stormcaller's Focus",
    description: 'Deals 20% bonus damage with Storm-type moves.',
    damageModifier: { eventFieldEquals: { moveType: 'Storm' }, amount: 0.2 },
  },
  frostbrand: {
    id: 'frostbrand',
    name: 'Frostbrand',
    description: 'Deals 20% bonus damage with Frost-type moves.',
    damageModifier: { eventFieldEquals: { moveType: 'Frost' }, amount: 0.2 },
  },
  shadowfang: {
    id: 'shadowfang',
    name: 'Shadowfang',
    description: 'Deals 20% bonus damage with Shadow-type moves.',
    damageModifier: { eventFieldEquals: { moveType: 'Shadow' }, amount: 0.2 },
  },
};

// --- Event-granted (events.ts grantPassive) ---
const eventPassives: Record<string, PassiveDefinition> = {
  imposingPresence: {
    id: 'imposingPresence',
    name: 'Imposing Presence',
    description: 'When this hero enters the battlefield, enemies lose 10 Attack.',
    // SwitchedIn's subject is the INCOMING combatant, so relativeTo 'self' = this hero arriving.
    // Fires on every arrival, the opening lead included — unbounded within a fight by design.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'attack', amount: -10 },
    },
  },
};

// --- Evolution-granted (progression.ts grantsPassiveIds) ---
const evolutionPassives: Record<string, PassiveDefinition> = {
  firestarter: {
    id: 'firestarter',
    name: 'Firestarter',
    description: 'The first time this hero afflicts Burn during combat, set Scorched Land.',
    // subjectRole 'source' + relativeTo 'self' = "this hero applied the Burn" (plain 'self' would
    // read "I was burned"; 'enemy' would fire off the partner's Burns). oncePerFight keeps the
    // field a 5-round window rather than refreshing on every Burn.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Burn' } },
      effect: { kind: 'setFieldEffect', fieldEffectId: 'scorchedLand' },
      oncePerFight: true,
    },
  },
  unstoppableGrowth: {
    id: 'unstoppableGrowth',
    name: 'Unstoppable Growth',
    description: 'When this hero enters the battlefield, it gains Renew 20.',
    // Same arrival shape as Imposing Presence, pointed inward: every arrival including the
    // opening lead, so a pivot out and back re-seeds it. Renew stacks additively, which is
    // the intended payoff. A passive-applied HoT is FLAT — the healing formula's Wisdom
    // scaling belongs to a move's own heal, and a passive has no move to take STAB from.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'applyStatus', target: 'self', statusId: 'Renew', magnitude: 20 },
    },
  },
  frozenStone: {
    id: 'frozenStone',
    name: 'Frozen Stone',
    description: 'Whenever this hero\'s Defense rises, Freeze a random enemy.',
    // eventFieldPositive is what makes this "rises" rather than "changes" — a Defense DEBUFF
    // must not freeze anyone. Fed only by a move's own stat deltas, so the hero's own Bastion
    // and a partner's Frost Wall both arm it, and a passive-caused change never chains.
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'self', eventFieldEquals: { stat: 'defense' }, eventFieldPositive: 'delta' },
      effect: { kind: 'applyStatus', target: 'randomEnemy', statusId: 'Freeze' },
    },
  },
  staticTide: {
    id: 'staticTide',
    name: 'Static Tide',
    description: 'Every Water attack this hero lands leaves its target Conducting.',
    // subjectRole 'source' + relativeTo 'self' = "I dealt this hit"; the Conduct then has to
    // land on 'triggerTarget', the defender, because the condition's subject is the attacker.
    // Maelstrom's own Storm moves are what cash the mark in (Conduct.triggerTypes).
    reactive: {
      hook: 'DamageDealt',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { moveType: 'Water' } },
      effect: { kind: 'applyStatus', target: 'triggerTarget', statusId: 'Conduct' },
    },
  },
  afterimage: {
    id: 'afterimage',
    name: 'Afterimage',
    description: 'Whenever this hero gains Stealth, it gains 20 Attack.',
    // Target-role StatusApplied: the subject is whoever RECEIVED the status, so this reads
    // "I became hidden". Nightshade's own Vanish (15 mana) and Shadow Form are the sources, which
    // makes the ramp a turn spent rather than a rider on attacking. Stealth is stacking 'none',
    // so re-applying while already hidden emits no event and pays nothing — the ramp costs a
    // fresh Stealth every time, and Stealth's start-of-round tick is what frees one up.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', eventFieldEquals: { statusId: 'Stealth' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'attack', amount: 20 },
    },
  },
  entanglement: {
    id: 'entanglement',
    name: 'Entanglement',
    description: "Whenever an enemy's Wisdom drops, that enemy is Haunted.",
    // Frozen Stone inverted: eventFieldNegative is what makes this "drops" and not "changes", so
    // a Wisdom BUFF on a foe never marks them. Cortex's slate is a Wisdom shredder end to end
    // (Psi Bolt, Enervate, Psychock, Disorient, Psionic Wave), so the debuffs it was already
    // casting now plant Haunt for free — and Wisdom is the magical defStat, so the same point
    // both softens the target and marks it.
    // ATTRIBUTION: StatChanged carries no source, so this reads "an enemy's Wisdom dropped",
    // not "I dropped it" — a Mind PARTNER's debuff arms it too. Deliberate, docs/combat.md.
    reactive: {
      hook: 'StatChanged',
      condition: { relativeTo: 'enemy', eventFieldEquals: { stat: 'wisdom' }, eventFieldNegative: 'delta' },
      effect: { kind: 'applyStatus', target: 'triggerSubject', statusId: 'Haunt' },
    },
  },
  restorativeToxin: {
    id: 'restorativeToxin',
    name: 'Restorative Toxin',
    description: 'Whenever this hero applies Poison, it gains twice that amount as Renew.',
    // Firestarter's source-role shape, but the payout is READ off the event rather than authored:
    // matchTriggerAmount on StatusApplied's `magnitude`. Note the units differ either side of the
    // 2x — Poison magnitude is a PERCENT of the victim's max HP, Renew magnitude is FLAT HP on
    // Sylva. Poison also stacks, so every re-application pays again (docs/leveling-and-ranks.md).
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Poison' } },
      effect: {
        kind: 'applyStatus',
        target: 'self',
        statusId: 'Renew',
        magnitude: { kind: 'matchTriggerAmount', field: 'magnitude', multiplier: 2 },
      },
    },
  },
  naturesPurification: {
    id: 'naturesPurification',
    name: "Nature's Purification",
    description: 'When this hero enters the battlefield, its partner is Cleansed.',
    // Imposing Presence's arrival shape aimed sideways. Cleanse spares `positive` statuses, so it
    // never strips the partner's own Renew. Alone on the field it resolves to nobody and is silent.
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'cleanse', target: 'ally' },
    },
  },
  feedbackLoop: {
    id: 'feedbackLoop',
    name: 'Feedback Loop',
    description: 'Whenever this hero applies Conduct, it gains +10 Intelligence.',
    // Firestarter's shape (source-role StatusApplied) pointed at the mark Tempest already
    // builds its slate around, so planting is also ramping. NOT oncePerFight: the ramp IS the
    // path, and Ionize plants on both foes for two firings. Conduct is stacking 'none', so a
    // re-plant on an already-marked target does not re-fire; the ramp costs fresh targets.
    reactive: {
      hook: 'StatusApplied',
      condition: { relativeTo: 'self', subjectRole: 'source', eventFieldEquals: { statusId: 'Conduct' } },
      effect: { kind: 'statDelta', target: 'self', stat: 'intelligence', amount: 10 },
    },
  },
  bloodthirsty: {
    id: 'bloodthirsty',
    name: 'Bloodthirsty',
    description: 'This hero has +20 Attack and +20 Speed while an enemy is Bleeding.',
    // A live conditional grant, not a reactive statDelta: it switches off when the Bleeder
    // switches out, faints, is cleansed or expires. Reads ACTIVE enemies only.
    conditionalStatGrants: {
      requiresEnemyStatus: 'Bleed',
      statGrants: { attack: 20, speed: 20 },
    },
  },
};

export const passives: Record<string, PassiveDefinition> = { ...fixturePassives, ...equipmentPassives, ...eventPassives, ...evolutionPassives, ...classes };

/**
 * What a passive costs when an ITEM grants it, in RARITY_BUDGET points (multiples of 5).
 * equipmentBudgetProblems fails on any equipment-granted passive missing here. Relics are
 * not priced through this. Anchor: 20 = a 20% type-locked damage multiplier.
 */
export const PASSIVE_ITEM_COST: Readonly<Record<string, number>> = {
  emberheart: 20,
  stormcallersFocus: 20,
  frostbrand: 20,
  shadowfang: 20,
  bloodthirst: 20,
  wardensVigil: 15,
  vengefulEmblem: 25,
  sanguine: 20,
};
