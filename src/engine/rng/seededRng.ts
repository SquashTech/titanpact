// Seeded, deterministic PRNG — the ONLY randomness source allowed under
// /src/engine (docs/architecture.md "Determinism & RNG"). Never Math.random().
// State is a plain uint32 so it lives inside serializable CombatState.

export type RngState = number; // uint32

export function createRng(seed: number): RngState {
  return seed >>> 0;
}

/** mulberry32. Pure: returns the next float in [0, 1) and the next state. */
export function nextFloat(state: RngState): { value: number; nextState: RngState } {
  let s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState: s };
}

/** Integer roll in [min, max). */
export function nextInt(state: RngState, min: number, max: number): { value: number; nextState: RngState } {
  const { value, nextState } = nextFloat(state);
  return { value: min + Math.floor(value * (max - min)), nextState };
}

/** Uniform roll in [min, max). */
export function nextRange(state: RngState, min: number, max: number): { value: number; nextState: RngState } {
  const { value, nextState } = nextFloat(state);
  return { value: min + value * (max - min), nextState };
}
