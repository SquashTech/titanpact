// Storm's movepool: random targeting, StatusApplication.target, conditionalPriority, conditionalManaCost, switchesUserOut. Hand-off findings for this slate: docs/authoring-moves.md §10.

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
import { applyStatus } from '../src/engine/combat/statusEngine';
import { orderActions } from '../src/engine/combat/priority';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState } from '../src/engine/state';
import { hasStatus, resolveManaCost } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** tempest (Int) and stormRanger (Atk) attack with crag benched so a pivot has somewhere to go; ironWarden/wildOracle defend. */
function stormFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'tempest', side: 'A' },
      { combatantId: 'a2', heroId: 'stormRanger', side: 'A' },
      { combatantId: 'a3', heroId: 'crag', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

/** Unlimited mana for everyone and 1200 HP for side B, so riders resolve instead of KOs (hp modifier moves with currentHp because getMaxHp reads both). */
function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      {
        ...c,
        currentMana: 999,
        currentHp: c.side === 'B' ? 1200 : c.currentHp,
        statModifiers: { ...c.statModifiers, manaPool: 999, ...(c.side === 'B' ? { hp: 1200 } : {}) },
      },
    ])
  );
  return { ...state, combatants } as CombatState;
}

function afflict(state: CombatState, combatantId: string, statusId: string): CombatState {
  return applyStatus(state, 1, combatantId, statuses[statusId], {}).state;
}

/** Forces `combatantId` to act first within its bracket. */
function outspeeds(state: CombatState, combatantId: string): CombatState {
  const c = state.combatants[combatantId];
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...c, statModifiers: { ...c.statModifiers, speed: 500 } } },
  };
}

// --- The pool itself ---

test('storm: the authored pool is exactly the fifteen designed moves, all Storm-typed', () => {
  const storm = Object.values(moves).filter((m) => m.type === 'Storm');
  assert.deepStrictEqual(
    storm.map((m) => m.id).sort(),
    [
      'chainLightning', 'charge', 'electricBurst', 'ionicZap', 'ionize', 'jolt', 'overcharge', 'risingStatic',
      'shockSlice', 'stormLash', 'stormSurge', 'tailwind', 'thunderbolt', 'thunderclap', 'zap',
    ]
  );
});

test('storm: every "Spread" move in the design table targets both enemies, and no Storm move catches its own partner', () => {
  const byTarget = (target: string) =>
    Object.values(moves)
      .filter((m) => m.type === 'Storm' && m.target === target)
      .map((m) => m.id)
      .sort();
  assert.deepStrictEqual(byTarget('bothEnemies'), ['chainLightning', 'ionize']);
  assert.deepStrictEqual(byTarget('allOthers'), []);
});

test('storm: the four priority-bracket moves are the ones the table marks, and nothing else moved out of bracket 0', () => {
  const fast = Object.values(moves)
    .filter((m) => m.type === 'Storm' && m.priority > 0)
    .map((m) => m.id)
    .sort();
  assert.deepStrictEqual(fast, ['ionicZap', 'ionize', 'zap']);
  // Electric Burst is authored at 0 and only reaches +1 conditionally, so it is deliberately not in the list above.
  assert.strictEqual(moves.electricBurst.priority, 0);
  assert.strictEqual(moves.electricBurst.conditionalPriority?.bonus, 1);
});

test('storm: every damage move in the slate carries Conduct detonation for free — the type-keyed hook, not an authored field', () => {
  const detonators = statuses.Conduct.triggerTypes ?? [];
  assert.ok(detonators.includes('Storm'));
  const damage = Object.values(moves).filter((m) => m.type === 'Storm' && m.kind === 'damage');
  assert.strictEqual(damage.length, 10);
  assert.strictEqual(damage.some((m) => firstStatusApplication(m)?.statusId === 'Conduct' && m.id === 'thunderbolt'), true);
});

// --- Random targeting ---

