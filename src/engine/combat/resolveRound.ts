// Round resolution — the main orchestrator (docs/combat.md turn/round model,
// docs/conditions.md status timing). Declare-then-resolve: actions resolve in
// priority/speed order, then the round-boundary ticks run in a fixed order.

import type { FieldEffectDefinition, MoveDefinition, PassiveDefinition, StatDelta, StatKey, StatusDefinition } from '../content';
import { statusApplicationsOf } from '../content';
import type { CombatState, HeroLookup } from '../state';
import { activePartnerTypes, getMaxHp, getMaxMana, getEffectiveStat, resolveManaCost, resolveCastBasePower, resolveTargetMode, effectiveTypes, hasStatus } from '../state';
import type { CombatEvent } from '../events';
import type { Action } from './actions';
import { orderActions } from './priority';
import { resolveTargets, resolveTargetsRolled, rollRiderTarget, slotOfActiveCombatant, TargetNoLongerValidError } from './targeting';
import { applyVoluntarySwitch, applyBenchHpRegen, SwitchBlockedError } from './switching';
import { applyManaRegen } from './manaRegen';
import { setFieldEffect, tickFieldEffect } from './fieldEffectEngine';
import {
  resolveStatRatio,
  rollDamage,
  resolveElementalForceBonus,
  resolveConditionalPowerMultiplier,
  statKeysForMove,
  type DamageModifier,
} from '../damage/damagePipeline';
import type { TypeChart } from '../damage/typeMult';
import { resolveHeal } from '../heal/healPipeline';
import { scaleStatusMagnitude } from '../status/statusMagnitude';
import { applyHpDelta } from './faintHandling';
import {
  detonateTriggeredStatuses,
  detonateStatusNow,
  applyStatus,
  applyStealthRedirect,
  applyProvokeRedirect,
  cleanseStatuses,
  consumeStatus,
  statusGatedTargets,
  expandSpreadTargets,
  tickEndOfRound,
  tickStartOfRound,
} from './statusEngine';
import { collectPassiveDamageModifiers, resolvePassiveReactions } from './passiveEngine';
import { nextFloat, nextInt } from '../rng/seededRng';
import { DEFAULT_PACT_CLOCK, tickPactClock, type PactClockConfig } from './pactClock';

export interface RoundConfig {
  typeChart: TypeChart;
  heroes: HeroLookup;
  moves: Record<string, MoveDefinition>;
  statuses: Record<string, StatusDefinition>;
  passives: Record<string, PassiveDefinition>;
  fieldEffects: Record<string, FieldEffectDefinition>;
  /** Untuned placeholder — see switching.ts applyBenchHpRegen. */
  benchHpRegenFlat: number;
  /** A rule, not a per-encounter rate: defaults to DEFAULT_PACT_CLOCK; overridden only by tests/sandboxes. */
  pactClock?: PactClockConfig;
}

export interface RoundResult {
  state: CombatState;
  events: CombatEvent[];
}

// Called only where a combatant actually TAKES a turn (paid move, Rest,
// completed switch). A blocked/fizzled action keeps banking.
function resetDamageTaken(state: CombatState, combatantId: string): CombatState {
  const combatant = state.combatants[combatantId];
  if (!combatant || combatant.damageTakenSinceLastTurn === 0) return state;
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...combatant, damageTakenSinceLastTurn: 0 } },
  };
}

