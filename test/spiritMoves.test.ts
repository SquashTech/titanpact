// Spirit slate: conditionalPower.requiresUserHpBelow and selfHpCost. Hand-off findings: docs/authoring-moves.md §10.

import { firstStatusApplication } from '../src/engine/content';
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
import { resolveConditionalPowerMultiplier } from '../src/engine/damage/damagePipeline';
import { getMaxHp } from '../src/engine/state';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Revenant (Int 77) attacks alongside Marrow; Warden and Sentinel defend. */
function spiritFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'revenant', side: 'A' },
      { combatantId: 'a2', heroId: 'marrow', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/** Deep mana/HP so riders are reached; the hp modifier must move with currentHp (getMaxHp reads both). */
function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      { ...c, currentMana: 999, currentHp: 1200, statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 } },
    ])
  );
  return { ...state, combatants } as CombatState;
}

/** Puts one combatant at `fraction` of the max HP `withDeepPools` gave it. */
function wounded(state: CombatState, combatantId: string, fraction: number): CombatState {
  const c = state.combatants[combatantId];
  const maxHp = getMaxHp(heroes[c.heroId], c);
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...c, currentHp: Math.round(maxHp * fraction) } },
  } as CombatState;
}

/** Grants a status the way a resolved statusApplication would, without spending a round on the setter. */
function withStatus(state: CombatState, combatantId: string, statusId: string, instance: object): CombatState {
  const c = state.combatants[combatantId];
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...c, statuses: { ...c.statuses, [statusId]: { statusId, ...instance } } },
    },
  } as CombatState;
}

const hpOf = (s: CombatState, id: string) => s.combatants[id].currentHp;

// --- conditionalPower.requiresUserHpBelow ---

test('spirit: Spite doubles off the USER HP fraction, and reads nothing about the target', () => {
  const healthy = withDeepPools(spiritFixture(11));
  const attacker = healthy.combatants.a1;
  const maxHp = getMaxHp(heroes[attacker.heroId], attacker);
  const hp = (fraction: number) => ({ currentHp: Math.round(maxHp * fraction), maxHp });

  const target = healthy.combatants.b1;
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.spite, target, attacker, undefined, maxHp, hp(0.9)), 1);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.spite, target, attacker, undefined, maxHp, hp(0.3)), 2);
  // Strictly below: exactly half is not yet it.
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.spite, target, attacker, undefined, maxHp, hp(0.5)), 1);
});

test('spirit: Vengeance draws the line at 25% and pays x3 — a number, not a second field', () => {
  const healthy = withDeepPools(spiritFixture(12));
  const attacker = healthy.combatants.a1;
  const maxHp = getMaxHp(heroes[attacker.heroId], attacker);
  const hp = (fraction: number) => ({ currentHp: Math.round(maxHp * fraction), maxHp });
  const target = healthy.combatants.b1;

  assert.strictEqual(resolveConditionalPowerMultiplier(moves.vengeance, target, attacker, undefined, maxHp, hp(0.3)), 1);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.vengeance, target, attacker, undefined, maxHp, hp(0.2)), 3);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.spite, target, attacker, undefined, maxHp, hp(0.3)), 2);
});

test('spirit: with no user-HP context the multiplier reports 1 rather than throwing', () => {
  const state = withDeepPools(spiritFixture(13));
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.spite, state.combatants.b1, state.combatants.a1, undefined, undefined, undefined),
    1
  );
});

test('spirit: the user-HP multiplier lands on BasePower, never on multiplierTerm', () => {
  // Two-pipeline separation (CLAUDE.md).
  const state = wounded(withDeepPools(spiritFixture(14)), 'a1', 0.3);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'spite', declaredTarget: 'b1' }];
  const { events } = resolveRound(state, actions, config);

  const hit = events.find((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b1');
  assert.ok(hit && hit.type === 'DamageDealt');
  assert.strictEqual(hit.basePowerMultiplier, 2);
  assert.strictEqual(hit.multiplierTerm, 1);
  assert.strictEqual(hit.basePower, moves.spite.basePower);
});

