// The status engine (docs/conditions.md, the 6th contract's runtime half —
// StatusDefinition in content.ts is the data half). Reads StatusDefinition
// flags generically; contains no per-status special cases beyond the
// documented exceptions the catalog itself calls out: Bleed's flat %maxHp,
// Freeze's stat-pipeline hook (lives in state.ts instead, since it must run
// on every getEffectiveStat call rather than only at apply/tick time), and
// Stealth's untargetable-while-active redirect (applyStealthRedirect below —
// narrow enough to stay a literal status-id check, same precedent as Freeze).

import type { FieldEffectDefinition, MoveDefinition, StatusDefinition, StatusId, StatusRemovalReason, TargetMode, TypeId } from '../content';
import type { CombatState, StatusInstance } from '../state';
import { hasStatus } from '../state';
import type { CombatEvent } from '../events';
import { applyHpDelta } from './faintHandling';
import { nextInt } from '../rng/seededRng';

function setStatus(state: CombatState, combatantId: string, statusId: StatusId, instance: StatusInstance): CombatState {
  const combatant = state.combatants[combatantId];
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...combatant, statuses: { ...combatant.statuses, [statusId]: instance } } },
  };
}

function removeStatus(
  state: CombatState,
  round: number,
  combatantId: string,
  statusId: StatusId,
  reason: StatusRemovalReason
): { state: CombatState; events: CombatEvent[] } {
  const combatant = state.combatants[combatantId];
  if (!combatant?.statuses[statusId]) return { state, events: [] };
  const nextStatuses = { ...combatant.statuses };
  delete nextStatuses[statusId];
  return {
    state: { ...state, combatants: { ...state.combatants, [combatantId]: { ...combatant, statuses: nextStatuses } } },
    events: [{ type: 'StatusRemoved', round, combatantId, statusId, reason }],
  };
}

/**
 * Spend a status as the PRICE of an effect that just cashed it in — Frost's
 * Cold Snap doubling its BasePower and consuming the Freeze it read
 * (content.ts conditionalPower.consumesStatus).
 *
 * A thin wrapper rather than an exported removeStatus: 'consumed' is the
 * only removal reason content is allowed to reach for, and keeping the
 * other four (decay/expired/switch/cleanse) inside this module is what
 * stops a content field from inventing a fifth way to strip a status.
 */
export function consumeStatus(
  state: CombatState,
  round: number,
  combatantId: string,
  statusId: StatusId
): { state: CombatState; events: CombatEvent[] } {
  return removeStatus(state, round, combatantId, statusId, 'consumed');
}

export interface StatusApplyParams {
  magnitude?: number;
  duration?: number;
}

/**
 * Applies (or stacks onto an existing) status per its StatusDefinition.stacking
 * rule (docs/conditions.md §1 per-status stacking column). No-ops on an already
 * fainted combatant.
 */
