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
  GRADE_ROLL,
  GROWTH_STATS,
  GROWTH_UNIT,
  GROWTH_UNIT_HP,
  LEVEL_AFTER_ENCOUNTER,
  MAX_LEVEL,
  applyEncounterLevels,
  gradeBudgetOf,
  gradeExpectedPoints,
  gradeMaxPoints,
  gradesFor,
  grantEncounterLevels,
  levelAfterEncounters,
  levelUpEntry,
  levelsForEncounter,
  rollGradePoints,
  rollLevelGrowth,
  type GrowthGrade,
} from '../src/run/growth';
import { EVOLUTION_LEVEL } from '../src/run/progression';
import { STAT_ORDER, type StatKey } from '../src/engine/content';

const GRADES: readonly GrowthGrade[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];

/**
 * Every roll lands its grade's TOP / every roll misses — the two ends, so a grant's size is
 * testable apart from its odds. A draw of 0.999999 sits in the last bucket of every row.
 */
const ALWAYS = () => 0.999999;
const NEVER = () => 0;

function soloRun(heroId = 'cinderKnight') {
  return addRosterEntry(createRunState(0), createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
}

test('growth: the grade table is the authored one, and cost rises with chance', () => {
  assert.deepStrictEqual(GRADE_CHANCE, { S: 0.9, A: 0.82, B: 0.7, C: 0.6, D: 0.48, E: 0.32, F: 0.08 });
  assert.deepStrictEqual(GRADE_COST, { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 });

  for (let i = 1; i < GRADES.length; i++) {
    assert.ok(GRADE_CHANCE[GRADES[i]] > GRADE_CHANCE[GRADES[i - 1]], `${GRADES[i]} must beat ${GRADES[i - 1]}`);
    assert.ok(GRADE_COST[GRADES[i]] > GRADE_COST[GRADES[i - 1]], `${GRADES[i]} must cost more than ${GRADES[i - 1]}`);
    assert.ok(gradeMaxPoints(GRADES[i]) >= gradeMaxPoints(GRADES[i - 1]), `${GRADES[i]} must reach at least as far as ${GRADES[i - 1]}`);
  }
});

test('growth: every grade row is a distribution whose mean is exactly linear in its cost', () => {
  // The whole reason the roll can carry variance without breaking the grade budget: a row's mean
  // is what the flat +2 paid (0.1 + 0.3 x cost), so an on-budget line still buys every hero the
  // same growth and the difficulty curve fitted against the flat roll still holds.
  for (const grade of GRADES) {
    const row = GRADE_ROLL[grade];
    assert.strictEqual(row.reduce((a, b) => a + b, 0), 100, `${grade}'s odds must sum to 100`);
    assert.ok(row.every((w) => w >= 0), `${grade} carries a negative weight`);
    assert.ok(row[row.length - 1] > 0, `${grade}'s top bucket must be reachable, or its max is a lie`);
    const mean = Math.round(gradeExpectedPoints(grade) * 100) / 100;
    assert.strictEqual(mean, Math.round((0.1 + 0.3 * GRADE_COST[grade]) * 100) / 100, `${grade} pays ${mean} points a level`);
  }
  assert.strictEqual(gradeMaxPoints('S'), 4, 'an S can jump +4 (+12 HP) in one level');
  assert.strictEqual(gradeMaxPoints('F'), 2, 'an F never passes +2');
});

test('growth: a draw walks the row in order, so the ends of the die are the ends of the row', () => {
  assert.strictEqual(rollGradePoints('S', NEVER), 0);
  assert.strictEqual(rollGradePoints('S', ALWAYS), 4);
  assert.strictEqual(rollGradePoints('F', ALWAYS), 2);
  // Just past S's 10% miss band lands the +1 bucket; just past that, the +2 one.
  assert.strictEqual(rollGradePoints('S', () => 0.1), 1);
  assert.strictEqual(rollGradePoints('S', () => 0.34), 2);
  // Sampled: the sweep reproduces the authored odds exactly, since each 1% step is one bucket.
  for (const grade of GRADES) {
    const counts = [0, 0, 0, 0, 0];
    for (let i = 0; i < 100; i++) counts[rollGradePoints(grade, () => i / 100)]++;
    assert.deepStrictEqual(counts.slice(0, GRADE_ROLL[grade].length), [...GRADE_ROLL[grade]], `${grade}'s sweep`);
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

test('growth: a point is +1, or +3 HP, and a miss grants nothing', () => {
  const all = rollLevelGrowth(DEFAULT_GRADES, ALWAYS);
  assert.strictEqual(Object.keys(all).length, GROWTH_STATS.length, 'every stat rolled and every roll landed');
  const top = gradeMaxPoints('B');
  assert.strictEqual(all.hp, top * GROWTH_UNIT_HP);
  for (const stat of GROWTH_STATS) {
    if (stat === 'hp') continue;
    assert.strictEqual(all[stat], top * GROWTH_UNIT, `${stat} should gain its grade's top`);
  }
  assert.deepStrictEqual(rollLevelGrowth(DEFAULT_GRADES, NEVER), {}, 'nothing lands when nothing succeeds');
});

test('growth: an F stat is nearly never granted and an S stat nearly always is', () => {
  // Sampled against the table rather than mocked: this is the one place the odds themselves are
  // the thing under test, so it runs the real roll with a deterministic sweep.
  let f = 0;
  let s = 0;
  for (let i = 0; i < 100; i++) {
    if (rollGradePoints('F', () => i / 100) > 0) f++;
    if (rollGradePoints('S', () => i / 100) > 0) s++;
  }
  assert.strictEqual(f, Math.round(GRADE_CHANCE.F * 100));
  assert.strictEqual(s, Math.round(GRADE_CHANCE.S * 100));
  assert.ok(f <= 10 && s >= 90);
});

test('growth: levelling accumulates onto growthStatGrants and stops at MAX_LEVEL', () => {
  const entry = soloRun().roster[0];
  const topHp = gradeMaxPoints(gradesFor(heroes.cinderKnight).hp) * GROWTH_UNIT_HP;
  const one = levelUpEntry(entry, heroes.cinderKnight, 1, ALWAYS);
  assert.strictEqual(one.entry.level, 2);
  assert.strictEqual(one.entry.growthStatGrants.hp, topHp);

  const three = levelUpEntry(one.entry, heroes.cinderKnight, 3, ALWAYS);
  assert.strictEqual(three.entry.level, 5);
  assert.strictEqual(three.entry.growthStatGrants.hp, topHp * 4, 'four levels of HP, accumulated');
  assert.strictEqual(three.gained.hp, topHp * 3, 'and `gained` is only what THIS call rolled');

  const past = levelUpEntry({ ...entry, level: MAX_LEVEL - 1 }, heroes.cinderKnight, 10, ALWAYS);
  assert.strictEqual(past.entry.level, MAX_LEVEL, 'the cap holds');
  assert.strictEqual(past.entry.growthStatGrants.hp, topHp, 'and only the one legal level rolled');

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

test('growth: the report says what each hero actually rolled, and matches the roster it produced', () => {
  // The post-battle screen's whole source (view/run/LevelUpScreen.tsx). The roll is destructive —
  // a grade is a coin, not a schedule — so a report that drifts from the roster it produced would
  // show the player numbers that never landed, and nothing downstream could catch it.
  let run = soloRun();
  run = addRosterEntry(run, createRosterEntry('crimson', 'crimson', heroes.crimson.moveIds));
  run = { ...run, encountersWon: 1 };

  const { run: after, report } = applyEncounterLevels(run, heroes, ALWAYS);
  assert.strictEqual(report.length, after.roster.length, 'one line per roster hero, benched included');

  for (const line of report) {
    const before = run.roster.find((e) => e.rosterId === line.rosterId)!;
    const entry = after.roster.find((e) => e.rosterId === line.rosterId)!;
    assert.strictEqual(line.fromLevel, before.level);
    assert.strictEqual(line.toLevel, entry.level);
    for (const stat of GROWTH_STATS) {
      const delta = (entry.growthStatGrants[stat] ?? 0) - (before.growthStatGrants[stat] ?? 0);
      assert.strictEqual(line.gained[stat] ?? 0, delta, `${line.heroId}'s reported ${stat} is what it actually banked`);
    }
  }
});

test('growth: a hero at the cap is still reported, gaining nothing', () => {
  // The screen lists the whole roster; a row quietly missing reads as a bug rather than as a cap.
  let run = soloRun();
  run = { ...run, encountersWon: 1, roster: run.roster.map((e) => ({ ...e, level: MAX_LEVEL })) };

  const { report } = applyEncounterLevels(run, heroes, ALWAYS);
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].fromLevel, MAX_LEVEL);
  assert.strictEqual(report[0].toLevel, MAX_LEVEL);
  assert.deepStrictEqual(report[0].gained, {}, 'nothing rolled, even with every roll succeeding');
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
  // The figure §3 sizes the whole system on: ~9 BUDGET points a level, ~264 over 29 levels.
  // Budget points, not raw stat numbers — a point is worth 1 whatever it lands on, which is the
  // whole reason HP grants 3 a point and everything else 1 (CLAUDE.md's measured HP break-even
  // is ≈0.33 a point). Read off the table's own odds, not sampled.
  const pointsPerLevel = GROWTH_STATS.reduce((sum, stat) => sum + gradeExpectedPoints(DEFAULT_GRADES[stat]), 0);
  assert.ok(pointsPerLevel > 9.0 && pointsPerLevel < 9.2, `${pointsPerLevel} points a level, expected ~9.1`);

  const pointsOverClimb = pointsPerLevel * (MAX_LEVEL - 1);
  assert.ok(
    pointsOverClimb > 230 && pointsOverClimb < 300,
    `an all-B climb grants ${pointsOverClimb.toFixed(0)} budget points, expected ~264`
  );
  assert.ok(pointsOverClimb > 90, 'below ~90 the whole arc is invisible and the underwhelm returns');

  // And in raw numbers, which is what a stat line actually shows: HP triples the point it lands on.
  const rawOverClimb =
    GROWTH_STATS.reduce(
      (sum, stat) => sum + gradeExpectedPoints(DEFAULT_GRADES[stat]) * (stat === 'hp' ? GROWTH_UNIT_HP : GROWTH_UNIT),
      0
    ) *
    (MAX_LEVEL - 1);
  assert.ok(rawOverClimb > pointsOverClimb, 'HP grants 3x the raw number for the same budget worth');
});
