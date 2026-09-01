// Mastery level-ups (2026-08-31 designer call): past MASTERY_LEVEL a Training
// Point spent on a hero stops buying a move and starts buying a flat stat.
//
// This is the ONE documented exemption to CLAUDE.md's "level-ups never
// directly raise stats" / "no automatic stat growth from leveling", and the
// tests below pin the three things that keep it an exemption rather than a
// hole: it does not start early, it cannot roll a stat the reel excludes, and
// it reaches combat through the same seam every other flat grant uses.

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

/** A roster of one, seeded at `level` with its hero's authored starting kit. */
function seed(heroId: string, level: number) {
  let run = createRunState(0);
  run = addRosterEntry(run, { ...createRosterEntry(heroId, heroId, heroes[heroId].moveIds), level });
  // Generous on purpose: under the level-price curve (run/progression.ts
  // levelUpCost) walking a hero past MASTERY_LEVEL costs costToReachLevel(1, 11)
  // = 55, and these tests are about what the level PAYS OUT, not what it costs.
  return { ...run, levelUpPool: costToReachLevel(1, MASTERY_LEVEL + 6) };
}

test('mastery: a level-up pays out a move through MASTERY_LEVEL and a stat past it', () => {
  // Walked on a real hero rather than a fixture, so this is also an assertion
  // that the authored pools (data/progression.ts FLOOR) actually hold up
  // across the whole curve — the level-up offer floor from earlier the same
  // day and this cap are two halves of one decision.
  let run = seed('cinderKnight', 1);
  for (let level = 2; level <= MASTERY_LEVEL; level++) {
    run = levelUpHero(run, 'cinderKnight');
    const payout = levelUpPayout(progressionTable, moves, run.roster[0]);
    // Level 5 is the Evolution, which replaces that level-up's move offer.
    assert.strictEqual(payout, level === EVOLUTION_LEVEL ? 'evolution' : 'move', `level ${level} paid out ${payout}`);
    // Nothing below the cap may pay out a stat — that is the whole point of
    // the cap. Moves are the interesting payoff; stats are the sink after.
    assert.notStrictEqual(payout, 'mastery', `level ${level} is below the cap and must not grant a stat`);

    if (payout === 'evolution') {
      // The offer STANDS until a path is taken (availableEvolution is a gate,
      // not a one-shot), so the walk has to resolve it the way the screen
      // does or every later level reads as 'evolution' too.
      const node = availableEvolution(progressionTable, run.roster[0])!;
      run = chooseEvolutionPath(run, progressionTable, heroes, 'cinderKnight', node.paths[0].id);
    } else {
      // Take the move as well, so the pool actually drains across the walk and
      // this is a test of the authored curve rather than of one repeated roll.
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
  // The safety net, not the main path: the authored floor is supposed to keep
  // every pool full through MASTERY_LEVEL (test/moveTiers.test.ts pins that),
  // so this state should be unreachable in a real run. It is tested against a
  // hand-built entry precisely BECAUSE the data no longer produces it — if a
  // future slate edit breaks the floor, the player gets a smaller payoff
  // instead of a Training Point that bought nothing.
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
  // Free: levelUpHero already charged the point, exactly as grantLevelUpMove is.
  assert.strictEqual(run.levelUpPool, before);

  // Hyperfocus is the stated design goal — repeat grants stack on one stat
  // rather than overwriting, so a player can pour a whole act into one hero.
  run = grantMasteryStat(run, 'cinderKnight', 'speed');
  run = grantMasteryStat(run, 'cinderKnight', 'attack');
  assert.deepStrictEqual(run.roster[0].masteryStatGrants, {
    speed: MASTERY_STAT_AMOUNT * 2,
    attack: MASTERY_STAT_AMOUNT,
  });
});

test('mastery: the reel is the five combat stats — HP, Mana and MP Regen are rejected', () => {
  // The restriction is the balance guardrail, not a UI convenience, so it is
  // enforced in the grant rather than trusted to the caller. A flat +10 is not
  // worth the same thing eight times over: +10 MP Regen is the whole Everflow
  // banner, +10 HP on a 130-HP body is noise. Same call, same reasoning, as
  // data/moves.ts RANDOM_STAT_POOL made for Overclock on 2026-08-30.
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

  // CLAUDE.md's flat-additive lock binds here with no exemption — the amount
  // is authored, not derived, so it must be a multiple of 5 or 10.
  assert.strictEqual(MASTERY_STAT_AMOUNT % 5, 0);
});

test('mastery: grants reach combat through the same merge every other flat grant uses', () => {
  // The seam that matters: a grant nothing reads is a grant that does not
  // exist. entryStatModifiers is the single point where equipment, Evolution,
  // map-node and mastery grants fold together, and every display path and
  // buildCombatState go through it.
  let run = seed('cinderKnight', MASTERY_LEVEL + 1);
  run = grantMasteryStat(run, 'cinderKnight', 'attack');
  run = grantMasteryStat(run, 'cinderKnight', 'attack');

  const entry = run.roster[0];
  const counts = entryPassiveCounts(entry, equipment, {});
  const mods = entryStatModifiers(entry, equipment, passives, counts);
  assert.strictEqual(mods.attack, MASTERY_STAT_AMOUNT * 2);
});

test('mastery: the offer is three DISTINCT stats drawn from the reel', () => {
  // Distinctness is the whole feature, not a nicety: a repeat would silently
  // turn the three-way pick back into a two-way one, which is the slot-machine
  // problem the choice was added to fix. Swept across many seeds rather than
  // spot-checked, since a shuffle bug is exactly the kind that hides behind
  // one lucky draw.
  for (let seed = 0; seed < 400; seed++) {
    // A cheap deterministic sequence — this only needs to be varied, not good.
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
  // The draw must not be able to strand a stat — a hero that can never be
  // offered Speed is a hero the "hyperfocus" pitch quietly lies to. Counts the
  // appearances across a sweep and asserts each stat shows up at a plausible
  // rate rather than exactly 3/5, which would be testing the PRNG.
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
  // The guard that keeps a future MASTERY_CHOICE_COUNT bump (or a shrunk reel)
  // from turning a draw-without-replacement loop into an infinite one.
  const all = drawMasteryStats(() => 0.5, MASTERY_STAT_POOL.length + 3);
  assert.strictEqual(all.length, MASTERY_STAT_POOL.length);
  assert.deepStrictEqual([...all].sort(), [...MASTERY_STAT_POOL].sort());
});

test('mastery: an unknown roster id is rejected rather than silently ignored', () => {
  const run = seed('cinderKnight', MASTERY_LEVEL + 1);
  assert.throws(() => grantMasteryStat(run, 'nobody', 'speed'), ProgressionError);
});
