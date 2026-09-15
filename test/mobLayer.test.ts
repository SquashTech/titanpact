// The mob layer (docs/titanspawn-overhaul.md §3-§4, src/run/spawn.ts): Locations partition the
// fourteen types, the opener and the Guardian's escorts draw Titanspawn by Location and act, and
// the two tiers-by-act tables say which body stands where.

import * as assert from 'assert';
import { test } from './harness';
import { locations, ITINERARY_POOL_IDS, ACT_ONE_LOCATION_ID, FINALE_LOCATION_ID, locationDomains } from '../src/data/locations';
import { SPAWN_TYPES, spawnPool, spawnPosition, titanspawn } from '../src/data/titanspawn';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import {
  encounterScaling,
  OPENER_ESCORT_COUNT,
  OPENER_GEAR_FROM_ACT,
  SPAWN_TIER_BY_ACT,
  spawnLeaderTierFor,
  spawnTierFor,
} from '../src/run/difficulty';
import { generateEncounter, generateSpawnEncounter } from '../src/run/enemyGen';
import { ACT_ONE_OPENER_COUNT, guardianEscortPool, mobEncounter } from '../src/run/spawn';
import { actAllowsRarity, parseEquipmentId } from '../src/run/equipment';
import { isRecruitable } from '../src/run/recruitment';

test('mobLayer: the five run Locations partition the fourteen spawning types, Wild\'s Edge takes all and the Threshold none', () => {
  const seen = new Map<string, string>();
  for (const id of ITINERARY_POOL_IDS) {
    const { spawnTypes } = locations[id];
    assert.ok(spawnTypes && spawnTypes.length >= 2, `${id} fields fewer than two lines`);
    for (const type of spawnTypes) {
      assert.ok(SPAWN_TYPES.includes(type), `${id} fields ${type}, which never spawns`);
      assert.ok(!seen.has(type), `${type} spawns at both ${seen.get(type)} and ${id}`);
      seen.set(type, id);
    }
  }
  assert.strictEqual(seen.size, SPAWN_TYPES.length, 'a spawning type has no home');
  assert.strictEqual(locations[ACT_ONE_LOCATION_ID].spawnTypes, null);
  assert.deepStrictEqual(locations[FINALE_LOCATION_ID].spawnTypes, []);
  // The Necropolis is the two-seat Location by decision (§3).
  assert.deepStrictEqual([...locations.necropolis.spawnTypes!], ['Spirit', 'Frost']);
});

test('mobLayer: the screens mark what spawns here, and fall back to the affinity where nothing does', () => {
  assert.strictEqual(locationDomains(locations.wildsEdge), null);
  assert.deepStrictEqual(locationDomains(locations.moltenFoundry), ['Fire', 'Mech', 'Iron']);
  assert.deepStrictEqual(locationDomains(locations.theThreshold), ['Ancient']);
});

test('mobLayer: the tier tables — Early in Act 1, Late from Act 4, the leader floored at Mid', () => {
  assert.deepStrictEqual([...SPAWN_TIER_BY_ACT], ['early', 'mid', 'mid', 'late', 'late']);
  assert.strictEqual(spawnTierFor(1), 'early');
  assert.strictEqual(spawnTierFor(9), 'late', 'acts past the table hold at its last entry');
  assert.strictEqual(spawnLeaderTierFor(1), 'mid');
  assert.strictEqual(spawnLeaderTierFor(2), 'mid');
  assert.strictEqual(spawnLeaderTierFor(5), 'late');
});

test('mobLayer: spawnPool is the Location\'s lines at one tier, and every id in it is a spawn', () => {
  const foundry = spawnPool(locations.moltenFoundry.spawnTypes, 'mid');
  assert.deepStrictEqual(Object.keys(foundry).sort(), ['gearhound', 'ingot', 'kindlehide']);
  assert.strictEqual(Object.keys(spawnPool(null, 'late')).length, SPAWN_TYPES.length);
  assert.deepStrictEqual(spawnPool([], 'early'), {});
  for (const id of Object.keys(foundry)) assert.ok(!isRecruitable(id, heroes), `${id} would produce a contract`);
});

test('mobLayer: Act 1\'s opener is two bare Earlies from every line', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { run, squad } = mobEncounter('fight', locations.wildsEdge, 1, seed, encounterScaling('fight', 1));
    assert.strictEqual(run.roster.length, ACT_ONE_OPENER_COUNT);
    assert.strictEqual(squad.benchIds.length, 0);
    for (const entry of run.roster) {
      assert.strictEqual(spawnPosition(entry.heroId)?.tier, 'early');
      assert.deepStrictEqual(entry.equipment, []);
      assert.deepStrictEqual(entry.evolutionStatGrants, {}, 'Act 1 monsters take no stat steps');
    }
  }
});

