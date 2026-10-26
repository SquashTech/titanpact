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
  // The Mentor (acts 1-3) and the Tutor (act 4) joined the reward rows when their seat became a patron's.
  'mentorReward',
  'tutorReward',
  'equipmentReward',
  'scrollReward',
  'passiveReward',
  'currencyReward',
  'contractReward',
  'manaWellReward',
  'restReward',
  'forgeReward',
  'leyLineReward',
  'blessingReward',
  'event',
]);

// One shape for every act since 2026-09-14: three fights and both patron seats; no Lapidary since 2026-10-26.
test('map: the per-act shape — Fight, pick-3 reward, patron seat, pick-3 reward, (Elite or Skirmish), patron seat, pick-3 reward, funnel, Guardian', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const actNumber of [1, 2, 3, 4]) {
      const map = generateMap(seed, actNumber);
      const rows = map.rows;
      const rowTypes = (r: number) => rows[r].map((id) => map.nodes[id].type);
      const where = `act ${actNumber} seed ${seed}`;

      assert.strictEqual(rows.length, 9, `${where}: every act is the 9-row shape`);
      assert.deepStrictEqual(rowTypes(0), ['fight']);
      assert.ok(rowTypes(1).every((t) => REWARD_TYPES.has(t)), `${where} row 1 has a non-reward type: ${rowTypes(1)}`);
      assert.strictEqual(rows[1].length, 3);
      assert.deepStrictEqual(rowTypes(2), ['patronSeat', 'patronSeat'], `${where}: the first patron seat`);
      assert.ok(rowTypes(3).every((t) => REWARD_TYPES.has(t)), `${where} row 3 has a non-reward type: ${rowTypes(3)}`);
      assert.strictEqual(rows[3].length, 3);
      assert.strictEqual(rows[4].length, 2);
      assert.deepStrictEqual(rowTypes(4).slice().sort(), ['elite', 'skirmish'], `${where}: the fork is the act's one Skirmish`);
      // The second patron seat (docs/patrons.md), right after the fork, where the Academy sat.
      assert.deepStrictEqual(rowTypes(5), ['patronSeat', 'patronSeat'], `${where}: the second patron seat`);
      assert.ok(rowTypes(6).every((t) => REWARD_TYPES.has(t)), `${where} row 6 has a non-reward type: ${rowTypes(6)}`);
      assert.strictEqual(rows[6].length, 3, 'the third reward row sits between the second seat and the funnel');
      assert.deepStrictEqual(rowTypes(7), ['shop'], `${where}: the funnel is one forced Guild Hall (docs/gear-absorption.md §6)`);
      assert.deepStrictEqual(rowTypes(8), ['boss']);
      // No un-forked Skirmish anywhere: the fork is the only one.
      const skirmishes = Object.values(map.nodes).filter((n) => n.type === 'skirmish');
      assert.strictEqual(skirmishes.length, 1, `${where}: ${skirmishes.length} Skirmish nodes`);
      assert.strictEqual(skirmishes[0].row, 4);
      assert.ok(!Object.values(map.nodes).some((n) => n.type === 'scribeReward'), `${where}: a Lapidary node`);
      const seats = Object.values(map.nodes).filter((n) => n.type === 'patronSeat');
      assert.strictEqual(seats.length, 4, `${where}: ${seats.length} patron tiles`);
      assert.ok(!Object.values(map.nodes).some((n) => n.type === 'academyReward'), `${where}: an Academy node`);
      for (const id of rows[4]) assert.deepStrictEqual(map.nodes[id].nextIds, rows[5], `${where}: both fork options lead to both patrons`);
    }
  }
});

test('map: the funnel is one Guild Hall in every act, and a Guild Hall is never rolled elsewhere', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const actNumber of [1, 2, 3, 4]) {
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

test('map: the opener and both patron tiles connect to all 3 of the reward row after them (Act 4)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 4);
    assert.strictEqual(map.rows[1].length, 3, 'row 1 must be the pick-3 this test is about');
    assert.strictEqual(map.rows[3].length, 3, 'row 3 must be the pick-3 this test is about');
    assert.deepStrictEqual([...map.nodes[map.rows[0][0]].nextIds].sort(), [...map.rows[1]].sort());
    for (const id of map.rows[2]) assert.deepStrictEqual([...map.nodes[id].nextIds].sort(), [...map.rows[3]].sort());
    for (const id of map.rows[5]) assert.deepStrictEqual([...map.nodes[id].nextIds].sort(), [...map.rows[6]].sort());
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





test('map: every tile of the row above leads to both patrons, so no path loses one', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const map = generateMap(seed, 1);
    for (const [above, seat] of [[1, 2], [4, 5]]) {
      for (const id of map.rows[above]) assert.deepStrictEqual([...map.nodes[id].nextIds].sort(), [...map.rows[seat]].sort(), `seed ${seed} row ${above}`);
    }
  }
});

test('map: the Mentor is a reward-row tile in acts 1-3 and the Tutor in act 4, never the other way', () => {
  const seen = { mentor: 0, tutor: 0 };
  for (const seed of Array.from({ length: 30 }, (_, i) => i + 1)) {
    for (const actNumber of [1, 2, 3, 4]) {
      for (const node of Object.values(generateMap(seed, actNumber).nodes)) {
        if (node.type !== 'mentorReward' && node.type !== 'tutorReward') continue;
        assert.ok([1, 3, 6].includes(node.row), `act ${actNumber} seed ${seed}: ${node.type} off a reward row`);
        assert.strictEqual(node.type, actNumber <= 3 ? 'mentorReward' : 'tutorReward', `act ${actNumber} seed ${seed}`);
        seen[node.type === 'mentorReward' ? 'mentor' : 'tutor'] += 1;
      }
    }
  }
  assert.ok(seen.mentor > 0 && seen.tutor > 0, 'both are rolled somewhere');
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
test('map: the reward row above Elite-or-Skirmish keeps both options open', () => {
  for (const act of [1, 2, 3, 4]) {
    for (const seed of [1, 7, 42, 99, 2024]) {
      const map = generateMap(seed, act);
      const eliteRow = 4;
      const feeding = map.rows[eliteRow - 1];
      const [eliteId, skirmishId] = map.rows[eliteRow];
      assert.strictEqual(map.nodes[eliteId].type, 'elite');
      assert.strictEqual(map.nodes[skirmishId].type, 'skirmish');

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
// (MapRoute's leadOnsDiffer), so an unsteered row is also what takes them off it.
test('map: the reward row above the fork has nothing left to signpost', () => {
  for (const act of [1, 2, 3, 4]) {
    for (const seed of [1, 7, 42, 99, 2024]) {
      const map = generateMap(seed, act);
      const feeding = map.rows[3];
      const signatures = new Set(feeding.map((id) => [...map.nodes[id].nextIds].sort().join('+')));
      assert.strictEqual(signatures.size, 1, `act ${act} seed ${seed}: options still lead somewhere different`);
    }
  }
});

