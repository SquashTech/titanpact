// Light's authored movepool: conditionalPower.requiresFieldEffect, and Daze as flinch. Mechanics, not numbers.

import { firstStatusApplication, statusApplicationsOf } from '../src/engine/content';
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
import { FIELD_EFFECT_DURATION_ROUNDS } from '../src/engine/combat/fieldEffectEngine';
import { calcDamage, resolveConditionalPowerMultiplier } from '../src/engine/damage/damagePipeline';
import { hasStatus } from '../src/engine/state';
import type { CombatState, FieldEffectContext } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Solace (the magical line, speed 61) and Aegis (the physical one, speed 35) attack; Warden and Sentinel defend. */
function lightFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'dawnwarden', side: 'A' },
      { combatantId: 'a2', heroId: 'aegis', side: 'A' },
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
      withFullPools({ ...c, statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 } }),
    ])
  );
  return { ...state, combatants } as CombatState;
}

/** Turns the ground, the way a resolved fieldEffectApplication would. */
function withField(state: CombatState, fieldEffectId: string): CombatState {
  return { ...state, activeFieldEffect: { fieldEffectId, roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
}

const ctxOf = (state: CombatState): FieldEffectContext => ({ active: state.activeFieldEffect, defs: fieldEffects });

// --- conditionalPower.requiresFieldEffect ---

test('light: Smite doubles off the active FIELD, not off either combatant', () => {
  const bare = withDeepPools(lightFixture(101));
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.smite, bare.combatants.b1, bare.combatants.a1, ctxOf(bare)), 1);

  const hallowed = withField(bare, 'sanctuary');
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.smite, hallowed.combatants.b1, hallowed.combatants.a1, ctxOf(hallowed)),
    2
  );

  // A different field is no Sanctuary: only one field is ever active (docs/field-effects.md).
  const overridden = withField(bare, 'verdantEarth');
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.smite, overridden.combatants.b1, overridden.combatants.a1, ctxOf(overridden)),
    1
  );
});

test('light: the field-side multiplier is a BasePower-stage term, not a damage modifier', () => {
  const doubled = calcDamage(moves.smite, 1, ['Light'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 2);
  assert.strictEqual(doubled.basePowerMultiplier, 2, 'the multiplier rides the BasePower input');
  assert.strictEqual(doubled.multiplierTerm, 1, 'and never becomes a multiplier on the finished hit');

  const plain = calcDamage(moves.smite, 1, ['Light'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 1);
  assert.strictEqual(doubled.damage, plain.damage * 2, 'BasePower is linear, so ×2 BasePower is ×2 damage');
});

test('light: Smite actually hits twice as hard through resolveRound once Sanctuary is up', () => {
  const swing = (hallowed: boolean) => {
    const base = withDeepPools(lightFixture(102));
    const state = hallowed ? withField(base, 'sanctuary') : base;
    const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'smite', declaredTarget: 'b1' }], config);
    const hit = events.find((e) => e.type === 'DamageDealt');
    return hit && hit.type === 'DamageDealt' ? hit : null;
  };

  const bare = swing(false);
  const boosted = swing(true);
  assert.ok(bare && boosted);
  assert.strictEqual(bare.basePowerMultiplier, 1);
  assert.strictEqual(boosted.basePowerMultiplier, 2);
  assert.ok(boosted.amount > bare.amount, `expected the hallowed swing to hit harder (${boosted.amount} vs ${bare.amount})`);
});

test('light: a Consecrate cast earlier in the SAME round already counts', () => {
  // Solace (speed 61) outruns Aegis (35), and Sanctuary gives heals +1 priority, so Consecrate resolves first.
  const state = withDeepPools(lightFixture(103));
  const { events } = resolveRound(
    state,
    [
      { kind: 'move', combatantId: 'a1', moveId: 'consecrate' },
      { kind: 'move', combatantId: 'a2', moveId: 'smite', declaredTarget: 'b1' },
    ],
    config
  );
  const hit = events.find((e) => e.type === 'DamageDealt');
  assert.ok(hit && hit.type === 'DamageDealt');
  assert.strictEqual(hit.basePowerMultiplier, 2, "the partner's Consecrate arrived in time");
});

