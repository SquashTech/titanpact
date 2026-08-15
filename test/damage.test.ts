import * as assert from 'assert';
import { test } from './harness';
import { resolveTypeMult, resolveStab } from '../src/engine/damage/typeMult';
import { calcDamage, resolveMultiplierTerm } from '../src/engine/damage/damagePipeline';
import type { TypeChart } from '../src/engine/damage/typeMult';
import type { MoveDefinition } from '../src/engine/content';

const chart: TypeChart = {
  Fire: { Nature: 2, Water: 0.5, Frost: 0.4 },
  Water: { Fire: 2 },
};

test('typeMult: single super-effective hit is 2x', () => {
  assert.strictEqual(resolveTypeMult(chart, 'Fire', ['Nature']), 2);
});

test('typeMult: dual-type stacking is multiplicative (2x * 2x = 4x)', () => {
  const dualChart: TypeChart = { Fire: { Nature: 2, Beast: 2 } };
  assert.strictEqual(resolveTypeMult(dualChart, 'Fire', ['Nature', 'Beast']), 4);
});

test('typeMult: dual 0.5x resists floor at 0.25x, not lower', () => {
  // 0.4 * 0.4 = 0.16, which must clamp to the provisional 0.25x floor.
  assert.strictEqual(resolveTypeMult(chart, 'Fire', ['Frost', 'Frost']), 0.25);
});

test('typeMult: 0.5 * 1 stays above the floor, unclamped', () => {
  assert.strictEqual(resolveTypeMult(chart, 'Fire', ['Water', 'Nature']), 1);
});

test('STAB: matching type applies 1.25x', () => {
  assert.strictEqual(resolveStab('Fire', ['Fire']), 1.25);
});

test('STAB: non-matching type applies no bonus', () => {
  assert.strictEqual(resolveStab('Fire', ['Water']), 1);
});

test('STAB: dual-type match does not double (single 1.25x, not 1.5625x)', () => {
  assert.strictEqual(resolveStab('Fire', ['Fire', 'Nature']), 1.25);
  assert.notStrictEqual(resolveStab('Fire', ['Fire', 'Nature']), 1.25 * 1.25);
});

test('damage formula: hand-computed case matches the locked formula exactly', () => {
  const move: MoveDefinition = {
    id: 'testMove',
    name: 'Test Move',
    type: 'Fire',
    category: 'physical',
    kind: 'damage',
    basePower: 80,
    manaCost: 0,
    priority: 0,
    target: 'singleEnemy',
  };
  const ratio = 2; // e.g. 100 Atk / 50 Def
  const variance = 0.9;
  const result = calcDamage(move, ratio, ['Fire'], ['Nature'], chart, variance, false);

  // Damage = BasePower * ratio * STAB(1.25) * TypeMult(2) * Variance(0.9) * Crit(1) * MultiplierTerm(1)
  const expected = 80 * 2 * 1.25 * 2 * 0.9 * 1 * 1;
  assert.strictEqual(result.damage, expected);
  assert.strictEqual(result.stab, 1.25);
  assert.strictEqual(result.typeMult, 2);
});

test('damage formula: crit applies the crit multiplier term', () => {
  const move: MoveDefinition = {
    id: 'testMove',
    name: 'Test Move',
    type: 'Water',
    category: 'magical',
    kind: 'damage',
    basePower: 50,
    manaCost: 0,
    priority: 0,
    target: 'singleEnemy',
  };
  const noCrit = calcDamage(move, 1, [], [], {}, 1, false);
  const crit = calcDamage(move, 1, [], [], {}, 1, true, [], 'additive', 1.5);
  assert.strictEqual(crit.damage, noCrit.damage * 1.5);
});

test('multiplier term: additive stacking of damage-shaped modifiers', () => {
  const term = resolveMultiplierTerm([{ source: 'relicA', amount: 0.2 }, { source: 'buffB', amount: 0.1 }], 'additive');
  assert.strictEqual(term, 1.3);
});

test('multiplier term: multiplicative stacking policy is a one-line swap, not hardcoded', () => {
  const term = resolveMultiplierTerm([{ source: 'relicA', amount: 0.2 }, { source: 'buffB', amount: 0.1 }], 'multiplicative');
  assert.ok(Math.abs(term - 1.2 * 1.1) < 1e-9);
});

test('multiplier term: no modifiers is a neutral 1x, regardless of policy', () => {
  assert.strictEqual(resolveMultiplierTerm([], 'additive'), 1);
  assert.strictEqual(resolveMultiplierTerm([], 'multiplicative'), 1);
});
