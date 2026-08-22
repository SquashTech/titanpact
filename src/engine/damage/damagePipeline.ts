// The two damage pipelines (LOCKED separation — docs/architecture.md "The two
// damage pipelines", docs/combat.md "The damage formula").
//
//   Damage = BasePower x (offStat/defStat) x STAB x TypeMult x Variance x Crit x MultiplierTerm
//
// Pipeline 1 (stat pipeline) produces only the off/def RATIO — see
// resolveStatRatio below and getEffectiveStat in ../state.ts. Pipeline 2 (this
// module) applies BasePower and every multiplier term. Never fold a damage
// modifier back into a stat, and never let a stat-shaped effect leak into the
// multiplier term here.

import type { HeroDefinition, MoveDefinition, StatKey, StatusDefinition } from '../content';
import type { Combatant, DamageCategory, FieldEffectContext } from '../state';
import { getEffectiveStat } from '../state';
import { nextRange, nextFloat, type RngState } from '../rng/seededRng';
import { resolveStab, resolveTypeMult, type TypeChart } from './typeMult';

export const VARIANCE_MIN = 0.85;
export const VARIANCE_MAX = 1.0;

/**
 * Crit source is LOCKED (docs/combat.md "Crit", 2026-08-15): a loadout/equipment
 * layer, not a base stat. NOT YET IMPLEMENTED — equipment.ts has no crit-chance
 * field yet, so this stays a flat, unsourced placeholder until that's built.
 * When it is, thread the equipped crit-chance grant into rollDamage in place of
 * this constant rather than adding a crit StatKey to the stat pipeline.
 */
export const PROVISIONAL_CRIT_CHANCE = 1 / 16;
export const PROVISIONAL_CRIT_MULTIPLIER = 1.5;

/**
 * Situational damage-shaped modifiers (relic damage bonuses, offensive buffs,
 * etc). Empty in this engine slice — no abilities/relics/equipment are wired
 * up yet — but the accumulator shape is here so pipeline 2 stays the single
 * place these ever attach.
 */
export interface DamageModifier {
  source: string;
  amount: number; // e.g. 0.2 for a +20% modifier
}

/**
 * Stacking policy is LOCKED (docs/combat.md "The damage-modifier multiplier
 * term", 2026-08-15): multiplicative. Kept as a named policy type / one-line
 * swap rather than inlining the multiplicative math, so a future exception
 * (a specific relic that stacks additively, say) stays easy to special-case.
 */
export type ModifierStackingPolicy = 'additive' | 'multiplicative';
export const LOCKED_MODIFIER_STACKING: ModifierStackingPolicy = 'multiplicative';

export function resolveMultiplierTerm(
  modifiers: readonly DamageModifier[],
  policy: ModifierStackingPolicy = LOCKED_MODIFIER_STACKING
): number {
  if (modifiers.length === 0) return 1;
  if (policy === 'additive') {
    return 1 + modifiers.reduce((sum, m) => sum + m.amount, 0);
  }
  return modifiers.reduce((product, m) => product * (1 + m.amount), 1);
}

/**
 * Elemental Force: sums the magnitude of every status the attacker holds
 * whose StatusDefinition.forceType matches the move's type (src/data/
 * statuses.ts's `${Type}Force` catalog) — a hero holding both Fire Force and
 * Water Force only gets the matching one(s) added. This is pipeline 2's own
 * concern (it changes the formula's BasePower input, not a stat), so it lives
 * here rather than in statusEngine.ts.
 */
export function resolveElementalForceBonus(
  attacker: Combatant,
  moveType: string,
  statusDefs: Record<string, StatusDefinition>
): number {
  let bonus = 0;
  for (const [statusId, instance] of Object.entries(attacker.statuses)) {
    if (statusDefs[statusId]?.forceType === moveType) bonus += instance.magnitude ?? 0;
  }
  return bonus;
}

/** Which raw stats feed the off/def ratio for a damage category — shared by resolveStatRatio and by callers that want the raw values (e.g. the Battle Log's math readout) without duplicating the mapping. */
export function statKeysForCategory(category: DamageCategory): readonly [StatKey, StatKey] {
  return category === 'physical' ? (['attack', 'defense'] as const) : (['intelligence', 'wisdom'] as const);
}

