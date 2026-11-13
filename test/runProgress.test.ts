import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { createRunState, createRosterEntry, addRosterEntry, type RunState } from '../src/run/state';
import { generateMap } from '../src/run/map';
import { BASE_ITEM_SLOTS, MAX_ITEM_SLOTS, mergeIntoHeld } from '../src/run/equipment';
import { itemSlotsFor } from '../src/run/progression';
import { CONSUMABLE_HOLD_CAP } from '../src/run/consumables';
import {
  absorbItem,
  anyoneCanReceive,
  liftTarget,
  itemReceiptFor,
  moveItem,
  moveReceiptFor,
  reachableNodeIds,
  advanceToNode,
  grantRelicReward,
  grantManaWell,
  MANA_WELL_AMOUNT,
  MANA_WELL_REGEN,
  forgeItem,
  forgeable,
  grantLeyLine,
  LEY_LINE_FORCE,
  leyLineStatusId,
  leaveItem,
  RunProgressError,
} from '../src/run/runProgress';

function seedRoster(heroIds: string[]) {
  let run = createRunState();
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
});

test('runProgress: moveItem carries a piece to an empty socket, swaps it with another, or merges it into its family', () => {
  const run = gearedRun('cinderKnight', ['sword.common', 'staff.common'], 'valor', ['bow.rare', 'sword.epic', 'plate.common']);
  const at = (rosterId: string, index: number) => ({ rosterId, index });

  assert.deepStrictEqual(moveReceiptFor(run, at('cinderKnight', 1), at('valor', 0), equipment, heroes), { kind: 'swap' });
  const swapped = moveItem(run, at('cinderKnight', 1), at('valor', 0), equipment, heroes);
  assert.deepStrictEqual(swapped.roster[0].equipment, ['sword.common', 'bow.rare']);
  assert.deepStrictEqual(swapped.roster[1].equipment, ['staff.common', 'sword.epic', 'plate.common']);

  assert.deepStrictEqual(moveReceiptFor(run, at('cinderKnight', 0), at('valor', 1), equipment, heroes), { kind: 'merge', resultId: 'sword.legendary', resultRarity: 'legendary' });
  const merged = moveItem(run, at('cinderKnight', 0), at('valor', 1), equipment, heroes);
  assert.deepStrictEqual(merged.roster[0].equipment, ['staff.common']);
  assert.deepStrictEqual(merged.roster[1].equipment, ['bow.rare', 'sword.legendary', 'plate.common']);

  const moved = moveItem(run, at('valor', 2), at('cinderKnight', 2), equipment, heroes);
  assert.deepStrictEqual(moved.roster[0].equipment, ['sword.common', 'staff.common', 'plate.common']);
  assert.deepStrictEqual(moved.roster[1].equipment, ['bow.rare', 'sword.epic']);
});

test('runProgress: moveItem refuses a move that would leave a hero holding two of a family', () => {
  const run = gearedRun('cinderKnight', ['sword.common', 'staff.common'], 'valor', ['staff.rare', 'bow.common']);
  const at = (rosterId: string, index: number) => ({ rosterId, index });
  // Trading Cinder's Sword for Valor's Staff would leave Cinder holding two Staffs.
  assert.deepStrictEqual(moveReceiptFor(run, at('cinderKnight', 0), at('valor', 0), equipment, heroes), { kind: 'none' });
  assert.deepStrictEqual(moveReceiptFor(run, at('cinderKnight', 0), at('valor', 1), equipment, heroes), { kind: 'swap' });
  assert.deepStrictEqual(moveReceiptFor(run, at('cinderKnight', 0), at('cinderKnight', 1), equipment, heroes), { kind: 'none' });
  assert.throws(() => moveItem(run, at('cinderKnight', 0), at('valor', 0), equipment, heroes), RunProgressError);
});

