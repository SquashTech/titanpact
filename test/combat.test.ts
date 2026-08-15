import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import { isLockedIn } from '../src/engine/state';
import { applyVoluntarySwitch, SwitchBlockedError } from '../src/engine/combat/switching';
import { isValidFlatStatGrant } from '../src/engine/content';

const config = { typeChart, heroes, moves, benchHpRegenFlat: 5 };

function twoVTwoFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

// --- Invariant tests -------------------------------------------------------

test('invariant: lock-in engages at exactly 2 KOs, not before', () => {
  const state = twoVTwoFixture(1);
  const oneKo = { ...state, koCount: { ...state.koCount, A: 1 } };
  const twoKo = { ...state, koCount: { ...state.koCount, A: 2 } };
  assert.strictEqual(isLockedIn(oneKo, 'A'), false);
  assert.strictEqual(isLockedIn(twoKo, 'A'), true);
});

test('invariant: locked-in side cannot voluntarily switch', () => {
  const state = twoVTwoFixture(2);
  const locked = { ...state, koCount: { ...state.koCount, A: 2 }, bench: { ...state.bench, A: ['bench1'] } };
  assert.throws(() => applyVoluntarySwitch(locked, 1, 'a1', 'bench1'), SwitchBlockedError);
});

test('invariant: engine never mutates content data (heroes/moves untouched by reference)', () => {
  const state = twoVTwoFixture(3);
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' },
    { kind: 'move', combatantId: 'a2', moveId: 'tidalBolt', declaredTarget: 'b1' },
    { kind: 'move', combatantId: 'b1', moveId: 'quickJab', declaredTarget: 'a1' },
    { kind: 'move', combatantId: 'b2', moveId: 'wildfire' },
  ];
  const heroesBefore = heroes;
  resolveRound(state, actions, config);
  assert.strictEqual(heroes, heroesBefore); // same object reference: never reassigned or mutated
  assert.strictEqual(heroes.cinderKnight.types.length, 1); // innate type shape untouched
});

test('invariant: stat grants must be multiples of 5 or 10', () => {
  assert.strictEqual(isValidFlatStatGrant(10), true);
  assert.strictEqual(isValidFlatStatGrant(-5), true);
  assert.strictEqual(isValidFlatStatGrant(0), true);
  assert.strictEqual(isValidFlatStatGrant(7), false);
  assert.strictEqual(isValidFlatStatGrant(12), false);
});

// --- Golden replay / determinism -------------------------------------------

test('golden replay: same seed + same inputs reproduce an identical event log', () => {
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' },
    { kind: 'move', combatantId: 'a2', moveId: 'tidalBolt', declaredTarget: 'b2' },
    { kind: 'move', combatantId: 'b1', moveId: 'quickJab', declaredTarget: 'a1' },
    { kind: 'move', combatantId: 'b2', moveId: 'wildfire' },
  ];

  const stateA = twoVTwoFixture(555);
  const stateB = twoVTwoFixture(555);
  const resultA = resolveRound(stateA, actions, config);
  const resultB = resolveRound(stateB, actions, config);

  assert.deepStrictEqual(resultA.events, resultB.events);
  assert.deepStrictEqual(resultA.state, resultB.state);
});

test('golden replay: a different seed produces a different (but still valid) log', () => {
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }];
  const resultA = resolveRound(twoVTwoFixture(1), actions, config);
  const resultB = resolveRound(twoVTwoFixture(2), actions, config);
  assert.notDeepStrictEqual(resultA.events, resultB.events);
});

// --- Round integration -------------------------------------------------

test('round: RoundStarted is first event, RoundEnded is last', () => {
  const state = twoVTwoFixture(10);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }];
  const { events } = resolveRound(state, actions, config);
  assert.strictEqual(events[0].type, 'RoundStarted');
  assert.strictEqual(events[events.length - 1].type, 'RoundEnded');
});

test('round: a resolved move spends mana and deals damage', () => {
  const state = twoVTwoFixture(11);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.strictEqual(next.combatants.a1.currentMana, heroes.cinderKnight.baseStats.manaPool - moves.emberSlash.manaCost);
  assert.ok(next.combatants.b1.currentHp < heroes.ironWarden.baseStats.hp);
  assert.ok(events.some((e) => e.type === 'DamageDealt'));
  assert.ok(events.some((e) => e.type === 'HpChanged'));
});

test('round: higher priority move resolves before a higher-speed move in a lower bracket', () => {
  const state = twoVTwoFixture(12);
  // quickJab (priority 1) from the slower b1 should still resolve before emberSlash (priority 0) from faster a1.
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' },
    { kind: 'move', combatantId: 'b1', moveId: 'quickJab', declaredTarget: 'a1' },
  ];
  const { events } = resolveRound(state, actions, config);
  const moveUsedOrder = events.filter((e) => e.type === 'MoveUsed').map((e: any) => e.combatantId);
  assert.deepStrictEqual(moveUsedOrder, ['b1', 'a1']);
});

test('round: an unaffordable move is a legality no-op (engine-level guard)', () => {
  const state = twoVTwoFixture(13);
  const actions: Action[] = [{ kind: 'move', combatantId: 'b2', moveId: 'overload', declaredTarget: 'a1' }];
  const { state: next, events } = resolveRound(state, actions, config);
  assert.strictEqual(events.some((e) => e.type === 'MoveUsed'), false);
  assert.strictEqual(next.combatants.a1.currentHp, heroes.cinderKnight.baseStats.hp);
});

test('round: KO increments KO count and emits Fainted, clearing the active slot', () => {
  const state = twoVTwoFixture(14);
  // Overwrite b1 to 1 HP so a single hit KOs it.
  const damaged = { ...state, combatants: { ...state.combatants, b1: { ...state.combatants.b1, currentHp: 1 } } };
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(damaged, actions, config);

  assert.strictEqual(next.koCount.B, 1);
  assert.strictEqual(next.combatants.b1.fainted, true);
  assert.strictEqual(next.active.B[0], null);
  assert.ok(events.some((e) => e.type === 'Fainted'));
});

test('round: bench regen ticks for a damaged benched combatant, clamped at max HP', () => {
  const state = twoVTwoFixture(15);
  const maxHp = heroes.wildOracle.baseStats.hp; // b2 is wildOracle
  const withBench = {
    ...state,
    active: { ...state.active, B: ['b1', null] as [string | null, string | null] },
    bench: { ...state.bench, B: ['b2'] },
    combatants: { ...state.combatants, b2: { ...state.combatants.b2, currentHp: maxHp - 2 } },
  };
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(withBench, actions, config);

  const tick = events.find((e) => e.type === 'BenchRegenTicked' && (e as any).combatantId === 'b2') as any;
  assert.ok(tick, 'expected a BenchRegenTicked event for b2');
  assert.strictEqual(tick.hpRegen, 2); // clamped: only 2 HP of headroom even though benchHpRegenFlat is 5
  assert.strictEqual(next.combatants.b2.currentHp, maxHp);
});
