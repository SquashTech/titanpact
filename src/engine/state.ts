// Combat state (docs/architecture.md "State shapes (three tiers)").
// This module covers the COMBAT tier only: the current fight. Run state
// (roster, equipment, relics, progression pool) and meta state (whatever
// survives a run) are separate, longer-lived tiers that build on this one —
// out of scope for this engine slice. Do not fold them in here.

import type { FieldEffectDefinition, FieldEffectId, HeroDefinition, MoveDefinition, PassiveDefinition, PassiveId, StatKey, StatLine, StatusId, TargetMode, TypeId } from './content';
import { nextRange, type RngState } from './rng/seededRng';

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
  /**
   * Set once a `reactive.oncePerFight` passive has fired (content.ts
   * PassiveDefinition, passiveEngine.ts) — the only field on a held passive
   * that changes mid-fight. Absent/false on every other passive, which is why
   * it is optional rather than seeded at fight-build time: buildCombatState
   * has no opinion about it, and a passive that never sets `oncePerFight`
   * never reads it.
   *
   * It is combat state, not run state, so it resets with the fight — "the
   * first time during combat" means the first time in THIS combat.
   */
  firedThisFight?: boolean;
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
  /**
   * NOT bounded by the hero's mana pool. Unlike `currentHp`, which
   * faintHandling.ts clamps to `getMaxHp`, this may sit ABOVE `getMaxMana`
   * — Arcane's mana grants (content.ts `manaGrant`: Infuse, Empower, Conduit,
   * Font of Power) explicitly "can exceed their max", and the 2026-08-30
   * designer call is that the overflow is uncapped and never clawed back
   * (docs/mana.md "Overflow").
   *
   * Which means every reader has to be written for `currentMana > maxMana`:
   *
   * - **Regen never LOWERS you** (combat/manaRegen.ts). It clamps a gain to
   *   the pool, but a combatant already above it simply gains nothing rather
   *   than being pulled back down.
   * - **Rest tops up TO the pool, never below what you hold**
   *   (combat/resolveRound.ts). Resting on an overflowed pool is a wasted
   *   turn, not a refund.
   * - **The view's mana bar divides by the pool**, so its fraction can exceed
   *   1 — every gauge clamps its fill and draws the surplus as its own band
   *   (view/combat/CombatantCard.tsx, HeroDetailOverlay.tsx, SwitchInPanel.tsx).
   * - It survives switching to the bench like any other mana, and resets with
   *   everything else at the next map node (run/buildCombatState.ts).
   */
  currentMana: number;
  /**
   * Flat stat grants from equipment, relics, Evolution, and Class Passives
   * (src/run/buildCombatState.ts placeEntry) — established once at fight
   * build time and never mutated during the fight. Kept separate from
   * `statModifiers` (below) so the view layer can tell "this hero's loadout"
   * apart from "a move buffed/debuffed this hero this fight" — the former
   * enhances the hero's effective Stat Total and should read as part of their base
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
  /**
   * Accumulated per-move mana discounts (engine/content.ts
   * MoveDefinition.manaDiscountOnUse — Water's Wave Shred), keyed by move id.
   * Starts empty every fight and only ever grows: this is a within-combat ramp,
   * not a loadout fact, so unlike baselineStatModifiers it is never seeded by
   * buildCombatState. Read exclusively through effectiveManaCost below.
   */
  moveManaDiscounts: Partial<Record<string, number>>;
  /**
   * HP this combatant has lost since it last took a turn — the counter Stone's
   * Retribution and Stoneheart deal their whole damage body off
   * (content.ts retributionPercent).
   *
   * Incremented at the ONE choke point every HP loss goes through
   * (combat/faintHandling.ts applyHpDelta), so it counts everything without
   * anything having to opt in: attacks, Conduct detonations, Bleed and Poison
   * ticks, and a hero's own Rubble Rush recoil.
   *
   * Reset to 0 when this combatant COMMITS to an action — a move whose mana is
   * spent, a Rest, or a completed switch (combat/resolveRound.ts). An action
   * that never happened does not reset it: a Dazed hero, or one whose move
   * fizzled on an unmet target gate, keeps banking, because it did not take a
   * turn. That is the literal reading of "since its last turn" and it means a
   * Dazed Stone hero wakes up holding a very large Stoneheart, which is the
   * correct payoff for having lost a round.
   *
   * Starts at 0 every fight and, like moveManaDiscounts above, is a
   * within-combat fact rather than a loadout one — buildCombatState never
   * seeds it.
   */
  damageTakenSinceLastTurn: number;
  /** Held Passives, keyed by PassiveId — populated once at fight-build time from equipment/relic/Evolution grants (src/run/passives.ts, buildCombatState.ts placeEntry). The SET never changes mid-fight: nothing grants or removes a Passive during combat. The only thing that moves is a once-per-fight reaction marking itself spent (PassiveInstance.firedThisFight). */
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
export function hasAffordableMove(
  currentMana: number,
  moveIds: readonly string[],
  moves: Record<string, MoveDefinition>,
  /** The caster's accumulated per-move discounts (Combatant.moveManaDiscounts). Omit and every move is priced at its authored cost — which is what every caller did before Wave Shred existed. */
  discounts?: Partial<Record<string, number>>
): boolean {
  return moveIds.some((id) => currentMana >= effectiveManaCost(moves[id], discounts));
}

