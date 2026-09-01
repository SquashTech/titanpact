// Mastery level-ups: past MASTERY_LEVEL a level-up buys a flat stat instead of a move — the one
// documented exemption to "level-ups never directly raise stats" (CLAUDE.md).

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { passives } from '../src/data/passives';
import { progressionTable } from '../src/data/progression';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { entryPassiveCounts, entryStatModifiers } from '../src/run/entryStats';
import {
  levelUpHero,
  levelUpPayout,
  levelUpMovePool,
  grantLevelUpMove,
  availableEvolution,
  chooseEvolutionPath,
  EVOLUTION_LEVEL,
  MOVE_CAP,
  grantMasteryStat,
  isValidMasteryStat,
  MASTERY_LEVEL,
  MASTERY_STAT_AMOUNT,
  MASTERY_STAT_POOL,
  MASTERY_CHOICE_COUNT,
  drawMasteryStats,
  ProgressionError,
  costToReachLevel,
} from '../src/run/progression';

/** A roster of one, seeded at `level` with its hero's authored starting kit and a pool deep enough to walk past MASTERY_LEVEL. */
function seed(heroId: string, level: number) {
  let run = createRunState(0);
  run = addRosterEntry(run, { ...createRosterEntry(heroId, heroId, heroes[heroId].moveIds), level });
  return { ...run, levelUpPool: costToReachLevel(1, MASTERY_LEVEL + 6) };
}

test('mastery: a level-up pays out a move through MASTERY_LEVEL and a stat past it', () => {
  // Walked on a real hero so this also exercises the authored pool floor across the whole curve.
  let run = seed('cinderKnight', 1);
  for (let level = 2; level <= MASTERY_LEVEL; level++) {
    run = levelUpHero(run, 'cinderKnight');
    const payout = levelUpPayout(progressionTable, moves, run.roster[0]);
    assert.strictEqual(payout, level === EVOLUTION_LEVEL ? 'evolution' : 'move', `level ${level} paid out ${payout}`);
    assert.notStrictEqual(payout, 'mastery', `level ${level} is below the cap and must not grant a stat`);

    if (payout === 'evolution') {
      // The offer stands until a path is taken, so the walk has to resolve it.
      const node = availableEvolution(progressionTable, run.roster[0])!;
      run = chooseEvolutionPath(run, progressionTable, heroes, 'cinderKnight', node.paths[0].id);
    } else {
      const offered = levelUpMovePool(progressionTable, moves, run.roster[0]);
      const held = run.roster[0].unlockedMoveIds;
      run = grantLevelUpMove(
        run,
        'cinderKnight',
        offered[0],
        held.length >= MOVE_CAP ? held[held.length - 1] : undefined
      );
    }
  }

  run = levelUpHero(run, 'cinderKnight');
  assert.strictEqual(run.roster[0].level, MASTERY_LEVEL + 1);
  assert.strictEqual(levelUpPayout(progressionTable, moves, run.roster[0]), 'mastery');
});

test('mastery: an empty pool below the cap falls back to a stat rather than to nothing', () => {
  // Unreachable in a real run while the pool floor holds (test/moveTiers.test.ts); hand-built here.
  let run = createRunState(0);
  const pool = progressionTable.moveTiers.cinderKnight ?? [];
  run = addRosterEntry(run, {
    ...createRosterEntry('cinderKnight', 'cinderKnight', [...heroes.cinderKnight.moveIds, ...pool]),
    level: 4,
    // Past the Evolution, so 'evolution' does not win the precedence check.
    chosenPathIds: [progressionTable.evolutions.cinderKnight[0].paths[0].id],
  });
  assert.strictEqual(levelUpPayout(progressionTable, moves, run.roster[0]), 'mastery');
});

