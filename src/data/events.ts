// Map EVENTS (docs/run-loop.md — the `event` map node). Authored content for
// the node type that has existed as a placeholder since the map was built
// ("Introduce a node for Events but don't create any yet, we will design these
// when it's time" — that time is 2026-08-31).
//
// An event is PURE DATA, like every other acquirable thing in this game
// (CLAUDE.md "Architecture"): a name, a voice, and one `outcome` drawn from a
// small closed vocabulary the run layer (src/run/events.ts) and the screen
// (src/view/run/EventNodeScreen.tsx) both interpret generically. Adding an
// event should never mean adding a code path — if a new one wants behavior the
// four outcome kinds can't express, that is a signal to extend the VOCABULARY
// here, not to special-case an id anywhere.
//
// LOCATION-SPECIFIC EVENTS (user direction, 2026-08-31: "in the future, there
// may be Location-specific events that we design, so make sure the engine is
// prepared to tackle that down the line") are already expressible: set
// `locationIds` and the event is only ever rolled in those Locations
// (docs/locations.md, src/data/locations.ts). Everything below leaves it unset,
// so today's five are the general pool that can appear anywhere — but the gate
// is real, tested, and costs an authored event one line to use.

import type { MoveDefinition, PassiveId, StatKey, TypeId } from '../engine/content';

/**
 * Which moves an event's `learnMove` outcome may roll from — a declarative
 * filter rather than a list of ids, so the pool tracks the catalog as it grows
 * instead of going stale. Every field is optional and they AND together; an
 * omitted filter (or `{}`) means the whole catalog.
 *
 * `nameIncludes` is a deliberate concession to how the designer actually
 * groups moves: "a random Slice move" is a real category in the roster (Aqua
 * Slice, Shock Slice, Leaf Slice, Holy Slice, Shadow Slice, Spooky Slice,
 * Serrated Slice) that no structural field captures — they span seven types
 * and share only the word. Matching on the name is honest about that rather
 * than inventing a `family` field on every MoveDefinition to serve one event.
 */
export interface MovePoolFilter {
  /** Case-insensitive substring of the move's display NAME — e.g. 'Slice'. */
  nameIncludes?: string;
  /** Restrict to these move types (docs/types-and-heroes.md's 15). */
  types?: readonly TypeId[];
  /** Restrict to damage / heal / buff moves. */
  kinds?: readonly MoveDefinition['kind'][];
}

/**
 * What an event actually DOES — the closed vocabulary. Four kinds cover the
 * designer's opening slate, and each one is a whole shape rather than a single
 * event's needs:
 *
 *  - `learnMove`   one rolled move, taught to a hero the player picks.
 *  - `statShift`   flat stat deltas (some may be negative) on a chosen hero.
 *  - `grantPassive` a Passive taught to a chosen hero.
 *  - `loot`        N random equipment drops on the act's own rarity curve.
 *
 * Note what is NOT here: gold, Training Points and Recruit Contracts. Those are
 * already whole map-node types (`currencyReward`/`upgradeReward`, the per-act
 * contract grant) and an event that duplicated one would just be a reward node
 * wearing a costume. An event should be a thing the map cannot otherwise do.
 */
export type RunEventOutcome =
  /** Rolls ONE move from `pool` (the whole catalog if omitted) and lets the player teach it to any roster hero — replacing an existing move if that hero is at MOVE_CAP. */
  | { kind: 'learnMove'; pool?: MovePoolFilter }
  /**
   * Flat additive stat deltas applied permanently-for-the-run to one chosen
   * hero (run/runProgress.ts grantStatBonus — RosterEntry.bonusStatGrants).
   * CLAUDE.md's "multiples of 5 or 10" applies to negative entries too; a
   * downside IS a stat modifier. See src/run/events.ts statShiftAllowed for the
   * floor that stops a repeated drain from zeroing a hero out.
   */
  | { kind: 'statShift'; deltas: Partial<Record<StatKey, number>> }
  /** Teaches a Passive (src/data/passives.ts) to one chosen hero — RosterEntry.bonusPassiveGrants. */
  | { kind: 'grantPassive'; passiveId: PassiveId }
  /** N pieces of equipment rolled on the act's own drop curve (run/equipment.ts rarityWeightsFor), handed to the same forced equip-or-trash gate every other equipment grant uses. */
  | { kind: 'loot'; count: number };

/**
 * The node's hue, named rather than spelled as a colour. The concrete rgb
 * triples live with the rest of the node stage (view/shared/NodeStage.tsx
 * NODE_TINT_*) — an event is content, and content files in this repo carry at
 * most a presentational HINT, never a palette value (same discipline as
 * FieldEffectDefinition.flavorType).
 */
