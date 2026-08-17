// Shared content vocabulary — the engine's contract with /src/data.
// All acquirable content (heroes, moves, ...) is pure data conforming to these
// shapes. The engine interprets data; it never contains bespoke per-content
// logic. See CLAUDE.md "Architecture" and docs/architecture.md repo map.
//
// The condition vocabulary (the sixth engine contract) is now implemented per
// docs/conditions.md: 8 statuses across 3 shapes (magnitude/boolean/duration),
// encoded below as StatusDefinition data. MoveDefinition.kind now covers
// 'damage' | 'heal' | 'buff', and any kind may additionally carry a
// statusApplication and/or a cleanses effect — see docs/conditions.md §5 (the
// Status-Query Layer) for the Gate/Consume/Transmute verb vocabulary this sets
// up. Abilities, equipment and relic hooks (effect primitives / trigger hooks)
// remain future work.

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
 * The three status shapes (docs/conditions.md §1). Every status instance is an
 * instance of exactly one shape — no bespoke per-status engine logic.
 */
export type StatusShape = 'magnitude' | 'boolean' | 'duration';

/** How a re-application of an already-present status combines with the existing instance. */
export type StatusStacking = 'additive' | 'none' | 'takeHigher';

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
  /** DoT/HoT/duration-countdown tick point. LOCKED to end-of-round in this engine — see docs/conditions.md §7 "Status tick timing" open question. */
  ticksAtEndOfRound: boolean;
  /** Post-tick decay for magnitude statuses (Burn, Regen): halve toward 0. 'none' for persistent magnitude statuses (Blight). */
  decay: 'halve' | 'none';
  stacking: StatusStacking;
  /** Additive-stacking ceiling (Blight → 50). Absent = unbounded. */
  capMagnitude?: number;
  /** docs/conditions.md §4 removal table: cleared by switching to bench. */
  clearsOnSwitch: boolean;
  /** Boolean-shape DoT/HoT only (Bleed): fixed effect as a % of max HP instead of a magnitude. */
  flatPercentOfMaxHp?: number;
  /** Which pipeline (if any) this status enters — documentation of where its effect is wired in, not engine-read. */
  pipeline: 'dot' | 'hot' | 'stat' | 'damage' | 'control' | 'none';
  description?: string;
}

export interface StatDelta {
  stat: StatKey;
  /** Flat additive, per CLAUDE.md "Stat modifiers are flat additive integers" — positive = buff, negative = debuff. */
  amount: number;
}

/**
 * A move's optional status effect (docs/conditions.md §5). Any move kind may
 * carry one — a damage move inflicting Burn, a buff move also granting Regen,
 * a dedicated status move applying Bind, etc.
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
  /** Any kind — strips statuses from the move's resolved target(s) (docs/conditions.md §4 Cleanse; §7 "Cleanse & positive statuses" resolves the split as debuffs-only vs. all, including Regen). */
  cleanses?: 'debuffs' | 'all';
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
