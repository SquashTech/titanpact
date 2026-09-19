// Shield: bonus health off Defense (docs/shield.md). Phase 1 — the engine contract, pinned on
// a fixture move that sits in no pool.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState, fixtureMaxHp } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState } from '../src/engine/state';
import type { MoveDefinition, StatusDefinition } from '../src/engine/content';
import { getEffectiveStat, hasStatus, statusMagnitude } from '../src/engine/state';
import { applyHpDelta } from '../src/engine/combat/faintHandling';
import { resolveStatusMagnitudeFor, magnitudeStatKey, magnitudeScales } from '../src/engine/status/statusMagnitude';
import { shieldHeld } from '../src/engine/status/shield';

/** The fixture: Iron-typed so ironWarden (Iron) takes STAB on it and cinderKnight (Fire/Iron) does too. */
const testShield: MoveDefinition = {
  id: 'testShield',
  name: 'Test Shield',
  tier: 'early',
  type: 'Iron',
  category: 'physical',
  kind: 'buff',
  statusApplication: { statusId: 'Shield', magnitude: 40, target: 'self' },
  manaCost: 10,
  priority: 0,
  target: 'self',
  description: 'fixture',
};

/** Ice Shell's shape: a marker beside the Shield that Freezes whoever breaks it. */
const testShell: StatusDefinition = {
  id: 'testShell',
  name: 'Test Shell',
  shape: 'boolean',
  ticksAtEndOfRound: false,
  decay: 'none',
  stacking: 'none',
  clearsOnSwitch: false,
  positive: true,
  onShieldBroken: { statusId: 'Freeze' },
  pipeline: 'trigger',
};

const config = {
  typeChart,
  heroes,
  moves: { ...moves, testShield },
  statuses: { ...statuses, testShell },
  passives,
  fieldEffects,
  benchHpRegenFlat: 5,
};

function fixture(seed: number): CombatState {
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

function withStatus(state: CombatState, combatantId: string, statusId: string, fields: { magnitude?: number; duration?: number } = {}): CombatState {
  const combatant = state.combatants[combatantId];
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...combatant, statuses: { ...combatant.statuses, [statusId]: { statusId, ...fields } } } },
  };
}

function withPassive(state: CombatState, combatantId: string, passiveId: string): CombatState {
  const combatant = state.combatants[combatantId];
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...combatant, passives: { ...combatant.passives, [passiveId]: { passiveId, stacks: 1 } } } },
  };
}

const rest = (id: string): Action => ({ kind: 'rest', combatantId: id });

// --- The status ---

test('shield: the catalog entry is a positive, non-decaying, switch-surviving additive pool on its own pipeline', () => {
  const def = statuses.Shield;
  assert.strictEqual(def.shape, 'magnitude');
  assert.strictEqual(def.pipeline, 'shield');
  assert.strictEqual(def.ticksAtEndOfRound, false);
  assert.strictEqual(def.decay, 'none');
  assert.strictEqual(def.stacking, 'additive');
  assert.strictEqual(def.clearsOnSwitch, false);
  assert.strictEqual(def.positive, true);
});

test('shield: a Shield reads the caster Defense, on the heal formula constants, with STAB', () => {
  const app = testShield.statusApplication as { statusId: string; magnitude: number; target: 'self' };
  assert.strictEqual(magnitudeStatKey(statuses.Shield, testShield), 'defense');
  assert.strictEqual(magnitudeScales(statuses.Shield, app), true, 'a Shield on self is a benefit and scales');

  // 100 Defense is ×1.5; Iron STAB ×1.25 on top: 40 × 1.5 × 1.25 = 75.
  assert.strictEqual(resolveStatusMagnitudeFor(40, statuses.Shield, app, testShield, { stats: { defense: 100 }, types: ['Iron'] }), 75);
  // 32 Defense is ×0.82, off-type: 40 × 0.82 = 32.8 → 33.
  assert.strictEqual(resolveStatusMagnitudeFor(40, statuses.Shield, app, testShield, { stats: { defense: 32 }, types: ['Fire'] }), 33);
  // The clamp is the heal formula's: 200 Defense lands ×2, not ×2.5.
  assert.strictEqual(resolveStatusMagnitudeFor(40, statuses.Shield, app, testShield, { stats: { defense: 200 }, types: ['Fire'] }), 80);
});

