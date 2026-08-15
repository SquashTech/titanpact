// Type-effectiveness resolution (docs/types-and-heroes.md "Effectiveness resolution").
// The 15x15 matrix itself is DATA (src/data/typechart.ts); this module only
// implements how cells combine.

import type { TypeId } from '../content';

/** chart[moveType][defenderType] -> multiplier for a single type pairing. */
export type TypeChart = Record<TypeId, Record<TypeId, number>>;

/**
 * 🔒 OPEN (docs/types-and-heroes.md): soft 0.25x floor vs. hard immunities (0x).
 * Provisional policy, matching the prototype: multiplicative stacking, clamped
 * at a 0.25x floor, no immunities. Do not introduce a 0x anywhere until this
 * is signed off — changing to hard immunities means removing this clamp and
 * allowing 0-valued chart cells.
 */
export const PROVISIONAL_TYPE_MULT_FLOOR = 0.25;

export function resolveTypeMult(
  chart: TypeChart,
  moveType: TypeId,
  defenderTypes: readonly TypeId[],
  floor: number = PROVISIONAL_TYPE_MULT_FLOOR
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
