// Arcane slate: manaGrant / overflow, conditionalTarget, derivedStatDeltas. Hand-off findings: docs/authoring-moves.md §10.

import { statusApplicationsOf } from '../src/engine/content';
import * as assert from 'assert';
import { test } from './harness';
import { createFightState, withFullPools } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { applyManaRegen } from '../src/engine/combat/manaRegen';
import { setFieldEffect } from '../src/engine/combat/fieldEffectEngine';
import { getMaxMana, resolveTargetMode } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Glyph (the artillery) and Zenith (the battery) attack; Warden and Sentinel defend, with a benched pair on each side. */
function arcaneFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'runescribe', side: 'A' },
      { combatantId: 'a2', heroId: 'zenith', side: 'A' },
      { combatantId: 'a3', heroId: 'cinderKnight', side: 'A' }, // benched
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/** Deep HP so riders are reached; mana is deliberately NOT inflated, since overflow is defined relative to the real pool. */
function survivable(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      withFullPools({ ...c, statModifiers: { ...c.statModifiers, hp: 1200 } }),
    ])
  );
  return { ...state, combatants } as CombatState;
}

/** Sets one combatant's mana outright — the fixture equivalent of "it has been banking for three rounds". */
function withMana(state: CombatState, combatantId: string, mana: number): CombatState {
  const c = state.combatants[combatantId];
  return { ...state, combatants: { ...state.combatants, [combatantId]: { ...c, currentMana: mana } } } as CombatState;
}

function maxManaOf(state: CombatState, combatantId: string): number {
  const c = state.combatants[combatantId];
  return getMaxMana(heroes[c.heroId], c);
}

// --- manaGrant ---

test('arcane: Infuse hands an ally the whole grant even when it carries them past their pool', () => {
  const state = survivable(arcaneFixture(1));
  const pool = maxManaOf(state, 'a2');

  const { state: next, events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'infuse', declaredTarget: 'a2' }],
    config
  );

  const granted = events.find((e) => e.type === 'ManaGranted') as
    | { targetCombatantId: string; amount: number; overflow: number; newMana: number }
    | undefined;
  assert.ok(granted, 'a grant emits its own ManaGranted event, not a bare ManaChanged');
  assert.strictEqual(granted!.targetCombatantId, 'a2');
  assert.strictEqual(granted!.amount, moves.infuse.manaGrant);

  // a2 started at its full pool, so the entire grant is overflow (regen adds nothing above the pool).
  assert.ok(next.combatants.a2.currentMana > pool, 'the ally ends the round holding more than its pool');
  assert.strictEqual(next.combatants.a2.currentMana, pool + moves.infuse.manaGrant!);
  assert.ok(granted!.overflow > 0, 'the event reports the surplus so the view need not re-derive it');
});

test('arcane: the caster pays its own cost, so a grant is a net gain for the SIDE and a loss for the caster', () => {
  const state = survivable(arcaneFixture(2));
  const casterBefore = state.combatants.a1.currentMana;

  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'infuse', declaredTarget: 'a2' }],
    config
  );

  // Regen ticks at the round boundary, so compare against the spend, not the absolute figure.
  assert.ok(next.combatants.a1.currentMana < casterBefore, 'the caster is out of pocket');
  assert.ok(moves.infuse.manaGrant! > moves.infuse.manaCost, 'and the side is up on the trade');
});

test('arcane: Font of Power pays BOTH allies, the caster included', () => {
  // Zenith's pool cannot reach Font of Power's cost unaided (authored shape, not a fixture problem).
  const state = withMana(survivable(arcaneFixture(3)), 'a2', 400);
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a2', moveId: 'fontOfPower' }], config);

  const grants = events.filter((e) => e.type === 'ManaGranted') as Array<{ targetCombatantId: string }>;
  assert.deepStrictEqual(grants.map((g) => g.targetCombatantId).sort(), ['a1', 'a2']);
});

// --- Overflow is sticky ---

