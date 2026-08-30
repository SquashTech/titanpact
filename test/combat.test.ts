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
import type { Action } from '../src/engine/combat/actions';
import { isLockedIn, createCombatant, effectiveTypes, hasAffordableMove } from '../src/engine/state';
import { applyVoluntarySwitch, SwitchBlockedError } from '../src/engine/combat/switching';
import { isValidFlatStatGrant } from '../src/engine/content';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

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
  assert.throws(() => applyVoluntarySwitch(locked, 1, 'a1', 'bench1', statuses), SwitchBlockedError);
});

test('invariant: engine never mutates content data (heroes/moves untouched by reference)', () => {
  const state = twoVTwoFixture(3);
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' },
    { kind: 'move', combatantId: 'a2', moveId: 'tidalBolt', declaredTarget: 'b1' },
    { kind: 'move', combatantId: 'b1', moveId: 'quickJab', declaredTarget: 'a1' },
    { kind: 'move', combatantId: 'b2', moveId: 'firestorm' },
  ];
  const heroesBefore = heroes;
  resolveRound(state, actions, config);
  assert.strictEqual(heroes, heroesBefore); // same object reference: never reassigned or mutated
  assert.strictEqual(heroes.tidecaller.types.length, 1); // innate type shape untouched
});

test('effectiveTypes: a type-graft grant adds to the innate types without mutating HeroDefinition', () => {
  const hero = heroes.tidecaller; // mono Water
  const grafted = { ...createCombatant('x', 'tidecaller', 'A', 0, 0), grantedTypes: ['Stone'] };
  assert.deepStrictEqual(effectiveTypes(hero, grafted), ['Water', 'Stone']);
  assert.deepStrictEqual(hero.types, ['Water']); // innate type untouched by the grant
});

test('effectiveTypes: no graft returns exactly the innate types', () => {
  const hero = heroes.tidecaller;
  const plain = createCombatant('x', 'tidecaller', 'A', 0, 0);
  assert.deepStrictEqual(effectiveTypes(hero, plain), ['Water']);
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
    { kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' },
    { kind: 'move', combatantId: 'a2', moveId: 'tidalBolt', declaredTarget: 'b2' },
    { kind: 'move', combatantId: 'b1', moveId: 'quickJab', declaredTarget: 'a1' },
    { kind: 'move', combatantId: 'b2', moveId: 'firestorm' },
  ];

  const stateA = twoVTwoFixture(555);
  const stateB = twoVTwoFixture(555);
  const resultA = resolveRound(stateA, actions, config);
  const resultB = resolveRound(stateB, actions, config);

  assert.deepStrictEqual(resultA.events, resultB.events);
  assert.deepStrictEqual(resultA.state, resultB.state);
});

test('golden replay: a different seed produces a different (but still valid) log', () => {
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }];
  const resultA = resolveRound(twoVTwoFixture(1), actions, config);
  const resultB = resolveRound(twoVTwoFixture(2), actions, config);
  assert.notDeepStrictEqual(resultA.events, resultB.events);
});

// --- Round integration -------------------------------------------------

test('round: RoundStarted is first event, RoundEnded is last', () => {
  const state = twoVTwoFixture(10);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }];
  const { events } = resolveRound(state, actions, config);
  assert.strictEqual(events[0].type, 'RoundStarted');
  assert.strictEqual(events[events.length - 1].type, 'RoundEnded');
});

test('round: a resolved move spends mana and deals damage', () => {
  const state = twoVTwoFixture(11);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  // Spend, then the round-boundary mana regen tick (docs/mana.md) adds mpRegen back on top.
  const spent = heroes.cinderKnight.baseStats.manaPool - moves.singe.manaCost;
  const afterRegen = Math.min(heroes.cinderKnight.baseStats.manaPool, spent + heroes.cinderKnight.baseStats.mpRegen);
  assert.strictEqual(next.combatants.a1.currentMana, afterRegen);
  assert.ok(next.combatants.b1.currentHp < heroes.ironWarden.baseStats.hp);
  assert.ok(events.some((e) => e.type === 'DamageDealt'));
  assert.ok(events.some((e) => e.type === 'HpChanged'));
  assert.ok(events.some((e) => e.type === 'ManaRegenTicked'));
});

