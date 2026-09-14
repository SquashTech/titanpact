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
  GROWTH_UNIT_MANA,
  ENCOUNTER_XP_BY_ACT,
  GUARDIAN_XP_MULTIPLIER,
  LEVEL_AFTER_ENCOUNTER,
  MAX_LEVEL,
  MAX_XP,
  TOTAL_ENCOUNTERS,
  applyEncounterLevels,
  gradeBudgetOf,
  gradeExpectedPoints,
  gradeMaxPoints,
  gradesFor,
  grantEncounterLevels,
  grantXp,
  levelAfterEncounters,
  levelForXp,
  levelOf,
  levelUpEntry,
  rollGradePoints,
  rollLevelGrowth,
  xpAfterEncounters,
  xpForEncounter,
  xpForLevel,
  xpProgress,
  xpToNextLevel,
  type GrowthGrade,
} from '../src/run/growth';
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

test('growth: a point is +1, or +3 HP, or +2 Mana, and a miss grants nothing', () => {
  const all = rollLevelGrowth(DEFAULT_GRADES, ALWAYS);
  assert.strictEqual(Object.keys(all).length, GROWTH_STATS.length, 'every stat rolled and every roll landed');
  const top = gradeMaxPoints('B');
  assert.strictEqual(all.hp, top * GROWTH_UNIT_HP);
  assert.strictEqual(all.manaPool, top * GROWTH_UNIT_MANA, 'mana grows 2 a point — a Late move is priced in it');
  for (const stat of GROWTH_STATS) {
    if (stat === 'hp' || stat === 'manaPool') continue;
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
  assert.strictEqual(levelOf(one.entry), 2);
  assert.strictEqual(one.entry.growthStatGrants.hp, topHp);

  const three = levelUpEntry(one.entry, heroes.cinderKnight, 3, ALWAYS);
  assert.strictEqual(levelOf(three.entry), 5);
  assert.strictEqual(three.entry.growthStatGrants.hp, topHp * 4, 'four levels of HP, accumulated');
  assert.strictEqual(three.gained.hp, topHp * 3, 'and `gained` is only what THIS call rolled');

  const past = levelUpEntry({ ...entry, xp: xpForLevel(MAX_LEVEL - 1) }, heroes.cinderKnight, 10, ALWAYS);
  assert.strictEqual(levelOf(past.entry), MAX_LEVEL, 'the cap holds');
  assert.strictEqual(past.entry.xp, MAX_XP, 'and XP stops at the bar');
  assert.strictEqual(past.entry.growthStatGrants.hp, topHp, 'and only the one legal level rolled');

  const capped = levelUpEntry({ ...entry, xp: MAX_XP }, heroes.cinderKnight, 5, ALWAYS);
  assert.deepStrictEqual(capped.gained, {}, 'a hero at the cap gains nothing at all');
});

test('growth: the curve hits the decided act-end levels, and reaches MAX_LEVEL on the finale', () => {
  // Four encounters an act for acts 1-5, then the finale (docs/growth-overhaul.md §3).
  // FRONT-LOADED 2026-09-10 (phase 6) from 6/12/18/23/28: acts 1-2 measured as the run's wall
  // and their enemy stat steps were already zero, so the only lever left was the player's own
  // curve. Enemy levels are derived from par, so they moved with it — but their rank and
  // Evolution thresholds are absolute, so the lift lands on the player alone. Par is DERIVED from
  // the authored XP table now (ENCOUNTER_XP_BY_ACT); the act-end figures are what it is sized to.
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
    assert.ok(xpForEncounter(n) >= 0, `encounter ${n} pays negative XP`);
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
    after.roster.map(levelOf),
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
    assert.strictEqual(line.fromLevel, levelOf(before));
    assert.strictEqual(line.toLevel, levelOf(entry));
    for (const stat of GROWTH_STATS) {
      const delta = (entry.growthStatGrants[stat] ?? 0) - (before.growthStatGrants[stat] ?? 0);
      assert.strictEqual(line.gained[stat] ?? 0, delta, `${line.heroId}'s reported ${stat} is what it actually banked`);
    }
  }
});

test('growth: a hero at the cap is still reported, gaining nothing', () => {
  // The screen lists the whole roster; a row quietly missing reads as a bug rather than as a cap.
  let run = soloRun();
  run = { ...run, encountersWon: 1, roster: run.roster.map((e) => ({ ...e, xp: MAX_XP })) };

  const { report } = applyEncounterLevels(run, heroes, ALWAYS);
  assert.strictEqual(report.length, 1);
  assert.strictEqual(report[0].fromLevel, MAX_LEVEL);
  assert.strictEqual(report[0].toLevel, MAX_LEVEL);
  assert.deepStrictEqual(report[0].gained, {}, 'nothing rolled, even with every roll succeeding');
});

