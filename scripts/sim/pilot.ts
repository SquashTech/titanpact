// A SKILLED player pilot, for the player side only.
//
// src/run/ai.ts is the game's enemy: it aims at the type chart and stops there.
// Reading it as the player too makes every absolute number in the report a
// floor, and it biases the comparisons — a hero whose edge is a 110-power
// finisher looks the same as one whose edge is a 40-power poke, because the
// chart weight is all either of them is judged on.
//
// This module scores each option in HP, using the REAL damage, heal and
// status-magnitude pipelines, and takes the best. Everything it can compute it
// computes; everything it cannot gets a credit proportional to what the caster
// could otherwise have done that turn, which is the same conservatism ai.ts
// applies with WEIGHT_NEUTRAL — a payload the scorer does not understand must
// never read as worthless, or the sim would report every support hero weak.
//
// It is still a ONE-PLY greedy pilot: no lookahead, no reading the opponent's
// declaration, no baiting. It is a better floor, not a ceiling.

import type { MoveDefinition, StatKey, StatusApplication, TargetMode } from '../../src/engine/content';
import { statusApplicationsOf } from '../../src/engine/content';
import type { Action } from '../../src/engine/combat/actions';
import type { CombatState, FieldEffectContext, Side } from '../../src/engine/state';
import {
  activePartnerTypes,
  effectiveTypes,
  getEffectiveStat,
  getMaxHp,
  hasAffordableMoveInFight,
  isLockedIn,
  resolveCastBasePower,
  resolveManaCost,
  resolveTargetMode,
} from '../../src/engine/state';
import { selectableTargets, statusGatedTargets } from '../../src/engine/combat/statusEngine';
import { collectPassiveDamageModifiers } from '../../src/engine/combat/passiveEngine';
import {
  calcDamage,
  resolveConditionalPowerMultiplier,
  resolveElementalForceBonus,
  resolveStatRatio,
  LOCKED_MODIFIER_STACKING,
  PROVISIONAL_CRIT_CHANCE,
  PROVISIONAL_CRIT_MULTIPLIER,
  VARIANCE_MAX,
  VARIANCE_MIN,
} from '../../src/engine/damage/damagePipeline';
import { resolveHeal } from '../../src/engine/heal/healPipeline';
import { scaleStatusMagnitude } from '../../src/engine/status/statusMagnitude';
import { allCombatants } from '../../src/data/content';
import { moves } from '../../src/data/moves';
import { statuses } from '../../src/data/statuses';
import { passives } from '../../src/data/passives';
import { fieldEffects } from '../../src/data/fieldEffects';
import { typeChart } from '../../src/data/typechart';
import type { AiContext } from '../../src/run/ai';

/** Variance is uniform, so its expectation is the midpoint; crit folds in as its expected multiplier. */
const MEAN_VARIANCE = (VARIANCE_MIN + VARIANCE_MAX) / 2;

/**
 * How many more rounds a per-round effect is assumed to pay out for. Every
 * persistent term — a KO removing a body, a stat buff, a control status — is
 * priced as (per-round value x this). Fights run ~8 rounds, but a one-ply
 * pilot that valued the whole remainder would never take a hit to set up, so
 * this is deliberately short.
 */
const HORIZON = 3;

/** A payload the scorer cannot price, as a share of what the caster's best attack would have done. Matches ai.ts treating an unevaluable move as neutral. */
const UNKNOWN_PAYLOAD_CREDIT = 0.6;

/** A switch costs the whole turn, so the incoming hero has to clear the outgoing one by this much. */
const SWITCH_DISCOUNT = 0.6;

/** Share of the best available value-per-mana that each point of mana is charged. Small: it breaks ties toward the cheap line without ever talking a lethal out of firing. */
const MANA_OPPORTUNITY = 0.25;

/** Per-point HP-equivalents for the stats that do not convert through a threat figure. */
const FLAT_STAT_VALUE: Partial<Record<StatKey, number>> = { hp: 1, speed: 1.5, manaPool: 0.3, mpRegen: 3 };

export interface PilotOptions {
  /** Off reproduces a pilot that never voluntarily cycles — the `--switching off` arm. */
  switching: boolean;
}

function fieldCtx(state: CombatState): FieldEffectContext {
  return { active: state.activeFieldEffect, defs: fieldEffects, board: { state, passives } };
}

