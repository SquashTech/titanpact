// Location selection and encounter biasing (docs/locations.md).
//
// Two jobs, both pure:
//   1. `generateItinerary` — which location each act happens in. Act 1 is
//      always Wild's Edge; acts 2-5 are drawn from the rest WITHOUT
//      replacement, so a location is never visited twice in one run.
//   2. `locationBias` — turns a location's type affinity into the generic
//      `PoolBias` enemyGen.ts consumes. enemyGen stays location-agnostic:
//      it knows "prefer these ids for this many slots", not what a location
//      is.
//
// Nothing here touches combat resolution or the damage pipeline — a Location
// changes *who* you fight, never how the fight is resolved.

import type { HeroLookup } from '../engine/state';
import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import { ACT_ONE_LOCATION_ID, ITINERARY_POOL_IDS, locations, type LocationDefinition } from '../data/locations';
import type { PoolBias } from './enemyGen';
import { TOTAL_ACTS } from './state';

/**
 * The ordered list of location ids a run will visit, one per act — index 0
 * is Act 1. Always `TOTAL_ACTS` long as long as the authored pool can cover
 * it; if the pool is short, the itinerary is short and `locationForAct`
 * falls back (see below) rather than throwing mid-run.
 *
 * NOTE (docs/locations.md §1): the decided design is that each act offers
 * **2 named locations and the player picks one**. That choice screen is not
 * built yet, so this draws the whole itinerary up front. When it lands, this
 * function becomes the source of the *candidates* rather than the committed
 * order — the without-replacement bookkeeping is the same either way, which
 * is why it lives here rather than inline in App.tsx.
 */
export function generateItinerary(seed: number): string[] {
  let rng: RngState = createRng(seed);
  const remaining = [...ITINERARY_POOL_IDS];
  const itinerary: string[] = [ACT_ONE_LOCATION_ID];

  while (itinerary.length < TOTAL_ACTS && remaining.length > 0) {
    const { value, nextState } = nextFloat(rng);
    rng = nextState;
    itinerary.push(remaining.splice(Math.floor(value * remaining.length), 1)[0]);
  }

  return itinerary;
}

/**
 * The location for a 1-indexed act number. Falls back to Act 1's location
 * rather than throwing: a RunState built by enemyGen.ts for a throwaway AI
 * roster has no itinerary at all, and neither does a run saved before this
 * system existed.
 */
export function locationForAct(itinerary: readonly string[], actNumber: number): LocationDefinition {
  return locations[itinerary[actNumber - 1]] ?? locations[ACT_ONE_LOCATION_ID];
}

/** Every hero in `pool` drawing on one of the location's affinity types. Empty for a null (all-types) affinity — see `locationBias`. */
export function affinityHeroIds(location: LocationDefinition, pool: HeroLookup): string[] {
  const { affinity } = location;
  if (!affinity) return [];
  return Object.values(pool)
    .filter((hero) => hero.types.some((type) => affinity.includes(type)))
    .map((hero) => hero.id);
}

/**
 * The location's encounter bias, or `undefined` for a location that does not
 * bias at all (Wild's Edge, whose affinity is null — every type, so there is
 * nothing to prefer).
 *
 * `slots` is deliberately "all but one": an encounter fills every slot bar
 * the last from on-theme heroes, then draws the last from the whole pool.
 * That wildcard is what keeps a location varied without needing a wide
 * authored roster behind it (docs/locations.md §2), and it is why this is a
 * weighting rather than a filter.
 */
export function locationBias(location: LocationDefinition, pool: HeroLookup, heroCount: number): PoolBias | undefined {
  const preferredIds = affinityHeroIds(location, pool);
  if (preferredIds.length === 0) return undefined;
  return { preferredIds, slots: Math.max(0, heroCount - 1) };
}
