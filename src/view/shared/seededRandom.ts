// Rolls a screen makes, fixed by a seed its App screen carries, so a run resumed from a save shows
// the same offers it left (docs/save-system.md D2).

import { createRng, nextFloat } from '../../engine/rng/seededRng';

function mix(seed: number, salt: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** A float stream in [0, 1) off `seed`, varied by `salt` so two rolls off one screen differ. */
export function seededRandom(seed: number, salt = ''): () => number {
  let state = createRng(mix(seed, salt));
  return () => {
    const { value, nextState } = nextFloat(state);
    state = nextState;
    return value;
  };
}

/**
 * Runs `roll` with Math.random drawn from `seed`. For catalog rolls whose randomness sits several
 * calls deep (a drop's rarity, then its family, then its enchant); synchronous only, and the real
 * Math.random is back before this returns.
 */
export function withSeededRandom<T>(seed: number, roll: () => T, salt = ''): T {
  const original = Math.random;
  Math.random = seededRandom(seed, salt);
  try {
    return roll();
  } finally {
    Math.random = original;
  }
}
