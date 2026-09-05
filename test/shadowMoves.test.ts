// Shadow slate: conditionalPower.requiresTargetHpBelow (the first numeric damage condition), Stealth into Ambush with consumesStatus. Hand-off findings: docs/authoring-moves.md §10.

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
import { calcDamage, resolveConditionalPowerMultiplier } from '../src/engine/damage/damagePipeline';
import { getMaxHp, hasStatus } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Nightshade (Atk 80 / Spd 85) and Marrow (Int 95) attack; Warden and Sentinel defend. */
function shadowFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'nightshade', side: 'A' },
      { combatantId: 'a2', heroId: 'marrow', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/** Deep mana and HP so no test is gated on the mana curve or turned into a KO test; the hp modifier moves with currentHp because getMaxHp reads both. Everyone starts at FULL, so the execute's control case is honest — use `wounded` to drop one. */
function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      withFullPools({ ...c, statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 } }),
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

// --- conditionalPower.requiresTargetHpBelow ---

test('shadow: Rend doubles off the target HP FRACTION, not off any status', () => {
  const healthy = withDeepPools(shadowFixture(11));
  const target = healthy.combatants.b1;
  const maxHp = getMaxHp(heroes[target.heroId], target);

  assert.strictEqual(resolveConditionalPowerMultiplier(moves.rend, target, healthy.combatants.a1, undefined, maxHp), 1);

  const hurt = wounded(healthy, 'b1', 0.4);
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.rend, hurt.combatants.b1, hurt.combatants.a1, undefined, maxHp),
    2
  );
});

test('shadow: the execute line is strict — a target sitting exactly at half is not under it', () => {
  // damagePipeline.ts uses `<`, not `<=`.
  const state = withDeepPools(shadowFixture(12));
  const maxHp = getMaxHp(heroes[state.combatants.b1.heroId], state.combatants.b1);

  const exactly = wounded(state, 'b1', 0.5);
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.eclipse, exactly.combatants.b1, exactly.combatants.a2, undefined, maxHp),
    1
  );

  const justUnder = { ...exactly.combatants.b1, currentHp: Math.round(maxHp * 0.5) - 1 };
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.eclipse, justUnder, exactly.combatants.a2, undefined, maxHp), 2);
});

test('shadow: without a max HP to compare against, the execute reports its unbuffed power', () => {
  const state = withDeepPools(shadowFixture(13));
  const hurt = wounded(state, 'b1', 0.1);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.rend, hurt.combatants.b1, hurt.combatants.a1), 1);
});