test('round: higher priority move resolves before a higher-speed move in a lower bracket', () => {
  const state = twoVTwoFixture(12);
  // quickJab (priority 1) from the slower b1 should still resolve before singe (priority 0) from faster a1.
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' },
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

test('hasAffordableMove: true iff at least one candidate move is within current mana', () => {
  assert.strictEqual(hasAffordableMove(0, ['overload'], moves), false); // 999 cost, 0 mana
  assert.strictEqual(hasAffordableMove(0, ['overload', 'singe'], moves), false); // singe costs 20, still unaffordable at 0
  assert.strictEqual(hasAffordableMove(moves.singe.manaCost, ['overload', 'singe'], moves), true);
  assert.strictEqual(hasAffordableMove(moves.singe.manaCost - 1, ['overload', 'singe'], moves), false);
});

test('round: a declared Rest action fully restores mana and skips the turn (softlock fallback, CLAUDE.md "Mana & tempo")', () => {
  const state = twoVTwoFixture(20);
  const drained = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentMana: 0 } } };
  const actions: Action[] = [{ kind: 'rest', combatantId: 'a1' }];
  const { state: next, events } = resolveRound(drained, actions, config);

  assert.strictEqual(next.combatants.a1.currentMana, heroes.cinderKnight.baseStats.manaPool);
  assert.strictEqual(events.some((e) => e.type === 'Rested' && e.combatantId === 'a1'), true);
  assert.strictEqual(events.some((e) => e.type === 'MoveUsed'), false);
  assert.strictEqual(events.some((e) => e.type === 'DamageDealt'), false);
  const manaChanged = events.find((e) => e.type === 'ManaChanged' && e.combatantId === 'a1') as any;
  assert.ok(manaChanged);
  assert.strictEqual(manaChanged.previousMana, 0);
  assert.strictEqual(manaChanged.newMana, heroes.cinderKnight.baseStats.manaPool);
});

test('round: Rest resolves dead last regardless of speed — a faster Resting hero does not preempt a slower attacker', () => {
  const state = twoVTwoFixture(21);
  // a2 (tidecaller, speed 55) rests; b1 (ironWarden, speed 30) uses curseMind (priority 0, same
  // bracket every other authored move lives in). Despite a2 being both faster AND in the same
  // priority bracket by default, the attack must still resolve first — Rest sorts below every
  // real move priority via REST_PRIORITY_BRACKET (priority.ts), not by winning a speed race.
  const actions: Action[] = [
    { kind: 'rest', combatantId: 'a2' },
    { kind: 'move', combatantId: 'b1', moveId: 'curseMind', declaredTarget: 'a2' },
  ];
  const { events } = resolveRound(state, actions, config);
  const restedIdx = events.findIndex((e) => e.type === 'Rested');
  const moveUsedIdx = events.findIndex((e) => e.type === 'MoveUsed');
  assert.ok(restedIdx !== -1 && moveUsedIdx !== -1);
  assert.ok(moveUsedIdx < restedIdx);
});

test('round: KO increments KO count and emits Fainted, clearing the active slot', () => {
  const state = twoVTwoFixture(14);
  // Overwrite b1 to 1 HP so a single hit KOs it.
  const damaged = { ...state, combatants: { ...state.combatants, b1: { ...state.combatants.b1, currentHp: 1 } } };
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(damaged, actions, config);

  assert.strictEqual(next.koCount.B, 1);
  assert.strictEqual(next.combatants.b1.fainted, true);
  assert.strictEqual(next.active.B[0], null);
  assert.ok(events.some((e) => e.type === 'Fainted'));
});

test('round: a second attacker declared against a target the first attacker already knocked out redirects onto the other enemy', () => {
  const state = twoVTwoFixture(16);
  // b1 (ironWarden) at 1 HP: whichever of a1/a2 resolves first this round KOs it outright.
  const oneHp = { ...state, combatants: { ...state.combatants, b1: { ...state.combatants.b1, currentHp: 1 } } };
  // tidecaller (a2, speed 55) outpaces cinderKnight (a1, speed 50) at equal priority, so a2 resolves
  // first and KOs b1 — a1's declared target is then stale by the time its own action comes up. b2 is
  // still standing, so a1's attack should redirect onto it rather than fizzle.
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' },
    { kind: 'move', combatantId: 'a2', moveId: 'tidalBolt', declaredTarget: 'b1' },
  ];
  const { events } = resolveRound(oneHp, actions, config);

  const moveUsedIds = events.filter((e) => e.type === 'MoveUsed').map((e: any) => e.combatantId);
  assert.deepStrictEqual(moveUsedIds, ['a2', 'a1']); // both moves resolve — a1's redirects onto b2
  assert.strictEqual(events.some((e) => e.type === 'ActionBlocked' && (e as any).combatantId === 'a1'), false);
  const a1Damage = events.find((e) => e.type === 'DamageDealt' && (e as any).sourceCombatantId === 'a1') as any;
  assert.ok(a1Damage);
  assert.strictEqual(a1Damage.targetCombatantId, 'b2');
});

