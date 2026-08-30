// Shared content vocabulary — the engine's contract with /src/data.
// All acquirable content (heroes, moves, ...) is pure data conforming to these
// shapes. The engine interprets data; it never contains bespoke per-content
// logic. See CLAUDE.md "Architecture" and docs/architecture.md repo map.
//
// The condition vocabulary (the sixth engine contract) is now implemented per
// docs/conditions.md: 9 statuses, mostly across the 3 core shapes
// (magnitude/boolean/duration) plus Poison's own 'timer' shape, encoded below
// as StatusDefinition data. MoveDefinition.kind now covers
// 'damage' | 'heal' | 'buff', and any kind may additionally carry a
// statusApplication and/or a cleanses effect — see docs/conditions.md §5 (the
// Status-Query Layer) for the Gate/Consume/Transmute verb vocabulary this sets
// up.
//
// Passives (the fifth engine contract — CLAUDE.md "abilities" slot) are
// implemented below as PassiveDefinition: named, single-title effects
// grantable from Equipment, Relics, Evolution paths, or a Class
// (src/run/equipment.ts, src/run/relics.ts, src/run/progression.ts
// EvolutionPath.grantsPassiveIds, src/run/classes.ts), held on
// Combatant.passives (engine/state.ts) and resolved by
// engine/combat/passiveEngine.ts — reactive hooks (event-stream-driven, e.g.
// "heal when an enemy takes Bleed damage") and damage-pipeline modifiers
// (synchronous, contributing to damagePipeline.ts's DamageModifier
// accumulator, e.g. "+20% Fire damage") are the two triggered effect shapes;
// PassiveDefinition.statGrants is a third, non-triggered shape (an always-on
// flat stat buff, applied at fight-build time like Equipment/Relic
// statGrants) — src/data/classes.ts's Classes are the first content to use it
// on its own. Extend PassiveEffect/PassiveHook as new shapes are actually
// needed rather than speculatively.

/** Opaque type-chart key. The concrete 15 types are DATA — see src/data/typechart.ts. */
export type TypeId = string;

export type StatKey = 'hp' | 'attack' | 'defense' | 'intelligence' | 'wisdom' | 'speed' | 'manaPool' | 'mpRegen';

export interface StatLine {
  hp: number;
  attack: number;
  defense: number;
  intelligence: number;
  wisdom: number;
  speed: number;
  manaPool: number;
  mpRegen: number;
}

/**
 * The 2v2 targeting model (docs/combat.md "Action declaration & targeting").
 * A move targets a specific slot, or a fixed group; there is no spread-damage
 * penalty for multi-target moves (doubles-only game).
 */
export type TargetMode =
  | 'singleEnemy'
  | 'singleAlly'
  | 'self'
  | 'bothEnemies'
  | 'bothAllies'
  | 'allOthers'
  /**
   * Rolled at resolution time from the seeded RNG rather than declared by the
   * player — Storm's Rising Static, "randomly give an ally +20 Speed and an
   * enemy Conduct". The candidate pool is the same one 'bothAllies' /
   * 'bothEnemies' resolve to (active, unfainted, caster INCLUDED on the ally
   * side, matching every other ally mode here), with exactly one drawn from it.
   *
   * Resolved by targeting.ts resolveTargetsRolled, NOT by resolveTargets —
   * random targeting is the one mode that cannot be a pure function of state,
   * so it is deliberately kept out of the pure resolver instead of threading
   * RNG through every caller. Every non-random mode still draws no RNG at all
   * (engine determinism, docs/architecture.md "Determinism & RNG").
   *
   * The view offers no target picker for these — they behave like the
   * fixed-group modes at declaration time, because there is nothing to choose.
   */
  | 'randomAlly'
  | 'randomEnemy';

export type MoveCategory = 'physical' | 'magical';

/** Opaque status-catalog key. The concrete 8 statuses are DATA — see src/data/statuses.ts. */
export type StatusId = string;

/**
 * The status shapes (docs/conditions.md §1). Every status instance is an
 * instance of exactly one shape — no bespoke per-status engine logic beyond
 * the documented exceptions the catalog itself calls out. 'timer' is Poison's
 * own shape: a magnitude that builds up plus a duration that only counts down
 * while the combatant is active, detonating into damage at zero instead of
 * just expiring.
 */
export type StatusShape = 'magnitude' | 'boolean' | 'duration' | 'timer';

/** How a re-application of an already-present status combines with the existing instance. */
export type StatusStacking =
  | 'additive'
  | 'none'
  | 'takeHigher'
  /** Poison (docs/conditions.md §7 Q3/Q4): magnitude accumulates additively; duration holds at whatever it already is — reapplying mid-timer never resets or extends the clock. */
  | 'additiveMagnitudeFixedDuration';

/** Why a status left a combatant — carried on StatusRemovedEvent for legibility. */
export type StatusRemovalReason = 'decay' | 'expired' | 'switch' | 'cleanse' | 'consumed';

/**
 * Data-driven encoding of the docs/conditions.md catalog + appendix table —
 * the 6th engine contract. One record per status; the engine reads these
 * flags generically (statusEngine.ts) rather than special-casing each status.
 */
