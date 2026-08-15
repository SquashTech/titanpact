// Combat state (docs/architecture.md "State shapes (three tiers)").
// This module covers the COMBAT tier only: the current fight. Run state
// (roster, equipment, relics, progression pool) and meta state (whatever
// survives a run) are separate, longer-lived tiers that build on this one —
// out of scope for this engine slice. Do not fold them in here.

import type { HeroDefinition, StatKey, StatLine } from './content';
import type { RngState } from './rng/seededRng';

export type Side = 'A' | 'B';
export type ActiveSlotIndex = 0 | 1;
export type DamageCategory = 'physical' | 'magical';

/**
 * Flat additive stat modifiers only (docs/combat.md "Stat modifiers") —
 * never percentage-based, never VGC-style stages.
 *
 * 🔒 OPEN (docs/combat.md): whether these persist or reset on switch is
 * unresolved. The prototype persists them; this state shape keeps modifiers
 * attached to the Combatant record (not the active slot), which is what
 * "persist through switch" requires. If the designer call goes the other way,
 * the reset behavior is a one-line change in switching.ts — do not treat this
 * placement as the decision itself.
 */
export type StatModifiers = Partial<Record<StatKey, number>>;

export interface Combatant {
  combatantId: string;
  heroId: string;
  side: Side;
  currentHp: number;
  currentMana: number;
  statModifiers: StatModifiers;
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
 * 🔒 OPEN (docs/mana.md "Starting state"): how much mana a hero starts a fight
 * with is unresolved. This factory takes startingHp/startingMana explicitly
 * from the caller rather than defaulting to "full" — do not add a default
 * here that bakes in an assumption.
 */
export function createCombatant(
  combatantId: string,
  heroId: string,
  side: Side,
  startingHp: number,
  startingMana: number
): Combatant {
  return { combatantId, heroId, side, currentHp: startingHp, currentMana: startingMana, statModifiers: {}, fainted: false };
}

export type HeroLookup = Record<string, HeroDefinition>;

export function statLineFrom(hero: HeroDefinition): StatLine {
  return hero.baseStats;
}