export function applyStatus(
  state: CombatState,
  round: number,
  combatantId: string,
  def: StatusDefinition,
  params: StatusApplyParams
): { state: CombatState; events: CombatEvent[] } {
  const combatant = state.combatants[combatantId];
  if (!combatant || combatant.fainted) return { state, events: [] };

  // Blanket rule: a side's two active heroes can never both be Stealthed at once
  // (docs/conditions.md) — without this, simultaneous self-Stealth on both actives
  // makes a whole enemy turn whiff with no counterplay. Narrow literal 'Stealth' id
  // check, same precedent as applyStealthRedirect below. Fizzles silently, same as
  // any other already-blocked reapply (stacking 'none' below) — no event, since
  // nothing about combatant state actually changed.
  if (def.id === 'Stealth' && state.active[combatant.side].includes(combatantId)) {
    const partnerId = state.active[combatant.side].find((id): id is string => id !== null && id !== combatantId);
    if (partnerId && hasStatus(state.combatants[partnerId], 'Stealth')) {
      return { state, events: [] };
    }
  }

  const existing = combatant.statuses[def.id];
  let magnitude = params.magnitude;
  let duration = params.duration;

  if (existing) {
    if (def.stacking === 'none') return { state, events: [] }; // reapply while present is a no-op (Bleed, Freeze, Conduct, Haunt)
    if (def.stacking === 'additive') {
      magnitude = (existing.magnitude ?? 0) + (params.magnitude ?? 0);
    } else if (def.stacking === 'takeHigher') {
      magnitude = params.magnitude !== undefined ? Math.max(existing.magnitude ?? 0, params.magnitude) : existing.magnitude;
      duration = params.duration !== undefined ? Math.max(existing.duration ?? 0, params.duration) : existing.duration;
    } else if (def.stacking === 'additiveMagnitudeFixedDuration') {
      // Poison (docs/conditions.md §7 Q3/Q4): magnitude builds up, but the
      // timer never resets or extends — reapplying mid-countdown ignores
      // params.duration entirely and just holds the existing value.
      magnitude = (existing.magnitude ?? 0) + (params.magnitude ?? 0);
      duration = existing.duration;
    }
  }

  const nextState = setStatus(state, combatantId, def.id, { statusId: def.id, magnitude, duration });
  return { state: nextState, events: [{ type: 'StatusApplied', round, combatantId, statusId: def.id, magnitude, duration }] };
}

/**
 * End-of-round tick (docs/conditions.md §7 "Status tick timing" — resolved as
 * end-of-round, the only tick boundary this engine has). Runs over EVERY
 * combatant, active or benched: Bleed/Poison/Renew persist through switch
 * specifically so they aren't escapable by bench-parking, so their ticks must
 * follow — except Poison's `activeOnly` flag, which stalls its timer entirely
 * while benched instead (docs/conditions.md: "switching stalls the clock
 * rather than clearing it"). Handles DoT/HoT damage-or-heal + magnitude decay,
 * Poison's timer-then-detonate, and duration countdown for Daze/Stealth —
 * driven entirely by StatusDefinition flags.
 */
