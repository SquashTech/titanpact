// Headless fight resolution — the same loop FightScreen drives, minus the
// presentation layer. Both sides are piloted by run/ai.ts, so what this
// measures is the CONTENT under a fixed, unskilled pilot, never player skill.

import { allCombatants } from '../../src/data/content';
import { moves } from '../../src/data/moves';
import { typeChart } from '../../src/data/typechart';
import { statuses } from '../../src/data/statuses';
import { passives } from '../../src/data/passives';
import { fieldEffects } from '../../src/data/fieldEffects';
import { equipment } from '../../src/data/equipment';
import { relics } from '../../src/data/relics';
import type { CombatState, Side } from '../../src/engine/state';
import { getMaxHp, getEffectiveStat } from '../../src/engine/state';
import type { CombatEvent } from '../../src/engine/events';
import type { StatKey } from '../../src/engine/content';
import { STAT_CEILING_MULTIPLE } from '../../src/engine/state';
import type { Action } from '../../src/engine/combat/actions';
import { resolveRound } from '../../src/engine/combat/resolveRound';
import { applyForcedReplacement, replacementCandidates } from '../../src/engine/combat/switching';
import { resolveBattleStartEntries, resolvePassiveReactions } from '../../src/engine/combat/passiveEngine';
import { DEFAULT_PACT_CLOCK } from '../../src/engine/combat/pactClock';
import { buildCombatState, rosterIdOfCombatant } from '../../src/run/buildCombatState';
import { pickAiAction, type AiContext } from '../../src/run/ai';
import { hasAffordableMoveInFight, isLockedIn } from '../../src/engine/state';
import { relicTeamStatModifiers } from '../../src/run/relics';
import { relicTeamPassiveGrants } from '../../src/run/passives';
import { relicTeamStatusGrants } from '../../src/run/statusGrants';
import type { RosterEntry } from '../../src/run/state';
import type { Squad } from '../../src/run/squad';
import { pilotActions, type PilotOptions } from './pilot';
import type { Rng } from './rng';
import { countBeats } from './beats';
import { shieldStatusDef } from '../../src/engine/status/shield';

const SHIELD_ID = shieldStatusDef(statuses)?.id ?? '';

/** Shield telemetry by the HOLDER's side (docs/shield.md §8 phase 4): pools granted, what they took, how often they broke or hit the cap, and the player side's hits by category so the absorb has a denominator. */
export interface ShieldTally {
  casts: number;
  granted: number;
  absorbed: number;
  broken: number;
  capped: number;
  enemyCasts: number;
  enemyGranted: number;
  enemyAbsorbed: number;
  enemyBroken: number;
  enemyCapped: number;
  /** Full hits (absorbed + through) the PLAYER side took, by the move's category. */
  takenPhysical: number;
  takenMagical: number;
}

export function emptyShieldTally(): ShieldTally {
  return { casts: 0, granted: 0, absorbed: 0, broken: 0, capped: 0, enemyCasts: 0, enemyGranted: 0, enemyAbsorbed: 0, enemyBroken: 0, enemyCapped: 0, takenPhysical: 0, takenMagical: 0 };
}

/** One move's fight ledger, keyed by move id on the CASTER's side: casts, what its hits and heals moved, the KOs its last hit landed, and the mana it was paid. */
export interface MoveTally {
  casts: number;
  damage: number;
  healing: number;
  kos: number;
  manaSpent: number;
}

export function emptyMoveTally(): MoveTally {
  return { casts: 0, damage: 0, healing: 0, kos: 0, manaSpent: 0 };
}

const PLAYER_SIDE: Side = 'A';
const AI_SIDE: Side = 'B';

/**
 * Hard stop. The Pact Clock starts at round 30 and escalates +5%/round, so a
 * live fight is over by ~round 40; anything past this is an engine stall, and
 * it is counted as one rather than silently ended.
 */
const MAX_ROUNDS = 80;

const config = { typeChart, heroes: allCombatants, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 10 };