test('runProgress: a hero with three full sockets and no family match overwrites the socket it names, for nothing', () => {
  const run = gearedRun('cinderKnight', ['sword.common', 'staff.common', 'bow.common']);
  assert.deepStrictEqual(itemReceiptFor(run.roster[0], equipment['spear.rare'], heroes.cinderKnight, equipment), { kind: 'replace' });
  assert.strictEqual(anyoneCanReceive(run, equipment['spear.rare'], equipment, heroes), true);
  assert.throws(() => absorbItem(run, 'cinderKnight', 'spear.rare', equipment, heroes), RunProgressError, 'a full hero must name the socket');
  assert.throws(() => absorbItem(run, 'cinderKnight', 'spear.rare', equipment, heroes, 3), RunProgressError);
  const next = absorbItem(run, 'cinderKnight', 'spear.rare', equipment, heroes, 1);
  assert.deepStrictEqual(next.roster[0].equipment, ['sword.common', 'spear.rare', 'bow.common']);
  assert.deepStrictEqual(next.consumables, run.consumables, 'the lost piece pays nothing');
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

test('runProgress: leaving an item pays the flask the purse holds fewer of, HP on a tie, lost at the cap', () => {
  const run = gearedRun('cinderKnight', ['sword.common']);
  const next = leaveItem(run, 'spear.rare', equipment);
  assert.strictEqual(next.consumables.hpPotion, run.consumables.hpPotion + 1, 'HP on a tie');
  assert.deepStrictEqual(next.roster[0].equipment, ['sword.common'], 'no socket touched');
  assert.strictEqual(leaveItem(next, 'spear.rare', equipment).consumables.mpPotion, run.consumables.mpPotion + 1, 'the scarcer flask');
  const full = { ...run, consumables: { hpPotion: CONSUMABLE_HOLD_CAP, mpPotion: CONSUMABLE_HOLD_CAP } };
  assert.deepStrictEqual(leaveItem(full, 'spear.rare', equipment).consumables, full.consumables, 'nothing past the cap');
  assert.throws(() => leaveItem(run, 'nothing', equipment), RunProgressError);
});

test('runProgress: absorbItem rejects an unknown rosterId and an unknown item', () => {
  const run = seedRoster(['cinderKnight']);
  assert.throws(() => absorbItem(run, 'nobody', 'sword.common', equipment, heroes), RunProgressError);
  assert.throws(() => absorbItem(run, 'cinderKnight', 'nothing', equipment, heroes), RunProgressError);
});

test("runProgress: a Mana Well grant deepens one hero's pool by MANA_WELL_AMOUNT and its regen by MANA_WELL_REGEN, stacks, and refuses nobody but a stranger", () => {
  // The one bare-number screen the constitution allows (docs/run-loop.md "The Mana Well"): a
  // pool gates a whole tier of moves, so the number IS the capability. No cap, so no refusal.
  assert.strictEqual(MANA_WELL_AMOUNT % 10, 0, 'a stat grant is a multiple of 5 or 10');
  let run = seedRoster(['cinderKnight', 'crimson']);
  run = grantManaWell(run, 'cinderKnight');
  assert.strictEqual(run.roster[0].bonusStatGrants.manaPool, MANA_WELL_AMOUNT);
  assert.strictEqual(run.roster[0].bonusStatGrants.mpRegen, MANA_WELL_REGEN);
  assert.strictEqual(run.roster[1].bonusStatGrants.manaPool, undefined, 'one hero, not the team');
  run = grantManaWell(run, 'cinderKnight');
  assert.strictEqual(run.roster[0].bonusStatGrants.manaPool, MANA_WELL_AMOUNT * 2, 'a second well stacks');
  assert.strictEqual(run.roster[0].bonusStatGrants.mpRegen, MANA_WELL_REGEN * 2);
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

// --- The Forge (docs/equipment.md §5) ---

/** A run in `actNumber`, its one hero wearing `worn`. Act matters: the window caps the lift. */
function shopRun(worn: string[], actNumber = 3): RunState {
  return { ...gearedRun('cinderKnight', worn), actNumber };
}

const SOCKET_0 = { rosterId: 'cinderKnight', index: 0 };

test('runProgress: a lift keeps the family and the enchant, and there is none above Mythic or on a Unique', () => {
  const lift = liftTarget(shopRun(['spear.rare.blazing']), 'spear.rare.blazing', equipment)!;
  assert.strictEqual(lift.targetId, 'spear.epic.blazing');
  assert.strictEqual(lift.targetRarity, 'epic');
  assert.strictEqual(liftTarget(shopRun([]), 'spear.mythic', equipment), null, 'nothing above Mythic');
  assert.strictEqual(liftTarget(shopRun([]), 'worldbreaker', equipment), null, 'a Unique has no ladder');
});

test('runProgress: the Forge lifts a tier AND binds the picked element, free', () => {
  const run = shopRun(['spear.rare']);
  const next = forgeItem(run, SOCKET_0, 'blazing', equipment);
  assert.deepStrictEqual(next.roster[0].equipment, ['spear.epic.blazing'], 'a tier up and bound, family kept');
  assert.deepStrictEqual(
    forgeItem(shopRun(['spear.rare.blazing']), SOCKET_0, 'tidal', equipment).roster[0].equipment,
    ['spear.epic.tidal'],
    'a rebinding overwrites'
  );
  assert.deepStrictEqual(
    forgeItem(shopRun(['spear.rare.blazing']), SOCKET_0, 'blazing', equipment).roster[0].equipment,
    ['spear.epic.blazing'],
    'the held element again is still a lift'
  );
});

test('runProgress: the Forge binds what it cannot lift, and refuses only work that changes nothing', () => {
  assert.deepStrictEqual(forgeItem(shopRun(['spear.mythic']), SOCKET_0, 'blazing', equipment).roster[0].equipment, ['spear.mythic.blazing'], 'nothing above Mythic — bound only');
  assert.deepStrictEqual(forgeItem(shopRun(['spear.epic'], 1), SOCKET_0, 'blazing', equipment).roster[0].equipment, ['spear.epic.blazing'], 'the act window caps the lift, not the binding');
  assert.throws(() => forgeItem(shopRun(['spear.mythic.blazing']), SOCKET_0, 'blazing', equipment), RunProgressError, 'no lift and the same element: nothing to do');
  assert.throws(() => forgeItem(shopRun([]), SOCKET_0, 'blazing', equipment), RunProgressError, 'an empty socket');
  assert.ok(forgeable(shopRun(['spear.mythic.blazing']), 'spear.mythic.blazing', equipment), 'another element is still work');
});

test("runProgress: the act window caps the lift, not just drops", () => {
  assert.strictEqual(liftTarget(shopRun(['spear.epic'], 1), 'spear.epic', equipment), null, 'Act 1 reaches Epic and no further');
  // Act 3 opens Mythic, so the same item is liftable there.
  assert.ok(liftTarget(shopRun(['spear.epic'], 3), 'spear.epic', equipment));
});

test('runProgress: the Forge binds a Unique even though it cannot lift it', () => {
  assert.deepStrictEqual(forgeItem(shopRun(['worldbreaker']), SOCKET_0, 'feral', equipment).roster[0].equipment, ['worldbreaker.feral']);
});
