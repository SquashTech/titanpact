import * as assert from 'assert';
import { test } from './harness';
import { ENCOUNTERS_PER_ACT, levelAfterEncounters } from '../src/run/growth';
import {
  actScaling,
  ACT_STEP_CURVE,
  ACT_STEP_STAT_TOTAL,
  BASELINE_ACT,
  ENEMY_LEVEL_BY_ACT,
  ENEMY_LEVEL_LAG,
  NO_SCALING,
  ACT_ONE_ELITE_HERO_COUNT,
  encounterHeroCountOverride,
} from '../src/run/difficulty';
import { generateEncounter, generateLeaderEncounter } from '../src/run/enemyGen';
import { EVOLUTION_LEVEL, MOVE_CAP } from '../src/run/progression';
import { heroes } from '../src/data/heroes';
import { enemies, factions, basicEnemiesOf } from '../src/data/enemies';

const GOBLINS = factions.goblins;
import { progressionTable } from '../src/data/progression';
import { SEAL_ACTS, TOTAL_ACTS } from '../src/run/state';
import { grantBudgetTotal } from '../src/run/statBudget';
import type { StatKey } from '../src/engine/content';

function statTotal(grants: Partial<Record<string, number>>): number {
  return grantBudgetTotal(grants as Partial<Record<StatKey, number>>);
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
  // Never DECREASES; a repeat is legal, and index 1 is deliberately a repeat of 0 — Act 2 is
  // where the run meets a real faction for the first time after Act 1's soft Goblins, and it
  // measured as the run's wall for as long as it carried a step (2026-09-10, phase 6).
  for (let i = 1; i < ACT_STEP_CURVE.length; i++) {
    assert.ok(ACT_STEP_CURVE[i] >= ACT_STEP_CURVE[i - 1], `step ${i} goes backwards`);
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

test('difficulty: enemy levels TRACK the player curve at a fixed lag, and hold past the table', () => {
  // Derived from LEVEL_AFTER_ENCOUNTER since 2026-09-10 (Growth Overhaul phase 6) rather than
  // authored beside it. The old [1, 3, 5, 7, 10] was fitted to a 10-level cap and left an Act 5
  // enemy at 10 against a roster at 28.
  for (let act = 1; act <= SEAL_ACTS; act++) {
    const playerAtActEnd = levelAfterEncounters(act * ENCOUNTERS_PER_ACT);
    assert.strictEqual(
      ENEMY_LEVEL_BY_ACT[act - 1],
      Math.max(1, playerAtActEnd - ENEMY_LEVEL_LAG),
      `act ${act}: the enemy table must read off the player curve, not a table beside it`
    );
    assert.strictEqual(actScaling('skirmish', act).level, ENEMY_LEVEL_BY_ACT[act - 1]);
    // The player runs AHEAD all run — that is what keeps the fights winnable while the enemy tracks.
    assert.ok(ENEMY_LEVEL_BY_ACT[act - 1] < playerAtActEnd, `act ${act}: an enemy must not out-level the roster`);
  }
  // The table covers the five seal acts; the finale act reuses its last entry.
  const last = ENEMY_LEVEL_BY_ACT[ENEMY_LEVEL_BY_ACT.length - 1];
  assert.strictEqual(actScaling('skirmish', TOTAL_ACTS).level, last);
  // A TOTAL_ACTS bump must not produce an undefined level, nor may a nonsense act number.
  assert.strictEqual(actScaling('skirmish', TOTAL_ACTS + 3).level, last);
  assert.strictEqual(actScaling('skirmish', 0).level, ENEMY_LEVEL_BY_ACT[0]);
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

test('difficulty: scaled enemies arrive at the act level, and evolve on the CRUCIBLE schedule', () => {
  // Not `EVOLUTION_LEVEL` (2026-09-10, phase 6): the player's Evolutions come one an act from the
  // Crucible, so a roster is 1-of-4 evolved entering Act 2 and 2-of-4 entering Act 3. Gating
  // enemies on 5 evolved every one of them from Act 2 and made that act's Guardian the run's only
  // remaining spike. `ENEMY_EVOLUTION_LEVEL` is Act 3's enemy level instead.
  for (const act of [1, 2, 3, 4, 5]) {
    const scaling = actScaling('skirmish', act);
    const { run } = generateEncounter('elite', 12, heroes, { scaling, progression: progressionTable });
    const evolved = act >= 3;
    for (const entry of run.roster) {
      assert.strictEqual(entry.level, scaling.level, `act ${act} level`);
      assert.strictEqual(
        entry.chosenPathIds.length,
        evolved ? 1 : 0,
        `act ${act} ${entry.heroId} should ${evolved ? '' : 'not '}have evolved`
      );
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

  // The row-0 opener is on the same track: unSCALED in Act 1, though no longer level 1 —
  // enemy level tracks the player curve now, and the two axes are independent.
  const { run: opener } = generateEncounter('fight', 7, basicEnemiesOf(GOBLINS), {
    heroCount: 2,
    scaling: actScaling('monsters', 1),
    progression: progressionTable,
  });
  for (const entry of opener.roster) {
    assert.deepStrictEqual(entry.evolutionStatGrants, {}, 'act 1 monsters take no stat steps');
    assert.strictEqual(entry.level, ENEMY_LEVEL_BY_ACT[0]);
  }
});

test('difficulty: scaling stays deterministic per seed', () => {
  const opts = { scaling: actScaling('skirmish', 4), progression: progressionTable } as const;
  const a = generateEncounter('elite', 77, heroes, opts);
  const b = generateEncounter('elite', 77, heroes, opts);
  assert.deepStrictEqual(a.run.roster, b.run.roster);
});

test('difficulty: Act 1 never fields more bodies than the player holds', () => {
  // The player's roster ramps 2 -> 3 -> 4 across Act 1 while the encounter size never did. That
  // was patched for the Elite alone with a hand-tuned 3; the rule replaces the constant, and
  // reproduces it exactly at the roster size that node is actually met with.
  assert.strictEqual(encounterHeroCountOverride('elite', 1, ACT_ONE_ELITE_HERO_COUNT, 4), ACT_ONE_ELITE_HERO_COUNT);

  // The Skirmish is the node this fixes: it is met with TWO heroes and fielded four.
  assert.strictEqual(encounterHeroCountOverride('skirmish', 1, 2, 4), 2);

  // A full roster takes the standard count — the cap only ever shrinks a fight.
  for (const nodeType of ['skirmish', 'elite', 'battle']) {
    assert.strictEqual(encounterHeroCountOverride(nodeType, 1, 4, 4), undefined, `${nodeType} at a full roster`);
    assert.strictEqual(encounterHeroCountOverride(nodeType, 1, 6, 4), undefined, `${nodeType} above the standard count`);
  }

  // Acts 2+ are untouched: the roster is full by then, and being outnumbered is the Elite's job.
  for (const act of [2, 3, 4, 5, 6]) {
    assert.strictEqual(encounterHeroCountOverride('elite', act, 2, 4), undefined, `act ${act} must not be resized`);
  }

  // An empty roster is a fixture, not a fight — it must not produce a zero-body encounter.
  assert.strictEqual(encounterHeroCountOverride('skirmish', 1, 0, 4), undefined);
});
