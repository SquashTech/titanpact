// Item invariants: every item spends its rarity budget exactly, and the act curve makes
// Legendary/Mythic IMPOSSIBLE in Act 1 and Common IMPOSSIBLE in Act 5 (zero weight AND never sampled).

import assert from 'assert';
import { test } from './harness';
import { equipment } from '../src/data/equipment';
import { passives, PASSIVE_ITEM_COST } from '../src/data/passives';
import {
  ACT_RARITY_WINDOW,
  MAX_LOOT_TIER,
  RARITY_BUDGET,
  RARITY_ORDER,
  RARITY_WEIGHTS_BY_TIER,
  statGrantCost,
  EFFECT_FLOOR_MIN_RARITY,
  EFFECT_FLOOR,
  ENCHANTMENTS,
  ENCHANTMENT_IDS,
  ENCHANT_FORCE_BY_RARITY,
  EQUIPMENT_FAMILIES,
  equipmentBudgetCost,
  equipmentBudgetProblems,
  equipmentEffectSpend,
  equipmentIdFor,
  holdsItem,
  lootTierFor,
  mergeIntoHeld,
  parseEquipmentId,
  pickWeightedEquipment,
  rarityWeightsFor,
  unenchantedIdOf,
  type EquipmentRarity,
} from '../src/run/equipment';
import { EQUIPMENT_DROP_POOL, UNIQUE_EQUIPMENT } from '../src/data/equipment';

const catalog = Object.values(equipment);
const ACTS = [1, 2, 3, 4, 5];
const STAT_KEYS = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool', 'mpRegen'] as const;

/** Total stat POINTS an item spends, which is what must never drop as a family climbs its ladder. */
function statPoints(item: { statGrants: Partial<Record<string, number>> }): number {
  return STAT_KEYS.reduce((sum, stat) => sum + statGrantCost(stat, item.statGrants[stat] ?? 0), 0);
}

// --- The rarity budget ---

test('equipment: every authored item spends its rarity budget exactly', () => {
  const offenders = catalog
    .map((item) => ({ item, problems: equipmentBudgetProblems(item, PASSIVE_ITEM_COST) }))
    .filter((entry) => entry.problems.length > 0)
    .map((entry) => `${entry.item.id} (${entry.item.rarity}): ${entry.problems.join('; ')}`);
  assert.deepStrictEqual(offenders, []);
});

test('equipment: every family exists at every tier, and nothing else does', () => {
  for (const familyId of EQUIPMENT_FAMILIES) {
    for (const rarity of RARITY_ORDER) {
      const item = equipment[equipmentIdFor(familyId, rarity)];
      assert.ok(item, `${familyId} has no ${rarity}`);
      assert.strictEqual(item.familyId, familyId);
      assert.strictEqual(item.rarity, rarity);
    }
  }
  assert.strictEqual(EQUIPMENT_DROP_POOL.length, EQUIPMENT_FAMILIES.length * RARITY_ORDER.length);
});

test('equipment: a tier upgrade never lowers a number — the monotonicity rule', () => {
  // The load-bearing rule of the rework (docs/equipment.md §3). The Anvil, the merge and the drop
  // curve all exist to move an item UP, so if the tier that gains the Awakening funded it by
  // shedding stats, every upgrade reward would read as a bait-and-switch.
  for (const familyId of EQUIPMENT_FAMILIES) {
    let previous = -Infinity;
    for (const rarity of RARITY_ORDER) {
      const points = statPoints(equipment[equipmentIdFor(familyId, rarity)]);
      assert.ok(points >= previous, `${familyId} drops from ${previous} to ${points} stat points at ${rarity}`);
      previous = points;
    }
  }
});

test('equipment: a family Awakens at Epic and the Awakening is flat from there up', () => {
  for (const familyId of EQUIPMENT_FAMILIES) {
    const byRarity = RARITY_ORDER.map((rarity) => equipment[equipmentIdFor(familyId, rarity)]);
    assert.strictEqual(byRarity[0].grantsPassiveIds, undefined, `${familyId} Common should be stats alone`);
    assert.strictEqual(byRarity[1].grantsPassiveIds, undefined, `${familyId} Rare should be stats alone`);
    const awakening = byRarity[2].grantsPassiveIds;
    assert.ok(awakening && awakening.length === 1, `${familyId} Epic should grant exactly one Awakening`);
    // Flat: the tier buys stats, the family buys the effect. Identical at Epic, Legendary, Mythic.
    assert.deepStrictEqual(byRarity[3].grantsPassiveIds, awakening);
    assert.deepStrictEqual(byRarity[4].grantsPassiveIds, awakening);
  }
});