function otherSide(side: Side): Side {
  return side === 'A' ? 'B' : 'A';
}

function aliveActiveIdsOn(state: CombatState, side: Side): string[] {
  return state.active[side].filter((id): id is string => id !== null && !state.combatants[id]?.fainted);
}

function isDamaging(move: MoveDefinition): boolean {
  return move.kind === 'damage' || move.basePower != null || move.randomBasePower != null;
}

function missingHp(state: CombatState, id: string): number {
  const combatant = state.combatants[id];
  return Math.max(0, getMaxHp(allCombatants[combatant.heroId], combatant) - combatant.currentHp);
}

// --- Target resolution, mirroring ai.ts so the pilot never aims where the engine would not ---

function targetPool(state: CombatState, casterId: string, mode: TargetMode, side: Side): string[] {
  const foes = aliveActiveIdsOn(state, otherSide(side));
  const allies = aliveActiveIdsOn(state, side);
  switch (mode) {
    case 'self':
      return [casterId];
    case 'singleAlly':
    case 'bothAllies':
    case 'randomAlly':
      return allies;
    case 'allOthers':
      return [...allies, ...foes].filter((id) => id !== casterId);
    default:
      return foes;
  }
}

function candidateTargets(state: CombatState, casterId: string, move: MoveDefinition, ctx: AiContext, mode: TargetMode): string[] {
  const side = state.combatants[casterId].side;
  const pool = targetPool(state, casterId, mode, side);
  return selectableTargets(state, mode, statusGatedTargets(state, move, pool), ctx.statuses);
}

/**
 * Both modes, not just the live one. `resolveTargetMode` is read again at RESOLUTION, and a
 * conditionalTarget move (Arcane's Mana Burst) declared as a spread while its Field Effect was
 * up resolves as a single target if an earlier action that round overrode the field — and
 * targeting.ts throws a bare Error, not the caught TargetNoLongerValidError, so the fight dies.
 * A declared target is inert for every spread mode, so carrying one always is free.
 */
function needsDeclaredTarget(state: CombatState, move: MoveDefinition): boolean {
  const modes = [resolveTargetMode(state, move), move.target, move.conditionalTarget?.target];
  return modes.some((mode) => mode === 'singleEnemy' || mode === 'singleAlly');
}

/**
 * The set a cast would actually resolve against, and the share of the move each
 * one gets. A random mode hits one of its pool, so every member carries 1/n of
 * the payload — the honest expectation, not a hit on each.
 */
function resolvedTargets(
  state: CombatState,
  casterId: string,
  move: MoveDefinition,
  ctx: AiContext,
  declared: string | null
): { id: string; share: number }[] {
  const mode = resolveTargetMode(state, move);
  if (mode === 'singleEnemy' || mode === 'singleAlly') {
    return declared ? [{ id: declared, share: 1 }] : [];
  }
  const pool = candidateTargets(state, casterId, move, ctx, mode);
  if (pool.length === 0) return [];
  const share = mode === 'randomAlly' || mode === 'randomEnemy' ? 1 / pool.length : 1;
  return pool.map((id) => ({ id, share }));
}

// --- Expected damage, straight off the real pipeline ---