export interface StatusDefinition {
  id: StatusId;
  name: string;
  shape: StatusShape;
  /** DoT/HoT/duration-countdown/timer tick point. LOCKED to end-of-round in this engine — see docs/conditions.md §7 "Status tick timing" open question. */
  ticksAtEndOfRound: boolean;
  /**
   * Duration-shape only (Stealth): countdown ticks at the START of a round instead
   * of the end, and a tick that finds duration already at 0 removes the status
   * BEFORE that round's actions rather than decrementing it further — so a status
   * applied mid-round with duration 1 protects the rest of its casting round (via
   * the live hasStatus check, same as always) AND the entire following round,
   * expiring only when the round after that begins. Mutually exclusive with
   * ticksAtEndOfRound.
   */
  ticksAtStartOfRound?: boolean;
  /** Post-tick decay for magnitude statuses (Burn, Renew): halve toward 0. 'none' for statuses whose magnitude doesn't decay on its own (Poison builds up until it detonates). */
  decay: 'halve' | 'none';
  stacking: StatusStacking;
  /** docs/conditions.md §4 removal table: cleared by switching to bench. */
  clearsOnSwitch: boolean;
  /**
   * Removed unconditionally at the end of the round it was applied in — Daze,
   * and the reason Daze needs no number (2026-08-30 redesign; before it, Daze
   * was a duration-shape status authored per-move at 2).
   *
   * This is the FLINCH shape, in the Pokémon sense, and the whole mechanic is
   * an interaction with turn order rather than with a clock:
   *
   * - A hero's action is gated on a LIVE read at the moment its turn comes up
   *   (resolveRound.ts), so a Daze only denies anything if it was applied by a
   *   combatant that acted EARLIER in the same round. Land it on someone who
   *   has already moved and it does nothing at all.
   * - It can therefore never be present when a round begins, which is what
   *   makes the number meaningless: there is no second round to count down to.
   *   Speed (and priority) is the entire cost/benefit.
   *
   * Independent of `ticksAtEndOfRound`: the clear is its own pass in
   * statusEngine.ts tickEndOfRound, running AFTER the tick pass, so a status
   * authoring both would tick exactly once and then go. Emits StatusRemoved
   * with reason 'expired', which the view deliberately folds into the next beat
   * rather than spending a tap on (buildBeats.ts) — a status that never
   * survives its own round has no "wore off" moment worth stopping for.
   */
  clearsAtEndOfRound?: boolean;
  /** Poison only: the end-of-round tick is skipped entirely for a benched combatant (switching stalls the timer instead of clearing it) rather than ticking down regardless like Stealth does. */
  activeOnly?: boolean;
  /** The only positive status(es) — Renew, Stealth. docs/conditions.md §7 "Cleanse & positive statuses": Cleanse never strips these. */
  positive?: boolean;
  /** Boolean-shape DoT/HoT only (Bleed): fixed effect as a % of max HP instead of a magnitude. */
  flatPercentOfMaxHp?: number;
  /**
   * Conduct's hook: any `kind: 'damage'` move whose `type` is in this list
   * detonates this status on the target (`detonateBonusPercentMaxHp` of the
   * target's max HP as bonus damage, then consumed) if already present —
   * detonate-only, a no-op otherwise. Planting the status in the first place
   * is a separate, move-authored choice via `statusApplication` (same as any
   * other status) — see moves.ts's dedicated Conduct move. Generic so a
   * future type-triggered status reuses this same engine hook
   * (statusEngine.ts detonateTriggeredStatuses) instead of a Conduct-only
   * special case.
   */
  triggerTypes?: readonly TypeId[];
  /** Paired with triggerTypes — the detonate bonus, as a fraction of the target's max HP. */
  detonateBonusPercentMaxHp?: number;
  /**
   * Haunt's hook: a `singleEnemy` `kind: 'damage'` move whose `type` is in
   * this list also strikes an active ally-of-the-target carrying this status
   * — single-target becomes spread. Generic so a future retarget-style status
   * reuses this same hook (statusEngine.ts expandSpreadTargets).
   */
  spreadTriggerTypes?: readonly TypeId[];
  /**
   * Provoke's hook: while any active combatant on a side carries this status,
   * every SINGLE-TARGET move the opposing side aims at that side is redirected
   * onto the holder — Stone's Provoke, "redirect single-target enemy attacks to
   * the user this turn".
   *
   * The inverse of Stealth's redirect (statusEngine.ts applyStealthRedirect
   * pushes an attack AWAY from its holder; this one pulls it TOWARD). Two
   * deliberate differences, both 2026-08-30 designer calls:
   *
   * - It is NOT limited to `kind: 'damage'`. Any single-target move the enemy
   *   aims at this side lands on the holder instead, debuffs and status riders
   *   included, which is what makes Provoke a body-block for a fragile partner
   *   rather than only an attack-soak.
   * - It only catches moves cast from the OPPOSING side. A move resolved
   *   against its own caster's side ('singleAlly' — a heal, a Toughen Up) is
   *   untouched: redirecting an ally's buff onto the enemy taunt would be
   *   nonsense, and "enemy attacks" is what the design row says.
   *
   * Spread moves are unaffected, same as Stealth. Read generically off this
   * flag rather than as a literal 'Provoke' id check, so the next type that
   * wants a taunt authors it as data — same discipline as triggerTypes /
   * spreadTriggerTypes above.
   */
  redirectsSingleTargetEnemyMoves?: boolean;
  /**
   * Elemental Force: which move type's BasePower this magnitude-shape status
   * adds to. Read generically by damagePipeline.ts's resolveElementalForceBonus
   * — a hero can hold several Force statuses (Fire Force, Water Force, ...)
   * independently, each keyed by its own StatusId, and only the one(s)
   * matching the move actually in flight contribute. Added to move.basePower
   * BEFORE the ratio/STAB/TypeMult/Variance/Crit/multiplierTerm chain — it
   * changes the formula's own BasePower input, unlike a DamageModifier, which
   * scales the already-computed result.
   */
  forceType?: TypeId;
  /** Which pipeline (if any) this status enters — documentation of where its effect is wired in, not engine-read except where noted above. */
  pipeline: 'dot' | 'hot' | 'control' | 'timer' | 'trigger' | 'target' | 'basePower' | 'none';
  description?: string;
}

