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
  /** Firings so far this fight, counted only for a `reactive.maxFiresPerFight` passive. */
  firesThisFight?: number;
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
  /** The Evolution path whose form the view draws (art/evolutions/). Presentation only: the engine never reads it. */
  formPathId?: string;
  /** Equipment/relic status grants (Elemental Force) baked into `statuses` at build, recorded so the view can net them out. Never mutated. */
  baselineStatusMagnitudes: Partial<Record<StatusId, number>>;
  /** One instance per status id — never stacked as multiple instances. */
  statuses: Record<StatusId, StatusInstance>;
  /** Accumulated manaDiscountOnUse per move id; grows only within a fight. Read via effectiveManaCost. */
  moveManaDiscounts: Partial<Record<string, number>>;
  /** Every move's price raised by this much for the rest of the fight (a manaSurcharge passive effect — Deepgrip). Read by resolveManaCost. */
  manaSurcharge?: number;
  /** Charges spent this fight per move id (`chargesPerFight`); kept through a switch, never refilled by Rest or the bench. Read via chargesLeft. */
  chargesSpent?: Partial<Record<string, number>>;
  /** The round this combatant first acts after arriving (switching.ts performSwitch sets round + 1); unset for a lead, whose first round is 1. Read by isMoveUsable for `firstTurnOnly`. */
  firstActionRound?: number;
  /** Accumulated basePowerGainOnUse per move id; grows only within a fight. Read via effectiveBasePower. */
  moveBasePowerBonuses: Partial<Record<string, number>>;
  /** HP lost since this combatant last COMMITTED an action (paid move, Rest, completed switch); a Dazed or fizzled turn keeps banking. Incremented in applyHpDelta. Feeds retributionPercent. */
  damageTakenSinceLastTurn: number;
  /** Populated once at fight build (src/run/passives.ts); only `firedThisFight` changes mid-fight. */
  passives: Record<PassiveId, PassiveInstance>;
  /** How many more knockouts this combatant shrugs off at 1 HP (PassiveDefinition.enduresOnce), set at fight build and spent in applyHpDelta. */
  enduresLeft?: number;
  /** Holds a Blessing (docs/blessings-and-statuses.md §1): the next knockout's whole loss is prevented and this goes false. Copied from the roster entry at fight build, read back at resolve. */
  blessed?: boolean;
  /** A Turned curse's typing (run/curse.ts), set at fight build; effectiveTypes returns it whole. */
  typeOverride?: readonly TypeId[];
  /** Never switches out voluntarily (PassiveDefinition.cannotSwitchOut), set at fight build. Read through canSwitchOut. */
  switchLocked?: boolean;
  /** Statuses this combatant's active side refuses while it stands active, each with the passive that refuses it (PassiveDefinition.sideRefusesStatuses), set at fight build. Read by sideRefuses. */
  sideStatusImmunities?: Partial<Record<StatusId, PassiveId>>;
  /** Stat gains a `permanent` passive statDelta banked this fight, for the roster to keep (run/runProgress.ts recordPermanentStatGains). */
  permanentStatGains?: Partial<Record<StatKey, number>>;
  fainted: boolean;
  /**
   * Came into the fight already down (Squad.downIds): no knockout of this fight's, so it counts
   * toward neither the side's size nor its knockouts until a Revive stands it up and clears this.
   */
  enteredDown?: boolean;
  /**
   * A bench entry held back for a later PHASE of the fight (switching.ts replacementCandidates):
   * it enters only once nothing of an earlier phase stands. Unset = the opening company, phase 0.
   * Set at fight build from Squad.reserves — the Titan's Eyes, docs/titan-eyes.md §6, §10.
   */
  reservePhase?: number;
  /** A side's off-field caster for the companion's Call (withCalledCaster): never active, benched, targeted or counted. */
  called?: boolean;
  /** The category of the last damaging move this combatant LANDED (resolveRound, after the move's hits; a Retribution counts). Unset until the first. Read by a passive's `alternatesCategory`; persists across a switch like a stat modifier. */
  lastHitCategory?: DamageCategory;
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
  /**
   * The round the fight's current phase began (switching.ts performSwitch, set when a reserve of
   * a later phase enters). The Pact Clock counts from here, not from round 1 — each phase of a
   * phased fight is bracketed on its own (docs/titan-eyes.md §10). Unset = round 1.
   */
  phaseStartedRound?: number;
  /** A passesOnFaint status with no partner free to take it, waiting for the next hero to enter on that side (statusEngine.ts passFaintedStatuses, switching.ts performSwitch). */
  pendingSideStatuses?: Partial<Record<Side, StatusId[]>>;
  /** The off-field caster each side may Call, and its Calls left (docs/companion-call.md §7). Unset = no Call. */
  calls?: Partial<Record<Side, SideCall>>;
}

