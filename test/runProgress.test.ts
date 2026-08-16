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
  grantRelicReward,
  grantInventoryReward,
  equipFromInventory,
  unequipToInventory,
  RunProgressError,
} from '../src/run/runProgress';

function seedRoster(heroIds: string[]) {
  let run = createRunState(0, 0);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- Reachability / advancing -------------------------------------------

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

// --- Reward grants ----------------------------------------------------------

test('runProgress: grantCurrencyReward and grantUpgradeReward add flat amounts', () => {
  const run = seedRoster(['cinderKnight']);
  assert.strictEqual(grantCurrencyReward(run, 20).gold, 20);
  assert.strictEqual(grantUpgradeReward(run, 2).levelUpPool, 2);
});

test('runProgress: grantRelicReward appends a relic id, duplicates allowed', () => {
  const run = seedRoster(['cinderKnight']);
  const next = grantRelicReward(grantRelicReward(run, 'ironStandard'), 'ironStandard');
  assert.deepStrictEqual(next.relics, ['ironStandard', 'ironStandard']);
});

test('runProgress: grantInventoryReward adds an item id to the inventory', () => {
  const run = seedRoster(['cinderKnight']);
  const next = grantInventoryReward(run, 'ironBlade');
  assert.deepStrictEqual(next.inventory, ['ironBlade']);
});

test('runProgress: equipFromInventory moves the item from inventory onto the named roster hero', () => {
  const run = { ...seedRoster(['cinderKnight']), inventory: ['ironBlade'] };
  const next = equipFromInventory(run, 'cinderKnight', 'ironBlade', equipment);
  assert.strictEqual(next.roster[0].equipment.weapon, 'ironBlade');
  assert.deepStrictEqual(next.inventory, []);
});

test('runProgress: equipFromInventory returns the previously equipped item to the inventory', () => {
  const run = {
    ...seedRoster(['cinderKnight']),
    roster: [{ ...seedRoster(['cinderKnight']).roster[0], equipment: { weapon: 'ironBlade', armor: null, accessory: null } }],
    inventory: ['arcaneFocus'],
  };
  const next = equipFromInventory(run, 'cinderKnight', 'arcaneFocus', equipment);
  assert.strictEqual(next.roster[0].equipment.weapon, 'arcaneFocus');
  assert.deepStrictEqual(next.inventory, ['ironBlade']);
});

test('runProgress: equipFromInventory rejects an unknown rosterId and an item not in inventory', () => {
  const run = { ...seedRoster(['cinderKnight']), inventory: ['ironBlade'] };
  assert.throws(() => equipFromInventory(run, 'nonexistent', 'ironBlade', equipment), RunProgressError);
  assert.throws(() => equipFromInventory(run, 'cinderKnight', 'oakenArmor', equipment), RunProgressError);
});

test('runProgress: unequipToInventory clears the slot and returns the item to inventory', () => {
  const run = {
    ...seedRoster(['cinderKnight']),
    roster: [{ ...seedRoster(['cinderKnight']).roster[0], equipment: { weapon: 'ironBlade', armor: null, accessory: null } }],
  };
  const next = unequipToInventory(run, 'cinderKnight', 'weapon');
  assert.strictEqual(next.roster[0].equipment.weapon, null);
  assert.deepStrictEqual(next.inventory, ['ironBlade']);
});

test('runProgress: unequipToInventory rejects an empty slot', () => {
  const run = seedRoster(['cinderKnight']);
  assert.throws(() => unequipToInventory(run, 'cinderKnight', 'weapon'), RunProgressError);
});
