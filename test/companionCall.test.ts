// The companion's Call (docs/companion-call.md §3.2): one move a line a tier, and every one of them
// castable from off the field — it never asks for a target; of the line's type and the tier's band;
// swinging with the stat the line spikes; and asking nothing of a caster that is not there.

import * as assert from 'assert';
import { test } from './harness';
import { SPAWN_TIERS, titanspawnLines } from '../src/data/titanspawn';
import { moves } from '../src/data/moves';
import { statusApplicationsOf } from '../src/engine/content';

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
