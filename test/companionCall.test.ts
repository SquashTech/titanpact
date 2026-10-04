// The companion's Call (docs/companion-call.md). The content (§3.2): one move a line a tier, and
// every one of them castable from off the field — it never asks for a target; of the line's type
// and the tier's band; swinging with the stat the line spikes; and asking nothing of a caster that
// is not there. The engine (§7): the caller's turn, the caster's move, once a fight.

import * as assert from 'assert';
import { test } from './harness';
import { SPAWN_TIERS, spawnId, spawnLineOf, titanspawnLines } from '../src/data/titanspawn';
import { moves } from '../src/data/moves';
import { statusApplicationsOf } from '../src/engine/content';
import type { Action } from '../src/engine/combat/actions';
import type { CombatEvent } from '../src/engine/events';
import type { CombatState } from '../src/engine/state';
import { createCombatant, getEffectiveStat, getMaxHp, getMaxMana, grantCalls, lockInThreshold, sideDefeated, withCalledCaster } from '../src/engine/state';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { allCombatants } from '../src/data/content';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { createFightState } from './fixtures';

const NO_TARGET_ASKED = new Set(['bothEnemies', 'bothAllies', 'randomEnemy']);

const calls = titanspawnLines.flatMap((line) => SPAWN_TIERS.map((tier) => ({ line, tier, moveId: line.callMoveIds[tier] })));

test('companionCall: every line holds one Call move a tier, and it exists', () => {
  assert.strictEqual(calls.length, titanspawnLines.length * SPAWN_TIERS.length);
  for (const { line, tier, moveId } of calls) assert.ok(moves[moveId], `${line.type} ${tier}: ${moveId} is not a move`);
});

test('companionCall: a Call never asks for a target and never strikes the caller’s own partner', () => {
  for (const { line, tier, moveId } of calls) {
    assert.ok(NO_TARGET_ASKED.has(moves[moveId].target), `${line.type} ${tier}: ${moveId} targets ${moves[moveId].target}`);
  }
});

test('companionCall: only Spirit rolls its Call’s target — every other line covers a whole side', () => {
  for (const { line, tier, moveId } of calls) {
    assert.strictEqual(moves[moveId].target === 'randomEnemy', line.type === 'Spirit', `${line.type} ${tier}: ${moveId} targets ${moves[moveId].target}`);
  }
});

test('companionCall: a Call is of the line’s type and the tier’s band', () => {
  for (const { line, tier, moveId } of calls) {
    const move = moves[moveId];
    assert.strictEqual(move.type, line.type, `${moveId} is ${move.type}, the line is ${line.type}`);
    assert.strictEqual(move.tier, tier, `${moveId} is ${move.tier}, the seat is ${tier}`);
    assert.ok(!move.typeFollowsUser, `${moveId} is a class move`);
  }
});

test('companionCall: a damaging Call swings with the stat its line spikes at that tier', () => {
  for (const { line, tier, moveId } of calls) {
    const move = moves[moveId];
    if (move.kind !== 'damage') continue;
    const { attack, intelligence } = line.stats[tier];
    const better = attack > intelligence ? 'physical' : intelligence > attack ? 'magical' : move.category;
    assert.strictEqual(move.category, better, `${line.type} ${tier}: ${moveId} is ${move.category} on Atk ${attack} / Int ${intelligence}`);
  }
});

test('companionCall: a Call asks nothing of the caster — no cost, no pivot, no read of its state', () => {
  for (const { line, tier, moveId } of calls) {
    const move = moves[moveId];
    const where = `${line.type} ${tier}: ${moveId}`;
    assert.ok(!move.switchesUserOut, `${where} pivots`);
    assert.ok(!move.selfHpCost && !move.recoilPercent, `${where} costs the caster HP`);
    assert.ok(!move.drainPercent, `${where} heals a caster that is not there`);
    assert.ok(!move.derivedStatDeltas, `${where} reads the caster's own state`);
    assert.ok(move.statDeltaTarget !== 'self', `${where} lands its deltas on the caster`);
    assert.ok(!move.conditionalPower?.requiresUserHpBelow && !move.conditionalPower?.requiresUserStatus, `${where} reads the caster's own state`);
    assert.ok(!move.conditionalPower?.requiresPartnerType, `${where} reads a partner the caster does not have`);
    for (const rider of statusApplicationsOf(move)) assert.ok(rider.target !== 'self', `${where} puts ${rider.statusId} on the caster`);
  }
});

