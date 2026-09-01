// Combat state — the COMBAT tier only (docs/architecture.md "State shapes"). Run and meta state are separate tiers.

import type { FieldEffectDefinition, FieldEffectId, HeroDefinition, MoveDefinition, PassiveDefinition, PassiveId, StatKey, StatusId, TargetMode, TypeId } from './content';
import { nextRange, type RngState } from './rng/seededRng';

export type Side = 'A' | 'B';
export type DamageCategory = 'physical' | 'magical';

/** Freeze halves Speed — see getEffectiveStat. */
const FREEZE_STATUS_ID = 'Freeze';

/** One active status. `magnitude` for magnitude-shape, `duration` for duration-shape; boolean-shape uses neither. */
export interface StatusInstance {
  statusId: StatusId;
  magnitude?: number;
  duration?: number;
}

/** A held Passive. `stacks` = independent grants held; N stacks always resolve N times. */
export interface PassiveInstance {
  passiveId: PassiveId;
  stacks: number;
  /** Set once a `reactive.oncePerFight` passive has fired — the only field on a held passive that changes mid-fight. */
  firedThisFight?: boolean;
}

/** Flat additive only — never % or stages. Locked: mods persist on switch, so they live on the Combatant, not the slot. */
export type StatModifiers = Partial<Record<StatKey, number>>;

export interface Combatant {
  combatantId: string;
  heroId: string;
  side: Side;
  currentHp: number;
  /** May exceed getMaxMana — grants overflow, uncapped and sticky (docs/mana.md "Overflow"). Regen and Rest never LOWER it. */
  currentMana: number;
  /** Loadout grants (equipment, relics, Evolution, Class), set once at fight build and never mutated — kept apart from `statModifiers` so the view can tell the stat block from what this fight did to it. */
  baselineStatModifiers: StatModifiers;
  /** Flat deltas applied DURING the fight; starts empty every fight. */
  statModifiers: StatModifiers;
  /** Type-graft Evolution grants on top of HeroDefinition.types (which never changes). */
  grantedTypes: readonly TypeId[];
  /** Equipment/relic status grants (Elemental Force) baked into `statuses` at build, recorded so the view can net them out. Never mutated. */
  baselineStatusMagnitudes: Partial<Record<StatusId, number>>;
  /** One instance per status id — never stacked as multiple instances. */
  statuses: Record<StatusId, StatusInstance>;
  /** Accumulated manaDiscountOnUse per move id; grows only within a fight. Read via effectiveManaCost. */
  moveManaDiscounts: Partial<Record<string, number>>;
  /** HP lost since this combatant last COMMITTED an action (paid move, Rest, completed switch); a Dazed or fizzled turn keeps banking. Incremented in applyHpDelta. Feeds retributionPercent. */
  damageTakenSinceLastTurn: number;
  /** Populated once at fight build (src/run/passives.ts); only `firedThisFight` changes mid-fight. */
  passives: Record<PassiveId, PassiveInstance>;
  fainted: boolean;
}

/** The one global Field Effect (docs/field-effects.md). */
export interface ActiveFieldEffect {
  fieldEffectId: FieldEffectId;
  /** Counts down at end of round; clears at 0. */
  roundsRemaining: number;
}

export interface CombatState {
  seed: number;
  rngState: RngState;
  round: number;
  /** Two slots per side; null = empty, awaiting forced replacement. */
  active: Record<Side, [string | null, string | null]>;
  bench: Record<Side, string[]>;
  combatants: Record<string, Combatant>;
  koCount: Record<Side, number>;
  /** null when no Field Effect is active. */
  activeFieldEffect: ActiveFieldEffect | null;
}

/** Locked: 2+ KOs disables voluntary switching. The single switch restriction — do not layer more on it. */
export function isLockedIn(state: CombatState, side: Side): boolean {
  return state.koCount[side] >= 2;
}

/** Pure mana check against the caller's authoritative move list; drives the Rest fallback. */
export function hasAffordableMove(
  currentMana: number,
  moveIds: readonly string[],
  moves: Record<string, MoveDefinition>,
  /** Combatant.moveManaDiscounts; omit and every move is priced at its authored cost. */
  discounts?: Partial<Record<string, number>>
): boolean {
  return moveIds.some((id) => currentMana >= effectiveManaCost(moves[id], discounts));
}

/** Authored cost less accumulated discount, floored at 0. The single source of a move's price on fight-free surfaces — never read `move.manaCost` directly for display. */
export function effectiveManaCost(move: MoveDefinition, discounts?: Partial<Record<string, number>>): number {
  return Math.max(0, move.manaCost - (discounts?.[move.id] ?? 0));
}

