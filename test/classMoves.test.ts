// The two engine verbs the Class moves added (docs/growth-overhaul.md §11): `typeFollowsUser` (a
// move wears its holder's primary type, STAB guaranteed) and `chargesPerFight` (a guaranteed
// lockout spent after its Charges, so it is never a permanent lock).

import * as assert from 'assert';
import { test } from './harness';
import { createFightState, withFullPools } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { classes, classMoves } from '../src/data/classes';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { chargesLeft, hasStatus, isMoveUsable, moveForHero, moveForPrimaryType } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';
import type { Action } from '../src/engine/combat/actions';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Cinder (Fire/Iron) and Riptide (Water) against Warden (Iron) and Fang (Beast). */
function fixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'packAlpha', side: 'B' },
    ]
  );
}

function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [id, withFullPools({ ...c, statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 } })])
  );
  return { ...state, combatants } as CombatState;
}

const spentOn = (r: ReturnType<typeof resolveRound>) => (r.events.find((e) => e.type === 'MoveUsed') as any).manaSpent;

// --- typeFollowsUser ---

test('class moves: every class move follows its user\'s type, and no authored slate move does', () => {
  for (const cls of Object.values(classes)) {
    if (cls.grantsMoveId) assert.strictEqual(moves[cls.grantsMoveId].typeFollowsUser, true, `${cls.grantsMoveId} should wear its holder\'s type`);
  }
  for (const move of Object.values(moves)) {
    if (!classMoves[move.id]) assert.strictEqual(move.typeFollowsUser, undefined, `${move.id} is not a class move`);
  }
});

test('class moves: moveForHero re-types a typeFollowsUser move to the hero\'s PRIMARY, and leaves every other move alone', () => {
  const feint = moves.feint;
  assert.strictEqual(moveForHero(feint, heroes.brimstone).type, 'Fire', 'the primary, never the innate secondary');
  assert.strictEqual(moveForHero(feint, heroes.tidecaller).type, 'Water');
  assert.strictEqual(moveForHero(feint, heroes.ironWarden), feint, 'identity when the type already matches');
  assert.strictEqual(moveForHero(moves.ember, heroes.tidecaller), moves.ember, 'an ordinary move is untouched');
  assert.strictEqual(moveForPrimaryType(feint, undefined), feint, 'no primary in hand, no change');
  assert.strictEqual(feint.type, 'Iron', 'the catalog is never mutated');
});

test('class moves: in a fight the move is rolled at the user\'s type — STAB for a Water hero, and the event says so', () => {
  const state = withDeepPools(fixture(31));
  const cast: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'vanish', declaredTarget: 'b1' }];
  const result = resolveRound(state, cast, config);
  const hit = result.events.find((e) => e.type === 'DamageDealt') as any;
  assert.ok(hit, 'Vanish lands before the user withdraws');
  assert.strictEqual(hit.moveType, 'Water', 'Riptide\'s Vanish is Water, not Shadow');
  assert.strictEqual(hit.stab, 1.25, 'and it carries STAB');
});

// --- Charges (docs/charges.md) ---

test('class moves: Feint, Blind and Barrier are the guaranteed lockouts, and each holds two Charges', () => {
  for (const id of ['feint', 'blind', 'barrier']) {
    assert.strictEqual(moves[id].chargesPerFight, 2, `${id} should hold two Charges`);
  }
  assert.strictEqual(moves.feint.statusApplication && (moves.feint.statusApplication as any).chance, undefined, "Feint's Daze is guaranteed");
});

test('class moves: Feint pays its authored cost every cast, twice, and is then spent on this hero only', () => {
  const state = withDeepPools(fixture(32));
  const cast: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'feint', declaredTarget: 'b1' }];

  const first = resolveRound(state, cast, config);
  const second = resolveRound(first.state, cast, config);
  const third = resolveRound(second.state, cast, config);

  assert.strictEqual(spentOn(first), moves.feint.manaCost);
  assert.strictEqual(spentOn(second), moves.feint.manaCost, 'no surcharge');
  // Daze is flinch — cleared at the end of the round it lands in — so the proof is the event, not the state after.
  assert.ok(first.events.some((e) => e.type === 'StatusApplied' && (e as any).statusId === 'Daze' && (e as any).combatantId === 'b1'), 'and the target is Dazed every time');
  assert.ok(!hasStatus(first.state.combatants.b1, 'Daze'), 'and it does not outlive the round');

  assert.strictEqual(chargesLeft(second.state.combatants.a1, moves.feint), 0);
  assert.ok(!isMoveUsable(second.state, 'a1', moves.feint));
  assert.ok(third.events.some((e) => e.type === 'ActionBlocked' && e.combatantId === 'a1' && e.reason === 'moveUnavailable'), 'a third cast is refused');
  assert.ok(!third.events.some((e) => e.type === 'MoveUsed' && e.combatantId === 'a1'), 'and spends nothing');
  assert.strictEqual(chargesLeft(second.state.combatants.a2, moves.feint), 2, 'the partner holds its own');
  assert.strictEqual(moves.feint.chargesPerFight, 2, 'the catalog is never mutated');
});
