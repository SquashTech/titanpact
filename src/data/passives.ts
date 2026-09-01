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

/**
 * Passives granted by an EVOLUTION path (src/data/progression.ts
 * `grantsPassiveIds`) — their own group for the same reason the equipment and
 * event ones have theirs: where a passive comes from is the first thing you
 * want to know when you meet one.
 *
 * Sanguine (Lucius's Evolution) is the exception that stayed above, in the
 * fixture block, because it is fixture content that a path happens to hand
 * out. Firestarter is the first passive authored FOR a path.
 */
const evolutionPassives: Record<string, PassiveDefinition> = {
  firestarter: {
    id: 'firestarter',
    name: 'Firestarter',
    description: 'The first time this hero afflicts Burn during combat, set Scorched Land.',
    /*
     * Two firsts, both of which the contract had named as gaps rather than
     * decisions:
     *
     * - `subjectRole: 'source'` (engine/content.ts) is the ACTOR perspective.
     *   `relativeTo: 'self'` on the default target role would have read "when
     *   I am burned", which is the opposite passive; `relativeTo: 'enemy'`
     *   would have fired off a Burn the PARTNER landed, handing this hero's
     *   identity to whoever it was drafted beside. Source + self is the only
     *   reading of "this hero afflicts" that survives a doubles board.
     *
     * - `oncePerFight` is what makes it a threshold rather than an engine.
     *   Without it every subsequent Burn would re-set the field and refresh
     *   its 5-round clock, so Scorched Land would simply never expire while
     *   Crimson kept casting — which is a different, much stronger card than
     *   the one written. Firing once means the field is a WINDOW the player
     *   has to use: it opens on the first Burn and closes five rounds later
     *   whatever else happens.
     *
     * Note it fires on ANY Burn this hero applies, including Ember's 10%
     * rider and (were it ever holding one) a self-Burn — "afflicts Burn" is
     * deliberately not narrowed to enemies, because the interesting decision
     * is WHEN to spend the trigger, not on whom.
     */
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
    /*
     * The first CONDITIONAL stat grant (engine/content.ts
     * PassiveConditionalStatGrants), and the shape matters more than the
     * numbers: it is read live at every stat read rather than applied and
     * later revoked. The alternative — a reactive statDelta off StatusApplied
     * — would have been wrong in four ordinary situations, all of which happen
     * in a normal fight: the Bleeding enemy switches out, faints, is cleansed,
     * or simply runs its Bleed down. A granted buff survives all four; a
     * condition does not. There is no "un-apply" verb in the effect vocabulary
     * and adding one would have been the worse design.
     *
     * It reads ACTIVE enemies only, so Fang cannot bank a Bleed on a benched
     * hero and keep the buff while a fresh enemy stands in front of it.
     *
     * Attack AND Speed together on a body already at 90/80 is the largest
     * conditional swing in the game — deliberately, because Fang has to LAND
     * the Bleed first and Beast's Bleed sources are Claw (20% chance) and
     * Lacerate. The passive is the reward for the type's opening play, not a
     * free stat line, and it turns off the moment the target does.
     */
    conditionalStatGrants: {
      requiresEnemyStatus: 'Bleed',
      statGrants: { attack: 20, speed: 20 },
    },
  },
};

export const passives: Record<string, PassiveDefinition> = { ...fixturePassives, ...equipmentPassives, ...eventPassives, ...evolutionPassives, ...classes };

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