/** effectiveManaCost plus conditionalManaCost (the lower wins) — the price EVERY live-fight surface must read. Enemy-side forms read ACTIVE unfainted enemies; an empty enemy side satisfies neither. */
export function resolveManaCost(
  state: CombatState,
  combatantId: string,
  move: MoveDefinition,
  /** Needed only by the requiresPartnerType side; omit and that side never fires. */
  heroes?: Record<string, HeroDefinition>
): number {
  const combatant = state.combatants[combatantId];
  const base = effectiveManaCost(move, combatant?.moveManaDiscounts);
  const conditional = move.conditionalManaCost;
  if (!conditional || !combatant) return base;

  // Ally-side form first: a wiped enemy side must not swallow a discount that reads the caster's own row.
  if (conditional.requiresPartnerType != null) {
    if (!heroes) return base;
    const partnerTypes = activePartnerTypes(state, combatantId, heroes);
    if (!partnerTypes?.includes(conditional.requiresPartnerType)) return base;
    return Math.min(base, Math.max(0, conditional.manaCost));
  }

  const enemySide: Side = combatant.side === 'A' ? 'B' : 'A';
  const activeEnemies = state.active[enemySide]
    .map((id) => (id ? state.combatants[id] : undefined))
    .filter((c): c is Combatant => c != null && !c.fainted);

  if (activeEnemies.length === 0) return base;

  const all = conditional.requiresAllEnemiesStatus;
  const any = conditional.requiresAnyEnemyStatus;
  const met =
    all != null
      ? activeEnemies.every((enemy) => hasStatus(enemy, all))
      : any != null
        ? activeEnemies.some((enemy) => hasStatus(enemy, any))
        : false; // authored neither: a silent dud, never a free cast
  if (!met) return base;
  return Math.min(base, Math.max(0, conditional.manaCost));
}

/** Board-aware target mode (MoveDefinition.conditionalTarget); `move.target` stays what the player declares against. */
export function resolveTargetMode(state: CombatState, move: MoveDefinition): TargetMode {
  const conditional = move.conditionalTarget;
  if (!conditional) return move.target;
  return state.activeFieldEffect?.fieldEffectId === conditional.requiresFieldEffect ? conditional.target : move.target;
}

