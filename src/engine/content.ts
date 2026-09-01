// Shared content vocabulary — the engine's contract with /src/data (docs/architecture.md).
// All acquirable content is pure data over these shapes; the engine never carries
// per-content logic. Extend a union only when content actually needs the member.

/** Opaque type-chart key; the 15 concrete types are data (src/data/typechart.ts). */
export type TypeId = string;

export type StatKey = 'hp' | 'attack' | 'defense' | 'intelligence' | 'wisdom' | 'speed' | 'manaPool' | 'mpRegen';

/** Canonical listing order for the eight stats (re-exported by view/shared/StatBars.tsx). */
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

/** 2v2 targeting (docs/combat.md). */
export type TargetMode =
  | 'singleEnemy'
  | 'singleAlly'
  | 'self'
  | 'bothEnemies'
  | 'bothAllies'
  | 'allOthers'
  /** One combatant rolled at resolution from the bothAllies/bothEnemies pool (caster included on the ally side); targeting.ts resolveTargetsRolled, no view picker. */
  | 'randomAlly'
  | 'randomEnemy';

export type MoveCategory = 'physical' | 'magical';

/** Early/Mid/Late column of the move table (docs/authoring-moves.md §2); see MoveDefinition.tier. */
export type MoveTier = 'early' | 'mid' | 'late';

/** Opaque status-catalog key; the concrete statuses are data (src/data/statuses.ts). */
export type StatusId = string;

/** docs/conditions.md §1. 'timer' (Poison): magnitude builds, duration counts down only while active, detonates at zero. */
export type StatusShape = 'magnitude' | 'boolean' | 'duration' | 'timer';

/** How a re-application combines with the existing instance. */
export type StatusStacking =
  | 'additive'
  | 'none'
  | 'takeHigher'
  /** Poison: magnitude adds, duration holds — reapplying never resets the clock. */
  | 'additiveMagnitudeFixedDuration';

/** Why a status left a combatant — carried on StatusRemovedEvent. */
export type StatusRemovalReason = 'decay' | 'expired' | 'switch' | 'cleanse' | 'consumed';

/** One record per status (docs/conditions.md); statusEngine.ts reads these flags generically. */
export interface StatusDefinition {
  id: StatusId;
  name: string;
  shape: StatusShape;
  /** DoT/HoT/countdown tick point — locked to end of round (docs/conditions.md §7). */
  ticksAtEndOfRound: boolean;
  /** Duration-shape only (Stealth): counts down at round START; a tick finding 0 removes it before that round's actions. Exclusive with ticksAtEndOfRound. */
  ticksAtStartOfRound?: boolean;
  /** Post-tick decay for magnitude statuses: 'halve' toward 0, or 'none' (Poison builds until it detonates). */
  decay: 'halve' | 'none';
  stacking: StatusStacking;
  /** Cleared by switching to the bench (docs/conditions.md §4). */
  clearsOnSwitch: boolean;
  /** Removed unconditionally at the end of the round it was applied in (Daze = flinch, needs no number). Own pass after ticks; emits StatusRemoved 'expired'. */
  clearsAtEndOfRound?: boolean;
  /** The end-of-round tick is skipped while benched (Poison's timer stalls rather than clears). */
  activeOnly?: boolean;
  /** Never stripped by Cleanse (Renew, Stealth). */
  positive?: boolean;
  /** Boolean-shape DoT (Bleed): a fixed fraction of max HP per tick instead of a magnitude. */
  flatPercentOfMaxHp?: number;
  /** Conduct: a damage move of one of these types detonates this status on the target for detonateBonusPercentMaxHp of its max HP, then consumes it. Detonate-only — planting it is an ordinary rider (statusEngine.ts detonateTriggeredStatuses). */
  triggerTypes?: readonly TypeId[];
  /** Paired with triggerTypes — fraction of the target's max HP. */
  detonateBonusPercentMaxHp?: number;
  /** Haunt: a singleEnemy damage move of one of these types also strikes an active ally-of-target carrying this status (statusEngine.ts expandSpreadTargets). */
  spreadTriggerTypes?: readonly TypeId[];
  /** Provoke: every single-target move the OPPOSING side aims at this side lands on the holder — any kind. Own-side and spread moves untouched. */
  redirectsSingleTargetEnemyMoves?: boolean;
  /** Elemental Force: magnitude added to the BasePower of moves of this type BEFORE the multiplier chain — not a DamageModifier (damagePipeline.ts resolveElementalForceBonus). One status per type. */
  forceType?: TypeId;
  /** Where the effect is wired in. Engine-read only for 'timer' (MoveDefinition.detonatesStatus). */
  pipeline: 'dot' | 'hot' | 'control' | 'timer' | 'trigger' | 'target' | 'basePower' | 'none';
  description?: string;
}

