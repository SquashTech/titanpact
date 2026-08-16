// docs/conditions.md — the 6th engine contract. Covers the paths the browser
// playtest can't cheaply exercise exhaustively: Daze blocking a move, Bind
// blocking a voluntary switch, Blight's stat-pipeline hook (and its exclusion
// of Speed/HP/Mana), Expose's consume-on-hit into the damage modifier term,
// Regen's decay mirroring Burn, and Cleanse's debuffs-vs-all split.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import { getEffectiveStat, hasStatus } from '../src/engine/state';
import { applyVoluntarySwitch, SwitchBlockedError } from '../src/engine/combat/switching';
import { cleanseStatuses } from '../src/engine/combat/statusEngine';

const config = { typeChart, heroes, moves, statuses, benchHpRegenFlat: 5 };

function twoVTwoFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

function withStatus(
  state: ReturnType<typeof twoVTwoFixture>,
  combatantId: string,
  statusId: string,
  fields: { magnitude?: number; duration?: number }
) {
  const combatant = state.combatants[combatantId];
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...combatant, statuses: { ...combatant.statuses, [statusId]: { statusId, ...fields } } },
    },
  };
}

// --- Daze: hard action-denial ------------------------------------------------

test('status: Daze blocks a move action — no MoveUsed, mana untouched, ActionBlocked emitted', () => {
  const state = withStatus(twoVTwoFixture(100), 'a1', 'Daze', { duration: 2 });
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.strictEqual(events.some((e) => e.type === 'MoveUsed'), false);
  assert.strictEqual(events.some((e) => e.type === 'ActionBlocked' && e.combatantId === 'a1' && e.reason === 'dazed'), true);
  assert.strictEqual(next.combatants.a1.currentMana, heroes.cinderKnight.baseStats.manaPool);
  assert.strictEqual(next.combatants.b1.currentHp, heroes.ironWarden.baseStats.hp); // no damage landed
});

// --- Bind: switch-lock --------------------------------------------------------

test('status: Bind blocks a voluntary switch even without lock-in', () => {
  const state = { ...twoVTwoFixture(101), bench: { ...twoVTwoFixture(101).bench, A: ['bench1'] } };
  const bound = withStatus(state, 'a1', 'Bind', { duration: 5 });
  assert.throws(() => applyVoluntarySwitch(bound, 1, 'a1', 'bench1', statuses), SwitchBlockedError);
});

// --- Blight: the stat-pipeline hook ------------------------------------------

test('status: Blight reduces Attack/Defense/Intelligence/Wisdom multiplicatively, floored', () => {
  const state = twoVTwoFixture(102);
  const blighted = withStatus(state, 'b1', 'Blight', { magnitude: 20 });
  const hero = heroes.ironWarden;
  const baseDefense = hero.baseStats.defense;

  assert.strictEqual(getEffectiveStat(hero, state.combatants.b1, 'defense'), baseDefense);
  assert.strictEqual(getEffectiveStat(hero, blighted.combatants.b1, 'defense'), Math.floor(baseDefense * 0.8));
  assert.strictEqual(getEffectiveStat(hero, blighted.combatants.b1, 'attack'), Math.floor(hero.baseStats.attack * 0.8));
});

test('status: Blight does NOT touch Speed, HP, or Mana — those stay Freeze/resource territory', () => {
  const state = twoVTwoFixture(103);
  const blighted = withStatus(state, 'b1', 'Blight', { magnitude: 50 }); // even at the cap
  const hero = heroes.ironWarden;

  assert.strictEqual(getEffectiveStat(hero, blighted.combatants.b1, 'speed'), hero.baseStats.speed);
  assert.strictEqual(getEffectiveStat(hero, blighted.combatants.b1, 'hp'), hero.baseStats.hp);
  assert.strictEqual(getEffectiveStat(hero, blighted.combatants.b1, 'manaPool'), hero.baseStats.manaPool);
});

