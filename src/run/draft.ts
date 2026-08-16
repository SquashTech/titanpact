// Start-of-run hero draft: 4 random candidates offered, player picks 2
// (App.tsx's opening screen, replacing a fixed cinderKnight+tidecaller
// opener so no two runs start the same way). Pure data selection, no view
// or engine concerns — same seeded-RNG discipline as map.ts/enemyGen.ts.

import { createRng, nextFloat } from '../engine/rng/seededRng';

export const STARTER_OPTION_COUNT = 4;
export const STARTER_PICK_COUNT = 2;

/** Draws `STARTER_OPTION_COUNT` distinct hero ids from `heroIds` as this run's starter draft pool. */
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