// --- The engine (§7) ---

const engineConfig = { typeChart, heroes: allCombatants, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Revenant and Marrow hold the field for A with Sentinel benched; Warden and Sentinel for B. */
function board(seed = 7): CombatState {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'revenant', side: 'A' },
      { combatantId: 'a2', heroId: 'marrow', side: 'A' },
      { combatantId: 'a3', heroId: 'sentinel', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/** Side A's companion, seated as the Called caster of `type`'s line at `tier`, casting `moveId` (its Call move by default). */
function withCompanion(state: CombatState, type: 'Fire' | 'Stone' | 'Spirit' | 'Mech', tier: 'early' | 'mid' | 'late', moveId?: string): CombatState {
  const line = spawnLineOf(type)!;
  const heroId = spawnId(line, tier);
  const hero = allCombatants[heroId];
  const blank = createCombatant('A:call', heroId, 'A', 0, 0);
  const caster = { ...blank, currentHp: getMaxHp(hero, blank), currentMana: getMaxMana(hero, blank) };
  return withCalledCaster(state, caster, moveId ?? line.callMoveIds[tier]);
}

const call = (combatantId: string): Action => ({ kind: 'call', combatantId });
const ofType = <T extends CombatEvent['type']>(events: CombatEvent[], type: T) =>
  events.filter((e): e is Extract<CombatEvent, { type: T }> => e.type === type);

test('companionCall: a Call is the caller’s turn — the caster casts its move free, and the side’s Call is spent', () => {
  const state = withCompanion(board(), 'Fire', 'mid');
  const { state: next, events } = resolveRound(state, [call('a1')], engineConfig);

  const called = ofType(events, 'Called');
  assert.strictEqual(called.length, 1);
  assert.deepStrictEqual(
    { caller: called[0].combatantId, caster: called[0].calledCombatantId, move: called[0].moveId, left: called[0].callsRemaining },
    { caller: 'a1', caster: 'A:call', move: 'backdraft', left: 0 }
  );
  const used = ofType(events, 'MoveUsed');
  assert.deepStrictEqual(used.map((e) => [e.combatantId, e.manaSpent]), [['A:call', 0]], 'the caller casts nothing; the caster pays nothing');
  assert.ok(!ofType(events, 'ManaChanged').some((e) => e.combatantId === 'A:call'));
  assert.deepStrictEqual(ofType(events, 'DamageDealt').map((e) => e.targetCombatantId).sort(), ['b1', 'b2'], 'Backdraft takes the whole far side');
  assert.strictEqual(next.calls?.A?.remaining, 0);
  assert.ok(events.indexOf(called[0]) < events.indexOf(used[0]), 'Called plays ahead of the move');
});

test('companionCall: once a fight — a second Call is refused and nothing is cast', () => {
  const state = withCompanion(board(), 'Fire', 'mid');
  const first = resolveRound(state, [call('a1')], engineConfig).state;
  const { state: next, events } = resolveRound(first, [call('a2')], engineConfig);
  assert.deepStrictEqual(ofType(events, 'ActionBlocked').map((e) => [e.combatantId, e.reason]), [['a2', 'callUnavailable']]);
  assert.strictEqual(ofType(events, 'MoveUsed').length, 0);
  assert.strictEqual(next.calls?.A?.remaining, 0);
});

test('companionCall: a flinched caller, or one already down, spends nothing', () => {
  const base = withCompanion(board(), 'Fire', 'mid');
  const dazed = { ...base, combatants: { ...base.combatants, a1: { ...base.combatants.a1, statuses: { Daze: { statusId: 'Daze' } } } } };
  const flinch = resolveRound(dazed, [call('a1')], engineConfig);
  assert.deepStrictEqual(ofType(flinch.events, 'ActionBlocked').map((e) => e.reason), ['dazed']);
  assert.strictEqual(flinch.state.calls?.A?.remaining, 1);

  const fallen = { ...base, combatants: { ...base.combatants, a1: { ...base.combatants.a1, fainted: true, currentHp: 0 } } };
  const down = resolveRound(fallen, [call('a1')], engineConfig);
  assert.strictEqual(ofType(down.events, 'Called').length, 0);
  assert.strictEqual(down.state.calls?.A?.remaining, 1);
});

test('companionCall: a benched caller cannot Call', () => {
  const state = withCompanion(board(), 'Fire', 'mid');
  const { state: next, events } = resolveRound(state, [call('a3')], engineConfig);
  assert.deepStrictEqual(ofType(events, 'ActionBlocked').map((e) => e.reason), ['callUnavailable']);
  assert.strictEqual(next.calls?.A?.remaining, 1);
});

test('companionCall: the Call is ordered by its move’s bracket and the caster’s Speed, not the caller’s', () => {
  const state = withCompanion(board(), 'Fire', 'mid');
  const { events } = resolveRound(state, [call('a1')], engineConfig);
  const entry = ofType(events, 'RoundOrdered')[0].order[0];
  const caster = state.combatants['A:call'];
  assert.strictEqual(entry.kind, 'call');
  assert.strictEqual(entry.combatantId, 'a1');
  assert.strictEqual(entry.speed, getEffectiveStat(allCombatants[caster.heroId], caster, 'speed'));
});

test('companionCall: a whole-side Call on allies lands on the fielded pair, never on the caster', () => {
  const state = withCompanion(board(), 'Stone', 'mid'); // Bastion: Shield on both allies
  const { events } = resolveRound(state, [call('a1')], engineConfig);
  const shielded = ofType(events, 'StatusApplied').filter((e) => e.statusId === 'Shield').map((e) => e.combatantId).sort();
  assert.deepStrictEqual(shielded, ['a1', 'a2']);
});

test('companionCall: Spirit’s Call lands on one foe the roll picks', () => {
  const state = withCompanion(board(), 'Spirit', 'late'); // Requiem
  const { events } = resolveRound(state, [call('a1')], engineConfig);
  const hit = ofType(events, 'DamageDealt').map((e) => e.targetCombatantId);
  assert.strictEqual(hit.length, 1);
  assert.ok(hit[0] === 'b1' || hit[0] === 'b2');
});

test('companionCall: every cost on the caster is dropped, and the caster holds no passive', () => {
  const state = withCompanion(board(), 'Mech', 'late', 'meltdown'); // a self-Burn the Call table never seats
  assert.deepStrictEqual(state.combatants['A:call'].passives, {}, 'no Mark, no innate');
  const { state: next, events } = resolveRound(state, [call('a1')], engineConfig);
  assert.ok(ofType(events, 'DamageDealt').length > 0);
  assert.ok(!ofType(events, 'StatusApplied').some((e) => e.combatantId === 'A:call'));
  assert.strictEqual(next.combatants['A:call'].statuses.Burn, undefined);
});

test('companionCall: the caster never counts — not toward lock-in, defeat, regen, or a target', () => {
  const plain = board();
  const state = withCompanion(plain, 'Fire', 'mid');
  assert.strictEqual(lockInThreshold(state, 'A'), lockInThreshold(plain, 'A'));

  const beaten = {
    ...state,
    combatants: Object.fromEntries(
      Object.entries(state.combatants).map(([id, c]) => [id, c.side === 'A' && id !== 'A:call' ? { ...c, fainted: true, currentHp: 0 } : c])
    ),
  };
  assert.ok(sideDefeated(beaten, 'A'), 'a standing caster does not keep a beaten side alive');

  const drained = { ...state, combatants: { ...state.combatants, 'A:call': { ...state.combatants['A:call'], currentMana: 0 } } };
  const { events } = resolveRound(drained, [{ kind: 'move', combatantId: 'b1', moveId: 'tremor' }], engineConfig);
  assert.ok(!ofType(events, 'ManaRegenTicked').some((e) => e.combatantId === 'A:call'));
  assert.ok(!ofType(events, 'DamageDealt').some((e) => e.targetCombatantId === 'A:call'), 'a spread never reaches it');
});

test('companionCall: grantCalls refreshes a side with a caster and leaves one without alone', () => {
  const state = withCompanion(board(), 'Fire', 'mid');
  const spent = resolveRound(state, [call('a1')], engineConfig).state;
  assert.strictEqual(grantCalls(spent, 'A', 1).calls?.A?.remaining, 1);
  assert.strictEqual(grantCalls(spent, 'B', 1).calls?.B, undefined);
});
