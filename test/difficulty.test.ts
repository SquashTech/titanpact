import * as assert from 'assert';
import { test } from './harness';
import {
  actScaling,
  ACT_STEP_STAT_TOTAL,
  BASELINE_ACT,
  ENEMY_LEVEL_BY_ACT,
  NO_SCALING,
} from '../src/run/difficulty';
import { generateEncounter, generateGoblinChiefEncounter } from '../src/run/enemyGen';
import { EVOLUTION_LEVEL, MOVE_CAP } from '../src/run/progression';
import { heroes } from '../src/data/heroes';
import { enemies, basicGoblins, BASIC_GOBLIN_IDS, GOBLIN_CHIEF_ID } from '../src/data/enemies';
import { progressionTable } from '../src/data/progression';
import { TOTAL_ACTS } from '../src/run/state';

function statTotal(grants: Partial<Record<string, number>>): number {
  return Object.values(grants).reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

test('difficulty: the skirmish track baselines at Act 1 and adds one step per act after', () => {
  assert.strictEqual(BASELINE_ACT.skirmish, 1);
  assert.strictEqual(actScaling('skirmish', 1).statSteps, 0);
  assert.strictEqual(actScaling('skirmish', 2).statSteps, 1);
  assert.strictEqual(actScaling('skirmish', 5).statSteps, 4);
});

test('difficulty: the monsters track baselines at Act 2 and never goes negative in Act 1', () => {
  assert.strictEqual(BASELINE_ACT.monsters, 2);
  assert.strictEqual(actScaling('monsters', 1).statSteps, 0);
  assert.strictEqual(actScaling('monsters', 2).statSteps, 0);
  assert.strictEqual(actScaling('monsters', 3).statSteps, 1);
  assert.strictEqual(actScaling('monsters', 5).statSteps, 3);
});

test('difficulty: enemy levels follow the authored act table and hold past its end', () => {
  assert.deepStrictEqual([...ENEMY_LEVEL_BY_ACT], [1, 3, 5, 7, 10]);
  for (let act = 1; act <= TOTAL_ACTS; act++) {
    assert.strictEqual(actScaling('skirmish', act).level, ENEMY_LEVEL_BY_ACT[act - 1]);
  }
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
      const hasEvolutionContent = (progressionTable.evolutions[entry.heroId] ?? []).length > 0;
      if (scaling.level >= EVOLUTION_LEVEL && hasEvolutionContent) {
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
  const { run } = generateGoblinChiefEncounter(11, BASIC_GOBLIN_IDS, GOBLIN_CHIEF_ID, enemies, act5);
  for (const entry of run.roster) {
    assert.strictEqual(entry.level, act5.level);
    assert.strictEqual(statTotal(entry.evolutionStatGrants), act5.statSteps * ACT_STEP_STAT_TOTAL);
    assert.deepStrictEqual(entry.chosenPathIds, []);
    assert.deepStrictEqual(entry.unlockedMoveIds, [...enemies[entry.heroId].moveIds]);
  }

  // The row-0 opener is on the same track: untouched in Act 1.
  const { run: opener } = generateEncounter('fight', 7, basicGoblins, {
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
