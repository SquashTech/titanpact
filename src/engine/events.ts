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
import type { StatusId, StatusRemovalReason, TypeId } from './content';

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
  manaSpent: number;
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
  offStat: number;
  defStat: number;
  ratio: number;
  stab: number;
  critMultiplier: number;
  multiplierTerm: number;
  modifiers: readonly { source: string; amount: number }[];
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
  /** 'duration' = a Daze/Bind round ticked off, no HP change. */
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

export interface ActionBlockedEvent extends BaseEvent {
  type: 'ActionBlocked';
  combatantId: string;
  /**
   * 'noValidTarget': the action's declared target is no longer a legal
   * target when this action comes up in priority/speed order — e.g. two
   * attackers both declared against the same lone enemy and the first one's
   * hit already knocked it out. Declare-then-resolve means this is a normal
   * mid-round race, not a UI-preventable player error (resolveRound.ts).
   */
  reason: 'dazed' | 'bound' | 'noValidTarget';
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
  | ActionBlockedEvent
  | FaintedEvent
  | SwitchedInEvent
  | BenchRegenTickedEvent
  | RestedEvent
  | ManaChangedEvent
  | ManaRegenTickedEvent
  | RoundEndedEvent;
