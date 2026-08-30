// Round resolution — the main orchestrator. Implements the LOCKED turn/round
// model from docs/combat.md: both sides declare all active combatants'
// actions, then actions resolve in priority/speed order, then bench HP regen
// and mana regen (active + bench, docs/mana.md) tick at the round boundary.
// Also implements the status system (docs/conditions.md, the 6th engine
// contract): Daze gates move actions, Stealth/Haunt retarget/expand a
// damage move's targets, Conduct applies/detonates off the move's type, and
// most statuses tick at the end-of-round boundary alongside the regen ticks —
// except Stealth, which ticks at the START of the round (before actions
// resolve) so it also protects the round after the one it was cast in.

import type { FieldEffectDefinition, HeroDefinition, MoveDefinition, PassiveDefinition, StatusDefinition } from '../content';
import type { CombatState, HeroLookup, Side } from '../state';
import { getMaxHp, getMaxMana, getEffectiveStat, effectiveManaCost, effectiveTypes, hasStatus } from '../state';
import type { CombatEvent } from '../events';
import type { Action } from './actions';
import { orderActions } from './priority';
import { resolveTargets, slotOfActiveCombatant, TargetNoLongerValidError } from './targeting';
import { applyVoluntarySwitch, applyBenchHpRegen, SwitchBlockedError } from './switching';
import { applyManaRegen } from './manaRegen';
import { setFieldEffect, tickFieldEffect } from './fieldEffectEngine';
import {
  resolveStatRatio,
  rollDamage,
  resolveElementalForceBonus,
  resolveConditionalPowerMultiplier,
  statKeysForCategory,
  type DamageModifier,
} from '../damage/damagePipeline';
import type { TypeChart } from '../damage/typeMult';
import { resolveHeal, scaleHotMagnitude } from '../heal/healPipeline';
import { applyHpDelta } from './faintHandling';
import {
  detonateTriggeredStatuses,
  applyStatus,
  applyStealthRedirect,
  cleanseStatuses,
  consumeStatus,
  statusGatedTargets,
  expandSpreadTargets,
  tickEndOfRound,
  tickStartOfRound,
} from './statusEngine';
import { collectPassiveDamageModifiers, resolvePassiveReactions } from './passiveEngine';
import { nextFloat } from '../rng/seededRng';

export interface RoundConfig {
  typeChart: TypeChart;
  heroes: HeroLookup;
  moves: Record<string, MoveDefinition>;
  statuses: Record<string, StatusDefinition>;
  passives: Record<string, PassiveDefinition>;
  fieldEffects: Record<string, FieldEffectDefinition>;
  /** Data-tunable, untuned placeholder — see switching.ts applyBenchHpRegen. */
  benchHpRegenFlat: number;
}

export interface RoundResult {
  state: CombatState;
  events: CombatEvent[];
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

  const { ordered, nextRngState } = orderActions(working, heroes, actions, moves, working.rngState, fieldEffects);
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

    // Live cost, not the authored one: Wave Shred gets cheaper every time this
    // combatant casts it (content.ts manaDiscountOnUse, state.ts
    // effectiveManaCost). Every move without a discount prices identically.
    const manaCost = effectiveManaCost(move, actor.moveManaDiscounts);
    if (actor.currentMana < manaCost) continue; // engine-level legality guard; view must already prevent this

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

    // Populated by Haunt's spread below; read further down so the DamageDealt
    // event for a dragged-in target can carry viaStatusId (events.ts).
    let spreadVia: Record<string, string> = {};

    if (move.kind === 'damage') {
      // Stealth (redirect) then Haunt (spread) — both status-driven retargeting layered on
      // top of TargetMode resolution, so MoveDeclared below already reflects the final targets.
      targetIds = applyStealthRedirect(working, move.target, move.kind, targetIds);
      const spread = expandSpreadTargets(working, move.type, move.target, targetIds, statuses);
      targetIds = spread.targetIds;
      spreadVia = spread.spreadVia;
    }

    // The status targeting gate (content.ts requiresTargetStatus). Applied
    // LAST — after Stealth's redirect and Haunt's spread — because both of
    // those move a hit onto a hero the gate never approved: a Frozen-only
    // strike bounced onto an unmarked partner has to fizzle, not land. And
    // BEFORE the mana spend below, so an unmet gate costs the turn and
    // nothing else, exactly like the noValidTarget race above.
    targetIds = statusGatedTargets(working, move, targetIds);
    if (move.requiresTargetStatus && targetIds.length === 0) {
      events.push({ type: 'ActionBlocked', round, combatantId: action.combatantId, reason: 'targetStatusMissing' });
      continue;
    }