test('shadow: the execute multiplier lands on BASE POWER, never on multiplierTerm', () => {
  // Locked: two-pipeline separation (CLAUDE.md).
  const doubled = calcDamage(moves.rend, 1, ['Shadow'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 2);
  const plain = calcDamage(moves.rend, 1, ['Shadow'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 1);
  assert.strictEqual(doubled.multiplierTerm, plain.multiplierTerm);
  assert.strictEqual(doubled.basePowerMultiplier, 2);
  assert.strictEqual(doubled.damage, plain.damage * 2);
});

test('shadow: Eclipse cannot double off HP it is itself about to remove', () => {
  // resolveRound reads the multiplier BEFORE applyHpDelta.
  const state = wounded(withDeepPools(shadowFixture(14)), 'b1', 0.51);
  const before = state.combatants.b1.currentHp;
  const { state: after, events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a2', moveId: 'eclipse', declaredTarget: 'b1' }],
    config
  );
  const hit = events.find((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b1') as unknown as { basePowerMultiplier: number };
  assert.strictEqual(hit.basePowerMultiplier, 1, 'a target above the line takes an ordinary hit');
  assert.ok(after.combatants.b1.currentHp < before);
});

test('shadow: the execute is read PER TARGET — a spread cast doubles against the wounded foe only', () => {
  const state = wounded(withDeepPools(shadowFixture(15)), 'b1', 0.2);
  const spread = { ...moves.eclipse, id: 'testSpreadEclipse', target: 'bothEnemies' as const };
  const { events } = resolveRound(
    { ...state, combatants: { ...state.combatants } },
    [{ kind: 'move', combatantId: 'a2', moveId: 'testSpreadEclipse' }],
    { ...config, moves: { ...moves, testSpreadEclipse: spread } }
  );
  const hits = events.filter((e) => e.type === 'DamageDealt') as unknown as { targetCombatantId: string; basePowerMultiplier: number }[];
  assert.strictEqual(hits.length, 2);
  assert.strictEqual(hits.find((h) => h.targetCombatantId === 'b1')!.basePowerMultiplier, 2);
  assert.strictEqual(hits.find((h) => h.targetCombatantId === 'b2')!.basePowerMultiplier, 1);
});

test('shadow: consumesStatus is inert on the HP form — there is nothing to strip', () => {
  const greedy = {
    ...moves.rend,
    id: 'testGreedyRend',
    conditionalPower: { requiresTargetHpBelow: 0.5, multiplier: 2, consumesStatus: true },
  };
  const state = withStatus(wounded(withDeepPools(shadowFixture(16)), 'b1', 0.2), 'b1', 'Bleed', {});
  const { state: after, events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'testGreedyRend', declaredTarget: 'b1' }],
    { ...config, moves: { ...moves, testGreedyRend: greedy } }
  );
  assert.ok(hasStatus(after.combatants.b1, 'Bleed'), 'the HP form has no status to consume, so it consumes nothing');
  assert.ok(!events.some((e) => e.type === 'StatusRemoved' && (e as { reason?: string }).reason === 'consumed'));
});

// --- Stealth into Ambush ---

test('shadow: Ambush doubles off the USER Stealth and spends it', () => {
  const hidden = withStatus(withDeepPools(shadowFixture(17)), 'a1', 'Stealth', { duration: 1 });
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.ambush, hidden.combatants.b1, hidden.combatants.a1),
    2
  );

  const { state: after, events } = resolveRound(
    hidden,
    [{ kind: 'move', combatantId: 'a1', moveId: 'ambush', declaredTarget: 'b1' }],
    config
  );
  assert.ok(!hasStatus(after.combatants.a1, 'Stealth'), 'Ambush spends the cover it cashed in');
  assert.ok(
    events.some((e) => e.type === 'StatusRemoved' && e.combatantId === 'a1' && (e as { reason?: string }).reason === 'consumed')
  );
});

test('shadow: an Ambush thrown without Stealth costs the same mana and lands at single power', () => {
  const plain = withDeepPools(shadowFixture(18));
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.ambush, plain.combatants.b1, plain.combatants.a1), 1);
  const { events } = resolveRound(
    plain,
    [{ kind: 'move', combatantId: 'a1', moveId: 'ambush', declaredTarget: 'b1' }],
    config
  );
  const used = events.find((e) => e.type === 'MoveUsed') as { manaSpent: number };
  assert.strictEqual(used.manaSpent, moves.ambush.manaCost);
});

test('shadow: every Stealth grant in the game is duration 1 and self-targeted', () => {
  // Pinned list: a new Stealth grant (any type) must be added here consciously.
  const grants = Object.values(moves).filter((m) => firstStatusApplication(m)?.statusId === 'Stealth');
  assert.deepStrictEqual(grants.map((m) => m.id).sort(), ['magicCloak', 'shadowForm', 'vanish']);
  for (const move of grants) {
    assert.strictEqual(firstStatusApplication(move)!.duration, 1, `${move.id} authors a non-standard Stealth length`);
    assert.strictEqual(firstStatusApplication(move)!.target, 'self', `${move.id} grants Stealth to someone else`);
  }
});

test('shadow: every hero that can be offered Ambush can also reach a Stealth grant', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const [heroId, hero] of Object.entries(heroes)) {
    const reachable = [...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])];
    if (!reachable.includes('ambush')) continue;
    assert.ok(
      reachable.some((id) => firstStatusApplication(moves[id])?.statusId === 'Stealth'),
      `${heroId} can be offered Ambush but has no way to enter Stealth`
    );
  }
});

// --- The slate's own shape ---

