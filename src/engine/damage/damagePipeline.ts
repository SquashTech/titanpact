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
import { getEffectiveStat, hasStatus } from '../state';
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
 *
 * A move may author its OWN rate (MoveDefinition.critChance — Fire's
 * Singe/Firebrand at 30%), which replaces this default for that move only.
 * That is still not a stat, so the lock holds; how a high-crit move and a
 * future crit-chance accessory combine is an open decision, flagged on the
 * field itself.
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

/**
 * The conditional-BasePower multiplier for one pending hit
 * (MoveDefinition.conditionalPower — Fire's Immolate, "triple base power if
 * the target is Burned"; Nature's Seed Shot, "double damage if the USER has
 * Renew"; Light's Smite, "double damage if SANCTUARY is active"). 1 when the
 * move authors no condition, or when whatever the condition asks about is not
 * the case.
 *
 * Five questions, one answer: `requiresTargetStatus` reads the defender,
 * `requiresUserStatus` reads the attacker, `requiresFieldEffect` reads the
 * board itself, `requiresTargetHpBelow` reads a NUMBER off the defender
 * (Shadow's Rend and Eclipse, "double damage if the target is below 50%
 * HP") rather than the presence of anything, and `requiresUserHpBelow` asks
 * that same number of the ATTACKER (Spirit's Spite and Vengeance, "double
 * base power if the USER is below 50% HP"). A move authors exactly one; the
 * HP forms are checked first and the rest oldest-first, and a move authoring
 * two is malformed content rather than a shape with a meaning.
 *
 * Read against LIVE state at the moment the hit resolves, so a Burn, a Renew —
 * or a Sanctuary — applied by a faster action earlier in the same round
 * already counts. That freshness matters more on the user and field sides than
 * it ever did on the target side: it is what lets a Nature partner cast
 * Regrowth and have the same round's Branch Slam already be doubled, and a
 * Light partner cast Consecrate and have the same round's Smite already be
 * doubled.
 *
 * `fieldEffectCtx` and `targetMaxHp` are both optional for the same reason:
 * omit them and the two status forms behave exactly as before, so every
 * caller that has no board (or no hero definition) in scope keeps working. A
 * field-gated or HP-gated move asked without its context simply reports its
 * unbuffed power. The HP form takes the max as an argument rather than
 * reaching for getMaxHp itself: that lives in state.ts alongside the stat
 * pipeline, and pipeline 2 does not get to read stats (CLAUDE.md
 * "Two-pipeline separation").
 *
 * Pipeline 2's concern (it changes the formula's BasePower input, not a stat),
 * so it lives here next to resolveElementalForceBonus rather than in
 * statusEngine.ts.
 */
export function resolveConditionalPowerMultiplier(
  move: MoveDefinition,
  target: Combatant,
  attacker: Combatant,
  fieldEffectCtx?: FieldEffectContext,
  /** The TARGET's max HP — required only by the requiresTargetHpBelow form, which reports no bonus without it (see above). */
  targetMaxHp?: number,
  /**
   * The USER's HP as it stood when the cast began — required only by the
   * requiresUserHpBelow form, which reports no bonus without it.
   *
   * A SNAPSHOT rather than the live `attacker`, and that is the whole point:
   * this form promises all-or-nothing across a spread cast (content.ts
   * requiresUserHpBelow), which a live read cannot keep on a move that also
   * drains — the first target's drain would heal the caster back over the
   * line before the second hit asked. Passed in rather than read off
   * `attacker` so the snapshot lives at the one call site that knows when the
   * cast began.
   */
  attackerHp?: { currentHp: number; maxHp: number },
  /**
   * The effective types of the caster's ACTIVE PARTNER (state.ts
   * activePartnerTypes), or null/undefined when there is no live partner —
   * required only by the requiresPartnerType form (Beast's Pack Hunt), which
   * reports no bonus without it.
   *
   * A resolved type list rather than the state and a roster, so this stays a
   * pure function of the hit's own context like every argument before it.
   */
  partnerTypes?: readonly string[] | null
): number {
  const conditional = move.conditionalPower;
  if (!conditional) return 1;
  if (conditional.requiresPartnerType != null) {
    // The only sibling that asks about a combatant on the caster's OWN side.
    // All-or-nothing across a spread cast: one question, one answer, however
    // many targets the move goes on to hit (content.ts requiresPartnerType).
    return partnerTypes?.includes(conditional.requiresPartnerType) ? conditional.multiplier : 1;
  }
  if (conditional.requiresUserHpBelow != null) {
    // Strictly below, matching the target-side form: a caster sitting exactly
    // at half has not yet earned Spite's double.
    if (!attackerHp?.maxHp) return 1;
    return attackerHp.currentHp < attackerHp.maxHp * conditional.requiresUserHpBelow ? conditional.multiplier : 1;
  }
  if (conditional.requiresTargetHpBelow != null) {
    // Read off the target's LIVE currentHp, before this hit's own damage is
    // applied — an execute rewards a foe something else already softened,
    // never one this very hit pushed under the line (content.ts
    // requiresTargetHpBelow). Strictly below, so a target sitting exactly at
    // half is not yet executable.
    if (!targetMaxHp) return 1;
    return target.currentHp < targetMaxHp * conditional.requiresTargetHpBelow ? conditional.multiplier : 1;
  }
  if (conditional.requiresFieldEffect) {
    // One global slot, so no holder to read it off (content.ts
    // requiresFieldEffect). Compared by id rather than by definition lookup:
    // what matters is which effect is ACTIVE, not what it does.
    return fieldEffectCtx?.active?.fieldEffectId === conditional.requiresFieldEffect ? conditional.multiplier : 1;
  }
  const holder = conditional.requiresTargetStatus ? target : conditional.requiresUserStatus ? attacker : null;
  const statusId = conditional.requiresTargetStatus ?? conditional.requiresUserStatus;
  if (!holder || !statusId) return 1;
  return hasStatus(holder, statusId) ? conditional.multiplier : 1;
}