export interface CombatantTelemetry {
  heroId: string;
  /** The roster entry it was placed from (buildCombatState rosterIdOfCombatant). */
  rosterId: string;
  side: Side;
  roundsActive: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  kos: number;
  died: boolean;
}

export interface FightOutcome {
  won: boolean;
  /** True when neither side was wiped inside MAX_ROUNDS. Counts as a loss. */
  stalemate: boolean;
  rounds: number;
  /** Taps the fight costs to watch: one per beat in buildBeats.ts' grouping, opening included. */
  beats: number;
  /** The Pact Clock ticked at least once. */
  pactTicked: boolean;
  /** Player-side turns taken, and how many were spent Resting or cycling out. */
  playerTurns: number;
  playerRests: number;
  playerSwitches: number;
  /** The player side lost 2+ heroes, so voluntary switching was locked out. */
  lockedIn: boolean;
  /** Player-side casts by the move's authored tier — is the late-tier movepool ever reached? */
  castsByTier: Record<string, number>;
  /** Player-side casts by mana actually spent, in 20-point bands. */
  castsByManaBand: Record<string, number>;
  /** Player-side casts by move id. */
  castsByMove: Record<string, number>;
  /** Per-move ledgers by the caster's side. */
  moves: Record<string, MoveTally>;
  enemyMoves: Record<string, MoveTally>;
  /** Field Effects (docs/field-effects.md "Heralds"): sets by the player side, sets by the enemy side, and rounds the field ended still up, each keyed by field id and summed under 'all'. */
  fieldSets: Record<string, number>;
  enemyFieldSets: Record<string, number>;
  fieldRounds: Record<string, number>;
  /** Move stat deltas by the CASTER's side: how many landed, and |landed| against |authored| summed (docs/stat-scaling.md §8 phase 1). */
  statDeltaCount: number;
  statDeltaAuthored: number;
  statDeltaLanded: number;
  enemyStatDeltaCount: number;
  enemyStatDeltaAuthored: number;
  enemyStatDeltaLanded: number;
  /** The largest |fight modifier| any combatant's stat reached, as a fraction of base + loadout — 1.0 is "doubled" (§10, the ceiling question). */
  peakModifierFrac: number;
  /** Any combatant's stat modifier passed +S or −½S at some round end — what a [−½S, +S] ceiling would have clamped. */
  wouldHaveCapped: boolean;
  /** The same, split: a modifier past +S (a buff the ceiling would have clamped) / under −½S (a debuff). */
  wouldHaveCappedUp: boolean;
  wouldHaveCappedDown: boolean;
  /** Drops the floor held (StatChanged.capped), by the caster's side. */
  heldDrops: number;
  enemyHeldDrops: number;
  shield: ShieldTally;
  /** A used stat's modifier reached −S — the floor at 1 bit, and the ratio against it went to the moon. */
  floored: boolean;
  /** Total effective stats (the six combat stats) each side FIELDED — who is out-scaling whom. */
  playerSquadStats: number;
  enemySquadStats: number;
  /** Player squad's surviving HP over its max, at the final state. */
  playerHpFrac: number;
  telemetry: Record<string, CombatantTelemetry>;
  final: CombatState;
}

const STAT_TOTAL_KEYS = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'] as const;

/** Sum of the six combat stats across everything a side fielded, bench included. HP is counted at its authored figure, which is twice the weight of any other stat — it applies to both sides equally, so the axis is comparable even though it is not budget-priced. */
function squadStatTotal(state: CombatState, side: Side): number {
  let total = 0;
  for (const combatant of Object.values(state.combatants)) {
    if (combatant.side !== side) continue;
    const hero = allCombatants[combatant.heroId];
    for (const stat of STAT_TOTAL_KEYS) total += getEffectiveStat(hero, combatant, stat);
  }
  return total;
}

function aliveActiveIdsOn(state: CombatState, side: Side): string[] {
  return state.active[side].filter((id): id is string => id !== null && !state.combatants[id].fainted);
}