/** A status grant with a fixed magnitude, no duration/target — equipment/relics granting a persistent magnitude-shape status (e.g. Elemental Force) for the whole fight, applied once at fight-build time rather than via applyStatus's runtime apply/stack path. */
export interface StatusGrant {
  statusId: StatusId;
  magnitude?: number;
}

export interface StatDelta {
  stat: StatKey;
  /** Flat additive, per CLAUDE.md "Stat modifiers are flat additive integers" — positive = buff, negative = debuff. */
  amount: number;
}

/**
 * A move's optional status effect (docs/conditions.md §5). Any move kind may
 * carry one — a damage move inflicting Burn, a buff move also granting Renew,
 * a dedicated status move applying Haunt, etc.
 */
export interface StatusApplication {
  statusId: StatusId;
  /** Required for magnitude-shape statuses. */
  magnitude?: number;
  /** Required for duration-shape statuses. */
  duration?: number;
  /**
   * 'self' = the move's user; 'moveTarget' = the move's own resolved target(s).
   *
   * 'randomAlly' / 'randomEnemy' let the RIDER resolve its own target,
   * independently of the move's — Storm's Rising Static buffs a random ally
   * (the move's own `target`) while marking a random ENEMY with Conduct, which
   * is the first move whose payload lands on both sides of the field at once.
   * Same pool and same draw as the TargetMode of the same name; the move's
   * target is rolled first, then the rider's, which is the fixed draw order
   * this stays deterministic under.
   */
  target: 'self' | 'moveTarget' | 'randomAlly' | 'randomEnemy';
  /**
   * Probability in [0, 1] that this rider actually lands. Omitted = always,
   * which is every move authored before Fire's Ember ("10% chance to apply
   * Burn 5"). Rolled independently per resolved target, so a chanced spread
   * move can catch one foe and miss the other.
   *
   * NOT an accuracy stat (CLAUDE.md "No accuracy stat" — moves always land):
   * the move's damage/heal/buff body resolves unconditionally, only the
   * status rider is gated. Keeping the chance on the rider rather than on the
   * move is what preserves that invariant.
   */
  chance?: number;
}

/** Opaque passive-catalog key. Concrete passives are DATA — see src/data/passives.ts. */
export type PassiveId = string;

/**
 * Event types a reactive Passive can key off — a deliberately small subset of
 * CombatEvent['type'] (engine/events.ts) that make sense as hook points.
 * Extend this union only when a passive actually needs the new hook, not
 * speculatively — same discipline as StatusDefinition.triggerTypes.
 */
export type PassiveHook = 'DamageDealt' | 'StatusApplied' | 'StatusTicked';

/**
 * Relationship the triggering event's subject (passiveEngine.ts subjectOf)
 * must have to the passive's owner. 'self' = the owner itself; 'ally' = the
 * owner's partner, not the owner; 'enemy' = the opposing side.
 */
export type PassiveRelation = 'self' | 'ally' | 'enemy';

/**
 * Declarative field-equality match against the triggering event — same
 * discipline as StatusDefinition.triggerTypes: data, not a function, so
 * content stays pure data the engine interprets generically.
 */
export interface PassiveTriggerCondition {
  relativeTo: PassiveRelation;
  /** Every key must equal the triggering event's same-named field (compared as a string). e.g. { statusId: 'Bleed', kind: 'damage' } for a Bleed-tick hook. */
  eventFieldEquals?: Partial<Record<string, string>>;
}

/** Where a reactive effect's magnitude comes from. matchTriggerAmount powers Sanguine's "heals for the same amount [the enemy just took]". */
export type PassiveAmount = { kind: 'flat'; value: number } | { kind: 'matchTriggerAmount'; multiplier?: number };

/** The reactive effect primitives — the atomic verbs a Passive's reaction resolves into. */
export type PassiveEffect =
  | { kind: 'heal'; target: 'self' | 'triggerSubject'; amount: PassiveAmount }
  | { kind: 'applyStatus'; target: 'self' | 'triggerSubject'; statusId: StatusId; magnitude?: number; duration?: number }
  | { kind: 'statDelta'; target: 'self' | 'triggerSubject'; stat: StatKey; amount: number }
  /** Sets the battlefield's Field Effect (docs/field-effects.md) — global, so unlike the other three shapes above it has no `target`. */
  | { kind: 'setFieldEffect'; fieldEffectId: FieldEffectId };

/**
 * The damage-pipeline-modifier shape (docs/combat.md "The damage-modifier
 * multiplier term") — evaluated synchronously per hit, BEFORE it's rolled,
 * not a reaction to a past event. Matched only against the pending hit's own
 * context (currently just { moveType }) — there is no "relativeTo" here since
 * this is always evaluated against the attacker's own held passives.
 */
export interface PassiveDamageModifier {
  eventFieldEquals?: Partial<Record<string, string>>;
  /** Same units as damagePipeline.ts DamageModifier.amount — e.g. 0.2 == +20%. */
  amount: number;
}

/**
 * A Passive may carry a reactive effect, a damage modifier, flat stat grants,
 * or any combination — a PassiveDefinition with none of the three is invalid
 * content (nothing for it to do). `statGrants` is the always-on shape (no
 * hook, no pre-roll evaluation): applied once at fight-build time exactly
 * like Equipment.statGrants/RelicDefinition.statGrants (src/run/equipment.ts,
 * src/run/relics.ts — src/run/passives.ts passiveStatModifiers is the
 * passive-held equivalent of those two), not read by passiveEngine.ts at all.
 * Its first real user is the Class system (src/data/classes.ts): a Class is
 * simply a Passive whose only content is a flat two-stat grant.
 */
export interface PassiveDefinition {
  id: PassiveId;
  name: string;
  /** Player-facing, required — readability is the whole point (CLAUDE.md "visible, readable... to the player"). */
  description: string;
  reactive?: { hook: PassiveHook; condition: PassiveTriggerCondition; effect: PassiveEffect };
  damageModifier?: PassiveDamageModifier;
  /** Flat additive grants (CLAUDE.md "Stat modifiers are flat additive integers, multiples of 5 or 10") — see isValidPassiveDefinition. */
  statGrants?: Partial<Record<StatKey, number>>;
}

