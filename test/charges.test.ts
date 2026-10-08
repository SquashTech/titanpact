// Charges (docs/charges.md): a move's per-fight count, spent per cast, kept through a switch, never
// refilled by Rest or the bench, and binding on both sides.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState, withFullPools } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import { chargesLeft, isMoveUsable } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Two Barrier holders a side, a third on A's bench. */
function fixture(seed: number): CombatState {
  const state = createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
      { combatantId: 'a3', heroId: 'ironWarden', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'packAlpha', side: 'B' },
    ]
  );
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [id, withFullPools({ ...c, statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 } })])
  );
  return { ...state, combatants };
}

const barrier = (combatantId: string): Action => ({ kind: 'move', combatantId, moveId: 'barrier', declaredTarget: combatantId }) as Action;

test('charges: a fight opens full, and a move without Charges reads as unlimited', () => {
  const state = fixture(1);
  assert.strictEqual(chargesLeft(state.combatants.a1, moves.barrier), 2);
  assert.strictEqual(chargesLeft(state.combatants.a1, moves[heroes.cinderKnight.moveIds[0]]), null);
});

test('charges: each cast spends one, and at none the move is refused without spending mana', () => {
  let state = fixture(2);
  state = resolveRound(state, [barrier('a1')], config).state;
  assert.strictEqual(chargesLeft(state.combatants.a1, moves.barrier), 1);
  state = resolveRound(state, [barrier('a1')], config).state;
  assert.strictEqual(chargesLeft(state.combatants.a1, moves.barrier), 0);
  assert.ok(!isMoveUsable(state, 'a1', moves.barrier));

  const before = state.combatants.a1.currentMana;
  const refused = resolveRound(state, [barrier('a1')], config);
  assert.ok(refused.events.some((e) => e.type === 'ActionBlocked' && e.combatantId === 'a1' && e.reason === 'moveUnavailable'));
  assert.ok(!refused.events.some((e) => e.type === 'MoveUsed' && e.combatantId === 'a1'));
  assert.ok(refused.state.combatants.a1.currentMana >= before, 'no mana paid for a refused cast');
});

test('charges: spent Charges stay spent through a switch out and back in', () => {
  let state = fixture(3);
  state = resolveRound(state, [barrier('a1')], config).state;
  state = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' } as Action], config).state;
  assert.ok(state.bench.A.includes('a1'));
  state = resolveRound(state, [{ kind: 'switch', combatantId: 'a3', benchedCombatantId: 'a1' } as Action], config).state;
  assert.strictEqual(chargesLeft(state.combatants.a1, moves.barrier), 1, 'the bench refilled nothing');
});

test('charges: Rest restores mana, never a Charge', () => {
  let state = fixture(4);
  state = resolveRound(state, [barrier('a1')], config).state;
  state = resolveRound(state, [{ kind: 'rest', combatantId: 'a1' } as Action], config).state;
  assert.strictEqual(chargesLeft(state.combatants.a1, moves.barrier), 1);
});

test('charges: the enemy side is capped the same way', () => {
  let state = fixture(5);
  state = resolveRound(state, [barrier('b1')], config).state;
  state = resolveRound(state, [barrier('b1')], config).state;
  assert.ok(!isMoveUsable(state, 'b1', moves.barrier));
});

test('charges: every holder in the catalog holds a whole, positive count', () => {
  for (const move of Object.values(moves)) {
    if (move.chargesPerFight == null) continue;
    assert.ok(Number.isInteger(move.chargesPerFight) && move.chargesPerFight >= 1, `${move.id} holds ${move.chargesPerFight} Charges`);
  }
});

// --- Refills: Squall's Retrieve and Retrieve+ (Restock) ---

function squall(seed: number, passiveId: string): CombatState {
  const state = fixture(seed);
  const base = createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'stormRanger', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'packAlpha', side: 'B' },
    ]
  );
  void state;
  const a1 = withFullPools({ ...base.combatants.a1, statModifiers: { ...base.combatants.a1.statModifiers, manaPool: 999 }, passives: { [passiveId]: { passiveId, stacks: 1 } } });
  return { ...base, combatants: { ...base.combatants, a1 } };
}

