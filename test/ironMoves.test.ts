// Iron slate: conditionalManaCost.requiresAnyEnemyStatus, the permanent Attack ramp, Conduct detonation with zero planting. Hand-off findings: docs/authoring-moves.md §10.

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
import { resolveManaCost, effectiveManaCost, hasStatus } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';
import type { Action } from '../src/engine/combat/actions';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Gallant and Valor attack; Warden and Sentinel defend. */
function ironFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'gallant', side: 'A' },
      { combatantId: 'a2', heroId: 'valor', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/** Deep mana and HP so no test is gated on the mana curve or turned into a KO test; the hp modifier moves with currentHp because getMaxHp reads both. */
function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      { ...c, currentMana: 999, currentHp: 1200, statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 } },
    ])
  );
  return { ...state, combatants } as CombatState;
}

function withStatus(state: CombatState, combatantId: string, statusId: string): CombatState {
  const c = state.combatants[combatantId];
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...c, statuses: { ...c.statuses, [statusId]: { statusId } } },
    },
  } as CombatState;
}

function modifiersOf(state: CombatState, combatantId: string) {
  return state.combatants[combatantId].statModifiers as Record<string, number>;
}

// --- conditionalManaCost.requiresAnyEnemyStatus ---

test('iron: Metallic Blade is free while ANY enemy carries Conduct, and full price on a clean board', () => {
  const state = withDeepPools(ironFixture(600));
  const move = moves.metallicBlade;

  assert.strictEqual(resolveManaCost(state, 'a1', move), 40, 'clean board pays the authored price');

  // Marked foe is deliberately the one a1 is NOT obliged to hit.
  const oneMarked = withStatus(state, 'b2', 'Conduct');
  assert.strictEqual(resolveManaCost(oneMarked, 'a1', move), 0);

  const bothMarked = withStatus(oneMarked, 'b1', 'Conduct');
  assert.strictEqual(resolveManaCost(bothMarked, 'a1', move), 0);
});

test('iron: the two sides of conditionalManaCost are genuinely different — one mark frees Metallic Blade, not Overcharge', () => {
  const state = withDeepPools(ironFixture(601));
  const oneMarked = withStatus(state, 'b2', 'Conduct');

  assert.strictEqual(resolveManaCost(oneMarked, 'a1', moves.metallicBlade), 0, 'any-side fires on one mark');
  assert.strictEqual(
    resolveManaCost(oneMarked, 'a1', moves.overcharge),
    moves.overcharge.manaCost,
    'all-side does not'
  );
});

test('iron: a mark on the CASTER\'s own side never makes Metallic Blade free', () => {
  const state = withDeepPools(ironFixture(602));
  const allyMarked = withStatus(state, 'a2', 'Conduct');
  assert.strictEqual(resolveManaCost(allyMarked, 'a1', moves.metallicBlade), 40);
});

test('iron: a wiped enemy side satisfies NEITHER side of conditionalManaCost', () => {
  // The empty-side guard is what stops the `every` side answering true vacuously.
  const base = withDeepPools(ironFixture(603));
  const empty = {
    ...base,
    active: { ...base.active, B: [null, null] },
  } as CombatState;

  assert.strictEqual(resolveManaCost(empty, 'a1', moves.metallicBlade), 40);
  assert.strictEqual(resolveManaCost(empty, 'a1', moves.overcharge), moves.overcharge.manaCost);
});

test('iron: the free cast actually spends 0 mana in a live round, not just in the price function', () => {
  const state = withStatus(withDeepPools(ironFixture(604)), 'b1', 'Conduct');
  const before = state.combatants.a1.currentMana;
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'metallicBlade', declaredTarget: 'b2' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(events.some((e) => e.type === 'MoveUsed' && e.combatantId === 'a1'));
  // Mana only moves by the round's regen tick, never by the cast.
  const spent = before - next.combatants.a1.currentMana;
  assert.ok(spent <= 0, `expected no mana spent, saw ${spent}`);
});