/** FNV-1a mix of a string into a 32-bit seed — spreads ids across the seed space, not a randomness source. */
function mixString(seed: number, text: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h = (h ^ text.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** This round's rolled BasePower for a randomBasePower move. DERIVED from (seed, round, combatantId, moveId) — never stored, never advances rngState — so engine and view agree and replays stay byte-identical. */
export function resolveRandomBasePower(
  state: CombatState,
  combatantId: string,
  move: MoveDefinition
): number | undefined {
  const roll = move.randomBasePower;
  if (!roll) return undefined;
  const seeded = mixString(mixString((state.seed ^ Math.imul(state.round, 0x9e3779b1)) >>> 0, combatantId), move.id);
  // +1 on the ceiling so every integer in [min, max] is equally likely.
  return Math.min(roll.max, Math.floor(nextRange(seeded, roll.min, roll.max + 1).value));
}

/** hasAffordableMove's board-aware counterpart — the Rest fallback must agree with what the button costs. */
export function hasAffordableMoveInFight(
  state: CombatState,
  combatantId: string,
  moveIds: readonly string[],
  moves: Record<string, MoveDefinition>,
  /** Threaded to resolveManaCost; omit and a requiresPartnerType price reads at its authored cost. */
  heroes?: Record<string, HeroDefinition>
): boolean {
  const currentMana = state.combatants[combatantId]?.currentMana ?? 0;
  return moveIds.some((id) => currentMana >= resolveManaCost(state, combatantId, moves[id], heroes));
}

/** Effective types of the caster's ACTIVE partner, or null when the slot is empty or fainted — the one reader of every requiresPartnerType condition. Bench never counts; grafts do. */
export function activePartnerTypes(
  state: CombatState,
  combatantId: string,
  heroes: Record<string, HeroDefinition>
): readonly TypeId[] | null {
  const combatant = state.combatants[combatantId];
  if (!combatant) return null;
  const partnerId = state.active[combatant.side].find((id) => id != null && id !== combatantId);
  if (!partnerId) return null;
  const partner = state.combatants[partnerId];
  if (!partner || partner.fainted) return null;
  const hero = heroes[partner.heroId];
  return hero ? effectiveTypes(hero, partner) : null;
}

/** What getEffectiveStat needs beyond hero + combatant; omit entirely and neither board hook applies. `board` carries whole state because one context is shared by attacker and defender and "enemy" is resolved per combatant. */
export interface StatContext {
  active: ActiveFieldEffect | null;
  defs: Record<string, FieldEffectDefinition>;
  board?: { state: CombatState; passives: Record<PassiveId, PassiveDefinition> };
}

/** Older name for StatContext; kept for existing call sites. */
export type FieldEffectContext = StatContext;

/** Any living, ACTIVE combatant opposing `side` carries `statusId`. */
function anyActiveEnemyHasStatus(state: CombatState, side: Side, statusId: StatusId): boolean {
  const enemySide: Side = side === 'A' ? 'B' : 'A';
  return state.active[enemySide].some((id) => {
    const enemy = id ? state.combatants[id] : undefined;
    return !!enemy && !enemy.fainted && hasStatus(enemy, statusId);
  });
}

export function getEffectiveStat(
  hero: HeroDefinition,
  combatant: Combatant,
  stat: StatKey,
  fieldEffectCtx?: FieldEffectContext
): number {
  const base = hero.baseStats[stat];
  const modifier = (combatant.baselineStatModifiers[stat] ?? 0) + (combatant.statModifiers[stat] ?? 0);
  let raw = base + modifier;

  // Freeze halves Speed (boolean-shape — presence is the signal).
  if (stat === 'speed' && hasStatus(combatant, FREEZE_STATUS_ID)) {
    raw = Math.floor(raw / 2);
  }

  // Field Effect statBonusEqualToStatusMagnitude (Verdant Earth): live magnitude, 0 when not carried.
  const statusBonus = fieldEffectCtx?.active
    ? fieldEffectCtx.defs[fieldEffectCtx.active.fieldEffectId]?.statBonusEqualToStatusMagnitude
    : undefined;
  if (statusBonus?.stats.includes(stat)) {
    raw += statusMagnitude(combatant, statusBonus.statusId);
  }

  // Conditional passive grants (Bloodthirsty), read live so nothing has to revoke them. N stacks resolve N times.
  if (fieldEffectCtx?.board) {
    for (const instance of Object.values(combatant.passives)) {
      const conditional = fieldEffectCtx.board.passives[instance.passiveId]?.conditionalStatGrants;
      const amount = conditional?.statGrants[stat];
      if (!conditional || !amount) continue;
      if (!anyActiveEnemyHasStatus(fieldEffectCtx.board.state, combatant.side, conditional.requiresEnemyStatus)) continue;
      raw += amount * instance.stacks;
    }
  }

  // Floor of 1 across every stat, applied last — a 0 or negative defStat would break the off/def ratio.
  return Math.max(1, raw);
}

export function hasStatus(combatant: Combatant, statusId: StatusId): boolean {
  return combatant.statuses[statusId] !== undefined;
}

/** 0 if absent or the status has no magnitude. */
export function statusMagnitude(combatant: Combatant, statusId: StatusId): number {
  return combatant.statuses[statusId]?.magnitude ?? 0;
}

/** Effective minus loadout baseline — the part this fight contributed. Badges temporary buffs/debuffs only. */
export function getCombatStatDelta(hero: HeroDefinition, combatant: Combatant, stat: StatKey, fieldEffectCtx?: FieldEffectContext): number {
  const baseline = hero.baseStats[stat] + (combatant.baselineStatModifiers[stat] ?? 0);
  return getEffectiveStat(hero, combatant, stat, fieldEffectCtx) - baseline;
}

export function getMaxHp(hero: HeroDefinition, combatant: Combatant): number {
  return getEffectiveStat(hero, combatant, 'hp');
}

export function getMaxMana(hero: HeroDefinition, combatant: Combatant): number {
  return getEffectiveStat(hero, combatant, 'manaPool');
}

/** Locked: starting mana is the full pool. Callers pass hp/mana computed AFTER grants so a +HP/+Mana item starts topped up. */
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
    moveManaDiscounts: {},
    damageTakenSinceLastTurn: 0,
    statuses: {},
    passives: {},
    fainted: false,
  };
}

export type HeroLookup = Record<string, HeroDefinition>;

/** Innate types plus type-graft grants (STAB, TypeMult). Never written back to HeroDefinition. */
export function effectiveTypes(hero: HeroDefinition, combatant: Combatant): readonly TypeId[] {
  return combatant.grantedTypes.length === 0 ? hero.types : [...hero.types, ...combatant.grantedTypes];
}
