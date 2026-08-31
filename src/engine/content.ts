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

/**
 * The canonical order the eight stats are read in, everywhere they are listed
 * — stat blocks, buff chips, equipment grants, the equip comparison
 * (src/run/equipCompare.ts). Lives here beside the type rather than in the
 * view because the run layer needs it too, and two hand-kept orderings that
 * silently disagree is how a comparison lists Speed above Defense on one
 * screen and below it on the next. Re-exported by
 * src/view/shared/StatBars.tsx, which is where the view has always imported
 * it from.
 */
export const STAT_ORDER: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool', 'mpRegen'];

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

/**
 * A move's level-up tier — the `Early / Mid / Late` column of the designer's
 * move table (docs/authoring-moves.md §2). Not an engine concept: nothing in
 * combat reads it. See MoveDefinition.tier and src/run/progression.ts
 * MOVE_TIER_LEVEL.
 */
export type MoveTier = 'early' | 'mid' | 'late';

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
 *
 * `SwitchedIn` is the ENTRY hook (added 2026-08-31 for Imposing Presence,
 * src/data/passives.ts). Its subject is the INCOMING combatant
 * (passiveEngine.ts subjectOf), so `relativeTo: 'self'` reads as "when I step
 * onto the battlefield". It fires for every way a hero arrives — a declared
 * switch, a pivot move (MoveDefinition.switchesUserOut), a forced replacement
 * after a KO, and the opening lead (passiveEngine.ts resolveBattleStartEntries,
 * which synthesises the same context for the combatants a fight STARTS with,
 * since those never produce a SwitchedIn event of their own).
 */
export type PassiveHook = 'DamageDealt' | 'StatusApplied' | 'StatusTicked' | 'SwitchedIn';

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

/**
 * Who a reactive effect lands on. The first two are single combatants; the
 * third is a GROUP — every non-fainted combatant currently ACTIVE (on the
 * battlefield, not benched) on the side opposing the passive's owner. A group
 * target resolves the effect once per member (passiveEngine.ts resolveEffect),
 * so one trigger can produce several state-change events.
 *
 * `activeEnemies` is deliberately active-only. Reaching the bench would let an
 * entry passive debuff heroes that have not been committed to the fight yet,
 * which turns the switching game (CLAUDE.md "Mana & tempo") into a pre-emptive
 * tax on the opponent's whole roster rather than a read on the two heroes
 * standing in front of you.
 */
export type PassiveEffectTarget = 'self' | 'triggerSubject' | 'activeEnemies';

/** The reactive effect primitives — the atomic verbs a Passive's reaction resolves into. */
export type PassiveEffect =
  | { kind: 'heal'; target: PassiveEffectTarget; amount: PassiveAmount }
  | { kind: 'applyStatus'; target: PassiveEffectTarget; statusId: StatusId; magnitude?: number; duration?: number }
  | { kind: 'statDelta'; target: PassiveEffectTarget; stat: StatKey; amount: number }
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

/**
 * The HP a move charges its own caster — see MoveDefinition.selfHpCost below
 * for which of the three self-harm shapes this is and why it is its own field.
 *
 * A closed union rather than an amount plus a flag: "lose a quarter of your
 * maximum" and "end at 1" are different questions about the bar, and the
 * second one has to be able to charge nothing (a caster already at 1 HP) where
 * the first always charges the same toll.
 */