test('iron: swinging Metallic Blade at the MARKED foe cashes the mark; at the other foe it banks it', () => {
  const state = withStatus(withDeepPools(ironFixture(605)), 'b1', 'Conduct');

  const cashed = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'metallicBlade', declaredTarget: 'b1' }],
    config
  );
  assert.strictEqual(hasStatus(cashed.state.combatants.b1, 'Conduct'), false, 'hitting the mark consumes it');
  assert.ok(cashed.events.some((e) => e.type === 'StatusDetonated' && e.statusId === 'Conduct'));
  assert.strictEqual(resolveManaCost(cashed.state, 'a1', moves.metallicBlade), 40, 'and the discount is gone');

  const banked = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'metallicBlade', declaredTarget: 'b2' }],
    config
  );
  assert.ok(hasStatus(banked.state.combatants.b1, 'Conduct'), 'hitting the other foe leaves the mark');
  assert.strictEqual(resolveManaCost(banked.state, 'a1', moves.metallicBlade), 0, 'so it is still free');
});

test('iron: effectiveManaCost stays the board-free answer — the conditional price is resolveManaCost\'s alone', () => {
  assert.strictEqual(effectiveManaCost(moves.metallicBlade), 40);
});

test('iron: every conditionalManaCost in the game authors exactly one side', () => {
  // Both fields are optional; a move authoring neither is a silent dud.
  const conditional = Object.values(moves).filter((m) => m.conditionalManaCost);
  assert.ok(conditional.length >= 3, 'expected Overcharge, Metallic Blade and Pack Leader');
  for (const move of conditional) {
    const c = move.conditionalManaCost!;
    const sides = [c.requiresAllEnemiesStatus, c.requiresAnyEnemyStatus, c.requiresPartnerType].filter((s) => s != null);
    assert.strictEqual(sides.length, 1, `${move.id} authors ${sides.length} sides of conditionalManaCost, not 1`);
  }
});

// --- The Attack ramp: five rows, all permanent ---

test('iron: the Attack ramp compounds across casts and is never spent', () => {
  let state = withDeepPools(ironFixture(610));
  const casts = ['sharpen', 'momentumSwing', 'ironFist'];
  const expected = [30, 50, 55];

  casts.forEach((moveId, i) => {
    const declaredTarget = moves[moveId].target === 'self' ? undefined : 'b1';
    const action = { kind: 'move', combatantId: 'a1', moveId, declaredTarget } as Action;
    state = resolveRound(state, [action], config).state;
    assert.strictEqual(modifiersOf(state, 'a1').attack ?? 0, expected[i], `after ${moveId}`);
  });
});

test('iron: a damage row\'s stat delta lands AFTER its own hit, so Opening Strike shapes the next swing', () => {
  const state = withDeepPools(ironFixture(611));
  const twice = (moveId: string) =>
    resolveRound(
      resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId, declaredTarget: 'b1' }], config).state,
      [{ kind: 'move', combatantId: 'a1', moveId, declaredTarget: 'b1' }],
      config
    );

  const first = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'openingStrike', declaredTarget: 'b1' }],
    config
  );
  assert.strictEqual(modifiersOf(first.state, 'b1').defense ?? 0, -10);

  const second = twice('openingStrike');
  assert.strictEqual(modifiersOf(second.state, 'b1').defense ?? 0, -20);
});

test('iron: Pin Down is a debuff — a buff-kind move with a negative payload aimed at an enemy', () => {
  const state = withDeepPools(ironFixture(612));
  const { state: next, events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'pinDown', declaredTarget: 'b1' }],
    config
  );

  assert.strictEqual(moves.pinDown.kind, 'buff');
  assert.strictEqual(moves.pinDown.target, 'singleEnemy');
  assert.strictEqual(modifiersOf(next, 'b1').defense, -10);
  assert.strictEqual(modifiersOf(next, 'b1').speed, -10);
  assert.strictEqual(events.some((e) => e.type === 'DamageDealt'), false, 'no damage body');
});

test('iron: Reinforce pays BOTH allies, including the caster', () => {
  const state = withDeepPools(ironFixture(613));
  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'reinforce' }],
    config
  );
  for (const id of ['a1', 'a2']) {
    assert.strictEqual(modifiersOf(next, id).attack, 20, `${id} attack`);
    assert.strictEqual(modifiersOf(next, id).defense, 20, `${id} defense`);
  }
  assert.strictEqual(modifiersOf(next, 'b1').attack ?? 0, 0, 'and nothing on the enemy side');
});