export function tickEndOfRound(
  state: CombatState,
  round: number,
  statusDefs: Record<string, StatusDefinition>,
  fieldEffects: Record<string, FieldEffectDefinition>,
  maxHpOf: (combatantId: string) => number
): { state: CombatState; events: CombatEvent[] } {
  let working = state;
  const events: CombatEvent[] = [];

  // Scorched Land (docs/field-effects.md): suppresses decay for whichever
  // status ids its definition lists (Burn) — the DoT tick itself is
  // untouched, only the post-tick halving below is skipped.
  const activeFieldEffectId = working.activeFieldEffect?.fieldEffectId;
  const activeFieldEffectDef = activeFieldEffectId ? fieldEffects[activeFieldEffectId] : undefined;

  for (const combatantId of Object.keys(working.combatants)) {
    const combatant = working.combatants[combatantId];
    if (!combatant || combatant.fainted) continue;

    for (const statusId of Object.keys(combatant.statuses)) {
      const instance = combatant.statuses[statusId];
      const def = statusDefs[statusId];
      if (!def || !instance || !def.ticksAtEndOfRound) continue;
      if (def.activeOnly && !working.active[combatant.side].includes(combatantId)) continue;
      const decaySuppressed = activeFieldEffectDef?.suppressesStatusDecay?.includes(statusId) ?? false;

      if (def.pipeline === 'timer') {
        const newDuration = (instance.duration ?? 0) - 1;
        if (newDuration <= 0) {
          const maxHp = maxHpOf(combatantId);
          const amount = Math.ceil((maxHp * (instance.magnitude ?? 0)) / 100);
          events.push({ type: 'StatusTicked', round, combatantId, statusId, kind: 'damage', amount, newDuration: 0 });
          const hpResult = applyHpDelta(working, round, combatantId, -amount, maxHp);
          working = hpResult.state;
          events.push(...hpResult.events);
          const rm = removeStatus(working, round, combatantId, statusId, 'expired');
          working = rm.state;
          events.push(...rm.events);
        } else {
          events.push({ type: 'StatusTicked', round, combatantId, statusId, kind: 'duration', amount: 0, newDuration });
          working = setStatus(working, combatantId, statusId, { ...instance, duration: newDuration });
        }
      } else if (def.pipeline === 'dot' || def.pipeline === 'hot') {
        const maxHp = maxHpOf(combatantId);
        const magnitude = instance.magnitude ?? (def.flatPercentOfMaxHp ? Math.ceil(maxHp * def.flatPercentOfMaxHp) : 0);
        const delta = def.pipeline === 'dot' ? -magnitude : magnitude;
        // Computed up front so the StatusTicked event's newMagnitude is already the
        // post-decay value the view should replay onto combatant.statuses. Left
        // undefined for non-decaying statuses (Bleed) — it has no magnitude to begin
        // with, and a stray 0 would render as "Bleed 0" instead of "Bleed". Also left
        // undefined while Scorched Land suppresses this status's decay.
        const decayedMagnitude = def.decay === 'halve' && !decaySuppressed ? Math.floor((instance.magnitude ?? 0) / 2) : undefined;

        events.push({
          type: 'StatusTicked',
          round,
          combatantId,
          statusId,
          kind: def.pipeline === 'dot' ? 'damage' : 'heal',
          amount: magnitude,
          newMagnitude: decayedMagnitude,
        });
        const hpResult = applyHpDelta(working, round, combatantId, delta, maxHp);
        working = hpResult.state;
        events.push(...hpResult.events);

        if (def.decay === 'halve' && !decaySuppressed) {
          if ((decayedMagnitude ?? 0) <= 0) {
            const rm = removeStatus(working, round, combatantId, statusId, 'decay');
            working = rm.state;
            events.push(...rm.events);
          } else {
            working = setStatus(working, combatantId, statusId, { ...instance, magnitude: decayedMagnitude });
          }
        }
      } else if (def.shape === 'duration') {
        const newDuration = (instance.duration ?? 0) - 1;
        events.push({ type: 'StatusTicked', round, combatantId, statusId, kind: 'duration', amount: 0, newDuration });
        if (newDuration <= 0) {
          const rm = removeStatus(working, round, combatantId, statusId, 'expired');
          working = rm.state;
          events.push(...rm.events);
        } else {
          working = setStatus(working, combatantId, statusId, { ...instance, duration: newDuration });
        }
      }
    }
  }

  return { state: working, events };
}

/**
 * Start-of-round tick (Stealth only, currently) — the counterpart to
 * tickEndOfRound above, run BEFORE a round's actions so the countdown lands
 * on a round boundary the caster wasn't already mid-action for. A duration
 * already at 0 has used up the one full round it was owed (see
 * ticksAtStartOfRound's doc comment in content.ts) and is removed before this
 * round's actions run; otherwise it decrements and stays present, so it also
 * protects the round now starting.
 */
export function tickStartOfRound(
  state: CombatState,
  round: number,
  statusDefs: Record<string, StatusDefinition>
): { state: CombatState; events: CombatEvent[] } {
  let working = state;
  const events: CombatEvent[] = [];

  for (const combatantId of Object.keys(working.combatants)) {
    const combatant = working.combatants[combatantId];
    if (!combatant || combatant.fainted) continue;

    for (const statusId of Object.keys(combatant.statuses)) {
      const instance = combatant.statuses[statusId];
      const def = statusDefs[statusId];
      if (!def || !instance || !def.ticksAtStartOfRound) continue;

      if ((instance.duration ?? 0) <= 0) {
        const rm = removeStatus(working, round, combatantId, statusId, 'expired');
        working = rm.state;
        events.push(...rm.events);
        continue;
      }

      const newDuration = (instance.duration ?? 0) - 1;
      events.push({ type: 'StatusTicked', round, combatantId, statusId, kind: 'duration', amount: 0, newDuration });
      working = setStatus(working, combatantId, statusId, { ...instance, duration: newDuration });
    }
  }

  return { state: working, events };
}

