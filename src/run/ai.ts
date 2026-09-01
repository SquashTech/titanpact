// Enemy action selection — the opposing side's declare-time brain.
//
// This is DELIBERATELY not a search. There is no lookahead, no scoring of the
// board two rounds out, and no attempt to play the matchup optimally: a
// roguelike whose enemies solve the fight is a roguelike whose fights are the
// same fight. What it does instead is remove the two ways the previous version
// (a uniform random pick, always aimed at the player's left slot) read as
// obviously mindless:
//
// 1. **It aims.** A super-effective matchup pulls the move pick and decides the
//    target; a neutral one leaves the target to a coin flip, so the same board
//    does not play out the same way twice.
// 2. **It does not throw turns away.** A move whose entire payload would be a
//    no-op on the current board — a heal on a full-HP side, a cleanse with
//    nothing to cleanse, a field effect that is already up, a Freeze on
//    somebody already Frozen — is filtered out before the pick. Anything that
//    still does something, however small, stays in: a Renew on a full-HP ally
//    is a real play (it pays out over the following rounds), and this file is
//    careful never to confuse "heals for nothing right now" with "applies a
//    heal-over-time".
//
// Randomness is threaded in as `AiContext.random` rather than reached for
// directly so tests can pin a choice. It is deliberately NOT the engine's
// seeded stream (engine/rng/seededRng.ts): action DECLARATION happens outside
// resolution, and drawing from `state.rngState` here would make the AI's
// choices shift every damage roll that preceded them.

import { statusApplicationsOf, type HeroDefinition, type MoveDefinition, type StatusApplication, type StatusDefinition, type TargetMode } from '../engine/content';
import type { Action } from '../engine/combat/actions';
import type { CombatState, Side } from '../engine/state';
import {
  effectiveTypes,
  getMaxHp,
  hasAffordableMoveInFight,
  hasStatus,
  resolveManaCost,
  resolveTargetMode,
} from '../engine/state';
import { selectableTargets, statusGatedTargets } from '../engine/combat/statusEngine';
import { resolveTypeMult, TYPE_MULT_FLOOR, type TypeChart } from '../engine/damage/typeMult';

export interface AiContext {
  /** Hero catalog — every combatant on the board, both sides (src/data/content.ts allCombatants). */
  heroes: Record<string, HeroDefinition>;
  moves: Record<string, MoveDefinition>;
  statuses: Record<string, StatusDefinition>;
  typeChart: TypeChart;
  /**
   * The moves this combatant may actually declare — its roster entry's
   * unlocked list, falling back to the hero's authored pool. A function rather
   * than a map because the caller (the view) holds the roster and this module
   * deliberately does not know what a RosterEntry is.
   */
  moveIdsFor: (combatantId: string) => readonly string[];
  /** Injected so tests can pin a choice. Defaults to Math.random. */
  random?: () => number;
}

/**
 * How much each effectiveness tier pulls the move pick, relative to a neutral
 * attack at 2. These are the whole "sharpness" dial: a super-effective option
 * is three times as likely to be chosen as a neutral one, not certain to be —
 * an enemy that ALWAYS reaches for its best type matchup is as predictable as
 * one that never does, and the player should not be able to read the AI's hand
 * off its opening move.
 *
 * A useful non-damage move (one that survived the inert filter) sits at the
 * neutral weight, so healing/buffing stays a normal fraction of what the AI
 * does rather than something it only falls back to.
 */
const WEIGHT_QUAD_SUPER = 12;
const WEIGHT_SUPER = 6;
const WEIGHT_NEUTRAL = 2;
const WEIGHT_RESIST = 1;
const WEIGHT_QUAD_RESIST = 0.5;

function aliveActiveIdsOn(state: CombatState, side: Side): string[] {
  return state.active[side].filter((id): id is string => id !== null && !state.combatants[id]?.fainted);
}

function otherSide(side: Side): Side {
  return side === 'A' ? 'B' : 'A';
}

/** A move with a damage body — authored BasePower or a rolled one (content.ts randomBasePower). */
function isDamaging(move: MoveDefinition): boolean {
  return move.kind === 'damage' || move.basePower != null || move.randomBasePower != null;
}

/**
 * Which combatants `mode` could land on, before any status filtering — the
 * same side-and-slot reading the player's own picker does (FightScreen's
 * targetableIds), kept here so the AI can never aim at a pool the engine would
 * not resolve to.
 */
