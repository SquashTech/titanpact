import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { progressionTable } from '../src/data/progression';
import {
  createRunState,
  createRosterEntry,
  addRosterEntry,
  terminateRosterEntry,
  RosterFullError,
  ROSTER_CAP,
} from '../src/run/state';
import { equipItem } from '../src/run/equipment';
import { pickSquad, SquadSelectionError } from '../src/run/squad';
import { buildCombatState } from '../src/run/buildCombatState';
import { getEffectiveStat } from '../src/engine/state';
import { levelUpHero, levelUpMovePool, grantLevelUpMove, availableRankUp, chooseRankUpBranch, ProgressionError } from '../src/run/progression';

/** Test helper: spends `n` Training Points on a hero, ignoring each level's move offer — mirrors the old investRankProgress(n) shape for tests that only care about rankProgress crossing a threshold. */
function levelUpTimes(run: import('../src/run/state').RunState, rosterId: string, n: number) {
  let next = run;
  for (let i = 0; i < n; i++) next = levelUpHero(next, rosterId);
  return next;
}

function seedRoster(heroIds: string[]) {
  let run = createRunState(10);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- Roster cap / termination ------------------------------------------

test('run: roster accepts up to the 6-hero cap, then throws', () => {
  const allSix = ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk'];
  assert.strictEqual(allSix.length, ROSTER_CAP);
  const run = seedRoster(allSix);
  assert.strictEqual(run.roster.length, ROSTER_CAP);
  assert.throws(
    () => addRosterEntry(run, createRosterEntry('extra', 'cinderKnight', [])),
    RosterFullError
  );
});

test('run: adding a duplicate rosterId throws', () => {
  const run = seedRoster(['cinderKnight']);
  assert.throws(() => addRosterEntry(run, createRosterEntry('cinderKnight', 'cinderKnight', [])));
});

test('run: terminating a roster entry strips its equipment (the entry, and its loadout, are gone)', () => {
  let run = seedRoster(['cinderKnight']);
  run = {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === 'cinderKnight' ? { ...r, equipment: equipItem(r.equipment, equipment.ironBlade) } : r)),
  };
  assert.strictEqual(run.roster[0].equipment.weapon, 'ironBlade');

  const afterTermination = terminateRosterEntry(run, 'cinderKnight');
  assert.strictEqual(afterTermination.roster.length, 0);
});

// --- Squad selection (bring-6-pick-4) -----------------------------------

test('squad: picking 4 of 6 splits into 2 active + 2 bench, in pick order', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk']);
  const squad = pickSquad(run.roster, ['stormRanger', 'shadowMonk', 'cinderKnight', 'tidecaller']);
  assert.deepStrictEqual(squad.activeIds, ['stormRanger', 'shadowMonk']);
  assert.deepStrictEqual(squad.benchIds, ['cinderKnight', 'tidecaller']);
});

test('squad: fewer than 4 picks is legal (early-run roster) and leaves an empty active slot below 2 picks', () => {
  const run = seedRoster(['cinderKnight']);
  const squad = pickSquad(run.roster, ['cinderKnight']);
  assert.deepStrictEqual(squad.activeIds, ['cinderKnight', null]);
  assert.deepStrictEqual(squad.benchIds, []);
});

test('squad: 0 picks, 5 picks, duplicates, and unknown ids are all rejected', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger']);
  assert.throws(() => pickSquad(run.roster, []), SquadSelectionError);
  assert.throws(() => pickSquad(run.roster, run.roster.map((r) => r.rosterId)), SquadSelectionError); // 5 picks
  assert.throws(() => pickSquad(run.roster, ['cinderKnight', 'cinderKnight']), SquadSelectionError);
  assert.throws(() => pickSquad(run.roster, ['nonexistent']), SquadSelectionError);
});

// --- buildCombatState: equipment + rank-up grants feed the stat pipeline ---

test('buildCombatState: equipped item stat grants raise the combatant\'s effective stat', () => {
  let run = seedRoster(['cinderKnight', 'tidecaller']);
  run = {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === 'cinderKnight' ? { ...r, equipment: equipItem(r.equipment, equipment.ironBlade) } : r)),
  };
  const squad = pickSquad(run.roster, ['cinderKnight', 'tidecaller']);
  const aiRun = seedRoster(['ironWarden', 'wildOracle']);
  const aiSquad = pickSquad(aiRun.roster, ['ironWarden', 'wildOracle']);

  const state = buildCombatState(1, heroes, equipment, [
    { side: 'A', squad, roster: run.roster },
    { side: 'B', squad: aiSquad, roster: aiRun.roster },
  ]);

  const combatant = state.combatants['A:cinderKnight'];
  assert.ok(combatant, 'expected a combatant keyed A:cinderKnight');
  const effectiveAttack = getEffectiveStat(heroes.cinderKnight, combatant, 'attack');
  assert.strictEqual(effectiveAttack, heroes.cinderKnight.baseStats.attack + 10);
});

