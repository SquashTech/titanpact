// Round resolution — the main orchestrator. Implements the LOCKED turn/round
// model from docs/combat.md: both sides declare all active combatants'
// actions, then actions resolve in priority/speed order, then bench HP regen
// and mana regen (active + bench, docs/mana.md) tick at the round boundary.
// Also implements the status system (docs/conditions.md, the 6th engine
// contract): Daze gates move actions, Stealth/Haunt retarget/expand a
// damage move's targets, Conduct applies/detonates off the move's type, and
// every status ticks at the round boundary alongside those regen ticks.

import type { HeroDefinition, MoveDefinition, StatusDefinition } from '../content';
import type { CombatState, HeroLookup, Side } from '../state';
import { getMaxHp, getEffectiveStat, effectiveTypes, hasStatus } from '../state';
import type { CombatEvent } from '../events';
import type { Action } from './actions';
import { orderActions } from './priority';
import { resolveTargets, slotOfActiveCombatant, TargetNoLongerValidError } from './targeting';
import { applyVoluntarySwitch, applyBenchHpRegen, SwitchBlockedError } from './switching';
import { applyManaRegen } from './manaRegen';
import { resolveStatRatio, rollDamage, statKeysForCategory, type DamageModifier } from '../damage/damagePipeline';
import type { TypeChart } from '../damage/typeMult';
import { applyHpDelta } from './faintHandling';
import { applyOrDetonateTriggeredStatuses, applyStatus, applyStealthRedirect, cleanseStatuses, expandSpreadTargets, tickEndOfRound } from './statusEngine';

export interface RoundConfig {
  typeChart: TypeChart;
  heroes: HeroLookup;
  moves: Record<string, MoveDefinition>;
  statuses: Record<string, StatusDefinition>;
  /** Data-tunable, untuned placeholder — see switching.ts applyBenchHpRegen. */
  benchHpRegenFlat: number;
}

export interface RoundResult {
  state: CombatState;
  events: CombatEvent[];
}