/** Which raw stats feed the off/def ratio for a damage category — shared by resolveStatRatio and by callers that want the raw values (e.g. the Battle Log's math readout) without duplicating the mapping. */
export function statKeysForCategory(category: DamageCategory): readonly [StatKey, StatKey] {
  return category === 'physical' ? (['attack', 'defense'] as const) : (['intelligence', 'wisdom'] as const);
}

/**
 * statKeysForCategory, with MoveDefinition.offStatOverride applied — Stone's
 * Body Blow swapping Defense in for Attack on the ratio's NUMERATOR only.
 *
 * The one place that swap is expressed, so the ratio the damage uses and the
 * offStat the Battle Log prints cannot drift apart. The defender key is
 * untouched by design: a physical move still divides by the target's Defense
 * whatever the attacker is hitting with (content.ts offStatOverride).
 */
export function statKeysForMove(move: MoveDefinition): readonly [StatKey, StatKey] {
  const [offKey, defKey] = statKeysForCategory(move.category);
  return [move.offStatOverride ?? offKey, defKey] as const;
}

/** Pipeline 1: the off/def ratio only. Nothing damage-shaped may enter here. `fieldEffectCtx` is a stat-pipeline input (Verdant Earth's statBonusEqualToStatusMagnitude), not a damage modifier — see getEffectiveStat. */
export function resolveStatRatio(
  category: DamageCategory,
  attackerHero: HeroDefinition,
  attacker: Combatant,
  defenderHero: HeroDefinition,
  defender: Combatant,
  fieldEffectCtx?: FieldEffectContext,
  /** MoveDefinition.offStatOverride — replaces the numerator's stat, never the denominator's. Still pipeline 1: this picks WHICH stat is read, it does not scale anything. */
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
  /** The crit term as actually applied: critMultiplier when isCrit, else 1 — carried on the result so callers (the Battle Log's math readout) don't have to re-derive it from isCrit + the provisional constant. */
  critMultiplier: number;
  multiplierTerm: number;
  /** Elemental Force's contribution to this hit's BasePower (0 if none) — see resolveElementalForceBonus above. Added to move.basePower BEFORE every multiplier term, unlike `modifiers`/multiplierTerm which scale the already-computed result. */
  basePowerBonus: number;
  /** The conditional-BasePower multiplier as actually applied (1 when none) — see resolveConditionalPowerMultiplier above. Multiplies the AUTHORED BasePower, before basePowerBonus is added on. */
  basePowerMultiplier: number;
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
  basePowerBonus: number = 0,
  basePowerMultiplier: number = 1
): DamageCalcResult {
  const stab = resolveStab(move.type, attackerTypes);
  const typeMult = resolveTypeMult(typeChart, move.type, defenderTypes);
  const crit = isCrit ? critMultiplier : 1;
  const multiplierTerm = resolveMultiplierTerm(modifiers, stackingPolicy);

  // Both BasePower-stage terms land here, on the formula's own BasePower input
  // rather than on its result (that's what `modifiers`/multiplierTerm are for):
  // a 40 BP move with Fire Force 20 becomes a 60 BP move, not a 40 BP move
  // dealt at +20% damage. The conditional multiplier scales the AUTHORED
  // BasePower and Force is added after — Immolate at 30 BP with Fire Force 10
  // into a Burned target is 30x3 + 10 = 100, not (30+10)x3.
  const effectiveBasePower = (move.basePower ?? 0) * basePowerMultiplier + basePowerBonus;
  const damage = effectiveBasePower * ratio * stab * typeMult * variance * crit * multiplierTerm;

  return { damage, ratio, stab, typeMult, variance, isCrit, critMultiplier: crit, multiplierTerm, basePowerBonus, basePowerMultiplier };
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
  basePowerBonus: number = 0,
  basePowerMultiplier: number = 1
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
    basePowerMultiplier
  );

  return { ...result, nextRngState: critRoll.nextState };
}