test('spirit: the user-HP form is asked ONCE PER CAST — a Haunted pair is doubled on both hits or neither', () => {
  const wounded30 = wounded(withDeepPools(spiritFixture(15)), 'a1', 0.3);
  const haunted = withStatus(wounded30, 'b2', 'Haunt', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'spite', declaredTarget: 'b1' }];
  const { events } = resolveRound(haunted, actions, config);

  const hits = events.filter((e) => e.type === 'DamageDealt' && e.sourceCombatantId === 'a1');
  assert.strictEqual(hits.length, 2, 'Haunt should have spread this single-target move onto the partner');
  for (const hit of hits) {
    assert.ok(hit.type === 'DamageDealt');
    assert.strictEqual(hit.basePowerMultiplier, 2, 'every hit in one cast gets the same answer');
  }
});

test('spirit: consumesStatus is inert on the user-HP form — there is no status to strip', () => {
  for (const id of ['spite', 'vengeance']) {
    assert.strictEqual(moves[id].conditionalPower?.requiresTargetStatus, undefined);
    assert.strictEqual(moves[id].conditionalPower?.requiresUserStatus, undefined);
  }
  const state = wounded(withDeepPools(spiritFixture(16)), 'a1', 0.2);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'vengeance', declaredTarget: 'b1' }];
  const { events } = resolveRound(state, actions, config);
  assert.ok(!events.some((e) => e.type === 'StatusRemoved' && e.reason === 'consumed'));
});

// --- selfHpCost ---

test('spirit: Soul Offering pays the ally FIRST and bills the caster after', () => {
  const state = withDeepPools(spiritFixture(20));
  const before = hpOf(state, 'a1');
  const maxHp = getMaxHp(heroes.revenant, state.combatants.a1);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'soulOffering', declaredTarget: 'a2' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.strictEqual(next.combatants.a2.statModifiers.intelligence, 40);
  assert.strictEqual(next.combatants.a2.statModifiers.attack, 40);
  assert.strictEqual(hpOf(next, 'a1'), before - Math.round(maxHp * 0.25));
  const bill = events.find((e) => e.type === 'DamageDealt' && e.selfCost);
  assert.ok(bill && bill.type === 'DamageDealt');
  assert.deepStrictEqual(bill.selfCost, { mode: 'percentMaxHp', amount: 0.25 });
  assert.strictEqual(bill.sourceCombatantId, 'a1');
  assert.strictEqual(bill.targetCombatantId, 'a1');
});

test('spirit: Soul Offering can be pointed at the caster — ally modes include self', () => {
  const state = withDeepPools(spiritFixture(21));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'soulOffering', declaredTarget: 'a1' }];
  const { state: next } = resolveRound(state, actions, config);
  assert.strictEqual(next.combatants.a1.statModifiers.intelligence, 40);
  assert.strictEqual(next.combatants.a1.statModifiers.attack, 40);
});

test('spirit: a percentMaxHp cost has NO floor — it can faint its own caster, and the buff still lands', () => {
  const state = wounded(withDeepPools(spiritFixture(22)), 'a1', 0.1);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'soulOffering', declaredTarget: 'a2' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(next.combatants.a1.fainted, '25% of MAX HP should out-bill a caster sitting at 10%');
  assert.ok(events.some((e) => e.type === 'Fainted' && e.combatantId === 'a1'));
  assert.strictEqual(next.combatants.a2.statModifiers.intelligence, 40);
});

