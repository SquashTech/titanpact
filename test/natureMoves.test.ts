// Nature's authored movepool (src/data/moves.ts, 2026-08-30) and the two engine
// fields it is the first content to need:
//
//   - `conditionalPower.requiresUserStatus` (Seed Shot, Branch Slam) — the same
//     BasePower-stage multiplier Immolate and Cold Snap use, asked of the
//     ATTACKER instead of the defender. The first damage bonus in the game you
//     set up on yourself rather than inflict;
//   - `detonatesStatus` (Miasma) — forcing a 'timer'-shape status to pay out
//     NOW instead of when its clock runs down.
//
// Same discipline as fire/water/frost/storm/stoneMoves: these assert the
// MECHANIC with Nature's moves as the vehicle, never Nature's numbers, which are
// balance and will move. What IS pinned is what is easy to get wrong and hard to
// notice afterwards:
//
//   1. the user-side multiplier lands on the formula's BasePower INPUT and not
//      on `multiplierTerm` — the two-pipeline separation is LOCKED (CLAUDE.md),
//      and a term on the wrong side of it is invisible until two of them stack;
//   2. it reads the ATTACKER, so a spread cast is doubled against every target
//      or none, where the target-side form varies per foe. That asymmetry is the
//      whole difference between the two halves of one field;
//   3. Miasma's detonation resolves AFTER its own statusApplication, which is
//      what makes the design row's "apply Poison 5, THEN detonate" true rather
//      than merely the order it was written in;
//   4. a forced detonation is worth exactly what the timer's own expiry would
//      have been worth, and emits the same three events in the same order the
//      view already knows how to bundle (buildBeats.ts).

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
import { applyStatus, detonateStatusNow } from '../src/engine/combat/statusEngine';
import { calcDamage, resolveConditionalPowerMultiplier } from '../src/engine/damage/damagePipeline';
import type { CombatState } from '../src/engine/state';
import { getMaxHp, hasStatus } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Sylva (the magical line) and Mordrax (the physical one) attack; Warden and Sentinel defend. */
function natureFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'wildOracle', side: 'A' },
      { combatantId: 'a2', heroId: 'mordax', side: 'A' },
      { combatantId: 'a3', heroId: 'hollowbark', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/**
 * The two fixture problems every authored slate hits (authoring-moves.md §8),
 * solved once:
 *
 * - **Mana.** Nature's curve tops out at 75, above every Nature hero's STARTING
 *   pool — which is the intended shape (docs/mana.md, pools grow all run), not
 *   something these tests should be gated on.
 * - **Lethality.** A defender that faints to the hit never reaches the riders,
 *   which would silently turn a Poison test into a KO test. getMaxHp reads
 *   baseStats + statModifiers, so the hp modifier has to move with currentHp.
 */
function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      { ...c, currentMana: 999, currentHp: 1200, statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 } },
    ])
  );
  return { ...state, combatants } as CombatState;
}

/** Puts `magnitude` Renew on one combatant through the real status engine. */
function withRenew(state: CombatState, combatantId: string, magnitude: number): CombatState {
  return applyStatus(state, 1, combatantId, statuses.Renew, { magnitude }).state;
}

/** Puts `magnitude` Poison on one combatant, on a fresh 3-round timer. */
function withPoison(state: CombatState, combatantId: string, magnitude: number): CombatState {
  return applyStatus(state, 1, combatantId, statuses.Poison, { magnitude, duration: 3 }).state;
}

// --- conditionalPower.requiresUserStatus: the mirror of the target-side form -

test('nature: Seed Shot doubles off the USER carrying Renew, not the target', () => {
  const plain = withDeepPools(natureFixture(101));
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.seedShot, plain.combatants.b1, plain.combatants.a1), 1);

  // Renew on the DEFENDER must not satisfy a user-side condition — the exact
  // confusion the second field exists to make impossible.
  const renewedTarget = withRenew(plain, 'b1', 20);
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.seedShot, renewedTarget.combatants.b1, renewedTarget.combatants.a1),
    1,
    "the target's Renew is not the caster's"
  );

  const renewedUser = withRenew(plain, 'a1', 20);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.seedShot, renewedUser.combatants.b1, renewedUser.combatants.a1), 2);

  // And the older target-side form still reads the target, unchanged.
  const frozen = applyStatus(plain, 1, 'b1', statuses.Freeze, {}).state;
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.coldSnap, frozen.combatants.b1, frozen.combatants.a1), 2);
});