/** One cast's expected HP removed from `targetId`, before any cap on overkill. Mean variance, crit as its expectation, every hit of a multi-hit. */
function expectedHit(state: CombatState, casterId: string, move: MoveDefinition, targetId: string): number {
  const attacker = state.combatants[casterId];
  const target = state.combatants[targetId];
  if (!attacker || !target || target.fainted) return 0;
  if (!isDamaging(move) && move.retributionPercent == null) return 0;

  if (move.retributionPercent != null) return attacker.damageTakenSinceLastTurn * move.retributionPercent;

  const attackerHero = allCombatants[attacker.heroId];
  const defenderHero = allCombatants[target.heroId];
  const ctxField = fieldCtx(state);
  const ratio = resolveStatRatio(move.category, attackerHero, attacker, defenderHero, target, ctxField, move.offStatOverride);
  const modifiers = collectPassiveDamageModifiers(attacker, move, passives);
  const forceBonus = resolveElementalForceBonus(attacker, move.type, statuses);
  const attackerHp = { currentHp: attacker.currentHp, maxHp: getMaxHp(attackerHero, attacker) };
  const basePowerMultiplier = resolveConditionalPowerMultiplier(
    move,
    target,
    attacker,
    ctxField,
    getMaxHp(defenderHero, target),
    attackerHp,
    activePartnerTypes(state, casterId, allCombatants)
  );
  const rolledBasePower = resolveCastBasePower(state, casterId, move, attacker.moveBasePowerBonuses);
  const critChance = move.critChance ?? PROVISIONAL_CRIT_CHANCE;
  const critTerm = 1 + critChance * (PROVISIONAL_CRIT_MULTIPLIER - 1);

  const per = calcDamage(
    move,
    ratio,
    effectiveTypes(attackerHero, attacker),
    effectiveTypes(defenderHero, target),
    typeChart,
    MEAN_VARIANCE,
    false,
    modifiers,
    LOCKED_MODIFIER_STACKING,
    PROVISIONAL_CRIT_MULTIPLIER,
    forceBonus,
    basePowerMultiplier,
    rolledBasePower
  ).damage;

  return per * critTerm * (move.hitCount ?? 1);
}

/**
 * A combatant's damage output per round: the best expected hit it could land on
 * the side opposite it right now, over the moves it can currently pay for. The
 * common denominator for every non-HP term below — a KO, a control status and a
 * stat buff are all priced as some number of rounds of somebody's output.
 */
function threatOf(state: CombatState, ctx: AiContext, combatantId: string, cache: Map<string, number>): number {
  const cached = cache.get(combatantId);
  if (cached !== undefined) return cached;
  const combatant = state.combatants[combatantId];
  let best = 0;
  if (combatant && !combatant.fainted) {
    const foes = aliveActiveIdsOn(state, otherSide(combatant.side));
    for (const moveId of ctx.moveIdsFor(combatantId)) {
      const move = moves[moveId];
      if (!move || !isDamaging(move)) continue;
      if (combatant.currentMana < resolveManaCost(state, combatantId, move, allCombatants)) continue;
      for (const foeId of foes) best = Math.max(best, expectedHit(state, combatantId, move, foeId));
    }
  }
  // A hero with nothing castable is not harmless — it Rests and comes back. Floor it on its own offence so a KO on it is never priced at zero.
  if (best <= 0 && combatant && !combatant.fainted) {
    const hero = allCombatants[combatant.heroId];
    best = Math.max(getEffectiveStat(hero, combatant, 'attack'), getEffectiveStat(hero, combatant, 'intelligence')) * 0.4;
  }
  cache.set(combatantId, best);
  return best;
}

// --- Status valuation, both signs, in HP ---

/** What one applied rider is worth to the side that wanted it, in HP. Negative statuses are priced on the HOLDER's cost. */
function riderValue(
  state: CombatState,
  ctx: AiContext,
  casterId: string,
  move: MoveDefinition,
  app: StatusApplication,
  holderId: string,
  cache: Map<string, number>
): number {
  const def = statuses[app.statusId];
  const holder = state.combatants[holderId];
  if (!def || !holder) return 0;

  const caster = state.combatants[casterId];
  const magnitude =
    scaleStatusMagnitude(app.magnitude, def, app, move, allCombatants[caster.heroId], caster, fieldCtx(state)) ?? app.magnitude ?? 0;
  const duration = app.duration ?? 1;

  // A guard is priced before the pipeline switch because it has no pipeline: what it is worth is
  // what the far side would otherwise have landed on the holder this round. Halved because a guard
  // covers one body of two and the enemy is free to hit the other, and capped at the holder's own
  // HP — a guard cannot save more than there is to lose.
  if (def.blocksIncomingMoves) {
    const incoming = aliveActiveIdsOn(state, otherSide(holder.side)).reduce(
      (sum, foeId) => sum + threatOf(state, ctx, foeId, cache),
      0
    );
    return Math.min(incoming * 0.5, holder.currentHp);
  }

  switch (def.pipeline) {
    case 'dot': {
      // decay 'halve' caps lifetime output at ~2x the magnitude (CLAUDE.md); 'none' builds instead.
      const perTick = def.flatPercentOfMaxHp != null ? def.flatPercentOfMaxHp * getMaxHp(allCombatants[holder.heroId], holder) : magnitude;
      const total = def.decay === 'halve' ? perTick * 2 : perTick * Math.min(duration, HORIZON);
      return Math.min(total, holder.currentHp);
    }
    case 'hot': {
      const perTick = magnitude;
      const total = def.decay === 'halve' ? perTick * 2 : perTick * Math.min(duration, HORIZON);
      return Math.min(total, missingHp(state, holderId) + perTick);
    }
    case 'control':
      // A turn taken off the holder is a round of its output.
      return threatOf(state, ctx, holderId, cache) * Math.min(duration, HORIZON);
    case 'basePower':
      // Elemental Force: magnitude is flat BasePower on the holder's next casts.
      return magnitude * Math.min(duration, HORIZON) * 0.5;
    case 'timer':
      return magnitude;
    default:
      return 0;
  }
}

