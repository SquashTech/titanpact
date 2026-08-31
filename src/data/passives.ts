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

/**
 * Passives granted by a map EVENT (src/data/events.ts `grantPassive`), as
 * opposed to by an item, a relic or an Evolution. They live in their own group
 * for the same reason equipmentPassives does — where a passive can come from
 * is the first thing you want to know when you meet one in this file.
 */
const eventPassives: Record<string, PassiveDefinition> = {
  imposingPresence: {
    id: 'imposingPresence',
    name: 'Imposing Presence',
    description: 'When this hero enters the battlefield, enemies lose 10 Attack.',
    /*
     * The first user of the entry hook (engine/content.ts PassiveHook
     * 'SwitchedIn') and of a group target (PassiveEffectTarget
     * 'activeEnemies'). `relativeTo: 'self'` because SwitchedIn's subject is
     * the INCOMING combatant — so this matches only when its own owner is the
     * one arriving.
     *
     * It fires on EVERY arrival, including the fight's opening lead
     * (passiveEngine.ts resolveBattleStartEntries), and re-fires each time the
     * hero cycles back in. That is deliberate and unbounded within a fight,
     * the same shape Vengeful Emblem already has — cycling this hero IS the
     * build, and the price is the tempo every switch costs. Worth watching in
     * playtest: paired with a fast pivot it is the only debuff in the game
     * that compounds without spending mana.
     */
    reactive: {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'statDelta', target: 'activeEnemies', stat: 'attack', amount: -10 },
    },
  },
};

export const passives: Record<string, PassiveDefinition> = { ...fixturePassives, ...equipmentPassives, ...eventPassives, ...classes };

/**
 * What a passive is WORTH when an item grants it, in the same points
 * src/run/equipment.ts's RARITY_BUDGET is denominated in — the user's "OR
 * equivalent in terms of powerful passives or other effects" (2026-08-30).
 * equipmentBudgetCost reads this; equipmentBudgetProblems fails loudly on any
 * equipment-granted passive missing an entry, so adding a passive to an item
 * forces a price to be named rather than defaulting to free.
 *
 * It lives here rather than on PassiveDefinition because a passive's worth IN
 * AN ITEM is an equipment-economy question. The engine (passiveEngine.ts) has
 * no opinion about it, and relics — which grant passives on a different axis
 * entirely, team-wide and unbounded by slots — should not be forced through
 * an equipment-shaped price.
 *
 * Anchor: 20 points buys a 20% type-locked damage multiplier, which is what
 * the whole epic tier's stat budget (30) buys minus a common's worth of stats.
 * Everything else is set relative to that. Entries are multiples of 5 so a
 * passive can share a tier's budget with flat grants and still land on the
 * number exactly.
 */
export const PASSIVE_ITEM_COST: Readonly<Record<string, number>> = {
  /** 20% bonus damage on one of 15 types — the anchor. Conditional, but on a whole type's worth of moves, and it multiplies AFTER the ratio so it compounds with the item's own stats. */
  emberheart: 20,
  stormcallersFocus: 20,
  frostbrand: 20,
  shadowfang: 20,
  /** 15% lifesteal on every hit the SIDE lands — untyped, uncapped, and it scales with the rest of the loadout. Worth the anchor even without a damage term of its own. */
  bloodthirst: 20,
  /** 10% of damage taken healed back. Strictly defensive and it only pays out while losing, so it prices below the damage passives. */
  wardensVigil: 15,
  /** +5 Attack per instance of damage taken, unbounded within a fight. Slowest to start and the highest ceiling in the list — the only passive priced above the anchor. */
  vengefulEmblem: 25,
  /** Heals off enemy Bleed ticks. Narrow (one status, on the enemy side) but free upkeep once a Bleed is up. */
  sanguine: 20,
};