/** Same discipline as isValidEquipmentDefinition/isValidRelicDefinition: every statGrants entry must be a valid flat grant, and the passive must actually do something. */
export function isValidPassiveDefinition(passive: PassiveDefinition): boolean {
  const hasEffect = passive.reactive !== undefined || passive.damageModifier !== undefined || passive.statGrants !== undefined;
  if (!hasEffect) return false;
  return Object.values(passive.statGrants ?? {}).every((amount) => amount === undefined || isValidFlatStatGrant(amount));
}

/** Opaque field-effect-catalog key. Concrete field effects are DATA — see src/data/fieldEffects.ts. */
export type FieldEffectId = string;

/**
 * A Field Effect (docs/field-effects.md, resolving docs/mana.md's former
 * "weather subsystem" open question): a single global battlefield state, only
 * one active at a time. Every Field Effect lasts a flat 5 rounds regardless of
 * which one it is (engine/combat/fieldEffectEngine.ts
 * FIELD_EFFECT_DURATION_ROUNDS) — duration is NOT authored per-definition.
 * Re-setting the currently active effect is a no-op (does not refresh the
 * clock); setting a different one overrides it and restarts the clock.
 * Settable by a move (`MoveDefinition.fieldEffectApplication`) or a Passive
 * (`PassiveEffect` `setFieldEffect`, i.e. a relic or ability).
 *
 * Five effect shapes are implemented so far, each read generically by its own
 * engine module rather than special-cased by id — same discipline as
 * StatusDefinition/PassiveHook. Extend this shape only when a new Field
 * Effect actually needs it: docs/field-effects.md flags the "certain type of
 * moves" surface (a damage-pipeline modifier restricted to specific move
 * types) as a deliberately deferred extension point, still not wired into any
 * engine module.
 */
export interface FieldEffectDefinition {
  id: FieldEffectId;
  name: string;
  /** Player-facing, required — same discipline as PassiveDefinition.description. */
  description: string;
  /**
   * Presentational only — the engine never reads this (same discipline as
   * MoveDefinition.description). Which type's palette (view/combat/
   * typeColors.ts) the view layer tints this effect's badge/glow with, since
   * every Field Effect so far is flavored around one type even though its
   * mechanical effect is global to both sides.
   */
  flavorType?: TypeId;
  /** Flat multiplier applied to every combatant's MP Regen while this effect is active (e.g. 2 = doubled). Applied in the regen pipeline itself (engine/combat/manaRegen.ts) — never folded into the mpRegen stat, same discipline that keeps damage modifiers out of the stat pipeline. */
  mpRegenMultiplier?: number;
  /** Status ids whose end-of-round decay (StatusDefinition.decay) is suppressed while this effect is active — e.g. Scorched Land holding Burn at full magnitude instead of halving it. Read by statusEngine.ts tickEndOfRound; the magnitude/DoT tick itself is untouched, only the post-tick decay step is skipped. */
  suppressesStatusDecay?: readonly StatusId[];
  /** If true, actions within the same priority bracket resolve in ASCENDING (slowest-first) Speed order instead of the normal descending order — e.g. Stasis Bubble. Priority bracket separation itself is untouched: a move with nonzero authored priority still resolves in its own bracket before/after priority-0 moves, same as always. Read by combat/priority.ts orderActions. */
  reversesSpeedOrder?: boolean;
  /** Added to a heal-kind move's priority bracket while this effect is active — e.g. Sanctuary's +1. Read by combat/priority.ts orderActions. */
  healPriorityBonus?: number;
  /** While active, every stat in `stats` gains a bonus equal to the combatant's OWN current magnitude of `statusId` — e.g. Verdant Earth granting Attack/Intelligence equal to that hero's Renew. Keyed by status id rather than hardcoding one status, so a later effect can scale off any magnitude-shape status. A hero not carrying the status gets nothing (magnitude 0), which is what makes this a build-around payoff rather than a flat global buff. A genuine stat-pipeline bonus (CLAUDE.md "Two-pipeline separation" pipeline 1), not a damage-pipeline modifier — read by state.ts getEffectiveStat. */
  statBonusEqualToStatusMagnitude?: { statusId: StatusId; stats: readonly StatKey[] };
}

/** A FieldEffectDefinition with no implemented effect shape is invalid content (nothing for it to do) — same discipline as isValidPassiveDefinition. */
export function isValidFieldEffectDefinition(fieldEffect: FieldEffectDefinition): boolean {
  return (
    fieldEffect.mpRegenMultiplier !== undefined ||
    (fieldEffect.suppressesStatusDecay?.length ?? 0) > 0 ||
    fieldEffect.reversesSpeedOrder === true ||
    fieldEffect.healPriorityBonus !== undefined ||
    (fieldEffect.statBonusEqualToStatusMagnitude?.stats.length ?? 0) > 0
  );
}

