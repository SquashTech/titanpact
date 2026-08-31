// The level-up tier gate (2026-08-31): a move's authored `Early / Mid / Late`
// column (engine/content.ts MoveDefinition.tier) decides the hero level at
// which it may first be OFFERED — run/progression.ts MOVE_TIER_LEVEL, applied
// by levelUpMovePool. Two separate things are pinned here:
//
//   1. the MECHANISM (cumulative gating, the level read, the default), and
//   2. the DATA — which type slates actually carry a tier column.
//
// (2) matters because an omitted tier reads as Early, i.e. ungated. That is
// the deliberate default (no move is ever gated by an unauthored guess), but
// it means a slate silently losing its tiers would look exactly like the
// pre-gate behavior and nothing else would notice. TIERED_TYPES below is the
// record of which slates are done; grow it as the designer supplies the
// remaining tier columns.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { levelUpMovePool, isMoveTierUnlocked, MOVE_TIER_LEVEL } from '../src/run/progression';
import type { MoveTier, TypeId } from '../src/engine/content';

/**
 * Every AUTHORED slate. Each must carry a tier on every move; every other
 * type is deliberately untiered — see docs/authoring-moves.md §2. Ancient is
 * the only type left out, and only because it is still two fixture moves
 * with no authored slate behind them: nothing to read a tier column off.
 *
 * Every one of them carries the designer's own column, verified against the
 * source table on 2026-08-31 — see the TIER PROVENANCE block in moves.ts for
 * how eleven of the fourteen got there and what that exercise proved.
 */
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

  // A tiered slate that lost a whole tier is the failure this catches: the
  // block markers in moves.ts are comments, and a rewrite could drop one.
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

  // The default: no authored tier reads as Early, i.e. offerable from level 1.
  // Ancient is the only untiered type left (no authored slate behind it yet).
  assert.strictEqual(moves.runicBlast.tier, undefined);
  assert.ok(isMoveTierUnlocked(moves.runicBlast, 1));
  assert.ok(isMoveTierUnlocked(undefined, 1), 'a missing move must not gate — it is a content bug, not a lock');

  assert.deepStrictEqual(MOVE_TIER_LEVEL, { early: 1, mid: 4, late: 7 });
});

test('move tiers: levelUpMovePool only offers what the hero\'s level has reached', () => {
  // Warden's pool is the clearest case in the fixture table: ironFist/pinDown/
  // rockToss/bodyBlow are Early or untiered, rendArmor is Mid, juggernaut Late.
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

  // The gate composes with the already-unlocked filter rather than replacing it.
  const held = levelUpMovePool(progressionTable, moves, entryAt('ironWarden', 9, ['juggernaut']));
  assert.ok(!held.includes('juggernaut'));
});

test('move tiers: every level-up pool holds something a level-1 hero can be offered', () => {
  // The invariant the gate created, and the first thing to check if the early
  // game reads as flat. A pool of nothing but Mid and Late moves means that
  // hero learns NOTHING until level 4 — its level-up card reads "Level only"
  // three times over.
  //
  // Six pools were in exactly that state when the gate landed (Sylva, Tempest,
  // Vesper, Marrow, Nightshade, Bellows) — they were authored while the tier
  // column was documentation only (docs/authoring-moves.md §7 told slate
  // authors it was "your guide for which hero gets what, not a value you
  // encode"), so nothing ever asked them to hold an Early move. All six were
  // given one on 2026-08-31; see the comments on each in data/progression.ts
  // for what each type's Early tier actually left available.
  const starved = Object.keys(progressionTable.moveTiers)
    .filter((heroId) => levelUpMovePool(progressionTable, moves, entryAt(heroId, 1)).length === 0)
    .sort();
  assert.deepStrictEqual(starved, [], 'these pools hold no move a level-1 hero can be offered');
});

test('move tiers: a pool can legitimately empty out, which the screen reads as "Level only"', () => {
  // Every Early/untiered entry already unlocked, nothing Mid+ reached yet.
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
