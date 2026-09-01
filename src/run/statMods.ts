// Folds flat additive stat modifiers into the engine's StatModifiers shape.
// Never for damage-shaped values — those stay in the damage pipeline (two-pipeline separation).

import type { StatModifiers } from '../engine/state';

export function mergeStatMods(...mods: readonly StatModifiers[]): StatModifiers {
  const out: StatModifiers = {};
  for (const mod of mods) {
    for (const [key, amount] of Object.entries(mod)) {
      const k = key as keyof StatModifiers;
      out[k] = (out[k] ?? 0) + (amount ?? 0);
    }
  }
  return out;
}
