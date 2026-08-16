import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { generateMap } from '../src/run/map';
import {
  reachableNodeIds,
  advanceToNode,
  syncRosterVitals,
  grantCurrencyReward,
  grantUpgradeReward,
  grantRelicReward,
  applyEquipmentReward,
  RunProgressError,
} from '../src/run/runProgress';
import { createCombatant } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';

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

// --- Vitals sync ----------------------------------------------------------

test('runProgress: syncRosterVitals writes ending HP/mana back onto the roster, for fielded heroes only', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller']); // tidecaller never fielded
  const combat: CombatState = {
    seed: 1,
    rngState: 1,
    round: 3,
    active: { A: ['A:cinderKnight', null], B: [null, null] },
    bench: { A: [], B: [] },
    combatants: { 'A:cinderKnight': { ...createCombatant('A:cinderKnight', 'cinderKnight', 'A', 40, 5), currentHp: 40, currentMana: 5 } },
    koCount: { A: 0, B: 0 },
  };

  const next = syncRosterVitals(run, combat, 'A');
  const cinder = next.roster.find((r) => r.rosterId === 'cinderKnight')!;
  const tide = next.roster.find((r) => r.rosterId === 'tidecaller')!;
  assert.strictEqual(cinder.currentHp, 40);
  assert.strictEqual(cinder.currentMana, 5);
  assert.strictEqual(tide.currentHp, null); // untouched — never fielded this fight
});

test('runProgress: syncRosterVitals clamps negative HP up to 0', () => {
  const run = seedRoster(['cinderKnight']);
  const combat: CombatState = {
    seed: 1,
    rngState: 1,
    round: 1,
    active: { A: ['A:cinderKnight', null], B: [null, null] },
    bench: { A: [], B: [] },
    combatants: { 'A:cinderKnight': { ...createCombatant('A:cinderKnight', 'cinderKnight', 'A', -5, 0), currentHp: -5, currentMana: 0 } },
    koCount: { A: 0, B: 0 },
  };
  const next = syncRosterVitals(run, combat, 'A');
  assert.strictEqual(next.roster[0].currentHp, 0);
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

test('runProgress: applyEquipmentReward equips the item onto the named roster hero', () => {
  const run = seedRoster(['cinderKnight']);
  const next = applyEquipmentReward(run, 'cinderKnight', equipment.ironBlade);
  assert.strictEqual(next.roster[0].equipment.weapon, 'ironBlade');
});

test('runProgress: applyEquipmentReward rejects an unknown rosterId', () => {
  const run = seedRoster(['cinderKnight']);
  assert.throws(() => applyEquipmentReward(run, 'nonexistent', equipment.ironBlade), RunProgressError);
});