function targetPool(state: CombatState, casterId: string, mode: TargetMode, side: Side): string[] {
  const foes = aliveActiveIdsOn(state, otherSide(side));
  const allies = aliveActiveIdsOn(state, side);
  switch (mode) {
    case 'self':
      return [casterId];
    case 'singleAlly':
    case 'bothAllies':
    case 'randomAlly':
      return allies;
    case 'allOthers':
      return [...allies, ...foes].filter((id) => id !== casterId);
    default:
      return foes;
  }
}

/**
 * The pool above, narrowed exactly as the player's picker narrows it: the hard
 * status gate first (content.ts requiresTargetStatus — an empty result means
 * the move has no legal target at all), then Provoke's redirect and Stealth's
 * soft hide. Same two calls in the same order as FightScreen's visibleTargets,
 * so the AI's declaration and the engine's resolution cannot disagree about who
 * a move is allowed to hit.
 */
function candidateTargets(state: CombatState, casterId: string, move: MoveDefinition, ctx: AiContext, mode: TargetMode): string[] {
  const side = state.combatants[casterId].side;
  const pool = targetPool(state, casterId, mode, side);
  return selectableTargets(state, mode, move.kind, statusGatedTargets(state, move, pool), ctx.statuses);
}

/** A status-gated move (requiresTargetStatus) with nobody marked to aim at resolves into an ActionBlocked and silently eats the turn. */
function hasLegalTarget(state: CombatState, casterId: string, move: MoveDefinition, ctx: AiContext): boolean {
  if (!move.requiresTargetStatus) return true;
  const mode = resolveTargetMode(state, move);
  const side = state.combatants[casterId].side;
  return statusGatedTargets(state, move, targetPool(state, casterId, mode, side)).length > 0;
}

function isHurt(state: CombatState, ctx: AiContext, combatantId: string): boolean {
  const combatant = state.combatants[combatantId];
  if (!combatant) return false;
  return combatant.currentHp < getMaxHp(ctx.heroes[combatant.heroId], combatant);
}

/** Anything a Cleanse could actually strip — the negative statuses only (docs/conditions.md §7: Cleanse never touches Renew or Stealth). */
function hasCleansableStatus(state: CombatState, ctx: AiContext, combatantId: string): boolean {
  const combatant = state.combatants[combatantId];
  if (!combatant) return false;
  return Object.keys(combatant.statuses).some((statusId) => !ctx.statuses[statusId]?.positive);
}

/**
 * Who a rider actually lands on, for the redundancy check below. 'randomAlly'
 * and 'randomEnemy' return null — the receiver is rolled at resolution, so
 * there is no one combatant to ask, and a rider aimed that way is never treated
 * as redundant.
 */
function riderReceivers(app: StatusApplication, casterId: string, targets: readonly string[]): string[] | null {
  if (app.target === 'self') return [casterId];
  if (app.target === 'moveTarget') return [...targets];
  return null;
}

/**
 * A rider that could not change anything: every combatant it would land on
 * already holds it AND the status does not stack (docs/conditions.md — a
 * `stacking: 'none'` re-application is a no-op, while an additive one like Burn
 * or Renew genuinely adds magnitude and is never redundant).
 */
function riderIsRedundant(state: CombatState, ctx: AiContext, app: StatusApplication, casterId: string, targets: readonly string[]): boolean {
  const def = ctx.statuses[app.statusId];
  if (!def || def.stacking !== 'none') return false;
  const receivers = riderReceivers(app, casterId, targets);
  if (!receivers || receivers.length === 0) return false;
  return receivers.every((id) => {
    const combatant = state.combatants[id];
    return combatant != null && hasStatus(combatant, app.statusId);
  });
}

/**
 * Would this move do LITERALLY nothing on the current board?
 *
 * The rule is deliberately conservative in one direction: a payload this
 * function does not know how to evaluate counts as doing something, so an
 * unrecognised move is always playable and a later field can be added without
 * silently disabling content. Only three payloads have a checkable no-op, plus
 * the rider case above:
 *
 * - a heal with every candidate already at full HP,
 * - a cleanse with nothing negative on any candidate,
 * - a field effect that is already the active one (docs/field-effects.md:
 *   re-applying the live effect is explicitly a no-op, not a refresh).
 *
 * A move is inert only if EVERY payload it carries is one of those and each is
 * currently doing nothing — so Wash Away (heal + cleanse) is still worth
 * casting on a full-HP but Poisoned ally, and Consecrate (heal + Sanctuary)
 * still goes up on a healthy side that has no field.
 */