// --- Conduct: Iron cashes, never plants ---

test('iron: every damage row detonates Conduct for free, and the slate plants it zero times', () => {
  const ironMoves = Object.values(moves).filter((m) => m.type === 'Iron');
  const damage = ironMoves.filter((m) => m.kind === 'damage');
  const planters = ironMoves.filter((m) => firstStatusApplication(m)?.statusId === 'Conduct');

  assert.strictEqual(ironMoves.length, 16, 'the authored slate is sixteen rows');
  assert.strictEqual(damage.length, 11, 'eleven of them detonate Conduct for free');
  assert.strictEqual(planters.length, 0, 'and none of them plants it');
  assert.ok(statuses.Conduct.triggerTypes?.includes('Iron'));
});

test('iron: an Iron hit on a marked foe is worth 10% max HP more than the same hit unmarked', () => {
  const state = withDeepPools(ironFixture(620));
  const marked = withStatus(state, 'b1', 'Conduct');
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'heavyBlow', declaredTarget: 'b1' }];

  const plain = resolveRound(state, actions, config);
  const cashed = resolveRound(marked, actions, config);

  const maxHp = heroes.ironWarden.baseStats.hp + 1200;
  const expectedBonus = Math.ceil(maxHp * 0.1);
  const plainDamage = state.combatants.b1.currentHp - plain.state.combatants.b1.currentHp;
  const cashedDamage = marked.combatants.b1.currentHp - cashed.state.combatants.b1.currentHp;

  // heavyBlow rolls a 30% crit, so assert the detonation amount rather than the hit difference.
  const detonated = cashed.events.find((e) => e.type === 'StatusDetonated') as any;
  assert.ok(detonated, 'no detonation');
  assert.strictEqual(detonated.amount, expectedBonus);
  assert.ok(cashedDamage > 0 && plainDamage > 0);
});

// --- What the slate does NOT have ---

test('iron: the slate authors exactly one priority row, and no heal, cleanse or field effect', () => {
  const ironMoves = Object.values(moves).filter((m) => m.type === 'Iron');
  const bracketed = ironMoves.filter((m) => m.priority !== 0);
  assert.deepStrictEqual(bracketed.map((m) => m.id), ['swiftBlow']);
  assert.strictEqual(moves.swiftBlow.priority, 1, 'and it is a POSITIVE bracket — Iron never swings slow');

  for (const move of ironMoves) {
    assert.notStrictEqual(move.kind, 'heal', `${move.id} is heal-kind`);
    assert.ok(!move.cleanses, `${move.id} cleanses`);
    assert.ok(!move.fieldEffectApplication, `${move.id} sets a field effect`);
  }
  const riders = ironMoves.filter((m) => firstStatusApplication(m));
  assert.strictEqual(riders.length, 1, 'exactly one status rider in sixteen rows');
  assert.strictEqual(riders[0].id, 'serratedSlice');
  assert.strictEqual(firstStatusApplication(riders[0])?.statusId, 'Bleed');
  assert.strictEqual(firstStatusApplication(riders[0])?.chance, 0.3);
});

test('iron: the re-authored Fortify is a guard buff only, and Wisdom is grantable off-Mind only by Overdrive', () => {
  // Off-Mind Wisdom grants are a pinned list: Overdrive (safe by price — one fifth of a 100-mana capstone)
  // and Archon Blast (safe by reach — enemy-only, held by no hero kit or pool). A new one is a decision.
  assert.deepStrictEqual(moves.fortify.statDeltas, [{ stat: 'defense', amount: 15 }]);
  assert.strictEqual(moves.fortify.target, 'self');
  // statDeltaTarget 'self' on a self-target move is a no-op the label renders as "(Self) — Self".
  assert.strictEqual(moves.fortify.statDeltaTarget, undefined);

  const wisdomGrants = Object.values(moves).filter((m) =>
    m.statDeltas?.some((d) => d.stat === 'wisdom' && d.amount > 0)
  );
  assert.deepStrictEqual(wisdomGrants.map((m) => m.id).sort(), ['archonBlast', 'brainWard', 'mentalFortress', 'overdrive', 'stasis']);
  for (const move of wisdomGrants) {
    assert.ok(
      move.type === 'Mind' || move.id === 'overdrive' || move.id === 'archonBlast',
      `${move.id} grants Wisdom off-Mind — a third type reaching Wisdom is a decision, not a rounding`
    );
  }
  assert.strictEqual(moves.overdrive.manaCost, 100);
  assert.strictEqual(moves.overdrive.statDeltas?.length, 5);

  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  assert.ok(
    !Object.values(heroes).some((h) => h.moveIds.includes('archonBlast')),
    'Archon Blast is in a recruitable hero\'s starting kit — it is a Wisdom grant a player can now hold'
  );
  assert.ok(
    !Object.values(progressionTable.moveTiers).some((pool) => pool.includes('archonBlast')),
    'Archon Blast is in a level-up pool — it is a Wisdom grant a player can now learn'
  );
});

