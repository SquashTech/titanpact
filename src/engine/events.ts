// The event contract (docs/architecture.md): typed, serializable, replayable plain data.
// One event = one thing that happened (DamageDealt and Fainted are always separate, even on a lethal hit).

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
  /** What was actually paid (state.ts effectiveManaCost). */
  manaSpent: number;
  /** The discount applied, when any. Absent (not 0) otherwise. */
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
  // Formula terms below are carried for the Battle Log's math readout (formatEvent.ts); the engine only applies `amount`.
  basePower: number;
  /** Elemental Force's addition to basePower (0 if none), added BEFORE the multiplier chain. */
  elementalForceBonus: number;
  /** conditionalPower's multiplier, 1 when none. Applied to basePower BEFORE elementalForceBonus is added. */
  basePowerMultiplier: number;
  offStat: number;
  defStat: number;
  ratio: number;
  stab: number;
  critMultiplier: number;
  multiplierTerm: number;
  modifiers: readonly { source: string; amount: number }[];
  /** Set when this target was added by a spread-trigger status (Haunt) rather than the move's own TargetMode. */
  viaStatusId?: StatusId;
  /** Set when the damage body was retributionPercent; every formula term is then its identity value (basePower 0). */
  retribution?: { damageTaken: number; percent: number };
  /** The self-inflicted recoil hit (recoilPercent): source and target are both the caster; formula terms are identity values. */
  recoil?: { damageDealt: number; percent: number };
  /** The self-inflicted selfHpCost hit — same shape as `recoil`, carrying the authored mode. */
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
  // Healing-formula terms for the log. Absent on a drain heal, which never ran the formula.
  healPower?: number;
  wisdomMult?: number;
  stab?: number;
  /** Present iff this heal came from a drainPercent rider. `targetCombatantId` is the drainer; this says whose HP it came from. */
  drain?: { fromCombatantId: string; damageDealt: number; percent: number };
}

export interface StatusAppliedEvent extends BaseEvent {
  type: 'StatusApplied';
  combatantId: string;
  /** The mover for a rider, the owner for a passive. Absent = nobody in particular; a source-role passive never matches it. */
  sourceCombatantId?: string;
  statusId: StatusId;
  magnitude?: number;
  duration?: number;
}

export interface StatusTickedEvent extends BaseEvent {
  type: 'StatusTicked';
  combatantId: string;
  statusId: StatusId;
  /** 'duration' = a countdown tick (Poison/Stealth), no HP change. Daze never ticks — it is cleared wholesale at end of round. */
  kind: 'damage' | 'heal' | 'duration';
  /** HP applied by this tick (pre-decay magnitude, or Bleed's flat %). 0 for 'duration'. */
  amount: number;
  /** Magnitude-shape only: the value AFTER decay (a trailing StatusRemoved means it reached 0). */
  newMagnitude?: number;
  /** Duration-shape only: the value AFTER the countdown. */
  newDuration?: number;
}

export interface StatusRemovedEvent extends BaseEvent {
  type: 'StatusRemoved';
  combatantId: string;
  statusId: StatusId;
  reason: StatusRemovalReason;
}

/** A triggered status (Conduct) detonating — after the base hit's HpChanged, always followed by StatusRemoved 'consumed' and its own HpChanged/Fainted. */
export interface StatusDetonatedEvent extends BaseEvent {
  type: 'StatusDetonated';
  combatantId: string;
  statusId: StatusId;
  amount: number;
}

/** A held passive's reaction firing, emitted ahead of the state changes it produces. One per stack. */
export interface PassiveTriggeredEvent extends BaseEvent {
  type: 'PassiveTriggered';
  combatantId: string;
  passiveId: PassiveId;
}

export interface ActionBlockedEvent extends BaseEvent {
  type: 'ActionBlocked';
  combatantId: string;
  /** 'noValidTarget': declared target no longer legal. 'targetStatusMissing': requiresTargetStatus unmet. 'switchBlocked': switchesUserOut pivot refused by lock-in or an empty bench — payload still landed, mana spent. */
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
  /** Always 0 — vestigial; mana regen is ManaRegenTicked. Kept for event-shape stability. */
  manaRegen: number;
}

/** A declared Rest resolved. Always followed by the ManaChanged carrying the refill. */
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

/** A manaGrant landing — its own event because ManaChanged is omitted from the Battle Log. `newMana` may exceed `maxMana` (docs/mana.md "Overflow"). */
export interface ManaGrantedEvent extends BaseEvent {
  type: 'ManaGranted';
  sourceCombatantId: string;
  targetCombatantId: string;
  moveId: string;
  /** Never clamped — a full-pool target receives all of it. */
  amount: number;
  previousMana: number;
  newMana: number;
  maxMana: number;
  /** `max(0, newMana - maxMana)`. */
  overflow: number;
}

/** Round-boundary mana regen (manaRegen.ts), active and bench alike. */
export interface ManaRegenTickedEvent extends BaseEvent {
  type: 'ManaRegenTicked';
  combatantId: string;
  manaRegen: number;
  newMana: number;
  maxMana: number;
}

/** A Field Effect set newly (previous null) or overriding another. Never emitted for a no-op re-application. */
export interface FieldEffectSetEvent extends BaseEvent {
  type: 'FieldEffectSet';
  fieldEffectId: FieldEffectId;
  previousFieldEffectId: FieldEffectId | null;
}

/** The active Field Effect's countdown ticked but did not reach 0. */
export interface FieldEffectTickedEvent extends BaseEvent {
  type: 'FieldEffectTicked';
  fieldEffectId: FieldEffectId;
  roundsRemaining: number;
}

/** The active Field Effect's countdown reached 0 and it cleared. */
export interface FieldEffectExpiredEvent extends BaseEvent {
  type: 'FieldEffectExpired';
  fieldEffectId: FieldEffectId;
}

/** The Pact Clock coming due (pactClock.ts) — one beat for the whole board, before the HpChanged/Fainted stream it causes. */
export interface PactTickedEvent extends BaseEvent {
  type: 'PactTicked';
  /** Rounds past the clock's start round — 0 on the first tick. */
  step: number;
  /** Fraction of max HP every combatant loses on this tick (0.1 = 10%). */
  fraction: number;
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
  | PactTickedEvent
  | RoundEndedEvent;
