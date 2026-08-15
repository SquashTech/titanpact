// Seeded, deterministic PRNG. This is the ONLY randomness source allowed inside
// /src/engine — see docs/architecture.md "Determinism & RNG". Never call
// Math.random() anywhere under /src/engine.
//
// RNG state is a plain uint32, so it can live inside serializable CombatState
// and a fight can be replayed exactly from (seed, inputs).

export type RngState = number; // uint32

export function createRng(seed: number): RngState {
  // Force into uint32 range so callers can pass any integer seed.
  return seed >>> 0;
}

/**
 * mulberry32 — small, fast, well-distributed 32-bit PRNG.
 * Pure function: takes a state, returns the next float in [0, 1) and the next state.
 * Never mutates its input.
 */
export function nextFloat(state: RngState): { value: number; nextState: RngState } {
  let s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState: s };
}

/** Inclusive-exclusive integer roll: [min, max) */
export function nextInt(state: RngState, min: number, max: number): { value: number; nextState: RngState } {
  const { value, nextState } = nextFloat(state);
  return { value: min + Math.floor(value * (max - min)), nextState };
}

/**
 * Uniform roll in [min, max), e.g. the damage Variance roll (0.85-1.0).
 */
export function nextRange(state: RngState, min: number, max: number): { value: number; nextState: RngState } {
  const { value, nextState } = nextFloat(state);
  return { value: min + value * (max - min), nextState };
}
