// The level-up tier gate: a move's `tier` decides the hero level at which it may first be offered
// (run/progression.ts MOVE_TIER_LEVEL, levelUpMovePool). An omitted tier reads as Early (ungated),
// so TIERED_TYPES records which slates carry a tier column — a slate silently losing its tiers
// would otherwise look exactly like the pre-gate behaviour.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { levelUpMovePool, isMoveTierUnlocked, MOVE_TIER_LEVEL, EVOLUTION_LEVEL } from '../src/run/progression';
import { heroes as heroesById } from '../src/data/heroes';
import type { MoveTier, TypeId } from '../src/engine/content';

/** Every authored slate; Ancient is the only type still untiered (no authored slate yet). */
const TIERED_TYPES: readonly TypeId[] = [
  'Fire',
  'Water',
  'Frost',
  'Storm',
  'Stone',
  'Nature',
  'Light',
  'Shadow',
  'Arcane',
  'Mind',
  'Spirit',
  'Iron',
  'Beast',
  'Mech',
];

function entryAt(heroId: string, level: number, unlocked: readonly string[] = []) {
  let run = createRunState(0);
  run = addRosterEntry(run, { ...createRosterEntry(heroId, heroId, unlocked), level });
  return run.roster[0];
}

test('move tiers: every move of a tiered slate carries a tier, and no other type does', () => {
  for (const move of Object.values(moves)) {
    if (TIERED_TYPES.includes(move.type)) {
      assert.ok(move.tier, `${move.id} (${move.type}) is in a tiered slate but has no tier`);
    } else {
      assert.strictEqual(
        move.tier,
        undefined,
        `${move.id} (${move.type}) carries a tier, but ${move.type} is not in TIERED_TYPES — add it there`
      );
    }
  }

  for (const type of TIERED_TYPES) {
    const tiers = new Set(Object.values(moves).filter((m) => m.type === type).map((m) => m.tier));
    for (const tier of ['early', 'mid', 'late'] as MoveTier[]) {
      assert.ok(tiers.has(tier), `${type} has no ${tier}-tier move`);
    }
  }
});

test('move tiers: MOVE_TIER_LEVEL gates cumulatively, and an untiered move is ungated', () => {
  const early = moves.swiftBlow; // Iron, Early
  const mid = moves.momentumSwing; // Iron, Mid
  const late = moves.juggernaut; // Iron, Late
  assert.deepStrictEqual([early.tier, mid.tier, late.tier], ['early', 'mid', 'late']);

  assert.deepStrictEqual(
    [1, 3, 4, 6, 7].map((lv) => [early, mid, late].filter((m) => isMoveTierUnlocked(m, lv)).length),
    [1, 1, 2, 2, 3],
    'each tier unlocks at its level and STAYS unlocked — cumulative, not a window'
  );

  assert.strictEqual(moves.runicBlast.tier, undefined);
  assert.ok(isMoveTierUnlocked(moves.runicBlast, 1));
  assert.ok(isMoveTierUnlocked(undefined, 1), 'a missing move must not gate — it is a content bug, not a lock');

  assert.deepStrictEqual(MOVE_TIER_LEVEL, { early: 1, mid: 4, late: 7 });
});

test('move tiers: levelUpMovePool only offers what the hero\'s level has reached', () => {
  // Warden's pool: ironFist/pinDown/rockToss/bodyBlow are Early or untiered, rendArmor Mid, juggernaut Late.
  const atOne = levelUpMovePool(progressionTable, moves, entryAt('ironWarden', 1));
  assert.ok(!atOne.includes('rendArmor'), 'a Mid move must not be offered at level 1');
  assert.ok(!atOne.includes('juggernaut'), 'a Late move must not be offered at level 1');
  assert.ok(atOne.includes('ironFist'));

  const atFour = levelUpMovePool(progressionTable, moves, entryAt('ironWarden', MOVE_TIER_LEVEL.mid));
  assert.ok(atFour.includes('rendArmor'), 'Mid unlocks at MOVE_TIER_LEVEL.mid');
  assert.ok(!atFour.includes('juggernaut'));

  const atSeven = levelUpMovePool(progressionTable, moves, entryAt('ironWarden', MOVE_TIER_LEVEL.late));
  assert.ok(atSeven.includes('juggernaut'), 'Late unlocks at MOVE_TIER_LEVEL.late');
  assert.ok(atSeven.includes('ironFist'), 'and Early is still on the table — the tiers accumulate');

  const held = levelUpMovePool(progressionTable, moves, entryAt('ironWarden', 9, ['juggernaut']));
  assert.ok(!held.includes('juggernaut'));
});

test('move tiers: every level-up pool holds something a level-1 hero can be offered', () => {
  // A pool of nothing but Mid and Late moves means that hero learns nothing until level 4.
  const starved = Object.keys(progressionTable.moveTiers)
    .filter((heroId) => levelUpMovePool(progressionTable, moves, entryAt(heroId, 1)).length === 0)
    .sort();
  assert.deepStrictEqual(starved, [], 'these pools hold no move a level-1 hero can be offered');
});

test('move tiers: a pool can still empty out as a MECHANISM, which now pays a mastery stat', () => {
  // Unreachable from real play since the FLOOR landed (test below); levelUpPayout turns an empty
  // pool into a mastery stat. This still pins the GATE.
  const drained = levelUpMovePool(
    progressionTable,
    moves,
    entryAt('ironWarden', 3, ['ironFist', 'pinDown', 'rockToss', 'bodyBlow'])
  );
  assert.deepStrictEqual(drained, [], 'the gate is allowed to leave nothing to offer');
  assert.ok(
    levelUpMovePool(progressionTable, moves, entryAt('ironWarden', 4, ['ironFist', 'pinDown', 'rockToss', 'bodyBlow']))
      .length > 0,
    'and the very next level pays it back — Mid opens at 4'
  );
});

test('move tiers: no hero can reach level 10 on a level-up that offers nothing', () => {
  // Exact, not sampled: the gate is cumulative, so the count still on the table at the nth offer is
  // |moves tier-unlocked at this level| - (n - 1) whichever ones were handed out. That collapses to
  // the FLOOR in CLAUDE.md (>=2 Early, >=4 Early+Mid, >=8 total, starting kit filtered out).
  for (const hero of Object.values(heroesById)) {
    const pool = (progressionTable.moveTiers[hero.id] ?? []).filter((id) => !hero.moveIds.includes(id));
    let offers = 0;
    for (let level = 2; level <= 10; level++) {
      // The level-up that reaches EVOLUTION_LEVEL surfaces the Evolution instead of a move.
      if (level === EVOLUTION_LEVEL) continue;
      offers++;
      const reachable = pool.filter((id) => isMoveTierUnlocked(moves[id], level)).length;
      assert.ok(
        reachable >= offers,
        `${hero.id} has nothing to offer at level ${level}: ${reachable} move(s) tier-unlocked, ` +
          `${offers} level-up offer(s) made by then`
      );
    }
  }
});
