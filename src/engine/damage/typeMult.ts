// Type-effectiveness resolution. The 15×15 matrix is data (src/data/typechart.ts);
// this module only combines cells.

import type { TypeId } from '../content';

/** chart[moveType][defenderType] -> multiplier for a single type pairing. */
export type TypeChart = Record<TypeId, Record<TypeId, number>>;

// Locked: soft 0.25× floor, no hard immunities (CLAUDE.md) — no chart cell may be authored as 0.
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

// Locked: STAB = 1.25 if the move's type is one of the user's types; never doubles for a dual match (CLAUDE.md)
export const STAB_MULTIPLIER = 1.25;

export function resolveStab(moveType: TypeId, attackerTypes: readonly TypeId[]): number {
  return attackerTypes.includes(moveType) ? STAB_MULTIPLIER : 1;
}