/** docs/conditions.md §4: switching to bench clears every status with clearsOnSwitch (Burn, Freeze, Daze, Haunt). */
export function clearOnSwitch(
  state: CombatState,
  round: number,
  combatantId: string,
  statusDefs: Record<string, StatusDefinition>
): { state: CombatState; events: CombatEvent[] } {
  let working = state;
  const events: CombatEvent[] = [];
  const combatant = working.combatants[combatantId];
  if (!combatant) return { state, events };

  for (const statusId of Object.keys(combatant.statuses)) {
    if (!statusDefs[statusId]?.clearsOnSwitch) continue;
    const rm = removeStatus(working, round, combatantId, statusId, 'switch');
    working = rm.state;
    events.push(...rm.events);
  }

  return { state: working, events };
}

/**
 * docs/conditions.md §7 "Cleanse & positive statuses" — resolved as a flat
 * rule, not a per-move choice: Cleanse strips every status EXCEPT ones
 * flagged `positive` (Renew, Stealth). Data-driven off StatusDefinition.positive
 * rather than a hardcoded status-id check.
 */
export function cleanseStatuses(
  state: CombatState,
  round: number,
  combatantId: string,
  statusDefs: Record<string, StatusDefinition>,
  /**
   * At most this many, chosen at random (MoveDefinition.cleanseCount — Wash
   * Away's "a random negative status effect"). Omitted strips them all, which
   * is what every Cleanse move before it did.
   */
  limit?: number
): { state: CombatState; events: CombatEvent[] } {
  let working = state;
  const events: CombatEvent[] = [];
  const combatant = working.combatants[combatantId];
  if (!combatant) return { state, events };

  const eligible = Object.keys(combatant.statuses).filter((statusId) => !statusDefs[statusId]?.positive);

  // The RNG draw happens ONLY when a limit actually has to choose — no limit,
  // or fewer statuses present than the limit allows, and this advances the
  // stream not at all. Same discipline as StatusApplication.chance: a golden
  // replay of any fight authored before cleanseCount existed is unaffected.
  let selected = eligible;
  if (limit !== undefined && eligible.length > limit) {
    const pool = [...eligible];
    const picked: string[] = [];
    for (let i = 0; i < limit && pool.length > 0; i++) {
      const roll = nextInt(working.rngState, 0, pool.length);
      working = { ...working, rngState: roll.nextState };
      picked.push(pool.splice(roll.value, 1)[0]);
    }
    selected = picked;
  }

  for (const statusId of selected) {
    const rm = removeStatus(working, round, combatantId, statusId, 'cleanse');
    working = rm.state;
    events.push(...rm.events);
  }

  return { state: working, events };
}

/**
 * Conduct's engine hook, written generically off `triggerTypes` /
 * `detonateBonusPercentMaxHp` so any future type-triggered status reuses it.
 * For a `kind: 'damage'` hit whose move type matches a status's
 * `triggerTypes`: if the target already carries that status, detonate it
 * (bonus damage, then `removeStatus` reason 'consumed'). Detonate-only —
 * `triggerTypes` no longer auto-applies the status on a clean hit (that was
 * the bug: it made every Storm/Iron move inflict Conduct). Applying the
 * status is now a move-authored choice like any other status, via the same
 * `statusApplication` field Burn/Bleed/Poison/etc. use — see moves.ts's
 * dedicated Conduct move. `triggerTypes` only ever governs who can cash the
 * mark in, not who can plant it.
 */
export function detonateTriggeredStatuses(
  state: CombatState,
  round: number,
  targetId: string,
  moveType: TypeId,
  maxHp: number,
  statusDefs: Record<string, StatusDefinition>
): { state: CombatState; bonusDamage: number; events: CombatEvent[] } {
  let working = state;
  const events: CombatEvent[] = [];
  let bonusDamage = 0;

  for (const def of Object.values(statusDefs)) {
    if (!def.triggerTypes?.includes(moveType)) continue;
    const target = working.combatants[targetId];
    if (!target || target.fainted) continue;
    if (!hasStatus(target, def.id)) continue;

    const bonus = Math.ceil(maxHp * (def.detonateBonusPercentMaxHp ?? 0));
    bonusDamage += bonus;
    // Own event (not folded into the triggering hit's DamageDealt) so the view
    // can present the detonation as a separate beat/indicator — see events.ts.
    events.push({ type: 'StatusDetonated', round, combatantId: targetId, statusId: def.id, amount: bonus });
    const rm = removeStatus(working, round, targetId, def.id, 'consumed');
    working = rm.state;
    events.push(...rm.events);
  }

  return { state: working, bonusDamage, events };
}