function isInertOnBoard(state: CombatState, casterId: string, move: MoveDefinition, ctx: AiContext): boolean {
  if (isDamaging(move)) return false;
  // Payloads with no checkable no-op. Present means the move does something.
  if (
    move.statDeltas ||
    move.conditionalStatDeltas ||
    move.randomStatDeltas ||
    move.derivedStatDeltas ||
    move.manaGrant != null ||
    move.detonatesStatus ||
    move.switchesUserOut ||
    move.randomStatusApplication
  ) {
    return false;
  }

  const mode = resolveTargetMode(state, move);
  const targets = candidateTargets(state, casterId, move, ctx, mode);
  let sawCheckablePayload = false;

  if (move.healPower != null) {
    if (targets.some((id) => isHurt(state, ctx, id))) return false;
    sawCheckablePayload = true;
  }
  if (move.cleanses) {
    if (targets.some((id) => hasCleansableStatus(state, ctx, id))) return false;
    sawCheckablePayload = true;
  }
  if (move.fieldEffectApplication) {
    if (state.activeFieldEffect?.fieldEffectId !== move.fieldEffectApplication) return false;
    sawCheckablePayload = true;
  }
  const riders = statusApplicationsOf(move);
  if (riders.length > 0) {
    if (!riders.every((app) => riderIsRedundant(state, ctx, app, casterId, targets))) return false;
    sawCheckablePayload = true;
  }

  return sawCheckablePayload;
}

/** Type effectiveness of `move` against whoever currently occupies `defenderId`. */
function effectivenessAgainst(state: CombatState, ctx: AiContext, move: MoveDefinition, defenderId: string): number {
  const defender = state.combatants[defenderId];
  if (!defender) return 1;
  return resolveTypeMult(ctx.typeChart, move.type, effectiveTypes(ctx.heroes[defender.heroId], defender));
}

/** The best matchup this move has anywhere on the board right now — what the move pick is weighted by. */
function bestEffectiveness(state: CombatState, casterId: string, move: MoveDefinition, ctx: AiContext): number {
  const mode = resolveTargetMode(state, move);
  const targets = candidateTargets(state, casterId, move, ctx, mode);
  if (targets.length === 0) return 1;
  return Math.max(...targets.map((id) => effectivenessAgainst(state, ctx, move, id)));
}

function weightFor(state: CombatState, casterId: string, move: MoveDefinition, ctx: AiContext): number {
  if (!isDamaging(move)) return WEIGHT_NEUTRAL;
  const mult = bestEffectiveness(state, casterId, move, ctx);
  if (mult >= 4) return WEIGHT_QUAD_SUPER;
  if (mult > 1) return WEIGHT_SUPER;
  if (mult === 1) return WEIGHT_NEUTRAL;
  if (mult <= TYPE_MULT_FLOOR) return WEIGHT_QUAD_RESIST;
  return WEIGHT_RESIST;
}

function weightedPick<T>(items: readonly T[], weights: readonly number[], random: () => number): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
}

function pickOne<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

/**
 * Of `candidates`, the ones this move's riders would not be wasted on — an
 * enemy not already Frozen, an ally not already Stealthed. Falls back to the
 * full list rather than to nothing, on the same discipline as Stealth's soft
 * hide: this is a preference, never a legality rule.
 */
function preferFreshRiderTargets(state: CombatState, ctx: AiContext, move: MoveDefinition, casterId: string, candidates: readonly string[]): readonly string[] {
  const riders = statusApplicationsOf(move).filter((app) => app.target === 'moveTarget' && ctx.statuses[app.statusId]?.stacking === 'none');
  if (riders.length === 0) return candidates;
  const fresh = candidates.filter((id) => riders.some((app) => !hasStatus(state.combatants[id], app.statusId)));
  return fresh.length > 0 ? fresh : candidates;
}

/** The most wounded of `candidates` by fraction of max HP, ties broken randomly — where a heal actually wants to go. */
function mostWounded(state: CombatState, ctx: AiContext, candidates: readonly string[], random: () => number): string {
  let worst = Infinity;
  let tied: string[] = [];
  for (const id of candidates) {
    const combatant = state.combatants[id];
    const fraction = combatant.currentHp / Math.max(1, getMaxHp(ctx.heroes[combatant.heroId], combatant));
    if (fraction < worst - 1e-9) {
      worst = fraction;
      tied = [id];
    } else if (Math.abs(fraction - worst) <= 1e-9) {
      tied.push(id);
    }
  }
  return pickOne(tied, random);
}