export interface MoveDefinition {
  id: string;
  name: string;
  /** The move's type — feeds STAB and TypeMult (docs/combat.md, docs/types-and-heroes.md). */
  type: TypeId;
  /** Selects the stat pipeline pair: physical -> Attack/Defense, magical -> Intelligence/Wisdom. */
  category: MoveCategory;
  kind: 'damage' | 'heal' | 'buff';
  /** damage-kind only. */
  basePower?: number;
  /**
   * damage-kind only. Per-move crit rate in [0, 1], replacing the default
   * rate for this move only (damagePipeline.ts PROVISIONAL_CRIT_CHANCE) —
   * e.g. Fire's Singe/Firebrand at "30% crit chance".
   *
   * Crit SOURCE stays locked to the loadout/equipment layer (CLAUDE.md
   * "Resolved design questions", docs/combat.md "Crit"): this is a
   * move-authored override, not a crit stat, so nothing here reaches the stat
   * pipeline. OPEN: when equipment crit chance actually exists, how a
   * high-crit move and a crit-chance accessory combine (replace / add /
   * take-higher) is a real decision — do not assume one silently.
   */
  critChance?: number;
  /**
   * damage-kind only. A BasePower multiplier that applies only when the hit's
   * target carries `requiresTargetStatus` at the moment it resolves — e.g.
   * Fire's Immolate, "triple base power if the target is Burned".
   *
   * Scales the formula's own BasePower INPUT, like Elemental Force's
   * basePowerBonus, NOT the already-computed result (that is what a
   * DamageModifier / multiplierTerm is for — CLAUDE.md "Two-pipeline
   * separation"). Order is authored BasePower x multiplier, THEN + Elemental
   * Force: "triple base power" triples the 30 the move is written at, not the
   * 40 a Fire Force accessory turns it into.
   *
   * Data, not a predicate function — same discipline as
   * StatusDefinition.triggerTypes.
   */
  conditionalPower?: {
    /**
     * The multiplier applies when the HIT'S TARGET carries this status —
     * Fire's Immolate, Frost's Cold Snap. Exactly one of this,
     * `requiresUserStatus`, `requiresFieldEffect` and
     * `requiresTargetHpBelow` must be authored; authoring none leaves the
     * multiplier permanently unapplied, which is a silent dud rather than an
     * error (there is still no isValidMoveDefinition —
     * docs/authoring-moves.md §4).
     */
    requiresTargetStatus?: StatusId;
    /**
     * The multiplier applies when the move's USER carries this status —
     * Nature's Seed Shot and Branch Slam, "double damage if the user has
     * Renew".
     *
     * The mirror of `requiresTargetStatus` above, and deliberately a sibling
     * field rather than a `side` discriminator: the two ask genuinely
     * different questions of the board and a move asking both at once has no
     * meaning worth guessing at.
     *
     * The consequence Nature is built around: this makes a damage bonus
     * something you SET UP on yourself rather than something you inflict, so
     * the same Renew that is quietly healing the caster is also what its
     * physical line is priced against. Read off the attacker's live statuses
     * at the moment the hit resolves, exactly like the target-side form — so
     * a Regrowth cast by a faster partner earlier in the same round already
     * counts.
     */
    requiresUserStatus?: StatusId;
    /**
     * The multiplier applies while this FIELD EFFECT is the active one —
     * Light's Smite, "double damage if Sanctuary is active".
     *
     * The third sibling, and the first conditional that asks about neither
     * combatant. It is deliberately NOT a `side` discriminator on the other
     * two: a field effect is not a status, nobody holds it, and there is no
     * "whose" to answer — CombatState.activeFieldEffect is one global slot
     * (docs/field-effects.md), so the question has exactly one answer per
     * round for every hit on the board.
     *
     * Two consequences that follow from that and are worth authoring
     * knowing:
     *
     * 1. **All or nothing across a spread cast.** The target-side form is
     *    re-read per hit, so a spread move can double against one foe and
     *    not the other. This form, like the user-side one, asks a single
     *    question — so a spread conditional gated on a field is doubled
     *    against every target or none.
     * 2. **The enabler is GLOBAL, so it arms both sides.** Field effects
     *    have no owner: the Consecrate a Light hero casts to heal its own
     *    team also switches on every Smite on the field, including the
     *    enemy's. That is the locked shape of the subsystem
     *    (docs/field-effects.md "one active at a time, both sides"), not an
     *    oversight — the setter is a tempo commitment, and this is what it
     *    costs.
     *
     * Read at the moment the hit RESOLVES, exactly like the status forms, so
     * a field a faster action set earlier this same round already counts —
     * which is what lets one hero cast Consecrate and its partner's Smite in
     * the same round already be doubled.
     */
    requiresFieldEffect?: FieldEffectId;
    /**
     * The multiplier applies when the HIT'S TARGET is below this fraction of
     * its max HP — Shadow’s Rend and Eclipse, "double damage if the target is
     * below 50% HP". Authored as a fraction in (0, 1); 0.5 is the only value
     * content uses today, and it is a number rather than a boolean so a later
     * slate can write an 0.25 execute without a second field.
     *
     * The fourth sibling, and the first condition in the game that reads a
     * NUMBER off the board rather than the presence of a status or a field
     * effect (docs/authoring-moves.md §4). Three consequences it is worth
     * authoring knowing:
     *
     * 1. **Read BEFORE this hit’s own damage**, off the target’s live
     *    currentHp at the moment the hit resolves. A move can never bring a
     *    target under the line and then double against the HP it just took —
     *    the execute rewards a target something ELSE already softened.
     * 2. **Per target, like the target-status form.** A spread execute doubles
     *    against the wounded foe and not the healthy one. (The user-side and
     *    field forms ask one question for the whole cast; this one does not.)
     * 3. **`consumesStatus` is inert on it**, for the same reason it is inert
     *    on `requiresFieldEffect`: there is no status and no holder to strip.
     *    resolveRound's consume branch reads
     *    `requiresTargetStatus ?? requiresUserStatus`, so this form leaves it
     *    undefined and the branch is a no-op rather than a third meaning.
     *
     * Needs the target’s max HP to answer, which the damage pipeline does not
     * otherwise have — passed to resolveConditionalPowerMultiplier as an
     * optional argument, on the same "omit it and the other forms behave
     * exactly as before" discipline as `fieldEffectCtx`.
     */
    requiresTargetHpBelow?: number;
    multiplier: number;
    /**
     * Spend the status this move just cashed in — Frost's Cold Snap,
     * "if the target is Frozen, consume it to deal double damage".
     *
     * Strips it from whichever combatant the condition READ: the target for
     * `requiresTargetStatus`, the user for `requiresUserStatus`. Neither of
     * Nature's two user-side moves authors it — a Renew that Seed Shot ate
     * would stop being the standing investment Verdant Earth also reads —
     * but the field is defined for both sides so the next slate does not
     * have to re-answer the question.
     *
     * INERT on the `requiresFieldEffect` form (Light's Smite) and on the
     * `requiresTargetHpBelow` form (Shadow’s Rend/Eclipse): there is no
     * status and no holder to strip it from. "Consume the field effect" is a
     * genuinely different mechanic — it would end a global, both-sides state
     * early, which is a field-effect question rather than a status one — and
     * is left unanswered rather than guessed at (docs/field-effects.md).
     *
     * Only fires on a hit that ACTUALLY got the multiplier, so a spread
     * conditional move strips the mark off the foe it doubled against and
     * leaves the clean one alone. Resolved after the damage lands, as its
     * own StatusRemoved beat (reason 'consumed', the same one Conduct's
     * detonation uses) rather than folded into the DamageDealt event.
     *
     * The design tension it exists to create: a Frost side holding both
     * Cold Snap and a `requiresTargetStatus` move has to choose between
     * cashing a Freeze in and keeping it as a key.
     */
    consumesStatus?: boolean;
  };
  /**
   * damage-kind only. The stat that feeds the off/def ratio's NUMERATOR, in
   * place of the one `category` would normally select — Stone's Body Blow and
   * Body Crush, "calculates the user's Defense in place of Attack".
   *
   * PIPELINE 1, not pipeline 2 (CLAUDE.md "Two-pipeline separation"). This is
   * emphatically not a damage modifier: it does not scale anything, it changes
   * which of the attacker's stats is read before the ratio is even formed. It
   * therefore composes with every multiplier term exactly as an ordinary
   * Attack-based move does, and a hero buffed to Defense 130 hits with 130 —
   * the same number Bastion and Toughen Up put there — rather than with a
   * bonus derived from it.
   *
   * The DEFENDER's side of the ratio is untouched: `category` still selects it
   * (Body Blow is physical, so it still divides by the target's Defense). Only
   * the numerator moves. The design row says "in place of Attack" and nothing
   * about the defender, and swapping both would make the move a mirror match
   * of Defense against Defense, which is a different move.
   *
   * Data, not a predicate — same discipline as conditionalPower above.
   */
  offStatOverride?: StatKey;
  /**
   * damage-kind only. Fraction of the damage this move actually removes that
   * is restored to the USER — Water's Siphon/Engulf, "heal user for 50% of
   * damage dealt".
   *
   * Deliberately NOT the healing formula (engine/heal/healPipeline.ts). It
   * takes no HealPower, no WisdomMult and no STAB of its own: the number it
   * scales is a damage number that has ALREADY been through variance, crit,
   * STAB and TypeMult, so running the heal formula over it too would apply
   * two independent scalings to one action and make a drain move read as a
   * heal move that also happens to hit. The consequence — a drain's return is
   * a fact about the attacker's offense, not about its Wisdom — is a real
   * design choice; see docs/combat.md "Drain".
   *
   * Scales the HP actually removed, not the rolled amount, so overkill into a
   * 3-HP target returns 1 rather than 45. Summed per target on a spread move.
   */
  drainPercent?: number;
  /**
   * damage-kind only. Fraction of the damage this move actually removes that
   * is dealt back to the USER as HP — Stone's Rubble Rush, "user receives
   * 1/4th damage delivered as recoil".
   *
   * The exact mirror of `drainPercent` above and it inherits that field's
   * reasoning wholesale: it scales the HP ACTUALLY removed (overkill into a
   * 3 HP target costs you 1, not a quarter of 45), it summed across a spread
   * move's targets, and it runs no formula of its own — the number it scales
   * has already been through variance, crit, STAB and TypeMult.
   *
   * Two things it does NOT share with drain:
   *
   * - It is applied ONCE, after the whole target loop, rather than per target.
   *   Drain can safely resolve inside the loop because healing cannot kill the
   *   caster mid-move; recoil can, and a caster that faints against its first
   *   target must not go on hitting the second.
   * - It CAN faint the user (2026-08-30 designer call — no 1 HP floor). A
   *   recoil KO counts toward that side's KO count like any other faint, so
   *   Rubble Rush can be the hit that triggers your own lock-in.
   *
   * This is the recoil shape docs/authoring-moves.md §4 listed as unavailable.
   * Fire's Volcanic Surge takes its recoil as a self-inflicted Burn instead and
   * should stay that way — that shape is better content where it fits. It does
   * not fit here: a Burn is a flat authored magnitude and this has to be a
   * fraction of a number that is not known until the hit lands.
   */
  recoilPercent?: number;
  /**
   * damage-kind only. This move's ENTIRE damage body is a share of the damage
   * its user has taken since its own last turn — Stone's Retribution (0.5) and
   * Stoneheart (1.0). A move authoring this carries no `basePower`.
   *
   * FIXED (true) damage, 2026-08-30 designer call: the number is dealt exactly
   * as counted. No off/def ratio, no STAB, no TypeMult, no variance, no crit,
   * no multiplier term — the damage formula is not evaluated at all, and
   * rollDamage is never called, so these two moves draw NO RNG (the same
   * determinism discipline StatusApplication.chance follows).
   *
   * The consequence is deliberate and is the whole point of the move: the
   * player can do the arithmetic themselves before pressing it, which is what
   * makes "eat a hit, then answer it" a plan rather than a gamble. The price
   * is that Stone's type chart does not apply to these two — a Stone-resistant
   * defender takes full retribution — and neither does the caster's Attack.
   * Retribution is a fact about the punishment you absorbed, not about your
   * offense.
   *
   * The counter it reads is Combatant.damageTakenSinceLastTurn (state.ts),
   * which is live: damage taken EARLIER IN THE SAME ROUND, by a faster enemy,
   * already counts. That is what separates the two moves beyond their
   * percentage — Stoneheart's Priority +1 means it acts before anything can hit
   * it and so only ever cashes in the previous round, while Retribution at
   * bracket 0 can bank a faster foe's opener first.
   *
   * A user that has taken nothing deals 0 and still spends the mana
   * (2026-08-30 designer call): the move stays pressable rather than blinking
   * out of the kit like a requiresTargetStatus move. Mistiming it is a real
   * cost, and a button that is always there is worth more than one that
   * protects you.
   */
  retributionPercent?: number;
  /** heal-kind only. The authored figure the healing formula scales (docs/combat.md "The healing formula", engine/heal/healPipeline.ts) — HP restored by a Wisdom-50 caster with no STAB, NOT a flat guaranteed amount. */
  healPower?: number;
  /**
   * Any kind. Negative amounts are debuffs — the same field covers both, and
   * a buff-kind move is simply one whose whole body is its deltas.
   *
   * On a damage move the deltas land AFTER the hit resolves (resolveRound.ts),
   * so e.g. Molten Lash's -10 Defense shapes the NEXT hit, not its own.
   */
  statDeltas?: readonly StatDelta[];
  /**
   * Where `statDeltas` land, when that is not simply the move's own resolved
   * targets — Stone's Landslide, "spread [damage]. Allies gain +20 Defense".
   *
   * The statDeltas equivalent of StatusApplication.target, and it exists for
   * the same reason: Landslide is the first move whose deltas and whose damage
   * land on OPPOSITE sides of the field, so the two cannot share one
   * resolution. Omitted means 'moveTarget', which is what every move authored
   * before it did and what almost everything should keep doing.
   *
   * Deliberately a small union rather than the full TargetMode. 'self' and
   * 'bothAllies' are the two a damage move actually wants; the random modes
   * are excluded because a second independent RNG draw inside one action is a
   * determinism question worth asking before it is worth having, and
   * 'singleAlly' is excluded because there would be no second target to
   * declare.
   */
  statDeltaTarget?: 'moveTarget' | 'self' | 'bothAllies';
  /**
   * Any kind. A HARD targeting gate: this move may only ever resolve
   * against a combatant already carrying this status — Frost's Glaciate and
   * Absolute Zero, "can only target Frozen enemies".
   *
   * The legality counterpart to `conditionalPower.requiresTargetStatus`,
   * which is the same query used as a damage bonus instead of a
   * restriction. Deliberately the same field name: same question, two
   * different things hung off the answer.
   *
   * Applied by statusEngine.ts's statusGatedTargets at BOTH ends — the
   * view refuses to offer the move when nothing legal is on the field
   * (FightScreen), and resolveRound.ts fizzles it into an ActionBlocked
   * ('targetStatusMissing') if the gate is unmet by the time it resolves,
   * which is what happens when a faster action cleanses the mark, the
   * target switches out, or Stealth redirects the hit onto an unmarked
   * partner. A fizzle costs the turn and no mana, same as the
   * noValidTarget race.
   */
  requiresTargetStatus?: StatusId;
  /** Any kind — see StatusApplication above. */
  statusApplication?: StatusApplication;
  /** Any kind — strips non-positive statuses from the move's resolved target(s) (docs/conditions.md §4 Cleanse). Positive statuses (Renew, Stealth) are never stripped — §7 "Cleanse & positive statuses" resolved this as a flat rule, not a per-move choice. */
  cleanses?: boolean;
  /**
   * Paired with `cleanses`: strip at most this many statuses instead of all of
   * them, picked at RANDOM from the eligible (non-positive) ones — Water's
   * Wash Away, "cleanse a random negative status effect". Omitted keeps the
   * all-or-nothing behaviour every Cleanse move before it had, and draws no
   * RNG at all, so those fights replay identically (same discipline as
   * StatusApplication.chance).
   *
   * Random rather than authored-priority because a chosen cleanse is a much
   * stronger effect than a partial one: at 1 this is a coin flip between
   * shedding the Poison timer and shedding the Freeze, which is what prices it
   * a tier below Purify's full strip. There is deliberately still no
   * "cleanse THIS named status" — docs/conditions.md §4 keeps Cleanse a
   * quantity, not a query.
   */
  cleanseCount?: number;
  /**
   * Any kind. Fires a TIMER-shape status's stored payload on this move's
   * resolved targets NOW, instead of when its clock runs out — Nature's
   * Miasma, "apply Poison 5, then instantly detonate Poison".
   *
   * Resolved AFTER this move's own `statusApplication`, which is what makes
   * Miasma's authored order ("apply, THEN detonate") true: the 5 it just
   * planted is part of what goes off. On a target already sitting on Poison
   * 20 the detonation is 25% of max HP, which is the whole pitch — Nature
   * spends four moves building a number the enemy is allowed to walk away
   * from, and this is the one that refuses to wait.
   *
   * Deliberately gated on `StatusDefinition.pipeline === 'timer'` rather
   * than on a literal 'Poison' id (statusEngine.ts detonateStatusNow), same
   * discipline as triggerTypes: a timer is the one status shape that HOLDS an
   * unspent payload, so it is the one shape "detonate" is meaningful for.
   * Naming a status of any other shape is a silent no-op, not an error.
   *
   * The damage it deals is the timer's own — `magnitude`% of the holder's
   * max HP, exactly what the end-of-round expiry would have dealt. FIXED
   * damage, like Stone's retribution: no ratio, no STAB, no TypeMult, no
   * variance, no crit, and no RNG drawn. See docs/combat.md.
   */
  detonatesStatus?: StatusId;
  /** Any kind — sets the battlefield's Field Effect (docs/field-effects.md). Global, so unlike statusApplication there's no target to choose. */
  fieldEffectApplication?: FieldEffectId;
  manaCost: number;
  /**
   * A REPLACEMENT price that applies only while every active enemy carries
   * `requiresAllEnemiesStatus` — Storm's Overcharge, "costs 0 mana if both
   * enemies have Conduct".
   *
   * The second authored cost that varies with state, and the first that
   * varies with the BOARD rather than with the caster's own history
   * (manaDiscountOnUse below). Kept as a replacement rather than a discount
   * so "costs 0" is authored as 0 and not as a subtraction that has to be
   * arithmetic-checked against the base price.
   *
   * Composes with manaDiscountOnUse by taking the LOWER of the two — neither
   * is meant to be a way to make the other more expensive. Resolved by
   * state.ts resolveManaCost, which is the board-aware wrapper every caller
   * (engine spend, view affordability, the gem on the button) must use;
   * effectiveManaCost stays the board-free answer for surfaces with no live
   * fight (draft, level-up, compendium), where the authored price is correct.
   *
   * "All enemies" reads over the ACTIVE enemies only, and an empty enemy side
   * does not satisfy it — a condition nothing can meet must not read as met.
   */
  conditionalManaCost?: {
    requiresAllEnemiesStatus: StatusId;
    manaCost: number;
  };
  /**
   * Each time this combatant casts this move, its cost to THAT combatant drops
   * by this much for the rest of the fight, stacking, floored at 0 — Water's
   * Wave Shred, "costs 20 less mana this combat (stackable)".
   *
   * The first authored cost that varies with state. Two things keep it from
   * being a special case:
   *
   * - The discount is per (combatant, move), stored on the combatant
   *   (state.ts Combatant.moveManaDiscounts) rather than on the move — content
   *   is shared, immutable data, and two heroes holding Wave Shred must ramp
   *   independently.
   * - Every read of "what does this cost right now" goes through
   *   state.ts effectiveManaCost, including the view's affordability check and
   *   the mana gem on the button. `manaCost` remains the AUTHORED cost and is
   *   never mutated.
   *
   * It ramps on use, so the FIRST cast is always the authored price — a hero
   * whose pool cannot reach that price can never start the ramp at all. That
   * is a real gate on the move, not an oversight; see docs/combat.md.
   */
  manaDiscountOnUse?: number;
  /** Integer priority bracket; higher resolves first. */
  priority: number;
  /**
   * Adds `bonus` to this move's priority bracket when its DECLARED target
   * carries `requiresTargetStatus` — Storm's Electric Burst, "priority +1 if
   * the target has Conduct".
   *
   * Evaluated once, in priority.ts, against the board as it stands when the
   * round is ORDERED — i.e. before any action this round resolves. That is
   * forced rather than chosen: a bracket has to be known before resolution
   * begins, so a partner planting Conduct earlier in the same round cannot
   * retroactively speed this up. The mark has to already be on the board when
   * you press the button, which is what makes this a payoff for the previous
   * round rather than a same-round combo.
   *
   * Read off `action.declaredTarget` only, so a fixed-group move (which has
   * no declared target) never gets the bonus. Data, not a predicate — same
   * discipline as conditionalPower above.
   */
  conditionalPriority?: {
    requiresTargetStatus: StatusId;
    bonus: number;
  };
  /**
   * Sends the USER back to the bench after the move's own payload resolves —
   * Storm's Tailwind, "give your ally +40 Speed, switch out". The incoming
   * hero is chosen by the player when the move is DECLARED (MoveAction
   * .switchToCombatantId), exactly like a switch action, rather than being
   * rolled or defaulted.
   *
   * Respects the LOCKED lock-in rule (CLAUDE.md "Mana & tempo"): once the
   * side has 2+ KOs this pivot is blocked like any other voluntary switch —
   * 2026-08-30 designer call. The move does NOT become unpressable when that
   * happens; the buff still lands and the mana is still spent, and only the
   * switch half fizzles (ActionBlocked, reason 'switchBlocked'). Degrading
   * rather than gating is deliberate: requiresTargetStatus is the engine's
   * one move-level HARD gate, and lock-in is a phase the player is already
   * being punished by.
   */
  switchesUserOut?: boolean;
  target: TargetMode;
  /** Presentational flavor text only — the engine never reads this. View layer use (docs/architecture.md "Resolution and presentation are separate layers"). */
  description?: string;
}

/**
 * Invariant (CLAUDE.md "Stat modifiers are flat additive integers, multiples
 * of 5 or 10"): any stat grant (Evolution, equipment, etc.) must satisfy this.
 * Applies to GRANTS, not necessarily to authored base stat lines.
 */
export function isValidFlatStatGrant(amount: number): boolean {
  return Number.isInteger(amount) && amount % 5 === 0;
}

export interface HeroDefinition {
  id: string;
  name: string;
  /** Innate type(s). Immutable across all Evolutions (CLAUDE.md "Heroes & progression"). */
  types: readonly [TypeId] | readonly [TypeId, TypeId];
  baseStats: StatLine;
  /** Move ids currently unlocked for this hero instance. */
  moveIds: readonly string[];
  /**
   * Whether this hero is offered in the start-of-run draft (src/run/draft.ts,
   * DraftScreen). `true` = starter, drawable at run start; `false` =
   * recruit-only — obtainable exclusively in-run via Guild Hall
   * (src/data/recruitment.ts) or Recruit Contract (docs/progression.md "The
   * raise-vs-recruit axis"). This is the single source of truth for the
   * split — see docs/types-and-heroes.md "Starters vs. recruit-only heroes".
   */
  starter: boolean;
}
