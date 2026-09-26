// Shared content vocabulary — the engine's contract with /src/data (docs/architecture.md).
// All acquirable content is pure data over these shapes; the engine never carries
// per-content logic. Extend a union only when content actually needs the member.

/** Opaque type-chart key; the 15 concrete types are data (src/data/typechart.ts). */
export type TypeId = string;

export type StatKey = 'hp' | 'attack' | 'defense' | 'intelligence' | 'wisdom' | 'speed' | 'manaPool' | 'mpRegen';

/** The seven a growth grade exists for: MP Regen is outside the 550 budget and outside every per-hero grant (src/run/growth.ts). */
export type GrowthStatKey = Exclude<StatKey, 'mpRegen'>;

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
export type StatusRemovalReason = 'decay' | 'expired' | 'switch' | 'cleanse' | 'consumed' | 'broken';

/** One record per status (docs/conditions.md); statusEngine.ts reads these flags generically. */
export interface StatusDefinition {
  id: StatusId;
  name: string;
  shape: StatusShape;
  /** DoT/HoT/countdown tick point — locked to end of round (docs/conditions.md §7). */
  ticksAtEndOfRound: boolean;
  /** Post-tick decay for magnitude statuses: 'halve' toward 0, or 'none' (Poison builds until it detonates). */
  decay: 'halve' | 'none';
  stacking: StatusStacking;
  /** Cleared by switching to the bench (docs/conditions.md §4). */
  clearsOnSwitch: boolean;
  /** Removed unconditionally at the end of the round it was applied in (Daze = flinch, needs no number). Own pass after ticks; emits StatusRemoved 'expired'. */
  clearsAtEndOfRound?: boolean;
  /** The end-of-round tick is skipped while benched (Poison's timer stalls rather than clears). */
  activeOnly?: boolean;
  /** Never stripped by Cleanse (Renew, Ambush). */
  positive?: boolean;
  /**
   * The holder is skipped as a target of any move declared by the OPPOSING side — the whole
   * payload, damage and riders alike, resolves against everyone else instead (Barrier). An ally's
   * move still lands, which is what keeps a guard a defensive turn rather than an isolating one.
   * Applied after every redirect, so a Provoke pull onto a guarded hero fizzles too.
   */
  blocksIncomingMoves?: boolean;
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
  /** Ambush: a typeless Force — magnitude added to the BasePower of EVERY move the holder uses. Exclusive with forceType. */
  forceAllTypes?: boolean;
  /** Ambush: spent once the damage move that read it has resolved all of its hits, so a spread pays on every target and still costs one. */
  consumedOnDamage?: boolean;
  /** Raises the holder's DAMAGE moves by this many priority brackets while held (Poised; priority.ts actionPriority). Paired with consumedOnDamage, it is one early strike. */
  priorityBonus?: number;
  /**
   * Ice Shell (docs/shield.md §3.5): held beside a Shield, this status lands its rider on the
   * striker whose hit BREAKS the holder's Shield, then is consumed. Never fires on any other
   * removal; inert on a holder with no Shield.
   */
  onShieldBroken?: { statusId: StatusId; magnitude?: number; duration?: number };
  /** Where the effect is wired in. Engine-read only for 'timer' (MoveDefinition.detonatesStatus) and 'shield' (a pool taken from before HP — status/shield.ts, docs/shield.md). */
  pipeline: 'dot' | 'hot' | 'control' | 'timer' | 'trigger' | 'target' | 'basePower' | 'shield' | 'none';
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
  /** 'moveTarget' = the move's resolved targets; 'bothAllies' and the random modes resolve against the CASTER's side instead (the random modes roll after the move's own roll). */
  target: 'self' | 'moveTarget' | 'bothAllies' | 'randomAlly' | 'randomEnemy';
  /** Probability in [0, 1] the rider lands, rolled per resolved target; omitted = always, no RNG drawn. Gates only the rider — the move body always lands. */
  chance?: number;
}

