import * as assert from 'assert';
import { test } from './harness';
import { generateItinerary, locationForAct, affinityHeroIds, locationBias } from '../src/run/locations';
import { ACT_ONE_LOCATION_ID, ITINERARY_POOL_IDS, locations } from '../src/data/locations';
import { generateEncounter } from '../src/run/enemyGen';
import { heroes } from '../src/data/heroes';
import { TOTAL_ACTS } from '../src/run/state';

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

test('locations: the authored pool leaves the last act a real choice', () => {
  // Acts 2-TOTAL_ACTS are TOTAL_ACTS - 1 picks, so filling a run only needs
  // that many non-Act-1 locations. The 1-of-2 choice per act
  // (docs/locations.md §1) needs exactly one more, so the FINAL act still has
  // two candidates left to choose between rather than one forced remainder:
  // Act 2 picks from 5, Act 3 from 4, Act 4 from 3, Act 5 from the last 2.
  // Authoring a location, or dropping one, changes that — this pins it so it
  // cannot happen by accident.
  assert.strictEqual(ITINERARY_POOL_IDS.length, TOTAL_ACTS);
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
  // The reason affinity is a weighting and not a filter (docs/locations.md
  // §2): Necropolis on its originally proposed Spirit/Frost pair matched
  // exactly 4 heroes, which is the size of a Skirmish — every fight there
  // would have been the identical four. Shadow was added to open it up. This
  // guards the authored affinities against drifting back under that line.
  for (const location of Object.values(locations)) {
    if (!location.affinity) continue;
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
  // The bias seam must not perturb the RNG when nothing is biasing — every
  // existing encounter (the Goblin pools, Wild's Edge) has to keep drawing
  // exactly what it drew before.
  for (let seed = 1; seed <= 10; seed++) {
    const before = generateEncounter('fight', seed, heroes);
    const after = generateEncounter('fight', seed, heroes, {});
    assert.deepStrictEqual(
      after.run.roster.map((e) => e.heroId),
      before.run.roster.map((e) => e.heroId)
    );
  }
});
