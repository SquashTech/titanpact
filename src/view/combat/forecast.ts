import type { MoveDefinition } from '../../engine/content';
import type { CombatState } from '../../engine/state';
import { activePartnerTypes, effectiveTypes, getMaxHp, moveForHero, resolveCastBasePower } from '../../engine/state';
import { healBlocked } from '../../engine/combat/statusEngine';
import { collectPassiveDamageModifiers } from '../../engine/combat/passiveEngine';
import { shieldHeld } from '../../engine/status/shield';
import { resolveHeal } from '../../engine/heal/healPipeline';
import { resolveTypeMult } from '../../engine/damage/typeMult';
import {
  calcDamage,
  fieldTypeMultFloor,
  resolveConditionalPowerMultiplier,
  resolveElementalForceBonus,
  resolveStatRatio,
  VARIANCE_MAX,
  VARIANCE_MIN,
  type DamageModifier,
} from '../../engine/damage/damagePipeline';
import { allCombatants } from '../../data/content';
import { statuses } from '../../data/statuses';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';
import { typeChart } from '../../data/typechart';

export interface DamageForecast {
  kind: 'damage';
  /** The roll's two ends, every hit summed — what the move deals, Shield included. */
  min: number;
  max: number;
  /** Fractions of the defender's MAX HP the two ends take off its HP, after its Shield has soaked its share. */
  maxFraction: number;
  minFraction: number;
  /** Fraction of max HP the defender currently stands on, so the bite is drawn against what is left. */
  hpFraction: number;
  typeMult: number;
  /** 'sure' when even the worst roll finishes it, 'maybe' when only the best one does; never while a Blessing would refuse the KO. */
  ko: 'sure' | 'maybe' | null;
}

export interface HealForecast {
  kind: 'heal';
  /** What the heal restores, before the target's missing HP caps it. */
  amount: number;
  /** What actually lands — the heal capped at what is missing, 0 when blocked. */
  restored: number;
  hpFraction: number;
  restoredFraction: number;
  /** A field holding this target refuses the heal (Blood Moon on Bleed). */
  blocked: boolean;
}

export type MoveForecast = DamageForecast | HealForecast;

/**
 * Runs the locked damage formula forward for both ends of the variance roll, through the engine's
 * own pipeline functions (calcDamage takes pre-rolled variance/crit, so no RNG). Every live term is
 * threaded in exactly as resolveRound reads it — docs/authoring-moves.md §5, "pass your new term in
 * or the forecast lies". Crit is excluded from the band. Read against the board as it stands, so
 * what lands before this move in the round is not in it.
 */
export function forecastDamage(authored: MoveDefinition, combat: CombatState, attackerId: string, defenderId: string): DamageForecast | null {
  const attacker = combat.combatants[attackerId];
  const defender = combat.combatants[defenderId];
  if (!attacker || !defender) return null;
  const attackerHero = allCombatants[attacker.heroId];
  const defenderHero = allCombatants[defender.heroId];
  if (!attackerHero || !defenderHero) return null;
  const move = moveForHero(authored, attackerHero);
  // A randomBasePower move authors no basePower, and a ramping one has outgrown its authored
  // figure; both forecast off the number the button is showing (state.ts resolveCastBasePower).
  const rolledBasePower = resolveCastBasePower(combat, attackerId, move, attacker.moveBasePowerBonuses);
  if (move.kind !== 'damage' || (move.basePower == null && rolledBasePower == null)) return null;

  const fieldEffectCtx = { active: combat.activeFieldEffect, defs: fieldEffects, board: { state: combat, passives } };
  const ratio = resolveStatRatio(move.category, attackerHero, attacker, defenderHero, defender, fieldEffectCtx, move.offStatOverride);
  const modifiers: DamageModifier[] = collectPassiveDamageModifiers(attacker, move, passives, defender);
  const forceBonus = resolveElementalForceBonus(attacker, move.type, statuses);
  const maxHp = getMaxHp(defenderHero, defender);
  // Read against THIS defender, so a conditional move forecasts per enemy.
  const conditionalMult = resolveConditionalPowerMultiplier(
    move,
    defender,
    attacker,
    fieldEffectCtx,
    maxHp,
    { currentHp: attacker.currentHp, maxHp: getMaxHp(attackerHero, attacker) },
    activePartnerTypes(combat, attackerId, allCombatants)
  );
  const attackerTypes = effectiveTypes(attackerHero, attacker);
  const defenderTypes = effectiveTypes(defenderHero, defender);
  const typeFloor = fieldTypeMultFloor(move.type, fieldEffectCtx);
  const hits = move.hitCount ?? 1;

  const roll = (variance: number) =>
    hits *
    Math.round(
      calcDamage(move, ratio, attackerTypes, defenderTypes, typeChart, variance, false, modifiers, undefined, undefined, forceBonus, conditionalMult, rolledBasePower, typeFloor)
        .damage
    );

  const min = roll(VARIANCE_MIN);
  const max = roll(VARIANCE_MAX);
  // A hit empties the Shield before it touches HP (docs/shield.md).
  const shield = shieldHeld(defender, statuses);
  const hpLossMin = Math.max(0, min - shield);
  const hpLossMax = Math.max(0, max - shield);
  const ko = defender.blessed ? null : hpLossMin >= defender.currentHp ? 'sure' : hpLossMax >= defender.currentHp ? 'maybe' : null;
  return {
    kind: 'damage',
    min,
    max,
    maxFraction: Math.min(1, hpLossMax / maxHp),
    minFraction: Math.min(1, hpLossMin / maxHp),
    hpFraction: Math.min(1, Math.max(0, defender.currentHp) / maxHp),
    typeMult: Math.max(typeFloor, resolveTypeMult(typeChart, move.type, defenderTypes)),
    ko,
  };
}

/** The heal move's one number on one ally — target-independent in the engine, capped here by what the target is missing. */
export function forecastHeal(authored: MoveDefinition, combat: CombatState, casterId: string, targetId: string): HealForecast | null {
  const caster = combat.combatants[casterId];
  const target = combat.combatants[targetId];
  if (!caster || !target) return null;
  const casterHero = allCombatants[caster.heroId];
  const targetHero = allCombatants[target.heroId];
  if (!casterHero || !targetHero) return null;
  const move = moveForHero(authored, casterHero);
  if (move.kind !== 'heal' || move.healPower == null) return null;

  const amount = resolveHeal(move, casterHero, caster, { active: combat.activeFieldEffect, defs: fieldEffects }).heal;
  const fieldDef = combat.activeFieldEffect ? fieldEffects[combat.activeFieldEffect.fieldEffectId] : undefined;
  const blocked = healBlocked(combat, targetId, fieldDef);
  const maxHp = getMaxHp(targetHero, target);
  const hp = Math.max(0, target.currentHp);
  const restored = blocked ? 0 : Math.max(0, Math.min(amount, maxHp - hp));
  return {
    kind: 'heal',
    amount,
    restored,
    hpFraction: Math.min(1, hp / maxHp),
    restoredFraction: restored / maxHp,
    blocked,
  };
}

export function forecastMove(move: MoveDefinition, combat: CombatState, casterId: string, targetId: string): MoveForecast | null {
  return move.kind === 'heal' ? forecastHeal(move, combat, casterId, targetId) : forecastDamage(move, combat, casterId, targetId);
}