function sideDefeated(state: CombatState, side: Side): boolean {
  const list = Object.values(state.combatants).filter((c) => c.side === side);
  return list.length > 0 && list.every((c) => c.fainted);
}

function contextFor(roster: readonly RosterEntry[], state: CombatState): AiContext {
  const byRosterId = new Map(roster.map((r) => [r.rosterId, r]));
  return {
    heroes: allCombatants,
    moves,
    statuses,
    typeChart,
    // Mirrors FightScreen: the entry's unlocked kit, falling back to the hero's authored one.
    moveIdsFor: (combatantId) => {
      const entry = byRosterId.get(combatantId.slice(combatantId.indexOf(':') + 1));
      if (entry && entry.unlockedMoveIds.length > 0) return entry.unlockedMoveIds;
      return allCombatants[state.combatants[combatantId].heroId].moveIds;
    },
  };
}

/** Fills fainted-out active slots from the bench; forced replacement ignores lock-in for both sides. */
function fillOpenSlots(state: CombatState, side: Side, events: CombatEvent[]): CombatState {
  let working = state;
  for (const slot of [0, 1] as const) {
    const candidates = replacementCandidates(working, side);
    if (working.active[side][slot] !== null || candidates.length === 0) continue;
    const inId = candidates[0];
    const replaced = applyForcedReplacement(working, working.round, side, slot, inId, statuses);
    working = replaced.state;
    events.push(...replaced.events);
    const entry = resolvePassiveReactions(working, working.round, replaced.events, allCombatants, statuses, passives, fieldEffects);
    working = entry.state;
    events.push(...entry.events);
  }
  return working;
}

/** 0-19, 20-39, 40-59, 60-79, 80+ — the bands that separate an Early kit from a late-tier one. */
function manaBand(spent: number): string {
  if (spent >= 80) return '80+';
  const lo = Math.floor(spent / 20) * 20;
  return `${lo}-${lo + 19}`;
}