test('iron: Swift Blow lands its Conduct detonation ABOVE bracket 0 — the one thing no other Iron row can do', () => {
  const state = withStatus(withDeepPools(ironFixture(630)), 'b1', 'Conduct');
  const { events } = resolveRound(
    state,
    [
      { kind: 'move', combatantId: 'b1', moveId: 'openingStrike', declaredTarget: 'a1' },
      { kind: 'move', combatantId: 'a1', moveId: 'swiftBlow', declaredTarget: 'b1' },
    ],
    config
  );
  const order = events.filter((e) => e.type === 'MoveUsed').map((e: any) => e.combatantId);
  assert.strictEqual(order[0], 'a1');
  assert.ok(events.some((e) => e.type === 'StatusDetonated' && e.statusId === 'Conduct'));
});

test('iron: Conjured Sword is the one magical row, and no Iron hero holds it', () => {
  // Every Iron hero is Int 40 or below; the row lives on casters only.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const magical = Object.values(moves).filter((m) => m.type === 'Iron' && m.category === 'magical');
  assert.deepStrictEqual(magical.map((m) => m.id), ['conjuredSword']);

  for (const [heroId, hero] of Object.entries(heroes)) {
    if (!hero.types.includes('Iron')) continue;
    const reachable = [...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])];
    assert.ok(!reachable.includes('conjuredSword'), `${heroId} is an Iron hero and can learn Conjured Sword`);
  }

  const holders = Object.entries(progressionTable.moveTiers).filter(([, pool]) => pool.includes('conjuredSword'));
  assert.ok(holders.length > 0, 'nothing points at Conjured Sword at all');
  for (const [heroId] of holders) {
    const hero = heroes[heroId];
    assert.ok(
      hero.baseStats.intelligence > hero.baseStats.attack,
      `${heroId} holds Conjured Sword but is not a caster`
    );
  }
});

// --- Distribution and roster checks ---

test('iron: every move id in a kit, an enemy kit or a level-up pool resolves', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId} kit points at missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId} pool points at missing move ${moveId}`);
  }
});

test('iron: no hero or enemy starts with a move it cannot pay for, or has a starter in its own pool', () => {
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

test('iron: no hero attacks off its weaker stat — the three Iron heroes are all physical', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const [heroId, hero] of Object.entries(heroes)) {
    if (!hero.types.includes('Iron')) continue;
    const reachable = [...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])].map((id) => moves[id]);
    const damage = reachable.filter((m) => m.kind === 'damage');
    const wants = hero.baseStats.attack >= hero.baseStats.intelligence ? 'physical' : 'magical';
    assert.ok(damage.length > 0, `${heroId} has no damage move at all`);
    assert.ok(damage.some((m) => m.category === wants), `${heroId} attacks only off its weaker stat`);
  }
});

test('iron: the enemy side can demonstrate the type end to end', () => {
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  const warrior = enemies.goblinWarrior;
  const kit = warrior.moveIds.map((id: string) => moves[id]);
  assert.ok(kit.every((m) => m.type === 'Iron'));
  assert.ok(kit.some((m) => m.statDeltaTarget === 'self'), 'no way to show the Attack ramp');
  assert.ok(
    kit.some((m) => m.statDeltas?.some((d) => d.stat === 'defense' && d.amount < 0)),
    'no way to show the Defense debuff'
  );
  for (const move of kit) assert.ok(move.manaCost <= warrior.baseStats.manaPool);
});
