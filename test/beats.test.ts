// How a round's events become the beats the fight screen reveals one tap at a time
// (src/view/combat/buildBeats.ts). Pure presentation, but the tap count IS the pace of every
// fight, and the fold is easy to break by adding an event a beat does not expect.

import * as assert from 'assert';
import { test } from './harness';
import { buildBeats } from '../src/view/combat/buildBeats';
import { allCombatants } from '../src/data/content';
import { moves } from '../src/data/moves';
import type { CombatEvent, DamageDealtEvent } from '../src/engine/events';
import type { CombatState } from '../src/engine/state';

const combatants = {
  a1: { combatantId: 'a1', heroId: 'valor', side: 'A' },
  b1: { combatantId: 'b1', heroId: 'crag', side: 'B' },
  b2: { combatantId: 'b2', heroId: 'selkie', side: 'B' },
} as unknown as CombatState['combatants'];

function hit(targetCombatantId: string, amount: number): DamageDealtEvent {
  return {
    type: 'DamageDealt',
    round: 1,
    sourceCombatantId: 'a1',
    targetCombatantId,
    moveId: 'ironFist',
    amount,
    category: 'physical',
    moveType: 'Iron',
    typeMult: 1,
    isCrit: false,
    variance: 1,
    basePower: 40,
    elementalForceBonus: 0,
    basePowerMultiplier: 1,
    offStat: 100,
    defStat: 100,
    ratio: 1,
    stab: 1.25,
    critMultiplier: 1,
    multiplierTerm: 1,
    modifiers: [],
  };
}

const declared: CombatEvent[] = [
  { type: 'TurnStarted', round: 1, combatantId: 'a1' },
  { type: 'MoveDeclared', round: 1, combatantId: 'a1', moveId: 'ironFist', targetCombatantIds: ['b1'] },
  { type: 'MoveUsed', round: 1, combatantId: 'a1', moveId: 'ironFist', manaSpent: 10, damaging: true },
];

const beatsOf = (events: CombatEvent[]) => buildBeats(events, allCombatants, moves, combatants, 'A');

test('beats: a move is two taps — the declaration, then everything it did', () => {
  const beats = beatsOf([
    ...declared,
    hit('b1', 120),
    { type: 'HpChanged', round: 1, combatantId: 'b1', previousHp: 200, newHp: 80, maxHp: 200 },
    { type: 'PassiveTriggered', round: 1, combatantId: 'b1', passiveId: 'vengefulEmblem' },
    { type: 'StatChanged', round: 1, combatantId: 'b1', stat: 'attack', delta: 10, newValue: 10 },
    { type: 'StatChanged', round: 1, combatantId: 'a1', stat: 'attack', delta: 15, newValue: 15 },
  ]);
  assert.strictEqual(beats.length, 2);
  assert.deepStrictEqual(beats[0].bannerMove, { moveId: 'ironFist', casterId: 'a1', enemy: false }, 'the declaration keeps its own beat, drawn as the move bar');
  assert.strictEqual(beats[1].bannerFocus, '120 damage');
  assert.deepStrictEqual(
    beats[1].bannerRiders?.map((r) => [r.source, r.who, r.text]),
    [
      ['Vengeful Emblem', 'Crag', '+10 ATK'],
      [undefined, 'Valor', '+15 ATK'],
    ]
  );
  assert.deepStrictEqual(
    beats[1].popups.map((p) => p.combatantId),
    ['b1', 'b1', 'a1'],
    'every consequence keeps its popup on its own figure'
  );
});

test('beats: a knockout folds into the blow and is held, not tapped', () => {
  const beats = beatsOf([
    ...declared,
    hit('b1', 200),
    { type: 'HpChanged', round: 1, combatantId: 'b1', previousHp: 200, newHp: 0, maxHp: 200 },
    { type: 'Fainted', round: 1, combatantId: 'b1', side: 'B', koCount: 1 },
    { type: 'PassiveTriggered', round: 1, combatantId: 'a1', passiveId: 'vengefulEmblem' },
    { type: 'StatChanged', round: 1, combatantId: 'a1', stat: 'attack', delta: 10, newValue: 10 },
  ]);
  assert.strictEqual(beats.length, 2);
  assert.ok(beats[1].holdsKo);
  assert.strictEqual(beats[1].bannerKo, 'Crag is knocked out!');
  const types = beats[1].events.map((e) => e.type);
  assert.strictEqual(types[types.length - 1], 'Fainted', 'the held KO lands last, after everything it was folded with');
});

test('beats: a spread is one headline, damage by target', () => {
  const beats = beatsOf([...declared, hit('b1', 60), hit('b2', 45)]);
  assert.strictEqual(beats.length, 2);
  assert.strictEqual(beats[1].bannerFocus, 'Crag −60 · Selkie −45');
});

test('beats: a guard reads after the move it turned away, as part of its outcome', () => {
  const beats = beatsOf([
    { type: 'TurnStarted', round: 1, combatantId: 'a1' },
    { type: 'MoveGuarded', round: 1, combatantId: 'b2', sourceCombatantId: 'a1', moveId: 'ironFist', statusId: 'Barrier' },
    { type: 'MoveDeclared', round: 1, combatantId: 'a1', moveId: 'ironFist', targetCombatantIds: ['b1'] },
    { type: 'MoveUsed', round: 1, combatantId: 'a1', moveId: 'ironFist', manaSpent: 10, damaging: true },
    hit('b1', 50),
  ]);
  assert.strictEqual(beats.length, 2);
  assert.ok(beats[0].bannerCast);
  assert.ok(beats[1].events.some((e) => e.type === 'MoveGuarded'));
});

test('beats: a passive answering a switch-in rides on the switch', () => {
  const beats = beatsOf([
    { type: 'SwitchedIn', round: 1, side: 'B', slot: 0, outCombatantId: null, inCombatantId: 'b1' },
    { type: 'SwitchedIn', round: 1, side: 'B', slot: 1, outCombatantId: null, inCombatantId: 'b2' },
    { type: 'PassiveTriggered', round: 1, combatantId: 'b2', passiveId: 'vengefulEmblem' },
    { type: 'StatChanged', round: 1, combatantId: 'b2', stat: 'attack', delta: 10, newValue: 10 },
  ]);
  assert.strictEqual(beats.length, 1, 'two fallen slots filled at once are one send-out');
  assert.deepStrictEqual(beats[0].summonCombatantIds, ['b1', 'b2']);
  assert.strictEqual(beats[0].bannerRiders?.length, 1);
});
