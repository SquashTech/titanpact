// Nature's authored movepool: conditionalPower.requiresUserStatus and detonatesStatus. Mechanics, not numbers.

import { firstStatusApplication, statusApplicationsOf } from '../src/engine/content';
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

/** Deep mana and HP so no test is gated on the mana curve or turned into a KO test; the hp modifier moves with currentHp because getMaxHp reads both. */
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

// --- conditionalPower.requiresUserStatus ---

test('nature: Seed Shot doubles off the USER carrying Renew, not the target', () => {
  const plain = withDeepPools(natureFixture(101));
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.seedShot, plain.combatants.b1, plain.combatants.a1), 1);

  const renewedTarget = withRenew(plain, 'b1', 20);
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.seedShot, renewedTarget.combatants.b1, renewedTarget.combatants.a1),
    1,
    "the target's Renew is not the caster's"
  );

  const renewedUser = withRenew(plain, 'a1', 20);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.seedShot, renewedUser.combatants.b1, renewedUser.combatants.a1), 2);

  const frozen = applyStatus(plain, 1, 'b1', statuses.Freeze, {}).state;
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.coldSnap, frozen.combatants.b1, frozen.combatants.a1), 2);
});

test('nature: the user-side multiplier is a BasePower-stage term, not a damage modifier', () => {
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
  assert.strictEqual(bare.basePowerMultiplier, 1);
  assert.strictEqual(boosted.basePowerMultiplier, 2);
  assert.ok(boosted.amount > bare.amount, `expected the Renewed swing to hit harder (${boosted.amount} vs ${bare.amount})`);
});

test('nature: a Renew granted earlier in the SAME round already counts', () => {
  // Sylva (speed 65) outruns Mordrax (50), so Regrowth lands before Branch Slam resolves.
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
  const state = withRenew(withDeepPools(natureFixture(104)), 'a1', 20);
  const spread = { ...moves.blight, id: 'testSpreadSeedShot', kind: 'damage' as const, basePower: 30, statusApplication: undefined, conditionalPower: moves.seedShot.conditionalPower };
  const withSpread = { ...config, moves: { ...moves, testSpreadSeedShot: spread } };
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'testSpreadSeedShot' }], withSpread);
  const mults = events.filter((e) => e.type === 'DamageDealt').map((e) => (e.type === 'DamageDealt' ? e.basePowerMultiplier : 0));
  assert.deepStrictEqual(mults, [2, 2], 'one question about the caster, one answer for every target');
});

test('nature: neither user-side move consumes the Renew it read', () => {
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

// --- detonatesStatus ---

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
  // 20 standing + the 5 Miasma plants: the detonation resolves AFTER its own statusApplication.
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
  const state = withPoison(withDeepPools(natureFixture(203)), 'b1', 30);
  const maxHp = getMaxHp(heroes[state.combatants.b1.heroId], state.combatants.b1);

  const forced = detonateStatusNow(state, 1, 'b1', 'Poison', statuses, maxHp);

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

// --- The slate's own shape ---

test('nature: no Nature move applies, gates on, or detonates a status the catalog does not define', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Nature') continue;
    for (const app of statusApplicationsOf(move)) {
      assert.ok(statuses[app.statusId], `${move.id} applies unknown status ${app.statusId}`);
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
  // A timer-shape status with no duration sits at 0 and detonates on the next tick.
  for (const move of Object.values(moves)) {
    const app = firstStatusApplication(move);
    if (app?.statusId !== 'Poison') continue;
    assert.ok(
      (app.duration ?? 0) > 0,
      `${move.id} applies Poison with no timer`
    );
  }
});

// --- Distribution ---

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
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const grantsRenew = (moveId: string) => {
    const app = moves[moveId] ? firstStatusApplication(moves[moveId]) : undefined;
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