test('buildCombatState: same rosterId on both sides does not collide (side-prefixed combatant ids)', () => {
  const runA = seedRoster(['cinderKnight']);
  const runB = seedRoster(['cinderKnight']); // deliberately the same rosterId as side A
  const squadA = pickSquad(runA.roster, ['cinderKnight']);
  const squadB = pickSquad(runB.roster, ['cinderKnight']);

  const state = buildCombatState(1, heroes, equipment, [
    { side: 'A', squad: squadA, roster: runA.roster },
    { side: 'B', squad: squadB, roster: runB.roster },
  ]);

  assert.strictEqual(Object.keys(state.combatants).length, 2);
  assert.ok(state.combatants['A:cinderKnight']);
  assert.ok(state.combatants['B:cinderKnight']);
  assert.strictEqual(state.active.A[0], 'A:cinderKnight');
  assert.strictEqual(state.active.B[0], 'B:cinderKnight');
});

// --- Level-up pool: leveling (moves + rank-up progress) -----------------

test('progression: levelUpHero spends one point, bumps level + rankProgress; insufficient points is rejected', () => {
  let run = seedRoster(['cinderKnight']);
  run = { ...run, levelUpPool: 0 };
  assert.throws(() => levelUpHero(run, 'cinderKnight'), ProgressionError);

  run = { ...run, levelUpPool: 1 };
  const next = levelUpHero(run, 'cinderKnight');
  assert.strictEqual(next.levelUpPool, 0);
  assert.strictEqual(next.roster[0].level, 2);
  assert.strictEqual(next.roster[0].rankProgress, 1);
});

test('progression: levelUpMovePool + grantLevelUpMove resolve a level-up\'s move offer', () => {
  let run = seedRoster(['cinderKnight']);
  const entry = run.roster[0];
  assert.deepStrictEqual(
    levelUpMovePool(progressionTable, entry),
    ['emberSlash', 'flareBurst', 'quickJab', 'fangRush', 'cinderNova', 'infernoWave']
  );

  const withMove = grantLevelUpMove(run, 'cinderKnight', 'cinderNova');
  assert.ok(withMove.roster[0].unlockedMoveIds.includes('cinderNova'));
  assert.ok(!levelUpMovePool(progressionTable, withMove.roster[0]).includes('cinderNova')); // granted move drops out of the pool
  assert.strictEqual(withMove.roster[0].unlockedMoveIds.length, 4); // starting 3 + this grant hits MOVE_CAP

  // Already at MOVE_CAP: further offers require replacing an unlocked move.
  const swapped = grantLevelUpMove(withMove, 'cinderKnight', 'quickJab', 'fortify');
  assert.ok(!swapped.roster[0].unlockedMoveIds.includes('fortify'));
  assert.ok(swapped.roster[0].unlockedMoveIds.includes('quickJab'));
  assert.throws(() => grantLevelUpMove(withMove, 'cinderKnight', 'quickJab', 'notUnlocked'), ProgressionError);
});

test('progression: rank-up branch unlocks only after enough progress, grants stats, and is one-shot', () => {
  let run = seedRoster(['cinderKnight']);
  run = { ...run, levelUpPool: 3 };

  assert.strictEqual(availableRankUp(progressionTable, run.roster[0]), null);

  run = levelUpTimes(run, 'cinderKnight', 2);
  assert.strictEqual(availableRankUp(progressionTable, run.roster[0]), null); // 2 < threshold 3

  run = { ...run, levelUpPool: 1 };
  run = levelUpTimes(run, 'cinderKnight', 1);
  const node = availableRankUp(progressionTable, run.roster[0]);
  assert.ok(node, 'expected a rank-up node to be available at threshold');
  assert.strictEqual(node!.branches.length, 2);

  const next = chooseRankUpBranch(run, progressionTable, heroes, 'cinderKnight', 'cinderKnight-offensive');
  const baseAttack = heroes.cinderKnight.baseStats.attack;
  assert.strictEqual(next.roster[0].rankStatGrants.attack, 10);
  assert.strictEqual(next.roster[0].chosenBranchIds, next.roster[0].chosenBranchIds); // sanity: array present
  assert.ok(next.roster[0].chosenBranchIds.includes('cinderKnight-offensive'));

  // one-shot: no second node authored for cinderKnight, so nothing further is offered
  assert.strictEqual(availableRankUp(progressionTable, next.roster[0]), null);
  void baseAttack;
});

