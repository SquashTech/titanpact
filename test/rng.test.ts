import * as assert from 'assert';
import { test } from './harness';
import { createRng, nextFloat, nextRange, nextInt } from '../src/engine/rng/seededRng';

test('rng: same seed produces the same sequence', () => {
  const seqA: number[] = [];
  const seqB: number[] = [];
  let a = createRng(42);
  let b = createRng(42);
  for (let i = 0; i < 20; i++) {
    const ra = nextFloat(a);
    const rb = nextFloat(b);
    seqA.push(ra.value);
    seqB.push(rb.value);
    a = ra.nextState;
    b = rb.nextState;
  }
  assert.deepStrictEqual(seqA, seqB);
});

test('rng: different seeds diverge', () => {
  const a = nextFloat(createRng(1));
  const b = nextFloat(createRng(2));
  assert.notStrictEqual(a.value, b.value);
});

test('rng: nextFloat stays in [0, 1)', () => {
  let s = createRng(7);
  for (let i = 0; i < 500; i++) {
    const r = nextFloat(s);
    assert.ok(r.value >= 0 && r.value < 1, `value out of range: ${r.value}`);
    s = r.nextState;
  }
});

test('rng: nextRange respects bounds (variance roll shape)', () => {
  let s = createRng(99);
  for (let i = 0; i < 500; i++) {
    const r = nextRange(s, 0.85, 1.0);
    assert.ok(r.value >= 0.85 && r.value < 1.0, `variance out of range: ${r.value}`);
    s = r.nextState;
  }
});

test('rng: nextInt respects [min, max)', () => {
  let s = createRng(123);
  for (let i = 0; i < 200; i++) {
    const r = nextInt(s, 0, 3);
    assert.ok(r.value >= 0 && r.value < 3, `int out of range: ${r.value}`);
    s = r.nextState;
  }
});