test('spirit: Last Rites deals its damage, then drops the caster to exactly 1 HP', () => {
  const state = withDeepPools(spiritFixture(23));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'lastRites', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(hpOf(next, 'b1') < getMaxHp(heroes.ironWarden, state.combatants.b1), 'the 120 BP body still landed');
  assert.strictEqual(hpOf(next, 'a1'), 1);
  assert.ok(!next.combatants.a1.fainted, 'reduceToHp cannot faint by construction');
  const bill = events.find((e) => e.type === 'DamageDealt' && e.selfCost);
  assert.ok(bill && bill.type === 'DamageDealt');
  assert.deepStrictEqual(bill.selfCost, { mode: 'reduceToHp', amount: 1 });
});

test('spirit: reduceToHp never HEALS — a caster already at 1 pays nothing and gets no event', () => {
  const base = withDeepPools(spiritFixture(24));
  const state = {
    ...base,
    combatants: { ...base.combatants, a1: { ...base.combatants.a1, currentHp: 1 } },
  } as CombatState;
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'lastRites', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.strictEqual(hpOf(next, 'a1'), 1);
  assert.ok(!events.some((e) => e.type === 'DamageDealt' && e.selfCost), 'a zero bill emits no beat at all');
});

test('spirit: Last Rites hands the survivor straight to Vengeance', () => {
  const state = withDeepPools(spiritFixture(25));
  const afterRites = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'lastRites', declaredTarget: 'b1' }] as Action[],
    config
  ).state;

  const attacker = afterRites.combatants.a1;
  const maxHp = getMaxHp(heroes.revenant, attacker);
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.vengeance, afterRites.combatants.b1, attacker, undefined, maxHp, {
      currentHp: attacker.currentHp,
      maxHp,
    }),
    3
  );
});

test('spirit: no move authors a selfHpCost the engine cannot price', () => {
  for (const move of Object.values(moves)) {
    if (!move.selfHpCost) continue;
    if (move.selfHpCost.mode === 'percentMaxHp') {
      assert.ok(move.selfHpCost.amount > 0 && move.selfHpCost.amount <= 1, `${move.id} bills an impossible fraction`);
    } else {
      assert.ok(move.selfHpCost.amount >= 1, `${move.id} would reduce its caster to ${move.selfHpCost.amount} HP`);
    }
  }
});

// --- The Haunt hook ---

test('spirit: every damage move in the slate is single-target, and Haunt is what makes them spread', () => {
  const spirit = Object.values(moves).filter((m) => m.type === 'Spirit');
  const damage = spirit.filter((m) => m.kind === 'damage');
  assert.strictEqual(spirit.length, 17);
  assert.strictEqual(damage.length, 12);
  for (const move of damage) {
    assert.strictEqual(move.target, 'singleEnemy', `${move.id} is a spread move in a slate that has none`);
  }
  assert.ok(statuses.Haunt.spreadTriggerTypes?.includes('Spirit'));
});

test('spirit: three moves plant Haunt and all twelve damage moves cash it in', () => {
  const planters = Object.values(moves)
    .filter((m) => m.type === 'Spirit' && firstStatusApplication(m)?.statusId === 'Haunt')
    .map((m) => m.id)
    .sort();
  assert.deepStrictEqual(planters, ['poltergeist', 'torment', 'wisp']);
  assert.strictEqual(firstStatusApplication(moves.wisp)?.chance, 0.2);
  assert.strictEqual(firstStatusApplication(moves.torment)?.chance, undefined);
  assert.strictEqual(firstStatusApplication(moves.poltergeist)?.chance, undefined);
});

test('spirit: Flicker is the slate only bracket play — everything else resolves at priority 0', () => {
  const bracketed = Object.values(moves).filter((m) => m.type === 'Spirit' && (m.priority ?? 0) !== 0);
  assert.deepStrictEqual(bracketed.map((m) => m.id), ['flicker']);
  assert.strictEqual(moves.flicker.priority, 1);
});