/** A fixed-magnitude status from equipment/relics (Elemental Force), applied once at fight build. */
export interface StatusGrant {
  statusId: StatusId;
  magnitude?: number;
}

export interface StatDelta {
  stat: StatKey;
  /** Flat additive; negative = debuff. */
  amount: number;
}

/** A move's status rider (docs/conditions.md §5). Any move kind may carry one. */
export interface StatusApplication {
  statusId: StatusId;
  /** Required for magnitude-shape statuses. */
  magnitude?: number;
  /** Required for duration-shape statuses. */
  duration?: number;
  /** 'moveTarget' = the move's resolved targets; the random modes roll independently of the move's target (same pool; the move's roll comes first). */
  target: 'self' | 'moveTarget' | 'randomAlly' | 'randomEnemy';
  /** Probability in [0, 1] the rider lands, rolled per resolved target; omitted = always, no RNG drawn. Gates only the rider — the move body always lands. */
  chance?: number;
}

/** Opaque passive-catalog key; concrete passives are data (src/data/passives.ts). */
export type PassiveId = string;

/** Event types a reactive Passive may key off. SwitchedIn's subject is the INCOMING combatant and fires for the opening lead too (passiveEngine.ts resolveBattleStartEntries). */
export type PassiveHook = 'DamageDealt' | 'StatusApplied' | 'StatusTicked' | 'SwitchedIn';

/** 'ally' = the owner's partner, not the owner. */
export type PassiveRelation = 'self' | 'ally' | 'enemy';

/** Declarative match against the triggering event — data, not a predicate. */
export interface PassiveTriggerCondition {
  relativeTo: PassiveRelation;
  /** Which combatant of the event `relativeTo` is measured against: 'target' (default) or 'source' (the actor). Only DamageDealt/StatusApplied carry a source — elsewhere a source-role passive never fires. */
  subjectRole?: 'target' | 'source';
  /** Every key must equal the event's same-named field (string compare), e.g. { statusId: 'Bleed', kind: 'damage' }. */
  eventFieldEquals?: Partial<Record<string, string>>;
}

/** matchTriggerAmount = the triggering event's amount (Sanguine). */
export type PassiveAmount = { kind: 'flat'; value: number } | { kind: 'matchTriggerAmount'; multiplier?: number };

/** 'activeEnemies' = every living ACTIVE enemy of the owner, resolved once per member. Never the bench: an entry passive must not tax uncommitted heroes. */
export type PassiveEffectTarget = 'self' | 'triggerSubject' | 'activeEnemies';

/** The reactive effect primitives. */
export type PassiveEffect =
  | { kind: 'heal'; target: PassiveEffectTarget; amount: PassiveAmount }
  | { kind: 'applyStatus'; target: PassiveEffectTarget; statusId: StatusId; magnitude?: number; duration?: number }
  | { kind: 'statDelta'; target: PassiveEffectTarget; stat: StatKey; amount: number }
  /** Global — no `target`. */
  | { kind: 'setFieldEffect'; fieldEffectId: FieldEffectId };

/** Damage-pipeline modifier from the attacker's own passives, evaluated per hit against { moveType }. */
export interface PassiveDamageModifier {
  eventFieldEquals?: Partial<Record<string, string>>;
  /** damagePipeline.ts DamageModifier units — 0.2 == +20%. */
  amount: number;
}

/** A stat grant that holds only while a board condition does — read live in state.ts getEffectiveStat, never folded into baselineStatModifiers. Stat pipeline, never a damage modifier. */
export interface PassiveConditionalStatGrants {
  /** Holds while any living ACTIVE enemy of the owner carries this status. */
  requiresEnemyStatus: StatusId;
  statGrants: Partial<Record<StatKey, number>>;
}

/** Must carry at least one of reactive / damageModifier / statGrants / conditionalStatGrants. */
export interface PassiveDefinition {
  id: PassiveId;
  name: string;
  /** Player-facing, required. */
  description: string;
  /** `oncePerFight` caps the whole reaction at one firing per combat regardless of stacks (state.ts PassiveInstance.firedThisFight). */
  reactive?: { hook: PassiveHook; condition: PassiveTriggerCondition; effect: PassiveEffect; oncePerFight?: boolean };
  damageModifier?: PassiveDamageModifier;
  /** Always-on flat grants, applied at fight build like Equipment/Relic statGrants (src/run/passives.ts); not read by passiveEngine. Classes are this alone. */
  statGrants?: Partial<Record<StatKey, number>>;
  /** Conditional counterpart of `statGrants` (Bloodthirsty). */
  conditionalStatGrants?: PassiveConditionalStatGrants;
}

