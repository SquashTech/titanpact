// The healing formula (docs/combat.md "The healing formula").
//
//   Heal = HealPower x WisdomMult x STAB
//   WisdomMult = 1 + (effectiveWisdom - 50) / 100, clamped to [0.5, 2.0]
//
// Deliberately NOT a mirror of the damage formula, in three ways, each of
// which is a decision rather than an omission:
//
//  1. **No target max-HP term.** A heal buys TURNS, not hit points, and turns
//     bought = heal / incoming damage per hit. A wall's high Defence already
//     makes a flat heal worth ~3x more turns on it than on a glass caster;
//     scaling by max HP would multiply that same bias again and make low-HP
//     heroes literally un-healable, straight into CLAUDE.md's "no hero is a
//     trap pick". Healing is absolute, and that is the point.
//  2. **No variance.** Variance is load-bearing on DAMAGE (docs/combat.md) —
//     it blurs the kill range so the attacker cannot compute a guaranteed
//     lethal. On a heal the planner and the randomised party are the same
//     person, so it punishes correct play without creating a decision.
//  3. **No defender-side term at all.** Healing is unopposed: nothing scales
//     against it. That is why WisdomMult is a gentle linear nudge rather than
//     a full off/def ratio, which would run away without an opposing stat.
//
// Wisdom rather than the move's category off-stat (Intelligence/Attack) so
// that support is its own build axis instead of collapsing into "mage who
// sometimes heals" — and so a future physical self-heal can't scale off an
// 90-Attack bruiser. See docs/combat.md for the open question this leaves.

import type { HeroDefinition, MoveDefinition, StatusDefinition, TypeId } from '../content';
import type { Combatant, FieldEffectContext } from '../state';
import { getEffectiveStat, effectiveTypes } from '../state';
import { resolveStab } from '../damage/typeMult';

/** The Wisdom at which a move heals exactly its authored HealPower. Roster mid-point, so every authored number reads as "what an average caster gets". */
export const HEAL_WISDOM_REFERENCE = 50;

/**
 * One point of Wisdom above/below the reference is +/-1% healing. Chosen to
 * line up with the locked "stat modifiers are flat additives in multiples of
 * 5 or 10" rule, so it reads at the design table as "+10 Wisdom is +10%
 * healing" — a Fortify visibly helps the healer.
 */
export const HEAL_WISDOM_PER_POINT = 0.01;

/** Guardrails on the unopposed term. Nothing in the current roster comes near either end; they exist so a future stacking Wisdom buff can't turn a heal into a full restore. */
export const HEAL_MULT_MIN = 0.5;
export const HEAL_MULT_MAX = 2.0;

/**
 * The Wisdom term on its own, from a raw stat value. Split out from
 * resolveWisdomMult so the view layer can run the same formula from a hero
 * sheet — where there is a Wisdom number and a type list but no live
 * `Combatant` — instead of reimplementing it and drifting.
 */
export function wisdomMultFromStat(wisdom: number): number {
  const raw = 1 + (wisdom - HEAL_WISDOM_REFERENCE) * HEAL_WISDOM_PER_POINT;
  return Math.min(HEAL_MULT_MAX, Math.max(HEAL_MULT_MIN, raw));
}

/**
 * Pipeline 1's analogue for healing: the caster's Wisdom, and nothing else.
 * Read through getEffectiveStat so buffs, equipment and field effects all flow
 * in without being folded back into a stat (CLAUDE.md's two-pipeline rule).
 */
export function resolveWisdomMult(
  casterHero: HeroDefinition,
  caster: Combatant,
  fieldEffectCtx?: FieldEffectContext
): number {
  return wisdomMultFromStat(getEffectiveStat(casterHero, caster, 'wisdom', fieldEffectCtx));
}

/** The minimum a caller needs to know about a caster to run the formula — the only two inputs it has. Lets an out-of-combat screen (hero sheet, level-up, draft) show a true number without inventing a Combatant. */
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

/** Pure: takes the resolved terms, so it stays testable without any combat state. */
export function calcHeal(healPower: number, wisdomMult: number, stab: number): HealCalcResult {
  return { heal: Math.round(healPower * wisdomMult * stab), healPower, wisdomMult, stab };
}

/** The formula from a plain stat + type pair. The one place the three terms are put together — resolveHeal below is this plus the effective-stat read. */
export function resolveHealFor(move: MoveDefinition, caster: HealCaster): HealCalcResult {
  return calcHeal(move.healPower ?? 0, wisdomMultFromStat(caster.wisdom), resolveStab(move.type, caster.types));
}

/**
 * The whole formula for one caster + one heal move. Target-independent by
 * design (see the no-max-HP note above), so a `bothAllies` heal resolves this
 * once and applies the same number to each ally.
 */
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
 * A heal-over-turn is healing, so the healer's Wisdom and STAB scale it too —
 * but SNAPSHOT at application time, not recomputed per tick off whoever is
 * holding it. Renew persists through switch (docs/conditions.md), and the
 * caster earned the magnitude; re-reading the holder's Wisdom every round
 * would make the same Second Wind worth more on a bulkier ally who had
 * nothing to do with casting it.
 *
 * Gated on `pipeline === 'hot'` rather than on a move-kind check, so a damage
 * move that happens to grant Renew scales its Renew and a heal move that
 * happens to inflict Burn does not scale the Burn. Decay-by-halving is
 * untouched — it operates on whatever magnitude lands here.
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