/** A side's Call: the Called combatant (in `combatants`, `called` set), its one move, and how many Calls remain. */
export interface SideCall {
  combatantId: string;
  moveId: string;
  remaining: number;
  /** Calls added each time a later phase of the fight begins (the woken companion before the Eyes). */
  phaseGrant?: number;
}

/** A combatant that fights — every one but a Called caster, which is never fielded, targeted or counted. */
export function isFighter(combatant: Combatant): boolean {
  return !combatant.called;
}

/** The side's Call, when it has one with a Call left. */
export function availableCall(state: CombatState, side: Side): SideCall | null {
  const call = state.calls?.[side];
  return call && call.remaining > 0 && state.combatants[call.combatantId] ? call : null;
}

/**
 * Seats a Called caster: `combatant` joins `combatants` marked `called`, with no passives (a Call
 * carries no Mark and no innate), and its side holds `remaining` Calls of `moveId`.
 */
export function withCalledCaster(state: CombatState, combatant: Combatant, moveId: string, remaining = 1, phaseGrant = 0): CombatState {
  const caster: Combatant = { ...combatant, called: true, passives: {} };
  const call: SideCall = { combatantId: caster.combatantId, moveId, remaining, ...(phaseGrant > 0 ? { phaseGrant } : {}) };
  return {
    ...state,
    combatants: { ...state.combatants, [caster.combatantId]: caster },
    calls: { ...state.calls, [caster.side]: call },
  };
}

/** More Calls for a side that has a caster (the awakening's refresh); a side without one is unchanged. */
export function grantCalls(state: CombatState, side: Side, count: number): CombatState {
  const call = state.calls?.[side];
  if (!call) return state;
  return { ...state, calls: { ...state.calls, [side]: { ...call, remaining: call.remaining + count } } };
}

/** A side is beaten when every combatant that fights has fallen. */
export function sideDefeated(state: CombatState, side: Side): boolean {
  const fighters = Object.values(state.combatants).filter((c) => c.side === side && isFighter(c));
  return fighters.length > 0 && fighters.every((c) => c.fainted);
}

/** The fight phase a combatant belongs to: 0 for the opening company, Squad.reserves' index + 1 after. */
export function phaseOf(combatant: Combatant | undefined): number {
  return combatant?.reservePhase ?? 0;
}

/**
 * Locked: half a side down disables voluntary switching — 2 of the standard 4.
 * Derived from the side's own size rather than stored, so the 6v6 finale
 * (docs/run-loop.md §4) lands on 3 without a second mechanism, and every smaller
 * side — the 2-hero Guardian fight included — keeps the authored 2.
 */
export function lockInThreshold(state: CombatState, side: Side): number {
  let size = 0;
  for (const id in state.combatants) {
    const c = state.combatants[id];
    if (c.side === side && !c.enteredDown && isFighter(c)) size++;
  }
  return Math.max(2, Math.ceil(size / 2));
}

/** The side-wide switch restriction. The one per-hero one is the Ironbound Burden; both are read through canSwitchOut. */
export function isLockedIn(state: CombatState, side: Side): boolean {
  return state.koCount[side] >= lockInThreshold(state, side);
}