test('light: a field-side conditional is all-or-nothing across a spread, where a target-side one is per target', () => {
  const state = withField(withDeepPools(lightFixture(104)), 'sanctuary');
  const spread = { ...moves.smite, id: 'testSpreadSmite', target: 'bothEnemies' as const };
  const { events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'testSpreadSmite' }],
    { ...config, moves: { ...moves, testSpreadSmite: spread } }
  );
  const hits = events.filter((e) => e.type === 'DamageDealt');
  assert.strictEqual(hits.length, 2);
  for (const hit of hits) {
    assert.ok(hit.type === 'DamageDealt');
    assert.strictEqual(hit.basePowerMultiplier, 2, 'both halves of the spread read the same board');
  }
});

test('light: consumesStatus is inert on the field form — Sanctuary survives the hit it powered', () => {
  const state = withField(withDeepPools(lightFixture(105)), 'sanctuary');
  const greedy = { ...moves.smite, id: 'testGreedySmite', conditionalPower: { requiresFieldEffect: 'sanctuary', multiplier: 2, consumesStatus: true } };
  const { state: after, events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'testGreedySmite', declaredTarget: 'b1' }],
    { ...config, moves: { ...moves, testGreedySmite: greedy } }
  );

  const hit = events.find((e) => e.type === 'DamageDealt');
  assert.ok(hit && hit.type === 'DamageDealt' && hit.basePowerMultiplier === 2, 'it still got the multiplier');
  assert.deepStrictEqual(events.filter((e) => e.type === 'StatusRemoved'), [], 'and stripped nothing to pay for it');
  assert.strictEqual(after.activeFieldEffect?.fieldEffectId, 'sanctuary', 'the ground is still hallowed');
});

test('light: the new field draws no RNG and leaves board-free callers answering as before', () => {
  const bare = withDeepPools(lightFixture(106));
  const hallowed = withField(bare, 'sanctuary');
  const cast = [{ kind: 'move' as const, combatantId: 'a1', moveId: 'smite', declaredTarget: 'b1' }];
  assert.strictEqual(
    resolveRound(hallowed, cast, config).state.rngState,
    resolveRound(bare, cast, config).state.rngState,
    'the field read is not a roll'
  );

  assert.strictEqual(resolveConditionalPowerMultiplier(moves.smite, bare.combatants.b1, bare.combatants.a1), 1);
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.judgment, hallowed.combatants.b1, hallowed.combatants.a1, ctxOf(hallowed)),
    1
  );
});

// --- The slate's own shape ---

test('light: no Light move applies or scales off something the catalog does not define', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Light') continue;
    for (const app of statusApplicationsOf(move)) {
      assert.ok(statuses[app.statusId], `${move.id} applies unknown status ${app.statusId}`);
    }
    if (move.fieldEffectApplication) {
      assert.ok(fieldEffects[move.fieldEffectApplication], `${move.id} sets unknown field effect ${move.fieldEffectApplication}`);
    }
    if (move.conditionalPower) {
      const { requiresTargetStatus, requiresUserStatus, requiresFieldEffect } = move.conditionalPower;
      const authored = [requiresTargetStatus, requiresUserStatus, requiresFieldEffect].filter(Boolean);
      assert.strictEqual(authored.length, 1, `${move.id} must author exactly one side of conditionalPower`);
      if (requiresFieldEffect) assert.ok(fieldEffects[requiresFieldEffect], `${move.id} scales off unknown field ${requiresFieldEffect}`);
      else assert.ok(statuses[authored[0] as string], `${move.id} scales off unknown status`);
    }
  }
});

test('light: no Daze applier authors a number — the status is flinch-shaped', () => {
  assert.strictEqual(statuses.Daze.shape, 'boolean');
  for (const move of Object.values(moves)) {
    const app = firstStatusApplication(move);
    if (app?.statusId !== 'Daze') continue;
    assert.strictEqual(app.duration, undefined, `${move.id} still authors a Daze duration`);
    assert.strictEqual(app.magnitude, undefined, `${move.id} still authors a Daze magnitude`);
  }
});

