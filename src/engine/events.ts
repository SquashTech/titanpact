// The event contract (docs/architecture.md "The event contract").
// Typed, serializable, replayable records. Plain data only — no functions, no
// class instances, no references the view has to resolve back into engine
// state. One event = one thing that happened (DamageDealt and Fainted are
// always separate, even on a lethal hit).
//
// This is the PROPOSED canonical set from docs/architecture.md, reconciled
// against the two locked pipelines and the combat/switching/KO rules in
// docs/combat.md. Status events (Status* below) implement the sixth engine
// contract per docs/conditions.md — see engine/combat/statusEngine.ts.

import type { Side, DamageCategory } from './state';
import type { FieldEffectId, PassiveId, SelfHpCost, StatusId, StatusRemovalReason, TypeId } from './content';

interface BaseEvent {
  round: number;
}

export interface RoundStartedEvent extends BaseEvent {
  type: 'RoundStarted';
}

export interface TurnStartedEvent extends BaseEvent {
  type: 'TurnStarted';
  combatantId: string;
}

export interface MoveDeclaredEvent extends BaseEvent {
  type: 'MoveDeclared';
  combatantId: string;
  moveId: string;
  targetCombatantIds: string[];
}

export interface MoveUsedEvent extends BaseEvent {
  type: 'MoveUsed';
  combatantId: string;
  moveId: string;
  /** What was ACTUALLY paid — the authored cost less any accumulated `manaDiscountOnUse` (state.ts effectiveManaCost). Read as the truth by the Battle Log's cost readout (buildBeats.ts). */
  manaSpent: number;
  /** How much of the authored cost this cast was let off, when a discount applied. Absent (not 0) on every move that has none, so nothing authored before Wave Shred changes shape. */
  manaDiscount?: number;
}

export interface DamageDealtEvent extends BaseEvent {
  type: 'DamageDealt';
  sourceCombatantId: string;
  targetCombatantId: string;
  moveId: string;
  amount: number;
  category: DamageCategory;
  moveType: TypeId;
  typeMult: number;
  isCrit: boolean;
  variance: number;
  /**
   * Every term of the locked damage formula (docs/combat.md "The damage
   * formula"), carried on the event purely for view-layer transparency — the
   * Battle Log's math readout (formatEvent.ts). The engine never reads these
   * back; `amount` above is the only value that actually applies to HP.
   */
  basePower: number;
  /** Elemental Force's contribution to this hit's BasePower (0 if none) — added to `basePower` BEFORE the ratio/STAB/TypeMult/Variance/Crit/multiplierTerm chain, unlike `modifiers`/multiplierTerm which scale the already-computed result (damagePipeline.ts resolveElementalForceBonus). */
  elementalForceBonus: number;
  /** The conditional-BasePower multiplier this hit actually got, 1 when none (damagePipeline.ts resolveConditionalPowerMultiplier — e.g. Immolate x3 into a Burned target). Scales `basePower` BEFORE `elementalForceBonus` is added on. */
  basePowerMultiplier: number;
  offStat: number;
  defStat: number;
  ratio: number;
  stab: number;
  critMultiplier: number;
  multiplierTerm: number;
  modifiers: readonly { source: string; amount: number }[];
  /**
   * Set when this target was added by a spread-trigger status (currently only
   * Haunt — statusEngine.ts expandSpreadTargets) rather than the move's own
   * TargetMode. Lets the view flag this hit as "dragged in by Haunt" instead
   * of reading like an ordinary spread move landing on both enemies.
   */
  viaStatusId?: StatusId;
  /**
   * Set when this move's damage body was NOT the damage formula but a share of
   * the attacker's own recently-taken damage (content.ts retributionPercent —
   * Stone's Retribution and Stoneheart). Carries the derivation the formula
   * fields cannot: how much was absorbed, and what fraction was returned.
   *
   * When present, every formula term above is its identity value (ratio, STAB,
   * TypeMult, variance, crit and multiplierTerm all 1, basePower 0) because the
   * formula genuinely was not evaluated — the Battle Log branches on this field
   * and prints the real derivation instead of a chain of 1x terms
   * (view/combat/formatEvent.ts). Same precedent as HealedEvent.drain, which
   * omits the healing formula's terms for the same reason.
   */
  retribution?: { damageTaken: number; percent: number };
  /**
   * Set on the self-inflicted hit a recoil move deals its own user
   * (content.ts recoilPercent — Stone's Rubble Rush). `sourceCombatantId` and
   * `targetCombatantId` are both the caster.
   *
   * The damage mirror of HealedEvent.drain, and like it the formula terms are
   * identity values: recoil scales a number that has already been through the
   * whole formula once, so running it again would be wrong and printing it
   * would be a readout of a calculation that never happened.
   */
  recoil?: { damageDealt: number; percent: number };
  /**
   * Set on the self-inflicted hit a move charges its own caster in HP
   * (content.ts selfHpCost — Spirit's Soul Offering and Last Rites).
   * `sourceCombatantId` and `targetCombatantId` are both the caster, exactly
   * like `recoil` above, and every formula term is likewise an identity value
   * because no formula was evaluated.
   *
   * Its own field rather than a third mode on `recoil` because the two bill
   * against different things and the Battle Log has to say which: recoil is a
   * share of a hit that landed, this is a share of the caster's own bar,
   * knowable before the move was pressed. Carries the authored mode so the
   * log can print "a quarter of its maximum" and "down to 1 HP" as the
   * different sentences they are.
   */
  selfCost?: { mode: SelfHpCost['mode']; amount: number };
}

