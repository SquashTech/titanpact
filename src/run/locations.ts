// Location selection and encounter biasing (docs/locations.md). A Location
// changes WHO you fight, never how the fight resolves.

import type { HeroLookup } from '../engine/state';
import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import { ACT_ONE_LOCATION_ID, FINALE_LOCATION_ID, ITINERARY_POOL_IDS, locations, type LocationDefinition } from '../data/locations';
import type { PoolBias } from './enemyGen';
import { SEAL_ACTS } from './state';

/**
 * One location id per act, index 0 = Act 1 (always Wild's Edge) and the last always the
 * finale's Threshold (docs/run-loop.md §4); acts 2-5 drawn without replacement. Exactly
 * one pool location goes unvisited every run, which is the sixth seal (docs/lore.md §5).
 * The decided design (2 candidates per act, player picks) is not built yet;
 * when it lands this becomes the source of candidates.
 */
export function generateItinerary(seed: number): string[] {
  let rng: RngState = createRng(seed);
  const remaining = [...ITINERARY_POOL_IDS];
  const itinerary: string[] = [ACT_ONE_LOCATION_ID];

  while (itinerary.length < SEAL_ACTS && remaining.length > 0) {
    const { value, nextState } = nextFloat(rng);
    rng = nextState;
    itinerary.push(remaining.splice(Math.floor(value * remaining.length), 1)[0]);
  }
  // A pool shorter than the run would slide the finale off act 6; locationForAct's
  // fallback, made explicit so the last index stays the last index.
  while (itinerary.length < SEAL_ACTS) itinerary.push(ACT_ONE_LOCATION_ID);
  itinerary.push(FINALE_LOCATION_ID);

  return itinerary;
}

/** The one location a run never visits — the seal that held (docs/lore.md §5). */
export function unbrokenSealLocationId(itinerary: readonly string[]): string | null {
  return ITINERARY_POOL_IDS.find((id) => !itinerary.includes(id)) ?? null;
}

/** Falls back to Act 1's location: throwaway RunStates have no itinerary. */
export function locationForAct(itinerary: readonly string[], actNumber: number): LocationDefinition {
  return locations[itinerary[actNumber - 1]] ?? locations[ACT_ONE_LOCATION_ID];
}

/** Empty for a null (all-types) affinity. */
export function affinityHeroIds(location: LocationDefinition, pool: HeroLookup): string[] {
  const { affinity } = location;
  if (!affinity) return [];
  return Object.values(pool)
    .filter((hero) => hero.types.some((type) => affinity.includes(type)))
    .map((hero) => hero.id);
}

/** `slots` is "all but one": the last slot is a wildcard from the whole pool — a weighting, not a filter. */
export function locationBias(location: LocationDefinition, pool: HeroLookup, heroCount: number): PoolBias | undefined {
  const preferredIds = affinityHeroIds(location, pool);
  if (preferredIds.length === 0) return undefined;
  return { preferredIds, slots: Math.max(0, heroCount - 1) };
}