export function resolveRound(state: CombatState, actions: readonly Action[], config: RoundConfig): RoundResult {
  const { heroes, moves, typeChart, statuses } = config;
  const round = state.round;
  const events: CombatEvent[] = [{ type: 'RoundStarted', round }];

  let working: CombatState = state;

  const maxHpOf = (id: string) => getMaxHp(heroes[working.combatants[id].heroId], working.combatants[id]);

  const { ordered, nextRngState } = orderActions(working, heroes, actions, (moveId) => moves[moveId].priority, working.rngState);
  working = { ...working, rngState: nextRngState };

  for (const action of ordered) {
    const actor = working.combatants[action.combatantId];
    if (!actor || actor.fainted) continue;

    if (action.kind === 'switch') {
      try {
        const result = applyVoluntarySwitch(working, round, action.combatantId, action.benchedCombatantId, statuses);
        working = result.state;
        events.push(...result.events);
      } catch (err) {
        if (err instanceof SwitchBlockedError) continue; // illegal declared action (lock-in): no-op
        throw err;
      }
      continue;
    }

    if (action.kind === 'rest') {
      // Rest bypasses Daze deliberately: Daze gates MOVE actions
      // (docs/conditions.md), and Rest is the one action a hero can always
      // fall back to — the softlock fix this exists for would reappear if a
      // Dazed, mana-starved, bench-less hero had no legal action at all.
      events.push({ type: 'TurnStarted', round, combatantId: action.combatantId });
      const previousMana = actor.currentMana;
      const maxMana = getMaxHeroMaxMana(heroes, working, action.combatantId);
      working = {
        ...working,
        combatants: { ...working.combatants, [action.combatantId]: { ...actor, currentMana: maxMana } },
      };
      events.push({ type: 'Rested', round, combatantId: action.combatantId });
      events.push({ type: 'ManaChanged', round, combatantId: action.combatantId, previousMana, newMana: maxMana, maxMana });
      continue;
    }

    // action.kind === 'move'
    const move = moves[action.moveId];

    if (hasStatus(actor, 'Daze')) {
      events.push({ type: 'ActionBlocked', round, combatantId: action.combatantId, reason: 'dazed' });
      continue;
    }

    events.push({ type: 'TurnStarted', round, combatantId: action.combatantId });

    if (actor.currentMana < move.manaCost) continue; // engine-level legality guard; view must already prevent this

    let targetIds: string[];
    try {
      // Slot looked up against `state` — the pre-round snapshot — not `working`,
      // so it reflects where the declared target stood before any switch this
      // round already moved it to the bench (see resolveTargets' doc comment).
      const declaredTargetSlot = action.declaredTarget ? slotOfActiveCombatant(state, action.declaredTarget) : null;
      targetIds = resolveTargets(working, action.combatantId, move.target, action.declaredTarget ?? null, declaredTargetSlot).filter(
        (id) => !working.combatants[id]?.fainted
      );
    } catch (err) {
      if (err instanceof TargetNoLongerValidError) {
        // The declared target fainted earlier this same round, resolved before this action came up
        // (declare-then-resolve, priority/speed order) — a normal mid-round race, not a UI-preventable
        // player error. The action fizzles: no mana spent, no MoveUsed (matches the unaffordable-move
        // no-op pattern below), just a legible ActionBlocked event.
        events.push({ type: 'ActionBlocked', round, combatantId: action.combatantId, reason: 'noValidTarget' });
        continue;
      }
      throw err;
    }

    if (move.kind === 'damage') {
      // Stealth (redirect) then Haunt (spread) — both status-driven retargeting layered on
      // top of TargetMode resolution, so MoveDeclared below already reflects the final targets.
      targetIds = applyStealthRedirect(working, move.target, move.kind, targetIds);
      targetIds = expandSpreadTargets(working, move.type, move.target, targetIds, statuses);
    }

    events.push({ type: 'MoveDeclared', round, combatantId: action.combatantId, moveId: move.id, targetCombatantIds: targetIds });

    const previousMana = actor.currentMana;
    const newMana = previousMana - move.manaCost;
    working = {
      ...working,
      combatants: { ...working.combatants, [action.combatantId]: { ...actor, currentMana: newMana } },
    };
    events.push({ type: 'MoveUsed', round, combatantId: action.combatantId, moveId: move.id, manaSpent: move.manaCost });
    events.push({
      type: 'ManaChanged',
      round,
      combatantId: action.combatantId,
      previousMana,
      newMana,
      maxMana: getMaxHeroMaxMana(heroes, working, action.combatantId),
    });

    const attackerHero = heroes[working.combatants[action.combatantId].heroId];

    switch (move.kind) {
      case 'damage': {
        for (const targetId of targetIds) {
          const target = working.combatants[targetId];
          if (!target || target.fainted) continue;
          const defenderHero = heroes[target.heroId];
          const maxHp = getMaxHp(defenderHero, target);

          const attackerNow = working.combatants[action.combatantId];
          const ratio = resolveStatRatio(move.category, attackerHero, attackerNow, defenderHero, target);

          // No move-driven damage-pipeline modifiers currently exist (Expose, the one that
          // did, is cut) — kept as an empty accumulator so a future relic/ability slots in here.
          const modifiers: DamageModifier[] = [];

          const rolled = rollDamage(
            move,
            ratio,
            effectiveTypes(attackerHero, attackerNow),
            effectiveTypes(defenderHero, target),
            typeChart,
            working.rngState,
            modifiers
          );
          working = { ...working, rngState: rolled.nextRngState };

          // Conduct (docs/conditions.md): auto-applies/detonates off the move's type via
          // triggerTypes — bypasses the damage pipeline the same way DoT ticks do, folding
          // straight into `amount` rather than the multiplicative modifier term above.
          const triggered = applyOrDetonateTriggeredStatuses(working, round, targetId, move.type, maxHp, statuses);
          working = triggered.state;
          events.push(...triggered.events);

          const amount = Math.round(rolled.damage) + triggered.bonusDamage;

          const [offKey, defKey] = statKeysForCategory(move.category);
          events.push({
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
            basePower: move.basePower ?? 0,
            offStat: getEffectiveStat(attackerHero, attackerNow, offKey),
            defStat: getEffectiveStat(defenderHero, target, defKey),
            ratio: rolled.ratio,
            stab: rolled.stab,
            critMultiplier: rolled.critMultiplier,
            multiplierTerm: rolled.multiplierTerm,
            modifiers,
          });

          const hpResult = applyHpDelta(working, round, targetId, -amount, maxHp);
          working = hpResult.state;
          events.push(...hpResult.events);
        }
        break;
      }

      case 'heal': {
        for (const targetId of targetIds) {
          const target = working.combatants[targetId];
          if (!target || target.fainted) continue;
          const targetHero = heroes[target.heroId];
          const maxHp = getMaxHp(targetHero, target);
          const amount = move.healAmount ?? 0;

          events.push({ type: 'Healed', round, sourceCombatantId: action.combatantId, targetCombatantId: targetId, moveId: move.id, amount });

          const hpResult = applyHpDelta(working, round, targetId, amount, maxHp);
          working = hpResult.state;
          events.push(...hpResult.events);
        }
        break;
      }

      case 'buff': {
        for (const targetId of targetIds) {
          if (!working.combatants[targetId] || working.combatants[targetId].fainted) continue;
          for (const delta of move.statDeltas ?? []) {
            const current = working.combatants[targetId];
            const newValue = (current.statModifiers[delta.stat] ?? 0) + delta.amount;
            working = {
              ...working,
              combatants: { ...working.combatants, [targetId]: { ...current, statModifiers: { ...current.statModifiers, [delta.stat]: newValue } } },
            };
            events.push({ type: 'StatChanged', round, combatantId: targetId, stat: delta.stat, delta: delta.amount, newValue });
          }
        }
        break;
      }
    }

    // Status application / cleanse (docs/conditions.md §5) layer on top of any move kind —
    // a damage move can inflict Burn, a buff move can also grant Regen, etc.
    if (move.statusApplication) {
      const app = move.statusApplication;
      const def = statuses[app.statusId];
      if (def) {
        const applyTargets = app.target === 'self' ? [action.combatantId] : targetIds;
        for (const applyTargetId of applyTargets) {
          if (!working.combatants[applyTargetId] || working.combatants[applyTargetId].fainted) continue;
          const result = applyStatus(working, round, applyTargetId, def, { magnitude: app.magnitude, duration: app.duration });
          working = result.state;
          events.push(...result.events);
        }
      }
    }

    if (move.cleanses) {
      for (const targetId of targetIds) {
        if (!working.combatants[targetId]) continue;
        const result = cleanseStatuses(working, round, targetId, statuses);
        working = result.state;
        events.push(...result.events);
      }
    }
  }

  const regen = applyBenchHpRegen(working, round, config.benchHpRegenFlat, maxHpOf);
  working = regen.state;
  events.push(...regen.events);

  const manaRegen = applyManaRegen(working, round, heroes);
  working = manaRegen.state;
  events.push(...manaRegen.events);

  const statusTicks = tickEndOfRound(working, round, statuses, maxHpOf);
  working = statusTicks.state;
  events.push(...statusTicks.events);

  events.push({ type: 'RoundEnded', round });

  return { state: { ...working, round: working.round + 1 }, events };
}

function getMaxHeroMaxMana(heroes: HeroLookup, state: CombatState, combatantId: string): number {
  const combatant = state.combatants[combatantId];
  const hero = heroes[combatant.heroId];
  return hero.baseStats.manaPool + (combatant.statModifiers.manaPool ?? 0);
}