/** Opaque passive-catalog key; concrete passives are data (src/data/passives.ts). */
export type PassiveId = string;

/**
 * Event types a reactive Passive may key off. SwitchedIn's subject is the INCOMING combatant
 * and fires for the opening lead too (passiveEngine.ts resolveBattleStartEntries).
 * StatChanged carries no source, so it is target-role only, and it is fed from a move's own
 * stat deltas — a stat change a PASSIVE caused does not chain into another passive.
 */
/** 'RoundEnded' fires once a round for every active owner, the owner its own subject (relativeTo 'self'); pair it with everyNRounds for a cadence. The last thing in the round, after the Clock. */
/** 'StatusDetonated' is a mark cashed in (Conduct burst by a hit; source = the striker); 'Rested' the Rest action, its `manaRestored` readable by matchTriggerAmount. */
/** 'SwitchedOut' reads a SwitchedIn whose OUTGOING combatant is the subject, and fires from the bench the owner has just reached (Ink) — never on a knockout's replacement, since a fainted owner reacts to nothing. */
/** 'MoveUsed' is a cast paid for, read after its payload and before any pivot; its subject is the caster, and `damaging` ('true' / 'false') is what eventFieldEquals reads (Poised). */
export type PassiveHook = 'DamageDealt' | 'Healed' | 'StatusApplied' | 'StatusTicked' | 'StatusDetonated' | 'SwitchedIn' | 'SwitchedOut' | 'StatChanged' | 'RoundEnded' | 'Rested' | 'MoveUsed';

/** 'ally' = the owner's partner, not the owner. */
export type PassiveRelation = 'self' | 'ally' | 'enemy';

/** Declarative match against the triggering event — data, not a predicate. */
export interface PassiveTriggerCondition {
  relativeTo: PassiveRelation;
  /** Which combatant of the event `relativeTo` is measured against: 'target' (default) or 'source' (the actor). Only DamageDealt/StatusApplied carry a source — elsewhere a source-role passive never fires. */
  subjectRole?: 'target' | 'source';
  /** Every key must equal the event's same-named field (string compare), e.g. { statusId: 'Bleed', kind: 'damage' }. */
  eventFieldEquals?: Partial<Record<string, string>>;
  /** The named numeric event field must be > 0 — the only way to say "increased" rather than "changed" (Frozen Stone reads StatChanged.delta). */
  eventFieldPositive?: string;
  /** Its mirror: the named numeric event field must be < 0, i.e. "dropped" (Entanglement reads StatChanged.delta). */
  eventFieldNegative?: string;
  /** Fires only on rounds divisible by N, read off the event's `round` (the Eyes' Withering Gaze returning every third round). */
  everyNRounds?: number;
  /** DamageDealt only: the hit knocked its target out (DamageDealtEvent.finishing). Rex's and Ursa's finishing blows. */
  finishingBlow?: true;
  /** The event's target-role combatant holds this status when the reaction is read (after the hit has landed). Sorrow's Lament: a Haunted enemy struck. */
  eventTargetHasStatus?: StatusId;
}

/** matchTriggerAmount reads the triggering event's `field` (default 'amount'): Sanguine takes a tick's amount, Restorative Toxin a StatusApplied's magnitude. */
export type PassiveAmount =
  | { kind: 'flat'; value: number }
  | { kind: 'matchTriggerAmount'; field?: string; multiplier?: number }
  /** A share of the EFFECT TARGET's max HP (Feast: heal half of Ursa's own). Resolved where the target is known. */
  | { kind: 'percentMaxHp'; value: number };

/**
 * 'triggerSubject' follows the condition's `subjectRole`; 'triggerTarget' is the event's
 * target-role combatant whatever the condition read — the defender of a DamageDealt — which
 * is the only way a source-role passive (Static Tide) reaches the hero it just hit.
 * 'ally' is the owner's ACTIVE partner and never the owner (Nature's Purification); it
 * resolves to nothing when the owner is alone on the field.
 * 'activeEnemies' = every living ACTIVE enemy of the owner, resolved once per member, and
 * 'randomEnemy' is one of them drawn at resolution — the only passive target that costs RNG,
 * and it draws nothing unless a passive actually asks for it. Never the bench: an entry
 * passive must not tax uncommitted heroes.
 */
