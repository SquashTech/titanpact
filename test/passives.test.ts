// The Passives contract (engine/content.ts PassiveDefinition, engine/combat/
// passiveEngine.ts) — covers the two effect shapes end to end: Sanguine
// (reactive, heals off an enemy's Bleed tick) and Emberheart (damage
// modifier, conditional on move type, stacking multiplicatively).

import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import { matchesTrigger, collectPassiveDamageModifiers } from '../src/engine/combat/passiveEngine';
import { resolveMultiplierTerm } from '../src/engine/damage/damagePipeline';
import type { CombatState, PassiveInstance } from '../src/engine/state';
import { equipmentPassiveGrants, relicTeamPassiveGrants, mergePassiveGrants, toPassiveInstances } from '../src/run/passives';
import { createEmptyLoadout, equipItem, type EquipmentDefinition } from '../src/run/equipment';
import { relics } from '../src/data/relics';

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

function withStatus(state: CombatState, combatantId: string, statusId: string, fields: { magnitude?: number; duration?: number }): CombatState {
  const combatant = state.combatants[combatantId];
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...combatant, statuses: { ...combatant.statuses, [statusId]: { statusId, ...fields } } },
    },
  };
}

function withPassive(state: CombatState, combatantId: string, passiveId: string, stacks = 1): CombatState {
  const combatant = state.combatants[combatantId];
  const instance: PassiveInstance = { passiveId, stacks };
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...combatant, passives: { ...combatant.passives, [passiveId]: instance } },
    },
  };
}

// --- matchesTrigger: relation matching ---------------------------------------

test('passives: matchesTrigger relation — self/ally/enemy read correctly off side + identity', () => {
  const selfCond = { relativeTo: 'self' as const };
  const allyCond = { relativeTo: 'ally' as const };
  const enemyCond = { relativeTo: 'enemy' as const };

  assert.strictEqual(matchesTrigger(selfCond, {}, 'a1', 'A', 'a1', 'A'), true);
  assert.strictEqual(matchesTrigger(selfCond, {}, 'a1', 'A', 'a2', 'A'), false);
  assert.strictEqual(matchesTrigger(allyCond, {}, 'a1', 'A', 'a2', 'A'), true);
  assert.strictEqual(matchesTrigger(allyCond, {}, 'a1', 'A', 'a1', 'A'), false); // ally excludes the owner itself
  assert.strictEqual(matchesTrigger(enemyCond, {}, 'a1', 'A', 'b1', 'B'), true);
  assert.strictEqual(matchesTrigger(enemyCond, {}, 'a1', 'A', 'a2', 'A'), false);
});

test('passives: matchesTrigger also requires every eventFieldEquals key to match', () => {
  const cond = { relativeTo: 'enemy' as const, eventFieldEquals: { statusId: 'Bleed', kind: 'damage' } };
  assert.strictEqual(matchesTrigger(cond, { statusId: 'Bleed', kind: 'damage' }, 'a1', 'A', 'b1', 'B'), true);
  assert.strictEqual(matchesTrigger(cond, { statusId: 'Burn', kind: 'damage' }, 'a1', 'A', 'b1', 'B'), false);
  assert.strictEqual(matchesTrigger(cond, { statusId: 'Bleed', kind: 'duration' }, 'a1', 'A', 'b1', 'B'), false);
});

// --- Sanguine: reactive, off an enemy's Bleed tick ---------------------------

test('passives: Sanguine heals its owner by the enemy Bleed tick amount', () => {
  const state = twoVTwoFixture(300);
  const hurt = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 10 } } };
  const withGrant = withPassive(hurt, 'a1', 'sanguine');
  const bleeding = withStatus(withGrant, 'b1', 'Bleed', {});

  const maxHp = heroes.ironWarden.baseStats.hp;
  const expectedTick = Math.ceil(maxHp * 0.05);

  const { state: next, events } = resolveRound(bleeding, [], config);

  assert.strictEqual(next.combatants.a1.currentHp, 10 + expectedTick);
  assert.strictEqual(next.combatants.b1.currentHp, maxHp - expectedTick);
  assert.ok(events.some((e) => e.type === 'HpChanged' && e.combatantId === 'a1' && e.newHp === 10 + expectedTick));
});

