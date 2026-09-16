// The six run Locations (docs/locations.md): the identity an act wears. Pure data — `spawnTypes`
// is the mob layer's hard filter (run/spawn.ts), `affinity` feeds src/run/locations.ts's PoolBias;
// the presentation fields feed locationArt/ActIntroScreen.

import type { TypeId } from '../engine/content';
import { ELDER_BOUGH_ID, ENDBRINGER_ID, GOBLIN_LORD_ID, LAVA_BEAST_ID, KRAKEN_ID, SKELETON_KING_ID, YUGZULACH_ID } from './enemies';

/** Particle-field motion (docs/locations.md §4). */
export type AmbienceKind = 'fireflies' | 'embers' | 'snow' | 'rain' | 'spores' | 'sigils';

export interface LocationDefinition {
  id: string;
  /** The act's title card. */
  name: string;
  /** One line, spoken on arrival. */
  flavor: string;
  /**
   * What is already here, said once — on the map screen at the act's first Monsters node, which
   * is the only row with nothing behind it (MapRoute's omen). Present tense, and about the SPAWN
   * rather than the place: `flavor` already answers where you are, this answers what leaks here.
   */
  omen: string;
  /**
   * The Titanspawn lines the `fight`/`battle` nodes and the Guardian's escorts draw — a HARD
   * filter, and the five run Locations partition the fourteen mortal types between them
   * (docs/titanspawn-overhaul.md §3). `null` = every spawning type (Wild's Edge); empty = no mob
   * layer at all (The Threshold).
   */
  spawnTypes: readonly TypeId[] | null;
  /** Types the skirmish/elite encounters lean on — a weighting, not a filter (docs/locations.md §2). `null` = every type. */
  affinity: readonly TypeId[] | null;
  /** Hero ids obtainable only here. Empty on every location today (docs/locations.md §3). */
  exclusiveHeroIds: readonly string[];
  /** Enemy held on the Guardian fight's bench so it enters last (enemyGen.ts `appendFinalEnemy`). */
  guardianFinalEnemyId: string | null;
  /** rgb triple driving `--node-rgb` on the arrival screen. */
  tintRgb: string;
  ambience: AmbienceKind;
}

/** Act 1 is always this one (docs/locations.md §1). */
export const ACT_ONE_LOCATION_ID = 'wildsEdge';

/** Act 6 is always this one, and the itinerary draw can never produce it. */
export const FINALE_LOCATION_ID = 'theThreshold';

