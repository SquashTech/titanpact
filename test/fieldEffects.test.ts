// Field Effects (docs/field-effects.md) — resolves docs/mana.md's former
// "weather subsystem" open question. Covers the locked shape end to end: only
// one active at a time, a flat 5-round duration regardless of which effect,
// no-op on re-applying the active effect, override-and-restart on a
// different one, and Surging Magic's mpRegenMultiplier actually doubling
// regen through the round loop.

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
import { setFieldEffect, tickFieldEffect, FIELD_EFFECT_DURATION_ROUNDS } from '../src/engine/combat/fieldEffectEngine';
import { applyManaRegen } from '../src/engine/combat/manaRegen';

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

// --- fieldEffectEngine.ts: the locked shape in isolation ---------------------

test('fieldEffects: setFieldEffect activates a new effect for the full duration', () => {
  const state = twoVTwoFixture(400);
  const { state: next, events } = setFieldEffect(state, 1, 'surgingMagic');

  assert.deepStrictEqual(next.activeFieldEffect, { fieldEffectId: 'surgingMagic', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS });
  assert.ok(events.some((e) => e.type === 'FieldEffectSet' && e.fieldEffectId === 'surgingMagic' && e.previousFieldEffectId === null));
});

test('fieldEffects: re-applying the already-active effect is a no-op — no event, clock unchanged', () => {
  const state = twoVTwoFixture(401);
  const set = setFieldEffect(state, 1, 'surgingMagic');
  const ticked = tickFieldEffect(set.state, 1); // 5 -> 4
  const reapplied = setFieldEffect(ticked.state, 2, 'surgingMagic');

  assert.strictEqual(reapplied.events.length, 0);
  assert.strictEqual(reapplied.state.activeFieldEffect?.roundsRemaining, 4); // NOT refreshed back to 5
});

test('fieldEffects: setting a different effect overrides the active one and restarts the clock', () => {
  const state = twoVTwoFixture(402);
  const withFakeOther: typeof state = { ...state, activeFieldEffect: { fieldEffectId: 'scorchedLand', roundsRemaining: 1 } };
  const { state: next, events } = setFieldEffect(withFakeOther, 3, 'surgingMagic');

  assert.deepStrictEqual(next.activeFieldEffect, { fieldEffectId: 'surgingMagic', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS });
  assert.ok(events.some((e) => e.type === 'FieldEffectSet' && e.fieldEffectId === 'surgingMagic' && e.previousFieldEffectId === 'scorchedLand'));
});

test('fieldEffects: tickFieldEffect counts down and expires exactly after 5 rounds', () => {
  let state = setFieldEffect(twoVTwoFixture(403), 1, 'surgingMagic').state;

  for (let round = 1; round < FIELD_EFFECT_DURATION_ROUNDS; round++) {
    const result = tickFieldEffect(state, round);
    state = result.state;
    assert.strictEqual(state.activeFieldEffect?.roundsRemaining, FIELD_EFFECT_DURATION_ROUNDS - round);
    assert.ok(result.events.some((e) => e.type === 'FieldEffectTicked'));
  }

  const final = tickFieldEffect(state, FIELD_EFFECT_DURATION_ROUNDS);
  assert.strictEqual(final.state.activeFieldEffect, null);
  assert.ok(final.events.some((e) => e.type === 'FieldEffectExpired' && e.fieldEffectId === 'surgingMagic'));
});

test('fieldEffects: tickFieldEffect is a no-op when nothing is active', () => {
  const state = twoVTwoFixture(404);
  const { state: next, events } = tickFieldEffect(state, 1);
  assert.strictEqual(next, state);
  assert.strictEqual(events.length, 0);
});

// --- manaRegen.ts: Surging Magic actually doubles regen ----------------------

test('fieldEffects: Surging Magic doubles every combatant\'s MP Regen', () => {
  const built = twoVTwoFixture(405);
  // Drain every combatant well below full mana first — createFightState
  // starts everyone at max, and the regen tick clamps to 0 headroom there,
  // which would make both the plain and doubled runs indistinguishably zero.
  const combatants = Object.fromEntries(Object.entries(built.combatants).map(([id, c]) => [id, { ...c, currentMana: 1 }]));
  const state = { ...built, combatants };

  const plain = applyManaRegen(state, 1, heroes, fieldEffects);
  const doubled = applyManaRegen(setFieldEffect(state, 1, 'surgingMagic').state, 1, heroes, fieldEffects);

  for (const id of ['a1', 'a2', 'b1', 'b2']) {
    const plainRegen = plain.state.combatants[id].currentMana - 1;
    const doubledRegen = doubled.state.combatants[id].currentMana - 1;
    assert.ok(plainRegen > 0, `${id} should have regenerated some mana`);
    assert.strictEqual(doubledRegen, plainRegen * 2);
  }
});

