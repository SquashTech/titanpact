// The two equipment economies added 2026-08-30 (user direction), both of
// which are invariants rather than tunables:
//
//   1. RARITY BUDGET — every authored item spends its tier's points exactly.
//      This is the test that makes the budget real: an item that comes in
//      over- or under-curve fails the build, so the catalog can't quietly
//      drift the way an unenforced convention does.
//   2. THE ACT CURVE — "Legendary and Mythic should be impossible to find in
//      Act 1, but common items should be impossible to find in Act 5." The
//      word there is IMPOSSIBLE, so these assert zero weight AND that the
//      sampler never returns one, not just that the odds are low.

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
  equipmentBudgetCost,
  equipmentBudgetProblems,
  lootTierFor,
  pickWeightedEquipment,
  pickWeightedEquipmentBySlot,
  rarityWeightsFor,
  type EquipmentRarity,
  type EquipmentSlot,
} from '../src/run/equipment';

const catalog = Object.values(equipment);
const SLOTS: readonly EquipmentSlot[] = ['weapon', 'armor', 'accessory'];
const ACTS = [1, 2, 3, 4, 5];

// --- The rarity budget -----------------------------------------------------

test('equipment: every authored item spends its rarity budget exactly', () => {
  const offenders = catalog
    .map((item) => ({ item, problems: equipmentBudgetProblems(item, PASSIVE_ITEM_COST) }))
    .filter((entry) => entry.problems.length > 0)
    .map((entry) => `${entry.item.id} (${entry.item.rarity}): ${entry.problems.join('; ')}`);
  assert.deepStrictEqual(offenders, []);
});

test('equipment: the designer-authored common weapons are transcribed as specified', () => {
  // The 12 weapons in the 2026-08-30 brief, verbatim — the worked example the
  // whole common tier (and FORCE_POINT_VALUE) is derived from. Any change to
  // one of these is a design decision, not a balance tweak.
  assert.deepStrictEqual(equipment.ironBlade.statGrants, { attack: 10 });
  assert.deepStrictEqual(equipment.dagger.statGrants, { attack: 5, speed: 5 });
  assert.deepStrictEqual(equipment.torch.statGrants, { attack: 5 });
  assert.deepStrictEqual(equipment.torch.grantsStatusIds, [{ statusId: 'FireForce', magnitude: 5 }]);
  assert.deepStrictEqual(equipment.huntersBow.statGrants, { attack: 5, wisdom: 5 });
  assert.deepStrictEqual(equipment.pummelGloves.grantsStatusIds, [{ statusId: 'IronForce', magnitude: 5 }]);
  assert.deepStrictEqual(equipment.battleAxe.statGrants, { attack: 5, defense: 5 });
  assert.deepStrictEqual(equipment.apprenticeWand.statGrants, { intelligence: 10 });
  assert.deepStrictEqual(equipment.magicBook.statGrants, { intelligence: 5, wisdom: 5 });
  assert.deepStrictEqual(equipment.mysticOrb.grantsStatusIds, [{ statusId: 'ArcaneForce', magnitude: 5 }]);
  assert.deepStrictEqual(equipment.memento.grantsStatusIds, [{ statusId: 'SpiritForce', magnitude: 5 }]);
  assert.deepStrictEqual(equipment.oakStaff.statGrants, { intelligence: 5, defense: 5 });
  assert.deepStrictEqual(equipment.windGem.statGrants, { intelligence: 5, speed: 5 });
  for (const id of ['ironBlade', 'dagger', 'torch', 'huntersBow', 'pummelGloves', 'battleAxe', 'apprenticeWand', 'magicBook', 'mysticOrb', 'memento', 'oakStaff', 'windGem']) {
    assert.strictEqual(equipment[id].rarity, 'common', `${id} must stay Common`);
    assert.strictEqual(equipment[id].slot, 'weapon', `${id} must stay a weapon`);
  }
});

