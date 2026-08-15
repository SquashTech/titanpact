// Combat state (docs/architecture.md "State shapes (three tiers)").
// This module covers the COMBAT tier only: the current fight. Run state
// (roster, equipment, relics, progression pool) and meta state (whatever
// survives a run) are separate, longer-lived tiers that build on this one —
// out of scope for this engine slice. Do not fold them in here.

import type { HeroDefinition, StatKey, StatLine, TypeId } from './content';
import type { RngState } from './rng/seededRng';

export type Side = 'A' | 'B';
export type ActiveSlotIndex = 0 | 1;
export type DamageCategory = 'physical' | 'magical';

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
  statModifiers: StatModifiers;
  /**
   * Types granted on top of HeroDefinition.types by a chosen type-graft
   * rank-up branch (docs/progression.md "Type-graft branches"). Empty for a
   * hero that hasn't grafted (including every mono hero that stays mono).
   * The authored HeroDefinition.types never changes — this is combat-tier
   * data carrying a run-tier grant across the seam, the same pattern
   * statModifiers already uses for equipment/rank-up stat grants.
   */
  grantedTypes: readonly TypeId[];
  fainted: boolean;
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
}

/**
 * Lock-in rule (LOCKED, docs/combat.md): once a side has 2+ KOs, voluntary
 * switching is disabled for that side. This is the single rule — do not layer
 * additional switch restrictions on top of it.
 */
export function isLockedIn(state: CombatState, side: Side): boolean {
  return state.koCount[side] >= 2;
}

export function getEffectiveStat(
  hero: HeroDefinition,
  combatant: Combatant,
  stat: StatKey
): number {
  const base = hero.baseStats[stat];
  const modifier = combatant.statModifiers[stat] ?? 0;
  return base + modifier;
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
 * fixtures) are the ones that apply "full," computed after equipment/rank-up
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
    statModifiers: {},
    grantedTypes: [],
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
