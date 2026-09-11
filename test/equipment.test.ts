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
  canMergeItems,
  equipmentBudgetCost,
  equipmentBudgetProblems,
  equipmentEffectSpend,
  equipmentIdFor,
  holdsItem,
  lootTierFor,
  mergeEnchantChoices,
  mergeResultId,
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
    assert.strictEqual(canMergeItems(unique, unique), false);
    assert.strictEqual(mergeResultId(unique), null);
  }
});

test('equipment: the drop pool is unenchanted bases only', () => {
  // Leaving the variants in would make an enchanted item 14x commoner than a plain one.
  for (const item of EQUIPMENT_DROP_POOL) {
    assert.strictEqual(item.enchantId, undefined, `${item.id} is enchanted and must not be in the drop pool`);
    assert.ok(item.familyId, `${item.id} has no family and must not be in the drop pool`);
  }
});

// --- Merging ---

test('equipment: two of a family and tier merge up, ignoring enchants', () => {
  const plain = equipment['spear.rare'];
  const blazing = equipment['spear.rare.blazing'];
  const tidal = equipment['spear.rare.tidal'];

  assert.ok(canMergeItems(plain, plain));
  assert.ok(canMergeItems(plain, blazing), 'an enchanted duplicate must still merge');
  assert.ok(canMergeItems(blazing, tidal), 'two differently enchanted duplicates must still merge');

  assert.strictEqual(mergeResultId(plain), 'spear.epic');
  assert.strictEqual(mergeResultId(plain, 'blazing'), 'spear.epic.blazing');

  // The choice the player is offered: at most one enchant survives, so two plain inputs pose none.
  assert.deepStrictEqual(mergeEnchantChoices(plain, plain), []);
  assert.deepStrictEqual(mergeEnchantChoices(plain, blazing), ['blazing']);
  assert.deepStrictEqual(mergeEnchantChoices(blazing, tidal), ['blazing', 'tidal']);
});

test('equipment: a merge needs a matching family AND tier, and Mythic has nowhere to go', () => {
  assert.strictEqual(canMergeItems(equipment['spear.rare'], equipment['sword.rare']), false, 'different families');
  assert.strictEqual(canMergeItems(equipment['spear.rare'], equipment['spear.epic']), false, 'different tiers');
  assert.strictEqual(canMergeItems(equipment['spear.mythic'], equipment['spear.mythic']), false, 'nothing above Mythic');
  assert.strictEqual(mergeResultId(equipment['spear.mythic']), null);
});

test('equipment: a hero holds one item per FAMILY, not one per id', () => {
  // Every tier of a family grants the same Awakening, so two Swords would count-stack Sunder
  // while both cards show it once.
  const loadout = ['sword.epic'];
  assert.ok(holdsItem(loadout, 'sword.epic'));
  assert.ok(holdsItem(loadout, 'sword.mythic'), 'a different tier of the same family is still a Sword');
  assert.ok(holdsItem(loadout, 'sword.epic.blazing'), 'an enchanted Sword is still a Sword');
  assert.ok(!holdsItem(loadout, 'spear.epic'));
  // A Unique has no family, so its own id is the identity.
  assert.ok(holdsItem(['worldbreaker'], 'worldbreaker.feral'));
  assert.ok(!holdsItem(['worldbreaker'], 'guardianPlate'));
});

test('equipment: every passive an item grants has a price, and every price names a real passive', () => {
  for (const item of catalog) {
    for (const id of item.grantsPassiveIds ?? []) {
      assert.ok(PASSIVE_ITEM_COST[id] !== undefined, `${item.id} grants unpriced passive ${id}`);
    }
  }
  for (const [id, cost] of Object.entries(PASSIVE_ITEM_COST)) {
    assert.ok(passives[id], `PASSIVE_ITEM_COST prices unknown passive '${id}'`);
    assert.ok(cost > 0 && cost % 5 === 0, `PASSIVE_ITEM_COST['${id}'] = ${cost} should be a positive multiple of 5`);
  }
});

// --- The act curve ---

test('equipment: every loot tier row is a clean percentage split', () => {
  for (let tier = 1; tier <= MAX_LOOT_TIER; tier++) {
    const row = RARITY_WEIGHTS_BY_TIER[tier];
    const total = RARITY_ORDER.reduce((sum, rarity) => sum + row[rarity], 0);
    assert.strictEqual(total, 100, `tier ${tier} weights sum to ${total}`);
  }
});

test('equipment: rarity odds climb monotonically across the run', () => {
  for (let act = 2; act <= 5; act++) {
    const prev = rarityWeightsFor(act - 1);
    const now = rarityWeightsFor(act);
    assert.ok(now.common <= prev.common, `common got commoner from act ${act - 1} to ${act}`);
    assert.ok(now.mythic >= prev.mythic, `mythic got rarer from act ${act - 1} to ${act}`);
  }
});

test('equipment: Legendary and Mythic are impossible in Act 1, from any source', () => {
  for (const source of ['standard', 'elite'] as const) {
    const weights = rarityWeightsFor(1, source);
    assert.strictEqual(weights.legendary, 0, `act 1 ${source} can roll legendary`);
    assert.strictEqual(weights.mythic, 0, `act 1 ${source} can roll mythic`);
    // The elite bump must not punch through the act's hard window.
    assert.ok(weights.epic > 0, `act 1 ${source} should still reach epic`);
  }
  assert.strictEqual(lootTierFor(1, 'elite'), 2);
});

test('equipment: Common is impossible in Act 5, from any source', () => {
  for (const source of ['standard', 'elite'] as const) {
    assert.strictEqual(rarityWeightsFor(5, source).common, 0, `act 5 ${source} can roll common`);
  }
});

test('equipment: the sampler never returns a rarity the act forbids', () => {
  // Weight 0 alone is not enough — float drift in the weighted walk can still land on one.
  for (const act of ACTS) {
    for (const source of ['standard', 'elite'] as const) {
      const weights = rarityWeightsFor(act, source);
      const banned = new Set(RARITY_ORDER.filter((rarity) => weights[rarity] === 0));
      for (let i = 0; i < 200; i++) {
        for (const item of pickWeightedEquipment(catalog, 3, weights)) {
          assert.ok(!banned.has(item.rarity), `act ${act} ${source} cache rolled a ${item.rarity}: ${item.id}`);
        }
      }
    }
  }
});

test('equipment: the catalog can actually fill every act window the curve asks for', () => {
  // The sampler falls back to the unfiltered pool when a filter empties it; that fallback must never fire.
  for (const act of ACTS) {
    const [minRarity, maxRarity] = ACT_RARITY_WINDOW[act];
    const min = RARITY_ORDER.indexOf(minRarity);
    const max = RARITY_ORDER.indexOf(maxRarity);
    const available = catalog.filter((item) => {
      const i = RARITY_ORDER.indexOf(item.rarity);
      return i >= min && i <= max;
    });
    // 3 so an item cache can offer three DISTINCT items.
    assert.ok(available.length >= 3, `act ${act} has only ${available.length} items in window`);
  }
});

test('equipment: every rarity exists in the catalog, so no tier is a dead branch of the curve', () => {
  for (const rarity of RARITY_ORDER) {
    const count = catalog.filter((item) => item.rarity === rarity).length;
    assert.ok(count > 0, `no ${rarity} item exists`);
  }
});
