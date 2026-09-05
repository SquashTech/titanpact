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
import { getMaxHp } from '../../src/engine/state';
import type { CombatEvent } from '../../src/engine/events';
import type { Action } from '../../src/engine/combat/actions';
import { resolveRound } from '../../src/engine/combat/resolveRound';
import { applyForcedReplacement } from '../../src/engine/combat/switching';
import { resolveBattleStartEntries, resolvePassiveReactions } from '../../src/engine/combat/passiveEngine';
import { DEFAULT_PACT_CLOCK } from '../../src/engine/combat/pactClock';
import { buildCombatState } from '../../src/run/buildCombatState';
import { pickAiAction, type AiContext } from '../../src/run/ai';
import { hasAffordableMoveInFight, isLockedIn } from '../../src/engine/state';
import { relicTeamStatModifiers } from '../../src/run/relics';
import { relicTeamPassiveGrants } from '../../src/run/passives';
import { relicTeamStatusGrants } from '../../src/run/statusGrants';
import type { RosterEntry } from '../../src/run/state';
import type { Squad } from '../../src/run/squad';
import type { Rng } from './rng';

const PLAYER_SIDE: Side = 'A';
const AI_SIDE: Side = 'B';

/**
 * Hard stop. The Pact Clock starts at round 30 and escalates +5%/round, so a
 * live fight is over by ~round 40; anything past this is an engine stall, and
 * it is counted as one rather than silently ended.
 */
const MAX_ROUNDS = 80;

const config = { typeChart, heroes: allCombatants, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

export interface CombatantTelemetry {
  heroId: string;
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
  /** The Pact Clock ticked at least once. */
  pactTicked: boolean;
  /** Player-side turns taken, and how many were spent Resting or cycling out. */
  playerTurns: number;
  playerRests: number;
  playerSwitches: number;
  /** The player side lost 2+ heroes, so voluntary switching was locked out. */
  lockedIn: boolean;
  /** Player squad's surviving HP over its max, at the final state. */
  playerHpFrac: number;
  telemetry: Record<string, CombatantTelemetry>;
  final: CombatState;
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
    if (working.active[side][slot] !== null || working.bench[side].length === 0) continue;
    const inId = working.bench[side][0];
    const replaced = applyForcedReplacement(working, working.round, side, slot, inId, statuses);
    working = replaced.state;
    events.push(...replaced.events);
    const entry = resolvePassiveReactions(working, working.round, replaced.events, allCombatants, statuses, passives, fieldEffects);
    working = entry.state;
    events.push(...entry.events);
  }
  return working;
}

function recordEvents(events: readonly CombatEvent[], telemetry: Record<string, CombatantTelemetry>): void {
  for (const event of events) {
    switch (event.type) {
      case 'DamageDealt': {
        const source = telemetry[event.sourceCombatantId];
        const target = telemetry[event.targetCombatantId];
        if (source) source.damageDealt += event.amount;
        if (target) target.damageTaken += event.amount;
        break;
      }
      case 'Healed': {
        const source = telemetry[event.sourceCombatantId];
        if (source) source.healingDone += event.amount;
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
function creditKos(events: readonly CombatEvent[], telemetry: Record<string, CombatantTelemetry>): void {
  const lastHitter: Record<string, string> = {};
  for (const event of events) {
    if (event.type === 'DamageDealt') lastHitter[event.targetCombatantId] = event.sourceCombatantId;
    else if (event.type === 'Fainted') {
      const killer = telemetry[lastHitter[event.combatantId] ?? ''];
      if (killer && killer.side !== telemetry[event.combatantId]?.side) killer.kos += 1;
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
      side: combatant.side,
      roundsActive: 0,
      damageDealt: 0,
      damageTaken: 0,
      healingDone: 0,
      kos: 0,
      died: false,
    };
  }

  const opening = resolveBattleStartEntries(start, 1, allCombatants, statuses, passives, fieldEffects);
  let state = opening.state;
  recordEvents(opening.events, telemetry);

  const playerCtx = { ...contextFor(playerRoster, state), random: rng };
  const aiCtx = { ...contextFor(aiRoster, state), random: rng };

  let rounds = 0;
  let pactTicked = false;
  let playerTurns = 0;
  let playerRests = 0;
  let playerSwitches = 0;

  while (rounds < MAX_ROUNDS && !sideDefeated(state, PLAYER_SIDE) && !sideDefeated(state, AI_SIDE)) {
    const events: CombatEvent[] = [];
    // The player's forced replacements resolve before declaration, the AI's after
    // resolution — the same order the screen enforces.
    state = fillOpenSlots(state, PLAYER_SIDE, events);
    recordEvents(events, telemetry);

    const playerActive = aliveActiveIdsOn(state, PLAYER_SIDE);
    const aiActive = aliveActiveIdsOn(state, AI_SIDE);
    if (playerActive.length === 0 || aiActive.length === 0) break;
    for (const id of [...playerActive, ...aiActive]) telemetry[id].roundsActive += 1;

    const switches = input.playerSwitching === false ? {} : manaCycleSwitches(state, PLAYER_SIDE, playerCtx, playerActive);
    const actions: Action[] = [
      ...playerActive.map((id): Action =>
        switches[id] ? { kind: 'switch', combatantId: id, benchedCombatantId: switches[id] } : pickAiAction(state, id, playerCtx)
      ),
      ...aiActive.map((id) => pickAiAction(state, id, aiCtx)),
    ];

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

    recordEvents(roundEvents, telemetry);
    creditKos(roundEvents, telemetry);
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
    pactTicked,
    playerTurns,
    playerRests,
    playerSwitches,
    lockedIn: state.koCount[PLAYER_SIDE] >= 2,
    playerHpFrac: maxHp > 0 ? hp / maxHp : 0,
    telemetry,
    final: state,
  };
}

export const PACT_CLOCK_START = DEFAULT_PACT_CLOCK.startRound;
export { PLAYER_SIDE, AI_SIDE, MAX_ROUNDS };
