import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { createRosterEntry } from '../src/run/state';
import { MAP_NODE_TYPES, generateMap } from '../src/run/map';
import { MOVE_TIER_RANK } from '../src/run/progression';
import { mentorMovePool, tutorMovePool } from '../src/run/tutor';
import { xpForLevel } from '../src/run/growth';

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

test("tutor: the pool is the hero's Late tier alone, whatever its level, minus what it holds or was offered", () => {
  // The Mentor's beat at Late (2026-09-13): a guaranteed Late move, rolled, un-gated by level.
  const entry = createRosterEntry('ironWarden', 'ironWarden', heroes.ironWarden.moveIds);
  const pool = tutorMovePool(progressionTable, moves, entry);
  assert.ok(pool.length > 0, 'a level-1 hero still gets a Late move — the Tutor is un-gated');
  for (const id of pool) assert.strictEqual(moves[id].tier, 'late', `${id} is not Late`);
  assert.ok(pool.includes('juggernaut'));
  assert.ok(!pool.includes('ironFist') && !pool.includes('rendArmor'), 'no Early, no Mid');

  // A rolled offer is spent by being made, so a Late move a level already burned stays burned.
  const burned = { ...entry, offeredMoveIds: ['juggernaut'] };
  assert.ok(!tutorMovePool(progressionTable, moves, burned).includes('juggernaut'));
  const held = { ...entry, unlockedMoveIds: [...entry.unlockedMoveIds, 'juggernaut'] };
  assert.ok(!tutorMovePool(progressionTable, moves, held).includes('juggernaut'));
});

test('tutor: a chosen Evolution path adds its learnable Late moves to the roll, and the two rolls never overlap', () => {
  const { heroId, pathId, learnable } = heroWithPathMoves();
  const evolved = { ...entry(heroId), xp: xpForLevel(5), chosenPathIds: [pathId] };
  const after = tutorMovePool(progressionTable, moves, evolved);
  for (const id of learnable.filter((m) => moves[m].tier === 'late')) assert.ok(after.includes(id), `${heroId}: ${id} (learnable Late) missing from the roll`);
  for (const hero of Object.values(heroes)) {
    const e = entry(hero.id);
    const mid = new Set(mentorMovePool(progressionTable, moves, e));
    for (const id of tutorMovePool(progressionTable, moves, e)) assert.ok(!mid.has(id), `${id} is on both rolls`);
  }
});

test('tutor: every hero has a Late move for the Tutor to roll from a fresh kit, and the roll survives both schedule offers', () => {
  // Two Late offers a hero (docs/xp-overhaul.md §8 phase 6) against four Late a slate: the
  // Tutor's seat must still have something to hand over after both.
  for (const hero of Object.values(heroes)) {
    const e = entry(hero.id);
    const pool = tutorMovePool(progressionTable, moves, e);
    assert.ok(pool.length >= 3, `${hero.id} has ${pool.length} Late moves — two schedule offers and the Tutor need three`);
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

test('tutor: act 4 seats exactly one Tutor inside a pick-1-of-3 reward row; act 5 holds it in the forced spliced seat', () => {
  for (const seed of Array.from({ length: 40 }, (_, i) => i + 1)) {
    const act4 = generateMap(seed, 4);
    const seats = Object.values(act4.nodes).filter((n) => n.type === 'tutorReward');
    assert.strictEqual(seats.length, 1, `Act 4 (seed ${seed}) seated ${seats.length} Tutors`);
    assert.strictEqual(act4.rows[seats[0].row].length, 3, `Act 4 (seed ${seed}): Tutor is not on a pick-3 row`);
    // The row it takes still offers three DISTINCT things.
    const rowTypes = act4.rows[seats[0].row].map((id) => act4.nodes[id].type);
    assert.strictEqual(new Set(rowTypes).size, 3, `Act 4 (seed ${seed}): duplicate on the Tutor's row — ${rowTypes}`);

    // Act 5 (2026-09-14, per user direction): a forced Tutor in the Mentor's seat — a guaranteed
    // Late move going into the last Guardian, and the act's only one.
    const act5 = generateMap(seed, 5);
    const forced = Object.values(act5.nodes).filter((n) => n.type === 'tutorReward');
    assert.strictEqual(forced.length, 1, `Act 5 (seed ${seed}) seated ${forced.length} Tutors`);
    assert.strictEqual(forced[0].row, 2);
    assert.strictEqual(act5.rows[2].length, 1, `Act 5 (seed ${seed}): the Tutor is a forced single-node row`);
  }
});

test('tutor: over many seeds act 4\'s seat lands in every reward row and every column', () => {
  const rows = new Set<number>();
  const cols = new Set<number>();
  for (let seed = 1; seed <= 60; seed++) {
    const seat = Object.values(generateMap(seed, 4).nodes).find((n) => n.type === 'tutorReward')!;
    rows.add(seat.row);
    cols.add(seat.col);
  }
  assert.deepStrictEqual([...rows].sort(), [1, 3, 6], `Tutor rows seen: ${[...rows]}`);
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