/** Every stat grant must be a valid flat grant, and the passive must do something. */
export function isValidPassiveDefinition(passive: PassiveDefinition): boolean {
  const hasEffect =
    passive.reactive !== undefined ||
    passive.damageModifier !== undefined ||
    passive.statGrants !== undefined ||
    passive.conditionalStatGrants !== undefined;
  if (!hasEffect) return false;
  const ok = (amount: number | undefined) => amount === undefined || isValidFlatStatGrant(amount);
  return Object.values(passive.statGrants ?? {}).every(ok) && Object.values(passive.conditionalStatGrants?.statGrants ?? {}).every(ok);
}

/** Opaque field-effect-catalog key; concrete field effects are data (src/data/fieldEffects.ts). */
export type FieldEffectId = string;

/** One global battlefield state (docs/field-effects.md). Duration is not authored — fieldEffectEngine.ts FIELD_EFFECT_DURATION_ROUNDS. */
export interface FieldEffectDefinition {
  id: FieldEffectId;
  name: string;
  /** Player-facing, required. */
  description: string;
  /** Presentational only — which type's palette tints the badge/glow. */
  flavorType?: TypeId;
  /** Multiplies every combatant's MP Regen (2 = doubled). Applied in manaRegen.ts, never folded into the mpRegen stat. */
  mpRegenMultiplier?: number;
  /** Statuses whose post-tick decay is skipped while active (Scorched Land holding Burn). The tick itself still happens. */
  suppressesStatusDecay?: readonly StatusId[];
  /** Within a priority bracket, resolve slowest-first (Stasis Bubble). Bracket separation untouched. priority.ts orderActions. */
  reversesSpeedOrder?: boolean;
  /** Added to heal-kind moves' priority bracket (Sanctuary +1). priority.ts orderActions. */
  healPriorityBonus?: number;
  /** Each stat in `stats` gains the combatant's OWN current magnitude of `statusId` (Verdant Earth / Renew). Stat pipeline — state.ts getEffectiveStat. */
  statBonusEqualToStatusMagnitude?: { statusId: StatusId; stats: readonly StatKey[] };
}

/** 'reduceToHp' can charge nothing (caster already at or below); 'percentMaxHp' always charges the same toll. */
export type SelfHpCost =
  /** Lose `amount` (a fraction in (0, 1]) of MAX HP. Can faint the user. */
  | { mode: 'percentMaxHp'; amount: number }
  /** End at `amount` HP. Never heals. */
  | { mode: 'reduceToHp'; amount: number };