test('arcane: the round-boundary regen tick never pulls an overflowed combatant back to its pool', () => {
  const built = survivable(arcaneFixture(4));
  const pool = maxManaOf(built, 'a1');
  const state = withMana(built, 'a1', pool + 100);

  const { state: next, events } = applyManaRegen(state, 1, heroes, fieldEffects);

  assert.strictEqual(next.combatants.a1.currentMana, pool + 100, 'overflow is left exactly as it was');
  assert.strictEqual(
    events.some((e) => e.combatantId === 'a1'),
    false,
    'and no ManaRegenTicked is emitted for a combatant that gained nothing'
  );
});

test('arcane: a combatant BELOW its pool still regens normally, and still clamps at the pool', () => {
  const built = survivable(arcaneFixture(5));
  const pool = maxManaOf(built, 'a1');
  const state = withMana(built, 'a1', pool - 1);

  const { state: next } = applyManaRegen(state, 1, heroes, fieldEffects);
  assert.strictEqual(next.combatants.a1.currentMana, pool, 'a gain is still clamped to the pool');
});

test('arcane: Rest tops an overflowed hero up TO its pool and never below what it holds', () => {
  const built = survivable(arcaneFixture(6));
  const pool = maxManaOf(built, 'a1');
  const state = withMana(built, 'a1', pool + 60);

  const { state: next } = resolveRound(state, [{ kind: 'rest', combatantId: 'a1' }], config);
  assert.strictEqual(next.combatants.a1.currentMana, pool + 60, 'resting on an overflowed pool is a wasted turn, not a refund');

  const drained = withMana(built, 'a1', 0);
  const { state: refilled } = resolveRound(drained, [{ kind: 'rest', combatantId: 'a1' }], config);
  assert.strictEqual(refilled.combatants.a1.currentMana, pool, 'and an empty hero still Rests back to exactly full');
});

test('arcane: overflow survives a switch to the bench', () => {
  const built = survivable(arcaneFixture(7));
  const pool = maxManaOf(built, 'a1');
  const state = withMana(built, 'a1', pool + 75);

  const { state: next } = resolveRound(
    state,
    [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }],
    config
  );
  assert.ok(next.bench.A.includes('a1'), 'a1 is on the bench');
  assert.strictEqual(next.combatants.a1.currentMana, pool + 75);
});

test('arcane: Conduit is what makes Singularity castable at all', () => {
  const built = survivable(arcaneFixture(8));
  const pool = maxManaOf(built, 'a1');
  assert.ok(moves.singularity.manaCost > pool, 'the capstone is deliberately above a starting pool');

  const { state: after } = resolveRound(
    built,
    [{ kind: 'move', combatantId: 'a2', moveId: 'conduit', declaredTarget: 'a1' }],
    config
  );
  assert.ok(after.combatants.a1.currentMana >= moves.singularity.manaCost);

  const { events } = resolveRound(
    after,
    [{ kind: 'move', combatantId: 'a1', moveId: 'singularity', declaredTarget: 'b1' }],
    config
  );
  assert.ok(events.some((e) => e.type === 'MoveUsed' && e.moveId === 'singularity'), 'and the engine lets it through');
});

// --- conditionalTarget ---

test('arcane: Overload is single-target with no field up and spread under Magical Surge', () => {
  const plain = survivable(arcaneFixture(9));
  assert.strictEqual(resolveTargetMode(plain, moves.overload), 'singleEnemy');

  const surging = setFieldEffect(plain, 1, 'surgingMagic').state;
  assert.strictEqual(resolveTargetMode(surging, moves.overload), 'bothEnemies');

  const displaced = setFieldEffect(surging, 1, 'scorchedLand').state;
  assert.strictEqual(resolveTargetMode(displaced, moves.overload), 'singleEnemy');
});

test('arcane: an Overload cast under Magical Surge actually hits both enemies', () => {
  const built = withMana(survivable(arcaneFixture(10)), 'a1', 400);
  const surging = setFieldEffect(built, 1, 'surgingMagic').state;

  const { events } = resolveRound(
    surging,
    [{ kind: 'move', combatantId: 'a1', moveId: 'overload', declaredTarget: 'b1' }],
    config
  );
  const hits = events.filter((e) => e.type === 'DamageDealt' && e.moveId === 'overload') as Array<{ targetCombatantId: string }>;
  assert.deepStrictEqual(hits.map((h) => h.targetCombatantId).sort(), ['b1', 'b2']);
});