test('status: Blight amplifies damage taken end-to-end through resolveRound', () => {
  const plain = twoVTwoFixture(104);
  const blighted = withStatus(plain, 'b1', 'Blight', { magnitude: 40 });
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }];

  const plainResult = resolveRound(plain, actions, config);
  const blightedResult = resolveRound(blighted, actions, config);

  const plainDamage = heroes.ironWarden.baseStats.hp - plainResult.state.combatants.b1.currentHp;
  const blightedDamage = heroes.ironWarden.baseStats.hp - blightedResult.state.combatants.b1.currentHp;
  assert.ok(blightedDamage > plainDamage, `expected Blight to increase damage taken (${plainDamage} -> ${blightedDamage})`);
});

// --- Expose: one-shot damage-pipeline mark -----------------------------------

test('status: Expose amplifies the next hit and is consumed by it', () => {
  const plain = twoVTwoFixture(105);
  const exposed = withStatus(plain, 'b1', 'Expose', { magnitude: 50 });
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }];

  const plainResult = resolveRound(plain, actions, config);
  const exposedResult = resolveRound(exposed, actions, config);

  const plainDamage = heroes.ironWarden.baseStats.hp - plainResult.state.combatants.b1.currentHp;
  const exposedDamage = heroes.ironWarden.baseStats.hp - exposedResult.state.combatants.b1.currentHp;
  assert.ok(exposedDamage > plainDamage, `expected Expose to amplify the hit (${plainDamage} -> ${exposedDamage})`);

  assert.strictEqual(hasStatus(exposedResult.state.combatants.b1, 'Expose'), false);
  assert.ok(exposedResult.events.some((e) => e.type === 'StatusRemoved' && e.statusId === 'Expose' && e.reason === 'consumed'));
});

// --- Regen: the positive mirror of Burn --------------------------------------

test('status: Regen heals at end of round and decays by halving, like Burn', () => {
  const state = twoVTwoFixture(106);
  const hurt = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 10 } } };
  const regenerating = withStatus(hurt, 'a1', 'Regen', { magnitude: 20 });

  const { state: afterRound1, events } = resolveRound(regenerating, [], config);
  assert.strictEqual(afterRound1.combatants.a1.currentHp, 30); // 10 + 20
  assert.strictEqual(afterRound1.combatants.a1.statuses.Regen.magnitude, 10); // floor(20/2)
  assert.ok(events.some((e) => e.type === 'StatusTicked' && e.statusId === 'Regen' && e.kind === 'heal' && e.amount === 20));

  const { state: afterRound2 } = resolveRound(afterRound1, [], config);
  assert.strictEqual(afterRound2.combatants.a1.currentHp, 40); // 30 + 10
  assert.strictEqual(afterRound2.combatants.a1.statuses.Regen.magnitude, 5); // floor(10/2)
});

test('status: Burn/Regen decay to 0 removes the status entirely', () => {
  const state = twoVTwoFixture(107);
  const burning = withStatus(state, 'b1', 'Burn', { magnitude: 1 }); // floor(1/2) = 0
  const { state: next, events } = resolveRound(burning, [], config);

  assert.strictEqual(hasStatus(next.combatants.b1, 'Burn'), false);
  assert.ok(events.some((e) => e.type === 'StatusRemoved' && e.statusId === 'Burn' && e.reason === 'decay'));
});

// --- Cleanse: debuffs-vs-all split (docs/conditions.md §7 resolution) --------

test('status: cleanseStatuses("debuffs") strips everything except Regen', () => {
  const state = twoVTwoFixture(108);
  let afflicted = withStatus(state, 'a1', 'Bleed', {});
  afflicted = withStatus(afflicted, 'a1', 'Blight', { magnitude: 20 });
  afflicted = withStatus(afflicted, 'a1', 'Regen', { magnitude: 15 });

  const { state: cleansed } = cleanseStatuses(afflicted, 1, 'a1', 'debuffs');
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Bleed'), false);
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Blight'), false);
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Regen'), true);
});

test('status: cleanseStatuses("all") strips Regen too', () => {
  const state = twoVTwoFixture(109);
  const afflicted = withStatus(state, 'a1', 'Regen', { magnitude: 15 });
  const { state: cleansed } = cleanseStatuses(afflicted, 1, 'a1', 'all');
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Regen'), false);
});