export interface MoveDefinition {
  id: string;
  name: string;
  /** Feeds STAB and TypeMult. */
  type: TypeId;
  /** Selects the stat pair: physical -> Attack/Defense, magical -> Intelligence/Wisdom. */
  category: MoveCategory;
  kind: 'damage' | 'heal' | 'buff';
  /** damage-kind only. */
  basePower?: number;
  /** damage-kind, exclusive with `basePower`: rolled per round in [min, max] and SHOWN before commit (Jackpot). Derived from (seed, round, combatantId, moveId) — state.ts resolveRandomBasePower — never stored, never advances rngState. BasePower-stage, so it composes with Elemental Force and conditionalPower. */
  randomBasePower?: { min: number; max: number };
  /** damage-kind only. Per-move crit rate in [0, 1], replacing damagePipeline.ts PROVISIONAL_CRIT_CHANCE. Not a crit stat; composition with equipment crit is open (docs/combat.md). */
  critChance?: number;
  /** damage-kind only. Multiplies the BasePower INPUT (authored x multiplier, THEN + Elemental Force) while the condition holds — two-pipeline separation. Author exactly one `requires*`; none = a silent dud. */
  conditionalPower?: {
    /** The hit's target carries this status. Re-read per hit, so a spread cast can double against one foe only. */
    requiresTargetStatus?: StatusId;
    /** The user carries this status (Seed Shot / Renew), read live at resolution. */
    requiresUserStatus?: StatusId;
    /** This field effect is active. All-or-nothing across a spread, and global — an enemy's field arms it too. */
    requiresFieldEffect?: FieldEffectId;
    /** The hit's target is below this fraction of max HP, read BEFORE this hit's own damage; per target. */
    requiresTargetHpBelow?: number;
    /** The user is below this fraction of max HP, snapshotted before the target loop — all-or-nothing across a spread even on a draining move. */
    requiresUserHpBelow?: number;
    /** The user's ACTIVE partner (live, effective types; never the user itself) is this type. All-or-nothing across a spread. */
    requiresPartnerType?: TypeId;
    multiplier: number;
    /** Strip the status the condition read (target or user) — only on a hit that got the multiplier, after the damage, as its own StatusRemoved 'consumed' beat. Inert on the field / HP / partner forms. */
    consumesStatus?: boolean;
  };
  /** damage-kind only. The stat read as the ratio's NUMERATOR in place of the one `category` selects (Body Blow: Defense). Stat pipeline; the defender's side is untouched. */
  offStatOverride?: StatKey;
  /** damage-kind only. Fraction of the HP actually removed (overkill returns less) healed to the user, per target. Not the healing formula (docs/combat.md "Drain"). */
  drainPercent?: number;
  /** HP the move charges its caster, on top of mana. Paid LAST — after recoil, before switchesUserOut — through applyHpDelta. Can faint the user; no floor. */
  selfHpCost?: SelfHpCost;
  /** damage-kind only. Fraction of the HP actually removed dealt back to the user, summed across targets and applied ONCE after the target loop. Can faint the user; counts toward lock-in. */
  recoilPercent?: number;
  /** damage-kind only, no basePower: the whole damage body is this share of Combatant.damageTakenSinceLastTurn (live). FIXED damage — no ratio, STAB, TypeMult, variance, crit or RNG. Took nothing = deals 0, mana still spent. */
  retributionPercent?: number;
  /** heal-kind only. Scaled by the healing formula (healPipeline.ts) — not a flat amount. */
  healPower?: number;
  /** Any kind; negative = debuff. On a damage move they land AFTER the hit. */
  statDeltas?: readonly StatDelta[];
  /** Where statDeltas land when not the move's own targets (Landslide: damage enemies, buff allies). Omitted = 'moveTarget'. */
  statDeltaTarget?: 'moveTarget' | 'self' | 'bothAllies';
  /** Probability in [0, 1] the statDeltas (and derivedStatDeltas) land, rolled once per delta target after the damage rolls; one flip gates the whole list. Omitted = always, no RNG. */
  statDeltaChance?: number;
  /** Multiplies every statDelta AMOUNT while the user's ACTIVE partner is this type (Prowl) — one StatChanged per stat. Does not reach derivedStatDeltas. */
  conditionalStatDeltas?: {
    requiresPartnerType: TypeId;
    multiplier: number;
  };
  /** Any kind. Grants `amount` to `count` DISTINCT stats drawn from `from`, rolled per target; count >= from.length grants all. `from` is authored (RANDOM_STAT_POOL, moves.ts). */
  randomStatDeltas?: {
    count: number;
    amount: number;
    from: readonly StatKey[];
  };
  /** Any kind. Doubles every negative entry of each target's statModifiers (never baselineStatModifiers). Compounds on recast; StatChanged delta = the amount added. */
  doublesStatReductions?: boolean;
  /** Any kind. Delta read off live state at cast: 'userManaBeforeCast' (before the cost is spent; overflow counts) or 'userEffectiveAttack' (via getEffectiveStat, so a recast doubles the doubled figure). Exempt from the multiples-of-5 rule (CLAUDE.md). */
  derivedStatDeltas?: {
    source: 'userManaBeforeCast' | 'userEffectiveAttack';
    stats: readonly StatKey[];
  };
  /** Any kind. Flat mana to each resolved target; may exceed the pool — uncapped, sticky overflow (docs/mana.md "Overflow"). Ally modes include the caster. Emits ManaGranted. */
  manaGrant?: number;
  /** Any kind. Replaces `target` while the field effect is active, read at RESOLUTION (a same-round setter counts). Declared against the authored `target`; applied before Stealth/Provoke/Haunt. */
  conditionalTarget?: {
    requiresFieldEffect: FieldEffectId;
    target: TargetMode;
  };
  /** Any kind. HARD gate: only resolves against a target carrying this status (Glaciate). Enforced at declaration (view) and resolution (ActionBlocked 'targetStatusMissing' — turn lost, no mana). */
  requiresTargetStatus?: StatusId;
  /** Any kind. One rider bare, or a list (Toxic Fangs); riders resolve in order, each with its own targets and chance. Always read via statusApplicationsOf. */
  statusApplication?: StatusApplication | readonly StatusApplication[];
  /** Any kind. Exactly one rider drawn uniformly per CAST (not per target), resolved after the unconditional ones. */
  randomStatusApplication?: readonly StatusApplication[];
  /** Any kind. Strips non-positive statuses from the resolved targets (docs/conditions.md §4). */
  cleanses?: boolean;
  /** With `cleanses`: strip at most this many, chosen at random. Omitted = all, no RNG. */
  cleanseCount?: number;
  /** Any kind. Fires a timer-shape status's stored payload on the resolved targets now (Miasma / Poison), after this move's own rider. No-op unless StatusDefinition.pipeline === 'timer'. Fixed damage, no RNG. */
  detonatesStatus?: StatusId;
  /** Any kind. Sets the battlefield's Field Effect — global, no target. */
  fieldEffectApplication?: FieldEffectId;
  /** Authored cost; never mutated. The live price is state.ts resolveManaCost / effectiveManaCost. */
  manaCost: number;
  /** A REPLACEMENT price while the condition holds; composes with manaDiscountOnUse by taking the lower. Author exactly ONE side (test/ironMoves.test.ts); neither = a silent dud. Enemy sides read ACTIVE unfainted enemies; an empty enemy side satisfies neither. */
  conditionalManaCost?: {
    /** Every active enemy carries it (Overcharge). */
    requiresAllEnemiesStatus?: StatusId;
    /** At least one active enemy carries it (Metallic Blade). */
    requiresAnyEnemyStatus?: StatusId;
    /** The user's ACTIVE partner is this type (Pack Leader). Needs `heroes` passed to resolveManaCost; read live, so a partner KO'd earlier in the round can fizzle the action. */
    requiresPartnerType?: TypeId;
    manaCost: number;
  };
  /** Each cast drops this move's cost for THAT combatant by this much for the rest of the fight, stacking, floored at 0 (Wave Shred; Combatant.moveManaDiscounts). */
  manaDiscountOnUse?: number;
  /** Integer priority bracket; higher resolves first. */
  priority: number;
  /** Bracket drawn uniformly from this list, REPLACING `priority`, when the round is ordered (priority.ts) — not knowable before commit. Author `priority` as the midpoint. */
  randomPriority?: readonly number[];
  /** Adds `bonus` to the bracket when the DECLARED target carries the status, evaluated once at ordering — a same-round mark cannot count. Fixed-group moves never get it. */
  conditionalPriority?: {
    requiresTargetStatus: StatusId;
    bonus: number;
  };
  /** Sends the user to the bench after its payload; the incoming hero is chosen at declaration (MoveAction.switchToCombatantId). Under lock-in only the pivot fizzles (ActionBlocked 'switchBlocked') — payload lands, mana spent. */
  switchesUserOut?: boolean;
  target: TargetMode;
  /** Level-up tier gate (MOVE_TIER_LEVEL, src/run/progression.ts); cumulative. Omitted = 'early'. The engine never reads it. */
  tier?: MoveTier;
  /** Presentational only — the engine never reads it. */
  description?: string;
}