function recordEvents(
  events: readonly CombatEvent[],
  telemetry: Record<string, CombatantTelemetry>,
  casts?: { byTier: Record<string, number>; byManaBand: Record<string, number>; byMove: Record<string, number> },
  deltas?: { count: number; authored: number; landed: number; enemyCount: number; enemyAuthored: number; enemyLanded: number; held: number; enemyHeld: number },
  shield?: { tally: ShieldTally; held: Record<string, number> },
  field?: { sets: Record<string, number>; enemySets: Record<string, number>; rounds: Record<string, number> },
  moveTallies?: { player: Record<string, MoveTally>; enemy: Record<string, MoveTally> }
): void {
  const tallyFor = (combatantId: string, moveId: string): MoveTally | undefined => {
    if (!moveTallies || !moves[moveId]) return undefined;
    const side = telemetry[combatantId]?.side;
    if (!side) return undefined;
    const bucket = side === PLAYER_SIDE ? moveTallies.player : moveTallies.enemy;
    return (bucket[moveId] ??= emptyMoveTally());
  };
  // A StatChanged names its holder, not its caster; the caster is the side of the last MoveUsed.
  let casterSide: Side | undefined;
  // A FieldEffectSet names no side either: it follows the MoveUsed that carried it, or the SwitchedIn a Herald fired on.
  let fieldSetterSide: Side | undefined;
  for (const event of events) {
    if (event.type === 'MoveUsed') casterSide = fieldSetterSide = telemetry[event.combatantId]?.side;
    if (event.type === 'SwitchedIn') fieldSetterSide = event.side;
    if (field && event.type === 'FieldEffectSet') {
      const bucket = fieldSetterSide === AI_SIDE ? field.enemySets : field.sets;
      bucket[event.fieldEffectId] = (bucket[event.fieldEffectId] ?? 0) + 1;
      bucket.all = (bucket.all ?? 0) + 1;
    }
    if (field && (event.type === 'FieldEffectTicked' || event.type === 'FieldEffectExpired')) {
      field.rounds[event.fieldEffectId] = (field.rounds[event.fieldEffectId] ?? 0) + 1;
      field.rounds.all = (field.rounds.all ?? 0) + 1;
    }
    if (event.type === 'StatChanged' && deltas && event.capped && casterSide) {
      if (casterSide === PLAYER_SIDE) deltas.held += 1;
      else deltas.enemyHeld += 1;
    }
    if (event.type === 'StatChanged' && deltas && event.authored !== undefined && casterSide) {
      if (casterSide === PLAYER_SIDE) {
        deltas.count += 1;
        deltas.authored += Math.abs(event.authored);
        deltas.landed += Math.abs(event.delta);
      } else {
        deltas.enemyCount += 1;
        deltas.enemyAuthored += Math.abs(event.authored);
        deltas.enemyLanded += Math.abs(event.delta);
      }
    }
    if (event.type === 'MoveUsed') {
      const tally = tallyFor(event.combatantId, event.moveId);
      if (tally) {
        tally.casts += 1;
        tally.manaSpent += event.manaSpent;
      }
    }
    if (event.type === 'MoveUsed' && casts && telemetry[event.combatantId]?.side === PLAYER_SIDE) {
      const tier = moves[event.moveId]?.tier ?? 'early';
      casts.byTier[tier] = (casts.byTier[tier] ?? 0) + 1;
      const band = manaBand(event.manaSpent);
      casts.byManaBand[band] = (casts.byManaBand[band] ?? 0) + 1;
      casts.byMove[event.moveId] = (casts.byMove[event.moveId] ?? 0) + 1;
    }
    if (shield && SHIELD_ID) {
      const t = shield.tally;
      if (event.type === 'StatusApplied' && event.statusId === SHIELD_ID) {
        const player = telemetry[event.combatantId]?.side === PLAYER_SIDE;
        const before = shield.held[event.combatantId] ?? 0;
        const after = event.magnitude ?? 0;
        shield.held[event.combatantId] = after;
        if (player) { t.casts += 1; t.granted += Math.max(0, after - before); if (event.capped) t.capped += 1; }
        else { t.enemyCasts += 1; t.enemyGranted += Math.max(0, after - before); if (event.capped) t.enemyCapped += 1; }
      }
      if (event.type === 'StatusRemoved' && event.statusId === SHIELD_ID) {
        shield.held[event.combatantId] = 0;
        if (event.reason === 'broken') {
          if (telemetry[event.combatantId]?.side === PLAYER_SIDE) t.broken += 1;
          else t.enemyBroken += 1;
        }
      }
      if (event.type === 'DamageDealt') {
        const player = telemetry[event.targetCombatantId]?.side === PLAYER_SIDE;
        const absorbed = event.absorbed ?? 0;
        if (absorbed > 0) {
          shield.held[event.targetCombatantId] = Math.max(0, (shield.held[event.targetCombatantId] ?? 0) - absorbed);
          if (player) t.absorbed += absorbed;
          else t.enemyAbsorbed += absorbed;
        }
        if (player && !event.recoil && !event.selfCost) {
          if (event.category === 'physical') t.takenPhysical += event.amount + absorbed;
          else t.takenMagical += event.amount + absorbed;
        }
      }
      if (event.type === 'StatusDetonated' && event.absorbed) {
        shield.held[event.combatantId] = Math.max(0, (shield.held[event.combatantId] ?? 0) - event.absorbed);
        if (telemetry[event.combatantId]?.side === PLAYER_SIDE) t.absorbed += event.absorbed;
        else t.enemyAbsorbed += event.absorbed;
      }
    }
    switch (event.type) {
      case 'DamageDealt': {
        const source = telemetry[event.sourceCombatantId];
        const target = telemetry[event.targetCombatantId];
        if (source) source.damageDealt += event.amount;
        if (target) target.damageTaken += event.amount;
        // A self-cost or recoil is the move's price, not its output; an absorbed hit still counts as output.
        if (!event.recoil && !event.selfCost && source && target && source.side !== target.side) {
          const tally = tallyFor(event.sourceCombatantId, event.moveId);
          if (tally) tally.damage += event.amount + (event.absorbed ?? 0);
        }
        break;
      }
      case 'Healed': {
        const source = telemetry[event.sourceCombatantId];
        if (source) source.healingDone += event.amount;
        const tally = tallyFor(event.sourceCombatantId, event.moveId);
        if (tally) tally.healing += event.amount;
        break;
      }
      case 'Fainted': {
        const victim = telemetry[event.combatantId];
        if (victim) victim.died = true;
        break;
      }
      default:
        break;
    }
  }
}

