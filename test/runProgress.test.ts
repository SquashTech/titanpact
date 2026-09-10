import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { createRunState, createRosterEntry, addRosterEntry, type RunState } from '../src/run/state';
import { generateMap } from '../src/run/map';
import { MAX_ITEM_SLOTS, unseenCount } from '../src/run/equipment';
import { itemSlotsFor } from '../src/run/progression';
import { ANVIL_PRICE_BY_TARGET, ENCHANT_PRICE_BY_RARITY, sellValueFor } from '../src/run/shop';
import {
  anvilQuote,
  anvilUpgrade,
  enchantItem,
  markStashItemSeen,
  mergeFromStash,
  reachableNodeIds,
  advanceToNode,
  grantCurrencyReward,
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
  let run = createRunState(0);
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

test('runProgress: grantCurrencyReward adds a flat amount', () => {
  assert.strictEqual(grantCurrencyReward(seedRoster(['cinderKnight']), 20).gold, 20);
});

test('runProgress: grantRelicReward appends a relic id, duplicates allowed', () => {
  const run = seedRoster(['cinderKnight']);
  const next = grantRelicReward(grantRelicReward(run, 'ironStandard'), 'ironStandard');
  assert.deepStrictEqual(next.relics, ['ironStandard', 'ironStandard']);
});

test('runProgress: equipToRoster fills a free slot, and nothing reaches the bag', () => {
  const run = seedRoster(['cinderKnight']);
  const next = equipToRoster(run, 'cinderKnight', 'sword.common', equipment, heroes);
  assert.deepStrictEqual(next.roster[0].equipment, ['sword.common']);
  assert.deepStrictEqual(next.stash, []);
});

test('runProgress: equipToRoster on a full hero needs a replaceIndex, and what it displaces lands in the bag', () => {
  const run = gearedRun('cinderKnight', ['sword.common']);
  // cinderKnight authors no `itemSlots`, so BASE_ITEM_SLOTS applies and one item fills it.
  assert.throws(() => equipToRoster(run, 'cinderKnight', 'dagger.common', equipment, heroes), RunProgressError);

  const next = equipToRoster(run, 'cinderKnight', 'dagger.common', equipment, heroes, 0);
  assert.deepStrictEqual(next.roster[0].equipment, ['dagger.common']);
  assert.deepStrictEqual(next.stash, ['sword.common']);
});

test('runProgress: the bag is uncapped, so nothing that reaches it can be refused', () => {
  // The figure is arbitrary on purpose — there is no cap left for it to be measured against.
  const loaded = Array.from({ length: 40 }, () => 'dagger.common');

  const swap = { ...gearedRun('cinderKnight', ['sword.common']), stash: loaded };
  const swapped = equipToRoster(swap, 'cinderKnight', 'sword.common.blazing', equipment, heroes, 0);
  assert.deepStrictEqual(swapped.roster[0].equipment, ['sword.common.blazing']);
  assert.strictEqual(swapped.stash.length, loaded.length + 1);

  const held = { ...gearedRun('cinderKnight', ['sword.common']), stash: loaded };
  assert.strictEqual(unequipToStash(held, 'cinderKnight', 0).stash.length, loaded.length + 1);
  assert.strictEqual(stashItem(held, 'spear.rare', equipment).stash.length, loaded.length + 1);
});

test('runProgress: a Forge grant opens a slot, and the next item lands in it without displacing anything', () => {
  let run = gearedRun('cinderKnight', ['sword.common']);
  run = grantItemSlot(run, 'cinderKnight', heroes);
  assert.strictEqual(run.roster[0].bonusItemSlots, 1);

  const next = equipToRoster(run, 'cinderKnight', 'dagger.common', equipment, heroes);
  assert.deepStrictEqual(next.roster[0].equipment, ['sword.common', 'dagger.common']);
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

test('runProgress: equipToRoster rejects an unknown rosterId and an unknown item', () => {
  const run = gearedRun('cinderKnight', ['sword.common']);
  assert.throws(() => equipToRoster(run, 'nonexistent', 'sword.common', equipment, heroes), RunProgressError);
  assert.throws(() => equipToRoster(run, 'cinderKnight', 'notAnItem', equipment, heroes), RunProgressError);
});

test('runProgress: one item per family — but a swap is never blocked by what it replaces', () => {
  // Two slots, so a same-family item has a free slot to be refused from.
  const base = gearedRun('cinderKnight', ['sword.common']);
  const roomy = { ...base, roster: base.roster.map((r) => ({ ...r, bonusItemSlots: r.bonusItemSlots + 1 })) };

  // Every tier of a family grants the same Awakening, so a second Sword would count-stack it.
  assert.throws(() => equipToRoster(roomy, 'cinderKnight', 'sword.mythic', equipment, heroes), RunProgressError);
  assert.throws(() => equipToRoster(roomy, 'cinderKnight', 'sword.common.blazing', equipment, heroes), RunProgressError);
  // A different family is fine.
  assert.deepStrictEqual(
    equipToRoster(roomy, 'cinderKnight', 'spear.common', equipment, heroes).roster[0].equipment,
    ['sword.common', 'spear.common']
  );

  // ...and replacing the Sword with a better Sword is the Anvil/Enchanter/merge case, always legal.
  const upgraded = equipToRoster(base, 'cinderKnight', 'sword.epic', equipment, heroes, 0);
  assert.deepStrictEqual(upgraded.roster[0].equipment, ['sword.epic']);
  assert.deepStrictEqual(upgraded.stash, ['sword.common']);
});

test("runProgress: moveEquipment hands an item to a hero with a free slot, displacing nothing", () => {
  let run = gearedRun('cinderKnight', ['sword.common'], 'tidecaller');
  run = grantItemSlot(run, 'tidecaller', heroes);

  const { run: next, displacedItemId } = moveEquipment(run, 'cinderKnight', 0, 'tidecaller', heroes);
  assert.deepStrictEqual(next.roster[0].equipment, []);
  assert.deepStrictEqual(next.roster[1].equipment, ['sword.common']);
  assert.strictEqual(displacedItemId, null);
});

test('runProgress: moveEquipment trades when the destination is full — the two items change places', () => {
  const run = gearedRun('cinderKnight', ['sword.common'], 'tidecaller', ['dagger.common']);
  const { run: next, displacedItemId } = moveEquipment(run, 'cinderKnight', 0, 'tidecaller', heroes, 0);
  assert.deepStrictEqual(next.roster[0].equipment, ['dagger.common']);
  assert.deepStrictEqual(next.roster[1].equipment, ['sword.common']);
  assert.strictEqual(displacedItemId, 'dagger.common');
});

test('runProgress: moveEquipment rejects an unknown roster id, an empty source slot, and a duplicate destination', () => {
  const empty = seedRoster(['cinderKnight', 'tidecaller']);
  assert.throws(() => moveEquipment(empty, 'cinderKnight', 0, 'nonexistent', heroes), RunProgressError);
  assert.throws(() => moveEquipment(empty, 'cinderKnight', 0, 'tidecaller', heroes), RunProgressError);

  const both = gearedRun('cinderKnight', ['sword.common'], 'tidecaller', ['sword.common']);
  assert.throws(() => moveEquipment(both, 'cinderKnight', 0, 'tidecaller', heroes, 0), RunProgressError);
});

test('runProgress: trashEquipment clears the slot for good', () => {
  const run = gearedRun('cinderKnight', ['sword.common']);
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
  const one = stashItem(run, 'sword.common', equipment);
  assert.deepStrictEqual(one.stash, ['sword.common']);
  // Two copies of one item is legal in the bag — one copy per HERO is the rule.
  assert.deepStrictEqual(stashItem(one, 'sword.common', equipment).stash, ['sword.common', 'sword.common']);
  // An id naming nothing is the only refusal left — the bag itself never says no.
  assert.throws(() => stashItem(one, 'notAnItem', equipment), RunProgressError);
});

test('runProgress: an arriving item is marked unopened, and tapping it clears the mark', () => {
  const run = seedRoster(['cinderKnight']);
  const one = stashItem(run, 'sword.common', equipment);
  assert.deepStrictEqual(one.unseenItemIds, ['sword.common']);
  assert.strictEqual(unseenCount(one.unseenItemIds, one.stash), 1);

  // Two copies share one mark: what is unopened is the ITEM, not the slot it sits in.
  const two = stashItem(one, 'sword.common', equipment);
  assert.deepStrictEqual(two.unseenItemIds, ['sword.common']);
  assert.strictEqual(unseenCount(two.unseenItemIds, two.stash), 1);

  const seen = markStashItemSeen(two, 'sword.common');
  assert.deepStrictEqual(seen.unseenItemIds, []);
  // Gear the player took off is not "new" — only an arrival marks.
  assert.deepStrictEqual(unequipToStash(gearedRun('cinderKnight', ['sword.common']), 'cinderKnight', 0).unseenItemIds, []);
});

test('runProgress: a mark never outlives the item it points at', () => {
  const run = seedRoster(['cinderKnight']);
  const carried = stashItem(stashItem(run, 'sword.common', equipment), 'dagger.common', equipment);
  assert.strictEqual(unseenCount(carried.unseenItemIds, carried.stash), 2);

  // Every way an item can leave the bag: seated, sold, merged away.
  assert.deepStrictEqual(equipFromStash(carried, 0, 'cinderKnight', equipment, heroes).unseenItemIds, ['dagger.common']);
  assert.deepStrictEqual(sellFromStash(carried, 0, equipment).unseenItemIds, ['dagger.common']);

  const pair = stashItem(stashItem(run, 'sword.common', equipment), 'sword.common', equipment);
  assert.deepStrictEqual(mergeFromStash(pair, 0, 1, equipment).unseenItemIds, []);
});

test('runProgress: unequipToStash takes gear off, and only an empty slot refuses', () => {
  const run = gearedRun('cinderKnight', ['sword.common']);
  const next = unequipToStash(run, 'cinderKnight', 0);
  assert.deepStrictEqual(next.roster[0].equipment, []);
  assert.deepStrictEqual(next.stash, ['sword.common']);

  assert.throws(() => unequipToStash(run, 'cinderKnight', 1), RunProgressError);
});

test('runProgress: equipFromStash seats a carried item, and a swap trades net-zero against the bag', () => {
  const free = { ...seedRoster(['cinderKnight']), stash: ['sword.common'] };
  const seated = equipFromStash(free, 0, 'cinderKnight', equipment, heroes);
  assert.deepStrictEqual(seated.roster[0].equipment, ['sword.common']);
  assert.deepStrictEqual(seated.stash, []);

  // A swap is net-zero against the bag: one item out, one back in.
  const loaded = [...Array.from({ length: 9 }, () => 'dagger.common'), 'sword.common.blazing'];
  const brimming = { ...gearedRun('cinderKnight', ['sword.common']), stash: loaded };
  const swapped = equipFromStash(brimming, loaded.length - 1, 'cinderKnight', equipment, heroes, 0);
  assert.deepStrictEqual(swapped.roster[0].equipment, ['sword.common.blazing']);
  assert.strictEqual(swapped.stash.length, loaded.length);
  assert.ok(swapped.stash.includes('sword.common'));

  assert.throws(() => equipFromStash(free, 3, 'cinderKnight', equipment, heroes), RunProgressError);
});

test('runProgress: sellFromStash pays out and drops the item', () => {
  const run = { ...seedRoster(['cinderKnight']), stash: ['sword.common', 'dagger.common'] };
  const next = sellFromStash(run, 0, equipment);
  assert.deepStrictEqual(next.stash, ['dagger.common']);
  assert.strictEqual(next.gold, sellValueFor(equipment['sword.common']));

  assert.throws(() => sellFromStash(run, 7, equipment), RunProgressError);
});

// --- The Anvil, the Enchanter and merging (docs/equipment.md §5) ---

/** A run in `actNumber` with `gold`, carrying `stash`. Act matters: the window caps every path. */
function shopRun(gold: number, stash: string[], actNumber = 3): RunState {
  return { ...seedRoster(['cinderKnight']), gold, stash, actNumber };
}

test('runProgress: the Anvil lifts an item a tier for gold, keeping its family and its enchant', () => {
  const run = shopRun(200, ['spear.rare.blazing']);
  const quote = anvilQuote(run, 'spear.rare.blazing', equipment)!;
  assert.strictEqual(quote.targetId, 'spear.epic.blazing');
  assert.strictEqual(quote.cost, ANVIL_PRICE_BY_TARGET.epic);

  const next = anvilUpgrade(run, { kind: 'stash', index: 0 }, equipment);
  assert.deepStrictEqual(next.stash, ['spear.epic.blazing']);
  assert.strictEqual(next.gold, 200 - ANVIL_PRICE_BY_TARGET.epic);
});

test('runProgress: the Anvil works on equipped gear too, without taking it off first', () => {
  // Requiring an unequip would reintroduce exactly the friction the rework removes — and the
  // swap is same-family, which equipToRoster's duplicate rule has to permit.
  const base = gearedRun('cinderKnight', ['sword.rare']);
  const run = { ...base, gold: 200, actNumber: 3 };
  const next = anvilUpgrade(run, { kind: 'hero', rosterId: 'cinderKnight', index: 0 }, equipment);
  assert.deepStrictEqual(next.roster[0].equipment, ['sword.epic']);
  assert.deepStrictEqual(next.stash, [], 'an in-place upgrade displaces nothing');
});

test('runProgress: the Anvil is refused without the gold, above Mythic, and on a Unique', () => {
  assert.throws(() => anvilUpgrade(shopRun(1, ['spear.rare']), { kind: 'stash', index: 0 }, equipment), RunProgressError);
  assert.strictEqual(anvilQuote(shopRun(999, []), 'spear.mythic', equipment), null, 'nothing above Mythic');
  assert.strictEqual(anvilQuote(shopRun(999, []), 'worldbreaker', equipment), null, 'a Unique has no ladder');
});

test("runProgress: the act window caps the Anvil, not just drops", () => {
  // With a purchasable Anvil a rich Act-1 player would otherwise simply buy past the window.
  const act1 = shopRun(999, ['spear.epic'], 1);
  assert.strictEqual(anvilQuote(act1, 'spear.epic', equipment), null, 'Act 1 reaches Epic and no further');
  assert.throws(() => anvilUpgrade(act1, { kind: 'stash', index: 0 }, equipment), RunProgressError);
  // Act 3 opens Mythic, so the same item is liftable there.
  assert.ok(anvilQuote(shopRun(999, ['spear.epic'], 3), 'spear.epic', equipment));
});

test('runProgress: the Enchanter binds an element, and overwrites rather than stacking', () => {
  const run = shopRun(300, ['spear.epic']);
  const enchanted = enchantItem(run, { kind: 'stash', index: 0 }, 'blazing', equipment);
  assert.deepStrictEqual(enchanted.stash, ['spear.epic.blazing']);
  assert.strictEqual(enchanted.gold, 300 - ENCHANT_PRICE_BY_RARITY.epic);

  // One enchant per item, always: re-enchanting replaces the one it carries.
  const rebound = enchantItem(enchanted, { kind: 'stash', index: 0 }, 'tidal', equipment);
  assert.deepStrictEqual(rebound.stash, ['spear.epic.tidal']);
  assert.throws(() => enchantItem(rebound, { kind: 'stash', index: 0 }, 'tidal', equipment), RunProgressError);
});

test('runProgress: a Unique is enchantable even though it cannot be upgraded', () => {
  const run = shopRun(300, ['worldbreaker']);
  assert.deepStrictEqual(enchantItem(run, { kind: 'stash', index: 0 }, 'feral', equipment).stash, ['worldbreaker.feral']);
});

test('runProgress: two carried duplicates merge up for free, and the bag shrinks by one', () => {
  const run = shopRun(0, ['spear.rare', 'sword.common', 'spear.rare']);
  const merged = mergeFromStash(run, 0, 2, equipment);
  assert.deepStrictEqual(merged.stash, ['sword.common', 'spear.epic']);
  assert.strictEqual(merged.gold, 0, 'a merge is free — that is what makes it the efficient route');
});

test('runProgress: a merge ignores enchants for eligibility and lets the player keep one', () => {
  const run = shopRun(0, ['spear.rare.blazing', 'spear.rare.tidal']);
  assert.deepStrictEqual(mergeFromStash(run, 0, 1, equipment, 'tidal').stash, ['spear.epic.tidal']);
  assert.deepStrictEqual(mergeFromStash(run, 0, 1, equipment).stash, ['spear.epic'], 'declining both is legal');
  // ...but only from what the two inputs actually carried.
  assert.throws(() => mergeFromStash(run, 0, 1, equipment, 'feral'), RunProgressError);
});

test('runProgress: a merge needs two distinct matching items, and obeys the act window', () => {
  const mixed = shopRun(0, ['spear.rare', 'sword.rare']);
  assert.throws(() => mergeFromStash(mixed, 0, 1, equipment), RunProgressError, 'different families');
  assert.throws(() => mergeFromStash(mixed, 0, 0, equipment), RunProgressError, 'one item is not a pair');

  const act1 = shopRun(0, ['spear.epic', 'spear.epic'], 1);
  assert.throws(() => mergeFromStash(act1, 0, 1, equipment), RunProgressError, 'Act 1 stops at Epic');
  assert.deepStrictEqual(mergeFromStash({ ...act1, actNumber: 2 }, 0, 1, equipment).stash, ['spear.legendary']);
});

test('runProgress: a merge is net -1 on the bag — two inputs leave, one result arrives', () => {
  const loaded = shopRun(0, ['spear.rare', 'spear.rare', ...Array.from({ length: 8 }, () => 'sword.common')]);
  assert.strictEqual(loaded.stash.length, 10);
  assert.strictEqual(mergeFromStash(loaded, 0, 1, equipment).stash.length, 9);
});
