// The six run Locations (docs/locations.md): the identity an act wears. Pure data — `spawnTypes`
// is the mob layer's hard filter (run/spawn.ts), `affinity` feeds src/run/locations.ts's PoolBias;
// the presentation fields feed locationArt/ActIntroScreen.

import type { TypeId } from '../engine/content';
import { ELDER_BOUGH_ID, ENDBRINGER_ID, MANTICORE_ID, DRAGON_ID, KRAKEN_ID, ROC_ID, SERAPH_ID, SKELETON_KING_ID, SPHINX_ID, WENDIGO_ID, YUGZULACH_ID } from './enemies';

/** Particle-field motion (docs/locations.md §4). */
export type AmbienceKind = 'fireflies' | 'embers' | 'snow' | 'rain' | 'spores' | 'sigils' | 'radiance' | 'drift' | 'lightning' | 'blizzard';

export interface LocationDefinition {
  id: string;
  /** The act's title card. */
  name: string;
  /**
   * What is already here, said once — on the map screen at the act's first Monsters node, which
   * is the only row with nothing behind it (MapRoute's omen) — and nowhere else: the arrival and
   * choice screens let the scene speak.
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
  /**
   * The Constellation offer that puts this place in a run's pool (data/starShop.ts); absent on
   * the base six. A bought Location is drawn beside the base five (run/locations.ts
   * `locationPool`) — it never replaces one, so its spawn types may overlap theirs.
   */
  unlock?: string;
}

/** Act 1 is always this one (docs/locations.md §1). */
export const ACT_ONE_LOCATION_ID = 'wildsEdge';

/** Act 6 is always this one, and the itinerary draw can never produce it. */
export const FINALE_LOCATION_ID = 'theThreshold';

export const locations: Record<string, LocationDefinition> = {
  wildsEdge: {
    id: 'wildsEdge',
    name: "Wild's Edge",
    omen: "It's a long road to the Titan. Our journey begins here.",
    spawnTypes: null,
    affinity: null,
    exclusiveHeroIds: [],
    guardianFinalEnemyId: MANTICORE_ID,
    tintRgb: '154, 176, 84',
    ambience: 'fireflies',
  },

  blightedShrine: {
    id: 'blightedShrine',
    name: 'Blighted Shrine',
    omen: 'An impenetrable darkness fills these halls.',
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
    omen: 'It feels like the trees themselves are watching you within.',
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
    omen: 'These furnaces were abandoned long ago, but they never stopped working.',
    spawnTypes: ['Fire', 'Mech', 'Iron'],
    affinity: ['Fire', 'Mech', 'Iron'],
    exclusiveHeroIds: [],
    guardianFinalEnemyId: DRAGON_ID,
    tintRgb: '226, 104, 60',
    ambience: 'embers',
  },

  stormCoast: {
    id: 'stormCoast',
    name: 'Storm Coast',
    omen: 'The rain never stops falling along these shores.',
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
    omen: 'The dead inhabit this city, and they wish for you to join them.',
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
    omen: 'Nothing leaks here. One thing waits.',
    spawnTypes: [],
    affinity: ['Ancient'],
    exclusiveHeroIds: [],
    guardianFinalEnemyId: ENDBRINGER_ID,
    tintRgb: '222, 196, 132',
    ambience: 'sigils',
  },

  // The first bought Location (docs/constellation.md §4, 2026-09-19): in the pool only while its
  // offer is held. Light, Spirit and Mind overlap three base Locations by design — it is drawn
  // BESIDE them, never instead — and its warden is the Seraph, the one Light-bodied seal.
  holySanctum: {
    id: 'holySanctum',
    name: 'Holy Sanctum',
    omen: 'Every candle in this place is lit, and nobody lit them.',
    spawnTypes: ['Light', 'Spirit', 'Mind'],
    affinity: ['Light', 'Spirit', 'Mind'],
    exclusiveHeroIds: [],
    guardianFinalEnemyId: SERAPH_ID,
    tintRgb: '246, 226, 160',
    ambience: 'radiance',
    unlock: 'location.holySanctum',
  },

  // Three more bought Locations (2026-09-19, per user direction), each whose warden covers a type
  // no base Guardian does — Mind, Storm, Frost. Two shared types and one from elsewhere apiece, so
  // none reads as a base Location with different weather.
  dreamingSpires: {
    id: 'dreamingSpires',
    name: 'Dreaming Spires',
    omen: 'The towers here were built by someone asleep, and they are still dreaming them.',
    spawnTypes: ['Mind', 'Arcane', 'Spirit'],
    affinity: ['Mind', 'Arcane', 'Spirit'],
    exclusiveHeroIds: [],
    guardianFinalEnemyId: SPHINX_ID,
    tintRgb: '224, 110, 170',
    ambience: 'drift',
    unlock: 'location.dreamingSpires',
  },

  thunderAerie: {
    id: 'thunderAerie',
    name: 'Thunder Aerie',
    omen: 'The storm does not pass over this peak. It lives here.',
    spawnTypes: ['Storm', 'Arcane', 'Beast'],
    affinity: ['Storm', 'Arcane', 'Beast'],
    exclusiveHeroIds: [],
    guardianFinalEnemyId: ROC_ID,
    tintRgb: '180, 140, 245',
    ambience: 'lightning',
    unlock: 'location.thunderAerie',
  },

  frozenReach: {
    id: 'frozenReach',
    name: 'Frozen Reach',
    omen: 'The ships here never made it back. Neither did the ice.',
    spawnTypes: ['Frost', 'Water', 'Stone'],
    affinity: ['Frost', 'Water', 'Stone'],
    exclusiveHeroIds: [],
    guardianFinalEnemyId: WENDIGO_ID,
    tintRgb: '150, 214, 224',
    ambience: 'blizzard',
    unlock: 'location.frozenReach',
  },
};

/**
 * The BASE pool acts 2-5 draw from, without replacement: neither fixed act, and nothing that has
 * to be bought (`unlock`). A run's actual pool is `locationPool` (run/locations.ts).
 */
export const ITINERARY_POOL_IDS: readonly string[] = Object.keys(locations).filter(
  (id) => id !== ACT_ONE_LOCATION_ID && id !== FINALE_LOCATION_ID && !locations[id].unlock
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