test('shield: the cast snapshots the caster — ironWarden (100 Def, Iron) shields for 75 and the pool is a status the holder carries', () => {
  const state = fixture(1);
  const { state: next, events } = resolveRound(state, [{ kind: 'move', combatantId: 'b1', moveId: 'testShield' }, rest('a1'), rest('a2'), rest('b2')], config);
  const applied = events.find((e) => e.type === 'StatusApplied' && e.combatantId === 'b1' && e.statusId === 'Shield');
  assert.ok(applied && applied.type === 'StatusApplied');
  assert.strictEqual(applied.magnitude, 75);
  assert.strictEqual(applied.capped, undefined);
  assert.strictEqual(shieldHeld(next.combatants.b1, statuses), 75);
  assert.strictEqual(next.combatants.b1.currentHp, fixtureMaxHp('ironWarden'), 'a Shield is not HP');
});

// --- The absorb ---

test('shield: a hit is taken from the Shield first — DamageDealt.amount is what HP lost, absorbed what the pool took', () => {
  const state = withStatus(fixture(2), 'a1', 'Shield', { magnitude: 1000 });
  const hpBefore = state.combatants.a1.currentHp;
  const { state: next, events } = resolveRound(state, [{ kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a1' }, rest('a1'), rest('a2'), rest('b2')], config);
  const hit = events.find((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'a1');
  assert.ok(hit && hit.type === 'DamageDealt');
  assert.strictEqual(hit.amount, 0, 'fully absorbed');
  assert.ok((hit.absorbed ?? 0) > 0, 'the figure the player sees is the absorb, never a silent nothing');
  assert.strictEqual(next.combatants.a1.currentHp, hpBefore);
  assert.strictEqual(shieldHeld(next.combatants.a1, statuses), 1000 - (hit.absorbed ?? 0));
  assert.strictEqual(next.combatants.a1.damageTakenSinceLastTurn, 0, 'Retribution reads HP only');
});

test('shield: a hit bigger than the pool breaks it and the rest reaches HP — StatusRemoved broken, carrying the striker, before the HpChanged', () => {
  const state = withStatus(fixture(3), 'a1', 'Shield', { magnitude: 5 });
  const hpBefore = state.combatants.a1.currentHp;
  const { state: next, events } = resolveRound(state, [{ kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a1' }, rest('a1'), rest('a2'), rest('b2')], config);
  const hit = events.find((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'a1');
  assert.ok(hit && hit.type === 'DamageDealt');
  assert.strictEqual(hit.absorbed, 5);
  assert.ok(hit.amount > 0);
  assert.strictEqual(next.combatants.a1.currentHp, hpBefore - hit.amount);
  assert.strictEqual(hasStatus(next.combatants.a1, 'Shield'), false);

  const brokenIndex = events.findIndex((e) => e.type === 'StatusRemoved' && e.combatantId === 'a1' && e.statusId === 'Shield' && e.reason === 'broken');
  const hpIndex = events.findIndex((e) => e.type === 'HpChanged' && e.combatantId === 'a1');
  assert.ok(brokenIndex > -1, 'the break is its own beat');
  assert.ok(brokenIndex < hpIndex, 'removed before the HP change lands');
  const broken = events[brokenIndex];
  assert.ok(broken.type === 'StatusRemoved' && broken.sourceCombatantId === 'b1');
});

test('shield: an absorbed hit still counts as a hit — Second Skin fires on the holder', () => {
  const state = withPassive(withStatus(fixture(4), 'b1', 'Shield', { magnitude: 1000 }), 'b1', 'secondSkin');
  const defBefore = getEffectiveStat(heroes.ironWarden, state.combatants.b1, 'defense');
  const { state: next, events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'ironFist', declaredTarget: 'b1' }, rest('a2'), rest('b1'), rest('b2')], config);
  assert.ok(events.some((e) => e.type === 'PassiveTriggered' && e.combatantId === 'b1' && e.passiveId === 'secondSkin'));
  assert.strictEqual(getEffectiveStat(heroes.ironWarden, next.combatants.b1, 'defense'), defBefore + 5);
});

test('shield: a drain heals for what got through to HP, not for what the Shield took', () => {
  let state = withStatus(fixture(5), 'b1', 'Shield', { magnitude: 10 });
  state = { ...state, combatants: { ...state.combatants, a2: { ...state.combatants.a2, currentHp: 50 } } };
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a2', moveId: 'siphon', declaredTarget: 'b1' }, rest('a1'), rest('b1'), rest('b2')], config);
  const hit = events.find((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b1');
  const drain = events.find((e) => e.type === 'Healed' && e.drain);
  assert.ok(hit && hit.type === 'DamageDealt' && hit.absorbed === 10);
  assert.ok(drain && drain.type === 'Healed' && drain.drain);
  assert.strictEqual(drain.drain.damageDealt, hit.amount);
  assert.strictEqual(drain.amount, Math.round(hit.amount * 0.5));
});

// --- What goes through ---

test('shield: a Burn tick goes straight to HP under a full Shield', () => {
  const state = withStatus(withStatus(fixture(6), 'b1', 'Shield', { magnitude: 1000 }), 'b1', 'Burn', { magnitude: 20 });
  const hpBefore = state.combatants.b1.currentHp;
  const { state: next } = resolveRound(state, [rest('a1'), rest('a2'), rest('b1'), rest('b2')], config);
  assert.strictEqual(next.combatants.b1.currentHp, hpBefore - 20);
  assert.strictEqual(shieldHeld(next.combatants.b1, statuses), 1000);
});

test('shield: the Pact Clock goes straight to HP under a full Shield', () => {
  const state = { ...withStatus(fixture(7), 'b1', 'Shield', { magnitude: 1000 }), round: 2 };
  const hpBefore = state.combatants.b1.currentHp;
  const { state: next, events } = resolveRound(state, [rest('a1'), rest('a2'), rest('b1'), rest('b2')], { ...config, pactClock: { startRound: 2, baseFraction: 0.1, stepFraction: 0.05 } });
  assert.ok(events.some((e) => e.type === 'PactTicked'));
  assert.ok(next.combatants.b1.currentHp < hpBefore);
  assert.strictEqual(shieldHeld(next.combatants.b1, statuses), 1000);
});

test("shield: a move's own HP cost goes straight to HP under a full Shield", () => {
  const state = withStatus(fixture(8), 'a1', 'Shield', { magnitude: 1000 });
  const maxHp = fixtureMaxHp('cinderKnight');
  const { state: next, events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'soulOffering', declaredTarget: 'a2' }, rest('a2'), rest('b1'), rest('b2')], config);
  assert.strictEqual(next.combatants.a1.currentHp, maxHp - Math.round(maxHp * 0.2));
  assert.strictEqual(shieldHeld(next.combatants.a1, statuses), 1000);
  const cost = events.find((e) => e.type === 'DamageDealt' && e.selfCost);
  assert.ok(cost && cost.type === 'DamageDealt' && cost.absorbed === undefined);
});

test('shield: applyHpDelta defaults to direct — an unlabelled loss never absorbs', () => {
  const state = withStatus(fixture(9), 'b1', 'Shield', { magnitude: 1000 });
  const maxHp = fixtureMaxHp('ironWarden');
  const direct = applyHpDelta(state, 1, 'b1', -30, maxHp);
  assert.strictEqual(direct.absorbed, 0);
  assert.strictEqual(direct.state.combatants.b1.currentHp, maxHp - 30);
  const hit = applyHpDelta(state, 1, 'b1', -30, maxHp, { source: 'hit', statusDefs: statuses });
  assert.strictEqual(hit.absorbed, 30);
  assert.strictEqual(hit.state.combatants.b1.currentHp, maxHp);
});

// --- Stacking and the cap ---

test('shield: a second Shield adds to the first, up to the holder max HP, and says when the cap took some', () => {
  const maxHp = fixtureMaxHp('ironWarden');
  const state = withStatus(fixture(10), 'b1', 'Shield', { magnitude: maxHp - 10 });
  const { state: next, events } = resolveRound(state, [{ kind: 'move', combatantId: 'b1', moveId: 'testShield' }, rest('a1'), rest('a2'), rest('b2')], config);
  const applied = events.find((e) => e.type === 'StatusApplied' && e.combatantId === 'b1' && e.statusId === 'Shield');
  assert.ok(applied && applied.type === 'StatusApplied');
  assert.strictEqual(applied.magnitude, maxHp, 'lands the rest of the way');
  assert.strictEqual(applied.capped, true);
  assert.strictEqual(shieldHeld(next.combatants.b1, statuses), maxHp);

  const twice = resolveRound(fixture(11), [{ kind: 'move', combatantId: 'b1', moveId: 'testShield' }, rest('a1'), rest('a2'), rest('b2')], config);
  const again = resolveRound({ ...twice.state, round: 2 }, [{ kind: 'move', combatantId: 'b1', moveId: 'testShield' }, rest('a1'), rest('a2'), rest('b2')], config);
  assert.strictEqual(shieldHeld(again.state.combatants.b1, statuses), 150, 'two casts of 75 stack under the cap');
});

test('shield: the pool leaves with the hero and comes back — a switch does not clear it', () => {
  const state = createFightState(
    12,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
      { combatantId: 'a3', heroId: 'wildOracle', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
  const shielded = withStatus(state, 'a1', 'Shield', { magnitude: 40 });
  const { state: next } = resolveRound(shielded, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }, rest('a2'), rest('b1'), rest('b2')], config);
  assert.ok(next.bench.A.includes('a1'));
  assert.strictEqual(statusMagnitude(next.combatants.a1, 'Shield'), 40);
});

// --- The broken trigger ---

test('shield: a status with onShieldBroken pays the striker when a hit breaks the pool, then is consumed', () => {
  const state = withStatus(withStatus(fixture(13), 'a1', 'Shield', { magnitude: 5 }), 'a1', 'testShell');
  const { state: next, events } = resolveRound(state, [{ kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a1' }, rest('a1'), rest('a2'), rest('b2')], config);
  assert.strictEqual(hasStatus(next.combatants.b1, 'Freeze'), true, 'the striker is Frozen');
  assert.strictEqual(hasStatus(next.combatants.a1, 'testShell'), false, 'the shell is spent');
  const brokenIndex = events.findIndex((e) => e.type === 'StatusRemoved' && e.reason === 'broken');
  const frozenIndex = events.findIndex((e) => e.type === 'StatusApplied' && e.combatantId === 'b1' && e.statusId === 'Freeze');
  assert.ok(brokenIndex > -1 && frozenIndex > brokenIndex);

  // A hit that dents but does not break the pool fires nothing.
  const held = withStatus(withStatus(fixture(14), 'a1', 'Shield', { magnitude: 1000 }), 'a1', 'testShell');
  const dented = resolveRound(held, [{ kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a1' }, rest('a1'), rest('a2'), rest('b2')], config);
  assert.strictEqual(hasStatus(dented.state.combatants.b1, 'Freeze'), false);
  assert.strictEqual(hasStatus(dented.state.combatants.a1, 'testShell'), true);
});

test('shield: the fixture move is in no pool', () => {
  assert.strictEqual(moves.testShield, undefined);
});