export type PassiveEffectTarget = 'self' | 'ally' | 'triggerSubject' | 'triggerTarget' | 'activeEnemies' | 'randomEnemy';

/** The reactive effect primitives. */
export type PassiveEffect =
  | { kind: 'heal'; target: PassiveEffectTarget; amount: PassiveAmount }
  /**
   * `magnitude` may read off the triggering event rather than being authored flat. `scaledBy`
   * multiplies it by the OWNER's stat on the status-magnitude formula's StatMult (no STAB — a
   * passive has no move to take it from): Boiler's Burn off Clockwork's Intelligence, the one
   * authored exception to "passive-applied magnitudes are flat" (docs/innate-passives.md §7).
   */
  | { kind: 'applyStatus'; target: PassiveEffectTarget; statusId: StatusId; magnitude?: number | PassiveAmount; duration?: number; scaledBy?: StatKey; maxMagnitude?: number }
  /**
   * One stat, or several sharing an amount (Afterglow's Attack and Intelligence) — one StatChanged
   * each. A PassiveAmount reads the event (Neuroplastic: the Wisdom an enemy just lost).
   * `permanent` lands it this fight AND banks it on Combatant.permanentStatGains, which a won
   * fight writes onto RosterEntry.bonusStatGrants (run/runProgress.ts recordPermanentStatGains) —
   * Rex's Tyrant's Due, the one innate that outlives the fight. Self only.
   */
  | { kind: 'statDelta'; target: PassiveEffectTarget; stat: StatKey | readonly StatKey[]; amount: number | PassiveAmount; permanent?: true }
  /** Raises every move's price for the target by `amount` for the rest of the fight, stacking to `max` (Deepgrip; Combatant.manaSurcharge, read by state.ts resolveManaCost). */
  | { kind: 'manaSurcharge'; target: PassiveEffectTarget; amount: number; max: number }
  /**
   * Direct HP loss — a share of each target's max HP, never a hit (no Shield, no Defense, no
   * chart; applyHpDelta 'direct'), the Pact Clock's shape. `onlyWithStatus` narrows a group
   * target to the members holding it: Dread's Nightmare on Haunted enemies alone.
   */
  | {
      kind: 'damage';
      target: PassiveEffectTarget;
      percentMaxHp: number;
      onlyWithStatus?: StatusId;
      /** Broadside: the share is PER point of this status the OWNER holds, and the status is spent by the firing. Nothing held, nothing fired. */
      perHeldStatus?: StatusId;
    }
  /** Strips non-`positive` statuses, same rules as a move's `cleanses`; `count` omitted = all. */
  | { kind: 'cleanse'; target: PassiveEffectTarget; count?: number }
  /** UNCAPPED, like a move's `manaGrant` — overflow past the pool is the point (docs/mana.md). */
  | { kind: 'manaGrant'; target: PassiveEffectTarget; amount: PassiveAmount }
  /** Global — no `target`. */
  | { kind: 'setFieldEffect'; fieldEffectId: FieldEffectId };

