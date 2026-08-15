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

import type { HeroDefinition, MoveDefinition } from '../content';
import type { Combatant, DamageCategory } from '../state';
import { getEffectiveStat } from '../state';
import { nextRange, nextFloat, type RngState } from '../rng/seededRng';
import { resolveStab, resolveTypeMult, type TypeChart } from './typeMult';

export const VARIANCE_MIN = 0.85;
export const VARIANCE_MAX = 1.0;

/**
 * 🔒 OPEN (docs/combat.md "Crit"): crit source is unresolved — base-stat-driven
 * vs. a loadout/equipment layer. Provisional, matching the prototype: a flat
 * chance rolled in the damage pipeline, not sourced from any stat or item.
 * Do not wire this to equipment/stats until that decision is signed off.
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
 * 🔒 OPEN (docs/combat.md "The damage-modifier multiplier term"): additive vs.
 * multiplicative stacking of damage modifiers is unresolved. Structured as a
 * one-line policy swap on purpose — do not pick one to make callers simpler.
 */
export type ModifierStackingPolicy = 'additive' | 'multiplicative';
export const PROVISIONAL_MODIFIER_STACKING: ModifierStackingPolicy = 'additive';

export function resolveMultiplierTerm(
  modifiers: readonly DamageModifier[],
  policy: ModifierStackingPolicy = PROVISIONAL_MODIFIER_STACKING
): number {
  if (modifiers.length === 0) return 1;
  if (policy === 'additive') {
    return 1 + modifiers.reduce((sum, m) => sum + m.amount, 0);
  }
  return modifiers.reduce((product, m) => product * (1 + m.amount), 1);
}

/** Pipeline 1: the off/def ratio only. Nothing damage-shaped may enter here. */
export function resolveStatRatio(
  category: DamageCategory,
  attackerHero: HeroDefinition,
  attacker: Combatant,
  defenderHero: HeroDefinition,
  defender: Combatant
): number {
  const [offKey, defKey] = category === 'physical' ? (['attack', 'defense'] as const) : (['intelligence', 'wisdom'] as const);
  const offStat = getEffectiveStat(attackerHero, attacker, offKey);
  const defStat = getEffectiveStat(defenderHero, defender, defKey);
  return offStat / defStat;
}

export interface DamageCalcResult {
  damage: number;
  ratio: number;
  stab: number;
  typeMult: number;
  variance: number;
  isCrit: boolean;
  multiplierTerm: number;
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
  stackingPolicy: ModifierStackingPolicy = PROVISIONAL_MODIFIER_STACKING,
  critMultiplier: number = PROVISIONAL_CRIT_MULTIPLIER
): DamageCalcResult {
  const stab = resolveStab(move.type, attackerTypes);
  const typeMult = resolveTypeMult(typeChart, move.type, defenderTypes);
  const crit = isCrit ? critMultiplier : 1;
  const multiplierTerm = resolveMultiplierTerm(modifiers, stackingPolicy);

  const damage = move.basePower * ratio * stab * typeMult * variance * crit * multiplierTerm;

  return { damage, ratio, stab, typeMult, variance, isCrit, multiplierTerm };
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
  critChance: number = PROVISIONAL_CRIT_CHANCE
): RolledDamage {
  const varianceRoll = nextRange(rngState, VARIANCE_MIN, VARIANCE_MAX);
  const critRoll = nextFloat(varianceRoll.nextState);
  const isCrit = critRoll.value < critChance;

  const result = calcDamage(move, ratio, attackerTypes, defenderTypes, typeChart, varianceRoll.value, isCrit, modifiers);

  return { ...result, nextRngState: critRoll.nextState };
}
