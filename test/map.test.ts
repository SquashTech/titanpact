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
  // Act 4 only, and never from REWARD_WEIGHTS — see tutor.test.ts for the seat itself.
  'tutorReward',
  'equipmentReward',
  'scrollReward',
  'passiveReward',
  'currencyReward',
  'manaWellReward',
  'restReward',
  'forgeReward',
  'leyLineReward',
  'event',
]);

// One shape for every act 1-5 since 2026-09-14: three fights, the spliced seat and the Scribe in all five.
test('map: the per-act shape — Fight, pick-3 reward, spliced seat, pick-3 reward, Scribe, (Elite or Skirmish), pick-3 reward, funnel, Guardian', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const actNumber of [1, 2, 3, 4, 5]) {
      const map = generateMap(seed, actNumber);
      const rows = map.rows;
      const rowTypes = (r: number) => rows[r].map((id) => map.nodes[id].type);
      const where = `act ${actNumber} seed ${seed}`;

      assert.strictEqual(rows.length, 9, `${where}: every act is the 9-row shape`);
      assert.deepStrictEqual(rowTypes(0), ['fight']);
      assert.ok(rowTypes(1).every((t) => REWARD_TYPES.has(t)), `${where} row 1 has a non-reward type: ${rowTypes(1)}`);
      assert.strictEqual(rows[1].length, 3);
      assert.strictEqual(rows[2].length, 1, `${where}: the spliced seat is a single node`);
      assert.ok(rowTypes(3).every((t) => REWARD_TYPES.has(t)), `${where} row 3 has a non-reward type: ${rowTypes(3)}`);
      assert.strictEqual(rows[3].length, 3);
      // The Scribe (docs/mastery.md §3): forced, every act, ahead of the fork so the Evolution it
      // buys is in hand for the previewed Elite and the Guardian. Never from REWARD_WEIGHTS.
      assert.deepStrictEqual(rowTypes(4), ['scribeReward'], `${where}: the Scribe row`);
      assert.strictEqual(rows[5].length, 2);
      assert.deepStrictEqual(rowTypes(5).slice().sort(), ['elite', 'skirmish'], `${where}: the fork is the act's one Skirmish`);
      assert.ok(rowTypes(6).every((t) => REWARD_TYPES.has(t)), `${where} row 6 has a non-reward type: ${rowTypes(6)}`);
      assert.strictEqual(rows[6].length, 3, 'the third reward row sits between Elite-or-Skirmish and the funnel');
      assert.deepStrictEqual(rowTypes(7), ['shop'], `${where}: the funnel is one forced Guild Hall (docs/gear-absorption.md §6)`);
      assert.deepStrictEqual(rowTypes(8), ['boss']);
      // No un-forked Skirmish anywhere: the fork is the only one.
      const skirmishes = Object.values(map.nodes).filter((n) => n.type === 'skirmish');
      assert.strictEqual(skirmishes.length, 1, `${where}: ${skirmishes.length} Skirmish nodes`);
      assert.strictEqual(skirmishes[0].row, 5);
      const scribes = Object.values(map.nodes).filter((n) => n.type === 'scribeReward');
      assert.strictEqual(scribes.length, 1, `${where}: ${scribes.length} Scribe nodes`);
    }
  }
});

test('map: the funnel is one Guild Hall in every act, and a Guild Hall is never rolled elsewhere', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const actNumber of [1, 2, 3, 4, 5]) {
      const map = generateMap(seed, actNumber);
      const funnelRow = map.rows.length - 2;
      assert.deepStrictEqual(map.rows[funnelRow].map((id) => map.nodes[id].type), ['shop'], `act ${actNumber} seed ${seed}`);
      for (let r = 0; r < map.rows.length; r++) {
        if (r === funnelRow) continue;
        for (const nodeId of map.rows[r]) {
          assert.notStrictEqual(map.nodes[nodeId].type, 'shop', `act ${actNumber} seed ${seed} row ${r}`);
        }
      }
    }
  }
});

test('map: the single-node rows before a pick-3 reward row connect to all 3 of them (Act 5)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 5);
    assert.strictEqual(map.rows[1].length, 3, 'row 1 must be the pick-3 this test is about');
    assert.strictEqual(map.rows[3].length, 3, 'row 3 must be the pick-3 this test is about');
    assert.deepStrictEqual([...map.nodes[map.rows[0][0]].nextIds].sort(), [...map.rows[1]].sort());
    assert.deepStrictEqual([...map.nodes[map.rows[2][0]].nextIds].sort(), [...map.rows[3]].sort());
  }
});