/**
 * Fire a TIMER-shape status's stored payload NOW instead of when its clock
 * runs out (content.ts MoveDefinition.detonatesStatus — Nature's Miasma,
 * "apply Poison 5, then instantly detonate Poison").
 *
 * The same payload tickEndOfRound's `pipeline === 'timer'` branch pays at
 * duration 0 — `magnitude`% of the holder's max HP — just claimed early. It
 * is deliberately NOT re-derived here as a different number: a detonation the
 * player forced and a detonation they waited for have to be worth the same,
 * or Miasma stops being "spend the timer" and becomes its own damage source.
 *
 * Two things it is not:
 *
 * - Not an expiry. The status leaves with reason 'consumed' rather than
 *   'expired', matching Conduct's detonation, because something spent it.
 * - Not a tick. It emits StatusDetonated + StatusRemoved + HpChanged, in that
 *   order, which is exactly the beat detonateTriggeredStatuses already
 *   produces and buildBeats.ts already knows how to bundle — so a forced
 *   detonation reads in the log and on screen like the Conduct pop it is a
 *   cousin of, with no new view vocabulary.
 *
 * Gated on the SHAPE, not on a status id: a timer is the one status that
 * holds an unspent payload, so it is the one shape "detonate" means anything
 * for. Naming Burn or Renew here is a silent no-op, same guard discipline as
 * statusApplication's unknown-id lookup.
 */
export function detonateStatusNow(
  state: CombatState,
  round: number,
  combatantId: string,
  statusId: StatusId,
  statusDefs: Record<string, StatusDefinition>,
  maxHp: number
): { state: CombatState; amount: number; events: CombatEvent[] } {
  const def = statusDefs[statusId];
  const combatant = state.combatants[combatantId];
  if (!def || def.pipeline !== 'timer') return { state, amount: 0, events: [] };
  if (!combatant || combatant.fainted) return { state, amount: 0, events: [] };
  const instance = combatant.statuses[statusId];
  if (!instance) return { state, amount: 0, events: [] };

  const amount = Math.ceil((maxHp * (instance.magnitude ?? 0)) / 100);
  const events: CombatEvent[] = [{ type: 'StatusDetonated', round, combatantId, statusId, amount }];

  let working = state;
  const rm = removeStatus(working, round, combatantId, statusId, 'consumed');
  working = rm.state;
  events.push(...rm.events);

  const hpResult = applyHpDelta(working, round, combatantId, -amount, maxHp);
  working = hpResult.state;
  events.push(...hpResult.events);

  return { state: working, amount, events };
}

/**
 * Haunt's engine hook, written generically off `spreadTriggerTypes` so any
 * future retarget-style status reuses it. For a `singleEnemy` `kind: 'damage'`
 * move resolved to exactly one target: if an active ally-of-the-target (not
 * the target itself) carries a status whose `spreadTriggerTypes` matches the
 * move's type, that ally is added to the target list too — single-target
 * becomes spread. Only expands `singleEnemy` targeting — native spread moves
 * (bothEnemies/allOthers) are untouched. LOCKED, 2026-08-18 designer sign-off
 * (docs/conditions.md §7): this caps Haunt's burst ceiling at one extra
 * full-damage hit rather than roughly doubling an already-spread move.
 */
