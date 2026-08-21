// Combat state (docs/architecture.md "State shapes (three tiers)").
// This module covers the COMBAT tier only: the current fight. Run state
// (roster, equipment, relics, progression pool) and meta state (whatever
// survives a run) are separate, longer-lived tiers that build on this one —
// out of scope for this engine slice. Do not fold them in here.

import type { FieldEffectId, HeroDefinition, MoveDefinition, PassiveId, StatKey, StatLine, StatusId, TypeId } from './content';
import type { RngState } from './rng/seededRng';

export type Side = 'A' | 'B';
export type ActiveSlotIndex = 0 | 1;
export type DamageCategory = 'physical' | 'magical';

/** Freeze halves Speed (docs/conditions.md) — see getEffectiveStat below. */
const FREEZE_STATUS_ID = 'Freeze';

/**
 * A single active status on a combatant (docs/conditions.md §1 "The Three
 * Shapes"). `magnitude` is used by magnitude-shape statuses, `duration` by
 * duration-shape; boolean-shape statuses use neither (presence is the whole
 * signal).
 */
export interface StatusInstance {
  statusId: StatusId;
  magnitude?: number;
  duration?: number;
}

/**
 * A held Passive (engine/content.ts PassiveDefinition) — `stacks` counts how
 * many independent grants (equipment + relics + Evolution combined,
 * src/run/passives.ts collectPassiveGrants) this combatant currently holds of
 * it. No per-passive stacking config (unlike StatusStacking): N stacks always
 * means the effect resolves N independent times (passiveEngine.ts) — this
 * composes correctly for free for damage modifiers via the damage pipeline's
 * already-locked multiplicative stacking.
 */
export interface PassiveInstance {
  passiveId: PassiveId;
  stacks: number;
}

/**
 * Flat additive stat modifiers only (docs/combat.md "Stat modifiers") —
 * never percentage-based, never VGC-style stages.
 *
 * Persistence on switch is LOCKED (docs/combat.md, 2026-08-15): mods persist.
 * Attaching modifiers to the Combatant record (not the active slot) is what
 * that requires, and is now the settled design, not just a placement choice.
 */
export type StatModifiers = Partial<Record<StatKey, number>>;

export interface Combatant {
  combatantId: string;
  heroId: string;
  side: Side;
  currentHp: number;
  currentMana: number;
  /**
   * Flat stat grants from equipment, relics, Evolution, and Class Passives
   * (src/run/buildCombatState.ts placeEntry) — established once at fight
   * build time and never mutated during the fight. Kept separate from
   * `statModifiers` (below) so the view layer can tell "this hero's loadout"
   * apart from "a move buffed/debuffed this hero this fight" — the former
   * enhances the hero's effective BST and should read as part of their base
   * stat block, not as a temporary combat indicator.
   */
  baselineStatModifiers: StatModifiers;
  /** Flat additive stat deltas applied DURING the fight (move/passive effects) — never touched by buildCombatState. Starts empty every fight; see StatModifiers doc comment for the persist-on-switch rule. */
  statModifiers: StatModifiers;
  /**
   * Types granted on top of HeroDefinition.types by a chosen type-graft
   * Evolution path (docs/progression.md "Type-graft paths"). Empty for a
   * hero that hasn't grafted (including every mono hero that stays mono).
   * The authored HeroDefinition.types never changes — this is combat-tier
   * data carrying a run-tier grant across the seam, the same pattern
   * statModifiers already uses for equipment/Evolution stat grants.
   */
  grantedTypes: readonly TypeId[];
  /**
   * Magnitude-shape status grants from equipment/relics (Elemental Force —
   * src/run/statusGrants.ts) baked into `statuses` at fight-build time —
   * recorded here too so the view layer can net them back out of a status's
   * displayed magnitude, the same "loadout, not a combat indicator" split as
   * baselineStatModifiers above. Never mutated during the fight.
   */
  baselineStatusMagnitudes: Partial<Record<StatusId, number>>;
  /** Active statuses, keyed by StatusId — a status either isn't present or is one instance of it (docs/conditions.md: no status stacks as multiple independent instances). */
  statuses: Record<StatusId, StatusInstance>;
  /** Held Passives, keyed by PassiveId — populated once at fight-build time from equipment/relic/Evolution grants (src/run/passives.ts, buildCombatState.ts placeEntry). Unlike statuses, never changes mid-fight in this engine slice — nothing currently grants or removes a Passive during combat. */
  passives: Record<PassiveId, PassiveInstance>;
  fainted: boolean;
}

/** A Field Effect currently on the battlefield (docs/field-effects.md) — global, not per-side; only one may be active at once. */
export interface ActiveFieldEffect {
  fieldEffectId: FieldEffectId;
  /** Counts down at the end of every round (engine/combat/fieldEffectEngine.ts); the effect clears when this reaches 0. */
  roundsRemaining: number;
}

