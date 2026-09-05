// Enemy action selection. Deliberately not a search: no lookahead, no
// optimal play. It aims (type matchup pulls the move pick and target) and it
// does not throw turns away (a move whose every payload would be a no-op on
// the current board is filtered out; anything that still does something —
// a Renew on a full-HP ally — stays in).
//
// `random` is injected, and is NOT the engine's seeded stream: declaration
// happens outside resolution, and drawing from `state.rngState` here would
// shift the AI's choices with every damage roll that preceded them.

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
  /** Every combatant on the board, both sides. */
  heroes: Record<string, HeroDefinition>;
  moves: Record<string, MoveDefinition>;
  statuses: Record<string, StatusDefinition>;
  typeChart: TypeChart;
  /** The moves a combatant may declare — a function because this module does not know what a RosterEntry is. */
  moveIdsFor: (combatantId: string) => readonly string[];
  /** Defaults to Math.random. */
  random?: () => number;
}

// The "sharpness" dial: a super-effective option is 3x as likely as neutral,
// not certain — an enemy that always reaches for its best matchup is as
// readable as one that never does. Useful non-damage moves sit at neutral.
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

function isDamaging(move: MoveDefinition): boolean {
  return move.kind === 'damage' || move.basePower != null || move.randomBasePower != null;
}

/** Same side-and-slot reading as FightScreen's targetableIds, so the AI never aims at a pool the engine would not resolve to. */
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

/** Same two narrowings in the same order as FightScreen's visibleTargets: hard status gate, then Provoke/Stealth. */
function candidateTargets(state: CombatState, casterId: string, move: MoveDefinition, ctx: AiContext, mode: TargetMode): string[] {
  const side = state.combatants[casterId].side;
  const pool = targetPool(state, casterId, mode, side);
  return selectableTargets(state, mode, move.kind, statusGatedTargets(state, move, pool), ctx.statuses);
}

/** A status-gated SPREAD move with nobody marked resolves into an ActionBlocked and eats the turn. */
function hasLegalTarget(state: CombatState, casterId: string, move: MoveDefinition, ctx: AiContext): boolean {
  if (!move.requiresTargetStatus) return true;
  const mode = resolveTargetMode(state, move);
  const side = state.combatants[casterId].side;
  return statusGatedTargets(state, move, targetPool(state, casterId, mode, side)).length > 0;
}

/** Only these two modes need an id on the Action; every other mode resolves its own targets. */
function needsDeclaredTarget(state: CombatState, move: MoveDefinition): boolean {
  const mode = resolveTargetMode(state, move);
  return mode === 'singleEnemy' || mode === 'singleAlly';
}

/**
 * Whether an action for this move could be RESOLVED at all — a hard legality rule, unlike
 * the preferences below it. A single-target move whose candidate pool is empty (today:
 * `requiresTargetStatus` with nobody marked) has no id to put on the Action, and
 * targeting.ts throws a BARE Error for a missing declared target rather than the
 * TargetNoLongerValidError that resolveRound catches — so it takes the whole fight down.
 * resolveTargets never sees the move and cannot tell that case from a caller bug, and the
 * status gate is deliberately applied last in resolveRound (a redirect onto an ungated hero
 * must fizzle), so this has to be caught here at declaration.
 */
function isDeclarable(state: CombatState, casterId: string, move: MoveDefinition, ctx: AiContext): boolean {
  if (!needsDeclaredTarget(state, move)) return true;
  return candidateTargets(state, casterId, move, ctx, resolveTargetMode(state, move)).length > 0;
}

function isHurt(state: CombatState, ctx: AiContext, combatantId: string): boolean {
  const combatant = state.combatants[combatantId];
  if (!combatant) return false;
  return combatant.currentHp < getMaxHp(ctx.heroes[combatant.heroId], combatant);
}

