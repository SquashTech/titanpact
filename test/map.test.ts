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
  // Acts 4-5 only, and never from REWARD_WEIGHTS — see tutor.test.ts for the seat itself.
  'tutorReward',
  'equipmentReward',
  'scrollReward',
  'passiveReward',
  'currencyReward',
  'upgradeReward',
  'forgeReward',
  'event',
]);

// Act 5 is the base shape's only representative now — acts 1-4 all carry a Mentor row.
test('map: base per-act shape (Act 5) — Fight, pick-3 reward, Skirmish, pick-3 reward, (Elite or Battle), Guild Hall, Guardian', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 5);
    const rows = map.rows;
    const rowTypes = (r: number) => rows[r].map((id) => map.nodes[id].type);

    assert.strictEqual(rows.length, 8, `Act 5 should be the unmodified 8-row shape (seed ${seed})`);
    assert.deepStrictEqual(rowTypes(0), ['fight']);
    assert.ok(rowTypes(1).every((t) => REWARD_TYPES.has(t)), `row 1 (seed ${seed}) has a non-reward type: ${rowTypes(1)}`);
    assert.strictEqual(rows[1].length, 3);
    assert.deepStrictEqual(rowTypes(2), ['skirmish']);
    assert.ok(rowTypes(3).every((t) => REWARD_TYPES.has(t)), `row 3 (seed ${seed}) has a non-reward type: ${rowTypes(3)}`);
    assert.strictEqual(rows[3].length, 3);
    assert.strictEqual(rows[4].length, 2);
    assert.deepStrictEqual(rowTypes(4).slice().sort(), ['battle', 'elite']);
    assert.ok(rowTypes(5).every((t) => REWARD_TYPES.has(t)), `row 5 (seed ${seed}) has a non-reward type: ${rowTypes(5)}`);
    assert.strictEqual(rows[5].length, 3, 'the third reward row sits between Elite-or-Battle and the funnel');
    assert.deepStrictEqual(rowTypes(6), ['shop', 'blacksmith'], 'Act 5 funnel is the Guild Hall / Blacksmith fork');
    assert.deepStrictEqual(rowTypes(7), ['boss']);
  }
});

test('map: the Blacksmith widens the funnel from act 3 on, and never appears before it', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const actNumber of [1, 2, 3, 4, 5]) {
      const map = generateMap(seed, actNumber);
      const funnelRow = map.rows.length - 2;
      const funnelTypes = map.rows[funnelRow].map((id) => map.nodes[id].type);
      if (actNumber >= 3) {
        assert.deepStrictEqual(funnelTypes, ['shop', 'blacksmith'], `act ${actNumber} seed ${seed}`);
      } else {
        assert.deepStrictEqual(funnelTypes, ['shop'], `act ${actNumber} seed ${seed}`);
      }
      // Never a rolled reward — the funnel row is its only source, the way the Mentor row is
      // classReward's.
      for (let r = 0; r < map.rows.length; r++) {
        if (r === funnelRow) continue;
        for (const nodeId of map.rows[r]) {
          assert.notStrictEqual(map.nodes[nodeId].type, 'blacksmith', `act ${actNumber} seed ${seed} row ${r}`);
        }
      }
    }
  }
});

// The act's one guaranteed spend. If the map could hand a path only one of the two, the fork
// would be decided by the seed rather than by the player.
test('map: every path into the funnel keeps BOTH the Guild Hall and the Blacksmith', () => {
  for (const seed of [1, 7, 42, 99, 2024]) {
    for (const actNumber of [3, 4, 5]) {
      const map = generateMap(seed, actNumber);
      const funnelRow = map.rows.length - 2;
      const funnel = map.rows[funnelRow];
      assert.strictEqual(funnel.length, 2, `act ${actNumber} seed ${seed}: expected the two-wide funnel`);
      for (const fromId of map.rows[funnelRow - 1]) {
        assert.deepStrictEqual(
          [...map.nodes[fromId].nextIds].sort(),
          [...funnel].sort(),
          `act ${actNumber} seed ${seed}: ${fromId} loses half the funnel fork`
        );
      }
    }
  }
});

