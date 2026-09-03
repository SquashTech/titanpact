import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { generateMap } from '../src/run/map';
import {
  reachableNodeIds,
  advanceToNode,
  grantCurrencyReward,
  grantUpgradeReward,
  deferLevelUp,
  grantRelicReward,
  equipToRoster,
  swapEquipment,
  trashEquipment,
  RunProgressError,
} from '../src/run/runProgress';

function seedRoster(heroIds: string[]) {
  let run = createRunState(0, 0);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- Reachability / advancing ---

test('runProgress: a run with no map has no reachable nodes', () => {
  const run = seedRoster(['cinderKnight']);
  assert.deepStrictEqual(reachableNodeIds(run), []);
});

test('runProgress: before entering the map, the start row is reachable', () => {
  const map = generateMap(1);
  const run = { ...seedRoster(['cinderKnight']), map };
  assert.deepStrictEqual(reachableNodeIds(run), map.startNodeIds);
});

test('runProgress: advanceToNode moves onto a reachable node and marks it visited', () => {
  const map = generateMap(1);
  const run = { ...seedRoster(['cinderKnight']), map };
  const firstNode = map.startNodeIds[0];

  const next = advanceToNode(run, firstNode);
  assert.strictEqual(next.currentNodeId, firstNode);
  assert.deepStrictEqual(next.visitedNodeIds, [firstNode]);
  assert.deepStrictEqual(reachableNodeIds(next), map.nodes[firstNode].nextIds);
});

test('runProgress: advanceToNode rejects an unreachable node, an unknown node, and a mapless run', () => {
  const map = generateMap(1);
  const run = { ...seedRoster(['cinderKnight']), map };
  assert.throws(() => advanceToNode(run, 'not-a-real-node'), RunProgressError);
  assert.throws(() => advanceToNode(seedRoster(['cinderKnight']), map.startNodeIds[0]), RunProgressError);

  const farNode = map.bossNodeId;
  if (!map.startNodeIds.includes(farNode)) {
    assert.throws(() => advanceToNode(run, farNode), RunProgressError);
  }
});

// --- Reward grants ---

test('runProgress: grantCurrencyReward and grantUpgradeReward add flat amounts', () => {
  const run = seedRoster(['cinderKnight']);
  assert.strictEqual(grantCurrencyReward(run, 20).gold, 20);
  assert.strictEqual(grantUpgradeReward(run, 2).levelUpPool, 2);
});

test('runProgress: banking the pool suppresses the level-up gate until new XP arrives', () => {
  const run = grantUpgradeReward(seedRoster(['cinderKnight']), 4);
  assert.strictEqual(run.levelUpDeferred, false);

  const banked = deferLevelUp(run);
  assert.strictEqual(banked.levelUpDeferred, true);
  // The pool itself is untouched — banking is a decision about the screen, not about the points.
  assert.strictEqual(banked.levelUpPool, 4);

  const earned = grantUpgradeReward(banked, 2);
  assert.strictEqual(earned.levelUpDeferred, false);
  assert.strictEqual(earned.levelUpPool, 6);
});

test('runProgress: grantRelicReward appends a relic id, duplicates allowed', () => {
  const run = seedRoster(['cinderKnight']);
  const next = grantRelicReward(grantRelicReward(run, 'ironStandard'), 'ironStandard');
  assert.deepStrictEqual(next.relics, ['ironStandard', 'ironStandard']);
});

test('runProgress: equipToRoster equips onto an empty slot with no bump', () => {
  const run = seedRoster(['cinderKnight']);
  const { run: next, bumpedItemId } = equipToRoster(run, 'cinderKnight', 'ironBlade', equipment);
  assert.strictEqual(next.roster[0].equipment.weapon, 'ironBlade');
  assert.strictEqual(bumpedItemId, null);
});

test('runProgress: equipToRoster returns the previously equipped item as bumpedItemId', () => {
  const run = {
    ...seedRoster(['cinderKnight']),
    roster: [{ ...seedRoster(['cinderKnight']).roster[0], equipment: { weapon: 'ironBlade', armor: null, accessory: null } }],
  };
  const { run: next, bumpedItemId } = equipToRoster(run, 'cinderKnight', 'dagger', equipment);
  assert.strictEqual(next.roster[0].equipment.weapon, 'dagger');
  assert.strictEqual(bumpedItemId, 'ironBlade');
});

test('runProgress: equipToRoster rejects an unknown rosterId and an unknown item', () => {
  const run = seedRoster(['cinderKnight']);
  assert.throws(() => equipToRoster(run, 'nonexistent', 'ironBlade', equipment), RunProgressError);
  assert.throws(() => equipToRoster(run, 'cinderKnight', 'notAnItem', equipment), RunProgressError);
});

test("runProgress: swapEquipment moves an item onto another hero's empty slot", () => {
  const run = {
    ...seedRoster(['cinderKnight', 'tidecaller']),
    roster: [
      { ...seedRoster(['cinderKnight']).roster[0], equipment: { weapon: 'ironBlade', armor: null, accessory: null } },
      seedRoster(['tidecaller']).roster[0],
    ],
  };
  const next = swapEquipment(run, 'cinderKnight', 'tidecaller', 'weapon');
  assert.strictEqual(next.roster[0].equipment.weapon, null);
  assert.strictEqual(next.roster[1].equipment.weapon, 'ironBlade');
});

test("runProgress: swapEquipment swaps two heroes' items when the destination slot is filled", () => {
  const run = {
    ...seedRoster(['cinderKnight', 'tidecaller']),
    roster: [
      { ...seedRoster(['cinderKnight']).roster[0], equipment: { weapon: 'ironBlade', armor: null, accessory: null } },
      { ...seedRoster(['tidecaller']).roster[0], equipment: { weapon: 'dagger', armor: null, accessory: null } },
    ],
  };
  const next = swapEquipment(run, 'cinderKnight', 'tidecaller', 'weapon');
  assert.strictEqual(next.roster[0].equipment.weapon, 'dagger');
  assert.strictEqual(next.roster[1].equipment.weapon, 'ironBlade');
});

test('runProgress: swapEquipment rejects an unknown roster id and an empty source slot', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller']);
  assert.throws(() => swapEquipment(run, 'cinderKnight', 'nonexistent', 'weapon'), RunProgressError);
  assert.throws(() => swapEquipment(run, 'cinderKnight', 'tidecaller', 'weapon'), RunProgressError);
});

test('runProgress: trashEquipment clears the slot for good', () => {
  const run = {
    ...seedRoster(['cinderKnight']),
    roster: [{ ...seedRoster(['cinderKnight']).roster[0], equipment: { weapon: 'ironBlade', armor: null, accessory: null } }],
  };
  const next = trashEquipment(run, 'cinderKnight', 'weapon');
  assert.strictEqual(next.roster[0].equipment.weapon, null);
});

test('runProgress: trashEquipment rejects an empty slot', () => {
  const run = seedRoster(['cinderKnight']);
  assert.throws(() => trashEquipment(run, 'cinderKnight', 'weapon'), RunProgressError);
});
