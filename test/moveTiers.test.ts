// The level-up tier gate: a move's `tier` decides the hero level at which it may first be offered
// (run/progression.ts MOVE_TIER_LEVEL, levelUpMovePool). An omitted tier reads as Early (ungated),
// so TIERED_TYPES records which slates carry a tier column — a slate silently losing its tiers
// would otherwise look exactly like the pre-gate behaviour.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import {
  levelUpMovePool,
  isMoveTierOfferable,
  levelUpHero,
  levelUpPayout,
  grantLevelUpMove,
  recordMoveOffer,
  chooseEvolutionPath,
  availableEvolution,
  costToReachLevel,
  moveOfferLevels,
  movePoolFloor,
  grantMove,
  MOVE_TIER_LEVEL,
  MOVE_TIER_EXPIRY,
  MOVE_POOL_MARGIN,
  MOVE_CAP,
  EVOLUTION_LEVEL,
  MASTERY_LEVEL,
} from '../src/run/progression';
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

test('move tiers: Early EXPIRES when Mid opens, Mid and Late accumulate, and an untiered move is ungated', () => {
  const early = moves.swiftBlow; // Iron, Early
  const mid = moves.momentumSwing; // Iron, Mid
  const late = moves.juggernaut; // Iron, Late
  assert.deepStrictEqual([early.tier, mid.tier, late.tier], ['early', 'mid', 'late']);

  assert.deepStrictEqual(
    [1, 3, 4, 6, 7, 10].map((lv) => [early, mid, late].filter((m) => isMoveTierOfferable(m, lv)).map((m) => m.tier)),
    [['early'], ['early'], ['mid'], ['mid'], ['mid', 'late'], ['mid', 'late']],
    'Early is off the table from MOVE_TIER_LEVEL.mid; nothing else ever closes'
  );

  assert.strictEqual(moves.runicBlast.tier, undefined);
  assert.ok(isMoveTierOfferable(moves.runicBlast, 1));
  assert.ok(isMoveTierOfferable(moves.runicBlast, 10), 'and an untiered move never expires either');
  assert.ok(isMoveTierOfferable(undefined, 1), 'a missing move must not gate — it is a content bug, not a lock');

  assert.deepStrictEqual(MOVE_TIER_LEVEL, { early: 1, mid: 4, late: 7 });
  assert.deepStrictEqual(MOVE_TIER_EXPIRY, { early: MOVE_TIER_LEVEL.mid, mid: Infinity, late: Infinity });
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

  assert.ok(!atFour.includes('ironFist'), 'and Early has EXPIRED — level 4 never pays a starter-tier move');

  const atSeven = levelUpMovePool(progressionTable, moves, entryAt('ironWarden', MOVE_TIER_LEVEL.late));
  assert.ok(atSeven.includes('juggernaut'), 'Late unlocks at MOVE_TIER_LEVEL.late');
  assert.ok(atSeven.includes('rendArmor'), 'and Mid is still on the table — only Early ever closes');
  assert.ok(!atSeven.includes('ironFist'));

  const held = levelUpMovePool(progressionTable, moves, entryAt('ironWarden', 9, ['juggernaut']));
  assert.ok(!held.includes('juggernaut'));
});