/**
 * Who the chosen move is declared against. Null for every mode that resolves
 * its own targets (self, the fixed groups, the rolled ones) — those ignore
 * `declaredTarget` entirely.
 *
 * The two single-target modes are where the "always the left slot" problem
 * lived, and they answer it differently:
 *
 * - **An attack aims at its best type matchup**, with ties — which is every
 *   neutral board — broken by a coin flip. That is the whole rule the player
 *   asked for: super-effective when there is one, otherwise genuinely random
 *   between the two slots.
 * - **A heal goes to the most wounded**, since "which ally" has an obviously
 *   right answer and picking randomly there is just the full-HP-heal waste
 *   again in a smaller form.
 *
 * Everything else (a debuff, a status planted on one foe) has no effectiveness
 * to read, so it coin-flips too — after preferring a target the rider is not
 * already sitting on.
 */
function pickTarget(state: CombatState, casterId: string, move: MoveDefinition, ctx: AiContext, random: () => number): string | null {
  const mode = resolveTargetMode(state, move);
  if (mode !== 'singleEnemy' && mode !== 'singleAlly') return null;
  const candidates = candidateTargets(state, casterId, move, ctx, mode);
  if (candidates.length === 0) return null;

  if (mode === 'singleAlly' && move.healPower != null) {
    const hurt = candidates.filter((id) => isHurt(state, ctx, id));
    return mostWounded(state, ctx, hurt.length > 0 ? hurt : candidates, random);
  }

  const preferred = preferFreshRiderTargets(state, ctx, move, casterId, candidates);
  if (!isDamaging(move)) return pickOne(preferred, random);

  let best = -Infinity;
  let tied: string[] = [];
  for (const id of preferred) {
    const mult = effectivenessAgainst(state, ctx, move, id);
    if (mult > best + 1e-9) {
      best = mult;
      tied = [id];
    } else if (Math.abs(mult - best) <= 1e-9) {
      tied.push(id);
    }
  }
  return pickOne(tied, random);
}

/**
 * The AI's action for one of its active combatants, declared against the
 * pre-round snapshot exactly like the player's (combat/actions.ts: nothing
 * declared here may see another action's outcome).
 *
 * The filtering is a cascade of narrowings, each of which falls back to the
 * previous list rather than to nothing — the AI must never stop acting over a
 * preference:
 *
 *   affordable -> has a legal target -> not inert on this board
 *
 * Only genuine unaffordability (nothing castable at all) reaches Rest, which is
 * the same fallback the player's move grid takes.
 */
export function pickAiAction(state: CombatState, combatantId: string, ctx: AiContext): Action {
  const random = ctx.random ?? Math.random;
  const combatant = state.combatants[combatantId];
  const moveIds = ctx.moveIdsFor(combatantId);

  // `heroes` threaded in for the same reason the affordability filter below
  // takes it: a Pack Leader that is currently half-price is affordable, and an
  // AI that priced it at 100 would Rest while holding a move it can cast
  // (state.ts resolveManaCost).
  if (!hasAffordableMoveInFight(state, combatantId, moveIds, ctx.moves, ctx.heroes)) {
    return { kind: 'rest', combatantId };
  }

  const affordable = moveIds.filter((id) => combatant.currentMana >= resolveManaCost(state, combatantId, ctx.moves[id], ctx.heroes));
  const legal = affordable.filter((id) => hasLegalTarget(state, combatantId, ctx.moves[id], ctx));
  const withTargets = legal.length > 0 ? legal : affordable;
  const useful = withTargets.filter((id) => !isInertOnBoard(state, combatantId, ctx.moves[id], ctx));
  const pickable = useful.length > 0 ? useful : withTargets;

  const moveId = weightedPick(
    pickable,
    pickable.map((id) => weightFor(state, combatantId, ctx.moves[id], ctx)),
    random
  );
  const move = ctx.moves[moveId];

  // A switchesUserOut move with no declared replacement resolves into its buff
  // and an ActionBlocked — the same silently-wasted half the filters above
  // exist to avoid. First benched hero standing: pivoting into a matchup is a
  // read this AI deliberately does not make.
  const switchToCombatantId = move.switchesUserOut
    ? (state.bench[combatant.side].find((bid) => !state.combatants[bid]?.fainted) ?? null)
    : null;

  return {
    kind: 'move',
    combatantId,
    moveId,
    declaredTarget: pickTarget(state, combatantId, move, ctx, random),
    switchToCombatantId,
  };
}