test('shadow: the slate is fifteen moves, and every status and condition it names exists', () => {
  const shadow = Object.values(moves).filter((m) => m.type === 'Shadow');
  assert.strictEqual(shadow.length, 15);
  for (const move of shadow) {
    for (const app of statusApplicationsOf(move)) {
      assert.ok(statuses[app.statusId], `${move.id} applies unknown status ${app.statusId}`);
    }
    if (move.conditionalPower) {
      const { requiresTargetStatus, requiresUserStatus, requiresFieldEffect, requiresTargetHpBelow, requiresPartnerType } =
        move.conditionalPower;
      const authored = [
        requiresTargetStatus,
        requiresUserStatus,
        requiresFieldEffect,
        requiresTargetHpBelow,
        requiresPartnerType,
      ].filter((v) => v != null);
      assert.strictEqual(authored.length, 1, `${move.id} must author exactly one side of conditionalPower`);
      if (requiresTargetHpBelow != null) {
        assert.ok(requiresTargetHpBelow > 0 && requiresTargetHpBelow < 1, `${move.id} authors an HP threshold outside (0, 1)`);
      }
    }
  }
});

test('shadow: no move in the GAME authors two sides of conditionalPower', () => {
  // No isValidMoveDefinition exists; damagePipeline.ts checks the forms in a fixed order, so a
  // move authoring two would silently answer the wrong question. Keep exhaustive as new forms land.
  for (const move of Object.values(moves)) {
    if (!move.conditionalPower) continue;
    const {
      requiresTargetStatus,
      requiresUserStatus,
      requiresFieldEffect,
      requiresTargetHpBelow,
      requiresUserHpBelow,
      requiresPartnerType,
    } = move.conditionalPower;
    const authored = [
      requiresTargetStatus,
      requiresUserStatus,
      requiresFieldEffect,
      requiresTargetHpBelow,
      requiresPartnerType,
      requiresUserHpBelow,
    ].filter((v) => v != null);
    assert.strictEqual(authored.length, 1, `${move.id} authors ${authored.length} sides of conditionalPower`);
  }
});

test('shadow: every Poison the slate applies is chanced, and every one runs the standard 3-round timer', () => {
  // Shadow accumulates Poison as a side effect; a guaranteed applier would make it a second Nature.
  const poisoners = Object.values(moves).filter((m) => m.type === 'Shadow' && firstStatusApplication(m)?.statusId === 'Poison');
  assert.deepStrictEqual(poisoners.map((m) => m.id).sort(), ['umbraBolt', 'umbralBeam', 'umbralWave']);
  for (const move of poisoners) {
    assert.strictEqual(firstStatusApplication(move)!.chance, 0.2, `${move.id} is not a 20% Poison`);
    assert.strictEqual(firstStatusApplication(move)!.duration, 3, `${move.id} authors a non-standard Poison timer`);
  }
});

test('shadow: Dusk Blade is the only guaranteed Bleed, and Bleed is the type flat attrition', () => {
  const bleeders = Object.values(moves).filter((m) => m.type === 'Shadow' && firstStatusApplication(m)?.statusId === 'Bleed');
  assert.deepStrictEqual(bleeders.map((m) => m.id).sort(), ['backstab', 'duskBlade', 'shadowSlice']);
  assert.strictEqual(firstStatusApplication(moves.duskBlade)!.chance, undefined);
  assert.strictEqual(firstStatusApplication(moves.backstab)!.chance, 0.3);
  assert.strictEqual(firstStatusApplication(moves.shadowSlice)!.chance, 0.3);
  assert.strictEqual(statuses.Bleed.decay, 'none');
  assert.strictEqual(statuses.Bleed.clearsOnSwitch, false);
});

test('shadow: Shadowstrike is the slate only bracket play — everything else resolves at priority 0', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Shadow') continue;
    assert.strictEqual(move.priority, move.id === 'shadowstrike' ? 1 : 0, `${move.id} has an unexpected priority bracket`);
  }
});

// --- Distribution ---

test('shadow: every move id a hero or level-up pool points at actually exists', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId}'s kit points at missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId}'s level-up pool points at missing move ${moveId}`);
  }
});

test('shadow: no Shadow hero or enemy starts with a move it cannot pay for, or has a starter in its own pool', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    if (!hero.moveIds.some((id) => moves[id]?.type === 'Shadow')) continue;
    for (const moveId of hero.moveIds) {
      assert.ok(
        moves[moveId].manaCost <= hero.baseStats.manaPool,
        `${heroId} cannot afford its own starting move ${moveId}`
      );
    }
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('shadow: every authored Shadow move has a holder', () => {
  // A legitimate orphan gets named here, not the assertion deleted.
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
    .filter((m) => m.type === 'Shadow' && !reachable.has(m.id))
    .map((m) => m.id)
    .sort();
  assert.deepStrictEqual(orphans, []);
});
