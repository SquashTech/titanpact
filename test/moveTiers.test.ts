// The movepool tier gate: a move's `tier` decides the Mastery RANK at which it may first be
// offered (run/progression.ts MOVE_TIER_RANK, masteryMovePool). Rank replaced level on 2026-09-10
// (docs/growth-overhaul.md §4) — the bands are unchanged, only what opens them is.
//
// An omitted tier reads as Early (ungated), so TIERED_TYPES records which slates carry a tier
// column — a slate silently losing its tiers would otherwise look exactly like the pre-gate
// behaviour.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import type { RunState } from '../src/run/state';
import {
  masteryMovePool,
  masteryRank,
  scrollsToNextRank,
  scrollMovePool,
  canSpendScroll,
  spendMasteryScroll,
  grantMasteryScrolls,
  isMoveTierOfferable,
  grantOfferedMove,
  recordMoveOffer,
  chooseEvolutionPath,
  movePoolFloor,
  grantMove,
  MOVE_TIER_RANK,
  MOVE_TIER_RANK_EXPIRY,
  MAX_MASTERY_RANK,
  SCROLLS_PER_RANK,
  MOVE_CAP,
  EVOLUTION_LEVEL,
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

/** Scrolls to max a hero — the pips the board draws, and the most any one hero can ever spend usefully. */
const SCROLLS_TO_MAX = (MAX_MASTERY_RANK - 1) * SCROLLS_PER_RANK;

function entryAtRank(heroId: string, rank: number, unlocked: readonly string[] = []) {
  let run = createRunState(0);
  run = addRosterEntry(run, {
    ...createRosterEntry(heroId, heroId, unlocked),
    masteryScrollsSpent: (rank - 1) * SCROLLS_PER_RANK,
  });
  return run.roster[0];
}

/** A run holding one hero and `scrolls` unspent Scrolls. */
function runWith(heroId: string, scrolls: number, unlocked: readonly string[] = heroesById[heroId].moveIds): RunState {
  return grantMasteryScrolls(
    addRosterEntry(createRunState(0), createRosterEntry(heroId, heroId, unlocked)),
    Math.max(1, scrolls)
  );
}

test('move tiers: every move of a tiered slate carries a tier, and no other type does', () => {
  for (const move of Object.values(moves)) {
    if (TIERED_TYPES.includes(move.type)) {
      assert.ok(move.tier, `${move.id} (${move.type}) has no tier`);
    } else {
      assert.strictEqual(move.tier, undefined, `${move.id} (${move.type}) carries a tier its slate does not`);
    }
  }
});

test('move tiers: Early EXPIRES when Mid opens, Mid and Late accumulate, and an untiered move is ungated', () => {
  const early = moves.swiftBlow; // Iron, Early
  const mid = moves.momentumSwing; // Iron, Mid
  const late = moves.juggernaut; // Iron, Late
  assert.deepStrictEqual([early.tier, mid.tier, late.tier], ['early', 'mid', 'late']);

  assert.deepStrictEqual(
    [1, 2, 3].map((rank) => [early, mid, late].filter((m) => isMoveTierOfferable(m, rank)).map((m) => m.tier)),
    [['early'], ['mid'], ['mid', 'late']],
    'Early is off the table from MOVE_TIER_RANK.mid; nothing else ever closes'
  );

  assert.strictEqual(moves.runicBlast.tier, undefined);
  assert.ok(isMoveTierOfferable(moves.runicBlast, 1));
  assert.ok(isMoveTierOfferable(moves.runicBlast, MAX_MASTERY_RANK), 'and an untiered move never expires either');
  assert.ok(isMoveTierOfferable(undefined, 1), 'a missing move must not gate — it is a content bug, not a lock');

  assert.deepStrictEqual(MOVE_TIER_RANK, { early: 1, mid: 2, late: 3 });
  assert.deepStrictEqual(MOVE_TIER_RANK_EXPIRY, { early: MOVE_TIER_RANK.mid, mid: Infinity, late: Infinity });
  assert.strictEqual(MAX_MASTERY_RANK, MOVE_TIER_RANK.late, 'the top rank is the one that opens the last band');
});

test('mastery rank: DERIVED from Scrolls spent, three to a rank, clamped at the top', () => {
  const spentToRank = [0, 1, 2, 3, 4, 5, 6, 7, 20].map((spent) => masteryRank(entryAtRank('ironWarden', 1) && {
    ...entryAtRank('ironWarden', 1),
    masteryScrollsSpent: spent,
  }));
  assert.deepStrictEqual(spentToRank, [1, 1, 1, 2, 2, 2, 3, 3, 3], 'three Scrolls a rank, and it stops at the cap');

  const owed = [0, 1, 2, 3, 5, 6, 9].map((spent) =>
    scrollsToNextRank({ ...entryAtRank('ironWarden', 1), masteryScrollsSpent: spent })
  );
  assert.deepStrictEqual(owed, [3, 2, 1, 3, 1, 0, 0], 'and it counts down to the next threshold, 0 at the cap');
  assert.strictEqual(SCROLLS_TO_MAX, 6, 'six Scrolls max a hero');
});

test('move tiers: masteryMovePool only offers what the hero\'s RANK has reached', () => {
  // Warden's pool: ironFist/pinDown/rockToss/bodyBlow are Early or untiered, rendArmor Mid, juggernaut Late.
  const atOne = masteryMovePool(progressionTable, moves, entryAtRank('ironWarden', 1));
  assert.ok(!atOne.includes('rendArmor'), 'a Mid move must not be offered at rank 1');
  assert.ok(!atOne.includes('juggernaut'), 'a Late move must not be offered at rank 1');
  assert.ok(atOne.includes('ironFist'));

  const atTwo = masteryMovePool(progressionTable, moves, entryAtRank('ironWarden', 2));
  assert.ok(atTwo.includes('rendArmor'), 'Mid unlocks at rank 2');
  assert.ok(!atTwo.includes('juggernaut'));
  assert.ok(!atTwo.includes('ironFist'), 'and Early has EXPIRED — rank 2 never pays a starter-tier move');

  const atThree = masteryMovePool(progressionTable, moves, entryAtRank('ironWarden', 3));
  assert.ok(atThree.includes('juggernaut'), 'Late unlocks at rank 3');
  assert.ok(atThree.includes('rendArmor'), 'and Mid is still on the table — only Early ever closes');
  assert.ok(!atThree.includes('ironFist'));

  const held = masteryMovePool(progressionTable, moves, entryAtRank('ironWarden', 3, ['juggernaut']));
  assert.ok(!held.includes('juggernaut'));
});

test("move tiers: a graft's line is gated on REACHING a tier, so its Early moves survive the expiry", () => {
  // Gating learnableMoveIds the way the base pool is gated would make every Early move in a grafted
  // type's line dead on arrival for any hero already past rank 1 — and the Early moves are the way
  // INTO a type the hero has only just acquired.
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
  assert.ok(!isMoveTierOfferable(moves.drain, 2), 'Early is expired from rank 2');

  const grafted = entryAtRank('crimson', 2);
  const pool = masteryMovePool(progressionTable, moves, { ...grafted, chosenPathIds: [path.id] });
  assert.ok(pool.includes('drain'), 'the graft carries its own Early moves past the expiry');
  assert.ok(
    !masteryMovePool(progressionTable, moves, grafted).includes('drain'),
    'and only for a hero that actually took the path'
  );
  assert.ok(!pool.includes('setAlight'), "the BASE pool's Early half is still expired");
});

test('move tiers: every move pool holds something a rank-1 hero can be offered', () => {
  // A pool of nothing but Mid and Late moves means that hero learns nothing until rank 2.
  const starved = Object.keys(progressionTable.moveTiers)
    .filter((heroId) => masteryMovePool(progressionTable, moves, entryAtRank(heroId, 1)).length === 0)
    .sort();
  assert.deepStrictEqual(starved, [], 'these pools hold no move a rank-1 hero can be offered');
});

test('mastery scrolls: the rank ticks BEFORE the roll, so the third Scroll offers from the band it opens', () => {
  // The whole reason every third spend is the bigger moment rather than a silent deposit.
  const twoIn = { ...entryAtRank('ironWarden', 1), masteryScrollsSpent: SCROLLS_PER_RANK - 1 };
  assert.strictEqual(masteryRank(twoIn), 1);
  const pool = scrollMovePool(progressionTable, moves, twoIn);
  assert.ok(pool.includes('rendArmor'), 'the Scroll that reaches rank 2 rolls from Mid, not from Early');
  assert.ok(!pool.includes('ironFist'), 'and Early is already expired for it');
});

test('mastery scrolls: a spend takes one off the run and puts it on the hero, and never goes negative', () => {
  let run = runWith('ironWarden', 2);
  assert.strictEqual(run.masteryScrolls, 2);
  run = spendMasteryScroll(run, 'ironWarden');
  assert.strictEqual(run.masteryScrolls, 1);
  assert.strictEqual(run.roster[0].masteryScrollsSpent, 1);
  run = spendMasteryScroll(run, 'ironWarden');
  assert.strictEqual(run.masteryScrolls, 0);
  assert.throws(() => spendMasteryScroll(run, 'ironWarden'), /No Mastery Scrolls/);
});

test('mastery scrolls: a dry band still takes a Scroll below the cap, and is refused only at the top', () => {
  // The dead end this guards: a band CAN empty (offers burn whether taken or declined), and the
  // rank tick is the only thing that opens the next one — so refusing there would strand the hero.
  const wardenEarly = (progressionTable.moveTiers.ironWarden ?? []).filter((id) => (moves[id].tier ?? 'early') === 'early');
  const dryAtOne = { ...entryAtRank('ironWarden', 1), offeredMoveIds: wardenEarly };
  assert.deepStrictEqual(scrollMovePool(progressionTable, moves, dryAtOne), [], 'the band really is dry');
  assert.ok(
    canSpendScroll(progressionTable, moves, runWith('ironWarden', 1), dryAtOne),
    'below the cap the Scroll buys the tick, which is what gets the hero out of the band'
  );

  const wholePool = progressionTable.moveTiers.ironWarden ?? [];
  const finished = { ...entryAtRank('ironWarden', MAX_MASTERY_RANK), offeredMoveIds: wholePool };
  assert.deepStrictEqual(scrollMovePool(progressionTable, moves, finished), []);
  assert.ok(
    !canSpendScroll(progressionTable, moves, runWith('ironWarden', 1), finished),
    'at the cap with nothing left to teach, a Scroll would buy literally nothing'
  );

  assert.ok(
    !canSpendScroll(progressionTable, moves, addRosterEntry(createRunState(0), createRosterEntry('ironWarden', 'ironWarden', [])), entryAtRank('ironWarden', 1)),
    'and an empty Scroll pool refuses regardless'
  );
});

test('move tiers: the floor is a BAND surviving its own rank, not a curve', () => {
  // Scrolls make offers-per-hero player-controlled, so no depth can promise a pool "cannot be
  // emptied" the way MOVE_POOL_MARGIN did. What a band must survive is the SCROLLS_PER_RANK
  // offers it takes to climb out of it.
  assert.deepStrictEqual(movePoolFloor(), {
    early: SCROLLS_PER_RANK,
    mid: SCROLLS_PER_RANK,
    midLate: SCROLLS_PER_RANK,
  });
});

test('move tiers: every hero clears every band without it running dry', () => {
  const floor = movePoolFloor();
  const tierOf = (id: string) => moves[id].tier ?? 'early';
  for (const hero of Object.values(heroesById)) {
    const pool = (progressionTable.moveTiers[hero.id] ?? []).filter((id) => !hero.moveIds.includes(id));
    const early = pool.filter((id) => tierOf(id) === 'early').length;
    const mid = pool.filter((id) => tierOf(id) === 'mid').length;
    const midLate = pool.filter((id) => tierOf(id) !== 'early').length;
    assert.ok(early >= floor.early, `${hero.id} holds ${early} Early, floor is ${floor.early}`);
    assert.ok(mid >= floor.mid, `${hero.id} holds ${mid} Mid, floor is ${floor.mid}`);
    assert.ok(midLate >= floor.midLate, `${hero.id} holds ${midLate} Mid+Late, floor is ${floor.midLate}`);
  }
});

test('move tiers: every hero spends all six Scrolls with a move to show for each, down every path', () => {
  // The arithmetic above models the drain; this WALKS it through the real calls, so the
  // offeredMoveIds bookkeeping is in the loop. Both answers to an offer are exercised because both
  // spend it: declining burns the move exactly as taking it does.
  for (const hero of Object.values(heroesById)) {
    const paths = (progressionTable.evolutions[hero.id] ?? []).flatMap((node) => node.paths);
    for (const path of paths) {
      let run = grantMasteryScrolls(
        addRosterEntry(createRunState(0), {
          ...createRosterEntry(hero.id, hero.id, hero.moveIds),
          // The Evolution is on the level track, which no longer touches the movepool — take it
          // up front so the graft's line is in the pool for the whole climb.
          level: EVOLUTION_LEVEL,
        }),
        SCROLLS_TO_MAX
      );
      run = chooseEvolutionPath(run, progressionTable, heroesById, hero.id, path.id);

      let decline = false;
      for (let spent = 0; spent < SCROLLS_TO_MAX; spent++) {
        const before = run.roster[0];
        const offerable = scrollMovePool(progressionTable, moves, before);
        assert.ok(
          offerable.length > 0,
          `${hero.id} via ${path.id}: Scroll ${spent + 1} of ${SCROLLS_TO_MAX} had nothing to offer at rank ${masteryRank(before)}`
        );
        run = spendMasteryScroll(run, hero.id);
        const moveId = offerable[0];
        run = decline
          ? recordMoveOffer(run, hero.id, [moveId])
          : grantOfferedMove(run, hero.id, moveId, run.roster[0].unlockedMoveIds[0]);
        decline = !decline;
      }
      assert.strictEqual(masteryRank(run.roster[0]), MAX_MASTERY_RANK, `${hero.id} via ${path.id} did not reach max rank`);
    }
  }
});

test('move tiers: a loadout filled from the hero\'s own pool still leaves every band spendable', () => {
  // Worst case, not the tidy one: before a single Scroll, events fill the whole loadout with moves
  // out of this hero's own Early pool. They spend no offer (grantMove) but they are HELD, so
  // masteryMovePool filters them all the same — which is the thinnest a rank-1 band ever gets.
  for (const hero of Object.values(heroesById)) {
    let run = grantMasteryScrolls(
      addRosterEntry(createRunState(0), createRosterEntry(hero.id, hero.id, hero.moveIds)),
      SCROLLS_TO_MAX
    );
    for (let slot = 0; slot < MOVE_CAP; slot++) {
      const gift = masteryMovePool(progressionTable, moves, run.roster[0])[slot];
      if (!gift) break;
      run = grantMove(run, hero.id, gift, run.roster[0].unlockedMoveIds[0]);
    }
    assert.ok(
      canSpendScroll(progressionTable, moves, run, run.roster[0]),
      `${hero.id} cannot take a Scroll at all with a loadout drawn from its own pool`
    );
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