test('storm: Rising Static lands its Speed on ONE ally and its Conduct on ONE enemy — a payload on both sides of the field', () => {
  const state = withDeepPools(stormFixture(400));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'risingStatic', declaredTarget: null }];
  const { state: next } = resolveRound(state, actions, config);

  const buffed = ['a1', 'a2'].filter((id) => (next.combatants[id].statModifiers.speed ?? 0) === 20);
  const marked = ['b1', 'b2'].filter((id) => hasStatus(next.combatants[id], 'Conduct'));
  assert.strictEqual(buffed.length, 1, 'exactly one ally is quickened');
  assert.strictEqual(marked.length, 1, 'exactly one enemy is marked');
});

test('storm: random targeting is SEEDED — the same seed picks the same pair, and different seeds do not all agree', () => {
  const run = (seed: number) => {
    const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'risingStatic', declaredTarget: null }];
    const { state } = resolveRound(withDeepPools(stormFixture(seed)), actions, config);
    return {
      buffed: ['a1', 'a2'].find((id) => (state.combatants[id].statModifiers.speed ?? 0) === 20),
      marked: ['b1', 'b2'].find((id) => hasStatus(state.combatants[id], 'Conduct')),
    };
  };
  assert.deepStrictEqual(run(401), run(401));
  const spread = [401, 402, 403, 404, 405, 406, 407, 408].map(run);
  assert.ok(
    spread.some((r) => r.buffed !== spread[0].buffed) || spread.some((r) => r.marked !== spread[0].marked),
    'eight seeds all rolled identically — the draw is not actually random'
  );
});

test('storm: a NON-random move draws no targeting RNG at all — every fight authored before random targeting replays identically', () => {
  const state = withDeepPools(stormFixture(410));
  const before = state.rngState;
  const buffOnly: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'charge', declaredTarget: null }];
  const { state: next } = resolveRound(state, buffOnly, config);
  // Charge: self-target buff, no damage roll, no chance rider, and a single action draws no ordering tiebreak.
  assert.deepStrictEqual(next.rngState, before);
});

// --- Conditional priority ---

test('storm: Electric Burst jumps a bracket against a marked target, and stays in bracket 0 against a clean one', () => {
  const clean = withDeepPools(stormFixture(420));
  const marked = afflict(clean, 'b1', 'Conduct');
  const action: Action = { kind: 'move', combatantId: 'a1', moveId: 'electricBurst', declaredTarget: 'b1' };

  const bracketOf = (state: CombatState) => {
    const rival: Action = { kind: 'move', combatantId: 'a2', moveId: 'zap', declaredTarget: 'b1' };
    const { ordered } = orderActions(state, heroes, [rival, action], moves, state.rngState, fieldEffects);
    return ordered[0];
  };
  // Zap is priority 1: a clean Electric Burst (0) loses the bracket; a marked one ties at 1, so Speed is forced to decide.
  assert.strictEqual((bracketOf(clean) as { moveId: string }).moveId, 'zap');
  assert.strictEqual((bracketOf(outspeeds(marked, 'a1')) as { moveId: string }).moveId, 'electricBurst');
});

test('storm: conditional priority reads the board as the round is ORDERED — a mark planted this same round is too late', () => {
  const state = outspeeds(withDeepPools(stormFixture(421)), 'a2');
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a2', moveId: 'stormLash', declaredTarget: 'b1' }, // plants Conduct, resolves first
    { kind: 'move', combatantId: 'a1', moveId: 'electricBurst', declaredTarget: 'b1' },
  ];
  const { ordered } = orderActions(state, heroes, actions, moves, state.rngState, fieldEffects);
  assert.deepStrictEqual(
    ordered.map((a) => (a as { moveId: string }).moveId),
    ['stormLash', 'electricBurst']
  );
});

// --- Conditional mana cost ---

test('storm: Overcharge is free only while BOTH enemies carry Conduct — one mark is not enough', () => {
  const base = withDeepPools(stormFixture(430));
  assert.strictEqual(resolveManaCost(base, 'a1', moves.overcharge), moves.overcharge.manaCost);
  const one = afflict(base, 'b1', 'Conduct');
  assert.strictEqual(resolveManaCost(one, 'a1', moves.overcharge), moves.overcharge.manaCost);
  const both = afflict(one, 'b2', 'Conduct');
  assert.strictEqual(resolveManaCost(both, 'a1', moves.overcharge), 0);
});