    events.push({ type: 'MoveDeclared', round, combatantId: action.combatantId, moveId: move.id, targetCombatantIds: targetIds });

    const previousMana = actor.currentMana;
    const newMana = previousMana - manaCost;
    // The ramp itself: paying for the move is also what makes the NEXT cast
    // cheaper, so the cast that starts the ramp is always charged the authored
    // price. Per (combatant, move) — content is shared immutable data, so two
    // heroes holding the same move ramp independently.
    const nextDiscounts =
      move.manaDiscountOnUse !== undefined
        ? { ...actor.moveManaDiscounts, [move.id]: (actor.moveManaDiscounts[move.id] ?? 0) + move.manaDiscountOnUse }
        : actor.moveManaDiscounts;
    working = {
      ...working,
      combatants: { ...working.combatants, [action.combatantId]: { ...actor, currentMana: newMana, moveManaDiscounts: nextDiscounts } },
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
          // Verdant Earth's Attack/Intelligence bonus (docs/field-effects.md) is a
          // stat-pipeline input, read fresh here rather than hoisted before the
          // action loop — a field effect a faster action set earlier THIS round
          // must already apply to a slower action's damage later in the same round.
          const fieldEffectCtx = { active: working.activeFieldEffect, defs: fieldEffects };
          const ratio = resolveStatRatio(move.category, attackerHero, attackerNow, defenderHero, target, fieldEffectCtx);

          // Passive-driven damage-pipeline modifiers (e.g. Emberheart's "+20% Fire
          // damage") — collected fresh per hit, evaluated synchronously before the
          // roll (passiveEngine.ts collectPassiveDamageModifiers).
          const modifiers: DamageModifier[] = collectPassiveDamageModifiers(attackerNow, move, passives);

          // Elemental Force — held statuses whose forceType matches this move's
          // type add flat BasePower before the roll (damagePipeline.ts).
          const elementalForceBonus = resolveElementalForceBonus(attackerNow, move.type, statuses);

          // Conditional BasePower (Immolate's "triple power vs a Burned
          // target") — read per target off its LIVE statuses, so a spread
          // conditional move can be tripled on one foe and not the other.
          const basePowerMultiplier = resolveConditionalPowerMultiplier(move, target);

          const rolled = rollDamage(
            move,
            ratio,
            effectiveTypes(attackerHero, attackerNow),
            effectiveTypes(defenderHero, target),
            typeChart,
            working.rngState,
            modifiers,
            move.critChance,
            elementalForceBonus,
            basePowerMultiplier
          );
          working = { ...working, rngState: rolled.nextRngState };

          const amount = Math.round(rolled.damage);

          const [offKey, defKey] = statKeysForCategory(move.category);
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
            basePower: move.basePower ?? 0,
            elementalForceBonus: rolled.basePowerBonus,
            basePowerMultiplier: rolled.basePowerMultiplier,
            offStat: getEffectiveStat(attackerHero, attackerNow, offKey, fieldEffectCtx),
            defStat: getEffectiveStat(defenderHero, target, defKey, fieldEffectCtx),
            ratio: rolled.ratio,
            stab: rolled.stab,
            critMultiplier: rolled.critMultiplier,
            multiplierTerm: rolled.multiplierTerm,
            modifiers,
            ...(spreadVia[targetId] ? { viaStatusId: spreadVia[targetId] } : {}),
          };
          events.push(damageDealtEvent);

          const hpBefore = working.combatants[targetId].currentHp;
          const hpResult = applyHpDelta(working, round, targetId, -amount, maxHp);
          working = hpResult.state;
          events.push(...hpResult.events);

          // Cold Snap spending the mark it cashed in (content.ts
          // conditionalPower.consumesStatus). Keyed off the multiplier that was
          // ACTUALLY applied rather than off a second status read, so on a spread
          // conditional move only the target that got doubled pays for it. Its own
          // StatusRemoved beat after the damage, for the same reason Conduct's
          // detonation is its own beat rather than a bigger DamageDealt number.
          if (move.conditionalPower?.consumesStatus && basePowerMultiplier !== 1 && !working.combatants[targetId].fainted) {
            const spent = consumeStatus(working, round, targetId, move.conditionalPower.requiresTargetStatus);
            working = spent.state;
            events.push(...spent.events);
          }