test('nature: the user-side multiplier is a BasePower-stage term, not a damage modifier', () => {
  // The LOCKED two-pipeline separation (CLAUDE.md), asserted structurally for
  // the same reason test/fireMoves.test.ts asserts it for Immolate: a term on
  // the wrong side of the split produces identical damage until a second
  // modifier stacks against it, at which point it is already shipped.
  const doubled = calcDamage(moves.branchSlam, 1, ['Nature'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 2);
  assert.strictEqual(doubled.basePowerMultiplier, 2, 'the multiplier rides the BasePower input');
  assert.strictEqual(doubled.multiplierTerm, 1, 'and never becomes a multiplier on the finished hit');

  const plain = calcDamage(moves.branchSlam, 1, ['Nature'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 1);
  assert.strictEqual(doubled.damage, plain.damage * 2, 'BasePower is linear, so ×2 BasePower is ×2 damage');
});

test('nature: Branch Slam actually hits twice as hard through resolveRound once the caster holds Renew', () => {
  const swing = (renewed: boolean) => {
    const base = withDeepPools(natureFixture(102));
    const state = renewed ? withRenew(base, 'a2', 20) : base;
    const { events } = resolveRound(
      state,
      [{ kind: 'move', combatantId: 'a2', moveId: 'branchSlam', declaredTarget: 'b1' }],
      config
    );
    const hit = events.find((e) => e.type === 'DamageDealt');
    return hit && hit.type === 'DamageDealt' ? hit : null;
  };

  const bare = swing(false);
  const boosted = swing(true);
  assert.ok(bare && boosted);
  // Same seed, so the same variance and crit roll — the only difference is the
  // BasePower term the event now carries.
  assert.strictEqual(bare.basePowerMultiplier, 1);
  assert.strictEqual(boosted.basePowerMultiplier, 2);
  assert.ok(boosted.amount > bare.amount, `expected the Renewed swing to hit harder (${boosted.amount} vs ${bare.amount})`);
});

test('nature: a Renew granted earlier in the SAME round already counts', () => {
  // The freshness rule that matters more on the user side than it ever did on
  // the target side: Sylva (speed 65) outruns Mordrax (50), so Regrowth lands
  // on both allies before Branch Slam resolves.
  const state = withDeepPools(natureFixture(103));
  const { events } = resolveRound(
    state,
    [
      { kind: 'move', combatantId: 'a1', moveId: 'regrowth' },
      { kind: 'move', combatantId: 'a2', moveId: 'branchSlam', declaredTarget: 'b1' },
    ],
    config
  );
  const hit = events.find((e) => e.type === 'DamageDealt');
  assert.ok(hit && hit.type === 'DamageDealt');
  assert.strictEqual(hit.basePowerMultiplier, 2, "the partner's Renew arrived in time");
});

test('nature: a user-side conditional is all-or-nothing across a spread, where a target-side one is per target', () => {
  // The asymmetry worth pinning: the target-side form is read per hit off each
  // defender, so it can double against one foe and not the other. The user-side
  // form asks one question about one combatant, so every target of a single cast
  // gets the same answer.
  const state = withRenew(withDeepPools(natureFixture(104)), 'a1', 20);
  const spread = { ...moves.blight, id: 'testSpreadSeedShot', kind: 'damage' as const, basePower: 30, statusApplication: undefined, conditionalPower: moves.seedShot.conditionalPower };
  const withSpread = { ...config, moves: { ...moves, testSpreadSeedShot: spread } };
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'testSpreadSeedShot' }], withSpread);
  const mults = events.filter((e) => e.type === 'DamageDealt').map((e) => (e.type === 'DamageDealt' ? e.basePowerMultiplier : 0));
  assert.deepStrictEqual(mults, [2, 2], 'one question about the caster, one answer for every target');
});

