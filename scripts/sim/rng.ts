// Seeded Math.random replacement for the batch simulator. The run tier reaches
// for Math.random in several places (shop.ts, run/events.ts, the reward screens
// this simulator re-implements), so the only way to make a whole run
// reproducible from one seed is to own the global.

export type Rng = () => number;

/** mulberry32 — small, fast, good enough for balance sampling. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const nativeRandom = Math.random;

/** Points Math.random at `rng` for the duration of `fn`, then restores it. */
export function withRandom<T>(rng: Rng, fn: () => T): T {
  Math.random = rng;
  try {
    return fn();
  } finally {
    Math.random = nativeRandom;
  }
}

export function pick<T>(rng: Rng, pool: readonly T[]): T {
  return pool[Math.floor(rng() * pool.length)];
}

/** Uniform sample without replacement. */
export function sample<T>(rng: Rng, pool: readonly T[], count: number): T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  while (picked.length < Math.min(count, remaining.length)) {
    picked.push(remaining.splice(Math.floor(rng() * remaining.length), 1)[0]);
  }
  return picked;
}

export function randomSeed(rng: Rng): number {
  return Math.floor(rng() * 2 ** 31);
}