          // Drain (content.ts drainPercent — Water's Siphon/Engulf). Scaled off
          // the HP this hit ACTUALLY removed rather than the rolled amount, so
          // overkill into a 3 HP target returns 1 and not half of 45. Resolved
          // here, between the hit and Conduct's detonation, for the same reason
          // the detonation is kept separate: each is its own beat, and folding
          // the drain into the DamageDealt amount would make the log's formula
          // readout wrong.
          if (move.drainPercent) {
            const removed = hpBefore - working.combatants[targetId].currentHp;
            const drained = Math.round(removed * move.drainPercent);
            const drainer = working.combatants[action.combatantId];
            if (drained > 0 && drainer && !drainer.fainted) {
              const drainerMaxHp = getMaxHp(heroes[drainer.heroId], drainer);
              events.push({
                type: 'Healed',
                round,
                sourceCombatantId: action.combatantId,
                targetCombatantId: action.combatantId,
                moveId: move.id,
                amount: drained,
                drain: { fromCombatantId: targetId, damageDealt: removed, percent: move.drainPercent },
              });
              const drainResult = applyHpDelta(working, round, action.combatantId, drained, drainerMaxHp);
              working = drainResult.state;
              events.push(...drainResult.events);
            }
          }

          // Passive reactions keyed off this hit landing (e.g. a defender-side
          // "when an enemy/ally is hit, do X" passive) — resolved off the
          // DamageDealt event alone, before Conduct's own trigger below.
          const damageReactions = resolvePassiveReactions(working, round, [damageDealtEvent], heroes, statuses, passives, fieldEffects);
          working = damageReactions.state;
          events.push(...damageReactions.events);

          // Conduct (docs/conditions.md): detonates off the move's type via triggerTypes —
          // any Storm/Iron hit can cash in an existing mark, but only a move with its own
          // statusApplication plants one. Resolved AFTER the base hit above lands so its
          // bonus damage reads as its own beat/indicator (events.ts StatusDetonatedEvent)
          // rather than inflating the move's own DamageDealt amount. Skipped once the base
          // hit alone knocked the target out — detonateTriggeredStatuses no-ops on a fainted target.
          const triggered = detonateTriggeredStatuses(working, round, targetId, move.type, maxHp, statuses);
          working = triggered.state;
          events.push(...triggered.events);