test('nature: neither user-side move consumes the Renew it read', () => {
  // Deliberate, and the reason consumesStatus is authored on neither: the same
  // Renew is also healing the caster and, under Verdant Earth, IS its Attack
  // and Intelligence (fieldEffects.ts). One press must not undo the other two.
  assert.strictEqual(moves.seedShot.conditionalPower?.consumesStatus, undefined);
  assert.strictEqual(moves.branchSlam.conditionalPower?.consumesStatus, undefined);

  const state = withRenew(withDeepPools(natureFixture(105)), 'a1', 40);
  const { state: after } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'seedShot', declaredTarget: 'b1' }],
    config
  );
  assert.ok(hasStatus(after.combatants.a1, 'Renew'), 'the caster keeps it');
});

// --- detonatesStatus: paying a timer out early ------------------------------

test('nature: Miasma detonates the accumulated Poison, its own application included', () => {
  const state = withPoison(withDeepPools(natureFixture(201)), 'b1', 20);
  const maxHp = getMaxHp(heroes[state.combatants.b1.heroId], state.combatants.b1);

  const { events, state: after } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'miasma', declaredTarget: 'b1' }],
    config
  );

  const detonation = events.find((e) => e.type === 'StatusDetonated');
  assert.ok(detonation && detonation.type === 'StatusDetonated');
  // 20 already standing + the 5 Miasma plants, because the detonation resolves
  // AFTER the statusApplication (resolveRound.ts). This is the design row's
  // "apply Poison 5, THEN detonate" as an assertion.
  assert.strictEqual(detonation.amount, Math.ceil((maxHp * 25) / 100));
  assert.strictEqual(hasStatus(after.combatants.b1, 'Poison'), false, 'the stack is spent, not left ticking');
});

test('nature: Miasma into a clean target is worth only the Poison it brought with it', () => {
  const state = withDeepPools(natureFixture(202));
  const maxHp = getMaxHp(heroes[state.combatants.b1.heroId], state.combatants.b1);
  const { events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'miasma', declaredTarget: 'b1' }],
    config
  );
  const detonation = events.find((e) => e.type === 'StatusDetonated');
  assert.ok(detonation && detonation.type === 'StatusDetonated');
  assert.strictEqual(detonation.amount, Math.ceil((maxHp * 5) / 100));
});

test('nature: a forced detonation is worth exactly what the timer expiry would have been', () => {
  // The invariant Miasma is priced against: it buys TIME, not damage. If these
  // two numbers ever diverge, the move has quietly become its own damage source.
  const state = withPoison(withDeepPools(natureFixture(203)), 'b1', 30);
  const maxHp = getMaxHp(heroes[state.combatants.b1.heroId], state.combatants.b1);

  const forced = detonateStatusNow(state, 1, 'b1', 'Poison', statuses, maxHp);

  // The natural path: three empty rounds, letting the timer run down on its own.
  let waited = state;
  let expiryAmount = 0;
  for (let i = 0; i < 3; i++) {
    const round = resolveRound(waited, [], config);
    waited = round.state;
    const tick = round.events.find((e) => e.type === 'StatusTicked' && e.statusId === 'Poison' && e.kind === 'damage');
    if (tick && tick.type === 'StatusTicked') expiryAmount = tick.amount;
  }

  assert.ok(expiryAmount > 0, 'the timer did run out on its own');
  assert.strictEqual(forced.amount, expiryAmount);
});

test('nature: the detonation emits Detonated / Removed / HpChanged, in the order the view bundles', () => {
  // buildBeats.ts reads exactly this run of events to fold the pop, the status
  // clear and the bar drain into one tap — a different order silently splits
  // Miasma into three beats.
  const state = withPoison(withDeepPools(natureFixture(204)), 'b1', 20);
  const { events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'miasma', declaredTarget: 'b1' }],
    config
  );
  const from = events.findIndex((e) => e.type === 'StatusDetonated');
  assert.ok(from >= 0);
  assert.strictEqual(events[from + 1].type, 'StatusRemoved');
  assert.strictEqual((events[from + 1] as { reason?: string }).reason, 'consumed', 'spent, not expired');
  assert.strictEqual(events[from + 2].type, 'HpChanged');
});

