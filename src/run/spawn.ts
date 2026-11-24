// The mob layer (docs/titanspawn-overhaul.md §4): what a Location's Monsters nodes and its
// Guardian's escorts field, by act. Composition only — the tiers come from difficulty.ts, the
// bodies from data/titanspawn.ts, the draw from enemyGen.ts. Shared by App.tsx and the sim so
// the two cannot drift on the one rule that says who stands on the field.

import type { HeroLookup } from '../engine/state';
import type { LocationDefinition } from '../data/locations';
import { spawnPool } from '../data/titanspawn';
import { generateSpawnEncounter, type Encounter } from './enemyGen';
import { hallwayTiersFor, spawnTierFor, type ActScaling } from './difficulty';

/** A hallway fight — the opener or a `battle`: two bare spawn of the act's tier (difficulty.ts hallwayTiersFor). */
export function mobEncounter(location: LocationDefinition, actNumber: number, seed: number, scaling: ActScaling): Encounter {
  return generateSpawnEncounter(seed, { types: location.spawnTypes, escortTiers: hallwayTiersFor(actNumber), scaling });
}

/** The Guardian's two escorts draw from here: the Location's lines at the act's tier. The champion still enters last from the bench. */
export function guardianEscortPool(location: LocationDefinition, actNumber: number): HeroLookup {
  return spawnPool(location.spawnTypes, spawnTierFor(actNumber));
}
