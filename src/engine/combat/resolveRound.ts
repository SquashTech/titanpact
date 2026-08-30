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

import type { FieldEffectDefinition, HeroDefinition, MoveDefinition, PassiveDefinition, StatDelta, StatKey, StatusDefinition } from '../content';
import { statusApplicationsOf } from '../content';
import type { CombatState, HeroLookup, Side } from '../state';
import { activePartnerTypes, getMaxHp, getMaxMana, getEffectiveStat, resolveManaCost, resolveTargetMode, effectiveTypes, hasStatus } from '../state';
import type { CombatEvent } from '../events';
import type { Action } from './actions';
import { orderActions } from './priority';
import { resolveTargetsRolled, rollRiderTarget, slotOfActiveCombatant, TargetNoLongerValidError } from './targeting';
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
import { resolveHeal, scaleHotMagnitude } from '../heal/healPipeline';
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

/**
 * Clears Combatant.damageTakenSinceLastTurn (state.ts) — called from the three
 * points a combatant actually TAKES a turn: a move whose mana is spent, a
 * Rest, and a completed switch. Kept as one helper so those three cannot drift
 * apart on what "since its last turn" means, which is the whole contract
 * Stone's Retribution and Stoneheart read.
 *
 * Deliberately not called for a blocked or fizzled action: a Dazed hero, or one
 * whose target gate went unmet, did not take a turn and keeps banking.
 */
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

  const { ordered, nextRngState } = orderActions(working, heroes, actions, moves, working.rngState, fieldEffects);
  working = { ...working, rngState: nextRngState };

  for (const action of ordered) {
    const actor = working.combatants[action.combatantId];
    if (!actor || actor.fainted) continue;

    // Read ONCE, before anything this action does, and reset wherever the
    // action actually commits below (state.ts damageTakenSinceLastTurn). This
    // is the number Stone's Retribution and Stoneheart deal — captured here
    // rather than read at payload time so a move cannot count its own recoil,
    // and so the three commit points cannot disagree about what "since its
    // last turn" spans.
    const damageTakenBeforeTurn = actor.damageTakenSinceLastTurn;

    if (action.kind === 'switch') {
      try {
        const result = applyVoluntarySwitch(working, round, action.combatantId, action.benchedCombatantId, statuses);
        working = result.state;
        events.push(...result.events);
        working = resetDamageTaken(working, action.combatantId);
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
      // Tops up TO the pool, and never below what the hero already holds — an
      // overflowed combatant (content.ts manaGrant, docs/mana.md "Overflow")
      // that Rests wastes a turn rather than being refunded down to its pool.
      // A bare `currentMana: maxMana` was correct for as long as mana could
      // not exceed the pool, which stopped being true on 2026-08-30.
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

    // Live cost, not the authored one, and live in BOTH senses: Wave Shred
    // gets cheaper every time this combatant casts it (manaDiscountOnUse) and
    // Overcharge is free while both enemies are marked (conditionalManaCost).
    // Read off `working`, not the pre-round snapshot, so a mark planted by a
    // faster action THIS round already pays for this one — unlike
    // conditionalPriority, which cannot see that far because a bracket has to
    // be settled before anything resolves. Every move carrying neither field
    // prices identically to before (state.ts resolveManaCost).
    // Pack Leader is priced off the caster's OWN row instead of the enemy's
    // (content.ts conditionalManaCost.requiresPartnerType), which is why the
    // roster goes in: a Combatant carries a heroId, not its types. Read off
    // `working` like everything else here, so a partner KO'd by a faster
    // action this round has already taken the discount away — and if the
    // caster can no longer cover the difference, the guard on the next line
    // fizzles the action for no mana, exactly as a cleansed Overcharge does.
    const manaCost = resolveManaCost(working, action.combatantId, move, heroes);
    if (actor.currentMana < manaCost) continue; // engine-level legality guard; view must already prevent this

    // Who this move actually hits, which since Arcane's Overload is no longer
    // simply `move.target` (content.ts conditionalTarget, state.ts
    // resolveTargetMode — "spread if Magical Surge is active"). Read off
    // `working`, not the pre-round snapshot, for the same reason the live mana
    // cost above is: a partner's Mana Font earlier THIS round has already
    // turned the ground, and a target list — unlike a priority bracket — is
    // resolved per action rather than settled before the round begins.
    //
    // Used everywhere `move.target` used to be, so a conditionally-spread move
    // is a spread move for Stealth's redirect, Provoke's redirect and Haunt's
    // expansion alike, exactly as an authored `bothEnemies` move is.
    const targetMode = resolveTargetMode(working, move);

    let targetIds: string[];
    try {
      // Slot looked up against `state` — the pre-round snapshot — not `working`,
      // so it reflects where the declared target stood before any switch this
      // round already moved it to the bench (see resolveTargets' doc comment).
      const declaredTargetSlot = action.declaredTarget ? slotOfActiveCombatant(state, action.declaredTarget) : null;
      // resolveTargetsRolled, not resolveTargets: 'randomAlly'/'randomEnemy'
      // draw one target from the seeded RNG here. Every other mode leaves
      // rngState byte-identical, so nothing authored before random targeting
      // replays differently (targeting.ts).
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

    // Three status-driven retargeting layers, in a fixed order, all applied
    // before MoveDeclared below so the event already reflects the final targets.
    //
    // Stealth (push away) and Haunt (spread) are damage-kind only; Provoke
    // (pull toward) catches EVERY kind of single-target enemy move, which is
    // why it sits outside the damage guard rather than beside its two cousins
    // (content.ts redirectsSingleTargetEnemyMoves).
    //
    // Provoke resolves AFTER Stealth deliberately: on the pathological board
    // where one hero holds both, the 25-mana action taken this round to eat a
    // hit beats the passive avoidance. It resolves BEFORE Haunt so a taunt
    // pulls the hit in first and Haunt then spreads from where it actually
    // landed.
    if (move.kind === 'damage') {
      targetIds = applyStealthRedirect(working, targetMode, move.kind, targetIds);
    }
    targetIds = applyProvokeRedirect(working, action.combatantId, targetMode, targetIds, statuses);
    if (move.kind === 'damage') {
      const spread = expandSpreadTargets(working, move.type, targetMode, targetIds, statuses);
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
      combatants: {
        ...working.combatants,
        // Spending the mana is what makes this a turn taken, so it is also
        // where the damage-taken counter resets. A move blocked before this
        // point (Daze, an unmet target gate, an unaffordable price) leaves the
        // counter standing — no turn happened.
        [action.combatantId]: { ...actor, currentMana: newMana, moveManaDiscounts: nextDiscounts, damageTakenSinceLastTurn: 0 },
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
      maxMana: getMaxHeroMaxMana(heroes, working, action.combatantId),
    });

    const attackerHero = heroes[working.combatants[action.combatantId].heroId];

    // Who is standing next to the caster — the answer all three of Beast's
    // pack rows hang off (content.ts conditionalPower.requiresPartnerType,
    // conditionalStatDeltas, and the price already resolved above). Asked ONCE
    // per cast, above the kind switch because a damage row (Pack Hunt) and a
    // buff row (Prowl) both read it, and asked HERE rather than before the
    // action loop because that is what makes it live: a Beast switched in by a
    // faster ally this round already counts, and one KO'd this round already
    // does not. One question per cast is also what keeps a spread Pack Hunt
    // doubled against both foes or neither.
    const partnerTypes = activePartnerTypes(working, action.combatantId, heroes);

    switch (move.kind) {
      case 'damage': {
        // Retribution (content.ts retributionPercent — Stone's Retribution at
        // 50% and Stoneheart at 100%). FIXED damage: the formula is not
        // evaluated, rollDamage is never called, and so these two moves draw NO
        // RNG at all — the same determinism discipline every optional field
        // added since Fire follows. Computed once, outside the target loop,
        // because it is a fact about the ATTACKER and does not vary per target.
        const retribution =
          move.retributionPercent != null ? { damageTaken: damageTakenBeforeTurn, percent: move.retributionPercent } : null;

        // Summed across every target this move hits and paid ONCE after the
        // loop (content.ts recoilPercent). Not per target like drain, because
        // recoil can faint the user and a fainted caster must not keep swinging.
        let recoilBase = 0;

        // The caster's HP as the cast BEGINS, for conditionalPower's
        // requiresUserHpBelow (content.ts — Spirit's Spite and Vengeance).
        // Snapshotted here rather than read live inside the loop, which is
        // what makes the user-side HP form all-or-nothing across a spread:
        // a move that also drained would otherwise heal itself back over the
        // line between its first target and its second. Hoisted for the same
        // reason `retribution` is — it is a fact about the ATTACKER, asked
        // once, not a per-target question.
        const attackerAtCast = working.combatants[action.combatantId];
        const attackerHpAtCast = { currentHp: attackerAtCast.currentHp, maxHp: getMaxHp(attackerHero, attackerAtCast) };


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
          // offStatOverride (Stone's Body Blow/Body Crush) rides in here, on
          // pipeline 1, because it changes WHICH stat is read — not what the
          // result is multiplied by. statKeysForMove below reads the same field
          // so the event's offStat and this ratio cannot disagree.
          const ratio = resolveStatRatio(move.category, attackerHero, attackerNow, defenderHero, target, fieldEffectCtx, move.offStatOverride);

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
          // Nature's Seed Shot / Branch Slam ask the same question of the
          // ATTACKER instead (content.ts conditionalPower.requiresUserStatus),
          // which is why `attackerNow` is passed in: read fresh per hit, so a
          // Renew granted by a faster partner this same round already counts.
          // Light's Smite asks it of the BOARD (requiresFieldEffect), which is
          // why the same freshly-read fieldEffectCtx goes in: a Consecrate cast
          // earlier in this round has already turned the ground.
          // Shadow: Rend and Eclipse ask it of the target HP FRACTION
          // (requiresTargetHpBelow), which is why maxHp goes in — read here,
          // BEFORE applyHpDelta, so an execute can never double against the HP
          // this very hit is about to remove.
          // Beast: Pack Hunt asks it of the caster's PARTNER
          // (requiresPartnerType), which is why the hoisted partner types go
          // in — the one sibling whose answer is on the same side of the field
          // as the attacker.
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
                // Every term its identity value, because the formula genuinely
                // did not run — see events.ts DamageDealtEvent.retribution. The
                // rngState passes through untouched, which is what keeps these
                // two moves RNG-free.
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
            basePower: move.basePower ?? 0,
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

          // Cold Snap spending the mark it cashed in (content.ts
          // conditionalPower.consumesStatus). Keyed off the multiplier that was
          // ACTUALLY applied rather than off a second status read, so on a spread
          // conditional move only the target that got doubled pays for it. Its own
          // StatusRemoved beat after the damage, for the same reason Conduct's
          // detonation is its own beat rather than a bigger DamageDealt number.
          if (move.conditionalPower?.consumesStatus && basePowerMultiplier !== 1) {
            // Spent by whoever the condition READ — the target for the
            // Immolate/Cold Snap shape, the user for Nature's user-side one
            // (content.ts conditionalPower.consumesStatus). The user branch
            // is unused by content today; it is here so the field means the
            // same thing on both halves of conditionalPower rather than
            // silently only working on one. The FIELD form has no holder at
            // all, so `heldStatus` is undefined there and the guard below
            // makes it a no-op rather than a third meaning.
            const cond = move.conditionalPower;
            const holderId = cond.requiresTargetStatus ? targetId : action.combatantId;
            const heldStatus = cond.requiresTargetStatus ?? cond.requiresUserStatus;
            if (heldStatus && !working.combatants[holderId]?.fainted) {
              const spent = consumeStatus(working, round, holderId, heldStatus);
              working = spent.state;
              events.push(...spent.events);
            }
          }

          // Drain (content.ts drainPercent — Water's Siphon/Engulf). Scaled off
          // the HP this hit ACTUALLY removed rather than the rolled amount, so
          // overkill into a 3 HP target returns 1 and not half of 45. Resolved
          // here, between the hit and Conduct's detonation, for the same reason
          // the detonation is kept separate: each is its own beat, and folding
          // the drain into the DamageDealt amount would make the log's formula
          // readout wrong.
          // The HP this hit ACTUALLY removed — the number both drain and
          // recoil scale, and deliberately read before Conduct's detonation
          // below so neither is paid on damage this move did not itself deal.
          const removed = hpBefore - working.combatants[targetId].currentHp;
          recoilBase += removed;

          if (move.drainPercent) {
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

        // Recoil (content.ts recoilPercent — Stone's Rubble Rush). Paid once,
        // here, on the total HP this move removed, and it CAN faint the user:
        // there is no 1 HP floor (2026-08-30 designer call), so applyHpDelta
        // handles the KO exactly as it would an enemy's, lock-in included.
        // Emitted as a DamageDealt whose source and target are both the caster,
        // mirroring how drain is emitted as a Healed pointing back at itself.
        if (move.recoilPercent && recoilBase > 0) {
          const recoilAmount = Math.round(recoilBase * move.recoilPercent);
          const user = working.combatants[action.combatantId];
          if (recoilAmount > 0 && user && !user.fainted) {
            const userMaxHp = getMaxHp(heroes[user.heroId], user);
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

    // Mana grants (content.ts manaGrant — Arcane's Infuse, Empower, Conduit,
    // Font of Power). UNCAPPED: the whole authored amount lands even when it
    // carries the target past its pool, and nothing later in the round takes
    // the surplus back (manaRegen.ts, and Rest above — docs/mana.md
    // "Overflow"). Deliberately NOT routed through a clamp helper, because
    // there is no helper to route it through: mana has no applyHpDelta
    // equivalent precisely because it has no ceiling any more.
    //
    // Placed after the kind switch and before the stat deltas below so a move
    // that ever did both would pay out its resource half first — nothing today
    // authors both, and this is the order the two read in on a design row.
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

    // Stat deltas (engine/content.ts MoveDefinition.statDeltas) layer on top of
    // any move kind, same as statusApplication/fieldEffectApplication below —
    // Fire's Molten Lash is a damage move that also drops the target's Defense.
    // Deliberately AFTER the damage/heal switch above: the debuff shapes the
    // NEXT hit, not the one that delivered it.
    // Landslide (content.ts statDeltaTarget) is the first move whose deltas
    // land on the OPPOSITE side from its damage, so the deltas resolve their own
    // targets rather than riding the move's — exactly the split
    // StatusApplication.target already makes for a status rider. Omitted means
    // 'moveTarget', which is every move authored before it.
    //
    // Arcane Overflow's deltas have no authored amount at all — the figure is
    // read off the caster's mana as it stood BEFORE this move was paid for
    // (content.ts derivedStatDeltas). Expanded into ordinary StatDeltas here,
    // so everything downstream — the target resolution just below, the
    // StatChanged events, statModifiers itself — is byte-for-byte the path an
    // authored delta takes. `previousMana` is that pre-spend figure, captured
    // above where the mana was actually deducted.
    //
    // These are EXEMPT from the multiples-of-5/10 rule by designer call
    // (2026-08-30) — a mana pool is whatever it is, and rounding it would make
    // the grant disagree with the numeral on the caster's own bar.
    // Apex Predator's source is the caster's own Attack as it stands right
    // now, read through getEffectiveStat so equipment, this fight's buffs and
    // this fight's debuffs are all already in it (content.ts
    // derivedStatDeltas 'userEffectiveAttack'). Granting that much Attack is
    // what makes the row a DOUBLING, and it compounds on a second cast for
    // the same reason Brain Flay does: it reads the number on the board.
    // Exempt from multiples-of-5/10 like the mana member, and for the same
    // reason — there is no authored number to round.
    const derived = move.derivedStatDeltas;
    const derivedAmount =
      derived?.source === 'userEffectiveAttack'
        ? getEffectiveStat(attackerHero, working.combatants[action.combatantId], 'attack', {
            active: working.activeFieldEffect,
            defs: fieldEffects,
          })
        : previousMana;
    const derivedDeltas: StatDelta[] = derived ? derived.stats.map((stat) => ({ stat, amount: derivedAmount })) : [];
    // Prowl's "doubled if partner is a Beast" (content.ts
    // conditionalStatDeltas) scales the AMOUNTS, so a +10 lands as one +20
    // rather than as two separate grants. Deliberately does not reach the
    // derived deltas above — nothing authors both, and scaling a figure
    // already read off live state would be two board reads on one number.
    const packMultiplier =
      move.conditionalStatDeltas && partnerTypes?.includes(move.conditionalStatDeltas.requiresPartnerType)
        ? move.conditionalStatDeltas.multiplier
        : 1;
    const authoredDeltas: readonly StatDelta[] =
      packMultiplier === 1
        ? (move.statDeltas ?? [])
        : (move.statDeltas ?? []).map(({ stat, amount }) => ({ stat, amount: amount * packMultiplier }));
    const allStatDeltas: readonly StatDelta[] = derivedDeltas.length ? [...authoredDeltas, ...derivedDeltas] : authoredDeltas;

    const statDeltaTargets = !allStatDeltas.length
      ? []
      : move.statDeltaTarget === 'self'
        ? [action.combatantId]
        : move.statDeltaTarget === 'bothAllies'
          ? working.active[working.combatants[action.combatantId].side].filter(
              (id): id is string => id !== null && !working.combatants[id]?.fainted
            )
          : targetIds;

    for (const targetId of statDeltaTargets) {
      if (!working.combatants[targetId] || working.combatants[targetId].fainted) continue;
      // Chanced deltas (content.ts statDeltaChance — Psi Bolt's "20% chance to
      // reduce the target's Wisdom by 20"). The exact sibling of
      // StatusApplication.chance below: rolled once PER TARGET so a chanced
      // spread move catches one foe and misses the other, gating only the
      // deltas and never the move's own body (CLAUDE.md "No accuracy stat"),
      // and drawing NOTHING when the field is absent so every fight authored
      // before it replays identically.
      if (move.statDeltaChance !== undefined) {
        const roll = nextFloat(working.rngState);
        working = { ...working, rngState: roll.nextState };
        if (roll.value >= move.statDeltaChance) continue;
      }
      for (const delta of allStatDeltas) {
        const current = working.combatants[targetId];
        const newValue = (current.statModifiers[delta.stat] ?? 0) + delta.amount;
        working = {
          ...working,
          combatants: { ...working.combatants, [targetId]: { ...current, statModifiers: { ...current.statModifiers, [delta.stat]: newValue } } },
        };
        events.push({ type: 'StatChanged', round, combatantId: targetId, stat: delta.stat, delta: delta.amount, newValue });
      }
    }

    // The amplifier (content.ts doublesStatReductions — Mind's Brain Flay).
    // Doubles every stat the target is already debuffed on, reading and
    // writing statModifiers ONLY: baselineStatModifiers is the loadout
    // (equipment/relics/class), and a target's armor must not change how hard
    // its debuffs amplify.
    //
    // Placed after the deltas above so a move that ever did both would inflict
    // its own reduction FIRST and then double it, which is the order the two
    // read in on a design row. Brain Flay authors no deltas of its own, so
    // nothing exercises that today.
    //
    // COMPOUNDS by construction (2026-08-30 designer call): it doubles the
    // number on the board, so a second cast doubles the already-doubled one.
    // No clamp here — state.ts getEffectiveStat floors every stat at 1 for
    // every reader at once, which is where that invariant belongs.
    if (move.doublesStatReductions) {
      for (const targetId of targetIds) {
        const target = working.combatants[targetId];
        if (!target || target.fainted) continue;
        const doubled: Partial<Record<StatKey, number>> = {};
        for (const [stat, value] of Object.entries(target.statModifiers) as [StatKey, number][]) {
          if (value >= 0) continue;
          doubled[stat] = value * 2;
        }
        const doubledEntries = Object.entries(doubled) as [StatKey, number][];
        if (!doubledEntries.length) continue;
        working = {
          ...working,
          combatants: {
            ...working.combatants,
            [targetId]: { ...target, statModifiers: { ...target.statModifiers, ...doubled } },
          },
        };
        for (const [stat, newValue] of doubledEntries) {
          // `delta` is the amount ADDED, not the new total — a -50 becoming
          // -100 reports -50, so the log and every event-stream reader treat
          // this exactly as an ordinary debuff beat.
          events.push({ type: 'StatChanged', round, combatantId: targetId, stat, delta: newValue - (target.statModifiers[stat] ?? 0), newValue });
        }
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
    //
    // A LIST since Beast's Toxic Fangs ("afflict Bleed and Poison 10" —
    // content.ts statusApplication), read through statusApplicationsOf so a
    // move authoring one bare rider takes byte-identical path it always did.
    // Each rider resolves its own targets and rolls its own chance in authored
    // order, and each feeds its own passive reactions before the next runs:
    // two riders on one cast are two independent applications, not a compound
    // status, and a one-rider move draws exactly the RNG it drew before.
    for (const app of statusApplicationsOf(move)) {
      const def = statuses[app.statusId];
      if (def) {
        // Three ways a rider picks its own targets. 'moveTarget' rides along
        // with the move (the default and the case for almost everything);
        // 'self' is recoil or a self-buff; the two random modes resolve
        // INDEPENDENTLY of the move's own target, which is what lets Rising
        // Static buff a random ally while marking a random enemy. The rider's
        // roll happens after the move's, which is the fixed draw order this
        // stays deterministic under (content.ts StatusApplication.target).
        let applyTargets: string[];
        if (app.target === 'self') {
          applyTargets = [action.combatantId];
        } else if (app.target === 'randomAlly' || app.target === 'randomEnemy') {
          const rolledRider = rollRiderTarget(working, action.combatantId, app.target, working.rngState);
          working = { ...working, rngState: rolledRider.nextRngState };
          applyTargets = rolledRider.targetIds;
        } else {
          applyTargets = targetIds;
        }
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

    // The forced detonation (content.ts detonatesStatus — Nature's Miasma).
    // Deliberately AFTER the statusApplication block above, which is what makes
    // "apply Poison 5, THEN detonate" true rather than merely the order the
    // design table happened to write it in: the 5 Miasma just planted is part
    // of the number that goes off. Skips a target the move's own damage already
    // knocked out, same as Conduct's detonation does.
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

    // The bill (content.ts selfHpCost — Spirit's Soul Offering, "user loses
    // 25% of max HP", and Last Rites, "user drops to 1 HP after using this").
    //
    // Paid here, after the whole payload above has landed on a board the
    // caster was still standing on — the same placement and the same reasoning
    // as the pivot below, which it sits directly in front of so that a caster
    // who killed itself cannot then switch out. Soul Offering's +40/+40 has
    // therefore already reached the ally by the time the 25% comes off, which
    // is what makes it a sacrifice rather than a gamble on surviving one.
    //
    // It CAN faint the user (2026-08-30 designer call), with no floor —
    // the same answer recoilPercent got. applyHpDelta handles that KO exactly
    // as it would an enemy's, lock-in included, and the counter it feeds
    // (damageTakenSinceLastTurn) is the same one every other HP write feeds.
    if (move.selfHpCost) {
      const user = working.combatants[action.combatantId];
      if (user && !user.fainted) {
        const userMaxHp = getMaxHp(heroes[user.heroId], user);
        // reduceToHp is a Math.max, never a heal: a caster already at or below
        // the floor pays nothing rather than being topped up to it
        // (content.ts SelfHpCost).
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

    // The pivot (content.ts switchesUserOut — Storm's Tailwind). Dead last, so
    // the move's whole payload has already landed on a board the user was
    // still standing on: Tailwind's +40 Speed reaches the partner, and only
    // then does the caster leave. Routed through applyVoluntarySwitch rather
    // than performSwitch so the LOCKED lock-in rule (2+ KOs) applies to it
    // exactly as it does to a declared switch — 2026-08-30 designer call. A
    // block does not fizzle the move; the buff and the mana are already spent,
    // so it degrades to "the buff, without the pivot" and says so.
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
        } catch (err) {
          if (!(err instanceof SwitchBlockedError)) throw err;
          events.push({ type: 'ActionBlocked', round, combatantId: action.combatantId, reason: 'switchBlocked' });
        }
      } else if (stillStanding && !stillStanding.fainted) {
        // No legal replacement was declared (empty bench, or the chosen hero
        // is gone). Same beat as a lock-in block: the player is told the pivot
        // did not happen rather than left to infer it from the board.
        events.push({ type: 'ActionBlocked', round, combatantId: action.combatantId, reason: 'switchBlocked' });
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