test('arcane: the field is read at RESOLUTION, so a partner setting it earlier the same round already spreads it', () => {
  // Zenith (Speed 50) is slower than Glyph (58): setter on the faster hero, reader on the slower one.
  const built = withMana(withMana(survivable(arcaneFixture(11)), 'a1', 400), 'a2', 400);
  assert.strictEqual(built.activeFieldEffect, null);

  const { events } = resolveRound(
    built,
    [
      { kind: 'move', combatantId: 'a1', moveId: 'manaFont' },
      { kind: 'move', combatantId: 'a2', moveId: 'overload', declaredTarget: 'b1' },
    ],
    config
  );
  const hits = events.filter((e) => e.type === 'DamageDealt' && e.moveId === 'overload') as Array<{ targetCombatantId: string }>;
  assert.deepStrictEqual(hits.map((h) => h.targetCombatantId).sort(), ['b1', 'b2']);
});

test('arcane: a move with no conditionalTarget answers exactly as move.target, field or no field', () => {
  const state = setFieldEffect(survivable(arcaneFixture(12)), 1, 'surgingMagic').state;
  for (const move of Object.values(moves)) {
    if (move.conditionalTarget) continue;
    assert.strictEqual(resolveTargetMode(state, move), move.target, `${move.id} changed targets`);
  }
});

// --- derivedStatDeltas ---

test('arcane: Arcane Overflow grants Attack and Intelligence equal to the mana held BEFORE the cost', () => {
  const banked = 173; // deliberately not a multiple of 5 — see the next test
  const built = withMana(survivable(arcaneFixture(13)), 'a2', banked);

  const { state: next, events } = resolveRound(
    built,
    [{ kind: 'move', combatantId: 'a2', moveId: 'arcaneOverflow' }],
    config
  );

  for (const id of ['a1', 'a2']) {
    assert.strictEqual(next.combatants[id].statModifiers.attack, banked, `${id} Attack`);
    assert.strictEqual(next.combatants[id].statModifiers.intelligence, banked, `${id} Intelligence`);
  }
  // Not `banked - manaCost`: the row reads the mana BEFORE the cost.
  const changes = events.filter((e) => e.type === 'StatChanged') as Array<{ delta: number }>;
  assert.ok(changes.length > 0 && changes.every((c) => c.delta === banked));
});

test('arcane: the derived grant is the one stat modifier exempt from the multiples-of-5 rule', () => {
  const built = withMana(survivable(arcaneFixture(14)), 'a2', 173);
  const { state: next } = resolveRound(built, [{ kind: 'move', combatantId: 'a2', moveId: 'arcaneOverflow' }], config);
  assert.strictEqual(next.combatants.a2.statModifiers.attack! % 5, 3, 'the exact figure lands, unrounded');

  for (const move of Object.values(moves)) {
    for (const delta of move.statDeltas ?? []) {
      // Math.abs: -10 % 5 is -0, which strictEqual distinguishes from 0.
      assert.strictEqual(Math.abs(delta.amount % 5), 0, `${move.id} authors a non-multiple-of-5 stat delta`);
    }
  }
});

test('arcane: the derived grant READS the mana, it does not spend it', () => {
  const banked = 200;
  const built = withMana(survivable(arcaneFixture(15)), 'a2', banked);
  const { state: next } = resolveRound(built, [{ kind: 'move', combatantId: 'a2', moveId: 'arcaneOverflow' }], config);

  // Only the cost comes out; regen adds nothing while the hero is above its pool.
  assert.strictEqual(next.combatants.a2.currentMana, banked - moves.arcaneOverflow.manaCost);
});

