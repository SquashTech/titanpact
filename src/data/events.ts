// Map events (docs/run-loop.md `event` node): pure data — a name, a voice, and one `outcome`
// from a closed vocabulary that src/run/events.ts and EventNodeScreen interpret generically.
// A new event that needs behaviour the outcome kinds can't express extends the vocabulary.

import type { MoveDefinition, MoveTier, PassiveId, StatKey, TypeId } from '../engine/content';

/**
 * Declarative filter for a `learnMove` pool, so it tracks the catalog instead of going stale.
 * Fields AND together; omitted (or `{}`) means the whole catalog.
 */
export interface MovePoolFilter {
  /** Case-insensitive substring of the move's display name — e.g. 'Slice' (the designer's real grouping). */
  nameIncludes?: string;
  types?: readonly TypeId[];
  kinds?: readonly MoveDefinition['kind'][];
  /** Only these tiers (an untiered move reads as Early). An event's move should be worth a node: Mid or Late. */
  tiers?: readonly MoveTier[];
}

/** Which heroes a `recruit` draws from: the run's deck (the whole owned catalog on an old save), narrowed. Fields AND together. */
export interface HeroPoolFilter {
  types?: readonly TypeId[];
  heroIds?: readonly string[];
}

/** An outcome that lands on ONE chosen hero and nothing else — what a `gamble` branch may be. */
export type HeroOutcome =
  /** Flat run-permanent stat deltas on one chosen hero (RosterEntry.bonusStatGrants); negatives are stat mods too — multiples of 5/10. Floor: src/run/events.ts statShiftAllowed. */
  | { kind: 'statShift'; deltas: Partial<Record<StatKey, number>> }
  /** Teaches a Passive to one chosen hero (RosterEntry.bonusPassiveGrants). */
  | { kind: 'grantPassive'; passiveId: PassiveId };

/**
 * The closed outcome vocabulary. Gold, Gems and Recruit Contracts are never GRANTED —
 * those are map-node types; an event should be a thing the map cannot otherwise do. A hero is
 * (`recruit`): not a contract's finished build but a raw one at par, drawn from a filter, which is
 * how an event recruits by theme (docs/wild-innates-and-events.md §3).
 */
export type RunEventOutcome =
  | HeroOutcome
  /** Rolls one move from `pool` and lets the player teach it to any roster hero (replacing one at MOVE_CAP). */
  | { kind: 'learnMove'; pool?: MovePoolFilter }
  /** N equipment drops on the act's own rarity curve, through the usual equip-or-trash gate. */
  | { kind: 'loot'; count: number }
  /** `count` heroes from `pool`, none already on the roster; one joins RAW at the player's par. At the cap, someone leaves. */
  | { kind: 'recruit'; pool: HeroPoolFilter; count: number }
  /** A chosen hero takes `win` at `chance`, `lose` otherwise. Both branches are shown before the pick. */
  | { kind: 'gamble'; chance: number; win: HeroOutcome; lose: HeroOutcome }
  /** Two or three options and an implicit Leave. Options never nest. */
  | { kind: 'choice'; options: readonly EventOption[] }
  /**
   * MARKS one chosen hero with a curse (data/curses.ts, docs/wild-innates-and-events.md §3.3). The
   * mark changes nothing until the Turn at the curse's pip — on the spot for a hero already past it.
   */
  | { kind: 'curse'; curseId: string };

/** What an outcome costs on top of itself, paid as it resolves. Gold is a sink here, never a grant. */
export interface EventCost {
  gold?: number;
  /** Every standing roster hero takes this share of its max HP as Wounds (run/wounds.ts) — never enough to drop it. */
  woundAll?: number;
}

export interface EventOption {
  /** The button's title — what the player does, in a few words. */
  label: string;
  outcome: Exclude<RunEventOutcome, { kind: 'choice' }>;
  cost?: EventCost;
}

/** A `choice` option, or the whole event read as one. */
export type ResolvableOutcome = EventOption['outcome'];

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
  /** Paid as a non-`choice` outcome resolves; a `choice` prices its options one by one. */
  cost?: EventCost;
  /** Relative odds among the eligible (`DEFAULT_EVENT_WEIGHT` when omitted) — a rare event sets a smaller one. */
  weight?: number;
  /** Location ids this event may roll in. Omitted = anywhere (every event today). */
  locationIds?: readonly string[];
  /** Earliest act (1-indexed, inclusive). Omitted = any act. */
  minAct?: number;
}

export const DEFAULT_EVENT_WEIGHT = 10;

