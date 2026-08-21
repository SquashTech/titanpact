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
  | 'allOthers';

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
  /** Post-tick decay for magnitude statuses (Burn, Regen): halve toward 0. 'none' for statuses whose magnitude doesn't decay on its own (Poison builds up until it detonates). */
  decay: 'halve' | 'none';
  stacking: StatusStacking;
  /** docs/conditions.md §4 removal table: cleared by switching to bench. */
  clearsOnSwitch: boolean;
  /** Poison only: the end-of-round tick is skipped entirely for a benched combatant (switching stalls the timer instead of clearing it) rather than ticking down regardless like Daze/Stealth do. */
  activeOnly?: boolean;
  /** The only positive status(es) — Regen, Stealth. docs/conditions.md §7 "Cleanse & positive statuses": Cleanse never strips these. */
  positive?: boolean;
  /** Boolean-shape DoT/HoT only (Bleed): fixed effect as a % of max HP instead of a magnitude. */
  flatPercentOfMaxHp?: number;
  /**
   * Conduct's hook: any `kind: 'damage'` move whose `type` is in this list
   * auto-applies this status to the target if absent, or detonates it
   * (`detonateBonusPercentMaxHp` of the target's max HP as bonus damage,
   * then consumed) if already present. Generic so a future type-triggered
   * status reuses this same engine hook (statusEngine.ts
   * applyOrDetonateTriggeredStatuses) instead of a Conduct-only special case.
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
 * carry one — a damage move inflicting Burn, a buff move also granting Regen,
 * a dedicated status move applying Haunt, etc.
 */
export interface StatusApplication {
  statusId: StatusId;
  /** Required for magnitude-shape statuses. */
  magnitude?: number;
  /** Required for duration-shape statuses. */
  duration?: number;
  /** 'self' = the move's user; 'moveTarget' = the move's own resolved target(s). */
  target: 'self' | 'moveTarget';
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
  | { kind: 'statDelta'; target: 'self' | 'triggerSubject'; stat: StatKey; amount: number };

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
  /** heal-kind only. Flat, per the flat-additive convention (CLAUDE.md "Stat modifiers"). */
  healAmount?: number;
  /** buff-kind only. Negative amounts are debuffs — same move kind covers both. */
  statDeltas?: readonly StatDelta[];
  /** Any kind — see StatusApplication above. */
  statusApplication?: StatusApplication;
  /** Any kind — strips non-positive statuses from the move's resolved target(s) (docs/conditions.md §4 Cleanse). Positive statuses (Regen, Stealth) are never stripped — §7 "Cleanse & positive statuses" resolved this as a flat rule, not a per-move choice. */
  cleanses?: boolean;
  manaCost: number;
  /** Integer priority bracket; higher resolves first. */
  priority: number;
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
