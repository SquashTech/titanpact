// The healing formula (docs/combat.md "The healing formula"):
//   Heal = HealPower × WisdomMult × STAB, WisdomMult = 1 + (Wisdom − 50)/100 clamped to [0.5, 2.0]
// No target max-HP term, no variance, no defender-side term — each a decision (see the doc).
// A Field Effect's healMultiplier (Sanctuary) is a term of THIS pipeline, as a damage modifier is
// of the damage pipeline — never a Wisdom bonus (docs/field-effects.md).

import type { HeroDefinition, MoveDefinition, StatKey, TypeId } from '../content';
import type { Combatant, FieldEffectContext } from '../state';
import { getEffectiveStat, effectiveTypes } from '../state';
import { resolveStab } from '../damage/typeMult';

/** The Wisdom at which a move heals exactly its authored HealPower. */
export const HEAL_WISDOM_REFERENCE = 50;

/** One point of Wisdom above/below the reference is ±1% healing. */
export const HEAL_WISDOM_PER_POINT = 0.01;

/** Guardrails on the unopposed term. */
export const HEAL_MULT_MIN = 0.5;
export const HEAL_MULT_MAX = 2.0;

/**
 * The stat term from a raw stat, so the view can run it off a hero sheet. Named for the
 * formula rather than for Wisdom because `status/statusMagnitude.ts` runs the same term
 * off Attack or Intelligence for a DoT — one rule, one clamp, one set of constants.
 */
export function magnitudeMultFromStat(stat: number): number {
  // Locked: Heal = HealPower × WisdomMult × STAB, WisdomMult = 1 + (Wisdom − 50)/100 (CLAUDE.md)
  const raw = 1 + (stat - HEAL_WISDOM_REFERENCE) * HEAL_WISDOM_PER_POINT;
  return Math.min(HEAL_MULT_MAX, Math.max(HEAL_MULT_MIN, raw));
}

/** The caster's effective Wisdom, and nothing else (buffs/equipment/field flow in via getEffectiveStat, never folded into a stat). */
export function resolveWisdomMult(
  casterHero: HeroDefinition,
  caster: Combatant,
  fieldEffectCtx?: FieldEffectContext
): number {
  return magnitudeMultFromStat(getEffectiveStat(casterHero, caster, 'wisdom', fieldEffectCtx));
}

/**
 * The only two caster inputs the formula has — lets out-of-combat screens show a true number
 * without a Combatant. `stats` carries the rest of the line for the same reason a heal needs
 * Wisdom: a move's status riders scale off the caster too (`MagnitudeCaster`), and a screen
 * that omits it prints the authored base instead of the figure the move lands.
 */
export interface HealCaster {
  wisdom: number;
  types: readonly TypeId[];
  stats?: Partial<Record<StatKey, number>>;
  /** The active Field Effect's healMultiplier, resolved by whoever holds the board (fieldHealMultiplier). Omitted = 1. */
  fieldMult?: number;
}

export interface HealCalcResult {
  /** Rounded HP actually restored. */
  heal: number;
  healPower: number;
  wisdomMult: number;
  stab: number;
  fieldMult: number;
}

/** Pure: takes the resolved terms. */
export function calcHeal(healPower: number, wisdomMult: number, stab: number, fieldMult: number = 1): HealCalcResult {
  return { heal: Math.round(healPower * wisdomMult * stab * fieldMult), healPower, wisdomMult, stab, fieldMult };
}

/** The active Field Effect's heal term, or 1 with none up. */
export function fieldHealMultiplier(fieldEffectCtx?: FieldEffectContext): number {
  const id = fieldEffectCtx?.active?.fieldEffectId;
  return (id && fieldEffectCtx?.defs[id]?.healMultiplier) || 1;
}

/** The formula from a plain stat + type pair. */
export function resolveHealFor(move: MoveDefinition, caster: HealCaster): HealCalcResult {
  return calcHeal(move.healPower ?? 0, magnitudeMultFromStat(caster.wisdom), resolveStab(move.type, caster.types), caster.fieldMult ?? 1);
}

/** The whole formula for one caster + one heal move. Target-independent, so a bothAllies heal resolves once. */
export function resolveHeal(
  move: MoveDefinition,
  casterHero: HeroDefinition,
  caster: Combatant,
  fieldEffectCtx?: FieldEffectContext
): HealCalcResult {
  return resolveHealFor(move, {
    wisdom: getEffectiveStat(casterHero, caster, 'wisdom', fieldEffectCtx),
    types: effectiveTypes(casterHero, caster),
    fieldMult: fieldHealMultiplier(fieldEffectCtx),
  });
}