/** Whether this combatant may leave the field on its own — not locked in, and not Ironbound (docs/innate-passives.md §4). Every voluntary-switch site reads this. */
export function canSwitchOut(state: CombatState, combatantId: string): boolean {
  const combatant = state.combatants[combatantId];
  if (!combatant) return false;
  return !isLockedIn(state, combatant.side) && !combatant.switchLocked;
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

/**
 * A move as THIS hero casts it: a `typeFollowsUser` move wears the hero's innate primary type
 * (never a graft — the primary is the hero's identity and it never changes). The one place the
 * flag is read; resolveRound, the AI and every hero-scoped tile resolve through here, so a class
 * move is Fire on Cinder and Water on Riptide everywhere it is drawn or rolled. Identity for any
 * other move, so it is safe to apply blindly.
 */
export function moveForHero(move: MoveDefinition, hero: HeroDefinition): MoveDefinition {
  return moveForPrimaryType(move, hero.types[0]);
}

/** The same, off a bare primary type — for fight-free surfaces that hold a HealCaster (types, primary first) rather than a hero. */
export function moveForPrimaryType(move: MoveDefinition, primary: TypeId | undefined): MoveDefinition {
  return move.typeFollowsUser && primary !== undefined && move.type !== primary ? { ...move, type: primary } : move;
}

/** A combatant's price for a move off its own row alone — the ledger, any surcharge, a whole-pool cast — for a surface without the board; resolveManaCost adds the board-read conditional price. */
export function combatantManaCost(move: MoveDefinition, combatant: Combatant): number {
  const priced = effectiveManaCost(move, combatant.moveManaDiscounts) + (combatant.manaSurcharge ?? 0);
  return move.manaCostAll ? Math.max(priced, combatant.currentMana) : priced;
}

/** Authored cost less accumulated discount, floored at 0. The single source of a move's price on fight-free surfaces — never read `move.manaCost` directly for display. */
export function effectiveManaCost(move: MoveDefinition, discounts?: Partial<Record<string, number>>): number {
  return Math.max(0, move.manaCost - (discounts?.[move.id] ?? 0));
}

/**
 * Authored BasePower plus this combatant's accumulated ramp, capped at the authored `max`.
 * The single source of a ramping move's power for engine and view alike — never read
 * `move.basePower` directly once a move can ramp. Undefined for a move with no BasePower
 * (a heal, a buff, a retribution move), which is what the damage pipeline expects.
 */
export function effectiveBasePower(move: MoveDefinition, bonuses?: Partial<Record<string, number>>): number | undefined {
  if (move.basePower == null) return undefined;
  const ramp = move.basePowerGainOnUse;
  if (!ramp) return move.basePower;
  return Math.min(ramp.max, move.basePower + (bonuses?.[move.id] ?? 0));
}

/**
 * What a cast's BasePower actually is: this round's randomBasePower roll, else the ramp
 * accrued in `bonuses`, else undefined (the authored figure stands, and the damage pipeline
 * reads it itself). Engine and view MUST agree on the number on the button, so both read this.
 * `bonuses` is passed rather than read off the state because the engine banks a cast's
 * increment before the hit rolls, and the hit is owed the PRE-increment figure.
 */
export function resolveCastBasePower(
  state: CombatState,
  combatantId: string,
  move: MoveDefinition,
  bonuses: Partial<Record<string, number>> | undefined
): number | undefined {
  const rolled = resolveRandomBasePower(state, combatantId, move);
  if (rolled !== undefined) return rolled;
  return move.basePowerGainOnUse ? effectiveBasePower(move, bonuses) : undefined;
}

/** effectiveManaCost plus conditionalManaCost (the lower wins), plus any manaSurcharge, and the whole pool for a `manaCostAll` move — the price EVERY live-fight surface must read. Enemy-side forms read ACTIVE unfainted enemies; an empty enemy side satisfies neither. */
export function resolveManaCost(
  state: CombatState,
  combatantId: string,
  move: MoveDefinition,
  /** Needed only by the requiresPartnerType side; omit and that side never fires. */
  heroes?: Record<string, HeroDefinition>
): number {
  const combatant = state.combatants[combatantId];
  const surcharge = combatant?.manaSurcharge ?? 0;
  const priced = resolveConditionalManaCost(state, combatantId, move, heroes) + surcharge;
  // A whole-pool cast takes everything held, never less than its floor.
  return move.manaCostAll ? Math.max(priced, combatant?.currentMana ?? 0) : priced;
}

function resolveConditionalManaCost(
  state: CombatState,
  combatantId: string,
  move: MoveDefinition,
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

/** The two modes that need an id on the Action; every other mode resolves its own targets and ignores one. */
export function isSingleTargetMode(mode: TargetMode): boolean {
  return mode === 'singleEnemy' || mode === 'singleAlly';
}

/**
 * The single-target mode a DECLARATION must aim for, or null. `resolveTargetMode` is read
 * twice — once at declaration against the pre-round snapshot, again at resolution against
 * mid-round state — so a conditionalTarget move declared as a spread while its Field Effect
 * was up resolves single-target once an earlier action that round overrides the field. A
 * declared target is inert for every spread mode, so carrying one whenever EITHER the
 * authored target or the conditional one is single costs nothing and closes that race.
 */
export function declarationTargetMode(state: CombatState, move: MoveDefinition): TargetMode | null {
  const live = resolveTargetMode(state, move);
  if (isSingleTargetMode(live)) return live;
  if (isSingleTargetMode(move.target)) return move.target;
  const conditional = move.conditionalTarget?.target;
  return conditional && isSingleTargetMode(conditional) ? conditional : null;
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

/**
 * This round's faces for a metamorphic move (Motley's Trick): `faces` distinct ids from `pool`.
 * DERIVED from (seed, round, combatantId) like resolveRandomBasePower — never stored, never advances
 * rngState — so the button, the declaration, the AI and a replay all see the same faces.
 */
export function resolveMetamorphicFaces(state: CombatState, combatantId: string, pool: readonly string[], faces: number): string[] {
  const remaining = [...pool];
  const picked: string[] = [];
  let rng: RngState = mixString(mixString((state.seed ^ Math.imul(state.round, 0x9e3779b1)) >>> 0, combatantId), 'metamorphic');
  while (picked.length < faces && remaining.length > 0) {
    const { value, nextState } = nextRange(rng, 0, remaining.length);
    rng = nextState;
    picked.push(remaining.splice(Math.min(remaining.length - 1, Math.floor(value)), 1)[0]);
  }
  return picked;
}

/**
 * A stream of floats in [0, 1) DERIVED from (seed, round, combatantId, salt) like the faces above —
 * never stored, never advances rngState. The enemy's declarations read it, so a fight resumed from
 * a save faces the same picks it left (docs/save-system.md D1).
 */
export function derivedRandom(state: CombatState, combatantId: string, salt: string): () => number {
  let rng: RngState = mixString(mixString((state.seed ^ Math.imul(state.round, 0x9e3779b1)) >>> 0, combatantId), salt);
  return () => {
    const { value, nextState } = nextRange(rng, 0, 1);
    rng = nextState;
    return value;
  };
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
  return moveIds.some((id) => isMoveUsable(state, combatantId, moves[id]) && currentMana >= resolveManaCost(state, combatantId, moves[id], heroes));
}

/** Charges this combatant has left on `move`, or null for a move without Charges. */
export function chargesLeft(combatant: Pick<Combatant, 'chargesSpent'>, move: MoveDefinition): number | null {
  if (move.chargesPerFight == null) return null;
  return Math.max(0, move.chargesPerFight - (combatant.chargesSpent?.[move.id] ?? 0));
}

/** The gates a move carries beyond its price: a Charge left, `firstTurnOnly` on the combatant's first round out. Engine, AI and view all read this. */
export function isMoveUsable(state: CombatState, combatantId: string, move: MoveDefinition): boolean {
  const combatant = state.combatants[combatantId];
  if (!combatant) return false;
  if (chargesLeft(combatant, move) === 0) return false;
  if (move.firstTurnOnly && (combatant.firstActionRound ?? 1) !== state.round) return false;
  return true;
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
    // A partner's aura (Mana Chime): only between the two actives, so the bench and a lone lead hold none.
    const board = fieldEffectCtx.board.state;
    const active = board.active[combatant.side];
    if (active.includes(combatant.combatantId)) {
      const partner = active.map((id) => (id && id !== combatant.combatantId ? board.combatants[id] : undefined)).find((c) => c && !c.fainted);
      if (partner) {
        for (const instance of Object.values(partner.passives)) {
          const amount = fieldEffectCtx.board.passives[instance.passiveId]?.partnerStatGrants?.[stat];
          if (amount) raw += amount * instance.stacks;
        }
      }
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

/**
 * The band a stat's fight modifier lives in (docs/stat-scaling.md §3): −½ of base + loadout at
 * the bottom — a debuff can at most halve a stat — and +3× at the top, so a buffed stat is at
 * most **four times** what it started the fight at (2026-09-14, per user direction after play;
 * the +S the doc first proposed read as too tight once buffs landed scaled). Applied at WRITE,
 * so StatChanged reports what landed and every reader of statModifiers sees a figure already
 * inside the band.
 */
export const STAT_CEILING_MULTIPLE = 4;

export function statModifierFloor(hero: HeroDefinition, combatant: Combatant, stat: StatKey): number {
  const s = hero.baseStats[stat] + (combatant.baselineStatModifiers[stat] ?? 0);
  return -Math.floor(Math.max(0, s) / 2);
}

export function statModifierCeiling(hero: HeroDefinition, combatant: Combatant, stat: StatKey): number {
  const s = hero.baseStats[stat] + (combatant.baselineStatModifiers[stat] ?? 0);
  return Math.max(0, s) * (STAT_CEILING_MULTIPLE - 1);
}

/** A delta against a fight modifier, held inside the band: the value to store, the delta that actually landed, and whether either end took any of it. */
export function applyStatModifierDelta(
  hero: HeroDefinition,
  combatant: Combatant,
  stat: StatKey,
  delta: number,
  /** Past the ×4 ceiling — Stampede's Speed alone (CLAUDE.md "Stat modifiers"). */
  uncapped = false
): { newValue: number; landed: number; capped: boolean } {
  const current = combatant.statModifiers[stat] ?? 0;
  // A modifier already past the ceiling (an uncapped rise) is never clawed back by a later change; it just cannot climb further.
  const ceiling = uncapped ? Infinity : Math.max(statModifierCeiling(hero, combatant, stat), current);
  const newValue = Math.min(ceiling, Math.max(statModifierFloor(hero, combatant, stat), current + delta));
  return { newValue, landed: newValue - current, capped: newValue !== current + delta };
}

/** Effective minus loadout baseline — the part this fight contributed. Badges temporary buffs/debuffs only. */
export function getCombatStatDelta(hero: HeroDefinition, combatant: Combatant, stat: StatKey, fieldEffectCtx?: FieldEffectContext): number {
  const baseline = hero.baseStats[stat] + (combatant.baselineStatModifiers[stat] ?? 0);
  return getEffectiveStat(hero, combatant, stat, fieldEffectCtx) - baseline;
}

/**
 * Max HP is the effective HP stat, with nothing applied on top: an authored `hp: 240` is a
 * 240-point bar, and a `+60 HP` grant moves it by 60. The rounds the mana economy needs used
 * to come from a x2 here (fights were ending in a median of 4); that pacing is unchanged, but
 * it now lives in the authored numbers, because a hidden multiplier made every HP figure the
 * player was shown half of the one they got.
 *
 * NOTE: healing is flat (`Heal = HealPower x WisdomMult x STAB`, never a share of max HP), so
 * a heal's worth is set against whatever these lines say. Measured at the doubling, the healers
 * came out ahead — a longer fight buys more casts than the dilution costs (Solace's healing per
 * round rose 8.7 -> 10.9 and its death rate fell) — but that is worth re-checking if the HP
 * lines move again.
 */
export function getMaxHp(hero: HeroDefinition, combatant: Combatant): number {
  // Floor of 1 for the same reason getEffectiveStat has one: 0 max HP is not a combatant.
  return Math.max(1, Math.round(getEffectiveStat(hero, combatant, 'hp')));
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
    moveBasePowerBonuses: {},
    damageTakenSinceLastTurn: 0,
    statuses: {},
    passives: {},
    fainted: false,
  };
}

export type HeroLookup = Record<string, HeroDefinition>;

/** Innate types plus type-graft grants (STAB, TypeMult). Never written back to HeroDefinition. */
export function effectiveTypes(hero: HeroDefinition, combatant: Combatant): readonly TypeId[] {
  // A curse (Werewolf Bite) is the hero's whole typing, both slots, ahead of any graft.
  if (combatant.typeOverride) return combatant.typeOverride;
  // A grant fills the SECONDARY SLOT, it does not append: the primary is immutable and nothing
  // ever reaches three types. Identical to appending for a mono hero; for an innately dual one
  // the grant REPLACES the secondary, which is what lets a dual hero be offered a graft at all.
  return combatant.grantedTypes.length === 0 ? hero.types : [hero.types[0], ...combatant.grantedTypes];
}