/** Locked: stat GRANTS are flat integers, multiples of 5 (CLAUDE.md). Not applied to authored base stat lines. */
export function isValidFlatStatGrant(amount: number): boolean {
  return Number.isInteger(amount) && amount % 5 === 0;
}

const NO_STATUS_APPLICATIONS: readonly StatusApplication[] = Object.freeze([]);
/** The one reader of MoveDefinition.statusApplication (bare or list), always as a list. */
export function statusApplicationsOf(move: MoveDefinition): readonly StatusApplication[] {
  const applied = move.statusApplication;
  if (!applied) return NO_STATUS_APPLICATIONS;
  return Array.isArray(applied) ? applied : [applied as StatusApplication];
}

/** The first rider, or undefined. */
export function firstStatusApplication(move: MoveDefinition): StatusApplication | undefined {
  return statusApplicationsOf(move)[0];
}

export interface HeroDefinition {
  id: string;
  name: string;
  /** Innate type(s). Immutable across Evolutions. */
  types: readonly [TypeId] | readonly [TypeId, TypeId];
  baseStats: StatLine;
  /** Move ids currently unlocked for this hero instance. */
  moveIds: readonly string[];
  /** Offered in the start-of-run draft; false = recruit-only (Guild Hall / Recruit Contract). Single source of truth for the split. */
  starter: boolean;
}