test('arcane: overflow counts toward the derived grant — the Font of Power into Arcane Overflow combo', () => {
  const raw = survivable(arcaneFixture(16));
  const pool = maxManaOf(raw, 'a2');
  // Exactly the price, so what it ends up holding is the grant and nothing else.
  const built = withMana(raw, 'a2', moves.fontOfPower.manaCost);

  const { state: charged } = resolveRound(built, [{ kind: 'move', combatantId: 'a2', moveId: 'fontOfPower' }], config);
  assert.ok(charged.combatants.a2.currentMana > pool, 'the caster paid itself too');

  const held = charged.combatants.a2.currentMana;
  const { state: next } = resolveRound(charged, [{ kind: 'move', combatantId: 'a2', moveId: 'arcaneOverflow' }], config);
  assert.strictEqual(next.combatants.a1.statModifiers.attack, held, 'the buff is the FULL held figure, overflow included');
});

// --- The slate as a whole ---

test('arcane: the slate is sixteen moves, and every field effect and status it names exists', () => {
  const slate = Object.values(moves).filter((m) => m.type === 'Arcane');
  assert.strictEqual(slate.length, 16);
  for (const move of slate) {
    if (move.fieldEffectApplication) assert.ok(fieldEffects[move.fieldEffectApplication], `${move.id} sets an unknown field`);
    if (move.conditionalTarget) {
      assert.ok(fieldEffects[move.conditionalTarget.requiresFieldEffect], `${move.id} reads an unknown field`);
    }
    for (const app of statusApplicationsOf(move)) assert.ok(statuses[app.statusId], `${move.id} applies an unknown status`);
  }
});

test('arcane: Mana Tap is the only 0-mana move in the game, so its holder can never be forced to Rest', () => {
  // hasAffordableMove is a `>=` check, so 0 is always affordable (state.ts).
  const free = Object.values(moves).filter((m) => m.manaCost === 0);
  assert.deepStrictEqual(free.map((m) => m.id), ['manaTap']);

  const built = withMana(survivable(arcaneFixture(17)), 'a2', 0);
  const { events } = resolveRound(
    built,
    [{ kind: 'move', combatantId: 'a2', moveId: 'manaTap', declaredTarget: 'b1' }],
    config
  );
  assert.ok(events.some((e) => e.type === 'MoveUsed' && e.moveId === 'manaTap'), 'castable on an empty pool');
});

test('arcane: every hero that can be offered a mana sink can also reach a way to pay for it', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const grantIds = Object.values(moves)
    .filter((m) => m.manaGrant)
    .map((m) => m.id);

  for (const [heroId, hero] of Object.entries(heroes)) {
    const reachable = [...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])];
    if (!reachable.includes('singularity')) continue;
    assert.ok(
      reachable.some((id) => grantIds.includes(id)) ||
        // Or a second Arcane hero on the team can hand it over.
        Object.values(heroes).some((other) => other.types.includes('Arcane') && other.id !== heroId),
      `${heroId} can be offered Singularity with no way to pay for it`
    );
  }
});

test('arcane: no move id in any kit, pool or enemy loadout is dangling', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');

  for (const hero of Object.values({ ...heroes, ...enemies })) {
    for (const id of hero.moveIds) assert.ok(moves[id], `${hero.id} starts with unknown move ${id}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const id of pool) assert.ok(moves[id], `${heroId}'s pool names unknown move ${id}`);
  }
});

test('arcane: neither Arcane hero lists its own starting move in its level-up pool', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const heroId of ['runescribe', 'zenith']) {
    const hero = heroes[heroId];
    for (const id of progressionTable.moveTiers[heroId] ?? []) {
      assert.ok(!hero.moveIds.includes(id), `${heroId}'s pool carries ${id}, which it already starts with`);
    }
  }
});

test('arcane: both Arcane heroes can afford every move in their own starting kit', () => {
  for (const heroId of ['runescribe', 'zenith']) {
    const hero = heroes[heroId];
    for (const id of hero.moveIds) {
      assert.ok(moves[id].manaCost <= hero.baseStats.manaPool, `${heroId} cannot afford its own ${id}`);
    }
  }
});