export const locations: Record<string, LocationDefinition> = {
  wildsEdge: {
    id: 'wildsEdge',
    name: "Wild's Edge",
    flavor: 'The last tilled field behind you, the treeline ahead. Everything lives out here.',
    omen: 'The leak runs thin out here. Everything that comes through is small.',
    spawnTypes: null,
    affinity: null,
    exclusiveHeroIds: [],
    guardianFinalEnemyId: GOBLIN_LORD_ID,
    tintRgb: '154, 176, 84',
    ambience: 'fireflies',
  },

  blightedShrine: {
    id: 'blightedShrine',
    name: 'Blighted Shrine',
    flavor: 'Someone still tends these altars. That is the worrying part.',
    omen: 'Shadow, Arcane and Mind leak through these altars, and something has been feeding them.',
    spawnTypes: ['Shadow', 'Arcane', 'Mind'],
    affinity: ['Shadow', 'Arcane', 'Mind'],
    exclusiveHeroIds: [],
    guardianFinalEnemyId: YUGZULACH_ID,
    tintRgb: '139, 127, 224',
    ambience: 'sigils',
  },

  forbiddenForest: {
    id: 'forbiddenForest',
    name: 'Forbidden Forest',
    flavor: 'The path closes behind you. It was never a path.',
    omen: 'Nature, Beast and Light leak into this wood, and the wood has grown around them.',
    spawnTypes: ['Nature', 'Beast', 'Light'],
    affinity: ['Nature', 'Beast', 'Light'],
    exclusiveHeroIds: [],
    guardianFinalEnemyId: ELDER_BOUGH_ID,
    tintRgb: '86, 190, 130',
    ambience: 'spores',
  },

  moltenFoundry: {
    id: 'moltenFoundry',
    name: 'Molten Foundry',
    flavor: 'Nobody has fed these furnaces in an age. They are still running.',
    omen: 'Fire, Mech and Iron leak through the furnaces. They never stopped working.',
    spawnTypes: ['Fire', 'Mech', 'Iron'],
    affinity: ['Fire', 'Mech', 'Iron'],
    exclusiveHeroIds: [],
    guardianFinalEnemyId: LAVA_BEAST_ID,
    tintRgb: '226, 104, 60',
    ambience: 'embers',
  },

  stormCoast: {
    id: 'stormCoast',
    name: 'Storm Coast',
    flavor: 'Longships in the shallows, and the weather is on their side.',
    omen: 'Storm, Water and Stone leak onto this shore, and the weather agrees with them.',
    spawnTypes: ['Storm', 'Water', 'Stone'],
    affinity: ['Storm', 'Water', 'Stone'],
    exclusiveHeroIds: [],
    guardianFinalEnemyId: KRAKEN_ID,
    tintRgb: '74, 144, 217',
    ambience: 'rain',
  },

  // Two spawn types, not three: fourteen types into five three-seat locations is a seat short,
  // and the Necropolis takes the narrower shape rather than sharing Shadow with the Shrine
  // (docs/titanspawn-overhaul.md §3). Shadow stays in the hero-pool affinity so the weighting
  // still matches more than one Skirmish's worth of heroes (docs/locations.md §2).
  necropolis: {
    id: 'necropolis',
    name: 'Necropolis',
    flavor: 'A city that kept its citizens. None of them left.',
    omen: 'Spirit and Frost leak through this city, and the city keeps them well.',
    spawnTypes: ['Spirit', 'Frost'],
    affinity: ['Spirit', 'Frost', 'Shadow'],
    exclusiveHeroIds: [],
    guardianFinalEnemyId: SKELETON_KING_ID,
    tintRgb: '132, 198, 208',
    ambience: 'snow',
  },

  // Act 6 only, and never drawn (docs/run-loop.md §4). No Skirmish, `fight` or `battle`
  // node exists here, so `spawnTypes` is empty and `affinity` never biases anything —
  // it is Ancient purely so the arrival screen names the one domain standing here rather
  // than falling through to Wild's Edge's "every domain walks here".
  // `guardianFinalEnemyId` IS read: it is what the finale's bench ends on.
  theThreshold: {
    id: 'theThreshold',
    name: 'The Threshold',
    flavor: 'Six wardens stood here once. You are the reason five of them do not.',
    omen: 'Nothing leaks here. One thing waits.',
    spawnTypes: [],
    affinity: ['Ancient'],
    exclusiveHeroIds: [],
    guardianFinalEnemyId: ENDBRINGER_ID,
    tintRgb: '222, 196, 132',
    ambience: 'sigils',
  },
};

/** The pool acts 2-5 draw from, without replacement. Neither fixed act is in it. */
export const ITINERARY_POOL_IDS: readonly string[] = Object.keys(locations).filter(
  (id) => id !== ACT_ONE_LOCATION_ID && id !== FINALE_LOCATION_ID
);

/**
 * The domains a Location's screens mark: what spawns here, which is the counter-pick the player
 * is choosing against. A Location with no mob layer shows its affinity instead (The Threshold's
 * Ancient), and `null` is Wild's Edge — every domain.
 */
export function locationDomains(location: LocationDefinition): readonly TypeId[] | null {
  if (location.spawnTypes === null) return null;
  return location.spawnTypes.length > 0 ? location.spawnTypes : location.affinity;
}