test('mobLayer: from Act 2 the opener is a Mid among Earlies, and the Earlies each carry an item on the act\'s rarity curve', () => {
  for (const act of [2, 3, 4, 5]) {
    const location = locations.blightedShrine;
    const { run, squad } = mobEncounter('fight', location, act, 40 + act, encounterScaling('fight', act));
    assert.strictEqual(run.roster.length, 1 + OPENER_ESCORT_COUNT);
    assert.strictEqual(squad.activeIds[0], run.roster[0].rosterId, 'the leader is first on the field');
    const [leader, ...escorts] = run.roster;
    assert.strictEqual(spawnPosition(leader.heroId)?.tier, spawnLeaderTierFor(act));
    assert.deepStrictEqual(leader.equipment, [], 'the leader is the upgrade already');
    for (const escort of escorts) {
      const position = spawnPosition(escort.heroId)!;
      assert.strictEqual(position.tier, 'early');
      assert.ok(location.spawnTypes!.includes(position.line.type), `${escort.heroId} is not a Shrine line`);
      assert.strictEqual(escort.equipment.length, act >= OPENER_GEAR_FROM_ACT ? 1 : 0);
      const item = equipment[escort.equipment[0]];
      assert.ok(item, `${escort.equipment[0]} is not an item`);
      assert.ok(actAllowsRarity(act, item.rarity), `a ${item.rarity} item in Act ${act}`);
      assert.ok(parseEquipmentId(escort.equipment[0]).base, 'the item is a family item, not a unique');
    }
  }
});

test('mobLayer: the battle node fields the leader shape in every act, Act 1 included', () => {
  const { run } = mobEncounter('battle', locations.wildsEdge, 1, 9, encounterScaling('battle', 1));
  assert.strictEqual(run.roster.length, 1 + OPENER_ESCORT_COUNT);
  assert.strictEqual(spawnPosition(run.roster[0].heroId)?.tier, 'mid');
  for (const escort of run.roster.slice(1)) assert.deepStrictEqual(escort.equipment, [], 'Act 1 escorts are bare');
});

test('mobLayer: a two-line Location repeats a body rather than coming up short, with unique roster ids', () => {
  const { run } = generateSpawnEncounter(3, { types: locations.necropolis.spawnTypes, escortTier: 'early', escortCount: 3 });
  assert.strictEqual(run.roster.length, 3);
  const heroIds = run.roster.map((r) => r.heroId);
  assert.strictEqual(new Set(heroIds).size, 2);
  assert.strictEqual(new Set(run.roster.map((r) => r.rosterId)).size, 3);
  for (const id of heroIds) assert.ok(['wispling', 'sleetling'].includes(id));
});

test('mobLayer: the spawn generator is deterministic per seed, gear included', () => {
  const opts = { types: locations.stormCoast.spawnTypes, leaderTier: 'mid' as const, escortTier: 'early' as const, escortCount: 3, escortLoadout: { gear: { common: 1, rare: 1, epic: 0, legendary: 0, mythic: 0 } } };
  const a = generateSpawnEncounter(77, opts);
  const b = generateSpawnEncounter(77, opts);
  assert.deepStrictEqual(a.run.roster, b.run.roster);
  const c = generateSpawnEncounter(78, opts);
  assert.notStrictEqual(JSON.stringify(a.run.roster), JSON.stringify(c.run.roster));
});

test("mobLayer: the Guardian's escorts are two of the Location's spawn at the act's tier", () => {
  for (const [act, expected] of [[1, 'early'], [3, 'mid'], [5, 'late']] as const) {
    const location = act === 1 ? locations.wildsEdge : locations.forbiddenForest;
    const pool = guardianEscortPool(location, act);
    const { run } = generateEncounter('boss', 5, pool, { scaling: encounterScaling('boss', act) });
    assert.strictEqual(run.roster.length, 2);
    for (const entry of run.roster) {
      const position = spawnPosition(entry.heroId)!;
      assert.strictEqual(position.tier, expected);
      if (location.spawnTypes) assert.ok(location.spawnTypes.includes(position.line.type));
      assert.ok(entry.heroId in titanspawn);
    }
  }
});