export function resolveRound(state: CombatState, actions: readonly Action[], config: RoundConfig): RoundResult {
  const { heroes, moves, typeChart, statuses, passives, fieldEffects } = config;
  const round = state.round;
  const events: CombatEvent[] = [{ type: 'RoundStarted', round }];

  let working: CombatState = state;

  const startTicks = tickStartOfRound(working, round, statuses);
  working = startTicks.state;
  events.push(...startTicks.events);

  const maxHpOf = (id: string) => getMaxHp(heroes[working.combatants[id].heroId], working.combatants[id]);
  const maxManaOf = (id: string) => getMaxMana(heroes[working.combatants[id].heroId], working.combatants[id]);

  const { ordered, nextRngState } = orderActions(working, heroes, actions, moves, working.rngState, fieldEffects, passives);
  working = { ...working, rngState: nextRngState };

  for (const action of ordered) {
    const actor = working.combatants[action.combatantId];
    if (!actor || actor.fainted) continue;

    // Captured before anything this action does, so a move cannot count its own recoil.
    const damageTakenBeforeTurn = actor.damageTakenSinceLastTurn;

    if (action.kind === 'switch') {
      try {
        const result = applyVoluntarySwitch(working, round, action.combatantId, action.benchedCombatantId, statuses);
        working = result.state;
        events.push(...result.events);
        // Every resolvePassiveReactions call site feeds its own new slice, never the round's log.
        const entry = resolvePassiveReactions(working, round, result.events, heroes, statuses, passives, fieldEffects);
        working = entry.state;
        events.push(...entry.events);
        working = resetDamageTaken(working, action.combatantId);
      } catch (err) {
        if (err instanceof SwitchBlockedError) continue; // illegal declared action (lock-in): no-op
        throw err;
      }
      continue;
    }

    if (action.kind === 'rest') {
      // Rest bypasses Daze: it must always be a legal fallback (softlock fix).
      events.push({ type: 'TurnStarted', round, combatantId: action.combatantId });
      const previousMana = actor.currentMana;
      const maxMana = maxManaOf(action.combatantId);
      // Never below what the hero already holds — overflow is not refunded down (docs/mana.md "Overflow").
      const restedMana = Math.max(previousMana, maxMana);
      working = {
        ...working,
        combatants: { ...working.combatants, [action.combatantId]: { ...actor, currentMana: restedMana } },
      };
      working = resetDamageTaken(working, action.combatantId);
      events.push({ type: 'Rested', round, combatantId: action.combatantId });
      events.push({ type: 'ManaChanged', round, combatantId: action.combatantId, previousMana, newMana: restedMana, maxMana });
      continue;
    }

    // action.kind === 'move'
    const move = moves[action.moveId];

    if (hasStatus(actor, 'Daze')) {
      events.push({ type: 'ActionBlocked', round, combatantId: action.combatantId, reason: 'dazed' });
      continue;
    }

    events.push({ type: 'TurnStarted', round, combatantId: action.combatantId });

    // Live cost and live target mode, read off `working` so a faster action this round already counts.
    const manaCost = resolveManaCost(working, action.combatantId, move, heroes);
    if (actor.currentMana < manaCost) continue; // engine-level legality guard; view must already prevent this

    const targetMode = resolveTargetMode(working, move);

    let targetIds: string[];
    try {
      // Slot looked up against the pre-round snapshot so a switched-out target retargets onto its slot.
      const declaredTargetSlot = action.declaredTarget ? slotOfActiveCombatant(state, action.declaredTarget) : null;
      const resolved = resolveTargetsRolled(
        working,
        action.combatantId,
        targetMode,
        working.rngState,
        action.declaredTarget ?? null,
        declaredTargetSlot
      );
      working = { ...working, rngState: resolved.nextRngState };
      targetIds = resolved.targetIds.filter((id) => !working.combatants[id]?.fainted);
    } catch (err) {
      if (err instanceof TargetNoLongerValidError) {
        // Mid-round race (target KO'd by an earlier action): fizzle, no mana spent.
        events.push({ type: 'ActionBlocked', round, combatantId: action.combatantId, reason: 'noValidTarget' });
        continue;
      }
      throw err;
    }

    let spreadVia: Record<string, string> = {};

    // Retargeting layers in fixed order: Stealth (push away, damage only) →
    // Provoke (pull toward, every kind) → Haunt (spread, damage only).
    if (move.kind === 'damage') {
      targetIds = applyStealthRedirect(working, targetMode, move.kind, targetIds);
    }
    targetIds = applyProvokeRedirect(working, action.combatantId, targetMode, targetIds, statuses);
    if (move.kind === 'damage') {
      const spread = expandSpreadTargets(working, move.type, targetMode, targetIds, statuses);
      targetIds = spread.targetIds;
      spreadVia = spread.spreadVia;
    }

    // Status gate applied LAST (a redirect onto an ungated hero must fizzle) and BEFORE the mana spend.
    targetIds = statusGatedTargets(working, move, targetIds);
    if (move.requiresTargetStatus && targetIds.length === 0) {
      events.push({ type: 'ActionBlocked', round, combatantId: action.combatantId, reason: 'targetStatusMissing' });
      continue;
    }

    events.push({ type: 'MoveDeclared', round, combatantId: action.combatantId, moveId: move.id, targetCombatantIds: targetIds });

    const previousMana = actor.currentMana;
    const newMana = previousMana - manaCost;
    const nextDiscounts =
      move.manaDiscountOnUse !== undefined
        ? { ...actor.moveManaDiscounts, [move.id]: (actor.moveManaDiscounts[move.id] ?? 0) + move.manaDiscountOnUse }
        : actor.moveManaDiscounts;
    // Banked on the actor BEFORE the hit rolls, so this cast lands at the pre-increment power.
    const nextBasePowerBonuses = move.basePowerGainOnUse
      ? { ...actor.moveBasePowerBonuses, [move.id]: (actor.moveBasePowerBonuses[move.id] ?? 0) + move.basePowerGainOnUse.amount }
      : actor.moveBasePowerBonuses;
    working = {
      ...working,
      combatants: {
        ...working.combatants,
        [action.combatantId]: {
          ...actor,
          currentMana: newMana,
          moveManaDiscounts: nextDiscounts,
          moveBasePowerBonuses: nextBasePowerBonuses,
          damageTakenSinceLastTurn: 0,
        },
      },
    };
    events.push({
      type: 'MoveUsed',
      round,
      combatantId: action.combatantId,
      moveId: move.id,
      manaSpent: manaCost,
      ...(manaCost !== move.manaCost ? { manaDiscount: move.manaCost - manaCost } : {}),
    });
    events.push({
      type: 'ManaChanged',
      round,
      combatantId: action.combatantId,
      previousMana,
      newMana,
      maxMana: maxManaOf(action.combatantId),
    });

    const attackerHero = heroes[actor.heroId];
    const attackerTypes = effectiveTypes(attackerHero, actor);

    // Asked once per cast so a spread Pack Hunt is doubled against both foes or neither.
    const partnerTypes = activePartnerTypes(working, action.combatantId, heroes);

    switch (move.kind) {
      case 'damage': {
        // Retribution is FIXED damage: the formula never runs and no RNG is drawn.
        const retribution =
          move.retributionPercent != null ? { damageTaken: damageTakenBeforeTurn, percent: move.retributionPercent } : null;

        // Recoil is summed and paid once after the loop (it can faint the user).
        let recoilBase = 0;

        // Rolled BasePower is derived, not drawn — costs no RNG (state.ts resolveRandomBasePower).
        // A ramping move substitutes its own figure through the same override slot; `actor` is the
        // pre-cast snapshot, so this hit lands at the power the button showed.
        const rolledBasePower = resolveCastBasePower(working, action.combatantId, move, actor.moveBasePowerBonuses);

        // Snapshot so requiresUserHpBelow is all-or-nothing across a spread that also drains.
        const attackerAtCast = working.combatants[action.combatantId];
        const attackerHpAtCast = { currentHp: attackerAtCast.currentHp, maxHp: getMaxHp(attackerHero, attackerAtCast) };

        for (const targetId of targetIds) {
          const target = working.combatants[targetId];
          if (!target || target.fainted) continue;
          const defenderHero = heroes[target.heroId];
          const maxHp = getMaxHp(defenderHero, target);

          // Read fresh per hit: a field effect / conditional passive a faster action changed this round must count.
          const attackerNow = working.combatants[action.combatantId];
          const fieldEffectCtx = { active: working.activeFieldEffect, defs: fieldEffects, board: { state: working, passives } };
          // offStatOverride changes WHICH stat is read — pipeline 1, not a multiplier.
          const ratio = resolveStatRatio(move.category, attackerHero, attackerNow, defenderHero, target, fieldEffectCtx, move.offStatOverride);

          const modifiers: DamageModifier[] = collectPassiveDamageModifiers(attackerNow, move, passives);
          const elementalForceBonus = resolveElementalForceBonus(attackerNow, move.type, statuses);
          // maxHp read here, BEFORE applyHpDelta, so an execute never doubles against HP this hit removes.
          const basePowerMultiplier = resolveConditionalPowerMultiplier(
            move,
            target,
            attackerNow,
            fieldEffectCtx,
            maxHp,
            attackerHpAtCast,
            partnerTypes
          );

          const rolled = retribution
            ? {
                damage: retribution.damageTaken * retribution.percent,
                ratio: 1,
                stab: 1,
                typeMult: 1,
                variance: 1,
                isCrit: false,
                critMultiplier: 1,
                multiplierTerm: 1,
                basePowerBonus: 0,
                basePowerMultiplier: 1,
                nextRngState: working.rngState,
              }
            : rollDamage(
                move,
                ratio,
                attackerTypes,
                effectiveTypes(defenderHero, target),
                typeChart,
                working.rngState,
                modifiers,
                move.critChance,
                elementalForceBonus,
                basePowerMultiplier,
                rolledBasePower
              );
          working = { ...working, rngState: rolled.nextRngState };

          const amount = Math.round(rolled.damage);

          const [offKey, defKey] = statKeysForMove(move);
          const damageDealtEvent: CombatEvent = {
            type: 'DamageDealt',
            round,
            sourceCombatantId: action.combatantId,
            targetCombatantId: targetId,
            moveId: move.id,
            amount,
            category: move.category,
            moveType: move.type,
            typeMult: rolled.typeMult,
            isCrit: rolled.isCrit,
            variance: rolled.variance,
            basePower: rolledBasePower ?? move.basePower ?? 0,
            elementalForceBonus: rolled.basePowerBonus,
            basePowerMultiplier: rolled.basePowerMultiplier,
            offStat: getEffectiveStat(attackerHero, attackerNow, offKey, fieldEffectCtx),
            defStat: getEffectiveStat(defenderHero, target, defKey, fieldEffectCtx),
            ratio: rolled.ratio,
            stab: rolled.stab,
            critMultiplier: rolled.critMultiplier,
            multiplierTerm: rolled.multiplierTerm,
            modifiers: retribution ? [] : modifiers,
            ...(spreadVia[targetId] ? { viaStatusId: spreadVia[targetId] } : {}),
            ...(retribution ? { retribution } : {}),
          };
          events.push(damageDealtEvent);

          const hpBefore = working.combatants[targetId].currentHp;
          const hpResult = applyHpDelta(working, round, targetId, -amount, maxHp);
          working = hpResult.state;
          events.push(...hpResult.events);

          // consumesStatus keyed off the multiplier ACTUALLY applied, so on a spread only the doubled target pays.
          if (move.conditionalPower?.consumesStatus && basePowerMultiplier !== 1) {
            const cond = move.conditionalPower;
            const holderId = cond.requiresTargetStatus ? targetId : action.combatantId;
            const heldStatus = cond.requiresTargetStatus ?? cond.requiresUserStatus;
            if (heldStatus && !working.combatants[holderId]?.fainted) {
              const spent = consumeStatus(working, round, holderId, heldStatus);
              working = spent.state;
              events.push(...spent.events);
            }
          }

          // HP ACTUALLY removed (not the rolled amount) — what drain and recoil scale, read before Conduct's detonation.
          const removed = hpBefore - working.combatants[targetId].currentHp;
          recoilBase += removed;

          if (move.drainPercent) {
            const drained = Math.round(removed * move.drainPercent);
            const drainer = working.combatants[action.combatantId];
            if (drained > 0 && drainer && !drainer.fainted) {
              const drainerMaxHp = getMaxHp(attackerHero, drainer);
              const drainHealed: CombatEvent = {
                type: 'Healed',
                round,
                sourceCombatantId: action.combatantId,
                targetCombatantId: action.combatantId,
                moveId: move.id,
                amount: drained,
                drain: { fromCombatantId: targetId, damageDealt: removed, percent: move.drainPercent },
              };
              events.push(drainHealed);
              const drainResult = applyHpDelta(working, round, action.combatantId, drained, drainerMaxHp);
              working = drainResult.state;
              events.push(...drainResult.events);

              // A drain IS a heal, so it feeds the Healed hook like any other — without this the
              // hook would silently cover only heal-kind moves.
              const drainReactions = resolvePassiveReactions(working, round, [drainHealed], heroes, statuses, passives, fieldEffects);
              working = drainReactions.state;
              events.push(...drainReactions.events);
            }
          }

          const damageReactions = resolvePassiveReactions(working, round, [damageDealtEvent], heroes, statuses, passives, fieldEffects);
          working = damageReactions.state;
          events.push(...damageReactions.events);

          // Conduct detonation: its own beat after the base hit, never folded into DamageDealt.
          const triggered = detonateTriggeredStatuses(working, round, targetId, move.type, maxHp, statuses);
          working = triggered.state;
          events.push(...triggered.events);

          if (triggered.bonusDamage > 0) {
            const bonusHpResult = applyHpDelta(working, round, targetId, -triggered.bonusDamage, maxHp);
            working = bonusHpResult.state;
            events.push(...bonusHpResult.events);
          }
        }

        // Recoil: no 1 HP floor; a self-KO goes through applyHpDelta like any other, lock-in included.
        if (move.recoilPercent && recoilBase > 0) {
          const recoilAmount = Math.round(recoilBase * move.recoilPercent);
          const user = working.combatants[action.combatantId];
          if (recoilAmount > 0 && user && !user.fainted) {
            const userMaxHp = getMaxHp(attackerHero, user);
            events.push({
              type: 'DamageDealt',
              round,
              sourceCombatantId: action.combatantId,
              targetCombatantId: action.combatantId,
              moveId: move.id,
              amount: recoilAmount,
              category: move.category,
              moveType: move.type,
              typeMult: 1,
              isCrit: false,
              variance: 1,
              basePower: 0,
              elementalForceBonus: 0,
              basePowerMultiplier: 1,
              offStat: 0,
              defStat: 0,
              ratio: 1,
              stab: 1,
              critMultiplier: 1,
              multiplierTerm: 1,
              modifiers: [],
              recoil: { damageDealt: recoilBase, percent: move.recoilPercent },
            });
            const recoilResult = applyHpDelta(working, round, action.combatantId, -recoilAmount, userMaxHp);
            working = recoilResult.state;
            events.push(...recoilResult.events);
          }
        }
        break;
      }

      case 'heal': {
        // Target-independent (healPipeline.ts): one resolve covers every ally.
        const casterNow = working.combatants[action.combatantId];
        const healFieldCtx = { active: working.activeFieldEffect, defs: fieldEffects };
        const healed = resolveHeal(move, attackerHero, casterNow, healFieldCtx);

        for (const targetId of targetIds) {
          const target = working.combatants[targetId];
          if (!target || target.fainted) continue;
          const maxHp = getMaxHp(heroes[target.heroId], target);

          const healedEvent: CombatEvent = {
            type: 'Healed',
            round,
            sourceCombatantId: action.combatantId,
            targetCombatantId: targetId,
            moveId: move.id,
            amount: healed.heal,
            healPower: healed.healPower,
            wisdomMult: healed.wisdomMult,
            stab: healed.stab,
          };
          events.push(healedEvent);

          const hpResult = applyHpDelta(working, round, targetId, healed.heal, maxHp);
          working = hpResult.state;
          events.push(...hpResult.events);

          // Per target, after the HP lands, mirroring the DamageDealt checkpoint. Renew's own tick
          // emits StatusTicked and never Healed, so a heal-reactive passive cannot feed itself.
          const healReactions = resolvePassiveReactions(working, round, [healedEvent], heroes, statuses, passives, fieldEffects);
          working = healReactions.state;
          events.push(...healReactions.events);
        }
        break;
      }

      case 'buff':
        // A buff's body is its statDeltas, applied below with every other rider.
        break;
    }

    // Mana grants are UNCAPPED (docs/mana.md "Overflow") — no clamp helper exists for mana on purpose.
    if (move.manaGrant) {
      for (const targetId of targetIds) {
        const target = working.combatants[targetId];
        if (!target || target.fainted) continue;
        const previousTargetMana = target.currentMana;
        const newTargetMana = previousTargetMana + move.manaGrant;
        const targetMaxMana = getMaxMana(heroes[target.heroId], target);
        working = {
          ...working,
          combatants: { ...working.combatants, [targetId]: { ...target, currentMana: newTargetMana } },
        };
        events.push({
          type: 'ManaGranted',
          round,
          sourceCombatantId: action.combatantId,
          targetCombatantId: targetId,
          moveId: move.id,
          amount: move.manaGrant,
          previousMana: previousTargetMana,
          newMana: newTargetMana,
          maxMana: targetMaxMana,
          overflow: Math.max(0, newTargetMana - targetMaxMana),
        });
      }
    }

    // Collected across both stat-writing blocks and fed to one reaction pass below (Frozen Stone).
    const statChangedEvents: CombatEvent[] = [];

    // Stat deltas resolve AFTER the damage/heal body: the debuff shapes the next hit, not this one.
    // Derived deltas (content.ts derivedStatDeltas) are the documented exemption from the
    // multiples-of-5/10 rule: mana is read pre-spend (`previousMana`), Attack is read live.
    const derived = move.derivedStatDeltas;
    const derivedAmount =
      derived?.source === 'userEffectiveAttack'
        ? getEffectiveStat(attackerHero, working.combatants[action.combatantId], 'attack', {
            active: working.activeFieldEffect,
            defs: fieldEffects,
            board: { state: working, passives },
          })
        : previousMana;
    const derivedDeltas: StatDelta[] = derived ? derived.stats.map((stat) => ({ stat, amount: derivedAmount })) : [];
    // conditionalStatDeltas scales the AMOUNTS (one +20, not two +10s) and never touches derived deltas.
    const packMultiplier =
      move.conditionalStatDeltas && partnerTypes?.includes(move.conditionalStatDeltas.requiresPartnerType)
        ? move.conditionalStatDeltas.multiplier
        : 1;
    const authoredDeltas: readonly StatDelta[] =
      packMultiplier === 1
        ? (move.statDeltas ?? [])
        : (move.statDeltas ?? []).map(({ stat, amount }) => ({ stat, amount: amount * packMultiplier }));
    const allStatDeltas: readonly StatDelta[] = derivedDeltas.length ? [...authoredDeltas, ...derivedDeltas] : authoredDeltas;

    // A randomStatDeltas move may author no statDeltas at all, so the emptiness guard asks about both.
    const statDeltaTargets = !allStatDeltas.length && !move.randomStatDeltas
      ? []
      : move.statDeltaTarget === 'self'
        ? [action.combatantId]
        : move.statDeltaTarget === 'bothAllies'
          ? working.active[actor.side].filter(
              (id): id is string => id !== null && !working.combatants[id]?.fainted
            )
          : targetIds;

    for (const targetId of statDeltaTargets) {
      if (!working.combatants[targetId] || working.combatants[targetId].fainted) continue;
      // statDeltaChance: rolled once PER TARGET, gating only the deltas; absent draws nothing.
      if (move.statDeltaChance !== undefined) {
        const roll = nextFloat(working.rngState);
        working = { ...working, rngState: roll.nextState };
        if (roll.value >= move.statDeltaChance) continue;
      }
      // randomStatDeltas: rolled INSIDE the target loop (independent per ally), drawn without replacement.
      const rolledDeltas: StatDelta[] = [];
      const reel = move.randomStatDeltas;
      if (reel) {
        const pool = [...reel.from];
        const draws = Math.min(reel.count, pool.length);
        for (let i = 0; i < draws; i++) {
          const pick = nextInt(working.rngState, 0, pool.length);
          working = { ...working, rngState: pick.nextState };
          rolledDeltas.push({ stat: pool.splice(pick.value, 1)[0], amount: reel.amount });
        }
      }

      const deltas = rolledDeltas.length ? [...allStatDeltas, ...rolledDeltas] : allStatDeltas;
      for (const delta of deltas) {
        const current = working.combatants[targetId];
        const newValue = (current.statModifiers[delta.stat] ?? 0) + delta.amount;
        working = {
          ...working,
          combatants: { ...working.combatants, [targetId]: { ...current, statModifiers: { ...current.statModifiers, [delta.stat]: newValue } } },
        };
        const statChanged: CombatEvent = { type: 'StatChanged', round, combatantId: targetId, stat: delta.stat, delta: delta.amount, newValue };
        events.push(statChanged);
        statChangedEvents.push(statChanged);
      }
    }

    // doublesStatReductions reads/writes statModifiers ONLY (never baselineStatModifiers) and
    // compounds by design. No clamp: getEffectiveStat floors every stat at 1 for every reader.
    if (move.doublesStatReductions) {
      for (const targetId of targetIds) {
        const target = working.combatants[targetId];
        if (!target || target.fainted) continue;
        const doubled: Partial<Record<StatKey, number>> = {};
        const doubledEntries: [StatKey, number][] = [];
        for (const [stat, value] of Object.entries(target.statModifiers) as [StatKey, number][]) {
          if (value >= 0) continue;
          doubled[stat] = value * 2;
          doubledEntries.push([stat, value * 2]);
        }
        if (!doubledEntries.length) continue;
        working = {
          ...working,
          combatants: {
            ...working.combatants,
            [targetId]: { ...target, statModifiers: { ...target.statModifiers, ...doubled } },
          },
        };
        for (const [stat, newValue] of doubledEntries) {
          // `delta` is the amount ADDED, not the new total.
          const statChanged: CombatEvent = {
            type: 'StatChanged',
            round,
            combatantId: targetId,
            stat,
            delta: newValue - (target.statModifiers[stat] ?? 0),
            newValue,
          };
          events.push(statChanged);
          statChangedEvents.push(statChanged);
        }
      }
    }

    // One checkpoint for the whole move's stat changes, after both blocks that produce them and
    // before the riders — the buff lands, the passive answers it, then the move's own riders resolve.
    if (statChangedEvents.length > 0) {
      const statReactions = resolvePassiveReactions(working, round, statChangedEvents, heroes, statuses, passives, fieldEffects);
      working = statReactions.state;
      events.push(...statReactions.events);
    }

    if (move.fieldEffectApplication && fieldEffects[move.fieldEffectApplication]) {
      const result = setFieldEffect(working, round, move.fieldEffectApplication);
      working = result.state;
      events.push(...result.events);
    }

    // Status riders: each resolves its own targets, rolls its own chance and feeds its own
    // passive reactions in authored order. randomStatusApplication draws ONE candidate per CAST
    // (each carries its own target) and appends it to the authored list.
    let riders = statusApplicationsOf(move);
    if (move.randomStatusApplication?.length) {
      const pick = nextInt(working.rngState, 0, move.randomStatusApplication.length);
      working = { ...working, rngState: pick.nextState };
      riders = [...riders, move.randomStatusApplication[pick.value]];
    }

    for (const app of riders) {
      const def = statuses[app.statusId];
      if (def) {
        let applyTargets: string[];
        if (app.target === 'self') {
          applyTargets = [action.combatantId];
        } else if (app.target === 'randomAlly' || app.target === 'randomEnemy') {
          const rolledRider = rollRiderTarget(working, action.combatantId, app.target, working.rngState);
          working = { ...working, rngState: rolledRider.nextRngState };
          applyTargets = rolledRider.targetIds;
        } else if (app.target === 'bothAllies') {
          // Relative to the CASTER, like the random ally mode — a damage move can hit a foe and mend its own side.
          applyTargets = resolveTargets(working, action.combatantId, 'bothAllies');
        } else {
          applyTargets = targetIds;
        }
        // DoT/HoT magnitude snapshots the CASTER's stat + STAB once here (status/statusMagnitude.ts).
        const magnitude = scaleStatusMagnitude(app.magnitude, def, app, move, attackerHero, working.combatants[action.combatantId], {
          active: working.activeFieldEffect,
          defs: fieldEffects,
        });
        const statusAppliedEvents: CombatEvent[] = [];
        for (const applyTargetId of applyTargets) {
          if (!working.combatants[applyTargetId] || working.combatants[applyTargetId].fainted) continue;
          // Chance rolled once PER TARGET; an unchanced rider draws nothing (docs/architecture.md "Determinism & RNG").
          if (app.chance !== undefined) {
            const roll = nextFloat(working.rngState);
            working = { ...working, rngState: roll.nextState };
            if (roll.value >= app.chance) continue;
          }
          const result = applyStatus(working, round, applyTargetId, def, { magnitude, duration: app.duration, sourceCombatantId: action.combatantId });
          working = result.state;
          events.push(...result.events);
          statusAppliedEvents.push(...result.events);
        }
        const statusReactions = resolvePassiveReactions(working, round, statusAppliedEvents, heroes, statuses, passives, fieldEffects);
        working = statusReactions.state;
        events.push(...statusReactions.events);
      }
    }

    // Forced detonation runs AFTER the riders so "apply Poison 5, THEN detonate" includes the 5 just planted.
    if (move.detonatesStatus) {
      for (const targetId of targetIds) {
        const target = working.combatants[targetId];
        if (!target || target.fainted) continue;
        const blast = detonateStatusNow(
          working,
          round,
          targetId,
          move.detonatesStatus,
          statuses,
          getMaxHp(heroes[target.heroId], target)
        );
        working = blast.state;
        events.push(...blast.events);
      }
    }

    if (move.cleanses) {
      for (const targetId of targetIds) {
        if (!working.combatants[targetId]) continue;
        const result = cleanseStatuses(working, round, targetId, statuses, move.cleanseCount);
        working = result.state;
        events.push(...result.events);
      }
    }

    // Self HP cost is paid after the whole payload lands and before the pivot; it can faint the user (no floor).
    if (move.selfHpCost) {
      const user = working.combatants[action.combatantId];
      if (user && !user.fainted) {
        const userMaxHp = getMaxHp(attackerHero, user);
        // reduceToHp is a Math.max, never a heal.
        const cost =
          move.selfHpCost.mode === 'percentMaxHp'
            ? Math.round(userMaxHp * move.selfHpCost.amount)
            : Math.max(0, user.currentHp - move.selfHpCost.amount);
        if (cost > 0) {
          events.push({
            type: 'DamageDealt',
            round,
            sourceCombatantId: action.combatantId,
            targetCombatantId: action.combatantId,
            moveId: move.id,
            amount: cost,
            category: move.category,
            moveType: move.type,
            typeMult: 1,
            isCrit: false,
            variance: 1,
            basePower: 0,
            elementalForceBonus: 0,
            basePowerMultiplier: 1,
            offStat: 0,
            defStat: 0,
            ratio: 1,
            stab: 1,
            critMultiplier: 1,
            multiplierTerm: 1,
            modifiers: [],
            selfCost: { mode: move.selfHpCost.mode, amount: move.selfHpCost.amount },
          });
          const costResult = applyHpDelta(working, round, action.combatantId, -cost, userMaxHp);
          working = costResult.state;
          events.push(...costResult.events);
        }
      }
    }

    // The pivot runs dead last and through applyVoluntarySwitch so lock-in applies.
    // A block does not fizzle the move — payload and mana are already spent.
    if (move.switchesUserOut) {
      const incoming = action.switchToCombatantId;
      const stillStanding = working.combatants[action.combatantId];
      const incomingOk =
        incoming != null &&
        working.bench[stillStanding.side].includes(incoming) &&
        !working.combatants[incoming]?.fainted;
      if (stillStanding && !stillStanding.fainted && incomingOk) {
        try {
          const pivot = applyVoluntarySwitch(working, round, action.combatantId, incoming as string, statuses);
          working = pivot.state;
          events.push(...pivot.events);
          const pivotEntry = resolvePassiveReactions(working, round, pivot.events, heroes, statuses, passives, fieldEffects);
          working = pivotEntry.state;
          events.push(...pivotEntry.events);
        } catch (err) {
          if (!(err instanceof SwitchBlockedError)) throw err;
          events.push({ type: 'ActionBlocked', round, combatantId: action.combatantId, reason: 'switchBlocked' });
        }
      } else if (stillStanding && !stillStanding.fainted) {
        events.push({ type: 'ActionBlocked', round, combatantId: action.combatantId, reason: 'switchBlocked' });
      }
    }
  }

  // Round-boundary steps, in this fixed order.
  const regen = applyBenchHpRegen(working, round, config.benchHpRegenFlat, maxHpOf);
  working = regen.state;
  events.push(...regen.events);

  const manaRegen = applyManaRegen(working, round, heroes, fieldEffects, passives);
  working = manaRegen.state;
  events.push(...manaRegen.events);

  const statusTicks = tickEndOfRound(working, round, statuses, fieldEffects, maxHpOf);
  working = statusTicks.state;
  events.push(...statusTicks.events);

  const tickReactions = resolvePassiveReactions(working, round, statusTicks.events, heroes, statuses, passives, fieldEffects);
  working = tickReactions.state;
  events.push(...tickReactions.events);

  const fieldEffectTick = tickFieldEffect(working, round);
  working = fieldEffectTick.state;
  events.push(...fieldEffectTick.events);

  // Pact Clock last, and with no passive-reaction pass (the terminator is not a trigger source).
  const pact = tickPactClock(working, round, config.pactClock ?? DEFAULT_PACT_CLOCK, maxHpOf);
  working = pact.state;
  events.push(...pact.events);

  events.push({ type: 'RoundEnded', round });

  return { state: { ...working, round: working.round + 1 }, events };
}
