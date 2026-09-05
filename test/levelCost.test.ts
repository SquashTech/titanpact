import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import type { RunState } from '../src/run/state';
import {
  levelUpCost,
  MAX_LEVEL_UP_COST,
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

// --- The curve ---

test('cost: a level-up costs as many points as the level it leaves, up to the cap', () => {
  assert.strictEqual(levelUpCost(1), 1);
  assert.strictEqual(levelUpCost(4), 4);
  assert.strictEqual(levelUpCost(MAX_LEVEL_UP_COST), MAX_LEVEL_UP_COST);
  // Flattens rather than rising forever: the raw triangular tail priced the late-tier
  // movepool out of a real run — reaching MASTERY_LEVEL on one hero cost 45 of the ~70
  // points a full five-act run pays.
  assert.strictEqual(levelUpCost(10), MAX_LEVEL_UP_COST);
  assert.strictEqual(levelUpCost(99), MAX_LEVEL_UP_COST);
  // Defensive floor: a level below 1 must not make a level-up free or refund points.
  assert.strictEqual(levelUpCost(0), 1);
});

test('cost: costToReachLevel sums the curve, and the Evolution rush costs 10', () => {
  assert.strictEqual(costToReachLevel(1, 1), 0);
  assert.strictEqual(costToReachLevel(1, 2), 1);
  assert.strictEqual(costToReachLevel(1, EVOLUTION_LEVEL), 10); // 1+2+3+4
  // 1+2+3+4 then the cap: 10 + 5*5.
  assert.strictEqual(costToReachLevel(1, MASTERY_LEVEL), 35);
  assert.strictEqual(costToReachLevel(1, 4) + costToReachLevel(4, 8), costToReachLevel(1, 8));
});

test('cost: the mastery tail flattens at the cap rather than pricing itself out', () => {
  assert.ok(levelUpCost(MASTERY_LEVEL) > levelUpCost(1), 'depth still costs more than the first level');
  assert.strictEqual(levelUpCost(MASTERY_LEVEL + 5), levelUpCost(MASTERY_LEVEL), 'and stops climbing at the cap');
  // The cap is what puts level 7 — where EVERY move costing 70+ mana unlocks — inside a run.
  assert.strictEqual(costToReachLevel(1, 7), 20);
});

test('cost: breadth beats depth per point — four heroes to level 3 costs a hero to level 5', () => {
  assert.strictEqual(4 * costToReachLevel(1, 3), 12);
  assert.strictEqual(costToReachLevel(1, EVOLUTION_LEVEL), 10);
});

// --- Spending ---

test('cost: levelUpHero charges the curve and rejects a pool that cannot cover it', () => {
  let run = seed(['cinderKnight']);

  run = { ...run, levelUpPool: 1 };
  run = levelUpHero(run, 'cinderKnight');
  assert.strictEqual(run.roster[0].level, 2);
  assert.strictEqual(run.levelUpPool, 0);

  // Level 2 -> 3 costs 2.
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

// --- Affordability ---

test('cost: canAffordAnyLevelUp is what gates the screen, not a non-empty pool', () => {
  let run = seed(['cinderKnight', 'tidecaller']);

  run = { ...run, levelUpPool: 0 };
  assert.strictEqual(canAffordAnyLevelUp(run), false);

  run = { ...run, levelUpPool: 1 };
  assert.strictEqual(canAffordAnyLevelUp(run), true);

  // A non-empty pool that buys nobody is the normal end state under the curve (CLAUDE.md).
  run = { ...run, levelUpPool: 20 };
  for (let i = 0; i < 2; i++) {
    run = levelUpHero(run, 'cinderKnight');
    run = levelUpHero(run, 'tidecaller');
  }
  assert.strictEqual(run.roster[0].level, 3);
  run = { ...run, levelUpPool: 2 };
  assert.strictEqual(canAffordAnyLevelUp(run), false);

  // A fresh level-1 recruit is always affordable — the raise-vs-recruit axis.
  run = addRosterEntry(run, createRosterEntry('ironWarden', 'ironWarden', heroes.ironWarden.moveIds));
  assert.strictEqual(canAffordAnyLevelUp(run), true);
});