/**
 * What `move` costs THIS combatant right now: the authored cost less whatever
 * `manaDiscountOnUse` has accumulated for it, floored at 0.
 *
 * The single source of truth for a move's live price. The engine's legality
 * guard, the mana it actually spends, the view's affordability check and the
 * gem on the button all call this — a second reader of `move.manaCost` is how
 * a button ends up saying 80 while the engine charges 40.
 *
 * Takes the discount map rather than a whole Combatant so the view can price a
 * move for a hero it has no live Combatant for (draft, level-up, compendium),
 * where the answer is simply the authored cost.
 */
export function effectiveManaCost(move: MoveDefinition, discounts?: Partial<Record<string, number>>): number {
  return Math.max(0, move.manaCost - (discounts?.[move.id] ?? 0));
}

/**
 * effectiveManaCost, plus the board-dependent half — Storm's Overcharge,
 * "costs 0 mana if both enemies have Conduct"
 * (content.ts conditionalManaCost).
 *
 * This is the price EVERY live-fight surface must read: the engine's legality
 * guard, the mana it spends, the view's affordability filter and the gem on
 * the button. effectiveManaCost stays correct — and stays the right call — for
 * surfaces with no fight in scope (draft, level-up, compendium), where the
 * authored price is the honest answer.
 *
 * The two conditions compose by taking the LOWER price, since neither is meant
 * to be a way of making the other more expensive.
 *
 * `conditionalManaCost` has two sides and a move authors exactly one
 * (content.ts): `requiresAllEnemiesStatus` (Overcharge — every active enemy
 * marked) or `requiresAnyEnemyStatus` (Iron's Metallic Blade — at least one
 * is). Both read over the ACTIVE, unfainted enemies and both require at least
 * one of them: a wiped enemy side vacuously satisfies "every enemy is marked",
 * and a condition nothing can meet must not read as met. The shared
 * empty-side guard is what makes that true for the `every` side; the `some`
 * side would already answer false.
 */