export function expandSpreadTargets(
  state: CombatState,
  moveType: TypeId,
  targetMode: TargetMode,
  targetIds: readonly string[],
  statusDefs: Record<string, StatusDefinition>
): { targetIds: string[]; spreadVia: Record<string, StatusId> } {
  if (targetMode !== 'singleEnemy' || targetIds.length !== 1) return { targetIds: [...targetIds], spreadVia: {} };
  const target = state.combatants[targetIds[0]];
  if (!target) return { targetIds: [...targetIds], spreadVia: {} };

  // Recorded per extra target id (not just filtered) so the caller can stamp the
  // resulting DamageDealt event with which status dragged this target in —
  // events.ts DamageDealtEvent.viaStatusId, read by buildBeats.ts to give the hit
  // its own "dragged into the attack" banner/popup instead of a plain spread hit.
  const spreadVia: Record<string, StatusId> = {};
  const extra = state.active[target.side].filter((id): id is string => {
    if (!id || id === targetIds[0] || state.combatants[id]?.fainted) return false;
    const match = Object.values(statusDefs).find(
      (def) => def.spreadTriggerTypes?.includes(moveType) && hasStatus(state.combatants[id], def.id)
    );
    if (match) spreadVia[id] = match.id;
    return !!match;
  });

  return { targetIds: extra.length > 0 ? [...targetIds, ...extra] : [...targetIds], spreadVia };
}

/**
 * Stealth's redirect (docs/conditions.md, §7 Q7 resolution: "a fast stealth
 * can redirect an attack directed at that hero"). Narrow one-off mechanic —
 * stays a literal 'Stealth' id check, same precedent as Freeze's Speed hook
 * in state.ts. Only redirects a `kind: 'damage'` move resolved to exactly one
 * target (singleEnemy/singleAlly) — spread moves still land, per the doc.
 * Because actions resolve in priority/speed order and this runs at the exact
 * point the attack resolves, a Stealth applied by a faster action earlier
 * this same round is already on the target when this check runs; a slower
 * Stealth simply hasn't landed yet and the attack goes through untouched.
 */
export function applyStealthRedirect(
  state: CombatState,
  targetMode: TargetMode,
  moveKind: 'damage' | 'heal' | 'buff',
  targetIds: readonly string[]
): string[] {
  if (moveKind !== 'damage') return [...targetIds];
  if (targetMode !== 'singleEnemy' && targetMode !== 'singleAlly') return [...targetIds];
  if (targetIds.length !== 1) return [...targetIds];

  const [id] = targetIds;
  const target = state.combatants[id];
  if (!target || !hasStatus(target, 'Stealth')) return [...targetIds];

  const alternate = state.active[target.side].find((cid): cid is string => cid !== null && cid !== id && !state.combatants[cid]?.fainted);
  return alternate ? [alternate] : [...targetIds];
}

/**
 * Provoke's redirect (content.ts StatusDefinition
 * .redirectsSingleTargetEnemyMoves — Stone's Provoke, "redirect single-target
 * enemy attacks to the user this turn"). The inverse of applyStealthRedirect
 * above: that one pushes a hit off its holder, this one pulls every hit on the
 * side onto it.
 *
 * Three deliberate differences from Stealth's version, all of them following
 * the design row rather than the precedent:
 *
 * - Every move KIND, not just `kind: 'damage'`. A debuff the enemy aims at
 *   your fragile partner is exactly what a taunt should be eating.
 * - 'singleEnemy' only, read from the CASTER's side. A 'singleAlly' move is by
 *   definition not an enemy attack, so an ally's heal is never dragged onto
 *   the opposing taunt.
 * - It runs AFTER Stealth in resolveRound, so on the pathological board where
 *   a hero is somehow both Stealthed and Provoked, Provoke wins. That is the
 *   right way round: Provoke is a 25-mana action taken THIS round to eat a
 *   hit, and it should be the last word over a passive avoidance effect.
 *
 * Spread moves are untouched, same as Stealth. Reading the flag off the status
 * catalog rather than checking for a literal 'Provoke' id keeps this the
 * generic taunt hook the next type can author into.
 */