test('equipment: every family and tier is reachable from its id, and back', () => {
  for (const familyId of EQUIPMENT_FAMILIES) {
    const id = equipmentIdFor(familyId, 'epic', 'blazing');
    assert.deepStrictEqual(parseEquipmentId(id), { base: familyId, rarity: 'epic', enchantId: 'blazing' });
    assert.strictEqual(unenchantedIdOf(id), equipmentIdFor(familyId, 'epic'));
  }
  // A Unique encodes no rarity — it has no ladder — but still parses, enchanted or not.
  assert.deepStrictEqual(parseEquipmentId('worldbreaker'), { base: 'worldbreaker', rarity: null });
  assert.deepStrictEqual(parseEquipmentId('worldbreaker.feral'), { base: 'worldbreaker', rarity: null, enchantId: 'feral' });
});

test('equipment: an unpriced granted passive is a budget failure, not free value', () => {
  const problems = equipmentBudgetProblems(
    { id: 'x', name: 'X', rarity: 'epic', statGrants: { attack: 30 }, grantsPassiveIds: ['notAPassive'] },
    PASSIVE_ITEM_COST
  );
  assert.ok(problems.some((p) => p.includes('PASSIVE_ITEM_COST')), problems.join('; '));
  assert.ok(Number.isNaN(equipmentBudgetCost({ id: 'x', name: 'X', rarity: 'epic', statGrants: {}, grantsPassiveIds: ['notAPassive'] }, PASSIVE_ITEM_COST)));
});

test('equipment: a negative grant refunds budget, funding an above-curve stat line', () => {
  // No catalog item spends a drawback today — the generated families are all upside — but the
  // refund is still how a hand-authored Unique could buy a spike, so the accounting must hold.
  const cleaver = {
    id: 'x',
    name: 'X',
    rarity: 'epic' as const,
    statGrants: { attack: 70, defense: -20 },
    grantsPassiveIds: ['sunder'],
  };
  assert.strictEqual(equipmentBudgetCost(cleaver, PASSIVE_ITEM_COST), RARITY_BUDGET.epic);
  assert.deepStrictEqual(equipmentBudgetProblems(cleaver, PASSIVE_ITEM_COST), []);
});

test('equipment: an Epic or better may not be stats alone', () => {
  // The effect floor (2026-09-06). A big number is not the same as an interesting item, and the
  // budget pass would otherwise have produced +110 Attack Mythics.
  const plainMythic = { id: 'x', name: 'X', rarity: 'mythic' as const, statGrants: { attack: 110 } };
  const problems = equipmentBudgetProblems(plainMythic, PASSIVE_ITEM_COST);
  assert.ok(problems.some((p) => p.includes('effects')), problems.join('; '));
  // ...and a token effect does not clear it either: the floor is one whole Awakening's worth.
  const tokenEffect = {
    id: 'y',
    name: 'Y',
    rarity: 'mythic' as const,
    statGrants: { attack: 100 },
    grantsStatusIds: [{ statusId: 'FireForce', magnitude: 5 }],
  };
  assert.ok(equipmentBudgetProblems(tokenEffect, PASSIVE_ITEM_COST).some((p) => p.includes('effects')));
  // Below Epic there is no floor at all: a plain Common is what an Act-1 item should be.
  assert.deepStrictEqual(equipmentBudgetProblems(equipment['sword.common'], PASSIVE_ITEM_COST), []);
});

test('equipment: every Epic and better in the catalog clears the effect floor', () => {
  for (const item of catalog) {
    if (RARITY_ORDER.indexOf(item.rarity) < RARITY_ORDER.indexOf(EFFECT_FLOOR_MIN_RARITY)) continue;
    const spend = equipmentEffectSpend(item, PASSIVE_ITEM_COST);
    assert.ok(spend >= EFFECT_FLOOR, `${item.id} (${item.rarity}) spends ${spend} on effects, under ${EFFECT_FLOOR}`);
  }
});

// --- Enchantments ---

