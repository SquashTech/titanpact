import * as assert from 'assert';
import { test } from './harness';
import { generateMap } from '../src/run/map';

test('map: generateMap is deterministic for a given seed', () => {
  const a = generateMap(1234);
  const b = generateMap(1234);
  assert.deepStrictEqual(a, b);
});

test('map: different seeds produce different maps', () => {
  const a = generateMap(1);
  const b = generateMap(2);
  assert.notStrictEqual(JSON.stringify(a), JSON.stringify(b));
});

test('map: row 0 is a single plain fight, the funnel row is a single shop, the boss row is a single boss', () => {
  const map = generateMap(7);
  const rows = map.rows;
  const rowTypes = (r: number) => rows[r].map((id) => map.nodes[id].type);

  assert.strictEqual(rows[0].length, 1);
  assert.deepStrictEqual(rowTypes(0), ['fight']);

  const funnelRow = rows.length - 2;
  const bossRow = rows.length - 1;
  assert.strictEqual(rows[funnelRow].length, 1);
  assert.deepStrictEqual(rowTypes(funnelRow), ['shop']);
  assert.strictEqual(rows[bossRow].length, 1);
  assert.deepStrictEqual(rowTypes(bossRow), ['boss']);

  assert.strictEqual(map.startNodeIds.join(','), rows[0].join(','));
  assert.strictEqual(map.bossNodeId, rows[bossRow][0]);
});

const REWARD_TYPES = new Set([
  'equipmentReward',
  'relicReward',
  'currencyReward',
  'upgradeReward',
  'weaponReward',
  'armorReward',
  'accessoryReward',
  'hpBoostReward',
  'manaBoostReward',
  'classReward',
  'event',
]);

test('map: base per-act shape (Act 2+) — Fight, pick-3 reward, Skirmish, pick-3 reward, (Elite or Battle), Guild Hall, Ancient', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 2);
    const rows = map.rows;
    const rowTypes = (r: number) => rows[r].map((id) => map.nodes[id].type);

    assert.strictEqual(rows.length, 7, `Act 2 should be the unmodified 7-row shape (seed ${seed})`);
    assert.deepStrictEqual(rowTypes(0), ['fight']);
    assert.ok(rowTypes(1).every((t) => REWARD_TYPES.has(t)), `row 1 (seed ${seed}) has a non-reward type: ${rowTypes(1)}`);
    assert.strictEqual(rows[1].length, 3);
    assert.deepStrictEqual(rowTypes(2), ['skirmish']);
    assert.ok(rowTypes(3).every((t) => REWARD_TYPES.has(t)), `row 3 (seed ${seed}) has a non-reward type: ${rowTypes(3)}`);
    assert.strictEqual(rows[3].length, 3);
    assert.strictEqual(rows[4].length, 2);
    assert.deepStrictEqual(rowTypes(4).slice().sort(), ['battle', 'elite']);
  }
});

test('map: the single-node rows before a pick-3 reward row connect to all 3 of them (Act 2+)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 2);
    assert.deepStrictEqual([...map.nodes[map.rows[0][0]].nextIds].sort(), [...map.rows[1]].sort());
    assert.deepStrictEqual([...map.nodes[map.rows[2][0]].nextIds].sort(), [...map.rows[3]].sort());
  }
});

test('map: every row-3 reward node connects to BOTH row-4 options — the Elite/Battle choice is never gated by which reward was picked (Act 2+)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 2);
    for (const nodeId of map.rows[3]) {
      assert.deepStrictEqual([...map.nodes[nodeId].nextIds].sort(), [...map.rows[4]].sort());
    }
  }
});

test('map: the boss node has no outgoing edges; every other node has at least one', () => {
  const map = generateMap(99);
  for (const node of Object.values(map.nodes)) {
    if (node.id === map.bossNodeId) {
      assert.deepStrictEqual(node.nextIds, []);
    } else {
      assert.ok(node.nextIds.length >= 1, `${node.id} has no outgoing edges`);
    }
  }
});

test('map: Act 1 inserts a standalone single-node Mentor (classReward) row right after the Skirmish row', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 1);
    const rows = map.rows;
    const rowTypes = (r: number) => rows[r].map((id) => map.nodes[id].type);

    assert.strictEqual(rows.length, 8, `Act 1 should have one extra row over the base shape (seed ${seed})`);
    assert.deepStrictEqual(rowTypes(0), ['fight']);
    assert.strictEqual(rows[1].length, 3);
    assert.deepStrictEqual(rowTypes(2), ['skirmish']);
    assert.strictEqual(rows[3].length, 1, `Mentor row (seed ${seed}) should be a single node`);
    assert.deepStrictEqual(rowTypes(3), ['classReward']);
    // The reward row that used to sit right after Skirmish shifts down a row,
    // unchanged and unfiltered — a normal pick of 3, not excluding classReward.
    assert.ok(rowTypes(4).every((t) => REWARD_TYPES.has(t)), `row 4 (seed ${seed}) has a non-reward type: ${rowTypes(4)}`);
    assert.strictEqual(rows[4].length, 3);
    assert.strictEqual(rows[5].length, 2);
    assert.deepStrictEqual(rowTypes(5).slice().sort(), ['battle', 'elite']);
  }
});

test('map: Act 1 — Skirmish connects into the Mentor row, and the Mentor row connects into the following pick-3 reward row', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 1);
    assert.deepStrictEqual([...map.nodes[map.rows[2][0]].nextIds].sort(), [...map.rows[3]].sort());
    assert.deepStrictEqual([...map.nodes[map.rows[3][0]].nextIds].sort(), [...map.rows[4]].sort());
  }
});

test('map: the guarantee is Act-1-only — every other act keeps the base 7-row shape with no forced Mentor row', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const actNumber of [2, 3, 4, 5]) {
      const map = generateMap(seed, actNumber);
      assert.strictEqual(map.rows.length, 7, `Act ${actNumber} (seed ${seed}) should not have the extra Mentor row`);
    }
  }
});

test('map: omitting actNumber defaults to Act 1 (the standalone Mentor row still applies)', () => {
  const map = generateMap(1);
  assert.strictEqual(map.rows.length, 8);
  assert.strictEqual(map.nodes[map.rows[3][0]].type, 'classReward');
});

test('map: every node past row 0 has at least one incoming edge (no orphans)', () => {
  const map = generateMap(2024);
  for (let r = 1; r < map.rows.length; r++) {
    const incoming = new Set(map.rows[r - 1].flatMap((id) => map.nodes[id].nextIds));
    for (const nodeId of map.rows[r]) {
      assert.ok(incoming.has(nodeId), `${nodeId} (row ${r}) has no incoming edge from row ${r - 1}`);
    }
  }
});