test('growth: XP is the cube of the level, and level is read back off it exactly', () => {
  // Pokémon's Medium Fast (docs/xp-overhaul.md §2). Every level is a cube, so a hero at par sits
  // exactly on one and the inversion has no rounding to get wrong.
  assert.strictEqual(xpForLevel(1), 1);
  assert.strictEqual(xpForLevel(2), 8);
  assert.strictEqual(xpForLevel(MAX_LEVEL), 27000);
  assert.strictEqual(MAX_XP, xpForLevel(MAX_LEVEL));
  for (let level = 1; level <= MAX_LEVEL; level++) {
    assert.strictEqual(levelForXp(xpForLevel(level)), level, `level ${level} round-trips`);
    assert.strictEqual(levelForXp(xpForLevel(level) - 1), Math.max(1, level - 1), `one XP short of ${level} is the level below`);
  }
  assert.strictEqual(levelForXp(0), 1, 'nothing is level 1');
  assert.strictEqual(levelForXp(MAX_XP * 10), MAX_LEVEL, 'and the cap holds past the bar');
  assert.strictEqual(levelOf(soloRun().roster[0]), 1, 'a fresh entry is level 1');
});

test('growth: encounter XP is AUTHORED by act, the Guardian pays double, and par is read off the sum', () => {
  // 2026-09-13, per user direction: the number a fight pays is the authored object and par is
  // whatever the cube makes of it — the reverse of the phase-1 build, where XP was sized to land
  // a hero at par exactly ON a level, so the bar filled to the top every fight and read as nothing.
  assert.strictEqual(ENCOUNTER_XP_BY_ACT.length, 6, 'five acts and the finale');
  assert.strictEqual(TOTAL_ENCOUNTERS, 21);
  for (let act = 0; act < 5; act++) {
    const first = act * 4 + 1;
    for (let n = first; n < first + 3; n++) assert.strictEqual(xpForEncounter(n), ENCOUNTER_XP_BY_ACT[act], `encounter ${n} pays act ${act + 1}'s figure`);
    assert.strictEqual(xpForEncounter(first + 3), ENCOUNTER_XP_BY_ACT[act] * GUARDIAN_XP_MULTIPLIER, `act ${act + 1}'s Guardian pays double`);
  }
  assert.strictEqual(xpForEncounter(TOTAL_ENCOUNTERS), ENCOUNTER_XP_BY_ACT[5], 'the finale is one fight, not a Guardian');
  assert.strictEqual(xpForEncounter(0), 0);
  assert.strictEqual(xpForEncounter(999), 0, 'nothing past the finale');
  for (let act = 1; act < ENCOUNTER_XP_BY_ACT.length; act++) {
    assert.ok(ENCOUNTER_XP_BY_ACT[act] > ENCOUNTER_XP_BY_ACT[act - 1], 'a later act pays more a fight: the cube gets steeper');
  }

  assert.strictEqual(xpAfterEncounters(0), xpForLevel(1));
  assert.strictEqual(xpAfterEncounters(TOTAL_ENCOUNTERS), MAX_XP, 'the whole table reaches the bar');
  assert.strictEqual(LEVEL_AFTER_ENCOUNTER.length, TOTAL_ENCOUNTERS + 1);
  for (let n = 1; n <= TOTAL_ENCOUNTERS; n++) {
    assert.ok(levelAfterEncounters(n) >= levelAfterEncounters(n - 1), 'par never goes backwards');
  }
  // The point of the change: a hero at par is NOT always sitting on a level.
  const partWay = Array.from({ length: TOTAL_ENCOUNTERS }, (_, i) => xpAfterEncounters(i + 1)).filter((xp) => xp < MAX_XP && xp !== xpForLevel(levelForXp(xp)));
  assert.ok(partWay.length >= TOTAL_ENCOUNTERS / 2, `only ${partWay.length} of ${TOTAL_ENCOUNTERS} encounters leave the bar part-way`);

  // Through the real grant, not just the arithmetic: a solo roster at par after every win.
  let run = soloRun();
  for (let n = 1; n <= TOTAL_ENCOUNTERS; n++) {
    run = grantEncounterLevels({ ...run, encountersWon: n }, heroes, NEVER);
    assert.strictEqual(run.roster[0].xp, xpAfterEncounters(n), `holding par's XP after encounter ${n}`);
    assert.strictEqual(levelOf(run.roster[0]), levelAfterEncounters(n), `at par after encounter ${n}`);
  }
});