test('spirit: the slate authors no heal-kind move and no cleanse', () => {
  // Deliberate (authoring-moves.md §6): Spirit heals only its caster, via drain and a self HoT.
  const spirit = Object.values(moves).filter((m) => m.type === 'Spirit');
  assert.ok(!spirit.some((m) => m.kind === 'heal'));
  assert.ok(!spirit.some((m) => m.cleanses));
  assert.deepStrictEqual(
    spirit.filter((m) => m.drainPercent).map((m) => m.id).sort(),
    ['drain', 'soulRend']
  );
});

// --- Distribution ---

test('spirit: every move id a hero or level-up pool points at actually exists', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId}'s kit points at missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId}'s level-up pool points at missing move ${moveId}`);
  }
});

test('spirit: no hero or enemy starts with a move it cannot pay for, or has a starter in its own pool', () => {
  // Whole roster on purpose: Spirit re-priced moves that sit in non-Spirit starting kits.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) {
      assert.ok(
        moves[moveId].manaCost <= hero.baseStats.manaPool,
        `${heroId} cannot afford its own starting move ${moveId} (${moves[moveId].manaCost} vs ${hero.baseStats.manaPool})`
      );
    }
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('spirit: Revenant holds the magical line and Sorrow the physical one — split by pipeline, not by tier', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const reachableBy = (heroId: string) => [
    ...heroes[heroId].moveIds,
    ...progressionTable.moveTiers[heroId],
  ];
  const revenant = reachableBy('revenant');
  const sorrow = reachableBy('sorrow');
  const spiritMoves = Object.values(moves).filter((m) => m.type === 'Spirit');

  for (const move of spiritMoves) {
    if (move.category === 'physical') {
      assert.ok(!revenant.includes(move.id), `${move.id} is physical and Revenant is Int 77 / Atk 56`);
      assert.ok(sorrow.includes(move.id), `${move.id} is physical Spirit and Sorrow does not reach it`);
    } else {
      assert.ok(revenant.includes(move.id), `${move.id} is magical Spirit and nothing points at it`);
    }
  }

  assert.ok(heroes.revenant.baseStats.intelligence > heroes.revenant.baseStats.attack);
  assert.ok(heroes.sorrow.baseStats.attack > heroes.sorrow.baseStats.intelligence);

  // Sorrow may reach magical non-damage rows (Soul Offering grants both stats), never magical damage.
  const magicalReached = spiritMoves.filter((m) => m.category === 'magical' && sorrow.includes(m.id));
  assert.deepStrictEqual(
    magicalReached.filter((m) => m.kind === 'damage').map((m) => m.id),
    [],
    'Sorrow is Int 45 — a magical Spirit attack in its pool is strictly worse than the physical row beside it'
  );
  assert.ok(magicalReached.every((m) => m.kind !== 'damage'));
});

test('spirit: Sorrow is a recruit-only mirror of Revenant, and its kit is all its own type', () => {
  assert.strictEqual(heroes.sorrow.starter, false);
  assert.strictEqual(heroes.revenant.starter, true, 'Spirit keeps exactly one hero in the draft');

  assert.strictEqual(heroes.sorrow.moveIds.length, 3);
  for (const id of heroes.sorrow.moveIds) assert.strictEqual(moves[id].type, 'Spirit');
  assert.ok(
    firstStatusApplication(moves[heroes.sorrow.moveIds[1]])?.statusId === 'Haunt',
    'Sorrow starts able to plant the mark its own physical line cashes'
  );
});

test('spirit: the enemy side can demonstrate Haunt end to end', () => {
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  const spookyGoblin = enemies.spookyGoblin;
  const kit = spookyGoblin.moveIds.map((id: string) => moves[id]);
  assert.ok(kit.some((m) => firstStatusApplication(m)?.statusId === 'Haunt'), 'no way to plant the mark');
  assert.ok(kit.some((m) => m.kind === 'damage' && m.type === 'Spirit'), 'no way to cash it in');
  for (const move of kit) assert.ok(move.manaCost <= spookyGoblin.baseStats.manaPool);
});
