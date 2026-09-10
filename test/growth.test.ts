// Automatic levelling and growth grades (src/run/growth.ts, docs/growth-overhaul.md §3).
//
// Two budgets are enforced here, not one. The 550 stat rule says a hero's STARTING line is fairly
// costed; the grade budget says its GROWTH is. Neither is sufficient alone the moment growth
// exists, because a low base with S-grades outruns a high base with F-grades however the 550 is
// spent — so the grade check sits beside the 550 check in test/roster.test.ts, deliberately.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import {
  DEFAULT_GRADES,
  GRADE_BUDGET,
  GRADE_CHANCE,
  GRADE_COST,
  GROWTH_STATS,
  GROWTH_STEP,
  GROWTH_STEP_HP,
  LEVEL_AFTER_ENCOUNTER,
  MAX_LEVEL,
  gradeBudgetOf,
  gradesFor,
  grantEncounterLevels,
  levelAfterEncounters,
  levelUpEntry,
  levelsForEncounter,
  rollLevelGrowth,
} from '../src/run/growth';
import { EVOLUTION_LEVEL } from '../src/run/progression';
import { STAT_ORDER, type StatKey } from '../src/engine/content';

/** Every roll succeeds / every roll fails — the two ends, so a grant's SIZE is testable apart from its odds. */
const ALWAYS = () => 0;
const NEVER = () => 0.999999;