// Act 5, not Act 2: these index rows by hand, and acts 1-4 now carry a Mentor row that
// shifts every index past 1. Pointed at Act 2 they still PASSED while testing nothing.
test('map: the single-node rows before a pick-3 reward row connect to all 3 of them (Act 5)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 5);
    assert.strictEqual(map.rows[1].length, 3, 'row 1 must be the pick-3 this test is about');
    assert.strictEqual(map.rows[3].length, 3, 'row 3 must be the pick-3 this test is about');
    assert.deepStrictEqual([...map.nodes[map.rows[0][0]].nextIds].sort(), [...map.rows[1]].sort());
    assert.deepStrictEqual([...map.nodes[map.rows[2][0]].nextIds].sort(), [...map.rows[3]].sort());
  }
});

test('map: the Elite/Battle choice stays reachable from the reward row on every seed (Act 5)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 5);
    assert.deepStrictEqual(map.rows[4].map((id) => map.nodes[id].type).sort(), ['battle', 'elite'], 'row 4 must be the Elite/Battle row');
    const reachableFromRow3 = new Set(map.rows[3].flatMap((id) => map.nodes[id].nextIds));
    for (const optionId of map.rows[4]) {
      assert.ok(reachableFromRow3.has(optionId), `seed ${seed}: ${optionId} unreachable from row 3`);
    }
    assert.ok(
      map.rows[3].some((id) => map.rows[4].every((o) => map.nodes[id].nextIds.includes(o))),
      `seed ${seed}: no row-3 node preserves the full Elite/Battle choice`,
    );
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

test('map: Act 1 inserts a standalone single-node Mentor (classReward) row right BEFORE the Skirmish row', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 1);
    const rows = map.rows;
    const rowTypes = (r: number) => rows[r].map((id) => map.nodes[id].type);

    assert.strictEqual(rows.length, 9, `Act 1 should have one extra row over the base shape (seed ${seed})`);
    assert.deepStrictEqual(rowTypes(0), ['fight']);
    assert.strictEqual(rows[1].length, 3);
    // The Mentor OWNS the base Skirmish row and the Skirmish moves down one, so the Class is
    // in hand for the run's first recruitable fight instead of arriving just after it.
    assert.strictEqual(rows[2].length, 1, `Mentor row (seed ${seed}) should be a single node`);
    assert.deepStrictEqual(rowTypes(2), ['classReward']);
    assert.deepStrictEqual(rowTypes(3), ['skirmish']);
    // classReward is excluded from REWARD_WEIGHTS, so the Mentor row is the only place it can appear.
    assert.ok(rowTypes(4).every((t) => REWARD_TYPES.has(t)), `row 4 (seed ${seed}) has a non-reward type: ${rowTypes(4)}`);
    assert.ok(!rowTypes(4).includes('classReward'), `row 4 (seed ${seed}) rerolled classReward — it should only ever appear in the forced Mentor row`);
    assert.strictEqual(rows[4].length, 3);
    assert.strictEqual(rows[5].length, 2);
    assert.deepStrictEqual(rowTypes(5).slice().sort(), ['battle', 'elite']);
  }
});

test('map: Act 1 — the Mentor row connects into the Skirmish, and the Skirmish into the following pick-3 reward row', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 1);
    // Both are single-node rows, so each has exactly one outgoing edge and no path can skip either.
    assert.deepStrictEqual([...map.nodes[map.rows[2][0]].nextIds].sort(), [...map.rows[3]].sort());
    assert.deepStrictEqual([...map.nodes[map.rows[3][0]].nextIds].sort(), [...map.rows[4]].sort());
    // And every path out of the opening reward row funnels through the Mentor.
    for (const nodeId of map.rows[1]) {
      assert.deepStrictEqual([...map.nodes[nodeId].nextIds], [map.rows[2][0]], `seed ${seed} can bypass the Mentor`);
    }
  }
});

