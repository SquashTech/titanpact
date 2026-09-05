import * as assert from 'assert';
import { test } from './harness';
import {
  actScaling,
  trainingPointsFor,
  ACT_STEP_CURVE,
  ACT_XP_STEP,
  ACT_STEP_STAT_TOTAL,
  BASELINE_ACT,
  ENEMY_LEVEL_BY_ACT,
  NO_SCALING,
} from '../src/run/difficulty';
import { generateEncounter, generateLeaderEncounter } from '../src/run/enemyGen';
import { EVOLUTION_LEVEL, MOVE_CAP } from '../src/run/progression';
import { heroes } from '../src/data/heroes';
import { enemies, factions, basicEnemiesOf } from '../src/data/enemies';

const GOBLINS = factions.goblins;
import { progressionTable } from '../src/data/progression';
import { SEAL_ACTS, TOTAL_ACTS } from '../src/run/state';

function statTotal(grants: Partial<Record<string, number>>): number {
  return Object.values(grants).reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

test('difficulty: the skirmish track baselines at Act 1 and walks up the acceleration curve', () => {
  assert.strictEqual(BASELINE_ACT.skirmish, 1);
  assert.strictEqual(actScaling('skirmish', 1).statSteps, ACT_STEP_CURVE[0]);
  assert.strictEqual(actScaling('skirmish', 2).statSteps, ACT_STEP_CURVE[1]);
  assert.strictEqual(actScaling('skirmish', 5).statSteps, ACT_STEP_CURVE[4]);
});

test('difficulty: the monsters track baselines at Act 2 and never goes negative in Act 1', () => {
  assert.strictEqual(BASELINE_ACT.monsters, 2);
  assert.strictEqual(actScaling('monsters', 1).statSteps, 0);
  assert.strictEqual(actScaling('monsters', 2).statSteps, ACT_STEP_CURVE[0]);
  assert.strictEqual(actScaling('monsters', 3).statSteps, ACT_STEP_CURVE[1]);
  // One act behind the skirmish track throughout, by construction.
  assert.strictEqual(actScaling('monsters', 5).statSteps, ACT_STEP_CURVE[3]);
});

test('difficulty: the act-step curve ACCELERATES — that is the whole point of it being a table', () => {
  // A linear curve let the enemy fall behind: measured, its fielded stats grew +239/+161/+90/+87
  // an act while the player's grew +254/+192/+364/+399, crossing at act 4.
  assert.strictEqual(ACT_STEP_CURVE[0], 0, 'a track at its own baseline takes no steps');
  for (let i = 1; i < ACT_STEP_CURVE.length; i++) {
    assert.ok(ACT_STEP_CURVE[i] > ACT_STEP_CURVE[i - 1], `step ${i} does not grow`);
  }
  const gaps = ACT_STEP_CURVE.slice(1).map((n, i) => n - ACT_STEP_CURVE[i]);
  for (let i = 1; i < gaps.length; i++) {
    assert.ok(gaps[i] >= gaps[i - 1], `gap ${i} shrinks — the curve must never decelerate`);
  }
  assert.ok(gaps[gaps.length - 1] > gaps[0], 'the last act must step harder than the first');
});

test('difficulty: acts past the curve hold at its last entry rather than running off the end', () => {
  const last = ACT_STEP_CURVE[ACT_STEP_CURVE.length - 1];
  assert.strictEqual(actScaling('skirmish', TOTAL_ACTS).statSteps, last);
  assert.strictEqual(actScaling('skirmish', 99).statSteps, last);
});

test('difficulty: enemy levels follow the authored act table and hold past its end', () => {
  assert.deepStrictEqual([...ENEMY_LEVEL_BY_ACT], [1, 3, 5, 7, 10]);
  // The table covers the five seal acts; the finale act reuses its last entry.
  for (let act = 1; act <= SEAL_ACTS; act++) {
    assert.strictEqual(actScaling('skirmish', act).level, ENEMY_LEVEL_BY_ACT[act - 1]);
  }
  assert.strictEqual(actScaling('skirmish', TOTAL_ACTS).level, 10);
  // A TOTAL_ACTS bump must not produce an undefined level.
  assert.strictEqual(actScaling('skirmish', TOTAL_ACTS + 3).level, ENEMY_LEVEL_BY_ACT[ENEMY_LEVEL_BY_ACT.length - 1]);
  // Nor may a nonsense act number.
  assert.strictEqual(actScaling('skirmish', 0).level, 1);
});

test('difficulty: each act-step adds exactly ACT_STEP_STAT_TOTAL to a scaled enemy stat total, on top of the node-kind bonus', () => {
  for (const act of [1, 2, 3, 4, 5]) {
    const scaling = actScaling('skirmish', act);
    const { run } = generateEncounter('fight', 3, heroes, { scaling });
    for (const entry of run.roster) {
      assert.strictEqual(statTotal(entry.evolutionStatGrants), scaling.statSteps * ACT_STEP_STAT_TOTAL, `act ${act}`);
    }
  }

  // elite's own +10x2 stacks with the curve rather than being replaced by it.
  const eliteAct4 = actScaling('skirmish', 4);
  const { run: elite } = generateEncounter('elite', 3, heroes, { scaling: eliteAct4 });
  for (const entry of elite.roster) {
    assert.strictEqual(statTotal(entry.evolutionStatGrants), 20 + eliteAct4.statSteps * ACT_STEP_STAT_TOTAL);
  }
});

test('difficulty: every act-step grant stays a multiple of 5 or 10 (CLAUDE.md "Stat modifiers")', () => {
  const { run } = generateEncounter('boss', 8, heroes, { scaling: actScaling('skirmish', 5) });
  for (const entry of run.roster) {
    for (const amount of Object.values(entry.evolutionStatGrants)) {
      assert.strictEqual((amount ?? 0) % 5, 0);
    }
  }
});

test('difficulty: scaled enemies arrive at the act level, and from Act 3 on they are already evolved', () => {
  for (const act of [1, 2, 3, 4, 5]) {
    const scaling = actScaling('skirmish', act);
    const { run } = generateEncounter('elite', 12, heroes, { scaling, progression: progressionTable });
    for (const entry of run.roster) {
      assert.strictEqual(entry.level, scaling.level, `act ${act} level`);
      if (scaling.level >= EVOLUTION_LEVEL) {
        assert.strictEqual(entry.chosenPathIds.length, 1, `act ${act} ${entry.heroId} should have evolved`);
      } else {
        assert.strictEqual(entry.chosenPathIds.length, 0, `act ${act} ${entry.heroId} should not have evolved`);
      }
    }
  }
});

test('difficulty: a scaled enemy spends its remaining level-ups on moves, never past MOVE_CAP', () => {
  const { run } = generateEncounter('elite', 21, heroes, {
    scaling: actScaling('skirmish', 5),
    progression: progressionTable,
  });
  for (const entry of run.roster) {
    assert.ok(entry.unlockedMoveIds.length <= MOVE_CAP, `${entry.heroId} has ${entry.unlockedMoveIds.length} moves`);
    assert.strictEqual(new Set(entry.unlockedMoveIds).size, entry.unlockedMoveIds.length);
    // Act 5 is level 10: starting moves plus level-ups always reach the cap.
    assert.strictEqual(entry.unlockedMoveIds.length, MOVE_CAP);
  }
});

test('difficulty: an unscaled encounter is byte-for-byte the authored content at level 1', () => {
  const { run } = generateEncounter('fight', 4, heroes, { scaling: NO_SCALING, progression: progressionTable });
  for (const entry of run.roster) {
    assert.strictEqual(entry.level, 1);
    assert.deepStrictEqual(entry.evolutionStatGrants, {});
    assert.deepStrictEqual(entry.chosenPathIds, []);
    assert.deepStrictEqual(entry.unlockedMoveIds, [...heroes[entry.heroId].moveIds]);
  }
});

test('difficulty: the Goblin Chief encounter takes the monsters curve, and its pool has no progression to cash a level in for', () => {
  const act5 = actScaling('monsters', 5);
  const { run } = generateLeaderEncounter(11, GOBLINS.basicIds, GOBLINS.leaderId, enemies, act5);
  for (const entry of run.roster) {
    assert.strictEqual(entry.level, act5.level);
    assert.strictEqual(statTotal(entry.evolutionStatGrants), act5.statSteps * ACT_STEP_STAT_TOTAL);
    assert.deepStrictEqual(entry.chosenPathIds, []);
    assert.deepStrictEqual(entry.unlockedMoveIds, [...enemies[entry.heroId].moveIds]);
  }

  // The row-0 opener is on the same track: untouched in Act 1.
  const { run: opener } = generateEncounter('fight', 7, basicEnemiesOf(GOBLINS), {
    heroCount: 2,
    scaling: actScaling('monsters', 1),
    progression: progressionTable,
  });
  for (const entry of opener.roster) {
    assert.deepStrictEqual(entry.evolutionStatGrants, {});
    assert.strictEqual(entry.level, 1);
  }
});

test('difficulty: scaling stays deterministic per seed', () => {
  const opts = { scaling: actScaling('skirmish', 4), progression: progressionTable } as const;
  const a = generateEncounter('elite', 77, heroes, opts);
  const b = generateEncounter('elite', 77, heroes, opts);
  assert.deepStrictEqual(a.run.roster, b.run.roster);
});

// --- Training Point income (act-scaled since 2026-09-05) ---

test('difficulty: Training Points scale with the act, and the finale still pays nothing', () => {
  // Act 1 is the authored base: 2 the opener, 3 Monsters, 4 Skirmish and Guardian.
  assert.strictEqual(trainingPointsFor('fight', 1), 2);
  assert.strictEqual(trainingPointsFor('battle', 1), 3);
  assert.strictEqual(trainingPointsFor('skirmish', 1), 4);
  assert.strictEqual(trainingPointsFor('boss', 1), 4);

  // Every act past the first adds ACT_XP_STEP to every payout.
  assert.strictEqual(trainingPointsFor('fight', 5), 2 + 4 * ACT_XP_STEP);
  assert.strictEqual(trainingPointsFor('skirmish', 5), 4 + 4 * ACT_XP_STEP);

  // The run ends on the finale, so it pays nothing in any act — the step must not lift it off zero.
  assert.strictEqual(trainingPointsFor('finale', 1), 0);
  assert.strictEqual(trainingPointsFor('finale', TOTAL_ACTS), 0);
});

test('difficulty: income is monotonic in the act and clamps below act 1', () => {
  let previous = 0;
  for (let act = 1; act <= TOTAL_ACTS; act++) {
    const paid = trainingPointsFor('skirmish', act);
    assert.ok(paid >= previous, `act ${act} pays less than act ${act - 1}`);
    previous = paid;
  }
  // A junk act must not refund points or divide by a negative step.
  assert.strictEqual(trainingPointsFor('skirmish', 0), trainingPointsFor('skirmish', 1));
  assert.strictEqual(trainingPointsFor('skirmish', -3), trainingPointsFor('skirmish', 1));
});

test('difficulty: the step is what puts the late-tier movepool inside a run', () => {
  // Reaching MOVE_TIER_LEVEL.late (7) costs 20 pooled points under the capped curve.
  // A five-act run's Skirmish/Guardian lane alone now clears that for more than one hero,
  // where flat income across five acts paid roughly 70 for the WHOLE roster.
  const flatRun = 5 * trainingPointsFor('skirmish', 1);
  const scaledRun = [1, 2, 3, 4, 5].reduce((sum, act) => sum + trainingPointsFor('skirmish', act), 0);
  assert.ok(scaledRun > flatRun * 1.5, `${scaledRun} is not a meaningful lift over ${flatRun}`);
});
