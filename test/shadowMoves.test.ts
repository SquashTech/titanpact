// Shadow's authored slate (src/data/moves.ts, 2026-08-30) and the ONE engine
// field it is the first content to need:
//
//   - `conditionalPower.requiresTargetHpBelow` (Rend, Eclipse) — the fourth
//     sibling on the same BasePower-stage multiplier, and the first damage
//     condition in the game that reads a NUMBER off the board rather than the
//     presence of a status (Immolate/Cold Snap), the caster's own status (Seed
//     Shot), or a field effect (Smite).
//
// Four things about it are pinned here because none of them is enforced by a
// type and all four would be invisible if they broke:
//
//   1. It scales the formula's BasePower INPUT, never `multiplierTerm`. The
//      two-pipeline separation is LOCKED (CLAUDE.md); the equivalent assertion
//      exists in fireMoves/natureMoves/lightMoves and this is Shadow's.
//   2. It is read BEFORE the hit's own damage lands, so an execute can never
//      double off HP it is itself about to remove.
//   3. It is read PER TARGET, like the target-status form and unlike the
//      user-side and field forms — a spread execute could double against one
//      foe and not the other.
//   4. `consumesStatus` is inert on it, the same way it is on the field form:
//      there is no status and no holder to strip (resolveRound reads
//      `requiresTargetStatus ?? requiresUserStatus`, which this form leaves
//      undefined).
//
// Plus the type's own shape: Ambush is the only payoff for the game's only two
// Stealth grants, and it SPENDS the cover it cashed in — the first content to
// use `consumesStatus` on the user-side half of conditionalPower, which Nature
// deliberately declined.

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
import { calcDamage, resolveConditionalPowerMultiplier } from '../src/engine/damage/damagePipeline';
import { getMaxHp, hasStatus } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Nightshade (Atk 80 / Spd 85) and Lucius (Int 75) attack; Warden and Sentinel defend. */
function shadowFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'nightshade', side: 'A' },
      { combatantId: 'a2', heroId: 'lucius', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/**
 * The two fixture problems every authored slate hits (authoring-moves.md §8),
 * solved once — and one extra that is specific to this type.
 *
 * - **Mana.** Shadow's curve tops out at 80 (Eclipse), above every Shadow
 *   hero's STARTING pool, which is the intended shape (docs/mana.md — pools
 *   grow all run) rather than something these tests should be gated on.
 * - **Lethality.** A defender that faints to the hit never reaches the riders.
 *   getMaxHp reads baseStats + statModifiers, so the hp modifier has to move
 *   with currentHp or the two disagree.
 * - **The execute reads a FRACTION**, so a fixture that inflates max HP has to
 *   set currentHp deliberately afterwards — see `wounded` below. Every
 *   combatant here starts at FULL, which is what makes the "not below the
 *   line" control case honest.
 */
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

// --- conditionalPower.requiresTargetHpBelow: a condition that is a NUMBER ----

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
  // Deliberate, and pinned because "below 50%" has two readings and the engine
  // only implements one (damagePipeline.ts, `<` not `<=`).
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
  // The same "omit the context and the other forms behave exactly as before"
  // discipline fieldEffectCtx has (content.ts). A caller with no hero
  // definition in scope gets 1 rather than a crash or a wrong double.
  const state = withDeepPools(shadowFixture(13));
  const hurt = wounded(state, 'b1', 0.1);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.rend, hurt.combatants.b1, hurt.combatants.a1), 1);
});