export interface HpChangedEvent extends BaseEvent {
  type: 'HpChanged';
  combatantId: string;
  previousHp: number;
  newHp: number;
  maxHp: number;
}

export interface StatChangedEvent extends BaseEvent {
  type: 'StatChanged';
  combatantId: string;
  stat: string;
  delta: number;
  newValue: number;
}

export interface HealedEvent extends BaseEvent {
  type: 'Healed';
  sourceCombatantId: string;
  targetCombatantId: string;
  moveId: string;
  amount: number;
  /**
   * The formula's terms, carried the way DamageDealtEvent carries its own
   * (docs/combat.md "The healing formula"): `amount` is the rounded result,
   * these are how it got there, so the Battle Log can show the math without
   * re-deriving it.
   *
   * Absent on a DRAIN heal (see `drain` below), which does not run the healing
   * formula at all — printing a HealPower of 0 and a Wisdom multiplier of 1 for
   * it would be a readout of a formula that was never evaluated.
   */
  healPower?: number;
  wisdomMult?: number;
  stab?: number;
  /**
   * Present iff this heal came from a damage move's `drainPercent` rider
   * rather than from a heal-kind move. `targetCombatantId` is the drainer
   * itself; this says whose HP it came out of and how the number was reached.
   */
  drain?: { fromCombatantId: string; damageDealt: number; percent: number };
}

export interface StatusAppliedEvent extends BaseEvent {
  type: 'StatusApplied';
  combatantId: string;
  statusId: StatusId;
  magnitude?: number;
  duration?: number;
}

export interface StatusTickedEvent extends BaseEvent {
  type: 'StatusTicked';
  combatantId: string;
  statusId: StatusId;
  /** 'duration' = a Poison/Stealth round ticked off (Poison's `kind: 'damage'` tick fires separately on expiry). No HP change for a plain countdown tick. Daze no longer counts down: it is boolean and cleared wholesale at end of round (content.ts clearsAtEndOfRound), which emits StatusRemoved rather than a tick. */
  kind: 'damage' | 'heal' | 'duration';
  /** The HP amount this tick applied (pre-decay magnitude, or Bleed's flat %maxHp). 0 for kind 'duration'. */
  amount: number;
  /** Magnitude-shape statuses only: the value AFTER this tick's decay — what the view should replay onto combatant.statuses (a trailing StatusRemoved means it decayed to 0). */
  newMagnitude?: number;
  /** Duration-shape statuses only: the value AFTER this tick's countdown, mirroring newMagnitude. */
  newDuration?: number;
}