/** Damage-pipeline modifier from the attacker's own passives, evaluated per hit against { moveType }. */
export interface PassiveDamageModifier {
  eventFieldEquals?: Partial<Record<string, string>>;
  /** Fires only when the move's category differs from the attacker's last landed hit's (Combatant.lastHitCategory) — never on a first hit. The mixed attacker's verb: alternate, or it is nothing. */
  alternatesCategory?: true;
  /** Fires only when the defender holds EVERY one of these (Lethal Bite: Bleed and Poison). Read per hit against the live target; a forecast with no target reports it unfired. */
  requiresTargetStatuses?: readonly StatusId[];
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
  /** `oncePerFight` caps the whole reaction at one firing per combat regardless of stacks (state.ts PassiveInstance.firedThisFight). `chance` (0–1) rolls the seeded rng per matched event, per stack; absent = always. `whileBenched` inverts the field rule: this reaction fires only while its owner is standing on the BENCH (Broadside loading a cannonball a round), where every other passive is silent. */
  reactive?: { hook: PassiveHook; condition: PassiveTriggerCondition; effect: PassiveEffect; oncePerFight?: boolean; chance?: number; whileBenched?: true };
  damageModifier?: PassiveDamageModifier;
  /** Always-on flat grants, applied at fight build like Equipment/Relic statGrants (src/run/passives.ts); not read by passiveEngine. Classes are this alone. */
  statGrants?: Partial<Record<StatKey, number>>;
  /** Conditional counterpart of `statGrants` (Bloodthirsty). */
  conditionalStatGrants?: PassiveConditionalStatGrants;
  /**
   * The Herald's guard (docs/titan-eyes.md §10): while any standing ally of the owner's phase or
   * earlier is on its side — field or bench; a later phase's reserves do not count — every move
   * the far side aims at the owner turns away exactly as Barrier's does (MoveGuarded), and every
   * non-positive status from the far side is refused. Read live off the board (passiveEngine.ts
   * wardOn), never a status. The Pact Clock and a self-cost go through, being neither.
   */
  wardedWhileCompanyStands?: true;
  /**
   * Lingering (docs/innate-passives.md §7): the first time the holder would be knocked out each
   * fight, it stands at 1 HP instead. Any loss — a hit, a DoT, the Pact Clock — since it is not a
   * trigger but a floor. Counted onto Combatant.enduresLeft at fight build, one a stack.
   */
  enduresOnce?: true;
  /**
   * Ironbound (docs/innate-passives.md §4): the holder never switches out voluntarily — a pivot
   * move degrades to its buff, the Switch key is dead for it — while a forced replacement of a
   * downed hero still happens. Read onto Combatant.switchLocked at fight build.
   */
  cannotSwitchOut?: true;
  /**
   * A Burden (docs/innate-passives.md §4): this passive is a COST, and the hero born with it comes
   * in BURDEN_SURPLUS over the 550 (run/statBudget.ts). Presentation tints it as a price; the
   * roster test reads it for the one budget exemption.
   */
  burden?: true;
}