/**
 * KO credit: the last DamageDealt to land on a combatant before its Fainted in
 * the same round's stream. Statuses and the Pact Clock kill without a
 * DamageDealt, so those deaths are simply uncredited.
 */
function creditKos(
  events: readonly CombatEvent[],
  telemetry: Record<string, CombatantTelemetry>,
  moveTallies?: { player: Record<string, MoveTally>; enemy: Record<string, MoveTally> }
): void {
  const lastHitter: Record<string, string> = {};
  const lastMove: Record<string, string> = {};
  for (const event of events) {
    if (event.type === 'DamageDealt') {
      lastHitter[event.targetCombatantId] = event.sourceCombatantId;
      lastMove[event.targetCombatantId] = event.moveId;
    } else if (event.type === 'Fainted') {
      const killer = telemetry[lastHitter[event.combatantId] ?? ''];
      if (killer && killer.side !== telemetry[event.combatantId]?.side) {
        killer.kos += 1;
        const moveId = lastMove[event.combatantId] ?? '';
        if (moveTallies && moves[moveId]) {
          const bucket = killer.side === PLAYER_SIDE ? moveTallies.player : moveTallies.enemy;
          (bucket[moveId] ??= emptyMoveTally()).kos += 1;
        }
      }
    }
  }
}

/**
 * The player's one edge over run/ai.ts, and the only asymmetry in this
 * simulator: a hero about to Rest is pulled for a benched hero that can still
 * act. This is the mana-cycling engine the design is built around, and
 * pickAiAction has no notion of it — in the real game the ENEMY never
 * voluntarily switches either, so giving it only to the player is the faithful
 * reading, not a thumb on the scale.
 */
function manaCycleSwitches(state: CombatState, side: Side, ctx: AiContext, actingIds: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (isLockedIn(state, side)) return out;
  const claimed = new Set<string>();
  for (const id of actingIds) {
    if (hasAffordableMoveInFight(state, id, ctx.moveIdsFor(id), moves, allCombatants)) continue;
    const replacement = state.bench[side].find(
      (benchId) =>
        !claimed.has(benchId) &&
        !state.combatants[benchId].fainted &&
        hasAffordableMoveInFight(state, benchId, ctx.moveIdsFor(benchId), moves, allCombatants)
    );
    if (!replacement) continue;
    claimed.add(replacement);
    out[id] = replacement;
  }
  return out;
}

/** Who pilots the PLAYER side. The enemy is always run/ai.ts — that is what the game ships. */
export type PilotKind = 'chart' | 'greedy';

export interface FightInput {
  seed: number;
  playerRoster: readonly RosterEntry[];
  playerSquad: Squad;
  playerRelicIds: readonly string[];
  aiRoster: readonly RosterEntry[];
  aiSquad: Squad;
  rng: Rng;
  /** Off reproduces a player who only ever Rests. */
  playerSwitching?: boolean;
  /** 'greedy' pilots the player side with scripts/sim/pilot.ts; 'chart' leaves it on run/ai.ts. */
  pilot?: PilotKind;
}

/** The original player side: run/ai.ts plus the reactive mana cycle. */
function chartPilotActions(state: CombatState, playerCtx: AiContext, playerActive: readonly string[], switching: boolean): Action[] {
  const switches = switching ? manaCycleSwitches(state, PLAYER_SIDE, playerCtx, playerActive) : {};
  return playerActive.map((id): Action =>
    switches[id] ? { kind: 'switch', combatantId: id, benchedCombatantId: switches[id] } : pickAiAction(state, id, playerCtx)
  );
}