/** Every negative status on a combatant, valued as what stripping it is worth. */
function cleanseValue(state: CombatState, ctx: AiContext, holderId: string, cache: Map<string, number>): number {
  const holder = state.combatants[holderId];
  if (!holder) return 0;
  let total = 0;
  for (const [statusId, instance] of Object.entries(holder.statuses)) {
    const def = statuses[statusId];
    if (!def || def.positive) continue;
    const magnitude = instance.magnitude ?? 0;
    if (def.pipeline === 'dot') {
      const perTick = def.flatPercentOfMaxHp != null ? def.flatPercentOfMaxHp * getMaxHp(allCombatants[holder.heroId], holder) : magnitude;
      total += def.decay === 'halve' ? perTick * 2 : perTick * HORIZON;
    } else if (def.pipeline === 'control') {
      total += threatOf(state, ctx, holderId, cache);
    } else if (def.pipeline === 'timer') {
      total += magnitude;
    }
  }
  return total;
}

// --- Stat deltas, converted through the threat figure ---

/** One stat delta on one receiver, in HP. Offensive stats scale that hero's output; defensive stats scale what reaches it. */
function statDeltaValue(
  state: CombatState,
  ctx: AiContext,
  receiverId: string,
  stat: StatKey,
  amount: number,
  cache: Map<string, number>
): number {
  const receiver = state.combatants[receiverId];
  if (!receiver || amount === 0) return 0;
  const hero = allCombatants[receiver.heroId];
  const current = Math.max(1, getEffectiveStat(hero, receiver, stat));

  switch (stat) {
    case 'attack':
    case 'intelligence': {
      // Damage is linear in the offensive stat, so a delta is a proportional change to this hero's output.
      return threatOf(state, ctx, receiverId, cache) * (amount / current) * HORIZON;
    }
    case 'defense':
    case 'wisdom': {
      // Damage is linear in 1/defStat: +amount cuts incoming by amount/(current+amount).
      const incoming = aliveActiveIdsOn(state, otherSide(receiver.side)).reduce(
        (worst, foeId) => Math.max(worst, threatOf(state, ctx, foeId, cache)),
        0
      );
      const cut = amount / (current + amount);
      return incoming * cut * HORIZON;
    }
    default:
      return (FLAT_STAT_VALUE[stat] ?? 0.3) * amount;
  }
}

// --- Scoring one declared action ---

interface Scored {
  moveId: string;
  declaredTarget: string | null;
  /** HP-equivalent value, mana already charged. */
  score: number;
  /** Before the mana charge — what the cast actually accomplishes. */
  gross: number;
  cost: number;
}

