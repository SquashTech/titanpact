// The six run Locations (docs/locations.md). A Location is the identity an
// act wears — a name, a faction, a type affinity, the heroes findable only
// there, and a look.
//
// Pure data, same as every other content module (CLAUDE.md "Architecture"):
// nothing here is behaviour. `affinity` is read by src/run/locations.ts to
// build an encounter PoolBias; the three presentation fields are read by
// src/view/shared/locationArt.tsx and ActIntroScreen. No engine module
// imports this file.

import type { TypeId } from '../engine/content';

/**
 * How a location's particle field behaves — direction, speed, drift and
 * shape. Six distinct motions rather than one keyframe recoloured six ways:
 * motion is half of what separates a forest from a foundry
 * (docs/locations.md §4).
 */
export type AmbienceKind = 'fireflies' | 'embers' | 'snow' | 'rain' | 'spores' | 'sigils';

export interface LocationDefinition {
  id: string;
  /** Player-facing name — the act's title card. */
  name: string;
  /** The faction that holds this place: the flavour name over its non-recruitable mob pool. */
  faction: string;
  /** One line, spoken on arrival, under the name. */
  flavor: string;
  /**
   * The types this location's `skirmish`/`elite`/`boss` encounters lean on.
   * A **weighting, not a filter** (docs/locations.md §2) — all but one slot
   * is drawn from heroes matching these, the last from the whole pool.
   * `null` means "every type", which is Wild's Edge and only Wild's Edge.
   */
  affinity: readonly TypeId[] | null;
  /**
   * Hero ids obtainable only while this location is current — the rare-hero
   * hunt. Threaded through but **empty on every location today**: which
   * heroes are rare and where they live is authoring work for when the real
   * roster lands (docs/locations.md §3).
   */
  exclusiveHeroIds: readonly string[];
  /**
   * The enemy ids this location's `fight`/`battle` nodes field. Every
   * location points at the Goblins today because they are the only authored
   * enemy content — see docs/locations.md §3 "The faction bill". `null`
   * means "fall back to the default Goblin pool", which is what makes
   * authoring a Cultist roster a one-line change here rather than a
   * refactor.
   */
  factionEnemyIds: readonly string[] | null;
  /** rgb triple driving `--node-rgb` on the arrival screen — the stage routes it through the wash, the title bloom and the particles. */
  tintRgb: string;
  /** Which motion the particle field runs. */
  ambience: AmbienceKind;
}

/** Act 1 is always this one (docs/locations.md §1) — the tutorial ground, and the only all-types location. */
export const ACT_ONE_LOCATION_ID = 'wildsEdge';

export const locations: Record<string, LocationDefinition> = {
  wildsEdge: {
    id: 'wildsEdge',
    name: "Wild's Edge",
    faction: 'Goblins',
    flavor: 'The last tilled field behind you, the treeline ahead. Everything lives out here.',
    // The only null affinity in the set: the player has no team identity yet
    // in Act 1, so nothing should be pressuring it.
    affinity: null,
    exclusiveHeroIds: [],
    factionEnemyIds: null,
    // Warm moss-gold — the wilderness at dusk, adjacent to the run loop's
    // default gold rather than a departure from it.
    tintRgb: '154, 176, 84',
    ambience: 'fireflies',
  },

  blightedShrine: {
    id: 'blightedShrine',
    name: 'Blighted Shrine',
    faction: 'Cultists',
    flavor: 'Someone still tends these altars. That is the worrying part.',
    affinity: ['Shadow', 'Arcane', 'Mind'],
    exclusiveHeroIds: [],
    factionEnemyIds: null,
    /** var(--magical), the game's established arcane violet. */
    tintRgb: '139, 127, 224',
    ambience: 'sigils',
  },

  forbiddenForest: {
    id: 'forbiddenForest',
    name: 'Forbidden Forest',
    faction: 'Fae',
    flavor: 'The path closes behind you. It was never a path.',
    affinity: ['Nature', 'Stone', 'Light'],
    exclusiveHeroIds: [],
    factionEnemyIds: null,
    tintRgb: '86, 190, 130',
    ambience: 'spores',
  },

  moltenFoundry: {
    id: 'moltenFoundry',
    name: 'Molten Foundry',
    faction: 'Automatons',
    flavor: 'Nobody has fed these furnaces in an age. They are still running.',
    affinity: ['Fire', 'Mech', 'Iron'],
    exclusiveHeroIds: [],
    factionEnemyIds: null,
    tintRgb: '226, 104, 60',
    ambience: 'embers',
  },

  stormCoast: {
    id: 'stormCoast',
    name: 'Storm Coast',
    faction: 'Raiders',
    flavor: 'Longships in the shallows, and the weather is on their side.',
    affinity: ['Storm', 'Iron', 'Water'],
    exclusiveHeroIds: [],
    factionEnemyIds: null,
    tintRgb: '74, 144, 217',
    ambience: 'rain',
  },

  necropolis: {
    id: 'necropolis',
    name: 'Necropolis',
    faction: 'Undead',
    flavor: 'A city that kept its citizens. None of them left.',
    // Shadow is the third type here for a mechanical reason, not a flavour
    // one: Spirit/Frost alone matched exactly 4 heroes on the current roster,
    // which is the size of a Skirmish — every Necropolis fight would have
    // been the identical four (docs/locations.md §2).
    affinity: ['Spirit', 'Frost', 'Shadow'],
    exclusiveHeroIds: [],
    factionEnemyIds: null,
    tintRgb: '132, 198, 208',
    ambience: 'snow',
  },
};

/** Every location that is not Act 1's — the pool acts 2-5 draw from, without replacement. */
export const ITINERARY_POOL_IDS: readonly string[] = Object.keys(locations).filter((id) => id !== ACT_ONE_LOCATION_ID);