export function resolveManaCost(
  state: CombatState,
  combatantId: string,
  move: MoveDefinition,
  /**
   * The roster, required only by the `requiresPartnerType` side (Beast's Pack
   * Leader), which has to read the partner's TYPES and a Combatant carries
   * only a heroId. Omit it and that side never fires, leaving the two
   * enemy-side forms byte-identical for every caller with no roster in scope
   * — the same "omit it and everything else behaves exactly as before"
   * discipline getEffectiveStat's fieldEffectCtx follows.
   */
  heroes?: Record<string, HeroDefinition>
): number {
  const combatant = state.combatants[combatantId];
  const base = effectiveManaCost(move, combatant?.moveManaDiscounts);
  const conditional = move.conditionalManaCost;
  if (!conditional || !combatant) return base;

  // The ally-side form, checked before the enemy-side ones because it has
  // nothing to do with them: a wiped enemy side must not swallow a discount
  // that reads the caster's own row (content.ts requiresPartnerType).
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

/**
 * resolveManaCost's targeting counterpart — the board-aware answer to "who
 * does this move actually hit right now" (content.ts `conditionalTarget`,
 * Arcane's Overload: "spread if Magical Surge is active").
 *
 * The single reader every live-fight surface must go through, for the same
 * reason resolveManaCost is: `move.target` stays the AUTHORED mode, which is
 * still the honest answer on the fight-free surfaces (draft, level-up,
 * compendium) and is still what the player declares against. This is what
 * resolveRound resolves targets from and what the move button's chip reports.
 *
 * Reads the one global field-effect slot (docs/field-effects.md), so like
 * `conditionalPower.requiresFieldEffect` it has exactly one answer per round
 * for everyone on the board — and an enemy's Magical Surge spreads YOUR
 * Overload just as your own does.
 */
export function resolveTargetMode(state: CombatState, move: MoveDefinition): TargetMode {
  const conditional = move.conditionalTarget;
  if (!conditional) return move.target;
  return state.activeFieldEffect?.fieldEffectId === conditional.requiresFieldEffect ? conditional.target : move.target;
}

/**
 * Mixes a string into a 32-bit seed (FNV-1a). Not a randomness source of its
 * own — it only spreads the identifiers below across the seed space so two
 * combatants, or two moves, do not derive the same roll.
 */
function mixString(seed: number, text: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h = (h ^ text.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * What `move` will hit for this round in the hands of `combatantId`, when its
 * BasePower is rolled rather than authored (content.ts randomBasePower —
 * Mech's Jackpot). `undefined` for every move that authors a flat number,
 * which is all but one of them.
 *
 * The single source of truth for that figure, and the reason it can be one:
 * the roll is DERIVED rather than stored or drawn. It is a pure function of
 * `(seed, round, combatantId, moveId)` pushed through the same mulberry32
 * `nextRange` the damage variance uses, so the engine's hit and the number on
 * the player's button are the same computation over state both already hold —
 * there is nothing to keep in sync, nothing to serialize, and nothing to seed
 * at fight-build time.
 *
 * Three consequences, all of them the point rather than side effects:
 *
 * - **`state.rngState` is never touched**, so every fight authored before
 *   Jackpot replays byte-identically and a player opening the move dossier
 *   twice cannot shake the reel (docs/authoring-moves.md §5 "default to
 *   inert").
 * - **It re-rolls every round**, because `round` is an input. Nothing has to
 *   remember to advance it.
 * - **It is per combatant**, because `combatantId` is one. Two heroes holding
 *   Jackpot in the same fight read different numbers off the same reel.
 *
 * Rounded, and inclusive of `max`: the design row says 50-150 and a player
 * reading a decimal off a slot machine would be right to complain.
 */
export function resolveRandomBasePower(
  state: CombatState,
  combatantId: string,
  move: MoveDefinition
): number | undefined {
  const roll = move.randomBasePower;
  if (!roll) return undefined;
  const seeded = mixString(mixString((state.seed ^ Math.imul(state.round, 0x9e3779b1)) >>> 0, combatantId), move.id);
  // +1 on the ceiling so Math.round cannot only reach `max` from a half-width
  // sliver of the range — every integer in [min, max] is equally likely.
  return Math.min(roll.max, Math.floor(nextRange(seeded, roll.min, roll.max + 1).value));
}

/**
 * hasAffordableMove's board-aware counterpart — the Rest-fallback check
 * (combat/actions.ts RestAction) has to agree with what the button costs, or a
 * hero holding nothing but a currently-free Overcharge gets forced to Rest
 * while staring at a move it can afford.
 */
export function hasAffordableMoveInFight(
  state: CombatState,
  combatantId: string,
  moveIds: readonly string[],
  moves: Record<string, MoveDefinition>,
  /** Threaded straight through to resolveManaCost — see its note. Omit and a `requiresPartnerType` price is read at its authored cost, which can force a Rest the button would not have. */
  heroes?: Record<string, HeroDefinition>
): boolean {
  const currentMana = state.combatants[combatantId]?.currentMana ?? 0;
  return moveIds.some((id) => currentMana >= resolveManaCost(state, combatantId, moves[id], heroes));
}

/**
 * The effective types of the hero standing in the caster's OTHER active slot,
 * or null when that slot is empty or its occupant is down — the one reader of
 * "is my partner a Beast" (content.ts `conditionalPower.requiresPartnerType`,
 * `conditionalManaCost.requiresPartnerType`, `conditionalStatDeltas`).
 *
 * Three decisions live here rather than at the three call sites, which is the
 * whole reason it is a shared helper (2026-08-30 designer calls):
 *
 * - **Active only.** The bench does not count. A doubles condition is about
 *   who is standing beside you, so switching a Beast in turns it on and
 *   switching one out turns it off.
 * - **Fainted does not count.** A partner that went down earlier this round
 *   answers the same as an empty slot.
 * - **Effective types, not authored ones** — a type-graft Evolution
 *   (Combatant.grantedTypes) satisfies the condition exactly as an innate
 *   type does.
 *
 * Returns the type list rather than a boolean so callers name their own type
 * and nothing here knows the word "Beast".
 */
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

/**
 * Everything getEffectiveStat needs BEYOND the hero and the combatant itself —
 * the two stat hooks that read the wider board rather than the combatant's own
 * record. Every field is optional to supply and omitting the whole context
 * makes both functions behave exactly as they did before either hook existed.
 *
 * - `active`/`defs` — the Field Effect (Verdant Earth's
 *   statBonusEqualToStatusMagnitude).
 * - `board` — the opposing side, for a conditional passive
 *   (content.ts PassiveConditionalStatGrants — Bloodthirsty).
 *
 * `board` carries the whole CombatState rather than a precomputed "is there a
 * Bleeding enemy" flag on purpose: one context object is shared between the
 * ATTACKER and the DEFENDER inside resolveStatRatio, and "enemy" means the
 * opposite thing for each. Resolving it per combatant, off `combatant.side`,
 * is the only reading that is correct for both.
 */
export interface StatContext {
  active: ActiveFieldEffect | null;
  defs: Record<string, FieldEffectDefinition>;
  board?: { state: CombatState; passives: Record<PassiveId, PassiveDefinition> };
}

/** The name this context had when the Field Effect hook was its only content (2026-08-30). Kept so existing call sites and imports read unchanged; prefer StatContext in new code. */
export type FieldEffectContext = StatContext;

/**
 * Whether any living, currently-ACTIVE combatant on the side opposing
 * `side` carries `statusId` — the one board question
 * PassiveConditionalStatGrants asks today.
 *
 * Active-only and living-only for the reasons PassiveEffectTarget
 * 'activeEnemies' already gives: a benched opponent has not been committed to
 * the fight, and a fainted one answers like an empty slot.
 */
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

  // Freeze (docs/conditions.md): halves Speed. Boolean-shape — presence is
  // the whole signal, no magnitude to read.
  if (stat === 'speed' && hasStatus(combatant, FREEZE_STATUS_ID)) {
    raw = Math.floor(raw / 2);
  }

  // Verdant Earth (docs/field-effects.md): while active, adds a bonus equal to
  // the combatant's OWN current magnitude of the named status (Renew) to every
  // stat its definition lists. Reads the live magnitude each call, so the bonus
  // shrinks as Renew decays and is simply 0 for a hero not carrying it — the
  // effect rewards a Renew build rather than buffing the whole field flatly.
  const statusBonus = fieldEffectCtx?.active
    ? fieldEffectCtx.defs[fieldEffectCtx.active.fieldEffectId]?.statBonusEqualToStatusMagnitude
    : undefined;
  if (statusBonus?.stats.includes(stat)) {
    raw += statusMagnitude(combatant, statusBonus.statusId);
  }

  // Conditional passive grants (content.ts PassiveConditionalStatGrants —
  // Bloodthirsty). Read live, every call, off the board as it stands: the
  // bonus appears the moment a Bleed lands on an active enemy and is gone the
  // moment that enemy is switched out, faints, or the Bleed runs out. Nothing
  // has to remember to revoke it, which is the whole reason this is a stat
  // hook rather than a reactive statDelta.
  //
  // N stacks resolve N times, same discipline as every other passive shape.
  if (fieldEffectCtx?.board) {
    for (const instance of Object.values(combatant.passives)) {
      const conditional = fieldEffectCtx.board.passives[instance.passiveId]?.conditionalStatGrants;
      const amount = conditional?.statGrants[stat];
      if (!conditional || !amount) continue;
      if (!anyActiveEnemyHasStatus(fieldEffectCtx.board.state, combatant.side, conditional.requiresEnemyStatus)) continue;
      raw += amount * instance.stacks;
    }
  }

  // FLOOR OF 1 (2026-08-30 designer call, raised by the Mind slate). Every
  // effective stat in the game bottoms out at 1 — this is the single
  // chokepoint every reader already goes through (getMaxHp and getMaxMana are
  // thin wrappers over it, and the damage pipeline reads both sides of its
  // ratio through it), so the invariant lives in one place rather than in
  // every caller.
  //
  // It was not merely a Brain Flay concern. Nothing clamped here before, and
  // the authored slates had already outgrown the gap: Break Will alone is
  // -50 Attack, which puts an Attack-25 caster at -25, and a NEGATIVE defStat
  // inverts the off/def ratio so an attack HEALS its target, while a defStat
  // of exactly 0 makes it Infinity. Mind's capstone (content.ts
  // doublesStatReductions) only made it reachable twice as fast.
  //
  // Applied LAST, after Freeze's halving and Verdant Earth's bonus, so a
  // Speed-1 hero that gets Frozen reads 1 rather than 0 and still takes a
  // turn. Deliberately flat across every StatKey rather than carved out per
  // stat: no content debuffs hp, manaPool or mpRegen today, so the floor
  // cannot bind on those, and a future "MP Regen 0" debuff should be a
  // conversation rather than something this clamp silently forbids.
  return Math.max(1, raw);
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
    moveManaDiscounts: {},
    damageTakenSinceLastTurn: 0,
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