test('round: an attacker still fizzles when its declared target is gone and the whole enemy side is empty', () => {
  const state = createFightState(18, [{ combatantId: 'a1', heroId: 'cinderKnight', side: 'A' }], [{ combatantId: 'b1', heroId: 'ironWarden', side: 'B' }]);
  // b1 is the only enemy and it's already fainted before the round starts — there's nothing to
  // redirect onto, so this must still fizzle rather than throw.
  const b1Fainted = {
    ...state,
    combatants: { ...state.combatants, b1: { ...state.combatants.b1, currentHp: 0, fainted: true } },
    active: { ...state.active, B: [null, null] as [string | null, string | null] },
    koCount: { ...state.koCount, B: 1 },
  };
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }];
  const { events } = resolveRound(b1Fainted, actions, config);

  assert.strictEqual(events.some((e) => e.type === 'MoveUsed'), false);
  assert.ok(events.some((e) => e.type === 'ActionBlocked' && (e as any).combatantId === 'a1' && (e as any).reason === 'noValidTarget'));
});

test('round: a move targeting a slot the enemy switched out of hits the replacement, not a fizzle', () => {
  const state = createFightState(
    17,
    [{ combatantId: 'a1', heroId: 'cinderKnight', side: 'A' }],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
      { combatantId: 'b3', heroId: 'wildOracle', side: 'B' },
    ]
  );
  // Overwritten well above its real max HP so the incoming attack can't coincidentally KO it —
  // this test is about retargeting, not survival, and getMaxHp reads from baseStats/statModifiers,
  // never currentHp, so this doesn't disturb the HP-clamping logic it goes through.
  const withBufferedHp = { ...state, combatants: { ...state.combatants, b3: { ...state.combatants.b3, currentHp: 1000 } } };
  // a1 declares against b1's slot; B switches b1 out for the bench b3 (switches always resolve
  // first, priority.ts SWITCH_PRIORITY_BRACKET) — the attack should retarget onto b3, the new
  // occupant of that slot, exactly like 2v2 Pokemon, instead of fizzling and wasting a's turn/mana.
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' },
    { kind: 'switch', combatantId: 'b1', benchedCombatantId: 'b3' },
  ];
  const { state: next, events } = resolveRound(withBufferedHp, actions, config);

  assert.ok(events.some((e) => e.type === 'MoveUsed' && (e as any).combatantId === 'a1'));
  assert.ok(events.some((e) => e.type === 'DamageDealt' && (e as any).targetCombatantId === 'b3'));
  assert.strictEqual(events.some((e) => e.type === 'ActionBlocked'), false);
  assert.strictEqual(next.combatants.b1.currentHp, heroes.ironWarden.baseStats.hp); // switched-out b1 untouched
  assert.ok(next.combatants.b3.currentHp < 1000); // b3, the replacement, took the hit
  assert.strictEqual(next.active.B[0], 'b3');
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
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(withBench, actions, config);

  const tick = events.find((e) => e.type === 'BenchRegenTicked' && (e as any).combatantId === 'b2') as any;
  assert.ok(tick, 'expected a BenchRegenTicked event for b2');
  assert.strictEqual(tick.hpRegen, 2); // clamped: only 2 HP of headroom even though benchHpRegenFlat is 5
  assert.strictEqual(next.combatants.b2.currentHp, maxHp);
});

test('round: mana regen ticks every round for active AND benched combatants alike, clamped at max mana', () => {
  const state = twoVTwoFixture(16);
  const maxMana = heroes.wildOracle.baseStats.manaPool; // b2 is wildOracle, benched below
  const withBench = {
    ...state,
    active: { ...state.active, B: ['b1', null] as [string | null, string | null] },
    bench: { ...state.bench, B: ['b2'] },
    combatants: {
      ...state.combatants,
      b1: { ...state.combatants.b1, currentMana: state.combatants.b1.currentMana - 20 }, // active, damaged mana pool
      b2: { ...state.combatants.b2, currentMana: maxMana - 2 }, // benched, near-full
    },
  };
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(withBench, actions, config);

  const activeTick = events.find((e) => e.type === 'ManaRegenTicked' && (e as any).combatantId === 'b1') as any;
  const benchTick = events.find((e) => e.type === 'ManaRegenTicked' && (e as any).combatantId === 'b2') as any;
  assert.ok(activeTick, 'expected a ManaRegenTicked event for the active b1, not just the benched b2');
  assert.strictEqual(activeTick.manaRegen, heroes.ironWarden.baseStats.mpRegen);
  assert.ok(benchTick, 'expected a ManaRegenTicked event for the benched b2');
  assert.strictEqual(benchTick.manaRegen, 2); // clamped: only 2 mana of headroom even though wildOracle's mpRegen is higher
  assert.strictEqual(next.combatants.b2.currentMana, maxMana);
});