test('map: the Elite/Skirmish choice stays reachable from the Scribe on every seed (Act 5)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 5);
    assert.deepStrictEqual(map.rows[5].map((id) => map.nodes[id].type).sort(), ['elite', 'skirmish'], 'row 5 must be the Elite/Skirmish row');
    const reachableFromScribe = new Set(map.rows[4].flatMap((id) => map.nodes[id].nextIds));
    for (const optionId of map.rows[5]) {
      assert.ok(reachableFromScribe.has(optionId), `seed ${seed}: ${optionId} unreachable from the Scribe`);
    }
    // And every node of the reward row above reaches the Scribe: a single-node row is never skipped.
    for (const id of map.rows[3]) assert.deepStrictEqual(map.nodes[id].nextIds, map.rows[4], `seed ${seed}: ${id} does not lead to the Scribe`);
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

test('map: the Mentor row sits between the first two reward rows, and every path runs through it', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 1);
    const rows = map.rows;
    const rowTypes = (r: number) => rows[r].map((id) => map.nodes[id].type);

    // Ahead of the fork, so the move is in hand for the act's first recruitable fight.
    assert.deepStrictEqual(rowTypes(2), ['mentorReward']);
    // mentorReward is excluded from REWARD_WEIGHTS, so the Mentor row is the only place it can appear.
    assert.ok(!rowTypes(3).includes('mentorReward'), `row 3 (seed ${seed}) rerolled mentorReward — it should only ever appear in the forced Mentor row`);
    // A single-node row has exactly one way out, and every node of the row above leads into it.
    assert.deepStrictEqual([...map.nodes[rows[2][0]].nextIds].sort(), [...rows[3]].sort());
    for (const nodeId of rows[1]) {
      assert.deepStrictEqual([...map.nodes[nodeId].nextIds], [rows[2][0]], `seed ${seed} can bypass the Mentor`);
    }
  }
});

test('map: the spliced seat is the Mentor in acts 1-3 and the Tutor in acts 4-5', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const actNumber of [1, 2, 3, 4, 5]) {
      const map = generateMap(seed, actNumber);
      const expected = actNumber <= 3 ? 'mentorReward' : 'tutorReward';
      assert.strictEqual(map.nodes[map.rows[2][0]].type, expected, `Act ${actNumber} (seed ${seed})`);
      // And it is not ALSO rolled elsewhere on the same map — neither is in REWARD_WEIGHTS.
      const elsewhere = Object.values(map.nodes).filter((n) => n.type === expected && n.row !== 2);
      assert.strictEqual(elsewhere.length, 0, `Act ${actNumber} (seed ${seed}) grew a second ${expected}`);
    }
  }
});

test('map: mentorReward never rerolls into a pick-1-of-3 reward row — the forced Mentor row is its only source', () => {
  for (const seed of Array.from({ length: 30 }, (_, i) => i + 1)) {
    for (const actNumber of [1, 2, 3, 4, 5]) {
      const map = generateMap(seed, actNumber);
      const rewardRowIndices = [1, 3, 5];
      for (const r of rewardRowIndices) {
        for (const nodeId of map.rows[r]) {
          assert.notStrictEqual(map.nodes[nodeId].type, 'mentorReward', `Act ${actNumber} row ${r} (seed ${seed}) rolled mentorReward outside the Mentor row`);
        }
      }
    }
  }
});

test('map: omitting actNumber defaults to Act 1 (the Mentor in the spliced seat)', () => {
  const map = generateMap(1);
  assert.strictEqual(map.rows.length, 9);
  assert.strictEqual(map.nodes[map.rows[2][0]].type, 'mentorReward');
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
test('map: the Scribe above Elite-or-Skirmish keeps both options open', () => {
  for (const act of [1, 2, 3]) {
    for (const seed of [1, 7, 42, 99, 2024]) {
      const map = generateMap(seed, act);
      const eliteRow = map.rows.length - 4;
      const feeding = map.rows[eliteRow - 1];
      const [eliteId, skirmishId] = map.rows[eliteRow];
      assert.strictEqual(map.nodes[eliteId].type, 'elite');
      assert.strictEqual(map.nodes[skirmishId].type, 'skirmish');
      assert.deepStrictEqual(feeding.map((id) => map.nodes[id].type), ['scribeReward'], `act ${act} seed ${seed}: the Scribe feeds the fork`);

      for (const fromId of feeding) {
        assert.deepStrictEqual(
          [...map.nodes[fromId].nextIds].sort(),
          [eliteId, skirmishId].sort(),
          `act ${act} seed ${seed}: ${fromId} must reach both the Elite and the Skirmish`,
        );
      }
    }
  }
});

// The lead-on markers on a choice card are derived from where its options actually go
// (MapRoute's leadOnsDiffer), so an unsteered row is also what takes them off it. The row above
// the Scribe is the one with a choice in it; the Scribe itself leads to both.
test('map: the reward row above the Scribe has nothing left to signpost', () => {
  for (const act of [1, 2, 3, 4, 5]) {
    for (const seed of [1, 7, 42, 99, 2024]) {
      const map = generateMap(seed, act);
      const feeding = map.rows[map.rows.length - 6];
      const signatures = new Set(feeding.map((id) => [...map.nodes[id].nextIds].sort().join('+')));
      assert.strictEqual(signatures.size, 1, `act ${act} seed ${seed}: options still lead somewhere different`);
    }
  }
});

