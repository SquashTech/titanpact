import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { createRunState, createRosterEntry, addRosterEntry, type RunState } from '../src/run/state';
import { generateMap } from '../src/run/map';
import { BASE_ITEM_SLOTS, MAX_ITEM_SLOTS, mergeIntoHeld } from '../src/run/equipment';
import { itemSlotsFor } from '../src/run/progression';
import { ANVIL_PRICE_BY_TARGET, ENCHANT_PRICE_BY_RARITY, sellValueFor } from '../src/run/shop';
import {
  absorbItem,
  anvilQuote,
  anvilUpgrade,
  anyoneCanReceive,
  enchantItem,
  itemReceiptFor,
  reachableNodeIds,
  advanceToNode,
  grantCurrencyReward,
  grantRelicReward,
  grantManaWell,
  MANA_WELL_AMOUNT,
  forgeLift,
  grantLeyLine,
  LEY_LINE_FORCE,
  leyLineStatusId,
  sellItem,
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

// --- Absorption (docs/gear-absorption.md) ---

test('runProgress: every hero has three sockets, and nothing grants a fourth', () => {
  const run = seedRoster(['cinderKnight']);
  assert.strictEqual(BASE_ITEM_SLOTS, 3);
  assert.strictEqual(MAX_ITEM_SLOTS, BASE_ITEM_SLOTS);
  assert.strictEqual(itemSlotsFor(heroes.cinderKnight, run.roster[0]), 3);
});

test('runProgress: absorbItem seats an item in a free socket, and it is on the hero for good', () => {
  const run = seedRoster(['cinderKnight']);
  assert.deepStrictEqual(itemReceiptFor(run.roster[0], equipment['sword.common'], heroes.cinderKnight, equipment), { kind: 'take' });
  const next = absorbItem(run, 'cinderKnight', 'sword.common', equipment, heroes);
  assert.deepStrictEqual(next.roster[0].equipment, ['sword.common']);
  assert.strictEqual(next.gold, 0, 'nothing is sold on a take');
});

test('runProgress: a hero with three full sockets and no family match cannot receive', () => {
  const run = gearedRun('cinderKnight', ['sword.common', 'staff.common', 'bow.common']);
  assert.deepStrictEqual(itemReceiptFor(run.roster[0], equipment['spear.rare'], heroes.cinderKnight, equipment), { kind: 'none', reason: 'full' });
  assert.throws(() => absorbItem(run, 'cinderKnight', 'spear.rare', equipment, heroes), RunProgressError);
  assert.strictEqual(anyoneCanReceive(run, equipment['spear.rare'], equipment, heroes), false);
});

test('runProgress: a same-family drop MERGES into the holder — one tier above the higher of the two, sockets untouched', () => {
  // Held Common + dropped Epic and held Epic + dropped Common both land on Legendary: never a
  // downgrade, and the drop's tier is what it adds, never what it replaces.
  const low = gearedRun('cinderKnight', ['spear.common', 'sword.common']);
  const receipt = itemReceiptFor(low.roster[0], equipment['spear.epic'], heroes.cinderKnight, equipment);
  assert.deepStrictEqual(receipt, { kind: 'merge', heldItemId: 'spear.common', resultId: 'spear.legendary', resultRarity: 'legendary' });
  const merged = absorbItem(low, 'cinderKnight', 'spear.epic', equipment, heroes);
  assert.deepStrictEqual(merged.roster[0].equipment, ['spear.legendary', 'sword.common'], 'in place — the socket order holds');

  const high = gearedRun('cinderKnight', ['spear.epic']);
  assert.deepStrictEqual(absorbItem(high, 'cinderKnight', 'spear.common', equipment, heroes).roster[0].equipment, ['spear.legendary']);
});

test('runProgress: a merge keeps the held enchant, or takes the drop\'s when the held piece has none', () => {
  assert.strictEqual(mergeIntoHeld(equipment['spear.rare.blazing'], equipment['spear.rare.tidal']), 'spear.epic.blazing', 'the held piece wins');
  assert.strictEqual(mergeIntoHeld(equipment['spear.rare'], equipment['spear.rare.tidal']), 'spear.epic.tidal', 'a plain holder takes the drop\'s');
  assert.strictEqual(mergeIntoHeld(equipment['spear.rare'], equipment['spear.rare']), 'spear.epic');
});

test('runProgress: a merge is not capped by the act window, and a full hero can still merge', () => {
  // Three full sockets are no bar — the merge lands IN a socket. And Act 1's window (Epic) does
  // not stop a merge reaching Legendary: the window prices gold and drops, not a lucky pair.
  const run = { ...gearedRun('cinderKnight', ['spear.epic', 'sword.common', 'bow.common']), actNumber: 1 };
  const receipt = itemReceiptFor(run.roster[0], equipment['spear.rare'], heroes.cinderKnight, equipment);
  assert.strictEqual(receipt.kind, 'merge');
  assert.deepStrictEqual(absorbItem(run, 'cinderKnight', 'spear.rare', equipment, heroes).roster[0].equipment, ['spear.legendary', 'sword.common', 'bow.common']);
});

test('runProgress: a Mythic holder and a Unique cannot merge, and read as at their ceiling', () => {
  const mythic = gearedRun('cinderKnight', ['spear.mythic']);
  assert.deepStrictEqual(itemReceiptFor(mythic.roster[0], equipment['spear.common'], heroes.cinderKnight, equipment), { kind: 'none', reason: 'ceiling' });
  assert.strictEqual(mergeIntoHeld(equipment['worldbreaker'], equipment['worldbreaker']), null, 'a Unique has no ladder');
  assert.strictEqual(mergeIntoHeld(equipment['spear.rare'], equipment['sword.rare']), null, 'different families');
});

test('runProgress: a merge is offered on the family whatever the enchant — the one-per-family rule, read as a merge', () => {
  const run = gearedRun('cinderKnight', ['sword.common.blazing']);
  const receipt = itemReceiptFor(run.roster[0], equipment['sword.common'], heroes.cinderKnight, equipment);
  assert.strictEqual(receipt.kind, 'merge');
});

test('runProgress: sellItem converts an item to gold at sellValueFor, and touches no socket', () => {
  const run = gearedRun('cinderKnight', ['sword.common']);
  const next = sellItem(run, 'spear.rare', equipment);
  assert.strictEqual(next.gold, sellValueFor(equipment['spear.rare']));
  assert.deepStrictEqual(next.roster[0].equipment, ['sword.common']);
  assert.throws(() => sellItem(run, 'nothing', equipment), RunProgressError);
});

test('runProgress: absorbItem rejects an unknown rosterId and an unknown item', () => {
  const run = seedRoster(['cinderKnight']);
  assert.throws(() => absorbItem(run, 'nobody', 'sword.common', equipment, heroes), RunProgressError);
  assert.throws(() => absorbItem(run, 'cinderKnight', 'nothing', equipment, heroes), RunProgressError);
});

test("runProgress: a Mana Well grant deepens one hero's pool by MANA_WELL_AMOUNT, stacks, and refuses nobody but a stranger", () => {
  // The one bare-number screen the constitution allows (docs/run-loop.md "The Mana Well"): a
  // pool gates a whole tier of moves, so the number IS the capability. No cap, so no refusal.
  assert.strictEqual(MANA_WELL_AMOUNT % 10, 0, 'a stat grant is a multiple of 5 or 10');
  let run = seedRoster(['cinderKnight', 'crimson']);
  run = grantManaWell(run, 'cinderKnight');
  assert.strictEqual(run.roster[0].bonusStatGrants.manaPool, MANA_WELL_AMOUNT);
  assert.strictEqual(run.roster[1].bonusStatGrants.manaPool, undefined, 'one hero, not the team');
  run = grantManaWell(run, 'cinderKnight');
  assert.strictEqual(run.roster[0].bonusStatGrants.manaPool, MANA_WELL_AMOUNT * 2, 'a second well stacks');
  assert.throws(() => grantManaWell(run, 'nobody'), RunProgressError);
});

test("runProgress: a Ley Line grants one hero LEY_LINE_FORCE of its innate primary's Force, stacks, and refuses only a stranger", () => {
  // The Enchanter's binding, free and on the hero (docs/run-loop.md "The Forge and the Ley Line"):
  // a Rare enchant's figure, so a hero-bound Force is never worth more than a piece's.
  assert.strictEqual(LEY_LINE_FORCE, 10);
  let run = seedRoster(['cinderKnight', 'crimson']);
  const statusId = leyLineStatusId(heroes.cinderKnight);
  assert.strictEqual(statusId, `${heroes.cinderKnight.types[0]}Force`, "the hero's innate primary, never a graft");
  run = grantLeyLine(run, 'cinderKnight', heroes);
  assert.strictEqual(run.roster[0].bonusStatusGrants[statusId], LEY_LINE_FORCE);
  assert.deepStrictEqual(run.roster[1].bonusStatusGrants, {}, 'one hero, not the team');
  run = grantLeyLine(run, 'cinderKnight', heroes);
  assert.strictEqual(run.roster[0].bonusStatusGrants[statusId], LEY_LINE_FORCE * 2, 'a second line stacks');
  assert.throws(() => grantLeyLine(run, 'nobody', heroes), RunProgressError);
});

// --- The Anvil and the Enchanter (docs/equipment.md §5) ---

/** A run in `actNumber` with `gold`, its one hero wearing `worn`. Act matters: the window caps the Anvil. */
function shopRun(gold: number, worn: string[], actNumber = 3): RunState {
  return { ...gearedRun('cinderKnight', worn), gold, actNumber };
}

const SOCKET_0 = { rosterId: 'cinderKnight', index: 0 };

test('runProgress: the Anvil lifts a worn item a tier for gold, in place, keeping its family and its enchant', () => {
  const run = shopRun(200, ['spear.rare.blazing']);
  const quote = anvilQuote(run, 'spear.rare.blazing', equipment)!;
  assert.strictEqual(quote.targetId, 'spear.epic.blazing');
  assert.strictEqual(quote.cost, ANVIL_PRICE_BY_TARGET.epic);

  const next = anvilUpgrade(run, SOCKET_0, equipment);
  assert.deepStrictEqual(next.roster[0].equipment, ['spear.epic.blazing']);
  assert.strictEqual(next.gold, 200 - ANVIL_PRICE_BY_TARGET.epic);
});

test('runProgress: the Anvil is refused without the gold, above Mythic, on a Unique, and on an empty socket', () => {
  assert.throws(() => anvilUpgrade(shopRun(1, ['spear.rare']), SOCKET_0, equipment), RunProgressError);
  assert.strictEqual(anvilQuote(shopRun(999, []), 'spear.mythic', equipment), null, 'nothing above Mythic');
  assert.strictEqual(anvilQuote(shopRun(999, []), 'worldbreaker', equipment), null, 'a Unique has no ladder');
  assert.throws(() => anvilUpgrade(shopRun(999, []), SOCKET_0, equipment), RunProgressError);
});

test('runProgress: the Forge is the Anvil for free — the same lift, the same refusals, no gold moved', () => {
  const run = shopRun(0, ['spear.rare.blazing']);
  const next = forgeLift(run, SOCKET_0, equipment);
  assert.deepStrictEqual(next.roster[0].equipment, ['spear.epic.blazing'], 'a tier up, family and enchant kept');
  assert.strictEqual(next.gold, 0, 'nothing spent');
  assert.throws(() => forgeLift(shopRun(0, ['spear.mythic']), SOCKET_0, equipment), RunProgressError, 'nothing above Mythic');
  assert.throws(() => forgeLift(shopRun(0, ['worldbreaker']), SOCKET_0, equipment), RunProgressError, 'a Unique has no ladder');
  assert.throws(() => forgeLift(shopRun(0, ['spear.epic'], 1), SOCKET_0, equipment), RunProgressError, 'the act window caps the Forge as it caps the Anvil');
  assert.throws(() => forgeLift(shopRun(0, []), SOCKET_0, equipment), RunProgressError, 'an empty socket');
});

test("runProgress: the act window caps the Anvil, not just drops", () => {
  // With a purchasable Anvil a rich Act-1 player would otherwise simply buy past the window.
  const act1 = shopRun(999, ['spear.epic'], 1);
  assert.strictEqual(anvilQuote(act1, 'spear.epic', equipment), null, 'Act 1 reaches Epic and no further');
  assert.throws(() => anvilUpgrade(act1, SOCKET_0, equipment), RunProgressError);
  // Act 3 opens Mythic, so the same item is liftable there.
  assert.ok(anvilQuote(shopRun(999, ['spear.epic'], 3), 'spear.epic', equipment));
});

test('runProgress: the Enchanter binds an element, and overwrites rather than stacking', () => {
  const run = shopRun(300, ['spear.epic']);
  const enchanted = enchantItem(run, SOCKET_0, 'blazing', equipment);
  assert.deepStrictEqual(enchanted.roster[0].equipment, ['spear.epic.blazing']);
  assert.strictEqual(enchanted.gold, 300 - ENCHANT_PRICE_BY_RARITY.epic);

  // One enchant per item, always: re-enchanting replaces the one it carries.
  const rebound = enchantItem(enchanted, SOCKET_0, 'tidal', equipment);
  assert.deepStrictEqual(rebound.roster[0].equipment, ['spear.epic.tidal']);
  assert.throws(() => enchantItem(rebound, SOCKET_0, 'tidal', equipment), RunProgressError);
});

test('runProgress: a Unique is enchantable even though it cannot be upgraded', () => {
  const run = shopRun(300, ['worldbreaker']);
  assert.deepStrictEqual(enchantItem(run, SOCKET_0, 'feral', equipment).roster[0].equipment, ['worldbreaker.feral']);
});