export function applyProvokeRedirect(
  state: CombatState,
  actorCombatantId: string,
  targetMode: TargetMode,
  targetIds: readonly string[],
  statusDefs: Record<string, StatusDefinition>
): string[] {
  if (targetMode !== 'singleEnemy') return [...targetIds];
  if (targetIds.length !== 1) return [...targetIds];

  const actor = state.combatants[actorCombatantId];
  if (!actor) return [...targetIds];
  const enemySide = actor.side === 'A' ? 'B' : 'A';

  const taunter = state.active[enemySide].find((id): id is string => {
    if (!id) return false;
    const combatant = state.combatants[id];
    if (!combatant || combatant.fainted) return false;
    return Object.values(statusDefs).some((def) => def.redirectsSingleTargetEnemyMoves && hasStatus(combatant, def.id));
  });

  return taunter ? [taunter] : [...targetIds];
}

/**
 * The declaration-time counterpart to applyStealthRedirect: which of
 * `candidateIds` a single-target move may legally be aimed at. A Stealthed
 * hero is not offered at all, so the player never declares an attack the
 * redirect above would silently move somewhere else. Same narrow shape as the
 * redirect — damage-kind, singleEnemy/singleAlly only — so spread moves keep
 * listing (and hitting) a Stealthed hero.
 *
 * Falls back to the unfiltered candidates when hiding would leave nothing to
 * aim at, mirroring the redirect's own "no alternate, the attack goes through"
 * branch rather than presenting an empty target list.
 */
/**
 * The hard targeting gate (content.ts requiresTargetStatus — Frost's
 * Glaciate and Absolute Zero, "can only target Frozen enemies"): of
 * `targetIds`, the ones actually carrying the status the move demands.
 *
 * Unlike selectableTargets' Stealth filter below there is deliberately NO
 * fallback to the unfiltered list. An empty result is the correct answer and
 * it means the move has no legal target at all — the view then refuses to
 * offer it (FightScreen) and the engine fizzles it (resolveRound), both off
 * this one function so declaration-time and resolve-time cannot drift apart.
 *
 * Generic in the status, not a Freeze check: the next type that wants a
 * "only vs. Poisoned" move authors it as data, same discipline as
 * StatusDefinition.triggerTypes.
 */
export function statusGatedTargets(state: CombatState, move: MoveDefinition, targetIds: readonly string[]): string[] {
  const required = move.requiresTargetStatus;
  if (!required) return [...targetIds];
  return targetIds.filter((id) => {
    const combatant = state.combatants[id];
    return combatant != null && hasStatus(combatant, required);
  });
}

export function selectableTargets(
  state: CombatState,
  targetMode: TargetMode,
  moveKind: 'damage' | 'heal' | 'buff',
  candidateIds: readonly string[],
  /** Status catalog — only needed for the Provoke narrowing below. Omitted keeps the pre-Provoke behaviour exactly. */
  statusDefs?: Record<string, StatusDefinition>
): string[] {
  // Provoke's declaration-time half (applyProvokeRedirect above). Narrows the
  // picker to the taunter alone rather than hiding it, which is the opposite of
  // what Stealth's filter below does but the same principle: the player must
  // never be offered a target the redirect would silently move the move off.
  // Applies to EVERY move kind, matching the redirect, and only to 'singleEnemy'
  // — candidateIds for that mode are the enemy side, so no caster is needed.
  if (statusDefs && targetMode === 'singleEnemy') {
    const taunter = candidateIds.find((id) => {
      const combatant = state.combatants[id];
      if (!combatant || combatant.fainted) return false;
      return Object.values(statusDefs).some((def) => def.redirectsSingleTargetEnemyMoves && hasStatus(combatant, def.id));
    });
    if (taunter) return [taunter];
  }

  if (moveKind !== 'damage') return [...candidateIds];
  if (targetMode !== 'singleEnemy' && targetMode !== 'singleAlly') return [...candidateIds];

  const visible = candidateIds.filter((id) => {
    const combatant = state.combatants[id];
    return !combatant || !hasStatus(combatant, 'Stealth');
  });
  return visible.length > 0 ? visible : [...candidateIds];
}
