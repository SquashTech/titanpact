import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { equipment } from '../src/data/equipment';
import { allCombatants } from '../src/data/content';
import { constructedContent } from '../src/data/trials';
import { constructedSide, TEAM_SIZE } from '../src/run/constructed';
import { buildCombatState } from '../src/run/buildCombatState';
import { rosterIdOfCombatant } from '../src/run/combatantIds';
import { pilotActions } from '../src/run/pilot';
import type { AiContext } from '../src/run/ai';
import type { GauntletContent } from '../src/run/gauntlet';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { replacementCandidates } from '../src/engine/combat/switching';
import { sideDefeated, type CombatState, type Side } from '../src/engine/state';
import type { Action } from '../src/engine/combat/actions';
import {
  applyVersusReplacements,
  placeVersusLeads,
  replacementsOwed,
  SIDES,
  stateHash,
  versusActions,
  versusDraft,
  versusPool,
  type VersusEngineDefs,
} from '../src/run/versus';

const content: GauntletContent = { ...constructedContent, typeChart };
const owned = Object.values(heroes)
  .filter((h) => !h.unlock)
  .map((h) => h.id);
const defs: VersusEngineDefs = { heroes: allCombatants, moves, statuses, passives, fieldEffects };
const config = { ...defs, typeChart, benchHpRegenFlat: 10 };

function drafted(seed: number, side: Side) {
  let picks: number[] = [];
  for (let i = 0; i < TEAM_SIZE; i++) picks = [...picks, i % 3];
  return versusDraft(content, versusPool(owned, owned.slice(0, 10)), seed, side, picks);
}

test('versus: a seat’s draft replays from the seed and its picks, and the two seats are dealt different boards', () => {
  const a = drafted(77, 'A');
  assert.strictEqual(a.team.length, TEAM_SIZE);
  assert.strictEqual(a.offer.length, 0);
  assert.deepStrictEqual(drafted(77, 'A'), a);
  assert.notDeepStrictEqual(drafted(77, 'B').team, a.team);
});

test('versus: the pool is the same list whichever player’s owned heroes come first', () => {
  assert.deepStrictEqual(versusPool(['b', 'a'], ['c', 'a']), versusPool(['c', 'a'], ['a', 'b']));
});

interface Log {
  leads: Record<Side, string[]>;
  rounds: { actions: Record<Side, Action[]>; replace: Record<Side, string[]> }[];
}

function board(seed: number): { state: CombatState; ctx: AiContext } {
  const sides = { A: constructedSide(constructedContent, { name: 'A', slots: drafted(seed, 'A').team }), B: constructedSide(constructedContent, { name: 'B', slots: drafted(seed, 'B').team }) };
  const state = buildCombatState(seed, allCombatants, equipment, SIDES.map((side) => ({ side, squad: sides[side].squad, roster: sides[side].run.roster })), passives);
  const ctx: AiContext = {
    heroes: allCombatants,
    moves,
    statuses,
    typeChart,
    passives,
    random: () => 0.5,
    moveIdsFor: (id) => sides[id.startsWith('A:') ? 'A' : 'B'].run.roster.find((r) => r.rosterId === rosterIdOfCombatant(id))!.unlockedMoveIds,
  };
  return { state, ctx };
}

/** Both pilots play a match and write what each side chose, as the two clients would send it. */
function playAndLog(seed: number): { log: Log; hashes: number[] } {
  let { state, ctx } = board(seed);
  const leads = { A: replacementCandidates(state, 'A').slice(0, 2), B: replacementCandidates(state, 'B').slice(0, 2) };
  state = placeVersusLeads(state, leads, defs).state;
  const log: Log = { leads, rounds: [] };
  const hashes: number[] = [];
  for (let i = 0; i < 60 && !sideDefeated(state, 'A') && !sideDefeated(state, 'B'); i++) {
    const actions = { A: pilotActions(state, 'A', ctx, { switching: true }), B: pilotActions(state, 'B', ctx, { switching: true }) };
    state = resolveRound(state, versusActions(actions), config).state;
    const replace = { A: replacementCandidates(state, 'A').slice(0, replacementsOwed(state, 'A')), B: replacementCandidates(state, 'B').slice(0, replacementsOwed(state, 'B')) };
    state = applyVersusReplacements(state, replace, defs).state;
    log.rounds.push({ actions, replace });
    hashes.push(stateHash(state));
  }
  return { log, hashes };
}

function replay(seed: number, log: Log): number[] {
  let { state } = board(seed);
  state = placeVersusLeads(state, log.leads, defs).state;
  return log.rounds.map((round) => {
    state = resolveRound(state, versusActions(round.actions), config).state;
    state = applyVersusReplacements(state, round.replace, defs).state;
    return stateHash(state);
  });
}

test('versus: a match replayed from its seed and its log lands on the same state every round', () => {
  for (const seed of [3, 1009]) {
    const { log, hashes } = playAndLog(seed);
    assert.ok(log.rounds.length > 2, 'the match lasted some rounds');
    assert.deepStrictEqual(replay(seed, JSON.parse(JSON.stringify(log))), hashes);
  }
});

test('versus: replacements land A’s first whichever order the picks arrived in', () => {
  const { state } = board(5);
  const placed = placeVersusLeads(state, { A: replacementCandidates(state, 'A').slice(0, 2), B: replacementCandidates(state, 'B').slice(0, 2) }, defs).state;
  assert.strictEqual(replacementsOwed(placed, 'A'), 0);
  const emptied: CombatState = { ...placed, active: { A: [null, placed.active.A[1]], B: [placed.active.B[0], null] } };
  const picks = { A: [replacementCandidates(emptied, 'A')[0]], B: [replacementCandidates(emptied, 'B')[0]] };
  const one = applyVersusReplacements(emptied, picks, defs).state;
  const two = applyVersusReplacements(emptied, { B: picks.B, A: picks.A }, defs).state;
  assert.strictEqual(stateHash(one), stateHash(two));
  assert.strictEqual(one.active.A[0], picks.A[0]);
});
