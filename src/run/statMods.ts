// Shared helper for combining flat additive stat modifiers (docs/combat.md
// "Stat modifiers are flat numeric additives"). Used wherever run-tier
// content (equipment grants, rank-up grants) needs to fold into the same
// shape the engine's stat pipeline consumes (StatModifiers, engine/state.ts).
// Never used for damage-shaped values — those stay in the engine's separate
// multiplier-term accumulator (engine/damage/damagePipeline.ts).

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