test("move tiers: a graft's line is gated on REACHING a tier, so its Early moves survive the expiry", () => {
  // A graft lands at EVOLUTION_LEVEL, by which point Early has expired. Gating learnableMoveIds the
  // way the base pool is gated would make every Early move in a grafted type's line dead on arrival —
  // and the Early moves are the way INTO a type the hero has only just acquired.
  const early = Object.values(heroesById).flatMap((hero) =>
    (progressionTable.evolutions[hero.id] ?? [])
      .flatMap((node) => node.paths)
      .filter((path) => path.typeGraft)
      .flatMap((path) => (path.learnableMoveIds ?? []).filter((id) => (moves[id].tier ?? 'early') === 'early'))
  );
  assert.ok(early.length > 0, 'if no graft line carries an Early move, this exemption is dead code — delete it');

  // Cinderveil grafts Spirit and its line opens with Drain, an Early Spirit move.
  const path = progressionTable.evolutions.crimson[0].paths.find((p) => p.typeGraft === 'Spirit')!;
  assert.strictEqual(moves.drain.tier, 'early');
  assert.ok(path.learnableMoveIds?.includes('drain'));
  assert.ok(!isMoveTierOfferable(moves.drain, EVOLUTION_LEVEL), 'Early is expired by the Evolution level');

  const grafted = entryAt('crimson', EVOLUTION_LEVEL);
  const pool = levelUpMovePool(progressionTable, moves, { ...grafted, chosenPathIds: [path.id] });
  assert.ok(pool.includes('drain'), 'the graft carries its own Early moves past the expiry');
  assert.ok(
    !levelUpMovePool(progressionTable, moves, grafted).includes('drain'),
    'and only for a hero that actually took the path'
  );
  assert.ok(!pool.includes('setAlight'), "the BASE pool's Early half is still expired");
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
  // Derived, not listed: the whole Early half of Warden's pool, so widening it does not rot this fixture.
  const warden = (progressionTable.moveTiers.ironWarden ?? []).filter((id) => (moves[id].tier ?? 'early') === 'early');
  const drained = levelUpMovePool(progressionTable, moves, entryAt('ironWarden', 3, warden));
  assert.deepStrictEqual(drained, [], 'the gate is allowed to leave nothing to offer');
  assert.ok(
    levelUpMovePool(progressionTable, moves, entryAt('ironWarden', 4, warden))
      .length > 0,
    'and the very next level pays it back — Mid opens at 4'
  );
});

test('move tiers: the floor is DERIVED from the curve, not written down beside it', () => {
  const levels = moveOfferLevels();
  // The level-up that reaches EVOLUTION_LEVEL surfaces the Evolution instead of a move.
  assert.ok(!levels.includes(EVOLUTION_LEVEL), 'the Evolution level pays no move');
  assert.strictEqual(levels[levels.length - 1], MASTERY_LEVEL, 'MASTERY_LEVEL itself still pays a move');
  assert.deepStrictEqual(levels, [2, 3, 4, 6, 7, 8, 9, 10]);

  const floor = movePoolFloor();
  // Two offers draw from Early before it expires, two from Mid alone before Late opens, six from
  // Mid+Late in all — plus the margin, which is MOVE_CAP because that is the most a hero can be
  // holding from outside the pool.
  assert.strictEqual(MOVE_POOL_MARGIN, MOVE_CAP);
  assert.deepStrictEqual(floor, {
    early: 2 + MOVE_POOL_MARGIN,
    mid: 2 + MOVE_POOL_MARGIN,
    midLate: 6 + MOVE_POOL_MARGIN,
  });
});

test('move tiers: no hero can reach level 10 on a level-up that offers nothing', () => {
  // Exact, not sampled: the count still on the table at the nth offer is |moves offerable at this
  // level| - (n - 1), whichever ones were handed out — and an offer is spent whether it is taken or
  // declined, so the count falls either way. The tally RESETS when Early expires: the offers it ate
  // came out of a set that is no longer on the table, so they cannot drain Mid.
  const floor = movePoolFloor();
  for (const hero of Object.values(heroesById)) {
    const pool = (progressionTable.moveTiers[hero.id] ?? []).filter((id) => !hero.moveIds.includes(id));
    let offers = 0;
    for (const level of moveOfferLevels()) {
      if (level === MOVE_TIER_LEVEL.mid) offers = 0;
      offers++;
      const reachable = pool.filter((id) => isMoveTierOfferable(moves[id], level)).length;
      assert.ok(
        reachable >= offers + MOVE_POOL_MARGIN,
        `${hero.id} is thin at level ${level}: ${reachable} move(s) offerable, ` +
          `${offers} offer(s) drawn from that set by then, margin ${MOVE_POOL_MARGIN}`
      );
    }
    const tierOf = (id: string) => moves[id].tier ?? 'early';
    const early = pool.filter((id) => tierOf(id) === 'early').length;
    const mid = pool.filter((id) => tierOf(id) === 'mid').length;
    const midLate = pool.filter((id) => tierOf(id) !== 'early').length;
    assert.ok(early >= floor.early, `${hero.id} holds ${early} Early, floor is ${floor.early}`);
    assert.ok(mid >= floor.mid, `${hero.id} holds ${mid} Mid, floor is ${floor.mid}`);
    assert.ok(midLate >= floor.midLate, `${hero.id} holds ${midLate} Mid+Late, floor is ${floor.midLate}`);
  }
});

