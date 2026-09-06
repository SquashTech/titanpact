import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { createRunState, createRosterEntry, addRosterEntry, type RunState } from '../src/run/state';
import { generateMap } from '../src/run/map';
import { MAX_ITEM_SLOTS } from '../src/run/equipment';
import { itemSlotsFor } from '../src/run/progression';
import {
  reachableNodeIds,
  advanceToNode,
  grantCurrencyReward,
  grantUpgradeReward,
  deferLevelUp,
  grantRelicReward,
  equipToRoster,
  grantItemSlot,
  moveEquipment,
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

/** Roster of one or two heroes, each already holding the listed item ids. rosterId === heroId. */
function gearedRun(heroA: string, itemsA: string[], heroB?: string, itemsB: string[] = []): RunState {
  const run = seedRoster(heroB ? [heroA, heroB] : [heroA]);
  const held: Record<string, string[]> = { [heroA]: itemsA, ...(heroB ? { [heroB]: itemsB } : {}) };
  return { ...run, roster: run.roster.map((r) => ({ ...r, equipment: held[r.rosterId] ?? [] })) };
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

test('runProgress: equipToRoster fills a free slot with no bump', () => {
  const run = seedRoster(['cinderKnight']);
  const { run: next, bumpedItemId } = equipToRoster(run, 'cinderKnight', 'ironBlade', equipment, heroes);
  assert.deepStrictEqual(next.roster[0].equipment, ['ironBlade']);
  assert.strictEqual(bumpedItemId, null);
});

test('runProgress: equipToRoster on a full hero needs a replaceIndex, and returns what it displaced', () => {
  const run = gearedRun('cinderKnight', ['ironBlade']);
  // cinderKnight authors no `itemSlots`, so BASE_ITEM_SLOTS applies and one item fills it.
  assert.throws(() => equipToRoster(run, 'cinderKnight', 'dagger', equipment, heroes), RunProgressError);

  const { run: next, bumpedItemId } = equipToRoster(run, 'cinderKnight', 'dagger', equipment, heroes, 0);
  assert.deepStrictEqual(next.roster[0].equipment, ['dagger']);
  assert.strictEqual(bumpedItemId, 'ironBlade');
});

test('runProgress: a Forge grant opens a slot, and the next item lands in it without displacing anything', () => {
  let run = gearedRun('cinderKnight', ['ironBlade']);
  run = grantItemSlot(run, 'cinderKnight', heroes);
  assert.strictEqual(run.roster[0].bonusItemSlots, 1);

  const { run: next, bumpedItemId } = equipToRoster(run, 'cinderKnight', 'dagger', equipment, heroes);
  assert.deepStrictEqual(next.roster[0].equipment, ['ironBlade', 'dagger']);
  assert.strictEqual(bumpedItemId, null);
});

test('runProgress: grantItemSlot refuses a hero already at the cap', () => {
  let run = seedRoster(['cinderKnight']);
  for (let i = itemSlotsFor(heroes.cinderKnight, run.roster[0]); i < MAX_ITEM_SLOTS; i++) {
    run = grantItemSlot(run, 'cinderKnight', heroes);
  }
  assert.strictEqual(itemSlotsFor(heroes.cinderKnight, run.roster[0]), MAX_ITEM_SLOTS);
  assert.throws(() => grantItemSlot(run, 'cinderKnight', heroes), RunProgressError);
});

test('runProgress: equipToRoster rejects an unknown rosterId, an unknown item, and a duplicate', () => {
  const run = gearedRun('cinderKnight', ['ironBlade']);
  assert.throws(() => equipToRoster(run, 'nonexistent', 'ironBlade', equipment, heroes), RunProgressError);
  assert.throws(() => equipToRoster(run, 'cinderKnight', 'notAnItem', equipment, heroes), RunProgressError);
  // A hero never holds two copies, even over a slot it would otherwise be free to fill.
  assert.throws(() => equipToRoster(run, 'cinderKnight', 'ironBlade', equipment, heroes, 0), RunProgressError);
});

test("runProgress: moveEquipment hands an item to a hero with a free slot, displacing nothing", () => {
  let run = gearedRun('cinderKnight', ['ironBlade'], 'tidecaller');
  run = grantItemSlot(run, 'tidecaller', heroes);

  const { run: next, displacedItemId } = moveEquipment(run, 'cinderKnight', 0, 'tidecaller', heroes);
  assert.deepStrictEqual(next.roster[0].equipment, []);
  assert.deepStrictEqual(next.roster[1].equipment, ['ironBlade']);
  assert.strictEqual(displacedItemId, null);
});

test('runProgress: moveEquipment trades when the destination is full — the two items change places', () => {
  const run = gearedRun('cinderKnight', ['ironBlade'], 'tidecaller', ['dagger']);
  const { run: next, displacedItemId } = moveEquipment(run, 'cinderKnight', 0, 'tidecaller', heroes, 0);
  assert.deepStrictEqual(next.roster[0].equipment, ['dagger']);
  assert.deepStrictEqual(next.roster[1].equipment, ['ironBlade']);
  assert.strictEqual(displacedItemId, 'dagger');
});

test('runProgress: moveEquipment rejects an unknown roster id, an empty source slot, and a duplicate destination', () => {
  const empty = seedRoster(['cinderKnight', 'tidecaller']);
  assert.throws(() => moveEquipment(empty, 'cinderKnight', 0, 'nonexistent', heroes), RunProgressError);
  assert.throws(() => moveEquipment(empty, 'cinderKnight', 0, 'tidecaller', heroes), RunProgressError);

  const both = gearedRun('cinderKnight', ['ironBlade'], 'tidecaller', ['ironBlade']);
  assert.throws(() => moveEquipment(both, 'cinderKnight', 0, 'tidecaller', heroes, 0), RunProgressError);
});

test('runProgress: trashEquipment clears the slot for good', () => {
  const run = gearedRun('cinderKnight', ['ironBlade']);
  const next = trashEquipment(run, 'cinderKnight', 0);
  assert.deepStrictEqual(next.roster[0].equipment, []);
});

test('runProgress: trashEquipment rejects an empty slot', () => {
  const run = seedRoster(['cinderKnight']);
  assert.throws(() => trashEquipment(run, 'cinderKnight', 0), RunProgressError);
});