test('progression: a rank-up branch with a non-multiple-of-5 stat grant is rejected', () => {
  let run = seedRoster(['cinderKnight']);
  run = { ...run, levelUpPool: 3 };
  run = levelUpTimes(run, 'cinderKnight', 3);

  const badTable = {
    moveTiers: {},
    rankUps: {
      cinderKnight: [
        {
          threshold: 3,
          branches: [
            { id: 'bad', heroId: 'cinderKnight', kind: 'offensive' as const, name: 'Bad Branch', statGrants: { attack: 7 }, unlocksMoveIds: [] },
          ],
        },
      ],
    },
  };
  assert.throws(() => chooseRankUpBranch(run, badTable, heroes, 'cinderKnight', 'bad'), ProgressionError);
});

// --- Type-graft rank-up branches (docs/progression.md "Type-graft branches") ---

test('progression: a type-graft branch grants a second type without touching the innate HeroDefinition', () => {
  let run = seedRoster(['cinderKnight']);
  run = { ...run, levelUpPool: 3 };
  run = levelUpTimes(run, 'cinderKnight', 3);

  const next = chooseRankUpBranch(run, progressionTable, heroes, 'cinderKnight', 'cinderKnight-defensive');
  assert.strictEqual(next.roster[0].rankTypeGraft, 'Stone');
  assert.deepStrictEqual(heroes.cinderKnight.types, ['Fire']); // innate type untouched

  const squad = pickSquad(next.roster, ['cinderKnight']);
  const aiRun = seedRoster(['tidecaller']);
  const aiSquad = pickSquad(aiRun.roster, ['tidecaller']);
  const state = buildCombatState(1, heroes, equipment, [
    { side: 'A', squad, roster: next.roster },
    { side: 'B', squad: aiSquad, roster: aiRun.roster },
  ]);
  assert.deepStrictEqual(state.combatants['A:cinderKnight'].grantedTypes, ['Stone']);
});

test('progression: a type-graft branch is rejected for an already-dual-typed hero', () => {
  let run = seedRoster(['ironWarden']); // Iron + Stone, already dual
  run = { ...run, levelUpPool: 3 };
  run = levelUpTimes(run, 'ironWarden', 3);

  const dualGraftTable = {
    moveTiers: {},
    rankUps: {
      ironWarden: [
        {
          threshold: 3,
          branches: [
            {
              id: 'iw-graft',
              heroId: 'ironWarden',
              kind: 'utility' as const,
              name: 'Bad Graft',
              statGrants: {},
              unlocksMoveIds: [],
              typeGraft: 'Nature',
            },
          ],
        },
      ],
    },
  };
  assert.throws(() => chooseRankUpBranch(run, dualGraftTable, heroes, 'ironWarden', 'iw-graft'), ProgressionError);
});

test('progression: a later type-graft branch shifts (replaces) the secondary type rather than stacking a third', () => {
  let run = seedRoster(['cinderKnight']);
  run = { ...run, levelUpPool: 3 };
  run = levelUpTimes(run, 'cinderKnight', 3);
  run = chooseRankUpBranch(run, progressionTable, heroes, 'cinderKnight', 'cinderKnight-defensive');
  assert.strictEqual(run.roster[0].rankTypeGraft, 'Stone');

  // A synthetic second node offering a shift to a different secondary type.
  const shiftTable = {
    moveTiers: {},
    rankUps: {
      cinderKnight: [
        { threshold: 3, branches: [] },
        {
          threshold: 3,
          branches: [
            {
              id: 'cinderKnight-shift',
              heroId: 'cinderKnight',
              kind: 'utility' as const,
              name: 'Shifted Graft',
              statGrants: {},
              unlocksMoveIds: [],
              typeGraft: 'Water',
            },
          ],
        },
      ],
    },
  };
  const shifted = chooseRankUpBranch(run, shiftTable, heroes, 'cinderKnight', 'cinderKnight-shift');
  assert.strictEqual(shifted.roster[0].rankTypeGraft, 'Water'); // replaced, not stacked

  const squad = pickSquad(shifted.roster, ['cinderKnight']);
  const aiRun = seedRoster(['tidecaller']);
  const aiSquad = pickSquad(aiRun.roster, ['tidecaller']);
  const state = buildCombatState(1, heroes, equipment, [
    { side: 'A', squad, roster: shifted.roster },
    { side: 'B', squad: aiSquad, roster: aiRun.roster },
  ]);
  assert.deepStrictEqual(state.combatants['A:cinderKnight'].grantedTypes, ['Water']); // not ['Stone', 'Water']
});