          if (triggered.bonusDamage > 0) {
            const bonusHpResult = applyHpDelta(working, round, targetId, -triggered.bonusDamage, maxHp);
            working = bonusHpResult.state;
            events.push(...bonusHpResult.events);
          }
        }
        break;
      }

      case 'heal': {
        // Target-independent by design (healPipeline.ts): the healing formula
        // has no defender-side term, so one resolve covers every ally a
        // bothAllies heal reaches. Field-effect context read fresh here for
        // the same reason the damage case does — a faster action this round
        // may already have changed the battlefield.
        const casterNow = working.combatants[action.combatantId];
        const healFieldCtx = { active: working.activeFieldEffect, defs: fieldEffects };
        const healed = resolveHeal(move, attackerHero, casterNow, healFieldCtx);

        for (const targetId of targetIds) {
          const target = working.combatants[targetId];
          if (!target || target.fainted) continue;
          const targetHero = heroes[target.heroId];
          const maxHp = getMaxHp(targetHero, target);

          events.push({
            type: 'Healed',
            round,
            sourceCombatantId: action.combatantId,
            targetCombatantId: targetId,
            moveId: move.id,
            amount: healed.heal,
            healPower: healed.healPower,
            wisdomMult: healed.wisdomMult,
            stab: healed.stab,
          });

          const hpResult = applyHpDelta(working, round, targetId, healed.heal, maxHp);
          working = hpResult.state;
          events.push(...hpResult.events);
        }
        break;
      }

      case 'buff':
        // A buff move's whole body is its statDeltas, and those are applied
        // below alongside every other rider — a buff-kind move with no deltas
        // (a pure status or field-effect move) is legal and simply has no body.
        break;
    }

    // Stat deltas (engine/content.ts MoveDefinition.statDeltas) layer on top of
    // any move kind, same as statusApplication/fieldEffectApplication below —
    // Fire's Molten Lash is a damage move that also drops the target's Defense.
    // Deliberately AFTER the damage/heal switch above: the debuff shapes the
    // NEXT hit, not the one that delivered it.
    for (const targetId of move.statDeltas?.length ? targetIds : []) {
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

    // Field Effect application (docs/field-effects.md) layers on top of any move
    // kind, same flexibility as statusApplication just below — global, so there's
    // no per-target loop. Unknown ids are silently skipped, same guard discipline
    // as statusApplication's `def` lookup.
    if (move.fieldEffectApplication && fieldEffects[move.fieldEffectApplication]) {
      const result = setFieldEffect(working, round, move.fieldEffectApplication);
      working = result.state;
      events.push(...result.events);
    }

    // Status application / cleanse (docs/conditions.md §5) layer on top of any move kind —
    // a damage move can inflict Burn, a buff move can also grant Renew, etc.
    if (move.statusApplication) {
      const app = move.statusApplication;
      const def = statuses[app.statusId];
      if (def) {
        const applyTargets = app.target === 'self' ? [action.combatantId] : targetIds;
        // A heal-over-turn is healing, so it runs the healing formula too —
        // snapshotted once here off the CASTER, not re-read per tick off the
        // holder (healPipeline.ts scaleHotMagnitude has the reasoning).
        // Non-HoT statuses pass through untouched.
        const magnitude = scaleHotMagnitude(app.magnitude, def, move, attackerHero, working.combatants[action.combatantId], {
          active: working.activeFieldEffect,
          defs: fieldEffects,
        });
        const statusAppliedEvents: CombatEvent[] = [];
        for (const applyTargetId of applyTargets) {
          if (!working.combatants[applyTargetId] || working.combatants[applyTargetId].fainted) continue;
          // Chanced rider (StatusApplication.chance — Ember's "10% chance to
          // apply Burn 5"). Rolled once PER TARGET, after this action's damage
          // rolls and before the next action's, which is the fixed, documented
          // draw order this stays deterministic under (docs/architecture.md
          // "Determinism & RNG"). An unchanced rider draws nothing at all, so
          // every fight authored before this field replays identically.
          if (app.chance !== undefined) {
            const roll = nextFloat(working.rngState);
            working = { ...working, rngState: roll.nextState };
            if (roll.value >= app.chance) continue;
          }
          const result = applyStatus(working, round, applyTargetId, def, { magnitude, duration: app.duration });
          working = result.state;
          events.push(...result.events);
          statusAppliedEvents.push(...result.events);
        }
        const statusReactions = resolvePassiveReactions(working, round, statusAppliedEvents, heroes, statuses, passives, fieldEffects);
        working = statusReactions.state;
        events.push(...statusReactions.events);
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
  }

  const regen = applyBenchHpRegen(working, round, config.benchHpRegenFlat, maxHpOf);
  working = regen.state;
  events.push(...regen.events);

  const manaRegen = applyManaRegen(working, round, heroes, fieldEffects);
  working = manaRegen.state;
  events.push(...manaRegen.events);

  const statusTicks = tickEndOfRound(working, round, statuses, fieldEffects, maxHpOf);
  working = statusTicks.state;
  events.push(...statusTicks.events);

  // Sanguine's checkpoint: reacts to this round's status ticks (e.g. "heal
  // when an enemy takes Bleed damage") — statusTicks.events only, not the
  // whole round's log, so a passive can't accidentally re-match an event from
  // earlier this same round.
  const tickReactions = resolvePassiveReactions(working, round, statusTicks.events, heroes, statuses, passives, fieldEffects);
  working = tickReactions.state;
  events.push(...tickReactions.events);

  // Field Effect countdown (docs/field-effects.md) — its own end-of-round
  // boundary step, alongside status ticks and mana regen above.
  const fieldEffectTick = tickFieldEffect(working, round);
  working = fieldEffectTick.state;
  events.push(...fieldEffectTick.events);

  events.push({ type: 'RoundEnded', round });

  return { state: { ...working, round: working.round + 1 }, events };
}

function getMaxHeroMaxMana(heroes: HeroLookup, state: CombatState, combatantId: string): number {
  const combatant = state.combatants[combatantId];
  const hero = heroes[combatant.heroId];
  return getMaxMana(hero, combatant);
}
