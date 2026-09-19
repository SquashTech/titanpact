// Location selection and encounter biasing (docs/locations.md). A Location
// changes WHO you fight, never how the fight resolves.

import type { HeroLookup } from '../engine/state';
import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';
import { ACT_ONE_LOCATION_ID, FINALE_LOCATION_ID, ITINERARY_POOL_IDS, locations, type LocationDefinition } from '../data/locations';
import type { PoolBias } from './enemyGen';
import { SEAL_ACTS, type RunState } from './state';

/** How many places an act offers (docs/locations.md §1): the player picks one. */
export const LOCATION_CHOICE_COUNT = 2;

/**
 * `RunState.locationIds` is a HISTORY, index 0 = Act 1: a run knows where it has been and where
 * it stands, never where it is going. Every seal act after the first opens on a choice; the
 * finale is seated by `advanceToNextAct`, since the Threshold is where the seals lead rather
 * than a place to pick. True while the current act has no location yet.
 */
export function locationChoiceDue(run: RunState): boolean {
  return run.actNumber <= SEAL_ACTS && run.locationIds.length < run.actNumber;
}

/**
 * The seal locations a run may stand in: every base one, plus each bought one whose Constellation
 * offer is held (`LocationDefinition.unlock`, data/starShop.ts). Read once, where the pool is
 * read — the sim and the tests pass nothing and get the base game.
 */
export function locationPool(purchases: readonly string[] = []): string[] {
  return Object.keys(locations).filter((id) => {
    const { unlock } = locations[id];
    return id !== FINALE_LOCATION_ID && (!unlock || purchases.includes(unlock));
  });
}

/** Every seal location in the pool not yet visited — a location is never visited twice in one run. */
export function unvisitedLocationIds(visited: readonly string[], pool: readonly string[] = locationPool()): string[] {
  return pool.filter((id) => !visited.includes(id));
}

/**
 * The act's offer: LOCATION_CHOICE_COUNT of what is left, drawn off `seed` — fewer only when
 * fewer remain. Sequencing is the decision (the Necropolis now, while the Fire coverage holds),
 * so the offer is drawn flat off what is left and never weighted.
 */
export function drawLocationCandidates(visited: readonly string[], seed: number, pool: readonly string[] = locationPool()): string[] {
  let rng: RngState = createRng(seed);
  const remaining = unvisitedLocationIds(visited, pool);
  const drawn: string[] = [];
  while (drawn.length < LOCATION_CHOICE_COUNT && remaining.length > 0) {
    const { value, nextState } = nextFloat(rng);
    rng = nextState;
    drawn.push(remaining.splice(Math.floor(value * remaining.length), 1)[0]);
  }
  return drawn;
}

export class LocationChoiceError extends Error {}

/** Seats the pick as the current act's place. Refuses a place already visited or outside the pool, and any pick when none is due. */
export function chooseLocation(run: RunState, locationId: string, pool: readonly string[] = locationPool()): RunState {
  if (!locationChoiceDue(run)) throw new LocationChoiceError('no location choice is due');
  if (!unvisitedLocationIds(run.locationIds, pool).includes(locationId)) throw new LocationChoiceError(`${locationId} is not open to this run`);
  return { ...run, locationIds: [...run.locationIds, locationId] };
}

/**
 * A whole run's places drawn at once — index 0 Wild's Edge, the last the Threshold, acts 2-5
 * without replacement — for a fixture or a dev route that stands a run past the choices it
 * would have made. A played run walks `drawLocationCandidates` / `chooseLocation` instead;
 * the shape is the same, so exactly one pool location goes unvisited either way, which is the
 * sixth seal (docs/lore.md §5).
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

/**
 * The base seal locations a run never visited — the seals that held (docs/lore.md §5). Exactly
 * one in the base game; a run that stood in a bought Location leaves two of the base six shut.
 */
export function unbrokenSealLocationIds(itinerary: readonly string[]): string[] {
  return ITINERARY_POOL_IDS.filter((id) => !itinerary.includes(id));
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
