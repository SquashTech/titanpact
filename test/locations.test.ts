import * as assert from 'assert';
import { test } from './harness';
import {
  generateItinerary,
  locationDue,
  locationForAct,
  seatNextLocation,
  affinityHeroIds,
  locationBias,
  unbrokenSealLocationIds,
  unvisitedLocationIds,
} from '../src/run/locations';
import { ACT_ONE_LOCATION_ID, FINALE_LOCATION_ID, ITINERARY_POOL_IDS, locations } from '../src/data/locations';
import { generateEncounter } from '../src/run/enemyGen';
import { advanceToNextAct } from '../src/run/runProgress';
import { heroes } from '../src/data/heroes';
import { createRunState, SEAL_ACTS, TOTAL_ACTS, type RunState } from '../src/run/state';

// --- The draw (docs/locations.md §1) ---

function runAtActOne(): RunState {
  return { ...createRunState(), locationIds: [ACT_ONE_LOCATION_ID] };
}

test('locations: a place is due on every seal act after the first, and never on the finale', () => {
  let run = runAtActOne();
  assert.ok(!locationDue(run), 'Act 1 is fixed');
  assert.strictEqual(seatNextLocation(run, 1), run, 'nothing is seated when none is due');
  for (let act = 2; act <= SEAL_ACTS; act++) {
    run = advanceToNextAct(run, act);
    assert.ok(locationDue(run), `act ${act} should be due a place`);
    run = seatNextLocation(run, act);
    assert.ok(!locationDue(run), `act ${act} is seated once drawn`);
  }
  run = advanceToNextAct(run, 99);
  assert.ok(!locationDue(run), 'the Threshold is not drawn');
  assert.strictEqual(locationForAct(run.locationIds, TOTAL_ACTS).id, FINALE_LOCATION_ID);
});

test('locations: each act draws one of what is left, never a repeat or the finale', () => {
  for (let seed = 1; seed <= 40; seed++) {
    let run = runAtActOne();
    for (let act = 2; act <= SEAL_ACTS; act++) {
      run = seatNextLocation(advanceToNextAct(run, seed * 100 + act), seed * 100 + act);
      const drawn = run.locationIds[act - 1];
      assert.ok(!run.locationIds.slice(0, act - 1).includes(drawn), `seed ${seed} act ${act} repeated ${drawn}`);
      assert.notStrictEqual(drawn, FINALE_LOCATION_ID);
    }
    // Two seal locations go unvisited under four acts: the seals that held (docs/lore.md §5).
    assert.strictEqual(unvisitedLocationIds(run.locationIds).length, ITINERARY_POOL_IDS.length - (SEAL_ACTS - 1), `seed ${seed}`);
    assert.strictEqual(unvisitedLocationIds(run.locationIds).length, 2, `seed ${seed}`);
    assert.deepStrictEqual(unbrokenSealLocationIds(run.locationIds), unvisitedLocationIds(run.locationIds));
  }
});

test('locations: the draw is a pure function of the seed', () => {
  const run = advanceToNextAct(runAtActOne(), 1);
  assert.deepStrictEqual(seatNextLocation(run, 7).locationIds, seatNextLocation(run, 7).locationIds);
});

test("locations: a Visit run standing anywhere still has Wild's Edge on offer later", () => {
  // The dev route's Act 1 is the chosen place; the rule is only "never twice".
  const offer = unvisitedLocationIds(['necropolis']);
  assert.ok(offer.includes(ACT_ONE_LOCATION_ID));
  assert.ok(!offer.includes('necropolis'));
  assert.ok(!offer.includes(FINALE_LOCATION_ID));
});

// --- A whole itinerary at once (fixtures and dev routes) ---

test('locations: Act 1 is always Wild\'s Edge, whatever the seed', () => {
  for (let seed = 1; seed <= 40; seed++) {
    assert.strictEqual(generateItinerary(seed)[0], ACT_ONE_LOCATION_ID);
  }
});

test('locations: an itinerary covers every act and never repeats a location', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const itinerary = generateItinerary(seed);
    assert.strictEqual(itinerary.length, TOTAL_ACTS);
    assert.strictEqual(new Set(itinerary).size, TOTAL_ACTS, `seed ${seed} repeated a location`);
    for (const id of itinerary) assert.ok(locations[id], `seed ${seed} produced unknown location ${id}`);
  }
});

test('locations: the authored pool covers every seal act', () => {
  // Under four acts two locations go unvisited (docs/lore.md §5).
  assert.ok(ITINERARY_POOL_IDS.length >= SEAL_ACTS - 1);
  assert.ok(!ITINERARY_POOL_IDS.includes(FINALE_LOCATION_ID), 'the finale location must never be drawn');
});

test('locations: locationForAct falls back rather than throwing on an empty itinerary', () => {
  // enemyGen builds throwaway RunStates with no itinerary at all.
  assert.strictEqual(locationForAct([], 1).id, ACT_ONE_LOCATION_ID);
  assert.strictEqual(locationForAct([], 4).id, ACT_ONE_LOCATION_ID);
});

test("locations: Wild's Edge biases nothing — its null affinity is every type", () => {
  const wildsEdge = locations[ACT_ONE_LOCATION_ID];
  assert.strictEqual(wildsEdge.affinity, null);
  assert.deepStrictEqual(affinityHeroIds(wildsEdge, heroes), []);
  assert.strictEqual(locationBias(wildsEdge, heroes, 4), undefined);
});

test('locations: every affinity location matches more heroes than a Skirmish fields', () => {
  // An affinity matching exactly 4 heroes would make every Skirmish there the identical four (docs/locations.md §2).
  for (const location of Object.values(locations)) {
    if (!location.affinity) continue;
    // The Threshold has no Skirmish to field — its Ancient affinity is a label, not a bias.
    if (location.id === FINALE_LOCATION_ID) continue;
    const matches = affinityHeroIds(location, heroes);
    assert.ok(matches.length > 4, `${location.name} matches only ${matches.length} heroes — too thin to vary`);
  }
});

test('locations: a biased encounter fills all but one slot on-theme, and the last from anywhere', () => {
  const necropolis = locations.necropolis;
  const bias = locationBias(necropolis, heroes, 4);
  assert.ok(bias);
  assert.strictEqual(bias!.slots, 3);

  const onTheme = new Set(affinityHeroIds(necropolis, heroes));
  for (let seed = 1; seed <= 30; seed++) {
    const { run } = generateEncounter('fight', seed, heroes, { bias });
    assert.strictEqual(run.roster.length, 4);
    const matching = run.roster.filter((entry) => onTheme.has(entry.heroId)).length;
    // At least 3 on-theme; the wildcard slot may also happen to draw one.
    assert.ok(matching >= 3, `seed ${seed} fielded only ${matching} on-theme heroes`);
    assert.strictEqual(new Set(run.roster.map((e) => e.heroId)).size, 4, `seed ${seed} fielded a duplicate hero`);
  }
});

test('locations: an unbiased encounter is byte-identical to one with no bias argument', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const before = generateEncounter('fight', seed, heroes);
    const after = generateEncounter('fight', seed, heroes, {});
    assert.deepStrictEqual(
      after.run.roster.map((e) => e.heroId),
      before.run.roster.map((e) => e.heroId)
    );
  }
});
