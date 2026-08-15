// Round resolution — the main orchestrator. Implements the LOCKED turn/round
// model from docs/combat.md: both sides declare all active combatants'
// actions, then actions resolve in priority/speed order, then bench regen
// ticks at the round boundary.

import type { HeroDefinition, MoveDefinition } from '../content';
import type { CombatState, HeroLookup, Side } from '../state';
import { getMaxHp, effectiveTypes } from '../state';
import type { CombatEvent } from '../events';
import type { Action } from './actions';
import { orderActions } from './priority';
import { resolveTargets, findCombatantSide } from './targeting';
import { applyVoluntarySwitch, applyBenchHpRegen, SwitchBlockedError } from './switching';
import { resolveStatRatio, rollDamage } from '../damage/damagePipeline';
import type { TypeChart } from '../damage/typeMult';

export interface RoundConfig {
  typeChart: TypeChart;
  heroes: HeroLookup;
  moves: Record<string, MoveDefinition>;
  /** Data-tunable, untuned placeholder — see switching.ts applyBenchHpRegen. */
  benchHpRegenFlat: number;
}

export interface RoundResult {
  state: CombatState;
  events: CombatEvent[];
}

export function resolveRound(state: CombatState, actions: readonly Action[], config: RoundConfig): RoundResult {
  const { heroes, moves, typeChart } = config;
  const round = state.round;
  const events: CombatEvent[] = [{ type: 'RoundStarted', round }];

  let working: CombatState = state;

  const { ordered, nextRngState } = orderActions(working, heroes, actions, (moveId) => moves[moveId].priority, working.rngState);
  working = { ...working, rngState: nextRngState };

  for (const action of ordered) {
    const actor = working.combatants[action.combatantId];
    if (!actor || actor.fainted) continue;

    if (action.kind === 'switch') {
      try {
        const result = applyVoluntarySwitch(working, round, action.combatantId, action.benchedCombatantId);
        working = result.state;
        events.push(result.event);
      } catch (err) {
        if (err instanceof SwitchBlockedError) continue; // illegal declared action: no-op
        throw err;
      }
      continue;
    }

    // action.kind === 'move'
    const move = moves[action.moveId];
    events.push({ type: 'TurnStarted', round, combatantId: action.combatantId });

    if (actor.currentMana < move.manaCost) continue; // engine-level legality guard; view must already prevent this

    const targetIds = resolveTargets(working, action.combatantId, move.target, action.declaredTarget ?? null).filter(
      (id) => !working.combatants[id]?.fainted
    );

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

    for (const targetId of targetIds) {
      const target = working.combatants[targetId];
      if (!target || target.fainted) continue;
      const defenderHero = heroes[target.heroId];

      const attackerNow = working.combatants[action.combatantId];
      const ratio = resolveStatRatio(move.category, attackerHero, attackerNow, defenderHero, target);

      const rolled = rollDamage(
        move,
        ratio,
        effectiveTypes(attackerHero, attackerNow),
        effectiveTypes(defenderHero, target),
        typeChart,
        working.rngState
      );
      working = { ...working, rngState: rolled.nextRngState };

      const amount = Math.round(rolled.damage);
      const previousHp = target.currentHp;
      const maxHp = getMaxHp(defenderHero, target);
      const newHp = Math.max(0, previousHp - amount);

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
      });

      const fainted = newHp <= 0;
      working = {
        ...working,
        combatants: { ...working.combatants, [targetId]: { ...target, currentHp: newHp, fainted } },
      };
      events.push({ type: 'HpChanged', round, combatantId: targetId, previousHp, newHp, maxHp });

      if (fainted) {
        const side = findCombatantSide(working, targetId);
        const koCount = working.koCount[side] + 1;
        working = {
          ...working,
          koCount: { ...working.koCount, [side]: koCount },
          active: {
            ...working.active,
            [side]: working.active[side].map((id) => (id === targetId ? null : id)) as [string | null, string | null],
          },
        };
        events.push({ type: 'Fainted', round, combatantId: targetId, side, koCount });
      }
    }
  }

  const regen = applyBenchHpRegen(working, round, config.benchHpRegenFlat, (id) => getMaxHp(heroes[working.combatants[id].heroId], working.combatants[id]));
  working = regen.state;
  events.push(...regen.events);

  events.push({ type: 'RoundEnded', round });

  return { state: { ...working, round: working.round + 1 }, events };
}

function getMaxHeroMaxMana(heroes: HeroLookup, state: CombatState, combatantId: string): number {
  const combatant = state.combatants[combatantId];
  const hero = heroes[combatant.heroId];
  return hero.baseStats.manaPool + (combatant.statModifiers.manaPool ?? 0);
}