const arrow = (target: string): Action => ({ kind: 'move', combatantId: 'a1', moveId: 'stormArrow', declaredTarget: target }) as Action;
const setHp = (state: CombatState, id: string, hp: number): CombatState => ({ ...state, combatants: { ...state.combatants, [id]: { ...state.combatants[id], currentHp: hp } } });

test('charges: Squall opens with Storm Arrow, an Arrow, and holds Retrieve', () => {
  assert.ok(heroes.stormRanger.moveIds.includes('stormArrow'));
  assert.ok(moves.stormArrow.tags?.includes('arrow') && moves.stormArrow.chargesPerFight! > 0);
  assert.deepStrictEqual(heroes.stormRanger.passiveIds, ['retrieve']);
});

test('charges: Retrieve — an Arrow that knocks a foe out gets its Charge back; one that does not, does not', () => {
  let state = squall(11, 'retrieve');
  const hit = resolveRound(state, [arrow('b1')], config);
  assert.ok(!hit.state.combatants.b1.fainted);
  assert.strictEqual(chargesLeft(hit.state.combatants.a1, moves.stormArrow), moves.stormArrow.chargesPerFight! - 1, 'a hit that does not finish keeps the Charge spent');

  state = setHp(hit.state, 'b2', 1);
  const kill = resolveRound(state, [arrow('b2')], config);
  assert.ok(kill.state.combatants.b2.fainted);
  assert.ok(kill.events.some((e) => e.type === 'ChargeRestored' && e.combatantId === 'a1' && e.moveId === 'stormArrow'));
  assert.strictEqual(chargesLeft(kill.state.combatants.a1, moves.stormArrow), moves.stormArrow.chargesPerFight! - 1, 'the killing Arrow came back');
});

test('charges: Retrieve never gives back a Charge for a move that is not an Arrow', () => {
  let state = squall(12, 'retrieve');
  state = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, chargesSpent: { feint: 1 } } } };
  state = setHp(state, 'b2', 1);
  const kill = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'feint', declaredTarget: 'b2' } as Action], config);
  assert.ok(kill.state.combatants.b2.fainted);
  assert.ok(!kill.events.some((e) => e.type === 'ChargeRestored'));
  assert.strictEqual(chargesLeft(kill.state.combatants.a1, moves.feint), 0);
});

test('charges: Retrieve+ — Restock refills every Arrow on a Rest', () => {
  let state = squall(13, 'retrievePlus');
  state = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, chargesSpent: { stormArrow: 3, pinningShot: 2, feint: 1 } } } };
  const rested = resolveRound(state, [{ kind: 'rest', combatantId: 'a1' } as Action], config);
  assert.strictEqual(chargesLeft(rested.state.combatants.a1, moves.stormArrow), moves.stormArrow.chargesPerFight);
  assert.strictEqual(chargesLeft(rested.state.combatants.a1, moves.pinningShot), moves.pinningShot.chargesPerFight);
  assert.strictEqual(chargesLeft(rested.state.combatants.a1, moves.feint), 1, 'Feint is not an Arrow');
});

test('charges: no restoreCharge refills on a timer, a switch or the bench (docs/charges.md)', () => {
  const banned = new Set(['SwitchedIn', 'SwitchedOut', 'RoundEnded', 'RoundStarted', 'ManaGained']);
  for (const passive of Object.values(passives)) {
    for (const reactive of [passive.reactive, passive.alsoReactive]) {
      if (!reactive) continue;
      const refills = [reactive.effect, reactive.alsoEffect].some((e) => e?.kind === 'restoreCharge');
      if (!refills) continue;
      assert.ok(!banned.has(reactive.hook), `${passive.id} refills Charges on ${reactive.hook}`);
      assert.ok(!reactive.whileBenched, `${passive.id} refills Charges from the bench`);
    }
  }
});
