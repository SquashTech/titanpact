import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { createRosterEntry } from '../src/run/state';
import { MAP_NODE_TYPES, generateMap } from '../src/run/map';
import { MOVE_TIER_RANK } from '../src/run/progression';
import { mentorMovePool, tutorMovePool, tutorTeachableCount } from '../src/run/tutor';

const entry = (heroId: string) => createRosterEntry(heroId, heroId, heroes[heroId].moveIds);

/** A hero whose Evolution table has a path carrying both kinds of move grant. */
function heroWithPathMoves(): { heroId: string; pathId: string; learnable: string[]; unlocks: string[] } {
  for (const [heroId, nodes] of Object.entries(progressionTable.evolutions)) {
    for (const node of nodes) {
      for (const path of node.paths) {
        const learnable = [...(path.learnableMoveIds ?? [])];
        if (learnable.length > 0 && path.unlocksMoveIds.length > 0) {
          return { heroId, pathId: path.id, learnable, unlocks: [...path.unlocksMoveIds] };
        }
      }
    }
  }
  throw new Error('no Evolution path carries both learnableMoveIds and unlocksMoveIds');
}

test('tutor: the pool is the hero level-up pool, whole and un-gated by tier', () => {
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    const offered = tutorMovePool(progressionTable, moves, entry(heroId));
    assert.deepStrictEqual([...offered].sort(), [...new Set(pool)].sort(), heroId);
    // A level-1 hero is offered its Late moves too — "any of them" is the node (docs/run-loop.md).
    assert.ok(
      offered.some((id) => (moves[id].tier ?? 'early') !== 'early'),
      `${heroId}: a tier-gated move should still be on the Tutor's shelf`
    );
  }
});

test('tutor: the pool is sorted by tier, then mana cost', () => {
  const rank = { early: 0, mid: 1, late: 2 } as const;
  for (const heroId of Object.keys(progressionTable.moveTiers)) {
    const pool = tutorMovePool(progressionTable, moves, entry(heroId));
    for (let i = 1; i < pool.length; i++) {
      const a = moves[pool[i - 1]];
      const b = moves[pool[i]];
      const ta = rank[a.tier ?? 'early'];
      const tb = rank[b.tier ?? 'early'];
      assert.ok(ta <= tb, `${heroId}: ${a.name} (${ta}) sorted before ${b.name} (${tb})`);
      if (ta === tb) assert.ok(a.manaCost <= b.manaCost, `${heroId}: ${a.name} costs more than ${b.name}`);
    }
    // The sort keys are readable off MOVE_TIER_RANK; assert the table is the one being sorted on.
    assert.ok(MOVE_TIER_RANK.early <= MOVE_TIER_RANK.mid && MOVE_TIER_RANK.mid <= MOVE_TIER_RANK.late);
  }
});

test('tutor: a chosen Evolution path adds BOTH its learnable and its granted moves to the shelf', () => {
  const { heroId, pathId, learnable, unlocks } = heroWithPathMoves();
  const before = tutorMovePool(progressionTable, moves, entry(heroId));
  const evolved = { ...entry(heroId), level: 5, chosenPathIds: [pathId] };
  const after = tutorMovePool(progressionTable, moves, evolved);

  for (const id of learnable) assert.ok(after.includes(id), `${heroId}: ${id} (learnable) missing from the shelf`);
  // The grant is the point: refused at MOVE_CAP it is otherwise gone for the run.
  for (const id of unlocks) assert.ok(after.includes(id), `${heroId}: ${id} (granted) missing from the shelf`);
  assert.ok(after.length > before.length);
});

test('tutor: a move already offered and declined is still on the shelf; one currently held is not counted', () => {
  const heroId = Object.keys(progressionTable.moveTiers)[0];
  const pool = tutorMovePool(progressionTable, moves, entry(heroId));
  const declined = pool[0];

  const spent = { ...entry(heroId), offeredMoveIds: [declined] };
  assert.ok(tutorMovePool(progressionTable, moves, spent).includes(declined), 'a declined offer must still be teachable');
  assert.strictEqual(tutorTeachableCount(progressionTable, moves, spent), pool.length);

  const holding = { ...entry(heroId), unlockedMoveIds: [...entry(heroId).unlockedMoveIds, declined] };
  // Still listed — the screen greys it in place — but no longer something the node can hand over.
  assert.ok(tutorMovePool(progressionTable, moves, holding).includes(declined));
  assert.strictEqual(tutorTeachableCount(progressionTable, moves, holding), pool.length - 1);
});

