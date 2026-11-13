import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { CAMP_BUNDLES, MEND_BUNDLES, PLAIN_MEND } from '../src/data/campBundles';
import { rarityWeightsFor } from '../src/run/equipment';
import { CAMP_DOOR_COUNT, bundleOpen, campBundle, rollCampDoors, rollCampGear, rollCampGemShelf } from '../src/run/camp';
import { GEM_ORDER, gemPointsForAct } from '../src/run/gems';
import { MASTERY_CAP } from '../src/run/mastery';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { createRng, nextFloat, type RngState } from '../src/engine/rng/seededRng';

function seeded(seed: number): () => number {
  let state: RngState = createRng(seed);
  return () => {
    const { value, nextState } = nextFloat(state);
    state = nextState;
    return value;
  };
}

function seedRoster(heroIds: string[]): RunState {
  let run = createRunState();
  for (const heroId of heroIds) run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  return run;
}

// --- The doors (docs/guild-hall-overhaul.md §10) ---

test('camp: three doors, the first a Mend bundle, the other two distinct bundles off the table', () => {
  const run = seedRoster(['cinderKnight', 'ironWarden']);
  const mendIds = new Set([...MEND_BUNDLES, PLAIN_MEND].map((b) => b.id));
  const tableIds = new Set(CAMP_BUNDLES.map((b) => b.id));
  for (let seed = 1; seed <= 40; seed++) {
    const doors = rollCampDoors(run, seeded(seed));
    assert.strictEqual(doors.length, CAMP_DOOR_COUNT);
    assert.ok(mendIds.has(doors[0]), `seed ${seed}: ${doors[0]} is not a Mend door`);
    assert.strictEqual(campBundle(doors[0])!.pieces[0].kind, 'mend');
    assert.ok(doors.slice(1).every((id) => tableIds.has(id)));
    assert.strictEqual(new Set(doors).size, doors.length);
    assert.deepStrictEqual(rollCampDoors(run, seeded(seed)), doors, 'the same seed, the same doors');
  }
});

test('camp: a Mend door carries only a small rider, and every table bundle pays about one full reward', () => {
  for (const bundle of MEND_BUNDLES) {
    assert.strictEqual(bundle.pieces.length, 2);
    const rider = bundle.pieces[1];
    assert.ok(rider.kind === 'blessing' || (rider.kind === 'gems' && rider.take === 1), `${bundle.id}'s rider is too big`);
  }
  for (const bundle of CAMP_BUNDLES) {
    assert.ok(!bundle.pieces.some((p) => p.kind === 'mend'), `${bundle.id} heals`);
    for (const piece of bundle.pieces) if (piece.kind === 'gems' || piece.kind === 'gear') assert.ok(piece.take < piece.of, `${bundle.id} offers no choice`);
  }
});

test('camp: a bundle nobody can take is never rolled — Gems with everyone mastered, a Blessing with everyone Blessed', () => {
  const base = seedRoster(['cinderKnight', 'ironWarden']);
  const mastered = { ...base, roster: base.roster.map((e) => ({ ...e, mastery: MASTERY_CAP })) };
  const blessed = { ...base, roster: base.roster.map((e) => ({ ...e, blessed: true })) };
  for (let seed = 1; seed <= 30; seed++) {
    for (const run of [mastered, blessed]) {
      for (const id of rollCampDoors(run, seeded(seed))) assert.ok(bundleOpen(run, campBundle(id)!), `seed ${seed}: ${id}`);
    }
  }
  const both = { ...mastered, roster: mastered.roster.map((e) => ({ ...e, blessed: true })) };
  assert.strictEqual(rollCampDoors(both, seeded(1))[0], PLAIN_MEND.id, 'no rider left: a plain Mend');
});

// --- The pieces ---

test('camp: a Gem shelf is distinct stats at the act\'s size, in Gem order', () => {
  for (let act = 1; act <= 4; act++) {
    const shelf = rollCampGemShelf(act, 5, seeded(act));
    assert.strictEqual(shelf.length, 5);
    assert.strictEqual(new Set(shelf.map((g) => g.stat)).size, 5);
    assert.ok(shelf.every((g) => g.points === gemPointsForAct(act)));
    assert.deepStrictEqual(shelf.map((g) => g.stat), GEM_ORDER.filter((s) => shelf.some((g) => g.stat === s)));
  }
});

test('camp: the gear lays out real pieces on the act\'s standard curve, the same for the same seed', () => {
  for (let act = 1; act <= 4; act++) {
    const weights = rarityWeightsFor(act, 'standard');
    for (let seed = 1; seed <= 10; seed++) {
      const ids = rollCampGear(act, 4, seeded(seed));
      assert.strictEqual(ids.length, 4);
      for (const id of ids) assert.ok(equipment[id] && weights[equipment[id].rarity] > 0, `act ${act}: ${id}`);
      assert.deepStrictEqual(rollCampGear(act, 4, seeded(seed)), ids);
    }
  }
});
