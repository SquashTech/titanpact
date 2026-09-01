// Pipeline 2 — the damage pipeline (docs/combat.md "The damage formula").
// Pipeline 1 (resolveStatRatio + state.ts getEffectiveStat) yields only the
// off/def ratio. Never fold a damage modifier back into a stat, and never let a
// stat-shaped effect leak into the multiplier term here (two-pipeline separation).

import type { HeroDefinition, MoveDefinition, StatKey, StatusDefinition } from '../content';
import type { Combatant, DamageCategory, FieldEffectContext } from '../state';
import { getEffectiveStat, hasStatus } from '../state';
import { nextRange, nextFloat, type RngState } from '../rng/seededRng';
import { resolveStab, resolveTypeMult, type TypeChart } from './typeMult';

// Locked: variance 0.85–1.0 (CLAUDE.md)
export const VARIANCE_MIN = 0.85;
export const VARIANCE_MAX = 1.0;

// Crit source is locked to the loadout/equipment layer (docs/combat.md) but not yet
// built; these are unsourced placeholders. A move's own critChance replaces the chance.
export const PROVISIONAL_CRIT_CHANCE = 1 / 16;
export const PROVISIONAL_CRIT_MULTIPLIER = 1.5;

/** A damage-shaped modifier (relic bonus, offensive buff, passive) — pipeline 2 only. */
export interface DamageModifier {
  source: string;
  amount: number; // e.g. 0.2 for a +20% modifier
}

// Locked: multiplicative stacking (docs/combat.md). Kept as a named policy for a future exception.
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

/** Elemental Force: summed magnitude of held statuses whose forceType matches the move's type — a BasePower input, not a stat. */
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

/**
 * The conditionalPower multiplier for one pending hit, read against LIVE state. A move
 * authors exactly one condition; HP forms are checked first. Optional context omitted
 * means that form reports its unbuffed power. Max HP is passed in rather than read:
 * pipeline 2 does not get to read stats.
 */
export function resolveConditionalPowerMultiplier(
  move: MoveDefinition,
  target: Combatant,
  attacker: Combatant,
  fieldEffectCtx?: FieldEffectContext,
  /** Required only by requiresTargetHpBelow. */
  targetMaxHp?: number,
  /** The user's HP as the cast BEGAN — a snapshot, so requiresUserHpBelow is all-or-nothing across a spread that drains. */
  attackerHp?: { currentHp: number; maxHp: number },
  /** The active partner's effective types (state.ts activePartnerTypes); required only by requiresPartnerType. */
  partnerTypes?: readonly string[] | null
): number {
  const conditional = move.conditionalPower;
  if (!conditional) return 1;
  if (conditional.requiresPartnerType != null) {
    return partnerTypes?.includes(conditional.requiresPartnerType) ? conditional.multiplier : 1;
  }
  if (conditional.requiresUserHpBelow != null) {
    // Strictly below, matching the target-side form.
    if (!attackerHp?.maxHp) return 1;
    return attackerHp.currentHp < attackerHp.maxHp * conditional.requiresUserHpBelow ? conditional.multiplier : 1;
  }
  if (conditional.requiresTargetHpBelow != null) {
    // Read before this hit's own damage lands; strictly below.
    if (!targetMaxHp) return 1;
    return target.currentHp < targetMaxHp * conditional.requiresTargetHpBelow ? conditional.multiplier : 1;
  }
  if (conditional.requiresFieldEffect) {
    return fieldEffectCtx?.active?.fieldEffectId === conditional.requiresFieldEffect ? conditional.multiplier : 1;
  }
  const holder = conditional.requiresTargetStatus ? target : conditional.requiresUserStatus ? attacker : null;
  const statusId = conditional.requiresTargetStatus ?? conditional.requiresUserStatus;
  if (!holder || !statusId) return 1;
  return hasStatus(holder, statusId) ? conditional.multiplier : 1;
}

/** Which raw stats feed the off/def ratio for a damage category. */
export function statKeysForCategory(category: DamageCategory): readonly [StatKey, StatKey] {
  return category === 'physical' ? (['attack', 'defense'] as const) : (['intelligence', 'wisdom'] as const);
}

/** statKeysForCategory with offStatOverride applied to the NUMERATOR only — the one place that swap is expressed. */
export function statKeysForMove(move: MoveDefinition): readonly [StatKey, StatKey] {
  const [offKey, defKey] = statKeysForCategory(move.category);
  return [move.offStatOverride ?? offKey, defKey] as const;
}

/** Pipeline 1: the off/def ratio only. Nothing damage-shaped may enter here. */
export function resolveStatRatio(
  category: DamageCategory,
  attackerHero: HeroDefinition,
  attacker: Combatant,
  defenderHero: HeroDefinition,
  defender: Combatant,
  fieldEffectCtx?: FieldEffectContext,
  /** Picks WHICH numerator stat is read; never scales anything. */
  offStatOverride?: StatKey
): number {
  const [defaultOffKey, defKey] = statKeysForCategory(category);
  const offKey = offStatOverride ?? defaultOffKey;
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
  /** The crit term as applied: critMultiplier when isCrit, else 1. */
  critMultiplier: number;
  multiplierTerm: number;
  /** Elemental Force's flat BasePower contribution (0 if none). */
  basePowerBonus: number;
  /** The conditional-BasePower multiplier as applied (1 when none). */
  basePowerMultiplier: number;
}

/** Pure pipeline 2. Takes pre-rolled variance/crit so it stays testable without RNG. */
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
  basePowerBonus: number = 0,
  basePowerMultiplier: number = 1,
  /** This round's rolled BasePower (randomBasePower), substituted for the authored one before the multiplier and Force bonus. */
  basePowerOverride?: number
): DamageCalcResult {
  const stab = resolveStab(move.type, attackerTypes);
  const typeMult = resolveTypeMult(typeChart, move.type, defenderTypes);
  const crit = isCrit ? critMultiplier : 1;
  const multiplierTerm = resolveMultiplierTerm(modifiers, stackingPolicy);

  // Both BasePower-stage terms land on the formula's BasePower input: (authored × conditional) + Force.
  const effectiveBasePower = (basePowerOverride ?? move.basePower ?? 0) * basePowerMultiplier + basePowerBonus;
  // Locked: Damage = BasePower × (off/def) × STAB × TypeMult × Variance × Crit (CLAUDE.md)
  const damage = effectiveBasePower * ratio * stab * typeMult * variance * crit * multiplierTerm;

  return { damage, ratio, stab, typeMult, variance, isCrit, critMultiplier: crit, multiplierTerm, basePowerBonus, basePowerMultiplier };
}

export interface RolledDamage extends DamageCalcResult {
  nextRngState: RngState;
}

/** Draws variance first, then the crit roll — a fixed order (docs/architecture.md "Determinism & RNG"). Never reorder. */
export function rollDamage(
  move: MoveDefinition,
  ratio: number,
  attackerTypes: readonly string[],
  defenderTypes: readonly string[],
  typeChart: TypeChart,
  rngState: RngState,
  modifiers: readonly DamageModifier[] = [],
  critChance: number = PROVISIONAL_CRIT_CHANCE,
  basePowerBonus: number = 0,
  basePowerMultiplier: number = 1,
  /** Drawn OUTSIDE this function (state.ts resolveRandomBasePower), so it costs no RNG here. */
  basePowerOverride?: number
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
    basePowerBonus,
    basePowerMultiplier,
    basePowerOverride
  );

  return { ...result, nextRngState: critRoll.nextState };
}
