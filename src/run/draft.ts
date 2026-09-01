// Start-of-run hero draft: STARTER_OPTION_COUNT random candidates, the player picks STARTER_PICK_COUNT.

import { createRng, nextFloat } from '../engine/rng/seededRng';

export const STARTER_OPTION_COUNT = 4;
export const STARTER_PICK_COUNT = 2;

export function generateStarterOptions(seed: number, heroIds: readonly string[]): string[] {
  const pool = [...heroIds];
  const picked: string[] = [];
  let state = createRng(seed);
  while (picked.length < Math.min(STARTER_OPTION_COUNT, pool.length)) {
    const { value, nextState } = nextFloat(state);
    state = nextState;
    const idx = Math.floor(value * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}