test('tutor: the starting kit is not on the shelf — it was never learned from a level-up', () => {
  for (const heroId of Object.keys(progressionTable.moveTiers)) {
    const pool = tutorMovePool(progressionTable, moves, entry(heroId));
    for (const id of heroes[heroId].moveIds) {
      if ((progressionTable.moveTiers[heroId] ?? []).includes(id)) continue;
      assert.ok(!pool.includes(id), `${heroId}: starting move ${id} leaked onto the Tutor's shelf`);
    }
  }
});

// --- The node's seat on the map ---

test('tutor: tutorReward is a known node type and never rolls out of the reward weights', () => {
  assert.ok((MAP_NODE_TYPES as readonly string[]).includes('tutorReward'));
  for (const seed of Array.from({ length: 40 }, (_, i) => i + 1)) {
    for (const actNumber of [1, 2, 3]) {
      const map = generateMap(seed, actNumber);
      for (const node of Object.values(map.nodes)) {
        assert.notStrictEqual(node.type, 'tutorReward', `Act ${actNumber} (seed ${seed}) grew a Tutor`);
      }
    }
  }
});

test('tutor: acts 4 and 5 each seat exactly one Tutor, always in a pick-1-of-3 reward row', () => {
  for (const seed of Array.from({ length: 40 }, (_, i) => i + 1)) {
    for (const actNumber of [4, 5]) {
      const map = generateMap(seed, actNumber);
      const seats = Object.values(map.nodes).filter((n) => n.type === 'tutorReward');
      assert.strictEqual(seats.length, 1, `Act ${actNumber} (seed ${seed}) seated ${seats.length} Tutors`);
      assert.strictEqual(map.rows[seats[0].row].length, 3, `Act ${actNumber} (seed ${seed}): Tutor is not on a pick-3 row`);
      // The row it takes still offers three DISTINCT things.
      const rowTypes = map.rows[seats[0].row].map((id) => map.nodes[id].type);
      assert.strictEqual(new Set(rowTypes).size, 3, `Act ${actNumber} (seed ${seed}): duplicate on the Tutor's row — ${rowTypes}`);
    }
  }
});

test('tutor: over many seeds the Tutor lands in both of an act\'s reward rows and in every column', () => {
  const rows = new Set<number>();
  const cols = new Set<number>();
  for (let seed = 1; seed <= 60; seed++) {
    for (const actNumber of [4, 5]) {
      const seat = Object.values(generateMap(seed, actNumber).nodes).find((n) => n.type === 'tutorReward')!;
      rows.add(seat.row);
      cols.add(seat.col);
    }
  }
  // Acts 4 and 5 index their reward rows differently (the Mentor row shifts act 4's second one).
  assert.ok(rows.size >= 3, `Tutor rows seen: ${[...rows]}`);
  assert.deepStrictEqual([...cols].sort(), [0, 1, 2]);
});

// --- The Mentor (docs/growth-overhaul.md §11): one Mid move, rolled, un-rank-gated ---

test('mentor: the pool is the hero\'s Mid tier alone, whatever its rank, minus what it holds or was offered', () => {
  const entry = createRosterEntry('ironWarden', 'ironWarden', heroes.ironWarden.moveIds);
  const pool = mentorMovePool(progressionTable, moves, entry);
  assert.ok(pool.length > 0, 'a rank-1 hero still gets a Mid move — the Mentor is un-rank-gated');
  for (const id of pool) assert.strictEqual(moves[id].tier, 'mid', `${id} is not Mid`);
  assert.ok(pool.includes('rendArmor'));
  assert.ok(!pool.includes('ironFist') && !pool.includes('juggernaut'), 'no Early, no Late');

  // A rolled offer is spent by being made, so a Mid move a Scroll already burned stays burned.
  const burned = { ...entry, offeredMoveIds: ['rendArmor'] };
  assert.ok(!mentorMovePool(progressionTable, moves, burned).includes('rendArmor'));
  const held = { ...entry, unlockedMoveIds: [...entry.unlockedMoveIds, 'rendArmor'] };
  assert.ok(!mentorMovePool(progressionTable, moves, held).includes('rendArmor'));
});

test('mentor: every hero has a Mid move for the Mentor to roll from a fresh kit', () => {
  for (const hero of Object.values(heroes)) {
    const entry = createRosterEntry(hero.id, hero.id, hero.moveIds);
    assert.ok(mentorMovePool(progressionTable, moves, entry).length > 0, `${hero.id} has nothing for the Mentor`);
  }
});