function scoreCast(
  state: CombatState,
  casterId: string,
  move: MoveDefinition,
  ctx: AiContext,
  declared: string | null,
  cache: Map<string, number>,
  bestAttack: number
): number {
  const caster = state.combatants[casterId];
  const casterSide = caster.side;
  const targets = resolvedTargets(state, casterId, move, ctx, declared);
  let score = 0;
  let priced = false;

  // --- Damage, capped at what is there to remove; a KO buys the rest of that body's output ---
  let damageDealt = 0;
  for (const { id, share } of targets) {
    const target = state.combatants[id];
    if (!target || target.side === casterSide) continue;
    const raw = expectedHit(state, casterId, move, id);
    if (raw <= 0) continue;
    priced = true;
    const landed = Math.min(raw, target.currentHp);
    damageDealt += landed * share;
    score += landed * share;
    if (raw >= target.currentHp) score += threatOf(state, ctx, id, cache) * HORIZON * share;
  }

  if (move.drainPercent != null && damageDealt > 0) {
    score += Math.min(damageDealt * move.drainPercent, missingHp(state, casterId));
  }

  // --- What the cast charges its own side ---
  if (move.recoilPercent != null && damageDealt > 0) {
    const recoil = damageDealt * move.recoilPercent;
    score -= recoil;
    if (recoil >= caster.currentHp) score -= threatOf(state, ctx, casterId, cache) * HORIZON;
  }
  if (move.selfHpCost != null) {
    const cost = resolveSelfHpCost(state, casterId, move);
    score -= cost;
    if (cost >= caster.currentHp) score -= threatOf(state, ctx, casterId, cache) * HORIZON;
    priced = true;
  }

  // --- Healing, capped at the hole it fills ---
  if (move.healPower != null) {
    const heal = resolveHeal(move, allCombatants[caster.heroId], caster, fieldCtx(state)).heal;
    for (const { id, share } of targets) {
      if (state.combatants[id]?.side !== casterSide) continue;
      score += Math.min(heal, missingHp(state, id)) * share;
    }
    priced = true;
  }

  if (move.cleanses) {
    for (const { id, share } of targets) {
      if (state.combatants[id]?.side !== casterSide) continue;
      score += cleanseValue(state, ctx, id, cache) * share;
    }
    priced = true;
  }

  // --- Riders ---
  for (const app of statusApplicationsOf(move)) {
    const receivers = riderReceiverIds(state, casterId, app, targets, casterSide);
    for (const { id, share } of receivers) {
      const holder = state.combatants[id];
      if (!holder) continue;
      // Priced from the wanting side either way: a Burn on a foe is HP removed, a Renew on an ally
      // is HP kept. The one sign that flips is a rider a move aims at its own caster as a COST —
      // Fire's and Mech's self-Burn — which arrives here as an unfriendly status on a friendly body.
      const value = riderValue(state, ctx, casterId, move, app, id, cache) * share * (app.chance ?? 1);
      const hostile = !statuses[app.statusId]?.positive;
      score += holder.side === casterSide && hostile ? -value : value;
      priced = true;
    }
  }
  if (move.randomStatusApplication?.length) {
    // One is drawn per cast: the average of the pool.
    const pool = move.randomStatusApplication;
    for (const app of pool) {
      const receivers = riderReceiverIds(state, casterId, app, targets, casterSide);
      for (const { id, share } of receivers) {
        score += (riderValue(state, ctx, casterId, move, app, id, cache) * share * (app.chance ?? 1)) / pool.length;
      }
    }
    priced = true;
  }

  // --- Stat deltas ---
  if (move.statDeltas?.length) {
    const receivers = statDeltaReceivers(state, casterId, move, targets, casterSide);
    const chance = move.statDeltaChance ?? 1;
    const conditional =
      move.conditionalStatDeltas &&
      (activePartnerTypes(state, casterId, allCombatants) ?? []).includes(move.conditionalStatDeltas.requiresPartnerType)
        ? move.conditionalStatDeltas.multiplier
        : 1;
    for (const { id, share } of receivers) {
      for (const delta of move.statDeltas) {
        score += statDeltaValue(state, ctx, id, delta.stat, delta.amount * conditional, cache) * share * chance;
      }
    }
    priced = true;
  }

  if (move.manaGrant != null) {
    // Mana is worth what it buys: one round of output costs one cast.
    for (const { id, share } of targets) {
      if (state.combatants[id]?.side !== casterSide) continue;
      score += manaValue(state, ctx, id, move.manaGrant, cache) * share;
    }
    priced = true;
  }

  // --- Payloads with no closed form: credited, never zeroed ---
  const opaque =
    move.randomStatDeltas != null ||
    move.derivedStatDeltas != null ||
    move.doublesStatReductions === true ||
    move.detonatesStatus != null ||
    move.fieldEffectApplication != null;
  if (opaque) {
    score += bestAttack * UNKNOWN_PAYLOAD_CREDIT;
    priced = true;
  }

  if (!priced) score += bestAttack * UNKNOWN_PAYLOAD_CREDIT;
  return score;
}

