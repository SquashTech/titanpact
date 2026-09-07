import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { createRunState, createRosterEntry, addRosterEntry, type RunState } from '../src/run/state';
import { generateMap } from '../src/run/map';
import { MAX_ITEM_SLOTS, STASH_CAPACITY } from '../src/run/equipment';
import { itemSlotsFor } from '../src/run/progression';
import { sellValueFor } from '../src/run/shop';
import {
  reachableNodeIds,
  advanceToNode,
  grantCurrencyReward,
  grantUpgradeReward,
  deferLevelUp,
  grantRelicReward,
  equipFromStash,
  equipToRoster,
  grantItemSlot,
  moveEquipment,
  sellFromStash,
  stashItem,
  trashEquipment,
  unequipToStash,
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

test('runProgress: equipToRoster fills a free slot, and nothing reaches the bag', () => {
  const run = seedRoster(['cinderKnight']);
  const next = equipToRoster(run, 'cinderKnight', 'ironBlade', equipment, heroes);
  assert.deepStrictEqual(next.roster[0].equipment, ['ironBlade']);
  assert.deepStrictEqual(next.stash, []);
});

test('runProgress: equipToRoster on a full hero needs a replaceIndex, and what it displaces lands in the bag', () => {
  const run = gearedRun('cinderKnight', ['ironBlade']);
  // cinderKnight authors no `itemSlots`, so BASE_ITEM_SLOTS applies and one item fills it.
  assert.throws(() => equipToRoster(run, 'cinderKnight', 'dagger', equipment, heroes), RunProgressError);

  const next = equipToRoster(run, 'cinderKnight', 'dagger', equipment, heroes, 0);
  assert.deepStrictEqual(next.roster[0].equipment, ['dagger']);
  assert.deepStrictEqual(next.stash, ['ironBlade']);
});

test('runProgress: a full bag refuses the swap, but not an equip into a free slot', () => {
  const full = Array.from({ length: STASH_CAPACITY }, () => 'dagger');
  const swap = { ...gearedRun('cinderKnight', ['ironBlade']), stash: full };
  assert.throws(() => equipToRoster(swap, 'cinderKnight', 'torch', equipment, heroes, 0), RunProgressError);

  // Nothing is displaced here, so the bag's state is none of this equip's business.
  const free = { ...seedRoster(['cinderKnight']), stash: full };
  assert.deepStrictEqual(equipToRoster(free, 'cinderKnight', 'ironBlade', equipment, heroes).roster[0].equipment, ['ironBlade']);
});

test('runProgress: a Forge grant opens a slot, and the next item lands in it without displacing anything', () => {
  let run = gearedRun('cinderKnight', ['ironBlade']);
  run = grantItemSlot(run, 'cinderKnight', heroes);
  assert.strictEqual(run.roster[0].bonusItemSlots, 1);

  const next = equipToRoster(run, 'cinderKnight', 'dagger', equipment, heroes);
  assert.deepStrictEqual(next.roster[0].equipment, ['ironBlade', 'dagger']);
  assert.deepStrictEqual(next.stash, []);
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

// --- The stash ---

test('runProgress: stashItem carries an item, and a full bag refuses the next one', () => {
  const run = seedRoster(['cinderKnight']);
  const one = stashItem(run, 'ironBlade', equipment);
  assert.deepStrictEqual(one.stash, ['ironBlade']);
  // Two copies of one item is legal in the bag — one copy per HERO is the rule.
  assert.deepStrictEqual(stashItem(one, 'ironBlade', equipment).stash, ['ironBlade', 'ironBlade']);
  assert.throws(() => stashItem(one, 'notAnItem', equipment), RunProgressError);

  const full = { ...run, stash: Array.from({ length: STASH_CAPACITY }, () => 'dagger') };
  assert.throws(() => stashItem(full, 'ironBlade', equipment), RunProgressError);
});

test('runProgress: unequipToStash takes gear off, and a full bag is the one thing that refuses it', () => {
  const run = gearedRun('cinderKnight', ['ironBlade']);
  const next = unequipToStash(run, 'cinderKnight', 0);
  assert.deepStrictEqual(next.roster[0].equipment, []);
  assert.deepStrictEqual(next.stash, ['ironBlade']);

  assert.throws(() => unequipToStash(run, 'cinderKnight', 1), RunProgressError);
  const full = { ...run, stash: Array.from({ length: STASH_CAPACITY }, () => 'dagger') };
  assert.throws(() => unequipToStash(full, 'cinderKnight', 0), RunProgressError);
});

test('runProgress: equipFromStash seats a carried item, and a swap trades net-zero against the bag', () => {
  const free = { ...seedRoster(['cinderKnight']), stash: ['ironBlade'] };
  const seated = equipFromStash(free, 0, 'cinderKnight', equipment, heroes);
  assert.deepStrictEqual(seated.roster[0].equipment, ['ironBlade']);
  assert.deepStrictEqual(seated.stash, []);

  // A swap cannot overflow the bag however full it is: one item out, one back in.
  const brimming = { ...gearedRun('cinderKnight', ['ironBlade']), stash: [...Array.from({ length: STASH_CAPACITY - 1 }, () => 'dagger'), 'torch'] };
  const swapped = equipFromStash(brimming, STASH_CAPACITY - 1, 'cinderKnight', equipment, heroes, 0);
  assert.deepStrictEqual(swapped.roster[0].equipment, ['torch']);
  assert.strictEqual(swapped.stash.length, STASH_CAPACITY);
  assert.ok(swapped.stash.includes('ironBlade'));

  assert.throws(() => equipFromStash(free, 3, 'cinderKnight', equipment, heroes), RunProgressError);
});

test('runProgress: sellFromStash pays out and drops the item', () => {
  const run = { ...seedRoster(['cinderKnight']), stash: ['ironBlade', 'dagger'] };
  const next = sellFromStash(run, 0, equipment);
  assert.deepStrictEqual(next.stash, ['dagger']);
  assert.strictEqual(next.gold, sellValueFor(equipment.ironBlade));

  assert.throws(() => sellFromStash(run, 7, equipment), RunProgressError);
});
