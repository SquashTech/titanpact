// The healing formula (docs/combat.md "The healing formula"):
//   Heal = HealPower × WisdomMult × STAB, WisdomMult = 1 + (Wisdom − 50)/100 clamped to [0.5, 2.0]
// No target max-HP term, no variance, no defender-side term — each a decision (see the doc).

import type { HeroDefinition, MoveDefinition, StatusDefinition, TypeId } from '../content';
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

/** The Wisdom term from a raw stat, so the view can run it off a hero sheet. */
export function wisdomMultFromStat(wisdom: number): number {
  // Locked: Heal = HealPower × WisdomMult × STAB, WisdomMult = 1 + (Wisdom − 50)/100 (CLAUDE.md)
  const raw = 1 + (wisdom - HEAL_WISDOM_REFERENCE) * HEAL_WISDOM_PER_POINT;
  return Math.min(HEAL_MULT_MAX, Math.max(HEAL_MULT_MIN, raw));
}

/** The caster's effective Wisdom, and nothing else (buffs/equipment/field flow in via getEffectiveStat, never folded into a stat). */
export function resolveWisdomMult(
  casterHero: HeroDefinition,
  caster: Combatant,
  fieldEffectCtx?: FieldEffectContext
): number {
  return wisdomMultFromStat(getEffectiveStat(casterHero, caster, 'wisdom', fieldEffectCtx));
}

/** The only two caster inputs the formula has — lets out-of-combat screens show a true number without a Combatant. */
export interface HealCaster {
  wisdom: number;
  types: readonly TypeId[];
}

export interface HealCalcResult {
  /** Rounded HP actually restored. */
  heal: number;
  healPower: number;
  wisdomMult: number;
  stab: number;
}

/** Pure: takes the resolved terms. */
export function calcHeal(healPower: number, wisdomMult: number, stab: number): HealCalcResult {
  return { heal: Math.round(healPower * wisdomMult * stab), healPower, wisdomMult, stab };
}

/** The formula from a plain stat + type pair. */
export function resolveHealFor(move: MoveDefinition, caster: HealCaster): HealCalcResult {
  return calcHeal(move.healPower ?? 0, wisdomMultFromStat(caster.wisdom), resolveStab(move.type, caster.types));
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
  });
}

/**
 * A HoT is healing, so the CASTER's Wisdom and STAB scale it — snapshotted at
 * application, never re-read per tick off the holder. Gated on `pipeline === 'hot'`,
 * not on move kind; non-HoT magnitudes pass through untouched.
 */
export function scaleHotMagnitude(
  magnitude: number | undefined,
  def: StatusDefinition,
  move: MoveDefinition,
  casterHero: HeroDefinition,
  caster: Combatant,
  fieldEffectCtx?: FieldEffectContext
): number | undefined {
  if (magnitude === undefined || def.pipeline !== 'hot') return magnitude;
  const wisdomMult = resolveWisdomMult(casterHero, caster, fieldEffectCtx);
  const stab = resolveStab(move.type, effectiveTypes(casterHero, caster));
  return Math.round(magnitude * wisdomMult * stab);
}