export const runEvents: Record<string, RunEventDefinition> = {
  fruitSlicer: {
    id: 'fruitSlicer',
    name: 'Fruit Slicer',
    eyebrow: 'A Trick of the Blade',
    flavor: 'A grinning vendor halves melons faster than the eye can follow, and offers to teach the cut to one of you.',
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
    // Body for mind, literally. The -40 HP / +20 Mana it replaced was a trap: a deeper pool
    // SATURATES (docs/run-loop.md), so the sim took it every time and lost ground.
    // Intelligence and Wisdom both stay live for the whole fight, and
    // the Wisdom half gives back some of what the HP took — against magic, at least.
    outcome: { kind: 'statShift', deltas: { hp: -20, intelligence: 20, wisdom: 20, manaPool: 20 } },
  },

  deepWell: {
    id: 'deepWell',
    name: 'The Deep Well',
    eyebrow: 'Cold Water, Far Down',
    flavor: 'A shaft with no bottom you can see. Whoever drinks comes up lighter, and does not run dry for a long time after.',
    tone: 'mana',
    // The run's one mana FAUCET that is a choice rather than a roll (docs/mana.md "Growing the
    // pool", 2026-09-13): HP for Mana, on the hero you name. HP is the over-charged stat
    // (CLAUDE.md: break-even ≈ 0.33 a point) and Mana the one a Late move is priced in, so the
    // trade is even at break-even and reads as a gift on a caster. Not a Mana Well: a bare
    // number never gets a screen, and a trade is a decision, not a deposit.
    outcome: { kind: 'statShift', deltas: { hp: -20, manaPool: 40, mpRegen: 5 } },
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

  // --- Anywhere (docs/wild-innates-and-events.md §3.2) ---

  // §3.3, per user direction: the bite only marks; at the fifth pip the hero Turns — pure Beast, a
  // 650 body, Lacerate and the werewolf. Rare: a curse that rewrites a hero should be a story, not a habit.
  werewolfBite: {
    id: 'werewolfBite',
    name: 'Werewolf Bite',
    eyebrow: 'Under a Full Moon',
    flavor: 'Something with too many teeth has been circling the camp. It only wants one of you, and it only wants a taste.',
    tone: 'vital',
    weight: 5,
    outcome: {
      kind: 'choice',
      options: [
        {
          label: 'Hold out an arm',
          outcome: { kind: 'curse', curseId: 'werewolf' },
        },
      ],
    },
  },

  mercenaryCamp: {
    id: 'mercenaryCamp',
    name: 'Mercenary Camp',
    eyebrow: 'Swords for Hire',
    flavor: 'Three fires, three strangers, and a captain who names a price before you have said a word.',
    tone: 'gold',
    weight: 6,
    outcome: {
      kind: 'choice',
      options: [{ label: 'Pay the captain', outcome: { kind: 'recruit', pool: {}, count: 3 }, cost: { gold: 20 } }],
    },
  },

  twoHeadedCoin: {
    id: 'twoHeadedCoin',
    name: 'The Two-Headed Coin',
    eyebrow: 'Call It',
    flavor: 'A coin with a face on both sides. One is grinning, and the other is merely smiling.',
    tone: 'arcane',
    outcome: {
      kind: 'choice',
      options: [
        {
          label: 'Flip it',
          outcome: {
            kind: 'gamble',
            chance: 0.5,
            win: { kind: 'statShift', deltas: { attack: 30, intelligence: 30, speed: 20 } },
            lose: { kind: 'statShift', deltas: { defense: 20, wisdom: 20 } },
          },
        },
      ],
    },
  },

  // --- Wild's Edge ---

  rustlingGrass: {
    id: 'rustlingGrass',
    name: 'Rustling Grass',
    eyebrow: 'Something in the Grass',
    flavor: 'The grass moves against the wind. Whatever is in there has been following you for a while.',
    tone: 'vital',
    weight: 6,
    locationIds: ['wildsEdge'],
    outcome: { kind: 'recruit', pool: {}, count: 2 },
  },

  abandonedCamp: {
    id: 'abandonedCamp',
    name: 'Abandoned Camp',
    eyebrow: 'Still Warm',
    flavor: 'The packs are still here. Whoever owned them left in a hurry, and something may still be watching them.',
    tone: 'gold',
    locationIds: ['wildsEdge'],
    outcome: {
      kind: 'choice',
      options: [{ label: 'Search the packs', outcome: { kind: 'loot', count: 2 }, cost: { woundAll: 0.1 } }],
    },
  },

  // --- Blighted Shrine ---

  whisperingAltar: {
    id: 'whisperingAltar',
    name: 'The Whispering Altar',
    eyebrow: 'It Knows Your Names',
    flavor: 'The altar asks for blood, and promises a word in exchange. It does not say whose blood.',
    tone: 'arcane',
    locationIds: ['blightedShrine'],
    outcome: {
      kind: 'choice',
      options: [
        { label: 'Bleed on the stone', outcome: { kind: 'learnMove', pool: { types: ['Shadow'], tiers: ['mid', 'late'] } } },
        { label: 'Read the carvings', outcome: { kind: 'learnMove', pool: { types: ['Arcane'], tiers: ['mid', 'late'] } } },
      ],
    },
  },

  hermitsLantern: {
    id: 'hermitsLantern',
    name: "The Hermit's Lantern",
    eyebrow: 'A Light in the Ruin',
    flavor: 'A lantern burns in a cell nobody should have survived. Its keeper is waiting to be asked out.',
    tone: 'teal',
    weight: 6,
    locationIds: ['blightedShrine'],
    outcome: { kind: 'recruit', pool: { types: ['Shadow', 'Arcane', 'Mind'] }, count: 2 },
  },

  // --- Forbidden Forest ---

  faeRing: {
    id: 'faeRing',
    name: 'The Fae Ring',
    eyebrow: 'Step Inside',
    flavor: 'A circle of mushrooms, perfectly round. Whoever steps in comes out quicker — or, if the fae are bored, merely sturdier.',
    tone: 'vital',
    locationIds: ['forbiddenForest'],
    outcome: {
      kind: 'choice',
      options: [
        {
          label: 'Step into the ring',
          outcome: {
            kind: 'gamble',
            chance: 0.5,
            win: { kind: 'statShift', deltas: { speed: 40, attack: 20, intelligence: 20 } },
            lose: { kind: 'statShift', deltas: { hp: 60, defense: 20 } },
          },
        },
      ],
    },
  },

  dryadsCall: {
    id: 'dryadsCall',
    name: "The Dryad's Call",
    eyebrow: 'The Trees Remember',
    flavor: 'A voice in the bark offers you a friend of the forest, if you promise to bring it home one day.',
    tone: 'vital',
    weight: 6,
    locationIds: ['forbiddenForest'],
    outcome: { kind: 'recruit', pool: { types: ['Nature', 'Beast', 'Light'] }, count: 2 },
  },

  // --- Molten Foundry ---

  slagBath: {
    id: 'slagBath',
    name: 'The Slag Bath',
    eyebrow: 'Tempered',
    flavor: 'Molten iron, cooling at the edges. A hero who wades in comes out plated, and lighter by what burned away.',
    tone: 'gold',
    locationIds: ['moltenFoundry'],
    outcome: {
      kind: 'choice',
      options: [{ label: 'Wade in', outcome: { kind: 'statShift', deltas: { hp: -20, defense: 40, wisdom: 20 } } }],
    },
  },

  automatonKit: {
    id: 'automatonKit',
    name: 'Automaton Kit',
    eyebrow: 'Some Assembly Required',
    flavor: 'Crates of parts, a manual, and a frame that twitches when you look at it.',
    tone: 'gold',
    weight: 6,
    locationIds: ['moltenFoundry'],
    outcome: {
      kind: 'choice',
      options: [{ label: 'Assemble it', outcome: { kind: 'recruit', pool: { types: ['Mech', 'Iron', 'Fire'] }, count: 2 } }],
    },
  },

  // --- Storm Coast ---

  shipwreck: {
    id: 'shipwreck',
    name: 'Shipwreck',
    eyebrow: 'Low Tide',
    flavor: 'A hull on the rocks, the hold still sealed. The tide is coming back in.',
    tone: 'teal',
    locationIds: ['stormCoast'],
    outcome: {
      kind: 'choice',
      options: [{ label: 'Dive the wreck', outcome: { kind: 'loot', count: 3 }, cost: { woundAll: 0.1 } }],
    },
  },

  sirenSong: {
    id: 'sirenSong',
    name: 'Siren Song',
    eyebrow: 'From the Rocks',
    flavor: 'A song carries over the surf, and someone out there is singing it for you.',
    tone: 'teal',
    weight: 6,
    locationIds: ['stormCoast'],
    outcome: { kind: 'recruit', pool: { types: ['Water', 'Storm', 'Stone'] }, count: 2 },
  },

  lightningRod: {
    id: 'lightningRod',
    name: 'Lightning Rod',
    eyebrow: 'Hold This',
    flavor: 'An iron spike on the headland, black with strikes. The next one is minutes away.',
    tone: 'mana',
    locationIds: ['stormCoast', 'thunderAerie'],
    outcome: {
      kind: 'choice',
      options: [
        {
          label: 'Grab the spike',
          outcome: {
            kind: 'gamble',
            chance: 0.6,
            win: { kind: 'statShift', deltas: { speed: 25, attack: 30, intelligence: 30 } },
            lose: { kind: 'statShift', deltas: { speed: 20, hp: 60 } },
          },
        },
      ],
    },
  },

  // --- Necropolis ---

  graveRobbing: {
    id: 'graveRobbing',
    name: 'Grave Robbing',
    eyebrow: 'Nobody Will Miss It',
    flavor: 'The dead were buried with their gear. The dead are also not as still as they used to be.',
    tone: 'gold',
    locationIds: ['necropolis'],
    outcome: {
      kind: 'choice',
      options: [{ label: 'Dig', outcome: { kind: 'loot', count: 2 }, cost: { woundAll: 0.1 } }],
    },
  },

  raiseDead: {
    id: 'raiseDead',
    name: 'Raise the Dead',
    eyebrow: 'An Open Grave',
    flavor: 'One grave is empty from the inside. Its occupant is sitting on the headstone, asking for work.',
    tone: 'arcane',
    weight: 6,
    locationIds: ['necropolis'],
    outcome: { kind: 'recruit', pool: { types: ['Spirit', 'Frost'] }, count: 2 },
  },

  lichsBargain: {
    id: 'lichsBargain',
    name: "The Lich's Bargain",
    eyebrow: 'Less of a Body',
    flavor: 'A crowned skull offers the oldest trade there is: some of the flesh, for a great deal of the mind.',
    tone: 'mana',
    locationIds: ['necropolis'],
    outcome: {
      kind: 'choice',
      options: [{ label: 'Take the bargain', outcome: { kind: 'statShift', deltas: { hp: -40, intelligence: 30, wisdom: 30, manaPool: 30 } } }],
    },
  },

  // --- The bought Locations ---

  pilgrimsFont: {
    id: 'pilgrimsFont',
    name: "The Pilgrim's Font",
    eyebrow: 'Holy Water',
    flavor: 'Pilgrims leave coins in the font and take something away with them.',
    tone: 'teal',
    locationIds: ['holySanctum'],
    outcome: {
      kind: 'choice',
      options: [
        { label: 'Leave an offering', outcome: { kind: 'learnMove', pool: { types: ['Light'], tiers: ['mid', 'late'] } } },
        { label: 'Take a vow', outcome: { kind: 'recruit', pool: { types: ['Light', 'Spirit', 'Mind'] }, count: 2 } },
      ],
    },
  },

  lucidDream: {
    id: 'lucidDream',
    name: 'Lucid Dream',
    eyebrow: 'You Know You Are Dreaming',
    flavor: 'Two doors in a corridor that was not there a moment ago. Each opens on a lesson.',
    tone: 'arcane',
    locationIds: ['dreamingSpires'],
    outcome: {
      kind: 'choice',
      options: [
        { label: 'The violet door', outcome: { kind: 'learnMove', pool: { types: ['Mind'], tiers: ['mid', 'late'] } } },
        { label: 'The silver door', outcome: { kind: 'learnMove', pool: { types: ['Arcane'], tiers: ['mid', 'late'] } } },
      ],
    },
  },

  rocsNest: {
    id: 'rocsNest',
    name: "The Roc's Nest",
    eyebrow: 'Mind the Mother',
    flavor: 'A nest the size of a house, full of bones and shining things. The mother is out. For now.',
    tone: 'mana',
    locationIds: ['thunderAerie'],
    outcome: {
      kind: 'choice',
      options: [
        { label: 'Climb for the shining things', outcome: { kind: 'loot', count: 2 }, cost: { woundAll: 0.1 } },
        { label: 'Wait for the hatchlings', outcome: { kind: 'recruit', pool: { types: ['Storm', 'Beast'] }, count: 2 } },
      ],
    },
  },

  icyPlunge: {
    id: 'icyPlunge',
    name: 'The Icy Plunge',
    eyebrow: 'Through the Ice',
    flavor: 'A hole cut in the lake. Whoever climbs back out is harder to hurt — much harder, if they stayed under long enough.',
    tone: 'teal',
    locationIds: ['frozenReach'],
    outcome: {
      kind: 'choice',
      options: [
        {
          label: 'Take the plunge',
          outcome: {
            kind: 'gamble',
            chance: 0.5,
            win: { kind: 'statShift', deltas: { defense: 40, wisdom: 40 } },
            lose: { kind: 'statShift', deltas: { hp: 60, defense: 10, wisdom: 10 } },
          },
        },
        { label: 'Thaw the one in the ice', outcome: { kind: 'recruit', pool: { types: ['Frost', 'Water', 'Stone'] }, count: 1 } },
      ],
    },
  },
};