test('passives: Sanguine does not fire off an ally taking Bleed damage', () => {
  const state = twoVTwoFixture(301);
  const hurt = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 10 } } };
  const withGrant = withPassive(hurt, 'a1', 'sanguine');
  const bleeding = withStatus(withGrant, 'a2', 'Bleed', {}); // ally, not enemy

  const { state: next } = resolveRound(bleeding, [], config);
  assert.strictEqual(next.combatants.a1.currentHp, 10); // untouched
});

test('passives: two stacks of Sanguine heal twice per enemy Bleed tick', () => {
  const state = twoVTwoFixture(302);
  const hurt = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 10 } } };
  const withGrant = withPassive(hurt, 'a1', 'sanguine', 2);
  const bleeding = withStatus(withGrant, 'b1', 'Bleed', {});

  const maxHp = heroes.ironWarden.baseStats.hp;
  const expectedTick = Math.ceil(maxHp * 0.05);

  const { state: next } = resolveRound(bleeding, [], config);
  assert.strictEqual(next.combatants.a1.currentHp, 10 + expectedTick * 2);
});

// --- Emberheart: damage-pipeline modifier, conditional + stacking -----------

test('passives: collectPassiveDamageModifiers only matches the conditioned move type', () => {
  const state = twoVTwoFixture(310);
  const withGrant = withPassive(state, 'a1', 'emberheart');

  const fireMods = collectPassiveDamageModifiers(withGrant.combatants.a1, moves.emberSlash, passives);
  assert.deepStrictEqual(fireMods, [{ source: 'emberheart', amount: 0.2 }]);

  const waterMods = collectPassiveDamageModifiers(withGrant.combatants.a1, moves.tidalBolt, passives);
  assert.deepStrictEqual(waterMods, []);
});

test('passives: two stacks of Emberheart push two modifier entries, stacking multiplicatively', () => {
  const state = twoVTwoFixture(311);
  const withGrant = withPassive(state, 'a1', 'emberheart', 2);

  const mods = collectPassiveDamageModifiers(withGrant.combatants.a1, moves.emberSlash, passives);
  assert.strictEqual(mods.length, 2);
  assert.strictEqual(resolveMultiplierTerm(mods), 1.2 * 1.2);
});

test('passives: Emberheart actually raises rolled damage on a Fire move end to end', () => {
  const state = twoVTwoFixture(312);
  const withGrant = withPassive(state, 'a1', 'emberheart');
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }];

  const plain = resolveRound(state, actions, config);
  const boosted = resolveRound(withGrant, actions, config);

  const maxHp = heroes.ironWarden.baseStats.hp;
  const plainDamage = maxHp - plain.state.combatants.b1.currentHp;
  const boostedDamage = maxHp - boosted.state.combatants.b1.currentHp;
  assert.ok(boostedDamage > plainDamage, `expected boosted damage (${boostedDamage}) > plain damage (${plainDamage})`);
});

// --- Run-tier grant aggregation (src/run/passives.ts) -----------------------

const fireCharm: EquipmentDefinition = { id: 'fireCharm', name: 'Fire Charm', slot: 'accessory', rarity: 'rare', statGrants: {}, grantsPassiveIds: ['emberheart'] };
const plainSword: EquipmentDefinition = { id: 'plainSword', name: 'Plain Sword', slot: 'weapon', rarity: 'common', statGrants: { attack: 5 } };
const equipmentLookup: Record<string, EquipmentDefinition> = { fireCharm, plainSword };

test('passives: equipmentPassiveGrants tallies grants across equipped slots, ignoring stat-only gear', () => {
  const loadout = equipItem(equipItem(createEmptyLoadout(), fireCharm), plainSword);
  assert.deepStrictEqual(equipmentPassiveGrants(loadout, equipmentLookup), { emberheart: 1 });
});

test('passives: relicTeamPassiveGrants stacks a duplicate relic id, matching relicTeamStatModifiers', () => {
  assert.deepStrictEqual(relicTeamPassiveGrants(['emberheart', 'emberheart', 'ironStandard'], relics), { emberheart: 2 });
});

test('passives: mergePassiveGrants sums equipment + relic + Evolution sources additively', () => {
  const merged = mergePassiveGrants({ sanguine: 1 }, { emberheart: 2 }, { sanguine: 1 });
  assert.deepStrictEqual(merged, { sanguine: 2, emberheart: 2 });
});

test('passives: toPassiveInstances converts counts to PassiveInstance records and drops zero counts', () => {
  const instances = toPassiveInstances({ sanguine: 2, emberheart: 0 });
  assert.deepStrictEqual(instances, { sanguine: { passiveId: 'sanguine', stacks: 2 } });
});