test('equipment: an enchant is a bolt-on — it adds Force and never touches the base budget', () => {
  for (const rarity of RARITY_ORDER) {
    const base = equipment[equipmentIdFor('spear', rarity)];
    for (const enchantId of ENCHANTMENT_IDS) {
      const enchanted = equipment[equipmentIdFor('spear', rarity, enchantId)];
      assert.ok(enchanted, `spear ${rarity} ${enchantId} missing`);
      assert.strictEqual(enchanted.enchantId, enchantId);
      // Same stats, same Awakening, same tier — the enchant is a third axis, not a fourth tier.
      assert.deepStrictEqual(enchanted.statGrants, base.statGrants);
      assert.deepStrictEqual(enchanted.grantsPassiveIds, base.grantsPassiveIds);
      assert.deepStrictEqual(enchanted.grantsStatusIds, [
        { statusId: `${ENCHANTMENTS[enchantId]}Force`, magnitude: ENCHANT_FORCE_BY_RARITY[rarity] },
      ]);
      // ...and the base budget still balances, because baseItemOf strips the enchant first.
      assert.deepStrictEqual(equipmentBudgetProblems(enchanted, PASSIVE_ITEM_COST), []);
    }
  }
});

test('equipment: no enchant binds Ancient, and every other type has exactly one', () => {
  const types = ENCHANTMENT_IDS.map((id) => ENCHANTMENTS[id]);
  assert.ok(!types.includes('Ancient' as never), 'Ancient must have no enchant (per user direction)');
  assert.strictEqual(new Set(types).size, types.length, 'two enchants bind the same type');
  assert.strictEqual(types.length, 14);
});

test('equipment: a Unique is enchantable but has no ladder', () => {
  for (const unique of UNIQUE_EQUIPMENT) {
    assert.strictEqual(unique.rarity, 'mythic', `${unique.id} must be Mythic`);
    assert.strictEqual(unique.familyId, undefined, `${unique.id} must sit outside the family system`);
    const enchanted = equipment[`${unique.id}.feral`];
    assert.ok(enchanted, `${unique.id} has no enchanted variant`);
    assert.deepStrictEqual(equipmentBudgetProblems(enchanted, PASSIVE_ITEM_COST), []);
    // No ladder to climb: nothing merges it and the Anvil has nothing above Mythic to sell.
    assert.strictEqual(mergeIntoHeld(unique, unique), null);
  }
});

test('equipment: the drop pool is unenchanted bases only', () => {
  // Leaving the variants in would make an enchanted item 14x commoner than a plain one.
  for (const item of EQUIPMENT_DROP_POOL) {
    assert.strictEqual(item.enchantId, undefined, `${item.id} is enchanted and must not be in the drop pool`);
    assert.ok(item.familyId, `${item.id} has no family and must not be in the drop pool`);
  }
});

// --- Merging (docs/gear-absorption.md §3) ---

test('equipment: a same-family drop merges into the held piece one tier above the higher of the two', () => {
  assert.strictEqual(mergeIntoHeld(equipment['spear.rare'], equipment['spear.rare']), 'spear.epic');
  assert.strictEqual(mergeIntoHeld(equipment['spear.common'], equipment['spear.epic']), 'spear.legendary', 'the drop outranks the holder');
  assert.strictEqual(mergeIntoHeld(equipment['spear.epic'], equipment['spear.common']), 'spear.legendary', 'the holder outranks the drop');
  assert.strictEqual(mergeIntoHeld(equipment['spear.legendary'], equipment['spear.common']), 'spear.mythic');
});

test("equipment: a merge keeps the held enchant, else takes the drop's — one enchant, no choice", () => {
  const plain = equipment['spear.rare'];
  const blazing = equipment['spear.rare.blazing'];
  const tidal = equipment['spear.rare.tidal'];
  assert.strictEqual(mergeIntoHeld(blazing, tidal), 'spear.epic.blazing', 'the held piece wins');
  assert.strictEqual(mergeIntoHeld(plain, tidal), 'spear.epic.tidal', "a plain holder takes the drop's");
  assert.strictEqual(mergeIntoHeld(blazing, plain), 'spear.epic.blazing');
});

test('equipment: a merge needs a matching family, and Mythic has nowhere to go', () => {
  assert.strictEqual(mergeIntoHeld(equipment['spear.rare'], equipment['sword.rare']), null, 'different families');
  assert.strictEqual(mergeIntoHeld(equipment['spear.mythic'], equipment['spear.common']), null, 'nothing above Mythic');
  assert.strictEqual(mergeIntoHeld(equipment['spear.common'], equipment['spear.mythic']), null, 'nothing above Mythic, whichever side');
});
