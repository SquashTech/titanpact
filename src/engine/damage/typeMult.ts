// Type-effectiveness resolution (docs/types-and-heroes.md "Effectiveness resolution").
// The 15x15 matrix itself is DATA (src/data/typechart.ts); this module only
// implements how cells combine.

import type { TypeId } from '../content';

/** chart[moveType][defenderType] -> multiplier for a single type pairing. */
export type TypeChart = Record<TypeId, Record<TypeId, number>>;

/**
 * LOCKED (docs/types-and-heroes.md "Effectiveness resolution", 2026-08-15):
 * soft 0.25x floor only, no hard immunities. Multiplicative dual-type
 * stacking always clamps here — no chart cell should ever be authored as 0.
 */
export const TYPE_MULT_FLOOR = 0.25;

export function resolveTypeMult(
  chart: TypeChart,
  moveType: TypeId,
  defenderTypes: readonly TypeId[],
  floor: number = TYPE_MULT_FLOOR
): number {
  let mult = 1;
  for (const defType of defenderTypes) {
    const cell = chart[moveType]?.[defType];
    mult *= cell ?? 1;
  }
  return Math.max(mult, floor);
}

/** STAB = 1.25x if the move's type matches ANY of the user's types (never doubles for dual match). */
export const STAB_MULTIPLIER = 1.25;

export function resolveStab(moveType: TypeId, attackerTypes: readonly TypeId[]): number {
  return attackerTypes.includes(moveType) ? STAB_MULTIPLIER : 1;
}