test('storm: the conditional price is what the engine actually CHARGES, not just what the view prints', () => {
  const state = afflict(afflict(withDeepPools(stormFixture(431)), 'b1', 'Conduct'), 'b2', 'Conduct');
  const actions: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'overcharge', declaredTarget: 'b1' }];
  const { events } = resolveRound(state, actions, config);

  // Asserted off MoveUsed, not a before/after currentMana read: the regen tick moves the balance either way.
  const used = events.find((e) => e.type === 'MoveUsed' && e.moveId === 'overcharge') as { manaSpent: number } | undefined;
  assert.strictEqual(used?.manaSpent, 0, 'a free Overcharge was charged anyway');
});

test('storm: conditional cost reads the LIVE board, so a mark planted earlier this round already pays for it', () => {
  const state = outspeeds(afflict(withDeepPools(stormFixture(432)), 'b2', 'Conduct'), 'a1');
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'ionize', declaredTarget: null }, // spread Conduct, resolves first
    { kind: 'move', combatantId: 'a2', moveId: 'overcharge', declaredTarget: 'b1' },
  ];
  const { events } = resolveRound(state, actions, config);
  const used = events.find((e) => e.type === 'MoveUsed' && e.moveId === 'overcharge') as { manaSpent: number } | undefined;
  assert.strictEqual(used?.manaSpent, 0, 'the mark planted earlier this round did not pay for Overcharge');
});

test('storm: a wiped enemy side does not vacuously satisfy "both enemies are marked"', () => {
  const state = withDeepPools(stormFixture(433));
  const emptied: CombatState = { ...state, active: { ...state.active, B: [null, null] } };
  assert.strictEqual(resolveManaCost(emptied, 'a1', moves.overcharge), moves.overcharge.manaCost);
});

// --- The pivot ---

test('storm: Tailwind buffs the ally and THEN sends its caster to the bench', () => {
  const state = withDeepPools(stormFixture(440));
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a2', moveId: 'tailwind', declaredTarget: 'a1', switchToCombatantId: 'a3' },
  ];
  const { state: next } = resolveRound(state, actions, config);

  assert.strictEqual(next.combatants.a1.statModifiers.speed ?? 0, 40, 'the ally was not buffed');
  assert.ok(next.active.A.includes('a3'), 'the declared replacement did not come in');
  assert.ok(next.bench.A.includes('a2'), 'the caster did not leave');
});

test('storm: the pivot respects lock-in — at 2 KOs the buff still lands and only the switch is refused', () => {
  const base = withDeepPools(stormFixture(441));
  const locked: CombatState = { ...base, koCount: { ...base.koCount, A: 2 } };
  const before = locked.combatants.a2.currentMana;
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a2', moveId: 'tailwind', declaredTarget: 'a1', switchToCombatantId: 'a3' },
  ];
  const { state: next, events } = resolveRound(locked, actions, config);

  assert.strictEqual(next.combatants.a1.statModifiers.speed ?? 0, 40, 'lock-in swallowed the buff too');
  assert.ok(next.active.A.includes('a2'), 'the caster left despite lock-in');
  assert.ok(next.combatants.a2.currentMana < before, 'the mana was refunded — the move fizzled instead of degrading');
  assert.ok(events.some((e) => e.type === 'ActionBlocked' && e.reason === 'switchBlocked'));
});

test('storm: a pivot with no declared replacement still delivers its buff, and says the switch did not happen', () => {
  const state = withDeepPools(stormFixture(442));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'tailwind', declaredTarget: 'a1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.strictEqual(next.combatants.a1.statModifiers.speed ?? 0, 40);
  assert.ok(next.active.A.includes('a2'));
  assert.ok(events.some((e) => e.type === 'ActionBlocked' && e.reason === 'switchBlocked'));
});

// --- Riders ---

test('storm: Jolt\'s Conduct is chance-gated but its damage is not — no accuracy stat', () => {
  const state = withDeepPools(stormFixture(450));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'jolt', declaredTarget: 'b1' }];
  let sawMark = 0;
  for (let seed = 0; seed < 20; seed++) {
    const { state: next, events } = resolveRound({ ...state, rngState: stormFixture(450 + seed).rngState }, actions, config);
    assert.ok(events.some((e) => e.type === 'DamageDealt' && e.moveId === 'jolt'), 'a chance rider suppressed the damage');
    if (hasStatus(next.combatants.b1, 'Conduct')) sawMark++;
  }
  assert.ok(sawMark > 0 && sawMark < 20, `a 20% rider landed ${sawMark}/20 times — it is not actually gated`);
});