/** Every stat grant must be a valid flat grant, and the passive must do something. */
export function isValidPassiveDefinition(passive: PassiveDefinition): boolean {
  const hasEffect =
    passive.reactive !== undefined ||
    passive.damageModifier !== undefined ||
    passive.statGrants !== undefined ||
    passive.conditionalStatGrants !== undefined ||
    passive.wardedWhileCompanyStands !== undefined ||
    passive.enduresOnce !== undefined ||
    passive.cannotSwitchOut !== undefined;
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
  /** Statuses whose post-tick decay is slowed while active (Scorched Land holding Burn). `retain` is the share kept per tick — 0.5 is the ordinary halving, 1 is no decay at all. The tick itself is untouched. */
  slowsStatusDecay?: { statusIds: readonly StatusId[]; retain: number };
  /** Within a priority bracket, resolve slowest-first (Stasis Bubble). Bracket separation untouched. priority.ts orderActions. */
  reversesSpeedOrder?: boolean;
  /** Added to heal-kind moves' priority bracket (Sanctuary +1). priority.ts orderActions. */
  healPriorityBonus?: number;
  /** Multiplies a heal-kind move's restored HP (Sanctuary 1.5). A heal-pipeline term (healPipeline.ts), never folded into Wisdom; a HoT tick and a drain are not heals and do not read it. */
  healMultiplier?: number;
  /** Each stat in `stats` gains the combatant's OWN current magnitude of `statusId` (Verdant Earth / Renew). Stat pipeline — state.ts getEffectiveStat. */
  statBonusEqualToStatusMagnitude?: { statusId: StatusId; stats: readonly StatKey[] };
  /**
   * Withering Gaze (docs/titan-eyes.md §10): every ACTIVE combatant not of an exempt type loses this
   * share of max HP at the end of each round — direct loss on the Pact Clock's terms (no Defense,
   * no Shield, no reaction pass, the bench out of it), before the field's own countdown ticks.
   * fieldEffectEngine.ts tickFieldEffectDrain.
   */
  drainsPercentMaxHp?: { fraction: number; exemptTypes?: readonly TypeId[] };
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
  /** damage-kind: resolve the damage this many times against EACH target (default 1). Every hit rolls
   * its own variance and crit and re-reads the flat BasePower bonuses, so a multi-hit move multiplies
   * an Ambush. Riders still fire once, after the whole move. */
  hitCount?: number;
  conditionalPower?: {
    /** The hit's target carries this status. Re-read per hit, so a spread cast can double against one foe only. */
    requiresTargetStatus?: StatusId;
    /** The user carries this status (Seed Shot / Renew), read live at resolution. */
    requiresUserStatus?: StatusId;
    /** This field effect is active. All-or-nothing across a spread, and global — an enemy's field arms it too. */
    requiresFieldEffect?: FieldEffectId;
    /** The hit's target is below this fraction of max HP, read BEFORE this hit's own damage; per target. */
    requiresTargetHpBelow?: number;
    /** The hit's target carries any in-fight stat reduction — a negative `statModifiers` entry, never the loadout (Brain Flay). Per target, so a spread doubles against the debuffed foe only; a foe held at its floor still counts. */
    requiresTargetStatReduction?: boolean;
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
  /** Any kind. Delta read off live state at cast: 'userManaBeforeCast' (before the cost is spent; overflow counts) or 'userEffectiveAttack' (via getEffectiveStat, so a recast doubles the doubled figure). Exempt from the multiples-of-5 rule (CLAUDE.md). */
  derivedStatDeltas?: {
    source: 'userManaBeforeCast' | 'userEffectiveAttack';
    stats: readonly StatKey[];
  };
  /** Any kind. Flat mana to each resolved target; may exceed the pool — uncapped, sticky overflow (docs/mana.md "Overflow"). Ally modes include the caster. Emits ManaGranted. */
  manaGrant?: number;
  /** Any kind. Replaces `target` while the field effect is active, read at RESOLUTION (a same-round setter counts). Declared against the authored `target`; applied before Provoke/Haunt. */
  conditionalTarget?: {
    requiresFieldEffect: FieldEffectId;
    target: TargetMode;
  };
  /** Any kind. HARD gate: only resolves against a target carrying this status (Glaciate). Enforced at declaration (view) and resolution (ActionBlocked 'targetStatusMissing' — turn lost, no mana). */
  requiresTargetStatus?: StatusId;
  /**
   * With `requiresTargetStatus`: a Provoke pull lands on the taunter even though it does not carry
   * the status (the Titan's Regard, docs/titan-eyes.md §5 — "taunt wins", per user direction).
   * Default (unset) is the locked order: the gate is applied after every redirect, so a pull onto
   * an ungated hero fizzles.
   */
  gateYieldsToRedirect?: boolean;
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
  /**
   * The mirror: each cast RAISES this move's cost for THAT combatant by this much for the rest of the
   * fight, stacking (Feint, Blind, Barrier — the guaranteed lockouts, so none of them is a permanent
   * lock). Banked in the same per-move ledger as the discount (Combatant.moveManaDiscounts, as a
   * negative entry), so every price reader sees it. Pays the pre-increment price.
   */
  manaCostGainOnUse?: number;
  /** The cast spends ALL of the caster's current Mana, overflow included; `manaCost` is its floor, below which it cannot be cast (Ink Blast). state.ts resolveManaCost. */
  manaCostAll?: true;
  /** Castable once a fight by each combatant that holds it (Combatant.spentMoveIds). state.ts isMoveUsable. */
  oncePerFight?: true;
  /** Castable only on the combatant's first round on the field — round 1 for a lead, the round after it arrived otherwise (Combatant.firstActionRound). state.ts isMoveUsable. */
  firstTurnOnly?: true;
  /**
   * damage-kind only, the mana ramp's mirror: each cast raises this move's BasePower for THAT
   * combatant by `amount` for the rest of the fight, capped at `max` TOTAL (Snowball;
   * Combatant.moveBasePowerBonuses, read via state.ts effectiveBasePower). The cast pays the
   * PRE-increment figure, exactly as manaDiscountOnUse charges the pre-increment price. It
   * replaces the authored BasePower INPUT, so `max` caps the ramp alone — the conditional
   * multiplier and Elemental Force still apply on top of the capped figure.
   */
  basePowerGainOnUse?: { amount: number; max: number };
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
  /**
   * The move wears the USER's innate primary type instead of its authored one — STAB guaranteed,
   * the type chart read against the user's element, the tile coloured to match (Class moves,
   * data/classes.ts). `type` is then only the fallback with no user in hand. Resolved once, at the
   * edge, by state.ts moveForHero; engine and view both read the resolved move, never this flag.
   */
  typeFollowsUser?: boolean;
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
  /**
   * The Constellation offer that puts this hero in a run's pools (docs/constellation.md §4): a
   * bundle hero is recruit-only and outside the base roster, drawn beside it once the offer is
   * held (run/recruitment.ts `heroPool`). The base roster carries none. Never a starter.
   */
  unlock?: string;
  /**
   * How each stat grows per level (run/growth.ts). Optional: absent reads as all-B, which is
   * exactly the grade budget — so a hero with no authored line is fairly costed, not free.
   */
  growthGrades?: Record<GrowthStatKey, 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'>;
  /**
   * What this hero's levels pay (run/progression.ts, docs/xp-overhaul.md §4). Optional: absent
   * reads as DEFAULT_SCHEDULE until the per-hero pass authors one.
   */
  schedule?: LevelSchedule;
  /**
   * The move that is this hero's and nobody else's (data/signatures.ts, docs/mastery.md §5): a
   * GUARANTEED learn at `schedule.signatureLevel` (2026-09-24, per user direction — it was the
   * tenth Mastery pip's), never rolled and in no pool. A hero without one simply has none.
   */
  signatureMoveId?: string;
  /**
   * The innate, MASTERED (docs/mastery.md §5b): what `passiveIds` becomes at the tenth Mastery pip
   * — a sizable buff to the same verb, replacing the born card rather than stacking beside it
   * (run/innate.ts `innatePassiveIdsFor`). In no pool and never granted anywhere else.
   */
  masteredPassiveIds?: readonly PassiveId[];
  /**
   * Passives held from birth, in no pool and never granted (run/entryStats.ts folds them in beside
   * every other source). Every roster hero holds exactly ONE — its innate, docs/innate-passives.md,
   * read by `innatePassiveOf` — a Titanspawn and a Guardian its type's Mark, and the Titan's pieces
   * their several (data/enemies.ts, docs/titan-eyes.md §10).
   */
  passiveIds?: readonly PassiveId[];
}

/**
 * The levels that teach. `offerLevels` each roll one move from the band the level has opened;
 * `midLevel` opens Mid (and expires Early), `lateLevel` opens Late. `signatureLevel` is the one
 * level that rolls nothing: it teaches the hero's signature, guaranteed, set by how hard the move
 * hits (docs/mastery.md §5). The Evolution is not on it: it sits behind Mastery pips
 * (run/mastery.ts, docs/mastery.md), not a level.
 */
export interface LevelSchedule {
  offerLevels: readonly number[];
  midLevel: number;
  lateLevel: number;
  /** Omitted for a definition with no signature — the Titanspawn's default schedule. */
  signatureLevel?: number;
}