test('map: acts 1-4 each guarantee a Mentor before their Skirmish; Act 5 alone keeps the base 7-row shape', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const actNumber of [1, 2, 3, 4]) {
      const map = generateMap(seed, actNumber);
      assert.strictEqual(map.rows.length, 9, `Act ${actNumber} (seed ${seed}) is missing the Mentor row`);
      assert.strictEqual(map.rows[2].length, 1, `Act ${actNumber} (seed ${seed}) Mentor row should be a single node`);
      assert.strictEqual(map.nodes[map.rows[2][0]].type, 'classReward', `Act ${actNumber} (seed ${seed})`);
      assert.strictEqual(map.nodes[map.rows[3][0]].type, 'skirmish', `Act ${actNumber} (seed ${seed}) Skirmish should follow the Mentor`);
    }
    // Act 5 is deliberately left without one — a different beat is planned for it.
    const act5 = generateMap(seed, 5);
    assert.strictEqual(act5.rows.length, 8, `Act 5 (seed ${seed}) should not have the extra Mentor row`);
    assert.strictEqual(act5.nodes[act5.rows[2][0]].type, 'skirmish');
    for (const row of act5.rows) {
      for (const nodeId of row) {
        assert.notStrictEqual(act5.nodes[nodeId].type, 'classReward', `Act 5 (seed ${seed}) grew a Mentor`);
      }
    }
  }
});

test('map: classReward never rerolls into a pick-1-of-3 reward row — the forced Mentor row is its only source', () => {
  for (const seed of Array.from({ length: 30 }, (_, i) => i + 1)) {
    for (const actNumber of [1, 2, 3, 4, 5]) {
      const map = generateMap(seed, actNumber);
      // Acts 1-4 carry the Mentor, which pushes their second reward row from 3 to 4.
      const rewardRowIndices = actNumber <= 4 ? [1, 4, 6] : [1, 3, 5];
      for (const r of rewardRowIndices) {
        for (const nodeId of map.rows[r]) {
          assert.notStrictEqual(map.nodes[nodeId].type, 'classReward', `Act ${actNumber} row ${r} (seed ${seed}) rolled classReward outside the Mentor row`);
        }
      }
    }
  }
});

test('map: omitting actNumber defaults to Act 1 (the standalone Mentor row still applies)', () => {
  const map = generateMap(1);
  assert.strictEqual(map.rows.length, 9);
  assert.strictEqual(map.nodes[map.rows[2][0]].type, 'classReward');
  assert.strictEqual(map.nodes[map.rows[3][0]].type, 'skirmish');
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

// Every path arrives at the fork holding both options (2026-09-08). The reward row above used to
// steer left->Elite / right->Battle; with only one row on screen at a time that priced a choice
// against a row the player can no longer see, so it was removed.
test('map: every node in the reward row above Elite-or-Battle keeps both options open', () => {
  for (const act of [1, 2, 3]) {
    for (const seed of [1, 7, 42, 99, 2024]) {
      const map = generateMap(seed, act);
      const eliteRow = map.rows.length - 4;
      const feeding = map.rows[eliteRow - 1];
      const [eliteId, battleId] = map.rows[eliteRow];
      assert.strictEqual(map.nodes[eliteId].type, 'elite');
      assert.strictEqual(map.nodes[battleId].type, 'battle');
      assert.strictEqual(feeding.length, 3, `act ${act} seed ${seed}: expected a 3-wide feeding row`);

      for (const fromId of feeding) {
        assert.deepStrictEqual(
          [...map.nodes[fromId].nextIds].sort(),
          [eliteId, battleId].sort(),
          `act ${act} seed ${seed}: ${fromId} must reach both the Elite and the Battle`,
        );
      }
    }
  }
});

// The lead-on markers on a choice card are derived from where its options actually go
// (MapRoute's leadOnsDiffer), so an unsteered row is also what takes them off it.
test('map: the reward row above Elite-or-Battle has nothing left to signpost', () => {
  for (const act of [1, 2, 3, 4, 5]) {
    for (const seed of [1, 7, 42, 99, 2024]) {
      const map = generateMap(seed, act);
      const feeding = map.rows[map.rows.length - 5];
      const signatures = new Set(feeding.map((id) => [...map.nodes[id].nextIds].sort().join('+')));
      assert.strictEqual(signatures.size, 1, `act ${act} seed ${seed}: options still lead somewhere different`);
    }
  }
});