/** HP the cast charges its own caster, both authored forms. */
function resolveSelfHpCost(state: CombatState, casterId: string, move: MoveDefinition): number {
  const cost = move.selfHpCost;
  if (!cost) return 0;
  const combatant = state.combatants[casterId];
  if (cost.mode === 'percentMaxHp') return cost.amount * getMaxHp(allCombatants[combatant.heroId], combatant);
  return Math.max(0, combatant.currentHp - cost.amount);
}

function manaValue(state: CombatState, ctx: AiContext, receiverId: string, amount: number, cache: Map<string, number>): number {
  const receiver = state.combatants[receiverId];
  if (!receiver) return 0;
  let cheapest = Infinity;
  for (const moveId of ctx.moveIdsFor(receiverId)) {
    const move = moves[moveId];
    if (!move || !isDamaging(move)) continue;
    cheapest = Math.min(cheapest, Math.max(5, resolveManaCost(state, receiverId, move, allCombatants)));
  }
  if (!Number.isFinite(cheapest)) return amount * 0.3;
  return (threatOf(state, ctx, receiverId, cache) / cheapest) * amount;
}

/** Where a rider lands, with each receiver's share of it. */
function riderReceiverIds(
  state: CombatState,
  casterId: string,
  app: StatusApplication,
  targets: readonly { id: string; share: number }[],
  casterSide: Side
): { id: string; share: number }[] {
  switch (app.target) {
    case 'self':
      return [{ id: casterId, share: 1 }];
    case 'moveTarget':
      return [...targets];
    case 'bothAllies':
      return aliveActiveIdsOn(state, casterSide).map((id) => ({ id, share: 1 }));
    case 'randomAlly': {
      const pool = aliveActiveIdsOn(state, casterSide);
      return pool.map((id) => ({ id, share: 1 / pool.length }));
    }
    case 'randomEnemy': {
      const pool = aliveActiveIdsOn(state, otherSide(casterSide));
      return pool.map((id) => ({ id, share: 1 / pool.length }));
    }
    default:
      return [];
  }
}

function statDeltaReceivers(
  state: CombatState,
  casterId: string,
  move: MoveDefinition,
  targets: readonly { id: string; share: number }[],
  casterSide: Side
): { id: string; share: number }[] {
  switch (move.statDeltaTarget) {
    case 'self':
      return [{ id: casterId, share: 1 }];
    case 'bothAllies':
      return aliveActiveIdsOn(state, casterSide).map((id) => ({ id, share: 1 }));
    default:
      return [...targets];
  }
}

// --- The pilot ---

/** Every option this caster could declare, scored. */
function scoreOptions(state: CombatState, casterId: string, ctx: AiContext, cache: Map<string, number>): Scored[] {
  const caster = state.combatants[casterId];
  const moveIds = ctx.moveIdsFor(casterId);
  const affordable = moveIds.filter((id) => moves[id] && caster.currentMana >= resolveManaCost(state, casterId, moves[id], allCombatants));

  // The reference an unpriceable payload is credited against: the best plain hit available this turn.
  let bestAttack = 0;
  for (const moveId of affordable) {
    const move = moves[moveId];
    if (!isDamaging(move)) continue;
    for (const foeId of aliveActiveIdsOn(state, otherSide(caster.side))) {
      bestAttack = Math.max(bestAttack, expectedHit(state, casterId, move, foeId));
    }
  }

  const options: Scored[] = [];
  for (const moveId of affordable) {
    const move = moves[moveId];
    const mode = resolveTargetMode(state, move);
    const cost = resolveManaCost(state, casterId, move, allCombatants);

    // The one hard legality rule, as in ai.ts: a declared-target move with no candidate crashes targeting.
    if (needsDeclaredTarget(state, move)) {
      for (const targetId of candidateTargets(state, casterId, move, ctx, mode)) {
        const gross = scoreCast(state, casterId, move, ctx, targetId, cache, bestAttack);
        options.push({ moveId, declaredTarget: targetId, gross, cost, score: gross });
      }
      continue;
    }
    // A status-gated spread with nobody marked resolves into a blocked action and eats the turn.
    if (move.requiresTargetStatus) {
      const side = caster.side;
      if (statusGatedTargets(state, move, targetPool(state, casterId, mode, side)).length === 0) continue;
    }
    const gross = scoreCast(state, casterId, move, ctx, null, cache, bestAttack);
    options.push({ moveId, declaredTarget: null, gross, cost, score: gross });
  }

  // Mana's opportunity cost: a point of it is charged a fraction of what the most efficient line
  // on the board would have made with it. A lethal's KO term dwarfs this, so it only sorts near-ties.
  let bestPerMana = 0;
  for (const option of options) {
    if (option.cost > 0 && option.gross > 0) bestPerMana = Math.max(bestPerMana, option.gross / option.cost);
  }
  for (const option of options) option.score = option.gross - option.cost * bestPerMana * MANA_OPPORTUNITY;

  return options;
}