export type SelfHpCost =
  /** Lose `amount` (a fraction in (0, 1]) of MAX HP. Flat toll — can faint the user at low HP. */
  | { mode: 'percentMaxHp'; amount: number }
  /** End at `amount` HP. Never heals: a caster already at or below it pays nothing. */
  | { mode: 'reduceToHp'; amount: number };

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
   * damage-kind only, and MUTUALLY EXCLUSIVE with `basePower`: this move has
   * no authored number at all. The formula's BasePower input is rolled fresh
   * at the start of every round, uniformly in [min, max], and SHOWN to the
   * player before they commit — Mech's Jackpot, "randomly roll this attack's
   * base power from 50-150 at the start of each turn" (2026-08-30 designer
   * call: the number is visible on the button).
   *
   * Visibility is the whole mechanic, and it is what fixes the shape. A hidden
   * roll would be a second variance term — the formula already has one
   * (0.85-1.0, LOCKED) — and would leave the row indistinguishable from a
   * 100 BP move with a wider spread. A visible one makes it a DECISION: 80
   * mana is a lot to spend on a 61, and holding the turn to see next round's
   * 148 is a real play. The reel spins whether or not the move is pressed.
   *
   * Which forces the roll OUT of the shared RNG stream, and that is the part
   * worth understanding before a second one is authored:
   *
   * - It is DERIVED, not stored and not drawn (state.ts
   *   resolveRandomBasePower). The value is a pure function of
   *   `(seed, round, combatantId, moveId)` run through the same mulberry32 the
   *   rest of the engine uses, so the engine and the view compute the
   *   identical number from state they both already hold.
   * - Nothing is added to CombatState and `rngState` is never advanced, so
   *   every fight authored before this field replays byte-identically — the
   *   strongest form of the "default to inert" rule
   *   (docs/authoring-moves.md §5). A STORED roll would have needed a new
   *   state field and a seeding pass in both builders; a STREAM draw could not
   *   have been read before the round resolved at all, which is precisely what
   *   the design row asks for.
   * - `round` is an input, so it re-rolls every round for free, and
   *   `combatantId` is an input, so two heroes holding Jackpot see different
   *   numbers. Both fall out of the derivation rather than being arranged.
   *
   * BasePower-stage, so it composes with Elemental Force and
   * `conditionalPower` exactly as an authored number does: the rolled figure
   * IS this round's authored BasePower — multiplied first, then added to.
   */
  randomBasePower?: { min: number; max: number };
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
     * `requiresUserStatus`, `requiresFieldEffect`, `requiresTargetHpBelow`
     * and `requiresUserHpBelow` must be authored; authoring none leaves the
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
    /**
     * The multiplier applies when the move's USER is below this fraction of
     * its own max HP — Spirit's Spite ("double base power if the user is
     * below 50% HP") and Vengeance ("triple base power if the user is below
     * 25% HP"). Authored as a fraction in (0, 1).
     *
     * The fifth sibling, and the exact mirror of `requiresTargetHpBelow`
     * across the field — the same relationship `requiresUserStatus` has to
     * `requiresTargetStatus`. It was named in Shadow's hand-off as a shape
     * deliberately left unbuilt (docs/authoring-moves.md §10); Spirit is what
     * asked for it. Three consequences worth authoring knowing, and the first
     * two are what make it a genuinely different mechanic from the target-side
     * form rather than the same one pointed backwards:
     *
     * 1. **All or nothing across a spread cast.** Like the user-status and
     *    field forms, it asks ONE question about ONE combatant, so every hit
     *    in a cast gets the multiplier or none does. It is read off a
     *    SNAPSHOT of the caster taken before the target loop runs, which is
     *    what keeps that true on a move that also drains: a cast cannot heal
     *    itself back over the line partway through its own target list.
     * 2. **The condition is a resource the caster spends, not one it
     *    inflicts.** An execute gets more likely as its victim dies; this
     *    gets more likely as YOU die, which means Spirit's damage ceiling and
     *    its survival are the same bar. That is the whole type, and it is
     *    also why the slate pairs it with `selfHpCost` — Soul Offering and
     *    Last Rites are the moves that put you under the line on purpose.
     * 3. **`consumesStatus` is inert on it**, for the same reason it is inert
     *    on `requiresFieldEffect` and `requiresTargetHpBelow`: there is no
     *    status and no holder to strip. resolveRound's consume branch reads
     *    `requiresTargetStatus ?? requiresUserStatus`, so this form leaves it
     *    undefined and the branch is a no-op.
     *
     * Needs the USER's max HP to answer, passed alongside its current HP as
     * `attackerHp` on the same "omit it and every other form behaves exactly
     * as before" discipline `targetMaxHp` and `fieldEffectCtx` follow.
     */
    requiresUserHpBelow?: number;
    /**
     * The multiplier applies while the user's ACTIVE PARTNER is of this type —
     * Beast's Pack Hunt, "double base power if partner is a Beast".
     *
     * The sixth sibling, and the first condition in the game that reads
     * neither a status, nor a field, nor a number, but the OTHER HERO ON YOUR
     * OWN SIDE. Four things fix its shape, all 2026-08-30 designer calls:
     *
     * 1. **The active partner only, read live at resolution.** The hero
     *    standing in the other slot when the hit lands — not the bench, not
     *    the roster. An empty slot, a fainted partner, or a partner switched
     *    out earlier in the same round all answer NO, and a Beast switched IN
     *    earlier in the same round answers yes.
     * 2. **The partner, never the caster.** A Beast hero next to a Fire one
     *    gets nothing; its own type is not what the row asks about. This is
     *    deliberately a DOUBLES condition — the only one in the game that a
     *    player answers at draft time rather than in the fight.
     * 3. **Effective types, so a type-graft counts** (state.ts
     *    effectiveTypes): a partner that grafted Beast onto its innate type
     *    via an Evolution satisfies this exactly as an innate Beast does.
     * 4. **All or nothing across a spread cast**, like the user-status, field
     *    and user-HP forms: it asks one question about one combatant, so
     *    every hit in the cast is doubled or none is.
     *
     * `consumesStatus` is inert on it — there is no status and no holder to
     * strip, the same answer both HP forms and the field form got.
     *
     * Needs the partner's types to answer, which the damage pipeline does not
     * otherwise have — passed to resolveConditionalPowerMultiplier as an
     * optional argument on the same "omit it and every other form behaves
     * exactly as before" discipline `targetMaxHp`, `attackerHp` and
     * `fieldEffectCtx` follow.
     */
    requiresPartnerType?: TypeId;
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
     * INERT on the `requiresFieldEffect` form (Light's Smite) and on both HP
     * forms (`requiresTargetHpBelow` — Shadow’s Rend/Eclipse;
     * `requiresUserHpBelow` — Spirit's Spite/Vengeance): there is no
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
   * What this move costs its own caster in HP, on top of its mana — Spirit's
   * Soul Offering ("user loses 25% of max HP") and Last Rites ("user drops to
   * 1 HP after using this").
   *
   * The THIRD way a move can hurt its user, and deliberately its own field
   * rather than a mode on either of the other two, because it is the only one
   * whose price is knowable before the move is pressed:
   *
   * - `recoilPercent` bills a fraction of damage this move DEALT, so it is
   *   unknown until the hit lands and is meaningless on a move with no
   *   damage body. Soul Offering has none.
   * - Fire's Volcanic Surge takes its cost as a self-inflicted Burn — a
   *   status, spread over rounds, cleansable and switchable.
   * - This is HP, now, off a figure the player can already read on their own
   *   bar. It is what makes the cost a DECISION rather than an outcome.
   *
   * Two modes, a small union on the same discipline as
   * `derivedStatDeltas.source` — a later slate wanting "half of current HP"
   * adds a member, not a field, and certainly not a predicate:
   *
   * - `percentMaxHp` — lose `amount` (a fraction in (0, 1]) of MAX HP.
   *   A flat toll: it costs the same whether you are full or nearly dead,
   *   which is exactly what makes it dangerous at low HP.
   * - `reduceToHp` — end at `amount` HP, losing however much that takes.
   *   Never a heal: a caster already at or below `amount` loses nothing
   *   rather than being topped up to it. Last Rites is the only content.
   *
   * **It can faint the user** (2026-08-30 designer call), with no floor —
   * the same answer `recoilPercent` got and for the same reason: a Spirit
   * hero cashing itself in to leave its partner +40 Attack and +40
   * Intelligence is the play the move exists to offer, and a floor would
   * make the cost cheapest exactly when it should be most dangerous. A
   * `reduceToHp: 1` move cannot faint anyone by construction; a
   * `percentMaxHp` one at low HP can, and applyHpDelta handles that KO
   * exactly as it would an enemy's, lock-in included.
   *
   * Paid LAST, after the move's whole payload has landed on a board the
   * caster was still standing on — the same placement and the same reasoning
   * as `switchesUserOut`, which it sits directly in front of (so a caster
   * that killed itself cannot then pivot). It routes through applyHpDelta
   * like every other HP write, so it feeds `damageTakenSinceLastTurn`,
   * faint handling and the HP bar with no special-casing.
   *
   * Composes with any `kind`. Nothing stops a damage move from authoring one
   * alongside `recoilPercent`; both would be paid, recoil first.
   */
  selfHpCost?: SelfHpCost;
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
   * Probability in [0, 1] that this move's `statDeltas` actually land — Mind's
   * Psi Bolt, Psychock and Psionic Wave, "20% chance to reduce the target's
   * Wisdom by 20".
   *
   * The exact sibling of `StatusApplication.chance` and it inherits that
   * field's three rules wholesale, because a chanced stat delta and a chanced
   * status rider are the same mechanic pointed at different state:
   *
   * - **It gates the RIDER, never the move.** The damage/heal/buff body
   *   resolves unconditionally — CLAUDE.md "No accuracy stat", moves always
   *   land. Psi Bolt at 20% is a 40 BP hit that sometimes also debuffs, not a
   *   debuff that sometimes misses.
   * - **Rolled once per resolved stat-delta target**, so a chanced SPREAD move
   *   (Psionic Wave) can catch one foe and miss the other. Rolled after this
   *   action's damage rolls and before the next action's, the same fixed draw
   *   order StatusApplication.chance sits in (docs/architecture.md
   *   "Determinism & RNG").
   * - **Omitted draws no RNG at all**, so every move authored before this
   *   field replays identically.
   *
   * Gates the whole delta list together rather than per delta: a row reading
   * "20% chance to reduce Intelligence and Wisdom by 30" is one coin flip with
   * two consequences, not two flips. A move wanting independent odds per stat
   * would need a different field, and nothing has asked for one.
   *
   * Applies to `derivedStatDeltas` too, since those expand into ordinary
   * StatDeltas before this is read — no content combines them today.
   */
  statDeltaChance?: number;
  /**
   * Multiplies every one of this move's `statDeltas` while the caster's ACTIVE
   * PARTNER is of the named type — Beast's Prowl, "user gains +10 Attack and
   * +10 Speed. Doubled if partner is a Beast".
   *
   * The third place the partner-type condition is hung (after
   * `conditionalPower.requiresPartnerType`, which multiplies BasePower, and
   * `conditionalManaCost.requiresPartnerType`, which replaces the price), and
   * it exists for the same reason those are sibling fields rather than one
   * shared predicate: the condition is the same question, but what hangs off
   * the answer is a different mechanic each time, and folding them into one
   * field would make a move that wants two of them unauthorable.
   *
   * Same partner rule as both (active slot only, effective types, live when
   * the deltas land), and it multiplies the AMOUNTS rather than applying them
   * twice — so a +10 becomes a +20 and lands as one StatChanged, not two.
   * A debuff is multiplied the same way; nothing authors one today.
   *
   * It does NOT touch the multiples-of-5/10 lock (CLAUDE.md), the same
   * reasoning `doublesStatReductions` gets: doubling a multiple of 5 is a
   * multiple of 5. Author a multiplier that breaks that (1.5) and it is the
   * multiplier that is wrong, not this field.
   *
   * Deliberately does NOT reach `derivedStatDeltas` — a derived amount is
   * already read off live state, and scaling one would be two board reads
   * stacked on a number the player is looking at. Nothing authors both.
   */
  conditionalStatDeltas?: {
    requiresPartnerType: TypeId;
    multiplier: number;
  };
  /**
   * Any kind. Grants `amount` to `count` stats drawn at RANDOM from `from` —
   * Mech's Overclock ("give allies +20 to a random stat"), Piston Punch ("gain
   * +5 to a random stat") and Jury-Rig ("+20 to two random stats").
   *
   * Lands through the same path as `statDeltas`: same `statDeltaTarget`
   * resolution, same StatChanged events, same flat additive integers on
   * `statModifiers`, so a move may author both and they concatenate. What is
   * new is only WHICH stats — the amount is authored, unlike
   * `derivedStatDeltas`, so the multiples-of-5/10 lock (CLAUDE.md) binds here
   * with no exemption.
   *
   * Three things fix its shape, and the first two are 2026-08-30 designer
   * calls rather than mechanics:
   *
   * - **`from` is authored, not implied.** The pool is the five COMBAT stats
   *   (RANDOM_STAT_POOL, src/data/moves.ts) rather than every StatKey, because
   *   +20 is worth wildly different amounts across the eight: +20 MP Regen is
   *   twice the Everflow banner and +20 HP on a 130-HP hero is noise, so a
   *   reel including them would be mostly duds around one jackpot. Kept on the
   *   move as DATA rather than hardcoded in the engine — the same discipline
   *   StatusDefinition.triggerTypes follows.
   * - **Rolled independently PER TARGET.** Overclock can land +20 Defense on
   *   one ally and +20 Speed on the other. That is the grammar
   *   `StatusApplication.chance` and `statDeltaChance` already use (one roll
   *   per resolved target), and it is what makes the move read as a machine
   *   misfiring rather than as a tidy team buff.
   * - **`count` draws DISTINCT stats.** Jury-Rig is +20 to two different
   *   stats, never +40 to one: it draws without replacement, and a `count` at
   *   or above `from.length` simply grants all of them.
   *
   * Draws no RNG at all when absent, so every move authored before it replays
   * identically.
   */
  randomStatDeltas?: {
    count: number;
    amount: number;
    from: readonly StatKey[];
  };
  /**
   * Any kind. DOUBLES every stat this move's resolved targets are already
   * debuffed on — Mind's Brain Flay, "spread, double stat reductions on
   * enemies". The slate's capstone and the payoff for a type with six
   * stat-reduction rows.
   *
   * Reads and writes `Combatant.statModifiers` ONLY, never
   * `baselineStatModifiers`. That split is the whole definition: statModifiers
   * is what this fight has inflicted, baselineStatModifiers is the loadout
   * (equipment, relics, class, Evolution grants — src/run/). Doubling the NET
   * of the two would make a target's armor change how hard its debuffs are
   * amplified, which is not what "double stat reductions" says and is not a
   * relationship anything else in the game has.
   *
   * Every stat with a negative modifier, not a named list. Break Will reduces
   * Attack and Lull reduces Intelligence, so restricting this to the magical
   * pair would make the slate's own biggest debuff not a payoff for its own
   * capstone.
   *
   * Three things fix its shape:
   *
   * - **It COMPOUNDS** (2026-08-30 designer call). A second cast doubles the
   *   already-doubled figure: -50 -> -100 -> -200. There is no per-fight flag
   *   and no memory of the original reduction — the move reads the number on
   *   the board and doubles it, which is the rule a player can do in their
   *   head. The price is 80 mana, a spread cast, and needing the debuffs to
   *   already be there.
   * - **It cannot drive a stat below 1.** Nothing here clamps; state.ts
   *   getEffectiveStat does, for every reader at once. The modifier itself is
   *   allowed to go arbitrarily negative — what a player sees is the floored
   *   stat, so a third cast into an already-bottomed-out target is a real
   *   waste rather than a hidden one.
   * - **It does not touch the multiples-of-5/10 lock** (CLAUDE.md). Doubling a
   *   multiple of 5 is a multiple of 5, so unlike `derivedStatDeltas` this
   *   needs no exemption.
   *
   * Emits an ordinary `StatChanged` per stat it doubles, with `delta` set to
   * the amount ADDED (a -50 becoming -100 reports -50), so the Battle Log and
   * every view reading the event stream need no special case.
   */
  doublesStatReductions?: boolean;
  /**
   * Any kind. Stat deltas whose AMOUNT is read off live state at cast time
   * rather than authored as a number — Arcane's Arcane Overflow, "allies gain
   * Attack and Intelligence equal to the user's current Mana (before casting
   * this)".
   *
   * Lands through exactly the same path as `statDeltas` above — same
   * `statDeltaTarget` resolution, same StatChanged events, same flat additive
   * integers on `Combatant.statModifiers` — so a move may author both and they
   * simply concatenate. What is new is only where the number comes from.
   *
   * Three things fix its shape:
   *
   * - **`source` is a small union, not a predicate.** Data, not a function
   *   (same discipline as `StatusDefinition.triggerTypes` and every
   *   conditional above). 'userManaBeforeCast' is the only member today; a
   *   later slate wanting "equal to missing HP" adds a member here rather
   *   than a second field.
   * - **Read BEFORE the mana is spent.** The design row says so explicitly,
   *   and it is the whole shape of the move: Arcane Overflow cashes in a pool
   *   you spent the previous rounds filling, so charging it first would make
   *   the move quietly worth 80 less than it reads. resolveRound captures the
   *   figure at the top of the action alongside `damageTakenSinceLastTurn`,
   *   for the same reason — one read, before anything this action does.
   * - **It is EXEMPT from the multiples-of-5/10 rule** (CLAUDE.md "Stat
   *   modifiers are flat additive integers, multiples of 5 or 10"), by
   *   2026-08-30 designer call. A derived grant has no authored number to
   *   round, and rounding it would make the readout disagree with the mana
   *   numeral the player is looking at. The lock still binds every AUTHORED
   *   delta; this is the one documented hole in it, and `isValidFlatStatGrant`
   *   deliberately does not reach here.
   *
   * Overflow mana counts (docs/mana.md "Overflow"). That is the combo the
   * Arcane slate is built around — Font of Power into Arcane Overflow — and
   * it is intended: the number is a fact about a resource the player spent
   * whole turns banking, and it is spent the moment it is read, because the
   * mana is still there to be burned on something else.
   *
   * The second member is Beast's Apex Predator, "double the user's Attack"
   * (2026-08-30 designer call): `userEffectiveAttack` reads the number on the
   * caster's own bar RIGHT NOW — base, plus equipment and relics, plus every
   * buff this fight has landed, minus every debuff — and grants that much
   * Attack, which is what makes the move a doubling rather than a flat +90.
   *
   * Three consequences it is worth authoring knowing, and they are what the
   * "read the board" answer buys:
   *
   * - **Setup compounds into it.** Rally (+20) and Prowl (+20 with a Beast
   *   partner) before it are worth double again the moment it lands, so the
   *   type's buff rows are a ramp rather than a list.
   * - **A second cast doubles the doubled figure** (90 -> 180 -> 360), the
   *   same rule and the same reasoning as `doublesStatReductions`: it doubles
   *   the number on the board, which is arithmetic a player can do in their
   *   head. Nothing memoises the original.
   * - **A debuffed caster doubles the debuffed number.** It reads through
   *   `getEffectiveStat`, so a Break Will landed first genuinely halves what
   *   this capstone is worth — and the floor of 1 applies here like everywhere
   *   else.
   *
   * It takes the same exemption from the multiples-of-5/10 rule the mana
   * member does, and needs it for the same reason: an effective Attack of 53
   * doubles to 106, and rounding it would make the buff disagree with the
   * numeral on the caster's own stat block.
   */
  derivedStatDeltas?: {
    source: 'userManaBeforeCast' | 'userEffectiveAttack';
    stats: readonly StatKey[];
  };
  /**
   * Any kind. Hands the move's resolved targets flat mana — Arcane's Infuse
   * (40), Empower (80), Conduit (150) and Font of Power (150), "give an ally
   * N mana (can exceed their max)".
   *
   * The first content that moves mana between combatants at all, and the
   * reason `Combatant.currentMana` is no longer bounded by the pool
   * (state.ts, docs/mana.md "Overflow"). Overflow is UNCAPPED and STICKY
   * (2026-08-30 designer call): nothing claws it back — MP Regen stops
   * helping above the pool but never lowers you, Rest tops up TO the pool and
   * never below what you already hold, and it survives a switch to the bench
   * exactly as ordinary mana does. It resets with everything else at the next
   * map node (run/buildCombatState.ts), which is the only place it ends other
   * than being spent.
   *
   * Two consequences worth authoring knowing:
   *
   * - **It is a tempo trade, not free value, unless it overflows.** Infuse
   *   spends 20 to give 40; on a partner sitting at full pool the surplus
   *   would once have evaporated, and the whole point of the uncapped rule is
   *   that it no longer does. This is what lets a 150-mana capstone
   *   (Singularity) exist for a roster whose biggest pool is 90.
   * - **Ally modes include the caster** (targeting.ts activeOf), so Infuse on
   *   yourself is a legal 20-for-40 self-ramp and Font of Power's `bothAllies`
   *   pays the caster too. Intended: the battery is allowed to charge itself,
   *   just less efficiently than it charges a partner it does not also have
   *   to pay the cost from.
   *
   * Emitted as its own `ManaGranted` event rather than a bare `ManaChanged`,
   * for the same reason drain is emitted as a `Healed` pointing at itself: a
   * mana jump with no named cause is unreadable in the Battle Log, and this
   * one is an entire move's payload.
   */
  manaGrant?: number;
  /**
   * Any kind. Replaces this move's `target` while `requiresFieldEffect` is the
   * active battlefield state — Arcane's Overload, "spread if Magical Surge is
   * active".
   *
   * The first move whose TARGETING varies with the board, and the fourth
   * conditional shape overall after `conditionalPower`, `conditionalPriority`
   * and `conditionalManaCost`. Read at RESOLUTION (2026-08-30 designer call),
   * which puts it with `conditionalPower.requiresFieldEffect` and
   * `conditionalManaCost` rather than with `conditionalPriority`:
   *
   * - A bracket has to be settled before anything resolves, so
   *   `conditionalPriority` genuinely cannot see a same-round setter. A target
   *   list does not — it is already resolved per action, in order — so the
   *   restriction would be arbitrary here.
   * - Which means a partner casting Mana Font earlier in the same round
   *   already makes Overload spread, and the two moves are a combo rather than
   *   a two-round setup.
   *
   * The player still DECLARES against the authored `target`
   * (Overload is `singleEnemy`, so the target panel opens as normal); the
   * conditional mode simply supersedes it when the move lands, and a
   * fixed-group mode ignores the declared target the way it always has. The
   * chip on the move button reports whether the field is up, so the swap is
   * never a surprise (FightScreen MoveRow).
   *
   * Applied before Stealth's redirect, Provoke's redirect and Haunt's spread,
   * all of which read the EFFECTIVE mode — a conditionally-spread Overload is
   * a spread move for every one of those rules, exactly as an authored
   * `bothEnemies` move is.
   */
  conditionalTarget?: {
    requiresFieldEffect: FieldEffectId;
    target: TargetMode;
  };
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
  /**
   * Any kind — see StatusApplication above. ONE rider written bare, or a LIST
   * when a design row applies more than one status in a single cast: Beast's
   * Toxic Fangs, "afflict Bleed and Poison 10" (2026-08-30 designer call).
   *
   * A union rather than an unconditional array so the ~50 moves authored
   * before it stay byte-identical — a single rider reads as a single rider,
   * which is what almost every row is. Nothing reads this field directly;
   * every consumer goes through `statusApplicationsOf` below, which is the
   * chokepoint that makes the two shapes one path.
   *
   * Ordered: the riders resolve in authored order, each resolving its OWN
   * targets and rolling its OWN `chance` (so a list of one draws exactly the
   * RNG it always did, and a two-rider move draws two rolls only if both
   * author odds). Beyond the order there is no relationship between them —
   * two riders on one move are two independent applications that happen to
   * share a cast, not a compound status.
   */
  statusApplication?: StatusApplication | readonly StatusApplication[];
  /**
   * Any kind. Applies exactly ONE rider, drawn at random from this list —
   * Mech's Malfunction, "randomly apply Burn 20, Poison 20, or Conduct to the
   * target".
   *
   * The counterpart to `statusApplication`'s list form, and deliberately its
   * own field rather than a flag on it: that list applies ALL of its riders
   * (Beast's Toxic Fangs is Bleed AND Poison 10), this one applies one OF
   * them. A move may author both; the drawn rider resolves after the
   * unconditional ones, through the identical path.
   *
   * Drawn once **per cast**, not per target, and that is forced rather than
   * chosen: every candidate carries its own `target`, so drawing per target
   * would apply a `self`-targeted candidate once for each enemy the move hit.
   * One draw per cast also keeps the rule a player can state — "this applies
   * one of three" — and the drawn rider then resolves its own targets and
   * rolls its own `chance` exactly as an authored one does. Moot for
   * Malfunction, which is single-target; the rule matters the moment a spread
   * one is written.
   *
   * Uniform over the list. Weighting is deliberately not a field: nothing has
   * asked for it, and a loaded reel is a different mechanic from a fair one.
   */
  randomStatusApplication?: readonly StatusApplication[];
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
   * A REPLACEMENT price that applies while the enemy side carries a named
   * status — Storm's Overcharge, "costs 0 mana if BOTH enemies have Conduct"
   * (`requiresAllEnemiesStatus`), and Iron's Metallic Blade, "costs 0 mana if
   * AN enemy has Conduct" (`requiresAnyEnemyStatus`).
   *
   * The second authored cost that varies with state, and the first that
   * varies with the BOARD rather than with the caster's own history
   * (manaDiscountOnUse below). Kept as a replacement rather than a discount
   * so "costs 0" is authored as 0 and not as a subtraction that has to be
   * arithmetic-checked against the base price.
   *
   * **Author exactly ONE of the two sides** — the same discipline
   * `conditionalPower`'s five siblings follow. Nothing in the type system
   * enforces it; `test/ironMoves.test.ts` pins "exactly one side" across the
   * whole move table, so a third sibling fails the moment it is authored
   * without extending that list. A `conditionalManaCost` authoring neither is
   * a silent dud that simply never fires.
   *
   * Composes with manaDiscountOnUse by taking the LOWER of the two — neither
   * is meant to be a way to make the other more expensive. Resolved by
   * state.ts resolveManaCost, which is the board-aware wrapper every caller
   * (engine spend, view affordability, the gem on the button) must use;
   * effectiveManaCost stays the board-free answer for surfaces with no live
   * fight (draft, level-up, compendium), where the authored price is correct.
   *
   * Both sides read over the ACTIVE enemies only, and an empty enemy side
   * satisfies NEITHER — a condition nothing can meet must not read as met.
   * (For the "all" side that means rejecting a vacuous `every`; for the "any"
   * side `some` already returns false, and the guard is shared.)
   *
   * The behavioural difference between the two is the whole reason the "any"
   * side exists, and it is specific to Conduct: an Iron damage move DETONATES
   * the mark it reads (statuses.ts triggerTypes), so a Metallic Blade swung at
   * the marked foe cashes the mark and ends its own discount, while one swung
   * at the unmarked foe stays free next round. "Spend it or bank it" is the
   * decision; `requiresAllEnemiesStatus` has no equivalent, because a
   * fully-marked board cannot survive the cast that reads it.
   */
  conditionalManaCost?: {
    requiresAllEnemiesStatus?: StatusId;
    requiresAnyEnemyStatus?: StatusId;
    /**
     * The replacement price applies while the caster's ACTIVE PARTNER is of
     * this type — Beast's Pack Leader, "costs 50 mana if partner is a Beast".
     *
     * The THIRD side, and the first that reads the caster's OWN side of the
     * field rather than the enemy's. Same partner rule as
     * `conditionalPower.requiresPartnerType` (active slot only, effective
     * types, live at resolution) and the same "author exactly one side"
     * discipline as the two above it.
     *
     * One consequence worth authoring knowing, and it is the price of reading
     * live: a partner KO'd earlier in the same round takes the discount away
     * AFTER the player has already committed, and if the caster cannot cover
     * the difference the action fizzles for no mana (resolveRound's mana
     * legality guard) exactly as a cleansed Overcharge does. That is the
     * accepted shape rather than an oversight — the condition is a fact about
     * the board when the move lands, and every other board-reading price in
     * the game is read the same way.
     *
     * Needs the hero definitions to answer (a Combatant carries a heroId, not
     * its types), which is why resolveManaCost takes an optional `heroes`
     * record: omit it and this side simply never fires, leaving the two
     * enemy-side forms byte-identical for every caller that has no roster in
     * scope.
     */
    requiresPartnerType?: TypeId;
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
   * The bracket this move actually resolves in is drawn at random from this
   * list, REPLACING `priority` above — Mech's Cog Bop and Cog Slam, "randomly
   * Priority -1 or +1".
   *
   * Rolled in priority.ts when the round is ORDERED: after both sides have
   * committed, before anything resolves. That timing is forced by the same
   * structural fact `conditionalPriority` runs into — a bracket has to be
   * settled before resolution begins — but here it is also the mechanic. The
   * player presses Cog Bop knowing only that it is a coin flip, which is what
   * makes it a gamble rather than a fast move with a drawback.
   *
   * It replaces rather than adds, because the design row names the brackets
   * outright. `priority` is still authored (the field is required) and is
   * still the honest answer on every surface with no round to roll in — the
   * draft, the level-up screen, the compendium, and `effectivePriority`, which
   * the view calls to print a live bracket and which deliberately does not
   * roll. Author it as the midpoint of the list; the button prints the range.
   *
   * Draws from the SHARED stream, unlike `randomBasePower` above, and the
   * asymmetry is the whole point: this roll must not be knowable before the
   * player commits, so it belongs in the round's own RNG rather than in a
   * figure the view could derive for itself. Drawn in action order, before the
   * speed tiebreaks, so the sequence stays fixed. A move authoring no list
   * draws nothing.
   */
  randomPriority?: readonly number[];
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
  /**
   * The `Early / Mid / Late` column of the designer's move table
   * (docs/authoring-moves.md §2), and the only level-up-facing field on a
   * move — the engine never reads it. It gates when a move may first be
   * OFFERED on level-up: `MOVE_TIER_LEVEL` (src/run/progression.ts) maps each
   * tier to the hero level that unlocks it, and `levelUpMovePool` filters a
   * hero's pool by it.
   *
   * Cumulative, not a window: a tier unlocked stays unlocked, so a level-9
   * hero can still draw an Early move it never happened to be offered.
   * Exclusive windows would make a skipped move permanently unreachable and
   * could empty a pool outright — a Training Point spent on nothing.
   *
   * OMITTED MEANS `'early'`, i.e. ungated: the behavior every move had before
   * this field existed. Deliberate — a slate whose tier column was never
   * recorded keeps working, and no move is ever gated by an unauthored guess.
   * Which slates carry real tiers is pinned by test/moveTiers.test.ts.
   */
  tier?: MoveTier;
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

/**
 * A move's status riders, always as a list — the one reader of
 * `MoveDefinition.statusApplication`, which is authored bare when there is one
 * and as an array when there is more than one (Beast's Toxic Fangs).
 *
 * Every consumer goes through this rather than touching the field: the engine's
 * apply loop, the three player-facing surfaces (MoveTile, MoveDetailOverlay,
 * FightScreen), the status-test fight builder, and the slate tests. That is
 * what keeps "a move applies statuses" one code path instead of two, and it is
 * why widening the field cost nothing at the ~50 call sites that only ever
 * cared about the first one.
 *
 * Returns a frozen empty array for a move with no rider, so callers can map and
 * filter unconditionally.
 */
const NO_STATUS_APPLICATIONS: readonly StatusApplication[] = Object.freeze([]);
export function statusApplicationsOf(move: MoveDefinition): readonly StatusApplication[] {
  const applied = move.statusApplication;
  if (!applied) return NO_STATUS_APPLICATIONS;
  return Array.isArray(applied) ? applied : [applied as StatusApplication];
}

/** `statusApplicationsOf`'s single-rider shorthand — the first rider, or undefined. For the many surfaces that only ever showed one, and for tests pinning a specific move's authored rider. */
export function firstStatusApplication(move: MoveDefinition): StatusApplication | undefined {
  return statusApplicationsOf(move)[0];
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