test("light: Daze is a bet on turn order — Solace's own riders only pay when it moves first", () => {
  // Blind is guaranteed, so Speed is the only variable.
  const state = withDeepPools(lightFixture(107));
  const fast = resolveRound(
    state,
    [
      { kind: 'move', combatantId: 'a1', moveId: 'blind', declaredTarget: 'b1' }, // Solace, 61
      { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a1' }, // Warden, 30
    ],
    config
  );
  assert.ok(fast.events.some((e) => e.type === 'ActionBlocked' && e.combatantId === 'b1' && e.reason === 'dazed'));
  assert.strictEqual(hasStatus(fast.state.combatants.b1, 'Daze'), false, 'and it does not carry into the next round');

  // Warden gets +20 Speed so it outruns Aegis (35): the Daze still lands, but the hero has already swung.
  const outsped = {
    ...state,
    combatants: {
      ...state.combatants,
      b1: { ...state.combatants.b1, statModifiers: { ...state.combatants.b1.statModifiers, speed: 20 } },
    },
  } as CombatState;
  const slow = resolveRound(
    outsped,
    [
      { kind: 'move', combatantId: 'a2', moveId: 'blind', declaredTarget: 'b1' }, // Aegis, 35 — acts second
      { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a2' }, // Warden, 30 + 20 = 50
    ],
    config
  );
  assert.ok(
    slow.events.some((e) => e.type === 'MoveUsed' && e.combatantId === 'b1'),
    'the foe got its swing off before the Daze existed'
  );
  assert.strictEqual(
    slow.events.some((e) => e.type === 'ActionBlocked'),
    false,
    '25 mana and a whole turn bought nothing'
  );

  for (const move of Object.values(moves)) {
    if (move.type !== 'Light' || firstStatusApplication(move)?.statusId !== 'Daze') continue;
    assert.strictEqual(move.priority, 0, `${move.id} would let Light buy its way past Speed`);
  }
});

test('light: every Light move resolves in bracket 0 — the slate authors no priority column', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Light') continue;
    assert.strictEqual(move.priority, 0, `${move.id} has an unexpected priority bracket`);
  }
});

// --- Distribution ---

test('light: every move id a hero or level-up pool points at actually exists', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId}'s kit points at missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId}'s level-up pool points at missing move ${moveId}`);
  }
});

test('light: no Light hero starts with a move it cannot pay for, or has a starter listed in its own pool', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const heroId of ['dawnwarden', 'aegis']) {
    const hero = heroes[heroId];
    for (const moveId of hero.moveIds) {
      assert.ok(
        moves[moveId].manaCost <= hero.baseStats.manaPool,
        `${heroId} cannot afford its own starting move ${moveId} — the one thing a player cannot fix by drafting`
      );
    }
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('light: every authored Light move has a holder', () => {
  // A legitimate orphan gets named here, not the assertion deleted. Hand-off findings: docs/authoring-moves.md §10.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  const reachable = new Set<string>();
  for (const hero of Object.values({ ...heroes, ...enemies })) for (const id of hero.moveIds) reachable.add(id);
  for (const pool of Object.values(progressionTable.moveTiers)) for (const id of pool) reachable.add(id);
  // An Evolution path reaches moves two ways: granted outright, or added to the level-up pool.
  for (const nodes of Object.values(progressionTable.evolutions)) {
    for (const node of nodes) {
      for (const path of node.paths) {
        for (const id of path.unlocksMoveIds) reachable.add(id);
        for (const id of path.learnableMoveIds ?? []) reachable.add(id);
      }
    }
  }

  const orphans = Object.values(moves)
    .filter((m) => m.type === 'Light' && !reachable.has(m.id))
    .map((m) => m.id)
    .sort();
  assert.deepStrictEqual(orphans, []);
});

test('light: every hero that can be offered Smite can also reach the field effect that turns it on', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const [heroId, hero] of Object.entries(heroes)) {
    const reachable = [...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])];
    const gated = reachable.filter((id) => moves[id]?.conditionalPower?.requiresFieldEffect);
    for (const moveId of gated) {
      const wants = moves[moveId].conditionalPower!.requiresFieldEffect;
      assert.ok(
        reachable.some((id) => moves[id]?.fieldEffectApplication === wants),
        `${heroId} can be offered ${moveId} but has no way to set ${wants}`
      );
    }
  }
});