test('growth: the bar reads how far into a level the XP sits, and what the next level still costs', () => {
  assert.strictEqual(xpProgress(xpForLevel(1)), 0);
  assert.strictEqual(xpProgress(xpForLevel(4)), 0, 'exactly on a level is an empty bar');
  assert.strictEqual(xpToNextLevel(xpForLevel(4)), xpForLevel(5) - xpForLevel(4));
  const half = xpForLevel(4) + (xpForLevel(5) - xpForLevel(4)) / 2;
  assert.ok(Math.abs(xpProgress(half) - 0.5) < 1e-9);
  assert.strictEqual(xpToNextLevel(xpForLevel(5) - 1), 1);
  assert.strictEqual(xpProgress(MAX_XP), 1, 'a full bar at the cap');
  assert.strictEqual(xpToNextLevel(MAX_XP), 0, 'and nothing owed');

  // The report carries both ends of the bar, so the screen never re-derives them off a roster the roll has already moved.
  const run = { ...soloRun(), encountersWon: 1 };
  const { run: after, report } = applyEncounterLevels(run, heroes, ALWAYS);
  assert.strictEqual(report[0].fromXp, xpForLevel(1));
  assert.strictEqual(report[0].toXp, after.roster[0].xp);
  assert.strictEqual(report[0].toXp - report[0].fromXp, xpForEncounter(1));
});

test('growth: a grant rolls growth once per level crossed, whatever size the grant is', () => {
  const entry = soloRun().roster[0];
  const topHp = gradeMaxPoints(gradesFor(heroes.cinderKnight).hp) * GROWTH_UNIT_HP;
  // 1 -> 4 in one grant: three levels, three rolls.
  const jump = grantXp(entry, heroes.cinderKnight, xpForLevel(4) - xpForLevel(1), ALWAYS);
  assert.strictEqual(levelOf(jump.entry), 4);
  assert.strictEqual(jump.gained.hp, topHp * 3);
  // Part-way to a level rolls nothing and banks the XP.
  const partial = grantXp(jump.entry, heroes.cinderKnight, 1, ALWAYS);
  assert.strictEqual(levelOf(partial.entry), 4);
  assert.strictEqual(partial.entry.xp, xpForLevel(4) + 1);
  assert.deepStrictEqual(partial.gained, {});
  // And the banked XP counts toward the next: one more grant to the cube crosses it.
  const across = grantXp(partial.entry, heroes.cinderKnight, xpForLevel(5) - partial.entry.xp, ALWAYS);
  assert.strictEqual(levelOf(across.entry), 5);
  assert.strictEqual(across.gained.hp, topHp);
});

test('growth: a hero that joins late is behind — and the convex curve closes the gap slowly on its own', () => {
  // Still a DELTA, never a target: the recruit missed the grants before it and is behind. But the
  // same XP is worth more levels lower down the cube, so it GAINS on par with every win rather
  // than trailing by a fixed count for the rest of the run. "Permanently" is what the XP Overhaul
  // reversed (docs/xp-overhaul.md §2, §9); "arrives underlevelled" is what it kept.
  let run = soloRun();
  for (let n = 1; n <= 8; n++) run = grantEncounterLevels({ ...run, encountersWon: n }, heroes, ALWAYS);
  assert.strictEqual(levelOf(run.roster[0]), levelAfterEncounters(8));

  run = addRosterEntry(run, createRosterEntry('crimson', 'crimson', heroes.crimson.moveIds));
  const gapOnArrival = levelOf(run.roster[0]) - levelOf(run.roster[1]);

  run = grantEncounterLevels({ ...run, encountersWon: 9 }, heroes, ALWAYS);
  const [vet, recruit] = run.roster;
  assert.strictEqual(levelOf(vet), levelAfterEncounters(9), 'the veteran is at par');
  assert.strictEqual(recruit.xp, xpForLevel(1) + xpForEncounter(9), 'the recruit got THIS win only');
  assert.ok(levelOf(recruit) < levelOf(vet), 'and is still behind');
  assert.ok(levelOf(vet) - levelOf(recruit) < gapOnArrival, 'but by less than it arrived behind');

  // In XP the gap is a constant (both get the same grants), so in the cube's terms it only ever
  // shrinks; in whole levels it can wobble by one where a level boundary falls between them, so
  // what is pinned is the envelope — never further behind than on arrival, and closer at the end.
  const gapAfterFirst = levelOf(vet) - levelOf(recruit);
  let gap = gapAfterFirst;
  for (let n = 10; n <= TOTAL_ENCOUNTERS; n++) {
    run = grantEncounterLevels({ ...run, encountersWon: n }, heroes, ALWAYS);
    gap = levelOf(run.roster[0]) - levelOf(run.roster[1]);
    assert.ok(gap <= gapOnArrival, `encounter ${n}: the gap is ${gap}, wider than the ${gapOnArrival} it arrived behind`);
  }
  assert.ok(gap < gapOnArrival, 'the gap has closed over the run');
  assert.ok(gap > 0, 'a recruit that missed eight wins does not reach the cap with the veteran');
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