test('storm: Storm Lash plants a mark on a clean target and detonates one it finds, without authoring the detonation', () => {
  const clean = withDeepPools(stormFixture(451));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'stormLash', declaredTarget: 'b1' }];

  const plain = resolveRound(clean, actions, config);
  assert.ok(hasStatus(plain.state.combatants.b1, 'Conduct'), 'the mark was not planted');
  assert.strictEqual(plain.events.some((e) => e.type === 'StatusDetonated'), false);

  const marked = resolveRound(afflict(clean, 'b1', 'Conduct'), actions, config);
  assert.ok(marked.events.some((e) => e.type === 'StatusDetonated'));
  // Detonated, then re-planted by the same move's own rider.
  assert.ok(hasStatus(marked.state.combatants.b1, 'Conduct'));
});

test('storm: Storm Surge buffs both allies and nobody else', () => {
  const state = withDeepPools(stormFixture(452));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'stormSurge', declaredTarget: null }];
  const { state: next } = resolveRound(state, actions, config);
  for (const id of ['a1', 'a2']) {
    assert.strictEqual(next.combatants[id].statModifiers.attack ?? 0, 50);
    assert.strictEqual(next.combatants[id].statModifiers.speed ?? 0, 50);
  }
  for (const id of ['b1', 'b2']) assert.strictEqual(next.combatants[id].statModifiers.attack ?? 0, 0);
});

// --- Distribution ---

test('storm: every move id a hero or level-up pool points at actually exists', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId}'s kit points at missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId}'s level-up pool points at missing move ${moveId}`);
  }
});

test('storm: no Storm hero starts with a move it cannot pay for, or has a starter listed in its own pool', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const heroId of ['stormRanger', 'tempest', 'scallywag']) {
    const hero = heroes[heroId];
    const cheapest = Math.min(...hero.moveIds.map((id) => moves[id].manaCost));
    assert.ok(cheapest <= hero.baseStats.manaPool, `${heroId} cannot afford its own cheapest starting move`);
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      // levelUpMovePool filters unlocked moves out, so a starter in the pool can never be offered.
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('storm: every Storm hero attacks off its better stat — the "no trap pick" north star, at the kit level', () => {
  for (const heroId of ['stormRanger', 'tempest', 'scallywag']) {
    const hero = heroes[heroId];
    const { attack, intelligence } = hero.baseStats;
    const attacks = hero.moveIds.map((id) => moves[id]).filter((m) => m.kind === 'damage');
    assert.ok(attacks.length > 0, `${heroId} has no damage move at all`);
    // A tied Atk/Int line (Tempest) is honest either way; only an exclusively-weaker-stat kit is the trap.
    if (attack === intelligence) continue;
    const wants = attack > intelligence ? 'physical' : 'magical';
    assert.ok(
      attacks.some((m) => m.category === wants),
      `${heroId} attacks only off its weaker stat`
    );
  }
});

test('storm: every hero that can be offered Overcharge can also reach Conduct — the discount and its condition ship together', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const marks = (moveId: string) => firstStatusApplication(moves[moveId])?.statusId === 'Conduct';
  for (const [heroId, hero] of Object.entries(heroes)) {
    const reachable = [...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])];
    // Status-gated costs only; requiresPartnerType (Beast) keys off a partner's TYPE, which no movepool can reach.
    const conditional = reachable.filter(
      (id) =>
        moves[id].conditionalManaCost?.requiresAllEnemiesStatus != null ||
        moves[id].conditionalManaCost?.requiresAnyEnemyStatus != null
    );
    if (conditional.length === 0) continue;
    const pool = hero.baseStats.manaPool;
    if (conditional.every((id) => moves[id].manaCost <= pool)) continue; // affordable outright, no pairing needed
    assert.ok(reachable.some(marks), `${heroId} can only afford ${conditional[0]} at its conditional price but can never apply Conduct`);
  }
});