test('equipment: an unpriced granted passive is a budget failure, not free value', () => {
  const problems = equipmentBudgetProblems(
    { id: 'x', name: 'X', slot: 'weapon', rarity: 'epic', statGrants: { attack: 30 }, grantsPassiveIds: ['notAPassive'] },
    PASSIVE_ITEM_COST
  );
  assert.ok(problems.some((p) => p.includes('PASSIVE_ITEM_COST')), problems.join('; '));
  assert.ok(Number.isNaN(equipmentBudgetCost({ id: 'x', name: 'X', slot: 'weapon', rarity: 'epic', statGrants: {}, grantsPassiveIds: ['notAPassive'] }, PASSIVE_ITEM_COST)));
});

test('equipment: a negative grant refunds budget, funding an above-curve stat line', () => {
  // Berserker's Cleaver is the one drawback item: 40 Attack is a Legendary
  // line, paid for at Epic by -10 Defense.
  const cleaver = equipment.berserkersCleaver;
  assert.strictEqual(cleaver.statGrants.attack, 40);
  assert.strictEqual(cleaver.statGrants.defense, -10);
  assert.strictEqual(equipmentBudgetCost(cleaver, PASSIVE_ITEM_COST), RARITY_BUDGET.epic);
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

// --- The act curve ---------------------------------------------------------

test('equipment: every loot tier row is a clean percentage split', () => {
  for (let tier = 1; tier <= MAX_LOOT_TIER; tier++) {
    const row = RARITY_WEIGHTS_BY_TIER[tier];
    const total = RARITY_ORDER.reduce((sum, rarity) => sum + row[rarity], 0);
    assert.strictEqual(total, 100, `tier ${tier} weights sum to ${total}`);
  }
});

test('equipment: rarity odds climb monotonically across the run', () => {
  // The brief's actual ask — "rates should change throughout the run to
  // account for increasing power levels of enemies". Common only ever gets
  // rarer act to act; Mythic only ever gets commoner.
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
    // The elite bump raises the tier but must not punch through the act's
    // hard window — this is the case a weights table alone would get wrong.
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
  // Weight 0 is not enough on its own — pickWeightedEquipment has to filter
  // ineligible items out, or float drift in the weighted walk can still land
  // on one. 400 rolls per act/source/slot combination.
  for (const act of ACTS) {
    for (const source of ['standard', 'elite'] as const) {
      const weights = rarityWeightsFor(act, source);
      const banned = new Set(RARITY_ORDER.filter((rarity) => weights[rarity] === 0));
      for (let i = 0; i < 200; i++) {
        for (const item of pickWeightedEquipment(catalog, 3, weights)) {
          assert.ok(!banned.has(item.rarity), `act ${act} ${source} cache rolled a ${item.rarity}: ${item.id}`);
        }
        for (const slot of SLOTS) {
          const rolled = pickWeightedEquipmentBySlot(catalog, slot, weights);
          assert.ok(rolled, `act ${act} ${source} ${slot} reward rolled nothing`);
          assert.ok(!banned.has(rolled!.rarity), `act ${act} ${source} ${slot} reward rolled a ${rolled!.rarity}: ${rolled!.id}`);
        }
      }
    }
  }
});

test('equipment: the catalog can actually fill every act/slot the curve asks for', () => {
  // The sampler falls back to the unfiltered pool when a filter empties it,
  // which would silently reintroduce a banned rarity. That fallback must
  // never fire: every act's window has to contain real items in every slot.
  for (const act of ACTS) {
    const [minRarity, maxRarity] = ACT_RARITY_WINDOW[act];
    const min = RARITY_ORDER.indexOf(minRarity);
    const max = RARITY_ORDER.indexOf(maxRarity);
    const allowed = (rarity: EquipmentRarity) => {
      const i = RARITY_ORDER.indexOf(rarity);
      return i >= min && i <= max;
    };
    for (const slot of SLOTS) {
      const available = catalog.filter((item) => item.slot === slot && allowed(item.rarity));
      // 3 so an equipment cache can offer three DISTINCT items of one slot.
      assert.ok(available.length >= 3, `act ${act} has only ${available.length} ${slot} items in window`);
    }
  }
});

test('equipment: every rarity exists in every slot, so no tier is a dead branch of the curve', () => {
  for (const slot of SLOTS) {
    for (const rarity of RARITY_ORDER) {
      const count = catalog.filter((item) => item.slot === slot && item.rarity === rarity).length;
      assert.ok(count > 0, `no ${rarity} ${slot} exists`);
    }
  }
});