test('move tiers: every hero climbs 1 to MASTERY_LEVEL without a level-up ever paying nothing', () => {
  // The arithmetic above models the drain; this WALKS it, through the real calls, so the
  // offeredMoveIds bookkeeping is in the loop. Both answers to an offer are exercised because both
  // spend it: declining burns the move exactly as taking it does.
  for (const hero of Object.values(heroesById)) {
    const paths = (progressionTable.evolutions[hero.id] ?? []).flatMap((node) => node.paths);
    for (const path of paths) {
      let run = addRosterEntry(
        createRunState(costToReachLevel(1, MASTERY_LEVEL)),
        createRosterEntry(hero.id, hero.id, hero.moveIds)
      );
      // Worst case, not the tidy one: before a single level-up, events fill the whole loadout
      // with moves out of this hero's own pool. They spend no offer (grantMove) but they are
      // held, so levelUpMovePool filters them all the same.
      for (let slot = 0; slot < MOVE_CAP; slot++) {
        // Drawn at level 1, so the gifts are Early ones — the shallowest band, drained first.
        const gift = levelUpMovePool(progressionTable, moves, { ...run.roster[0], level: 1 })[slot];
        run = grantMove(run, hero.id, gift, run.roster[0].unlockedMoveIds[0]);
      }
      let decline = false;
      for (const level of moveOfferLevels()) {
        // Buy the level the offer hangs off, plus the Evolution level this loop skips.
        while (run.roster[0].level < level) run = levelUpHero(run, hero.id);
        const entry = run.roster[0];
        if (availableEvolution(progressionTable, entry)) {
          run = chooseEvolutionPath(run, progressionTable, heroesById, hero.id, path.id);
        }
        const payout = levelUpPayout(progressionTable, moves, run.roster[0]);
        assert.strictEqual(payout, 'move', `${hero.id} via ${path.id}: level ${level} paid ${payout}`);
        const moveId = levelUpMovePool(progressionTable, moves, run.roster[0])[0];
        run = decline
          ? recordMoveOffer(run, hero.id, [moveId])
          : grantLevelUpMove(run, hero.id, moveId, run.roster[0].unlockedMoveIds[0]);
        decline = !decline;
      }
    }
  }
});

test('move tiers: every hero has an Evolution node — the precondition the test above skips a level on', () => {
  // The FLOOR test skips EVOLUTION_LEVEL because that level-up surfaces the Evolution instead of a
  // move. A hero with no node gets a move offer there instead, so the skip quietly over-credits it —
  // which is how Tempest sat evolution-less without a single test noticing.
  const missing = Object.keys(heroesById)
    .filter((heroId) => (progressionTable.evolutions[heroId] ?? []).length === 0)
    .sort();
  assert.deepStrictEqual(missing, [], 'these heroes can never evolve');
});

test('move tiers: every Evolution node offers exactly three paths, differing in kind', () => {
  for (const [heroId, nodes] of Object.entries(progressionTable.evolutions)) {
    for (const node of nodes) {
      const kinds = node.paths.map((p) => p.kind).sort();
      assert.deepStrictEqual(kinds, ['defensive', 'offensive', 'utility'], `${heroId} at level ${node.level}`);
    }
  }
});

test('move tiers: every move an Evolution grants or unlocks exists, and a graft only grants its own type', () => {
  for (const [heroId, nodes] of Object.entries(progressionTable.evolutions)) {
    for (const node of nodes) {
      for (const path of node.paths) {
        assert.strictEqual(path.heroId, heroId, `${path.id} is filed under the wrong hero`);
        for (const id of [...path.unlocksMoveIds, ...(path.learnableMoveIds ?? [])]) {
          assert.ok(moves[id], `${path.id} references unknown move ${id}`);
        }
        // A graft that hands over moves of some third type would be paying in something it did not buy.
        if (path.typeGraft) {
          const off = (path.learnableMoveIds ?? []).filter(
            (id) => moves[id].type !== path.typeGraft && !heroesById[heroId].types.includes(moves[id].type)
          );
          assert.deepStrictEqual(off, [], `${path.id} learns moves of neither its graft nor its innate type`);
        }
      }
    }
  }
});
