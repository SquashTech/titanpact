// ⚠️ sanguine/emberheart below are TEST FIXTURE CONTENT — the two passives
// sufficient to exercise both triggered PassiveDefinition effect shapes end
// to end (engine/combat/passiveEngine.ts): Sanguine proves the reactive
// family (granted by Lucius's Evolution, see src/data/progression.ts),
// Emberheart proves the damage-modifier family (granted by a relic, see
// src/data/relics.ts). Not authored balance content.
//
// `passives` below is the FULL catalog every screen imports by this one name
// (EquipmentBox, ReferenceOverlay, HeroDetailOverlay, formatEvent, buildBeats,
// FightScreen, RelicsOverlay, resolveRound's config.passives) — merging in
// the authored Class catalog (src/data/classes.ts) here, rather than
// touching every one of those import sites, keeps a single source of truth.
// A Class IS a Passive (statGrants-only, no trigger) so it needs to resolve
// through this same lookup by id like any other.

import type { PassiveDefinition } from '../engine/content';
import { classes } from './classes';

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

// Equipment-granted passives (src/data/equipment.ts grantsPassiveIds) — the
// hook-driven half of the equipment expansion, reusing the same reactive/
// damageModifier vocabulary sanguine/emberheart above proved out. Not
// fixture content; these back real authored items.
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

export const passives: Record<string, PassiveDefinition> = { ...fixturePassives, ...equipmentPassives, ...classes };
