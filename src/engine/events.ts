// The event contract (docs/architecture.md "The event contract").
// Typed, serializable, replayable records. Plain data only — no functions, no
// class instances, no references the view has to resolve back into engine
// state. One event = one thing that happened (DamageDealt and Fainted are
// always separate, even on a lethal hit).
//
// This is the PROPOSED canonical set from docs/architecture.md, reconciled
// against the two locked pipelines and the combat/switching/KO rules in
// docs/combat.md. Status events are BLOCKED on the sixth engine contract
// (condition vocabulary — still unspecified) and are intentionally absent.
// Do not add them speculatively.

import type { Side, DamageCategory } from './state';
import type { TypeId } from './content';

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
   * Always 0 in this engine slice. Mana bench regen cadence is now LOCKED
   * (docs/mana.md "Resolved": every round, active + bench) but the regen tick
   * itself isn't implemented yet (see switching.ts applyBenchHpRegen). Field
   * kept ready for when that lands.
   */
  manaRegen: number;
}

export interface ManaChangedEvent extends BaseEvent {
  type: 'ManaChanged';
  combatantId: string;
  previousMana: number;
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
  | HpChangedEvent
  | StatChangedEvent
  | FaintedEvent
  | SwitchedInEvent
  | BenchRegenTickedEvent
  | ManaChangedEvent
  | RoundEndedEvent;