test('fieldEffects: Surging Magic also doubles regen for a benched combatant', () => {
  const built = createFightState(
    4051,
    [{ combatantId: 'a1', heroId: 'cinderKnight', side: 'A' }],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
      { combatantId: 'b3', heroId: 'wildOracle', side: 'B' }, // benched
    ]
  );
  // Drain b3's mana below full first — otherwise the regen tick clamps to 0
  // (already at maxMana) and the doubling would be invisible either way.
  const state = { ...built, combatants: { ...built.combatants, b3: { ...built.combatants.b3, currentMana: 10 } } };
  const surging = setFieldEffect(state, 1, 'surgingMagic').state;
  const { state: next } = applyManaRegen(surging, 1, heroes, fieldEffects);

  assert.strictEqual(next.combatants.b3.currentMana, 10 + heroes.wildOracle.baseStats.mpRegen * 2);
});

test('fieldEffects: mana regen is unaffected once no Field Effect is active', () => {
  const built = twoVTwoFixture(406);
  const state = { ...built, combatants: { ...built.combatants, a1: { ...built.combatants.a1, currentMana: 1 } } };
  const { state: next } = applyManaRegen(state, 1, heroes, fieldEffects);
  assert.strictEqual(next.combatants.a1.currentMana, 1 + heroes.cinderKnight.baseStats.mpRegen);
});

// --- End to end via resolveRound: the arcaneSurge move sets the field -------

test('fieldEffects: casting arcaneSurge sets Surging Magic, and the very next regen tick is doubled', () => {
  const state = twoVTwoFixture(407);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'arcaneSurge' }];
  const { state: next, events } = resolveRound(state, actions, config);

  // The casting round's own end-of-round tick already fires once (resolveRound.ts
  // ticks every round, including the one that just set the effect), so the clock
  // reads 4 immediately afterward, not 5.
  assert.deepStrictEqual(next.activeFieldEffect, { fieldEffectId: 'surgingMagic', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS - 1 });
  assert.ok(events.some((e) => e.type === 'FieldEffectSet' && e.fieldEffectId === 'surgingMagic'));

  // a1 (cinderKnight, mpRegen 5) spent 20 mana on arcaneSurge this same round,
  // then the round's own end-of-round mana regen tick already runs doubled —
  // Surging Magic takes effect the same round it's cast, not the round after.
  const spent = moves.arcaneSurge.manaCost;
  const expectedRegen = heroes.cinderKnight.baseStats.mpRegen * 2;
  assert.strictEqual(next.combatants.a1.currentMana, heroes.cinderKnight.baseStats.manaPool - spent + expectedRegen);
});

test('fieldEffects: Surging Magic expires after 5 rounds of resolveRound, reverting regen to normal', () => {
  let state = twoVTwoFixture(408);
  // The cast round's own end-of-round tick already fires (resolveRound.ts
  // ticks every round, including the one that just set the effect), so the
  // clock reads 4 immediately after the casting round, not 5.
  state = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'arcaneSurge' }], config).state;
  assert.strictEqual(state.activeFieldEffect?.roundsRemaining, FIELD_EFFECT_DURATION_ROUNDS - 1);

  // Two more empty rounds keep it alive (remaining 3, then 2)...
  for (let i = 0; i < FIELD_EFFECT_DURATION_ROUNDS - 3; i++) {
    state = resolveRound(state, [], config).state;
    assert.ok(state.activeFieldEffect, `still active after round ${i + 2}`);
  }

  // ...and the next two ticks bring it to 1, then expire it.
  state = resolveRound(state, [], config).state;
  assert.strictEqual(state.activeFieldEffect?.roundsRemaining, 1);

  const last = resolveRound(state, [], config);
  assert.strictEqual(last.state.activeFieldEffect, null);
  assert.ok(last.events.some((e) => e.type === 'FieldEffectExpired'));
});

test('fieldEffects: casting arcaneSurge again while it is already active does not refresh the duration', () => {
  let state = twoVTwoFixture(409);
  state = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'arcaneSurge' }], config).state; // cast: 5 -> 4 (this round's own tick)
  state = resolveRound(state, [], config).state; // empty round: 4 -> 3

  const { state: next, events } = resolveRound(state, [{ kind: 'move', combatantId: 'a2', moveId: 'arcaneSurge' }], config);
  assert.strictEqual(events.some((e) => e.type === 'FieldEffectSet'), false);
  assert.strictEqual(next.activeFieldEffect?.roundsRemaining, 2); // ticked down again this round (3 -> 2), not reset to 5
});