export interface StatusRemovedEvent extends BaseEvent {
  type: 'StatusRemoved';
  combatantId: string;
  statusId: StatusId;
  reason: StatusRemovalReason;
}

/**
 * A triggered status (currently only Conduct — docs/conditions.md) detonating:
 * bonus damage dealt on its own, separate from the hit that landed it. Kept
 * as its own event rather than folded into the triggering DamageDealt's
 * `amount` so the view can present it as a distinct beat with its own
 * indicator (resolveRound.ts applies this AFTER the base hit's HpChanged,
 * always immediately followed by StatusRemoved reason 'consumed' and its own
 * HpChanged/Fainted pair).
 */
export interface StatusDetonatedEvent extends BaseEvent {
  type: 'StatusDetonated';
  combatantId: string;
  statusId: StatusId;
  amount: number;
}

/**
 * A held Passive's reactive effect firing (engine/combat/passiveEngine.ts
 * resolvePassiveReactions) — kept as its own event, ahead of whatever
 * HpChanged/StatusApplied/StatChanged the effect itself produces, purely so
 * the view can attribute that state change to the passive rather than
 * showing an unexplained stat swing (same reasoning as StatusDetonatedEvent
 * above, generalized to any PassiveEffect kind instead of just damage). One
 * stack firing = one event, so N held stacks emit N of these in a row.
 */
export interface PassiveTriggeredEvent extends BaseEvent {
  type: 'PassiveTriggered';
  combatantId: string;
  passiveId: PassiveId;
}

export interface ActionBlockedEvent extends BaseEvent {
  type: 'ActionBlocked';
  combatantId: string;
  /**
   * 'noValidTarget': the action's declared target is no longer a legal
   * target when this action comes up in priority/speed order — e.g. two
   * attackers both declared against the same lone enemy and the first one's
   * hit already knocked it out. Declare-then-resolve means this is a normal
   * mid-round race, not a UI-preventable player error (resolveRound.ts).
   *
   * 'targetStatusMissing': the move carries a status targeting gate
   * (content.ts requiresTargetStatus — Frost's Glaciate/Absolute Zero) and
   * nothing it resolved against is carrying the status any more. Same
   * declare-then-resolve race as above with one extra cause: Stealth can
   * redirect a gated hit onto an unmarked partner, in which case it fizzles
   * rather than landing somewhere it was never allowed to go.
   *
   * 'switchBlocked': a move that sends its user out (content.ts
   * switchesUserOut — Storm's Tailwind) resolved while the side was locked in
   * (2+ KOs), or with no bench hero left to send in. Unlike the two reasons
   * above this does NOT mean the action fizzled: the move's own payload landed
   * and its mana was spent, and only the pivot half was refused.
   */
  reason: 'dazed' | 'noValidTarget' | 'targetStatusMissing' | 'switchBlocked';
}

export interface FaintedEvent extends BaseEvent {
  type: 'Fainted';
  combatantId: string;
  side: Side;
  koCount: number;
}

export interface SwitchedInEvent extends BaseEvent {
  type: 'SwitchedIn';
  side: Side;
  slot: 0 | 1;
  outCombatantId: string | null;
  inCombatantId: string;
}

export interface BenchRegenTickedEvent extends BaseEvent {
  type: 'BenchRegenTicked';
  combatantId: string;
  hpRegen: number;
  newHp: number;
  maxHp: number;
  /**
   * Always 0 — vestigial. Mana regen (docs/mana.md "Resolved": every round,
   * active + bench) turned out NOT to be bench-only like HP regen is, so it
   * couldn't reuse this bench-scoped event; it's its own tick emitting
   * ManaRegenTicked instead (engine/combat/manaRegen.ts). Field kept only for
   * event-shape stability.
   */
  manaRegen: number;
}

/**
 * A declared Rest action resolved (combat/actions.ts RestAction): the hero
 * forwent any move this round instead. Always immediately followed by a
 * ManaChanged carrying the actual before/full-pool value — this event exists
 * purely so the log/beats can say "X rests" rather than reporting a bare mana
 * jump with no cause.
 */
export interface RestedEvent extends BaseEvent {
  type: 'Rested';
  combatantId: string;
}

