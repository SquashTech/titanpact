// Elemental Force: a magnitude-shape status per type (src/data/statuses.ts's
// `${Type}Force` catalog) that adds flat BasePower to that type's moves
// (engine/damage/damagePipeline.ts resolveElementalForceBonus). Covers all
// three grant vectors end to end: a move's statusApplication (stokeTheFlames),
// equipment (Ember Band), and a relic (Cinder Standard).

import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { equipment } from '../src/data/equipment';
import { relics } from '../src/data/relics';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import { calcDamage, resolveElementalForceBonus } from '../src/engine/damage/damagePipeline';
import type { MoveDefinition } from '../src/engine/content';
import type { CombatState } from '../src/engine/state';
import { equipmentStatusGrants, relicTeamStatusGrants, mergeStatusGrants, toStatusInstances } from '../src/run/statusGrants';
import { createEmptyLoadout, equipItem, type EquipmentDefinition } from '../src/run/equipment';

const config = { typeChart, heroes, moves, statuses, passives, benchHpRegenFlat: 5 };

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

function withStatus(state: CombatState, combatantId: string, statusId: string, magnitude: number): CombatState {
  const combatant = state.combatants[combatantId];
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...combatant, statuses: { ...combatant.statuses, [statusId]: { statusId, magnitude } } } },
  };
}

// --- calcDamage: BasePower bonus applies before every multiplier term ------

test('elementalForce: calcDamage adds basePowerBonus to BasePower before the multiplier chain', () => {
  const move: MoveDefinition = {
    id: 'testMove',
    name: 'Test Move',
    type: 'Fire',
    category: 'physical',
    kind: 'damage',
    basePower: 40,
    manaCost: 0,
    priority: 0,
    target: 'singleEnemy',
  };
  const withoutForce = calcDamage(move, 1, [], [], {}, 1, false);
  const withForce = calcDamage(move, 1, [], [], {}, 1, false, [], 'multiplicative', 1.5, 20);

  // 40 BP + Fire Force 20 == a 60 BP move, at the same ratio/variance/etc.
  assert.strictEqual(withoutForce.damage, 40);
  assert.strictEqual(withForce.damage, 60);
  assert.strictEqual(withForce.basePowerBonus, 20);
});

// --- resolveElementalForceBonus: sums only the matching type's Force -------

test('elementalForce: resolveElementalForceBonus only counts Force statuses matching the move type', () => {
  const state = twoVTwoFixture(400);
  const withFire = withStatus(state, 'a1', 'FireForce', 20);

  assert.strictEqual(resolveElementalForceBonus(withFire.combatants.a1, 'Fire', statuses), 20);
  assert.strictEqual(resolveElementalForceBonus(withFire.combatants.a1, 'Water', statuses), 0);
});

test('elementalForce: independent Force statuses for different types both apply to their own type only', () => {
  const state = twoVTwoFixture(401);
  const both = withStatus(withStatus(state, 'a1', 'FireForce', 20), 'a1', 'WaterForce', 15);

  assert.strictEqual(resolveElementalForceBonus(both.combatants.a1, 'Fire', statuses), 20);
  assert.strictEqual(resolveElementalForceBonus(both.combatants.a1, 'Water', statuses), 15);
  assert.strictEqual(resolveElementalForceBonus(both.combatants.a1, 'Frost', statuses), 0);
});

// --- Stacking: reapplying via a move's statusApplication adds additively ---

test('elementalForce: stokeTheFlames grants Fire Force 10, and a second cast stacks additively to 20', () => {
  const state = twoVTwoFixture(402);
  const cast: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'stokeTheFlames' }];

  const once = resolveRound(state, cast, config);
  assert.strictEqual(once.state.combatants.a1.statuses.FireForce.magnitude, 10);

  const twice = resolveRound(once.state, cast, config);
  assert.strictEqual(twice.state.combatants.a1.statuses.FireForce.magnitude, 20);
});

// --- End to end: Fire Force actually raises rolled damage on a Fire move ---

test('elementalForce: Fire Force 20 raises rolled damage on a Fire move end to end', () => {
  const state = twoVTwoFixture(403);
  const withForce = withStatus(state, 'a1', 'FireForce', 20);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }];

  const plain = resolveRound(state, actions, config);
  const boosted = resolveRound(withForce, actions, config);

  const maxHp = heroes.ironWarden.baseStats.hp;
  const plainDamage = maxHp - plain.state.combatants.b1.currentHp;
  const boostedDamage = maxHp - boosted.state.combatants.b1.currentHp;
  assert.ok(boostedDamage > plainDamage, `expected boosted damage (${boostedDamage}) > plain damage (${plainDamage})`);
});

test('elementalForce: Fire Force does not affect a non-Fire move', () => {
  const state = twoVTwoFixture(404);
  const withForce = withStatus(state, 'a1', 'FireForce', 999);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'tidalBolt', declaredTarget: 'b1' }];

  const plain = resolveRound(state, actions, config);
  const stillPlain = resolveRound(withForce, actions, config);

  const maxHp = heroes.ironWarden.baseStats.hp;
  const plainDamage = maxHp - plain.state.combatants.b1.currentHp;
  const otherDamage = maxHp - stillPlain.state.combatants.b1.currentHp;
  assert.strictEqual(otherDamage, plainDamage);
});

// --- The DamageDealt event carries the bonus for view-layer transparency ---

test('elementalForce: DamageDealt event carries elementalForceBonus separately from basePower', () => {
  const state = twoVTwoFixture(405);
  const withForce = withStatus(state, 'a1', 'FireForce', 20);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }];

  const { events } = resolveRound(withForce, actions, config);
  const dealt = events.find((e) => e.type === 'DamageDealt');
  assert.ok(dealt && dealt.type === 'DamageDealt');
  assert.strictEqual(dealt!.basePower, moves.emberSlash.basePower);
  assert.strictEqual(dealt!.elementalForceBonus, 20);
});

// --- Run-tier grant aggregation (src/run/statusGrants.ts) -------------------

const emberBandLookup: Record<string, EquipmentDefinition> = { emberBand: equipment.emberBand, dagger: equipment.dagger };

test('elementalForce: equipmentStatusGrants tallies magnitude across equipped slots, ignoring stat-only gear', () => {
  const loadout = equipItem(equipItem(createEmptyLoadout(), equipment.emberBand), equipment.dagger);
  assert.deepStrictEqual(equipmentStatusGrants(loadout, emberBandLookup), { FireForce: 10 });
});

test('elementalForce: relicTeamStatusGrants sums a duplicate relic id, matching relicTeamPassiveGrants', () => {
  assert.deepStrictEqual(relicTeamStatusGrants(['cinderStandard', 'cinderStandard', 'ironStandard'], relics), { FireForce: 20 });
});

test('elementalForce: mergeStatusGrants sums equipment + relic sources additively', () => {
  const merged = mergeStatusGrants({ FireForce: 10 }, { FireForce: 20, WaterForce: 5 });
  assert.deepStrictEqual(merged, { FireForce: 30, WaterForce: 5 });
});

test('elementalForce: toStatusInstances converts magnitudes to StatusInstance records and drops zero magnitudes', () => {
  const instances = toStatusInstances({ FireForce: 20, WaterForce: 0 });
  assert.deepStrictEqual(instances, { FireForce: { statusId: 'FireForce', magnitude: 20 } });
});
