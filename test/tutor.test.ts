import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { createRosterEntry } from '../src/run/state';
import { MAP_NODE_TYPES, generateMap } from '../src/run/map';
import { MOVE_TIER_RANK } from '../src/run/progression';
import { tutorMovePool } from '../src/run/tutor';
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

test('tutor: the pick is every move the hero can learn and does not hold, Late first, un-gated by level', () => {
  const entry = createRosterEntry('ironWarden', 'ironWarden', heroes.ironWarden.moveIds);
  const pool = tutorMovePool(progressionTable, moves, entry);
  assert.ok(pool.includes('juggernaut') && pool.includes('rendArmor'), 'Late and Mid at level 1');
  const ranks = pool.map((id) => ({ late: 0, mid: 1, early: 2 })[moves[id].tier ?? 'early']);
  assert.deepStrictEqual(ranks, [...ranks].sort((a, b) => a - b), 'Late, then Mid, then Early');
  for (const id of entry.unlockedMoveIds) assert.ok(!pool.includes(id), `${id} is held`);

  // A pick, not a roll: a move a level offered and the player declined is still on the list.
  const declined = { ...entry, offeredMoveIds: ['juggernaut'] };
  assert.ok(tutorMovePool(progressionTable, moves, declined).includes('juggernaut'));
  // A starting move swapped away can be learned back.
  const swapped = { ...entry, unlockedMoveIds: entry.unlockedMoveIds.slice(1) };
  assert.ok(tutorMovePool(progressionTable, moves, swapped).includes(entry.unlockedMoveIds[0]));
});

test('tutor: a chosen Evolution path adds its moves — granted and learnable — to the pick', () => {
  const { heroId, pathId, learnable, unlocks } = heroWithPathMoves();
  const evolved = { ...entry(heroId), xp: xpForLevel(5), chosenPathIds: [pathId] };
  const after = tutorMovePool(progressionTable, moves, evolved);
  for (const id of [...learnable, ...unlocks]) assert.ok(after.includes(id), `${heroId}: ${id} missing from the pick`);
});

test('tutor: every hero has a Late move to pick from a fresh kit', () => {
  for (const hero of Object.values(heroes)) {
    const pool = tutorMovePool(progressionTable, moves, entry(hero.id));
    assert.ok(pool.some((id) => moves[id].tier === 'late'), `${hero.id} has no Late move for the Tutor`);
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

test('tutor: act 4 holds exactly one Tutor, in the forced spliced seat', () => {
  // The act-4 in-row seat left with the Forge (docs/gear-absorption.md §4): a guaranteed Late
  // move an act, ahead of the two Guardians it matters most against, and each act's only one.
  for (const seed of Array.from({ length: 40 }, (_, i) => i + 1)) {
    for (const actNumber of [4]) {
      const map = generateMap(seed, actNumber);
      const seats = Object.values(map.nodes).filter((n) => n.type === 'tutorReward');
      assert.strictEqual(seats.length, 1, `Act ${actNumber} (seed ${seed}) seated ${seats.length} Tutors`);
      assert.strictEqual(seats[0].row, 2);
      assert.strictEqual(map.rows[2].length, 1, `Act ${actNumber} (seed ${seed}): the Tutor is a forced single-node row`);
    }
    for (const actNumber of [1, 2, 3]) {
      assert.ok(!Object.values(generateMap(seed, actNumber).nodes).some((n) => n.type === 'tutorReward'), `Act ${actNumber} (seed ${seed}) has a Tutor`);
    }
  }
});