/** The best hit this combatant could land on the currently-active foes, ignoring whether it is itself active. */
function reachOf(state: CombatState, ctx: AiContext, combatantId: string): number {
  const combatant = state.combatants[combatantId];
  if (!combatant || combatant.fainted) return 0;
  let best = 0;
  for (const moveId of ctx.moveIdsFor(combatantId)) {
    const move = moves[moveId];
    if (!move || !isDamaging(move)) continue;
    if (combatant.currentMana < resolveManaCost(state, combatantId, move, allCombatants)) continue;
    for (const foeId of aliveActiveIdsOn(state, otherSide(combatant.side))) {
      best = Math.max(best, expectedHit(state, combatantId, move, foeId));
    }
  }
  return best;
}

/**
 * One side's declarations for the round. Whole-side rather than per-combatant so
 * two actives never claim the same benched hero, which is the same reason
 * fight.ts's manaCycleSwitches was written side-wide.
 *
 * The switch rule generalises that one: a hero is cycled out when a benched hero
 * would hit the current board appreciably harder — being unable to pay for
 * anything is just the extreme of that, where the outgoing hero's reach is zero.
 */
export function pilotActions(state: CombatState, side: Side, ctx: AiContext, opts: PilotOptions): Action[] {
  const cache = new Map<string, number>();
  const actingIds = aliveActiveIdsOn(state, side);
  const actions: Action[] = [];
  const claimed = new Set<string>();
  const canSwitch = opts.switching && !isLockedIn(state, side);

  for (const casterId of actingIds) {
    const moveIds = ctx.moveIdsFor(casterId);
    const options = hasAffordableMoveInFight(state, casterId, moveIds, moves, allCombatants)
      ? scoreOptions(state, casterId, ctx, cache)
      : [];
    let best: Scored | null = null;
    for (const option of options) {
      if (!best || option.score > best.score) best = option;
    }

    if (canSwitch) {
      const stay = Math.max(0, best?.gross ?? 0);
      const outgoingReach = reachOf(state, ctx, casterId);
      let bestBench: { id: string; reach: number } | null = null;
      for (const benchId of state.bench[side]) {
        if (claimed.has(benchId) || state.combatants[benchId]?.fainted) continue;
        const reach = reachOf(state, ctx, benchId);
        if (!bestBench || reach > bestBench.reach) bestBench = { id: benchId, reach };
      }
      // Trading the turn has to buy a materially better body — and a hero holding a lethal never leaves.
      const holdingLethal = stay > outgoingReach * 1.5;
      if (bestBench && !holdingLethal && bestBench.reach * SWITCH_DISCOUNT > Math.max(outgoingReach, stay * 0.5)) {
        claimed.add(bestBench.id);
        actions.push({ kind: 'switch', combatantId: casterId, benchedCombatantId: bestBench.id });
        continue;
      }
    }

    if (!best) {
      actions.push({ kind: 'rest', combatantId: casterId });
      continue;
    }
    const move = moves[best.moveId];
    const switchToCombatantId = move.switchesUserOut
      ? (state.bench[side].find((bid) => !claimed.has(bid) && !state.combatants[bid]?.fainted) ?? null)
      : null;
    if (switchToCombatantId) claimed.add(switchToCombatantId);
    actions.push({
      kind: 'move',
      combatantId: casterId,
      moveId: best.moveId,
      declaredTarget: best.declaredTarget,
      switchToCombatantId,
    });
  }

  return actions;
}

export { HORIZON };
export type { Scored };
