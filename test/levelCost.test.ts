import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import type { RunState } from '../src/run/state';
import {
  levelUpCost,
  costToReachLevel,
  canAffordAnyLevelUp,
  levelUpHero,
  EVOLUTION_LEVEL,
  MASTERY_LEVEL,
  ProgressionError,
} from '../src/run/progression';

function seed(heroIds: string[]): RunState {
  let run = createRunState(0);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- The curve -------------------------------------------------------------

test('cost: a level-up costs as many points as the level it leaves', () => {
  assert.strictEqual(levelUpCost(1), 1);
  assert.strictEqual(levelUpCost(4), 4);
  assert.strictEqual(levelUpCost(10), 10);
  // Defensive floor: a level below 1 should never exist, but if one does it
  // must not make a level-up free (or, worse, refund points).
  assert.strictEqual(levelUpCost(0), 1);
});

test('cost: costToReachLevel sums the curve, and the Evolution rush costs 10', () => {
  assert.strictEqual(costToReachLevel(1, 1), 0);
  assert.strictEqual(costToReachLevel(1, 2), 1);
  assert.strictEqual(costToReachLevel(1, EVOLUTION_LEVEL), 10); // 1+2+3+4
  assert.strictEqual(costToReachLevel(1, MASTERY_LEVEL), 45); // 1..9
  // Composable: two hops equal one long one, which is what lets the view quote
  // a partial cost without re-deriving the triangle.
  assert.strictEqual(costToReachLevel(1, 4) + costToReachLevel(4, 8), costToReachLevel(1, 8));
});

test('cost: the mastery tail prices itself out instead of needing a cap', () => {
  // The convexity this curve exists to kill: under flat pricing the level-11
  // point (a permanent +10 stat) cost exactly what the level-2 point cost (a
  // declinable move-replacement offer). It must now cost strictly more.
  assert.ok(levelUpCost(MASTERY_LEVEL) > levelUpCost(1));
  assert.ok(levelUpCost(MASTERY_LEVEL + 5) > levelUpCost(MASTERY_LEVEL));
});

test('cost: breadth beats depth per point — four heroes to level 3 costs a hero to level 5', () => {
  // The whole design claim, as an assertion. If these ever diverge sharply the
  // level-up screen has stopped being a choice.
  assert.strictEqual(4 * costToReachLevel(1, 3), 12);
  assert.strictEqual(costToReachLevel(1, EVOLUTION_LEVEL), 10);
});

// --- Spending --------------------------------------------------------------

test('cost: levelUpHero charges the curve and rejects a pool that cannot cover it', () => {
  let run = seed(['cinderKnight']);

  run = { ...run, levelUpPool: 1 };
  run = levelUpHero(run, 'cinderKnight');
  assert.strictEqual(run.roster[0].level, 2);
  assert.strictEqual(run.levelUpPool, 0);

  // Level 2 -> 3 now costs 2, so the single point that bought the last level
  // no longer buys this one.
  run = { ...run, levelUpPool: 1 };
  assert.throws(() => levelUpHero(run, 'cinderKnight'), ProgressionError);

  run = { ...run, levelUpPool: 2 };
  run = levelUpHero(run, 'cinderKnight');
  assert.strictEqual(run.roster[0].level, 3);
  assert.strictEqual(run.levelUpPool, 0);
});

test('cost: an act of income reaches exactly one Evolution from scratch', () => {
  let run = seed(['cinderKnight']);
  run = { ...run, levelUpPool: costToReachLevel(1, EVOLUTION_LEVEL) };
  for (let i = 0; i < EVOLUTION_LEVEL - 1; i++) run = levelUpHero(run, 'cinderKnight');
  assert.strictEqual(run.roster[0].level, EVOLUTION_LEVEL);
  assert.strictEqual(run.levelUpPool, 0);
});

// --- Affordability ---------------------------------------------------------

test('cost: canAffordAnyLevelUp is what gates the screen, not a non-empty pool', () => {
  let run = seed(['cinderKnight', 'tidecaller']);

  run = { ...run, levelUpPool: 0 };
  assert.strictEqual(canAffordAnyLevelUp(run), false);

  run = { ...run, levelUpPool: 1 };
  assert.strictEqual(canAffordAnyLevelUp(run), true);

  // Both heroes lifted past what 2 points can buy: the pool is non-empty and
  // still buys nothing. This is the normal end state under the curve, and the
  // reason `levelUpPool > 0` is no longer a legal gate anywhere in the view —
  // it would reopen the level-up screen at every node with nothing to sell.
  run = { ...run, levelUpPool: 20 };
  for (let i = 0; i < 2; i++) {
    run = levelUpHero(run, 'cinderKnight');
    run = levelUpHero(run, 'tidecaller');
  }
  assert.strictEqual(run.roster[0].level, 3);
  run = { ...run, levelUpPool: 2 };
  assert.strictEqual(canAffordAnyLevelUp(run), false);

  // ...and the cheapest hero on the roster is what unlocks it again, which is
  // the raise-vs-recruit axis: a fresh level-1 recruit is always affordable.
  run = addRosterEntry(run, createRosterEntry('ironWarden', 'ironWarden', heroes.ironWarden.moveIds));
  assert.strictEqual(canAffordAnyLevelUp(run), true);
});
