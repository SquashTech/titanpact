// Frost's authored movepool (src/data/moves.ts, 2026-08-30) and the two engine
// fields it is the first content to need: `requiresTargetStatus` (Glaciate,
// Absolute Zero) and `conditionalPower.consumesStatus` (Cold Snap).
//
// Same discipline as test/fireMoves.test.ts and test/waterMoves.test.ts: these
// assert the MECHANIC with Frost's moves as the vehicle, not Frost's numbers,
// which are balance and will move. The facts that ARE pinned are the ones the
// design table locks and the two that are easy to get wrong and hard to notice
// afterwards:
//
//   1. a hard targeting gate is LEGALITY, not damage — an unmet gate fizzles
//      the action for no mana rather than landing a weaker hit, and it is read
//      LAST, after Stealth's redirect and Haunt's spread, so a gated strike
//      bounced onto an unmarked partner cannot sneak through;
//   2. a conditional multiplier lands on the formula's BasePower INPUT and
//      never leaks into multiplierTerm (CLAUDE.md two-pipeline separation),
//      and consuming the status is keyed off the multiplier that was ACTUALLY
//      applied — a conditional move that does not author `consumesStatus`
//      leaves the mark exactly where it found it.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { applyStatus, statusGatedTargets } from '../src/engine/combat/statusEngine';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState } from '../src/engine/state';
import { hasStatus } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Flurry (Int 70, mono Frost) and Rime (Atk 65, mono Frost) attack; ironWarden/wildOracle defend — the shape the other move-slate tests use. */
function frostFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'glacialWarden', side: 'A' },
      { combatantId: 'a2', heroId: 'rime', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

/**
 * The same two fixture problems every authored slate hits (authoring-moves.md
 * §8), solved once:
 *
 * - **Mana.** Frost's curve tops out at Avalanche's 75 and Absolute Zero /
 *   Ice Shatter's 70, all above every Frost hero's real pool. That is a live
 *   design finding (docs/combat.md), not something these tests should be
 *   gated on.
 * - **Lethality.** A defender that faints to the hit never reaches the riders,
 *   which would silently turn a consume test into a KO test. getMaxHp reads
 *   baseStats + statModifiers, so the hp modifier has to move with currentHp.
 */
function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      {
        ...c,
        currentMana: 999,
        currentHp: c.side === 'B' ? 1200 : c.currentHp,
        statModifiers: { ...c.statModifiers, manaPool: 999, ...(c.side === 'B' ? { hp: 1200 } : {}) },
      },
    ])
  );
  return { ...state, combatants } as CombatState;
}

function afflict(state: CombatState, combatantId: string, statusId: string, magnitude?: number): CombatState {
  return applyStatus(state, 1, combatantId, statuses[statusId], magnitude !== undefined ? { magnitude } : {}).state;
}

/** Stealth is duration-shaped and ticks at the START of a round, so one applied with no duration is stripped before any action resolves (statuses.ts). */
function stealth(state: CombatState, combatantId: string): CombatState {
  return applyStatus(state, 1, combatantId, statuses.Stealth, { duration: 2 }).state;
}

/** Forces `combatantId` to act first regardless of the fixture's stat lines — Speed is the tiebreak within a bracket, so a big enough modifier settles it. */
function outspeeds(state: CombatState, combatantId: string): CombatState {
  const c = state.combatants[combatantId];
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...c, statModifiers: { ...c.statModifiers, speed: 500 } } },
  };
}

// --- The pool itself -------------------------------------------------------

test('frost: the authored pool is exactly the fifteen designed moves, all Frost-typed', () => {
  const frost = Object.values(moves).filter((m) => m.type === 'Frost');
  assert.deepStrictEqual(
    frost.map((m) => m.id).sort(),
    [
      'absoluteZero', 'avalanche', 'coldSnap', 'deepChill', 'frigidAir', 'frostArmor', 'frostWall',
      'glaciate', 'iceShard', 'iceShatter', 'icicleThrust', 'permafrost', 'quickFreeze', 'rimeWind', 'snowBlast',
    ]
  );
});

test('frost: every "Spread" move in the design table targets both enemies, and the two "all other heroes" moves catch the partner', () => {
  const byTarget = (target: string) =>
    Object.values(moves)
      .filter((m) => m.type === 'Frost' && m.target === target)
      .map((m) => m.id)
      .sort();
  assert.deepStrictEqual(byTarget('bothEnemies'), ['avalanche', 'permafrost', 'rimeWind']);
  assert.deepStrictEqual(byTarget('allOthers'), ['frigidAir', 'snowBlast']);
});

test('frost: no Frost move applies a status the catalog does not define, or gates on one', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Frost') continue;
    if (move.statusApplication) {
      assert.ok(statuses[move.statusApplication.statusId], `${move.id} applies unknown status ${move.statusApplication.statusId}`);
    }
    if (move.requiresTargetStatus) {
      assert.ok(statuses[move.requiresTargetStatus], `${move.id} gates on unknown status ${move.requiresTargetStatus}`);
    }
    if (move.conditionalPower) {
      const scalesOff = move.conditionalPower.requiresTargetStatus ?? move.conditionalPower.requiresUserStatus;
      assert.ok(scalesOff && statuses[scalesOff], `${move.id} scales off unknown status`);
    }
  }
});