/** Negative statuses only — Cleanse never touches Renew or Stealth. */
function hasCleansableStatus(state: CombatState, ctx: AiContext, combatantId: string): boolean {
  const combatant = state.combatants[combatantId];
  if (!combatant) return false;
  return Object.keys(combatant.statuses).some((statusId) => !ctx.statuses[statusId]?.positive);
}

/** null for the random modes — the receiver is rolled at resolution, so such a rider is never treated as redundant. */
function riderReceivers(app: StatusApplication, casterId: string, targets: readonly string[]): string[] | null {
  if (app.target === 'self') return [casterId];
  if (app.target === 'moveTarget') return [...targets];
  return null;
}

/** Every receiver already holds it AND it does not stack (an additive status like Burn is never redundant). */
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
 * Would this move do literally nothing? Conservative: a payload this function
 * cannot evaluate counts as doing something, so a new field never silently
 * disables content. Inert only if EVERY payload is checkable and currently a no-op.
 */
function isInertOnBoard(state: CombatState, casterId: string, move: MoveDefinition, ctx: AiContext): boolean {
  if (isDamaging(move)) return false;
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

function effectivenessAgainst(state: CombatState, ctx: AiContext, move: MoveDefinition, defenderId: string): number {
  const defender = state.combatants[defenderId];
  if (!defender) return 1;
  return resolveTypeMult(ctx.typeChart, move.type, effectiveTypes(ctx.heroes[defender.heroId], defender));
}

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

/** Candidates the move's non-stacking riders would not be wasted on; a preference, never a legality rule. */
function preferFreshRiderTargets(state: CombatState, ctx: AiContext, move: MoveDefinition, casterId: string, candidates: readonly string[]): readonly string[] {
  const riders = statusApplicationsOf(move).filter((app) => app.target === 'moveTarget' && ctx.statuses[app.statusId]?.stacking === 'none');
  if (riders.length === 0) return candidates;
  const fresh = candidates.filter((id) => riders.some((app) => !hasStatus(state.combatants[id], app.statusId)));
  return fresh.length > 0 ? fresh : candidates;
}

/** Lowest HP fraction, ties broken randomly. */
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
 * Null for every mode that resolves its own targets. An attack aims at its
 * best matchup (ties coin-flipped); a heal goes to the most wounded; anything
 * else coin-flips after preferring a target its rider is not already on.
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
 * Declared against the pre-round snapshot like the player's. A cascade of
 * narrowings — affordable -> has a legal target -> not inert — each falling
 * back to the previous list; only genuine unaffordability reaches Rest.
 */
export function pickAiAction(state: CombatState, combatantId: string, ctx: AiContext): Action {
  const random = ctx.random ?? Math.random;
  const combatant = state.combatants[combatantId];
  const moveIds = ctx.moveIdsFor(combatantId);

  // `heroes` threaded so a currently-discounted move (state.ts resolveManaCost) prices correctly.
  if (!hasAffordableMoveInFight(state, combatantId, moveIds, ctx.moves, ctx.heroes)) {
    return { kind: 'rest', combatantId };
  }

  const affordable = moveIds.filter((id) => combatant.currentMana >= resolveManaCost(state, combatantId, ctx.moves[id], ctx.heroes));
  // The one HARD filter in the cascade — every narrowing below it falls back, this one cannot.
  const declarable = affordable.filter((id) => isDeclarable(state, combatantId, ctx.moves[id], ctx));
  if (declarable.length === 0) return { kind: 'rest', combatantId };

  const legal = declarable.filter((id) => hasLegalTarget(state, combatantId, ctx.moves[id], ctx));
  const withTargets = legal.length > 0 ? legal : declarable;
  const useful = withTargets.filter((id) => !isInertOnBoard(state, combatantId, ctx.moves[id], ctx));
  const pickable = useful.length > 0 ? useful : withTargets;

  const moveId = weightedPick(
    pickable,
    pickable.map((id) => weightFor(state, combatantId, ctx.moves[id], ctx)),
    random
  );
  const move = ctx.moves[moveId];

  // A switchesUserOut move with no replacement resolves into an ActionBlocked; first benched hero standing.
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
