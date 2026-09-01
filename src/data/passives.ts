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