test('nature: detonatesStatus is gated on the timer SHAPE, not on a status id', () => {
  // Naming a magnitude/boolean/duration status is a silent no-op rather than an
  // error — the same guard discipline statusApplication's unknown-id lookup uses.
  const state = withRenew(withDeepPools(natureFixture(205)), 'b1', 20);
  const maxHp = getMaxHp(heroes[state.combatants.b1.heroId], state.combatants.b1);

  const renew = detonateStatusNow(state, 1, 'b1', 'Renew', statuses, maxHp);
  assert.strictEqual(renew.amount, 0);
  assert.deepStrictEqual(renew.events, []);
  assert.ok(hasStatus(renew.state.combatants.b1, 'Renew'), 'a HoT is untouched');

  const absent = detonateStatusNow(state, 1, 'b1', 'Poison', statuses, maxHp);
  assert.strictEqual(absent.amount, 0, 'and nothing happens with no timer running');
  assert.deepStrictEqual(absent.events, []);
});

// --- the slate's own shape --------------------------------------------------

test('nature: no Nature move applies, gates on, or detonates a status the catalog does not define', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Nature') continue;
    if (move.statusApplication) {
      assert.ok(statuses[move.statusApplication.statusId], `${move.id} applies unknown status ${move.statusApplication.statusId}`);
    }
    if (move.detonatesStatus) {
      const def = statuses[move.detonatesStatus];
      assert.ok(def, `${move.id} detonates unknown status ${move.detonatesStatus}`);
      assert.strictEqual(def.pipeline, 'timer', `${move.id} detonates ${def.id}, which holds no payload to detonate`);
    }
    if (move.conditionalPower) {
      const scalesOff = move.conditionalPower.requiresTargetStatus ?? move.conditionalPower.requiresUserStatus;
      assert.ok(scalesOff && statuses[scalesOff], `${move.id} scales off unknown status`);
    }
  }
});

test('nature: every Nature move resolves in bracket 0 — the slate authors no priority column', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Nature') continue;
    assert.strictEqual(move.priority, 0, `${move.id} has an unexpected priority bracket`);
  }
});

test('nature: every Poison applier authors the timer duration the shape requires', () => {
  // There is no isValidMoveDefinition (authoring-moves.md §4), so a timer-shape
  // status authored with no duration would sit at 0 and detonate on the very
  // next tick instead of in three rounds.
  for (const move of Object.values(moves)) {
    if (move.statusApplication?.statusId !== 'Poison') continue;
    assert.ok(
      (move.statusApplication.duration ?? 0) > 0,
      `${move.id} applies Poison with no timer`
    );
  }
});

// --- Distribution -----------------------------------------------------------

test('nature: every move id a hero or level-up pool points at actually exists', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId}'s kit points at missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId}'s level-up pool points at missing move ${moveId}`);
  }
});

test('nature: no Nature hero starts with a move it cannot pay for, or has a starter listed in its own pool', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const heroId of ['wildOracle', 'mordax', 'hollowbark']) {
    const hero = heroes[heroId];
    for (const moveId of hero.moveIds) {
      assert.ok(
        moves[moveId].manaCost <= hero.baseStats.manaPool,
        `${heroId} cannot afford its own starting move ${moveId} — the one thing a player cannot fix by drafting`
      );
    }
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test("nature: every hero that can be offered a user-side conditional can also reach Renew", () => {
  // The equivalent of frostMoves' "the gate has a guaranteed key in the same
  // pool" assertion. Nothing in the ENGINE pairs these — a Branch Slam on a hero
  // with no route to Renew is a permanently half-power move, which is the trap
  // pick the north star forbids (CLAUDE.md).
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const grantsRenew = (moveId: string) => {
    const app = moves[moveId]?.statusApplication;
    return app?.statusId === 'Renew' && app.chance === undefined;
  };
  for (const [heroId, hero] of Object.entries(heroes)) {
    const reachable = [...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])];
    const conditionals = reachable.filter((id) => moves[id]?.conditionalPower?.requiresUserStatus === 'Renew');
    if (conditionals.length === 0) continue;
    assert.ok(
      reachable.some(grantsRenew),
      `${heroId} can be offered ${conditionals.join('/')} but has no guaranteed Renew to turn it on`
    );
  }
});
