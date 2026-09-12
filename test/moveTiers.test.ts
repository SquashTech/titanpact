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
import { classMoves } from '../src/data/classes';
import { progressionTable } from '../src/data/progression';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import type { RunState } from '../src/run/state';
import {
  masteryMovePool,
  masteryRank,
  rungsToNextRank,
  masteryRung,
  nextScrollCost,
  scrollCost,
  scrollsToReachRung,
  MAX_SCROLL_COST,
  EVOLUTION_RUNG,
  RUNGS_TO_MAX_RANK,
  scrollMovePool,
  canSpendScroll,
  spendMasteryScroll,
  grantMasteryScrolls,
  deferMastery,
  isMoveTierOfferable,
  grantOfferedMove,
  recordMoveOffer,
  chooseEvolutionPath,
  movePoolFloor,
  grantMove,
  MOVE_TIER_RANK,
  MOVE_TIER_RANK_EXPIRY,
  MAX_MASTERY_RANK,
  RANK_THRESHOLDS,
  SCROLLS_TO_MAX_RANK,
  EVOLUTION_SCROLLS,
  MOVE_CAP,
  availableEvolution,
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

/** Scrolls poured by the top rung — the pips the board draws reach it. Rank 3 is open-ended past it. */
const SCROLLS_TO_MAX = SCROLLS_TO_MAX_RANK;

function entryAtRank(heroId: string, rank: number, unlocked: readonly string[] = []) {
  let run = createRunState(0);
  run = addRosterEntry(run, {
    ...createRosterEntry(heroId, heroId, unlocked),
    masteryScrollsSpent: scrollsToReachRung(RANK_THRESHOLDS[rank - 1]),
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
    // A class move wears a type for flavour and no tier: it is in no pool (test/classes.test.ts).
    if (classMoves[move.id]) continue;
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

test('mastery ladder: a rung costs 1, 2, 3, 4, then MAX_SCROLL_COST — the old level-up curve, whole', () => {
  // docs/growth-overhaul.md §12. The price of the rung being climbed, flattening rather than rising forever.
  assert.strictEqual(MAX_SCROLL_COST, 5);
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6, 20].map(scrollCost), [1, 2, 3, 4, 5, 5, 5, 5]);
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6, 7].map(scrollsToReachRung), [0, 1, 3, 6, 10, 15, 20, 25], 'the triangular sum, then +5 a rung');

  // The old curve's landmarks, in Scrolls: Mid at 6 (level 4), the Evolution at 10 (level 5), Late at 20 (level 7).
  assert.strictEqual(scrollsToReachRung(RANK_THRESHOLDS[1]), 6);
  assert.strictEqual(EVOLUTION_SCROLLS, 10);
  assert.strictEqual(SCROLLS_TO_MAX, 20);

  // Rungs are DERIVED from the cumulative spend, exactly, and a between-rungs figure counts the rungs completed.
  const at = (spent: number) => ({ ...entryAtRank('ironWarden', 1), masteryScrollsSpent: spent });
  assert.deepStrictEqual([0, 1, 2, 3, 5, 6, 10, 15, 20, 99].map((spent) => masteryRung(at(spent))), [0, 1, 1, 2, 2, 3, 4, 5, 6, 21]);
  assert.deepStrictEqual([0, 1, 3, 6, 10, 20].map((spent) => nextScrollCost(at(spent))), [1, 2, 3, 4, 5, 5], 'the next rung is priced off the rung stood on');
});