test('shadow: the execute multiplier lands on BASE POWER, never on multiplierTerm', () => {
  // The LOCKED two-pipeline separation (CLAUDE.md). The same assertion Fire,
  // Nature and Light each carry for their own conditionalPower sibling: a
  // BasePower-stage term must not leak into the damage pipeline's multiplier,
  // because the two compose differently and the difference is invisible until
  // something else stacks with it.
  const doubled = calcDamage(moves.rend, 1, ['Shadow'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 2);
  const plain = calcDamage(moves.rend, 1, ['Shadow'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 1);
  assert.strictEqual(doubled.multiplierTerm, plain.multiplierTerm);
  assert.strictEqual(doubled.basePowerMultiplier, 2);
  assert.strictEqual(doubled.damage, plain.damage * 2);
});

test('shadow: Eclipse cannot double off HP it is itself about to remove', () => {
  // The whole reason resolveRound reads the multiplier BEFORE applyHpDelta. A
  // target above the line takes an ordinary hit even when that hit is what
  // drops it below half — the execute is paid for by whatever softened the
  // target on an EARLIER action, which is the doubles-partner pressure the
  // move exists to reward.
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
  // The behavioural difference from the user-side and field forms, which ask a
  // single question for the whole cast (content.ts). No content is spread AND
  // an execute today; this pins the shape so a later slate can author one.
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
  // The same guard the field form relies on: resolveRound resolves the holder
  // as `requiresTargetStatus ?? requiresUserStatus`, which this form leaves
  // undefined, so a greedy authoring is a no-op rather than a third meaning.
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

// --- Stealth into Ambush ---------------------------------------------------

test('shadow: Ambush doubles off the USER Stealth and spends it', () => {
  // The first content to author consumesStatus on the user-side half of
  // conditionalPower (Nature's Seed Shot and Branch Slam deliberately decline
  // it). Stealth only ever runs one round, so what the consume actually costs
  // is the remainder of that round's protection — the strike is what breaks
  // cover, which is the past tense in the design table's "if the user HAD
  // Stealth".
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

test('shadow: every Stealth grant in the game is Shadow, duration 1, and self-targeted', () => {
  // The design table gives Stealth no number for either of its two grants
  // (authoring-moves.md §10, the Light lesson). 1 is the value this content has
  // always carried, confirmed by the designer 2026-08-30 — "Stealth is only
  // ever 1 turn" — and pinned here so a slate cannot quietly invent a second
  // length. Stealth ticks at the START of a round (statuses.ts), so 1 is the
  // rest of the cast round plus the whole of the next.
  const grants = Object.values(moves).filter((m) => m.statusApplication?.statusId === 'Stealth');
  assert.deepStrictEqual(grants.map((m) => m.id).sort(), ['shadowForm', 'vanish']);
  for (const move of grants) {
    assert.strictEqual(move.type, 'Shadow', `${move.id} grants Stealth off-type`);
    assert.strictEqual(move.statusApplication!.duration, 1, `${move.id} authors a non-standard Stealth length`);
    assert.strictEqual(move.statusApplication!.target, 'self', `${move.id} grants Stealth to someone else`);
  }
});

test('shadow: every hero that can be offered Ambush can also reach a Stealth grant', () => {
  // frostMoves' "the gate has a key in the same pool" assertion, in the shape
  // this type needs it. Nothing in the engine pairs them: an Ambush in a pool
  // with no route to Stealth is a permanently half-power move, which is the
  // trap pick the north star forbids (CLAUDE.md).
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const [heroId, hero] of Object.entries(heroes)) {
    const reachable = [...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])];
    if (!reachable.includes('ambush')) continue;
    assert.ok(
      reachable.some((id) => moves[id]?.statusApplication?.statusId === 'Stealth'),
      `${heroId} can be offered Ambush but has no way to enter Stealth`
    );
  }
});

// --- The slate's own shape -------------------------------------------------

test('shadow: the slate is fifteen moves, and every status and condition it names exists', () => {
  const shadow = Object.values(moves).filter((m) => m.type === 'Shadow');
  assert.strictEqual(shadow.length, 15);
  for (const move of shadow) {
    if (move.statusApplication) {
      assert.ok(statuses[move.statusApplication.statusId], `${move.id} applies unknown status ${move.statusApplication.statusId}`);
    }
    if (move.conditionalPower) {
      const { requiresTargetStatus, requiresUserStatus, requiresFieldEffect, requiresTargetHpBelow } = move.conditionalPower;
      const authored = [requiresTargetStatus, requiresUserStatus, requiresFieldEffect, requiresTargetHpBelow].filter(
        (v) => v != null
      );
      assert.strictEqual(authored.length, 1, `${move.id} must author exactly one side of conditionalPower`);
      if (requiresTargetHpBelow != null) {
        assert.ok(requiresTargetHpBelow > 0 && requiresTargetHpBelow < 1, `${move.id} authors an HP threshold outside (0, 1)`);
      }
    }
  }
});

test('shadow: no move in the GAME authors two sides of conditionalPower', () => {
  // Widened past one type on purpose: `requiresTargetHpBelow` is a fourth way
  // to make the same silent dud, and there is still no isValidMoveDefinition
  // (authoring-moves.md §4). Checked oldest-first in damagePipeline.ts, so a
  // move authoring two would silently answer the wrong question rather than
  // fail.
  for (const move of Object.values(moves)) {
    if (!move.conditionalPower) continue;
    const { requiresTargetStatus, requiresUserStatus, requiresFieldEffect, requiresTargetHpBelow } = move.conditionalPower;
    const authored = [requiresTargetStatus, requiresUserStatus, requiresFieldEffect, requiresTargetHpBelow].filter(
      (v) => v != null
    );
    assert.strictEqual(authored.length, 1, `${move.id} authors ${authored.length} sides of conditionalPower`);
  }
});

test('shadow: every Poison the slate applies is chanced, and every one runs the standard 3-round timer', () => {
  // The type's whole statement about how it differs from Nature: Nature plants
  // Poison on purpose (four guaranteed appliers) and detonates it; Shadow
  // accumulates it as a side effect of attacking and never has a guaranteed
  // applier at all. Pinned because a single un-chanced Poison would quietly
  // turn this into a second Nature.
  const poisoners = Object.values(moves).filter((m) => m.type === 'Shadow' && m.statusApplication?.statusId === 'Poison');
  assert.deepStrictEqual(poisoners.map((m) => m.id).sort(), ['umbraBolt', 'umbralBeam', 'umbralWave']);
  for (const move of poisoners) {
    assert.strictEqual(move.statusApplication!.chance, 0.2, `${move.id} is not a 20% Poison`);
    assert.strictEqual(move.statusApplication!.duration, 3, `${move.id} authors a non-standard Poison timer`);
  }
});

test('shadow: Dusk Blade is the only guaranteed Bleed, and Bleed is the type flat attrition', () => {
  const bleeders = Object.values(moves).filter((m) => m.type === 'Shadow' && m.statusApplication?.statusId === 'Bleed');
  assert.deepStrictEqual(bleeders.map((m) => m.id).sort(), ['backstab', 'duskBlade', 'shadowSlice']);
  assert.strictEqual(moves.duskBlade.statusApplication!.chance, undefined);
  assert.strictEqual(moves.backstab.statusApplication!.chance, 0.3);
  assert.strictEqual(moves.shadowSlice.statusApplication!.chance, 0.3);
  // Neither decays nor clears on a switch, which is what makes three carriers
  // enough (statuses.ts) — the same rider on a Burn-shaped status would need
  // twice as many.
  assert.strictEqual(statuses.Bleed.decay, 'none');
  assert.strictEqual(statuses.Bleed.clearsOnSwitch, false);
});

test('shadow: Shadowstrike is the slate only bracket play — everything else resolves at priority 0', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Shadow') continue;
    assert.strictEqual(move.priority, move.id === 'shadowstrike' ? 1 : 0, `${move.id} has an unexpected priority bracket`);
  }
});

// --- The two sweeps every slate ends with (authoring-moves.md §9, §10) ------

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
  // The one affordability check that IS a finding (authoring-moves.md §8): a
  // starting kit is the one thing a player cannot fix by drafting, and an
  // enemy's pool is fixed for the whole game — no relics, no equipment, no
  // Evolution. The Late-tier ceiling being above a STARTING pool is the
  // intended shape and is deliberately not asserted here.
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
  // The reachability half of the dangling-id check (authoring-moves.md §10) —
  // the opposite failure, and the one with no type to catch it. Shadow comes
  // out at zero: four mono-Shadow heroes plus one Fire/Shadow, split physical
  // and magical, are enough to place fifteen. If a later slate legitimately
  // orphans one, NAME it here rather than deleting the assertion — see
  // stoneMoves' pinned list for that shape.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  const reachable = new Set<string>();
  for (const hero of Object.values({ ...heroes, ...enemies })) for (const id of hero.moveIds) reachable.add(id);
  for (const pool of Object.values(progressionTable.moveTiers)) for (const id of pool) reachable.add(id);

  const orphans = Object.values(moves)
    .filter((m) => m.type === 'Shadow' && !reachable.has(m.id))
    .map((m) => m.id)
    .sort();
  assert.deepStrictEqual(orphans, []);
});