export interface ManaChangedEvent extends BaseEvent {
  type: 'ManaChanged';
  combatantId: string;
  previousMana: number;
  newMana: number;
  maxMana: number;
}

/**
 * One combatant hands another flat mana (content.ts MoveDefinition.manaGrant —
 * Arcane's Infuse, Empower, Conduit, Font of Power).
 *
 * Its own event rather than a bare ManaChanged, for the same reason a drain is
 * emitted as a Healed pointing back at its own caster: ManaChanged is
 * deliberately omitted from the Battle Log as bookkeeping (view/combat/
 * formatEvent.ts), and a mana jump with no named source would be both
 * invisible in the log and unattributable in the beat stream. This one IS the
 * move's entire payload.
 *
 * `newMana` may exceed `maxMana` — that is the whole point of the mechanic
 * (state.ts Combatant.currentMana, docs/mana.md "Overflow"). `overflow` is the
 * surplus above the pool AFTER the grant, carried so the view can say
 * "overcharged" without re-deriving it from a hero lookup it may not have.
 */
export interface ManaGrantedEvent extends BaseEvent {
  type: 'ManaGranted';
  sourceCombatantId: string;
  targetCombatantId: string;
  moveId: string;
  /** The mana actually added. Never clamped — a full-pool target receives all of it. */
  amount: number;
  previousMana: number;
  newMana: number;
  maxMana: number;
  /** `max(0, newMana - maxMana)` — 0 when the grant stayed inside the pool. */
  overflow: number;
}

/**
 * Mana regen at the round boundary (engine/combat/manaRegen.ts), self-
 * contained like BenchRegenTicked rather than paired with a generic
 * ManaChanged — applies to active AND benched combatants alike (docs/mana.md
 * "Resolved": every round, active + bench), unlike bench-only HP regen.
 */
export interface ManaRegenTickedEvent extends BaseEvent {
  type: 'ManaRegenTicked';
  combatantId: string;
  manaRegen: number;
  newMana: number;
  maxMana: number;
}

/**
 * A Field Effect (docs/field-effects.md) is set on the battlefield — either
 * newly (previousFieldEffectId null) or overriding a different one that was
 * already active (previousFieldEffectId set, and its clock is discarded, not
 * merged). Never emitted for a no-op re-application of the already-active
 * effect (engine/combat/fieldEffectEngine.ts setFieldEffect).
 */
export interface FieldEffectSetEvent extends BaseEvent {
  type: 'FieldEffectSet';
  fieldEffectId: FieldEffectId;
  previousFieldEffectId: FieldEffectId | null;
}

/** The active Field Effect's end-of-round countdown ticked down but didn't reach 0 — mirrors StatusTicked's duration-kind shape. */
export interface FieldEffectTickedEvent extends BaseEvent {
  type: 'FieldEffectTicked';
  fieldEffectId: FieldEffectId;
  roundsRemaining: number;
}

/** The active Field Effect's countdown reached 0 and it cleared — mirrors StatusRemoved. */
export interface FieldEffectExpiredEvent extends BaseEvent {
  type: 'FieldEffectExpired';
  fieldEffectId: FieldEffectId;
}

export interface RoundEndedEvent extends BaseEvent {
  type: 'RoundEnded';
}

export type CombatEvent =
  | RoundStartedEvent
  | TurnStartedEvent
  | MoveDeclaredEvent
  | MoveUsedEvent
  | DamageDealtEvent
  | HealedEvent
  | HpChangedEvent
  | StatChangedEvent
  | StatusAppliedEvent
  | StatusTickedEvent
  | StatusRemovedEvent
  | StatusDetonatedEvent
  | PassiveTriggeredEvent
  | ActionBlockedEvent
  | FaintedEvent
  | SwitchedInEvent
  | BenchRegenTickedEvent
  | RestedEvent
  | ManaChangedEvent
  | ManaGrantedEvent
  | ManaRegenTickedEvent
  | FieldEffectSetEvent
  | FieldEffectTickedEvent
  | FieldEffectExpiredEvent
  | RoundEndedEvent;
