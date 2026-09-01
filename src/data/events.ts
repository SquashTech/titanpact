// Map events (docs/run-loop.md `event` node): pure data — a name, a voice, and one `outcome`
// from a closed vocabulary that src/run/events.ts and EventNodeScreen interpret generically.
// A new event that needs behaviour the outcome kinds can't express extends the vocabulary.

import type { MoveDefinition, PassiveId, StatKey, TypeId } from '../engine/content';

/**
 * Declarative filter for a `learnMove` pool, so it tracks the catalog instead of going stale.
 * Fields AND together; omitted (or `{}`) means the whole catalog.
 */
export interface MovePoolFilter {
  /** Case-insensitive substring of the move's display name — e.g. 'Slice' (the designer's real grouping). */
  nameIncludes?: string;
  types?: readonly TypeId[];
  kinds?: readonly MoveDefinition['kind'][];
}

/**
 * The closed outcome vocabulary. Gold, Training Points and Recruit Contracts are deliberately
 * absent — those are already map-node types; an event should be a thing the map cannot otherwise do.
 */
export type RunEventOutcome =
  /** Rolls one move from `pool` and lets the player teach it to any roster hero (replacing one at MOVE_CAP). */
  | { kind: 'learnMove'; pool?: MovePoolFilter }
  /** Flat run-permanent stat deltas on one chosen hero (RosterEntry.bonusStatGrants); negatives are stat mods too — multiples of 5/10. Floor: src/run/events.ts statShiftAllowed. */
  | { kind: 'statShift'; deltas: Partial<Record<StatKey, number>> }
  /** Teaches a Passive to one chosen hero (RosterEntry.bonusPassiveGrants). */
  | { kind: 'grantPassive'; passiveId: PassiveId }
  /** N equipment drops on the act's own rarity curve, through the usual equip-or-trash gate. */
  | { kind: 'loot'; count: number };

/** The node's hue, named — the rgb triples live in view/shared/NodeStage.tsx. */
export type EventTone = 'gold' | 'arcane' | 'teal' | 'vital' | 'mana';

export interface RunEventDefinition {
  id: string;
  name: string;
  /** The small kicker above the title. */
  eyebrow: string;
  /** One line shown under the title; the screen derives the offer text from `outcome`. */
  flavor: string;
  tone: EventTone;
  outcome: RunEventOutcome;
  /** Location ids this event may roll in. Omitted = anywhere (every event today). */
  locationIds?: readonly string[];
  /** Earliest act (1-indexed, inclusive). Omitted = any act. */
  minAct?: number;
}

// Rolled uniformly from whatever is eligible (src/run/events.ts); add a `weight` field if the pool outgrows that.
export const runEvents: Record<string, RunEventDefinition> = {
  fruitSlicer: {
    id: 'fruitSlicer',
    name: 'Fruit Slicer',
    eyebrow: 'A Wager of Blades',
    flavor: 'A grinning vendor stacks melons on a crate and offers the knife to whoever thinks they can keep up.',
    tone: 'vital',
    outcome: { kind: 'learnMove', pool: { nameIncludes: 'Slice' } },
  },

  wildcard: {
    id: 'wildcard',
    name: 'Wildcard',
    eyebrow: 'Something Stirs',
    flavor: 'A shuffled deck, face down. One card is drawn before you can ask what the game is.',
    tone: 'arcane',
    outcome: { kind: 'learnMove' },
  },

  soulTransfer: {
    id: 'soulTransfer',
    name: 'Soul Transfer',
    eyebrow: 'An Even Trade',
    flavor: 'A still pool that takes something of the body and gives back something of the mind.',
    tone: 'mana',
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
    outcome: { kind: 'loot', count: 3 },
  },
};
