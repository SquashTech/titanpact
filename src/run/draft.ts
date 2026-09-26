// Start-of-run hero draft (docs/collection.md §2): one hero drawn from each deck row, then
// STARTER_OPTION_COUNT of those shown, and the player picks STARTER_PICK_COUNT.

import { createRng, nextFloat, type RngState } from '../engine/rng/seededRng';

export const STARTER_OPTION_COUNT = 4;
export const STARTER_PICK_COUNT = 2;

function drawIndex(state: RngState, length: number): { index: number; state: RngState } {
  const { value, nextState } = nextFloat(state);
  return { index: Math.floor(value * length), state: nextState };
}

/** One hero a row, then four of those: the options always span four types. */
export function generateStarterOptions(seed: number, rows: readonly (readonly string[])[]): string[] {
  let state = createRng(seed);
  const pool: string[] = [];
  for (const row of rows) {
    if (row.length === 0) continue;
    const draw = drawIndex(state, row.length);
    state = draw.state;
    pool.push(row[draw.index]);
  }
  const picked: string[] = [];
  while (picked.length < Math.min(STARTER_OPTION_COUNT, pool.length)) {
    const draw = drawIndex(state, pool.length);
    state = draw.state;
    picked.push(pool.splice(draw.index, 1)[0]);
  }
  return picked;
}