export interface CombatState {
  seed: number;
  rngState: RngState;
  round: number;
  /** Two slots per side; null means the slot is empty and awaiting forced replacement. */
  active: Record<Side, [string | null, string | null]>;
  bench: Record<Side, string[]>;
  combatants: Record<string, Combatant>;
  koCount: Record<Side, number>;
  /** null when no Field Effect is active. */
  activeFieldEffect: ActiveFieldEffect | null;
}

/**
 * Lock-in rule (LOCKED, docs/combat.md): once a side has 2+ KOs, voluntary
 * switching is disabled for that side. This is the single rule — do not layer
 * additional switch restrictions on top of it.
 */
export function isLockedIn(state: CombatState, side: Side): boolean {
  return state.koCount[side] >= 2;
}

/**
 * Legality query (docs/mana.md "Engine placement": "Never gate a move's
 * legality in the view ... legality is an engine decision surfaced as
 * state"): can `currentMana` afford at least one of `moveIds`? Callers pass
 * in whichever move-id list is authoritative for the caller (a hero's
 * currently-unlocked kit, run-tier) — this stays a pure mana/cost check with
 * no opinion on where that list comes from. Used to decide when a hero must
 * fall back to Rest (see RestAction, combat/actions.ts) because nothing else
 * is affordable.
 */
export function hasAffordableMove(currentMana: number, moveIds: readonly string[], moves: Record<string, MoveDefinition>): boolean {
  return moveIds.some((id) => currentMana >= moves[id].manaCost);
}

export function getEffectiveStat(
  hero: HeroDefinition,
  combatant: Combatant,
  stat: StatKey
): number {
  const base = hero.baseStats[stat];
  const modifier = (combatant.baselineStatModifiers[stat] ?? 0) + (combatant.statModifiers[stat] ?? 0);
  const raw = base + modifier;

  // Freeze (docs/conditions.md): halves Speed. Boolean-shape — presence is
  // the whole signal, no magnitude to read.
  if (stat === 'speed' && hasStatus(combatant, FREEZE_STATUS_ID)) {
    return Math.floor(raw / 2);
  }

  return raw;
}

export function hasStatus(combatant: Combatant, statusId: StatusId): boolean {
  return combatant.statuses[statusId] !== undefined;
}

/** 0 if the status is absent or has no magnitude (boolean/duration shapes) — docs/conditions.md §5 Status-Query Layer. */
export function statusMagnitude(combatant: Combatant, statusId: StatusId): number {
  return combatant.statuses[statusId]?.magnitude ?? 0;
}

/**
 * How much a stat's current effective value differs from the hero's
 * loadout baseline (base stats + baselineStatModifiers) — i.e. the part
 * contributed purely by this fight (move/passive stat deltas, and effects
 * like Freeze's Speed halving). Used by the view layer to badge only
 * temporary combat buffs/debuffs, not the hero's equipped stat block.
 */
export function getCombatStatDelta(hero: HeroDefinition, combatant: Combatant, stat: StatKey): number {
  const baseline = hero.baseStats[stat] + (combatant.baselineStatModifiers[stat] ?? 0);
  return getEffectiveStat(hero, combatant, stat) - baseline;
}

export function getMaxHp(hero: HeroDefinition, combatant: Combatant): number {
  return getEffectiveStat(hero, combatant, 'hp');
}

export function getMaxMana(hero: HeroDefinition, combatant: Combatant): number {
  return getEffectiveStat(hero, combatant, 'manaPool');
}

/**
 * Starting mana is LOCKED (docs/mana.md "Resolved", 2026-08-15): full pool.
 * This factory still takes startingHp/startingMana explicitly from the caller
 * rather than defaulting internally — callers (buildCombatState.ts, test
 * fixtures) are the ones that apply "full," computed after equipment/Evolution
 * grants, so a +HP/+Mana item actually starts the fight topped up.
 */
export function createCombatant(
  combatantId: string,
  heroId: string,
  side: Side,
  startingHp: number,
  startingMana: number
): Combatant {
  return {
    combatantId,
    heroId,
    side,
    currentHp: startingHp,
    currentMana: startingMana,
    baselineStatModifiers: {},
    statModifiers: {},
    grantedTypes: [],
    baselineStatusMagnitudes: {},
    statuses: {},
    passives: {},
    fainted: false,
  };
}

export type HeroLookup = Record<string, HeroDefinition>;

export function statLineFrom(hero: HeroDefinition): StatLine {
  return hero.baseStats;
}

/**
 * A combatant's types for combat purposes (STAB, being the target of
 * TypeMult): innate HeroDefinition.types plus any type-graft grant
 * (docs/progression.md "Type-graft branches"). Never mutates or reads back
 * into HeroDefinition — the innate type stays immutable authored content.
 */
export function effectiveTypes(hero: HeroDefinition, combatant: Combatant): readonly TypeId[] {
  return [...hero.types, ...combatant.grantedTypes];
}