function soloRun(heroId = 'cinderKnight') {
  return addRosterEntry(createRunState(0), createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
}

test('growth: the grade table is the authored one, and cost rises with chance', () => {
  assert.deepStrictEqual(GRADE_CHANCE, { S: 0.95, A: 0.8, B: 0.65, C: 0.5, D: 0.35, E: 0.2, F: 0.05 });
  assert.deepStrictEqual(GRADE_COST, { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 });

  const grades = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
  for (let i = 1; i < grades.length; i++) {
    assert.ok(GRADE_CHANCE[grades[i]] > GRADE_CHANCE[grades[i - 1]], `${grades[i]} must beat ${grades[i - 1]}`);
    assert.ok(GRADE_COST[grades[i]] > GRADE_COST[grades[i - 1]], `${grades[i]} must cost more than ${grades[i - 1]}`);
  }
});

test('growth: grades cover the seven stats the 550 budget covers — MP Regen excluded', () => {
  assert.deepStrictEqual(
    [...GROWTH_STATS].sort(),
    STAT_ORDER.filter((stat) => stat !== 'mpRegen').sort(),
    'the grade stats and the budget stats must be the same seven'
  );
  assert.ok(
    !(GROWTH_STATS as readonly StatKey[]).includes('mpRegen'),
    'MP Regen sits outside the budget and outside growth'
  );
});

test('growth: the all-B fallback is exactly on budget, so an un-authored hero is not free', () => {
  assert.strictEqual(gradeBudgetOf(DEFAULT_GRADES), GRADE_BUDGET);
  assert.strictEqual(GRADE_BUDGET, GROWTH_STATS.length * GRADE_COST.B, 'the budget IS seven stats at B');
});

// The per-hero budget check lives in roster.test.ts, beside the 550 it is the second half of.

test('growth: a success grants +2, or +6 HP, and a failure grants nothing', () => {
  const all = rollLevelGrowth(DEFAULT_GRADES, ALWAYS);
  assert.strictEqual(Object.keys(all).length, GROWTH_STATS.length, 'every stat rolled and every roll landed');
  assert.strictEqual(all.hp, GROWTH_STEP_HP);
  for (const stat of GROWTH_STATS) {
    if (stat === 'hp') continue;
    assert.strictEqual(all[stat], GROWTH_STEP, `${stat} should gain the flat step`);
  }
  assert.deepStrictEqual(rollLevelGrowth(DEFAULT_GRADES, NEVER), {}, 'nothing lands when nothing succeeds');
});

test('growth: an F stat is nearly never granted and an S stat nearly always is', () => {
  // Sampled against the table rather than mocked: this is the one place the odds themselves are
  // the thing under test, so it runs the real roll with a deterministic sweep.
  const sweep = (i: number) => (i % 100) / 100;
  let f = 0;
  let s = 0;
  for (let i = 0; i < 100; i++) {
    if (sweep(i) < GRADE_CHANCE.F) f++;
    if (sweep(i) < GRADE_CHANCE.S) s++;
  }
  assert.strictEqual(f, 5);
  assert.strictEqual(s, 95);
});

test('growth: levelling accumulates onto growthStatGrants and stops at MAX_LEVEL', () => {
  const entry = soloRun().roster[0];
  const one = levelUpEntry(entry, heroes.cinderKnight, 1, ALWAYS);
  assert.strictEqual(one.entry.level, 2);
  assert.strictEqual(one.entry.growthStatGrants.hp, GROWTH_STEP_HP);

  const three = levelUpEntry(one.entry, heroes.cinderKnight, 3, ALWAYS);
  assert.strictEqual(three.entry.level, 5);
  assert.strictEqual(three.entry.growthStatGrants.hp, GROWTH_STEP_HP * 4, 'four levels of HP, accumulated');
  assert.strictEqual(three.gained.hp, GROWTH_STEP_HP * 3, 'and `gained` is only what THIS call rolled');

  const past = levelUpEntry({ ...entry, level: MAX_LEVEL - 1 }, heroes.cinderKnight, 10, ALWAYS);
  assert.strictEqual(past.entry.level, MAX_LEVEL, 'the cap holds');
  assert.strictEqual(past.entry.growthStatGrants.hp, GROWTH_STEP_HP, 'and only the one legal level rolled');

  const capped = levelUpEntry({ ...entry, level: MAX_LEVEL }, heroes.cinderKnight, 5, ALWAYS);
  assert.deepStrictEqual(capped.gained, {}, 'a hero at the cap gains nothing at all');
});

test('growth: the curve hits the authored act-end levels, and reaches MAX_LEVEL on the finale', () => {
  // Four encounters an act for acts 1-5, then the finale (docs/growth-overhaul.md §3).
  // FRONT-LOADED 2026-09-10 (phase 6) from 6/12/18/23/28: acts 1-2 measured as the run's wall
  // and their enemy stat steps were already zero, so the only lever left was the player's own
  // curve. Enemy levels are derived from this table, so they moved with it — but their rank and
  // Evolution thresholds are absolute, so the lift lands on the player alone.
  assert.deepStrictEqual(
    [4, 8, 12, 16, 20, 21].map(levelAfterEncounters),
    [8, 14, 19, 24, 28, 30],
    'the act-end figures are the decided shape'
  );
  assert.strictEqual(levelAfterEncounters(0), 1, 'a run starts at 1');
  assert.strictEqual(levelAfterEncounters(999), MAX_LEVEL, 'and holds at the cap past the table');
  assert.strictEqual(LEVEL_AFTER_ENCOUNTER[LEVEL_AFTER_ENCOUNTER.length - 1], MAX_LEVEL);
});

test('growth: the curve never goes backwards, and level 5 lands inside act 1', () => {
  for (let n = 1; n < LEVEL_AFTER_ENCOUNTER.length; n++) {
    assert.ok(levelsForEncounter(n) >= 0, `encounter ${n} pays a negative level`);
  }
  // The curve still DECELERATES: a run's early acts pay more levels than its late ones.
  const perAct = [1, 2, 3, 4, 5].map(
    (act) => levelAfterEncounters(act * 4) - levelAfterEncounters((act - 1) * 4)
  );
  for (let i = 1; i < perAct.length; i++) {
    assert.ok(perAct[i] <= perAct[i - 1], `act ${i + 1} pays ${perAct[i]} levels against act ${i}'s ${perAct[i - 1]}`);
  }
  assert.ok(perAct[0] > perAct[perAct.length - 1], 'the first act must pay more than the last');
});

test('growth: a won encounter levels the WHOLE roster, benched heroes included', () => {
  let run = soloRun();
  run = addRosterEntry(run, createRosterEntry('crimson', 'crimson', heroes.crimson.moveIds));
  run = { ...run, encountersWon: 1 };

  const after = grantEncounterLevels(run, heroes, ALWAYS);
  const expected = levelAfterEncounters(1);
  assert.deepStrictEqual(
    after.roster.map((e) => e.level),
    [expected, expected],
    'both heroes level, and neither had to be fielded'
  );
});

test('growth: a hero that joins late stays behind — the grant is a DELTA, never a target', () => {
  // What keeps "arrives underlevelled" a real archetype for a Guild Hall hire rather than a
  // rounding error that the next win erases (docs/growth-overhaul.md §6).
  let run = soloRun();
  for (let n = 1; n <= 4; n++) run = grantEncounterLevels({ ...run, encountersWon: n }, heroes, ALWAYS);
  const veteran = run.roster[0].level;
  assert.strictEqual(veteran, levelAfterEncounters(4));

  run = addRosterEntry(run, createRosterEntry('crimson', 'crimson', heroes.crimson.moveIds));
  run = grantEncounterLevels({ ...run, encountersWon: 5 }, heroes, ALWAYS);

  const [vet, recruit] = run.roster;
  assert.strictEqual(vet.level, levelAfterEncounters(5));
  assert.strictEqual(recruit.level, 1 + levelsForEncounter(5), 'the recruit got THIS win only');
  assert.ok(recruit.level < vet.level, 'and is still behind, permanently');
});

test('growth: an all-B hero grows by roughly half again over a full climb', () => {
  // The figure §3 sizes the whole system on: ~4.5 successes a level, ~9 BUDGET points a level,
  // ~264 over 29 levels. Budget points, not raw stat numbers — a success is worth 2 whatever it
  // lands on, which is the whole reason HP grants 6 and everything else 2 (CLAUDE.md's measured
  // HP break-even is ≈0.33 a point). Read off the table's own odds, not sampled.
  const successesPerLevel = GROWTH_STATS.reduce((sum, stat) => sum + GRADE_CHANCE[DEFAULT_GRADES[stat]], 0);
  assert.ok(successesPerLevel > 4.4 && successesPerLevel < 4.7, `${successesPerLevel} successes a level, expected ~4.5`);

  const pointsOverClimb = successesPerLevel * GROWTH_STEP * (MAX_LEVEL - 1);
  assert.ok(
    pointsOverClimb > 230 && pointsOverClimb < 300,
    `an all-B climb grants ${pointsOverClimb.toFixed(0)} budget points, expected ~264`
  );
  assert.ok(pointsOverClimb > 90, 'below ~90 the whole arc is invisible and the underwhelm returns');

  // And in raw numbers, which is what a stat line actually shows: HP triples the step it lands on.
  const rawOverClimb =
    GROWTH_STATS.reduce((sum, stat) => sum + GRADE_CHANCE[DEFAULT_GRADES[stat]] * (stat === 'hp' ? GROWTH_STEP_HP : GROWTH_STEP), 0) *
    (MAX_LEVEL - 1);
  assert.ok(rawOverClimb > pointsOverClimb, 'HP grants 3x the raw number for the same budget worth');
});