export type EventTone = 'gold' | 'arcane' | 'teal' | 'vital' | 'mana';

export interface RunEventDefinition {
  id: string;
  /** The node's title — what the place is called. */
  name: string;
  /** The small kicker above the title: what KIND of moment this is. */
  eyebrow: string;
  /** One line of flavor, shown under the title before the player has done anything. Says what the place is; the screen itself says what the offer is, from the outcome. */
  flavor: string;
  tone: EventTone;
  outcome: RunEventOutcome;
  /**
   * Location ids (src/data/locations.ts) this event may appear in. OMITTED =
   * anywhere, which is what every event below is today. This is the hook for
   * the Location-specific events named as future work — a Molten Foundry
   * event sets `locationIds: ['moltenFoundry']` and is never rolled elsewhere.
   */
  locationIds?: readonly string[];
  /** Earliest act this event may be rolled in (1-indexed, inclusive). Omitted = any act. The other half of the same gate: some events only make sense once a run has depth. */
  minAct?: number;
}

/**
 * The authored catalog. Weighting is deliberately absent: an `event` node rolls
 * uniformly from whatever is eligible (src/run/events.ts), because with five
 * entries a weight table would be five numbers nobody has a reason to pick yet.
 * If the pool grows to where some events should be rarer than others, that is
 * the moment to add a `weight` field — the same call REWARD_WEIGHTS already
 * made for map nodes.
 */
export const runEvents: Record<string, RunEventDefinition> = {
  fruitSlicer: {
    id: 'fruitSlicer',
    name: 'Fruit Slicer',
    eyebrow: 'A Wager of Blades',
    flavor: 'A grinning vendor stacks melons on a crate and offers the knife to whoever thinks they can keep up.',
    tone: 'vital',
    /*
     * A themed slice of the catalog rather than the whole thing — seven Slice
     * moves across seven types, so the roll is narrow enough to feel authored
     * and wide enough that the hero it suits is never obvious in advance.
     */
    outcome: { kind: 'learnMove', pool: { nameIncludes: 'Slice' } },
  },

  wildcard: {
    id: 'wildcard',
    name: 'Wildcard',
    eyebrow: 'Something Stirs',
    flavor: 'A shuffled deck, face down. One card is drawn before you can ask what the game is.',
    tone: 'arcane',
    /*
     * The whole catalog, unfiltered — including types no roster hero draws on,
     * and moves that key off the stat a hero does not lead with. That is the
     * point: an off-stat move on the right hero is a legitimate pick (a Storm
     * move on an Attack hero still hits, and Elemental Force gear can pay for
     * it), and the four-move cap means the real decision is what to give up.
     * Ancient moves join this pool automatically the day they are authored,
     * with no edit here — the filter is the catalog, not a list.
     */
    outcome: { kind: 'learnMove' },
  },

  soulTransfer: {
    id: 'soulTransfer',
    name: 'Soul Transfer',
    eyebrow: 'An Even Trade',
    flavor: 'A still pool that takes something of the body and gives back something of the mind.',
    tone: 'mana',
    /*
     * The first authored NEGATIVE stat grant in the game. 20 HP off a hero
     * sitting at 80-110 base is real (roughly a fifth of the pool), and 20 Mana
     * is two thirds of a mid-cost move — this is a genuine trade, not a
     * disguised reward, and it should read as one. Whether the exchange rate is
     * right is a playtest question; the SHAPE (a cost paid in the stat that
     * never enters the damage ratio, for the resource the tempo game runs on)
     * is the decision.
     */
    outcome: { kind: 'statShift', deltas: { hp: -20, manaPool: 20 } },
  },

  assertivenessTraining: {
    id: 'assertivenessTraining',
    name: 'Assertiveness Training',
    eyebrow: 'A Lesson in Bearing',
    flavor: 'Stand there. Say nothing. Let the room decide it would rather not.',
    tone: 'teal',
    outcome: { kind: 'grantPassive', passiveId: 'imposingPresence' },
  },

  lootPile: {
    id: 'lootPile',
    name: 'Loot Pile',
    eyebrow: 'Spoils',
    flavor: 'Someone else got here first, fought something, and did not need their gear afterward.',
    tone: 'gold',
    /*
     * Three items on the act's OWN curve (run/equipment.ts rarityWeightsFor),
     * not a fixed tier — so this is three Commons in Act 1 and three shots at a
     * Mythic in Act 5, and it scales without a second table. Three, not one,
     * because the forced equip-or-trash gate makes quantity its own decision:
     * nine slots across six heroes means the third item is usually a question
     * about what comes OFF.
     */
    outcome: { kind: 'loot', count: 3 },
  },
};