test('mastery: the grant is +10 on a combat stat, accumulates, and is free', () => {
  let run = seed('cinderKnight', MASTERY_LEVEL + 1);
  const before = run.levelUpPool;

  run = grantMasteryStat(run, 'cinderKnight', 'speed');
  assert.deepStrictEqual(run.roster[0].masteryStatGrants, { speed: MASTERY_STAT_AMOUNT });
  assert.strictEqual(run.levelUpPool, before);

  run = grantMasteryStat(run, 'cinderKnight', 'speed');
  run = grantMasteryStat(run, 'cinderKnight', 'attack');
  assert.deepStrictEqual(run.roster[0].masteryStatGrants, {
    speed: MASTERY_STAT_AMOUNT * 2,
    attack: MASTERY_STAT_AMOUNT,
  });
});

test('mastery: the reel is the five combat stats — HP, Mana and MP Regen are rejected', () => {
  assert.deepStrictEqual([...MASTERY_STAT_POOL], ['attack', 'defense', 'intelligence', 'wisdom', 'speed']);

  const run = seed('cinderKnight', MASTERY_LEVEL + 1);
  for (const stat of ['hp', 'manaPool', 'mpRegen'] as const) {
    assert.throws(() => grantMasteryStat(run, 'cinderKnight', stat), ProgressionError, `${stat} was accepted`);
    assert.ok(!isValidMasteryStat(stat));
  }
  for (const stat of MASTERY_STAT_POOL) {
    assert.ok(isValidMasteryStat(stat));
    assert.strictEqual(grantMasteryStat(run, 'cinderKnight', stat).roster[0].masteryStatGrants[stat], MASTERY_STAT_AMOUNT);
  }

  assert.strictEqual(MASTERY_STAT_AMOUNT % 5, 0);
});

test('mastery: grants reach combat through the same merge every other flat grant uses', () => {
  let run = seed('cinderKnight', MASTERY_LEVEL + 1);
  run = grantMasteryStat(run, 'cinderKnight', 'attack');
  run = grantMasteryStat(run, 'cinderKnight', 'attack');

  const entry = run.roster[0];
  const counts = entryPassiveCounts(entry, equipment, {});
  const mods = entryStatModifiers(entry, equipment, passives, counts);
  assert.strictEqual(mods.attack, MASTERY_STAT_AMOUNT * 2);
});

test('mastery: the offer is three DISTINCT stats drawn from the reel', () => {
  for (let seed = 0; seed < 400; seed++) {
    let n = seed;
    const random = () => {
      n = (n * 1103515245 + 12345) % 2147483648;
      return n / 2147483648;
    };
    const drawn = drawMasteryStats(random);
    assert.strictEqual(drawn.length, MASTERY_CHOICE_COUNT, `seed ${seed} drew ${drawn.length}`);
    assert.strictEqual(new Set(drawn).size, MASTERY_CHOICE_COUNT, `seed ${seed} repeated a stat: ${drawn.join(', ')}`);
    for (const stat of drawn) assert.ok(isValidMasteryStat(stat), `seed ${seed} drew off-reel ${stat}`);
  }
});

test('mastery: every stat on the reel is reachable, and none dominates', () => {
  // A plausible band rather than exactly 3/5, which would be testing the PRNG.
  const seen: Record<string, number> = {};
  const rounds = 1000;
  let n = 7;
  const random = () => {
    n = (n * 1103515245 + 12345) % 2147483648;
    return n / 2147483648;
  };
  for (let i = 0; i < rounds; i++) for (const stat of drawMasteryStats(random)) seen[stat] = (seen[stat] ?? 0) + 1;

  for (const stat of MASTERY_STAT_POOL) {
    const share = (seen[stat] ?? 0) / rounds;
    assert.ok(share > 0.4 && share < 0.8, `${stat} appeared in ${(share * 100).toFixed(1)}% of draws (expect ~60%)`);
  }
});

test('mastery: asking for more than the reel holds yields the whole reel, not a hang', () => {
  const all = drawMasteryStats(() => 0.5, MASTERY_STAT_POOL.length + 3);
  assert.strictEqual(all.length, MASTERY_STAT_POOL.length);
  assert.deepStrictEqual([...all].sort(), [...MASTERY_STAT_POOL].sort());
});

test('mastery: an unknown roster id is rejected rather than silently ignored', () => {
  const run = seed('cinderKnight', MASTERY_LEVEL + 1);
  assert.throws(() => grantMasteryStat(run, 'nobody', 'speed'), ProgressionError);
});