/** Pipeline 1: the off/def ratio only. Nothing damage-shaped may enter here. `fieldEffectCtx` is a stat-pipeline input (Verdant Earth's statBonusEqualToRegen), not a damage modifier — see getEffectiveStat. */
export function resolveStatRatio(
  category: DamageCategory,
  attackerHero: HeroDefinition,
  attacker: Combatant,
  defenderHero: HeroDefinition,
  defender: Combatant,
  fieldEffectCtx?: FieldEffectContext
): number {
  const [offKey, defKey] = statKeysForCategory(category);
  const offStat = getEffectiveStat(attackerHero, attacker, offKey, fieldEffectCtx);
  const defStat = getEffectiveStat(defenderHero, defender, defKey, fieldEffectCtx);
  return offStat / defStat;
}

export interface DamageCalcResult {
  damage: number;
  ratio: number;
  stab: number;
  typeMult: number;
  variance: number;
  isCrit: boolean;
  /** The crit term as actually applied: critMultiplier when isCrit, else 1 — carried on the result so callers (the Battle Log's math readout) don't have to re-derive it from isCrit + the provisional constant. */
  critMultiplier: number;
  multiplierTerm: number;
  /** Elemental Force's contribution to this hit's BasePower (0 if none) — see resolveElementalForceBonus above. Added to move.basePower BEFORE every multiplier term, unlike `modifiers`/multiplierTerm which scale the already-computed result. */
  basePowerBonus: number;
}

/** Pure: pipeline 2. Takes pre-rolled variance/crit so this stays testable without RNG. */
export function calcDamage(
  move: MoveDefinition,
  ratio: number,
  attackerTypes: readonly string[],
  defenderTypes: readonly string[],
  typeChart: TypeChart,
  variance: number,
  isCrit: boolean,
  modifiers: readonly DamageModifier[] = [],
  stackingPolicy: ModifierStackingPolicy = LOCKED_MODIFIER_STACKING,
  critMultiplier: number = PROVISIONAL_CRIT_MULTIPLIER,
  basePowerBonus: number = 0
): DamageCalcResult {
  const stab = resolveStab(move.type, attackerTypes);
  const typeMult = resolveTypeMult(typeChart, move.type, defenderTypes);
  const crit = isCrit ? critMultiplier : 1;
  const multiplierTerm = resolveMultiplierTerm(modifiers, stackingPolicy);

  // Elemental Force adds directly to the formula's own BasePower input — a 40
  // BP move with Fire Force 20 becomes a 60 BP move, not a 40 BP move dealt at
  // +20% damage (that's what `modifiers`/multiplierTerm are for instead).
  const effectiveBasePower = (move.basePower ?? 0) + basePowerBonus;
  const damage = effectiveBasePower * ratio * stab * typeMult * variance * crit * multiplierTerm;

  return { damage, ratio, stab, typeMult, variance, isCrit, critMultiplier: crit, multiplierTerm, basePowerBonus };
}

export interface RolledDamage extends DamageCalcResult {
  nextRngState: RngState;
}

/**
 * Draws RNG in the FIXED, DOCUMENTED order required by docs/architecture.md
 * "Determinism & RNG": variance first, then the crit roll. Same seed + same
 * inputs must always reproduce the same fight — never reorder these draws.
 */
export function rollDamage(
  move: MoveDefinition,
  ratio: number,
  attackerTypes: readonly string[],
  defenderTypes: readonly string[],
  typeChart: TypeChart,
  rngState: RngState,
  modifiers: readonly DamageModifier[] = [],
  critChance: number = PROVISIONAL_CRIT_CHANCE,
  basePowerBonus: number = 0
): RolledDamage {
  const varianceRoll = nextRange(rngState, VARIANCE_MIN, VARIANCE_MAX);
  const critRoll = nextFloat(varianceRoll.nextState);
  const isCrit = critRoll.value < critChance;

  const result = calcDamage(
    move,
    ratio,
    attackerTypes,
    defenderTypes,
    typeChart,
    varianceRoll.value,
    isCrit,
    modifiers,
    LOCKED_MODIFIER_STACKING,
    PROVISIONAL_CRIT_MULTIPLIER,
    basePowerBonus
  );

  return { ...result, nextRngState: critRoll.nextState };
}