test('frost: Quick Freeze is the pool\'s only bracket play — everything else resolves at priority 0', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Frost') continue;
    assert.strictEqual(move.priority, move.id === 'quickFreeze' ? 1 : 0, `${move.id} has an unexpected priority bracket`);
  }
});

// --- MoveDefinition.requiresTargetStatus (Glaciate, Absolute Zero) ---------

test('frost: statusGatedTargets keeps only the marked candidates, and passes an ungated move straight through', () => {
  const state = afflict(withDeepPools(frostFixture(400)), 'b1', 'Freeze');
  assert.deepStrictEqual(statusGatedTargets(state, moves.glaciate, ['b1', 'b2']), ['b1']);
  assert.deepStrictEqual(statusGatedTargets(state, moves.glaciate, ['b2']), [], 'an empty result is the correct answer, not a fallback');
  assert.deepStrictEqual(statusGatedTargets(state, moves.snowBlast, ['b1', 'b2']), ['b1', 'b2']);
});

test('frost: Glaciate lands on a Frozen foe', () => {
  const state = afflict(withDeepPools(frostFixture(401)), 'b1', 'Freeze');
  const result = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'glaciate', declaredTarget: 'b1' }], config);

  const hit = result.events.find((e) => e.type === 'DamageDealt');
  assert.ok(hit && hit.type === 'DamageDealt' && hit.targetCombatantId === 'b1');
  assert.strictEqual(
    result.events.some((e) => e.type === 'ActionBlocked'),
    false
  );
});

test('frost: an unmet gate fizzles the action for NO mana rather than landing a weaker hit', () => {
  const state = withDeepPools(frostFixture(402)); // nobody is Frozen
  const result = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'glaciate', declaredTarget: 'b1' }], config);
  // Against a round in which a1 does nothing at all, rather than against its
  // mana before the round: the round-boundary regen tick (docs/mana.md) moves
  // the number either way, and what is being asserted is that nothing was SPENT.
  const idle = resolveRound(state, [], config);

  assert.ok(
    result.events.some((e) => e.type === 'ActionBlocked' && e.combatantId === 'a1' && e.reason === 'targetStatusMissing'),
    'the gate must name itself in the log rather than reusing noValidTarget'
  );
  assert.strictEqual(
    result.events.some((e) => e.type === 'DamageDealt'),
    false,
    'a gate is legality, not a damage penalty'
  );
  assert.strictEqual(
    result.events.some((e) => e.type === 'MoveUsed'),
    false
  );
  assert.strictEqual(result.state.combatants.a1.currentMana, idle.state.combatants.a1.currentMana, 'a fizzle costs the turn and nothing else');
});

test('frost: the gate reads the mark LIVE, so a Freeze applied earlier in the same round already counts', () => {
  // Deep Chill from the faster hero, Glaciate from the slower one, both
  // declared before either resolves. Same freshness rule the field-effect
  // context and conditionalPower follow (resolveRound.ts).
  const state = outspeeds(withDeepPools(frostFixture(403)), 'a2');
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a2', moveId: 'deepChill', declaredTarget: 'b1' },
    { kind: 'move', combatantId: 'a1', moveId: 'glaciate', declaredTarget: 'b1' },
  ];
  const result = resolveRound(state, actions, config);

  assert.strictEqual(
    result.events.some((e) => e.type === 'ActionBlocked'),
    false,
    'the mark was on the target by the time the gated move came up'
  );
  const hit = result.events.find((e) => e.type === 'DamageDealt' && e.moveId === 'glaciate');
  assert.ok(hit, 'Glaciate should have landed');
});

test('frost: Stealth redirecting a gated strike onto an unmarked partner fizzles it rather than letting it land', () => {
  // The reason the gate is applied AFTER the retargeting layers rather than
  // before them: Stealth moves a single-target hit to the partner, and the
  // partner was never a legal target for this move.
  const stealthed = stealth(afflict(withDeepPools(frostFixture(404)), 'b1', 'Freeze'), 'b1');
  const result = resolveRound(stealthed, [{ kind: 'move', combatantId: 'a1', moveId: 'glaciate', declaredTarget: 'b1' }], config);

  assert.ok(result.events.some((e) => e.type === 'ActionBlocked' && e.reason === 'targetStatusMissing'));
  assert.strictEqual(
    result.events.some((e) => e.type === 'DamageDealt'),
    false,
    'the redirect must not sneak a Frozen-only hit onto an unfrozen hero'
  );
});

// --- conditionalPower.consumesStatus (Cold Snap) ---------------------------

