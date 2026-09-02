// The six run Locations (docs/locations.md): the identity an act wears. Pure data — `affinity`
// feeds src/run/locations.ts's PoolBias; the presentation fields feed locationArt/ActIntroScreen.

import type { TypeId } from '../engine/content';
import { DEFAULT_FACTION_ID, GOBLIN_LORD_ID, YUGZULACH_ID } from './enemies';

/** Particle-field motion (docs/locations.md §4). */
export type AmbienceKind = 'fireflies' | 'embers' | 'snow' | 'rain' | 'spores' | 'sigils';

export interface LocationDefinition {
  id: string;
  /** The act's title card. */
  name: string;
  /** Flavour name over the location's non-recruitable mob pool. */
  faction: string;
  /** One line, spoken on arrival. */
  flavor: string;
  /** Types the skirmish/elite/boss encounters lean on — a weighting, not a filter (docs/locations.md §2). `null` = every type. */
  affinity: readonly TypeId[] | null;
  /** Hero ids obtainable only here. Empty on every location today (docs/locations.md §3). */
  exclusiveHeroIds: readonly string[];
  /** The faction key (enemies.ts `factions`) the fight/battle nodes draw from. */
  factionId: string;
  /** Enemy held on the Guardian fight's bench so it enters last (enemyGen.ts `appendFinalEnemy`). */
  guardianFinalEnemyId: string | null;
  /** rgb triple driving `--node-rgb` on the arrival screen. */
  tintRgb: string;
  ambience: AmbienceKind;
}

/** Act 1 is always this one (docs/locations.md §1). */
export const ACT_ONE_LOCATION_ID = 'wildsEdge';

export const locations: Record<string, LocationDefinition> = {
  wildsEdge: {
    id: 'wildsEdge',
    name: "Wild's Edge",
    faction: 'Goblins',
    flavor: 'The last tilled field behind you, the treeline ahead. Everything lives out here.',
    affinity: null,
    exclusiveHeroIds: [],
    factionId: DEFAULT_FACTION_ID,
    guardianFinalEnemyId: GOBLIN_LORD_ID,
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
    factionId: 'cultists',
    guardianFinalEnemyId: YUGZULACH_ID,
    tintRgb: '139, 127, 224',
    ambience: 'sigils',
  },

  // These four still field Goblins: their own rosters are unauthored (docs/locations.md §5.2).
  forbiddenForest: {
    id: 'forbiddenForest',
    name: 'Forbidden Forest',
    faction: 'Fae',
    flavor: 'The path closes behind you. It was never a path.',
    affinity: ['Nature', 'Stone', 'Light'],
    exclusiveHeroIds: [],
    factionId: DEFAULT_FACTION_ID,
    guardianFinalEnemyId: null,
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
    factionId: DEFAULT_FACTION_ID,
    guardianFinalEnemyId: null,
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
    factionId: DEFAULT_FACTION_ID,
    guardianFinalEnemyId: null,
    tintRgb: '74, 144, 217',
    ambience: 'rain',
  },

  necropolis: {
    id: 'necropolis',
    name: 'Necropolis',
    faction: 'Undead',
    flavor: 'A city that kept its citizens. None of them left.',
    // Shadow is here so the affinity matches more than one Skirmish's worth of heroes (§2).
    affinity: ['Spirit', 'Frost', 'Shadow'],
    exclusiveHeroIds: [],
    factionId: DEFAULT_FACTION_ID,
    guardianFinalEnemyId: null,
    tintRgb: '132, 198, 208',
    ambience: 'snow',
  },
};

/** The pool acts 2-5 draw from, without replacement. */
export const ITINERARY_POOL_IDS: readonly string[] = Object.keys(locations).filter((id) => id !== ACT_ONE_LOCATION_ID);
