// From the Tall Grass: Nautilus's engine verbs — the SwitchedOut hook (Ink), a move's
// firstTurnOnly / oncePerFight / manaCostAll gates (Ink Blast), and a passive's manaSurcharge
// (Deepgrip).

import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import { hasStatus, isMoveUsable, resolveManaCost } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

function withPassive(state: CombatState, combatantId: string, passiveId: string): CombatState {
  const c = state.combatants[combatantId];
  return { ...state, combatants: { ...state.combatants, [combatantId]: { ...c, passives: { ...c.passives, [passiveId]: { passiveId, stacks: 1 } } } } };
}

function patch(state: CombatState, combatantId: string, fields: Partial<CombatState['combatants'][string]>): CombatState {
  return { ...state, combatants: { ...state.combatants, [combatantId]: { ...state.combatants[combatantId], ...fields } } };
}

/** Nautilus leads at a1 beside Cinder, Riptide waits on the bench; two enemies that swing. */
function fixture(seed: number): CombatState {
  const state = createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'nautilus', side: 'A' },
      { combatantId: 'a2', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a3', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'mordax', side: 'B' },
    ]
  );
  return withPassive(state, 'a1', 'ink');
}

const swing = (combatantId: string, heroId: string, target: string): Action =>
  ({ kind: 'move', combatantId, moveId: heroes[heroId].moveIds[0], declaredTarget: target }) as Action;

test('tall grass: Ink fires as Nautilus switches out — both enemies lose Attack and Intelligence', () => {
  const state = fixture(401);
  const { state: next, events } = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' } as Action], config);
  assert.ok(next.bench.A.includes('a1'));
  for (const id of ['b1', 'b2']) {
    assert.strictEqual(next.combatants[id].statModifiers.attack, -10, `${id} Attack`);
    assert.strictEqual(next.combatants[id].statModifiers.intelligence, -10, `${id} Intelligence`);
  }
  assert.ok(events.some((e) => e.type === 'PassiveTriggered' && e.passiveId === 'ink'));
});

test("tall grass: Ink is silent when Nautilus switches IN, and when its partner switches out", () => {
  const inState = fixture(402);
  const benched = patch({ ...inState, active: { ...inState.active, A: ['a3', 'a2'] }, bench: { ...inState.bench, A: ['a1'] } }, 'a1', {});
  const arrived = resolveRound(benched, [{ kind: 'switch', combatantId: 'a3', benchedCombatantId: 'a1' } as Action], config);
  assert.ok(!arrived.events.some((e) => e.type === 'PassiveTriggered' && e.passiveId === 'ink'), 'arriving is not leaving');

  const partner = resolveRound(fixture(403), [{ kind: 'switch', combatantId: 'a2', benchedCombatantId: 'a3' } as Action], config);
  assert.ok(!partner.events.some((e) => e.type === 'PassiveTriggered' && e.passiveId === 'ink'), 'the partner leaving is not Nautilus leaving');
});

test('tall grass: Ink Blast on the lead turn Dazes both foes first, spends every drop of Mana, and retreats through Ink', () => {
  const state = patch(fixture(404), 'a1', { currentMana: 75 });
  assert.strictEqual(resolveManaCost(state, 'a1', moves.inkBlast), 75, 'the whole pool, overflow included');
  const { state: next, events } = resolveRound(
    state,
    [
      { kind: 'move', combatantId: 'a1', moveId: 'inkBlast', switchToCombatantId: 'a3' } as Action,
      swing('b1', 'ironWarden', 'a2'),
      swing('b2', 'mordax', 'a2'),
    ],
    config
  );
  const dazed = events.filter((e) => e.type === 'ActionBlocked' && e.reason === 'dazed').map((e) => (e.type === 'ActionBlocked' ? e.combatantId : ''));
  assert.deepStrictEqual(dazed.sort(), ['b1', 'b2'], 'both foes flinch');
  assert.strictEqual(events.find((e) => e.type === 'MoveUsed' && e.combatantId === 'a1' && e.type === 'MoveUsed')?.type, 'MoveUsed');
  assert.ok(next.bench.A.includes('a1'), 'and Nautilus is gone behind it');
  assert.strictEqual(next.combatants.b1.statModifiers.attack, -10, 'the retreat fired Ink');
  assert.deepStrictEqual(next.combatants.a1.spentMoveIds, ['inkBlast']);
});

test('tall grass: Ink Blast is first-turn-only — gone on round two, back on the round after a switch-in', () => {
  const state = fixture(405);
  assert.ok(isMoveUsable(state, 'a1', moves.inkBlast), 'the lead may open with it');
  const later = { ...state, round: 2 };
  assert.ok(!isMoveUsable(later, 'a1', moves.inkBlast), 'but not a round later');
  const blocked = resolveRound(later, [{ kind: 'move', combatantId: 'a1', moveId: 'inkBlast', switchToCombatantId: 'a3' } as Action], config);
  assert.ok(blocked.events.some((e) => e.type === 'ActionBlocked' && e.reason === 'moveUnavailable'));
  assert.strictEqual(blocked.state.combatants.a1.currentMana, state.combatants.a1.currentMana, 'a blocked cast spends nothing');

  // Benched, then brought in on round 3: its first action is round 4.
  const benched = { ...later, round: 3, active: { ...later.active, A: ['a3', 'a2'] as [string, string] }, bench: { ...later.bench, A: ['a1'] } };
  const arrived = resolveRound(benched, [{ kind: 'switch', combatantId: 'a3', benchedCombatantId: 'a1' } as Action], config).state;
  assert.strictEqual(arrived.combatants.a1.firstActionRound, 4);
  assert.ok(isMoveUsable({ ...arrived, round: 4 }, 'a1', moves.inkBlast), 'the round after it arrives is its first turn out');
});

test('tall grass: Ink Blast is once a fight — a second first turn does not reopen it', () => {
  const spent = patch(fixture(406), 'a1', { spentMoveIds: ['inkBlast'], firstActionRound: 5 });
  assert.ok(!isMoveUsable({ ...spent, round: 5 }, 'a1', moves.inkBlast));
});

test('tall grass: Deepgrip taxes every move of a foe it strikes with Water, 5 a hit, up to 20', () => {
  const state = patch(withPassive(fixture(407), 'a1', 'deepgrip'), 'a1', { currentMana: 999 });
  const before = resolveManaCost(state, 'b1', moves[heroes.ironWarden.moveIds[0]]);
  let working = state;
  for (let i = 0; i < 5; i++) {
    working = resolveRound({ ...working, round: 2 + i }, [{ kind: 'move', combatantId: 'a1', moveId: 'splash', declaredTarget: 'b1' } as Action], config).state;
    working = patch(working, 'b1', { currentHp: 999 });
  }
  assert.strictEqual(working.combatants.b1.manaSurcharge, 20, 'five hits, held at the cap');
  assert.strictEqual(resolveManaCost(working, 'b1', moves[heroes.ironWarden.moveIds[0]]), before + 20);
  assert.ok(!hasStatus(working.combatants.b2, 'Daze'), 'and only the one struck');
  assert.strictEqual(working.combatants.b2.manaSurcharge ?? 0, 0);
});