test('frost: Cold Snap doubles into a Frozen foe and spends the mark, and is a plain hit into a clean one', () => {
  const clean = withDeepPools(frostFixture(405));
  const frozen = afflict(clean, 'b1', 'Freeze');
  const action: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'coldSnap', declaredTarget: 'b1' }];

  const plain = resolveRound(clean, action, config);
  const cashed = resolveRound(frozen, action, config);

  const plainHit = plain.events.find((e) => e.type === 'DamageDealt');
  const cashedHit = cashed.events.find((e) => e.type === 'DamageDealt');
  assert.ok(plainHit && plainHit.type === 'DamageDealt');
  assert.ok(cashedHit && cashedHit.type === 'DamageDealt');

  assert.strictEqual(plainHit.basePowerMultiplier, 1);
  assert.strictEqual(cashedHit.basePowerMultiplier, 2);
  // Same seed, same roll: the ONLY difference is the BasePower input.
  assert.ok(Math.abs(cashedHit.amount - plainHit.amount * 2) <= 1, `${cashedHit.amount} should be about double ${plainHit.amount}`);

  assert.ok(
    cashed.events.some((e) => e.type === 'StatusRemoved' && e.combatantId === 'b1' && e.statusId === 'Freeze' && e.reason === 'consumed'),
    'the double is paid for with the mark'
  );
  assert.strictEqual(hasStatus(cashed.state.combatants.b1, 'Freeze'), false);
  assert.strictEqual(
    plain.events.some((e) => e.type === 'StatusRemoved'),
    false,
    'a hit that got no multiplier consumes nothing'
  );
});

test('frost: the conditional multiplier lands on BasePower and never leaks into multiplierTerm', () => {
  // CLAUDE.md's two-pipeline separation, asserted the same way
  // test/fireMoves.test.ts asserts it for Immolate: a BasePower-stage term and
  // a damage-pipeline modifier are not interchangeable, and mixing them is
  // invisible until two of them stack.
  const frozen = afflict(withDeepPools(frostFixture(406)), 'b1', 'Freeze');
  const result = resolveRound(frozen, [{ kind: 'move', combatantId: 'a2', moveId: 'coldSnap', declaredTarget: 'b1' }], config);

  const hit = result.events.find((e) => e.type === 'DamageDealt');
  assert.ok(hit && hit.type === 'DamageDealt');
  assert.strictEqual(hit.basePowerMultiplier, 2);
  assert.strictEqual(hit.multiplierTerm, 1, 'the conditional must not become a damage-pipeline modifier');
  assert.strictEqual(hit.basePower, 55, 'the event carries the AUTHORED base power, with the multiplier beside it');
});

test('frost: a conditional move that does not author consumesStatus leaves the mark exactly where it found it', () => {
  // Fire's Immolate is the control case — same conditionalPower shape, no
  // consumption, so the field is genuinely opt-in rather than implied by the
  // multiplier.
  assert.strictEqual(moves.immolate.conditionalPower?.consumesStatus, undefined);
  const burned = afflict(withDeepPools(frostFixture(407)), 'b1', 'Burn', 40);
  const result = resolveRound(burned, [{ kind: 'move', combatantId: 'a1', moveId: 'immolate', declaredTarget: 'b1' }], config);

  const hit = result.events.find((e) => e.type === 'DamageDealt');
  assert.ok(hit && hit.type === 'DamageDealt' && hit.basePowerMultiplier === 3);
  assert.strictEqual(
    result.events.some((e) => e.type === 'StatusRemoved' && e.reason === 'consumed'),
    false
  );
  assert.strictEqual(hasStatus(result.state.combatants.b1, 'Burn'), true);
});

// --- Distribution ----------------------------------------------------------

test('frost: every move id a hero or level-up pool points at actually exists', () => {
  // Nothing else catches a dangling id — the run layer only looks a move up
  // when the hero is offered it, which can be several fights in.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId}'s kit points at missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId}'s level-up pool points at missing move ${moveId}`);
  }
});

test('frost: no Frost hero starts with a move it cannot pay for, or has a starter listed in its own pool', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const heroId of ['glacialWarden', 'rime', 'cube']) {
    const hero = heroes[heroId];
    const cheapest = Math.min(...hero.moveIds.map((id) => moves[id].manaCost));
    assert.ok(cheapest <= hero.baseStats.manaPool, `${heroId} cannot afford its own cheapest starting move`);
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      // levelUpMovePool filters unlocked moves out, so a starter in the pool is
      // dead weight that can never be offered.
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('frost: every hero that can be offered a gated move can also reach a Freeze — the key and the lock ship together', () => {
  // A hero holding Absolute Zero with no way to mark anything would be the
  // trap pick CLAUDE.md's north star forbids, and nothing else in the build
  // would notice.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const marks = (moveId: string) => moves[moveId].statusApplication?.statusId === 'Freeze';
  for (const [heroId, hero] of Object.entries(heroes)) {
    const reachable = [...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])];
    if (!reachable.some((id) => moves[id].requiresTargetStatus)) continue;
    assert.ok(reachable.some(marks), `${heroId} can be offered a Frozen-only move but can never apply Freeze`);
  }
});