test('mastery rank: DERIVED from rungs along the ladder — Rank 2 at 3, the Evolution at 4, Rank 3 at 6, open-ended past it', () => {
  assert.deepStrictEqual(RANK_THRESHOLDS, [0, 3, 6]);
  assert.strictEqual(EVOLUTION_RUNG, 4, 'the Evolution sits between the two rungs');
  assert.strictEqual(RUNGS_TO_MAX_RANK, 6);
  const rungToRank = [0, 2, 3, 4, 5, 6, 7, 20].map((rung) => masteryRank({ ...entryAtRank('ironWarden', 1), masteryScrollsSpent: scrollsToReachRung(rung) }));
  assert.deepStrictEqual(rungToRank, [1, 1, 2, 2, 2, 3, 3, 3], 'rungs at 3 and 6, and it stops at the cap');

  const owed = [0, 1, 2, 3, 4, 5, 6, 7].map((rung) => rungsToNextRank({ ...entryAtRank('ironWarden', 1), masteryScrollsSpent: scrollsToReachRung(rung) }));
  assert.deepStrictEqual(owed, [3, 2, 1, 3, 2, 1, 0, 0], 'and it counts down to the next threshold, 0 at the cap');
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

test('mastery scrolls: the rank ticks BEFORE the roll, so the Scroll that reaches a rung offers from the band it opens', () => {
  // The whole reason the rung Scroll is the bigger moment rather than a silent deposit.
  const twoIn = { ...entryAtRank('ironWarden', 1), masteryScrollsSpent: scrollsToReachRung(RANK_THRESHOLDS[1] - 1) };
  assert.strictEqual(masteryRank(twoIn), 1);
  const pool = scrollMovePool(progressionTable, moves, twoIn);
  assert.ok(pool.includes('rendArmor'), 'the rung that reaches rank 2 rolls from Mid, not from Early');
  assert.ok(!pool.includes('ironFist'), 'and Early is already expired for it');
});

test('mastery scrolls: a spend takes the rung\'s price off the run and puts it on the hero, and never goes negative', () => {
  let run = runWith('ironWarden', 3);
  assert.strictEqual(run.masteryScrolls, 3);
  run = spendMasteryScroll(run, 'ironWarden');
  assert.strictEqual(run.masteryScrolls, 2, 'the first rung cost 1');
  assert.strictEqual(run.roster[0].masteryScrollsSpent, 1);
  run = spendMasteryScroll(run, 'ironWarden');
  assert.strictEqual(run.masteryScrolls, 0, 'the second cost 2');
  assert.strictEqual(run.roster[0].masteryScrollsSpent, 3);
  assert.strictEqual(masteryRung(run.roster[0]), 2);
  assert.throws(() => spendMasteryScroll(run, 'ironWarden'), /costs 3 Mastery Scrolls, only 0 held/);
  // Two in the purse against a third rung priced 3: affordability, not emptiness, is the gate.
  const twoHeld = grantMasteryScrolls(run, 2);
  assert.ok(!canSpendScroll(progressionTable, moves, twoHeld, twoHeld.roster[0]), 'short of the price, the purse banks');
  assert.throws(() => spendMasteryScroll(twoHeld, 'ironWarden'), /only 2 held/);
  assert.ok(canSpendScroll(progressionTable, moves, grantMasteryScrolls(twoHeld, 1), twoHeld.roster[0]));
});

test('mastery scrolls: a grant clears a banked deferral, and the Vigil-less default is unbanked', () => {
  // docs/growth-overhaul.md §12: banking is never a dead end, because the next win re-asks.
  const run = runWith('ironWarden', 1);
  assert.strictEqual(run.masteryDeferred, false);
  const banked = deferMastery(run);
  assert.strictEqual(banked.masteryDeferred, true);
  assert.strictEqual(grantMasteryScrolls(banked, 1).masteryDeferred, false);
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
    !canSpendScroll(progressionTable, moves, runWith('ironWarden', 99), finished),
    'at the cap with nothing left to teach, a rung would buy literally nothing'
  );

  assert.ok(
    !canSpendScroll(progressionTable, moves, addRosterEntry(createRunState(0), createRosterEntry('ironWarden', 'ironWarden', [])), entryAtRank('ironWarden', 1)),
    'and an empty Scroll pool refuses regardless'
  );
});

test('move tiers: the floor is a BAND surviving its own rank, not a curve', () => {
  // Scrolls make offers-per-hero player-controlled, so no depth can promise a pool "cannot be
  // emptied" the way MOVE_POOL_MARGIN did. What a band must survive is the offers it takes to
  // climb out of it: two Early before the 3rd rung opens Mid, three Mid from there to the 6th (one
  // of them the Evolution, which offers nothing — the over-count is on the safe side), and
  // Mid+Late only has to offer once because Rank 3 is open-ended.
  assert.deepStrictEqual(movePoolFloor(), { early: 2, mid: 3, midLate: 1 });
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

test('move tiers: every hero climbs the whole ladder with a move to show for each rung, down every path', () => {
  // The arithmetic above models the drain; this WALKS it through the real calls, so the
  // offeredMoveIds bookkeeping is in the loop, and the Evolution lands where the ladder puts it
  // — on the EVOLUTION_RUNG, BEFORE that rung's offer, so a graft's line is in the pool the same
  // pour. Both answers to an offer are exercised because both spend it: declining burns the move
  // exactly as taking it does. The purse holds exactly what the top rung costs, so the walk is
  // also the price curve summed.
  for (const hero of Object.values(heroesById)) {
    const paths = (progressionTable.evolutions[hero.id] ?? []).flatMap((node) => node.paths);
    for (const path of paths) {
      let run = grantMasteryScrolls(
        addRosterEntry(createRunState(0), createRosterEntry(hero.id, hero.id, hero.moveIds)),
        SCROLLS_TO_MAX
      );

      let decline = false;
      for (let rung = 0; rung < RUNGS_TO_MAX_RANK; rung++) {
        run = spendMasteryScroll(run, hero.id);
        assert.strictEqual(masteryRung(run.roster[0]), rung + 1);
        if (availableEvolution(progressionTable, run.roster[0])) {
          assert.strictEqual(run.roster[0].masteryScrollsSpent, EVOLUTION_SCROLLS, `${hero.id}: the Evolution opened off the rung`);
          run = chooseEvolutionPath(run, progressionTable, heroesById, hero.id, path.id);
        }
        const after = run.roster[0];
        const offerable = masteryMovePool(progressionTable, moves, after);
        assert.ok(
          offerable.length > 0,
          `${hero.id} via ${path.id}: rung ${rung + 1} of ${RUNGS_TO_MAX_RANK} had nothing to offer at rank ${masteryRank(after)}`
        );
        const moveId = offerable[0];
        run = decline
          ? recordMoveOffer(run, hero.id, [moveId])
          : grantOfferedMove(run, hero.id, moveId, run.roster[0].unlockedMoveIds[0]);
        decline = !decline;
      }
      assert.strictEqual(masteryRank(run.roster[0]), MAX_MASTERY_RANK, `${hero.id} via ${path.id} did not reach max rank`);
      assert.strictEqual(run.masteryScrolls, 0, `${hero.id}: the top rung costs exactly SCROLLS_TO_MAX_RANK`);
      assert.ok(run.roster[0].chosenPathIds.includes(path.id), `${hero.id} via ${path.id} never evolved`);
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

test('move tiers: every hero has an Evolution node — the precondition the ladder walk asserts on', () => {
  // The walk above asserts the Evolution rung evolves; a hero with no node would pass it as a plain
  // offer, which is how Tempest sat evolution-less without a single test noticing.
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