export function simulateFight(input: FightInput): FightOutcome {
  const { seed, playerRoster, playerSquad, playerRelicIds, aiRoster, aiSquad, rng } = input;

  const start = buildCombatState(
    seed,
    allCombatants,
    equipment,
    [
      {
        side: PLAYER_SIDE,
        squad: playerSquad,
        roster: playerRoster,
        teamStatModifiers: relicTeamStatModifiers(playerRelicIds, relics),
        teamPassiveGrants: relicTeamPassiveGrants(playerRelicIds, relics),
        teamStatusGrants: relicTeamStatusGrants(playerRelicIds, relics),
      },
      { side: AI_SIDE, squad: aiSquad, roster: aiRoster },
    ],
    passives
  );

  const telemetry: Record<string, CombatantTelemetry> = {};
  for (const combatant of Object.values(start.combatants)) {
    telemetry[combatant.combatantId] = {
      heroId: combatant.heroId,
      rosterId: rosterIdOfCombatant(combatant.combatantId),
      side: combatant.side,
      roundsActive: 0,
      damageDealt: 0,
      damageTaken: 0,
      healingDone: 0,
      kos: 0,
      died: false,
    };
  }

  const field = { sets: {} as Record<string, number>, enemySets: {} as Record<string, number>, rounds: {} as Record<string, number> };
  const opening = resolveBattleStartEntries(start, 1, allCombatants, statuses, passives, fieldEffects);
  let state = opening.state;
  // A Herald on the opening lead sets its field here, before any round.
  recordEvents(opening.events, telemetry, undefined, undefined, undefined, field);
  let beats = countBeats(opening.events);

  const playerCtx = { ...contextFor(playerRoster, state), random: rng };
  const aiCtx = { ...contextFor(aiRoster, state), random: rng };

  let rounds = 0;
  let pactTicked = false;
  let playerTurns = 0;
  let playerRests = 0;
  let playerSwitches = 0;
  const casts = { byTier: {} as Record<string, number>, byManaBand: {} as Record<string, number>, byMove: {} as Record<string, number> };
  const deltas = { count: 0, authored: 0, landed: 0, enemyCount: 0, enemyAuthored: 0, enemyLanded: 0, held: 0, enemyHeld: 0 };
  const shield = { tally: emptyShieldTally(), held: {} as Record<string, number> };
  const moveTallies = { player: {} as Record<string, MoveTally>, enemy: {} as Record<string, MoveTally> };
  let peakModifierFrac = 0;
  let wouldHaveCapped = false;
  let floored = false;
  let wouldHaveCappedUp = false;
  let wouldHaveCappedDown = false;

  while (rounds < MAX_ROUNDS && !sideDefeated(state, PLAYER_SIDE) && !sideDefeated(state, AI_SIDE)) {
    const events: CombatEvent[] = [];
    // The player's forced replacements resolve before declaration, the AI's after
    // resolution — the same order the screen enforces.
    state = fillOpenSlots(state, PLAYER_SIDE, events);
    recordEvents(events, telemetry);
    beats += countBeats(events);

    const playerActive = aliveActiveIdsOn(state, PLAYER_SIDE);
    const aiActive = aliveActiveIdsOn(state, AI_SIDE);
    if (playerActive.length === 0 || aiActive.length === 0) break;
    for (const id of [...playerActive, ...aiActive]) telemetry[id].roundsActive += 1;

    const playerActions: Action[] =
      input.pilot === 'greedy'
        ? pilotActions(state, PLAYER_SIDE, playerCtx, { switching: input.playerSwitching !== false } as PilotOptions)
        : chartPilotActions(state, playerCtx, playerActive, input.playerSwitching !== false);
    const actions: Action[] = [...playerActions, ...aiActive.map((id) => pickAiAction(state, id, aiCtx))];

    for (const action of actions) {
      if (state.combatants[action.combatantId].side !== PLAYER_SIDE) continue;
      playerTurns += 1;
      if (action.kind === 'rest') playerRests += 1;
      else if (action.kind === 'switch') playerSwitches += 1;
    }

    const result = resolveRound(state, actions, config);
    state = result.state;
    rounds += 1;
    const roundEvents = [...result.events];
    if (roundEvents.some((e) => e.type === 'PactTicked')) pactTicked = true;

    const replacementEvents: CombatEvent[] = [];
    state = fillOpenSlots(state, AI_SIDE, replacementEvents);
    roundEvents.push(...replacementEvents);

    recordEvents(roundEvents, telemetry, casts, deltas, shield, field, moveTallies);
    beats += countBeats(roundEvents);
    creditKos(roundEvents, telemetry, moveTallies);

    // The ceiling question (docs/stat-scaling.md §10) is asked of stats a hero USES: the offensive
    // stat it does not swing with is skipped, since a flat +25 on a caster's 25 Attack is past +S
    // and means nothing.
    for (const combatant of Object.values(state.combatants)) {
      const line = allCombatants[combatant.heroId].baseStats;
      const dumpStat: StatKey = line.attack >= line.intelligence ? 'intelligence' : 'attack';
      for (const [stat, modifier] of Object.entries(combatant.statModifiers) as [StatKey, number][]) {
        if (!modifier || stat === 'mpRegen' || stat === dumpStat) continue;
        const s = line[stat] + (combatant.baselineStatModifiers[stat] ?? 0);
        if (s <= 0) continue;
        peakModifierFrac = Math.max(peakModifierFrac, Math.abs(modifier) / s);
        if (modifier > s || modifier < -s / 2) wouldHaveCapped = true;
        if (modifier > s * (STAT_CEILING_MULTIPLE - 1)) wouldHaveCappedUp = true;
        if (modifier < -s / 2) wouldHaveCappedDown = true;
        if (modifier <= -s) floored = true;
      }
    }
  }

  const playerDown = sideDefeated(state, PLAYER_SIDE);
  const aiDown = sideDefeated(state, AI_SIDE);
  const stalemate = !playerDown && !aiDown;

  let hp = 0;
  let maxHp = 0;
  for (const combatant of Object.values(state.combatants)) {
    if (combatant.side !== PLAYER_SIDE) continue;
    hp += Math.max(0, combatant.currentHp);
    maxHp += getMaxHp(allCombatants[combatant.heroId], combatant);
  }

  return {
    won: aiDown && !playerDown,
    stalemate,
    rounds,
    beats,
    pactTicked,
    playerTurns,
    playerRests,
    playerSwitches,
    lockedIn: state.koCount[PLAYER_SIDE] >= 2,
    playerSquadStats: squadStatTotal(opening.state, PLAYER_SIDE),
    enemySquadStats: squadStatTotal(opening.state, AI_SIDE),
    castsByTier: casts.byTier,
    castsByManaBand: casts.byManaBand,
    castsByMove: casts.byMove,
    moves: moveTallies.player,
    enemyMoves: moveTallies.enemy,
    fieldSets: field.sets,
    enemyFieldSets: field.enemySets,
    fieldRounds: field.rounds,
    statDeltaCount: deltas.count,
    statDeltaAuthored: deltas.authored,
    statDeltaLanded: deltas.landed,
    enemyStatDeltaCount: deltas.enemyCount,
    enemyStatDeltaAuthored: deltas.enemyAuthored,
    enemyStatDeltaLanded: deltas.enemyLanded,
    heldDrops: deltas.held,
    enemyHeldDrops: deltas.enemyHeld,
    shield: shield.tally,
    peakModifierFrac,
    wouldHaveCapped,
    wouldHaveCappedUp,
    wouldHaveCappedDown,
    floored,
    playerHpFrac: maxHp > 0 ? hp / maxHp : 0,
    telemetry,
    final: state,
  };
}

export const PACT_CLOCK_START = DEFAULT_PACT_CLOCK.startRound;
export { PLAYER_SIDE, AI_SIDE, MAX_ROUNDS };
