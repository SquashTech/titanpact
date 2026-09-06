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
  EFFECT_FLOOR_MIN_RARITY,
  EFFECT_FLOOR_SHARE,
  equipmentBudgetCost,
  equipmentBudgetProblems,
  equipmentEffectSpend,
  lootTierFor,
  pickWeightedEquipment,
  rarityWeightsFor,
  type EquipmentRarity,
} from '../src/run/equipment';

const catalog = Object.values(equipment);
const ACTS = [1, 2, 3, 4, 5];

// --- The rarity budget ---

test('equipment: every authored item spends its rarity budget exactly', () => {
  const offenders = catalog
    .map((item) => ({ item, problems: equipmentBudgetProblems(item, PASSIVE_ITEM_COST) }))
    .filter((entry) => entry.problems.length > 0)
    .map((entry) => `${entry.item.id} (${entry.item.rarity}): ${entry.problems.join('; ')}`);
  assert.deepStrictEqual(offenders, []);
});

test('equipment: the designer-authored common weapons are transcribed as specified', () => {
  // The 12 designer-specified commons the whole common tier is derived from; a change is a design
  // decision. They are no longer a SLOT — items are uncategorised — and the 2026-09-06 budget pass
  // rescaled them onto Common 30, but each one's SHAPE is exactly what was authored: a stat-only
  // item tripled, and a Force item doubled both halves because Force's own price doubled with it.
  assert.deepStrictEqual(equipment.ironBlade.statGrants, { attack: 30 });
  assert.deepStrictEqual(equipment.dagger.statGrants, { attack: 15, speed: 15 });
  assert.deepStrictEqual(equipment.torch.statGrants, { attack: 10 });
  assert.deepStrictEqual(equipment.torch.grantsStatusIds, [{ statusId: 'FireForce', magnitude: 10 }]);
  assert.deepStrictEqual(equipment.huntersBow.statGrants, { attack: 15, wisdom: 15 });
  assert.deepStrictEqual(equipment.pummelGloves.grantsStatusIds, [{ statusId: 'IronForce', magnitude: 10 }]);
  assert.deepStrictEqual(equipment.battleAxe.statGrants, { attack: 15, defense: 15 });
  assert.deepStrictEqual(equipment.apprenticeWand.statGrants, { intelligence: 30 });
  assert.deepStrictEqual(equipment.magicBook.statGrants, { intelligence: 15, wisdom: 15 });
  assert.deepStrictEqual(equipment.mysticOrb.grantsStatusIds, [{ statusId: 'ArcaneForce', magnitude: 10 }]);
  assert.deepStrictEqual(equipment.memento.grantsStatusIds, [{ statusId: 'SpiritForce', magnitude: 10 }]);
  assert.deepStrictEqual(equipment.oakStaff.statGrants, { intelligence: 15, defense: 15 });
  assert.deepStrictEqual(equipment.windGem.statGrants, { intelligence: 15, speed: 15 });
  for (const id of ['ironBlade', 'dagger', 'torch', 'huntersBow', 'pummelGloves', 'battleAxe', 'apprenticeWand', 'magicBook', 'mysticOrb', 'memento', 'oakStaff', 'windGem']) {
    assert.strictEqual(equipment[id].rarity, 'common', `${id} must stay Common`);
  }
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
  // Berserker's Cleaver: a Legendary-sized 50 Attack AND Sunder, paid for at Epic by -20 Defense.
  const cleaver = equipment.berserkersCleaver;
  assert.strictEqual(cleaver.statGrants.attack, 50);
  assert.strictEqual(cleaver.statGrants.defense, -20);
  assert.strictEqual(equipmentBudgetCost(cleaver, PASSIVE_ITEM_COST), RARITY_BUDGET.epic);
});

test('equipment: an Epic or better may not be stats alone', () => {
  // The effect floor (2026-09-06). A big number is not the same as an interesting item, and the
  // budget pass would otherwise have produced +110 Attack Mythics.
  const plainMythic = { id: 'x', name: 'X', rarity: 'mythic' as const, statGrants: { attack: 110 } };
  const problems = equipmentBudgetProblems(plainMythic, PASSIVE_ITEM_COST);
  assert.ok(problems.some((p) => p.includes('effects')), problems.join('; '));
  // ...and the floor is a SHARE, so a token effect does not clear it either.
  const tokenEffect = {
    id: 'y',
    name: 'Y',
    rarity: 'mythic' as const,
    statGrants: { attack: 100 },
    grantsStatusIds: [{ statusId: 'FireForce', magnitude: 5 }],
  };
  assert.ok(equipmentBudgetProblems(tokenEffect, PASSIVE_ITEM_COST).some((p) => p.includes('effects')));
  // Below Epic there is no floor at all: a plain Common is what an Act-1 item should be.
  assert.deepStrictEqual(equipmentBudgetProblems(equipment.ironBlade, PASSIVE_ITEM_COST), []);
});

test('equipment: every Epic and better in the catalog clears the effect floor', () => {
  for (const item of catalog) {
    if (RARITY_ORDER.indexOf(item.rarity) < RARITY_ORDER.indexOf(EFFECT_FLOOR_MIN_RARITY)) continue;
    const spend = equipmentEffectSpend(item, PASSIVE_ITEM_COST);
    const floor = RARITY_BUDGET[item.rarity] * EFFECT_FLOOR_SHARE;
    assert.ok(spend >= floor, `${item.id} (${item.rarity}) spends ${spend} on effects, under ${floor}`);
  }
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
