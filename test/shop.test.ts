import * as assert from 'assert';
import { test } from './harness';
import { equipment } from '../src/data/equipment';
import { EQUIPMENT_PRICE_BY_RARITY, EQUIPMENT_SELL_SHARE, sellValueFor } from '../src/run/shop';
import { RARITY_ORDER, rarityWeightsFor } from '../src/run/equipment';
import { CAMP_DOORS, CAMP_GEAR_COUNT, CAMP_GEMS, rollCampGear } from '../src/run/camp';
import { GEM_CACHE_COUNT } from '../src/run/gems';
import { createRng, nextFloat, type RngState } from '../src/engine/rng/seededRng';

function seeded(seed: number): () => number {
  let state: RngState = createRng(seed);
  return () => {
    const { value, nextState } = nextFloat(state);
    state = nextState;
    return value;
  };
}

test('shop: sellValueFor pays the sell share of the tier\'s value, rising with the tier', () => {
  for (let i = 0; i + 1 < RARITY_ORDER.length; i++) {
    const lower = sellValueFor(equipment[`spear.${RARITY_ORDER[i]}`]);
    const higher = sellValueFor(equipment[`spear.${RARITY_ORDER[i + 1]}`]);
    assert.ok(higher > lower, `${RARITY_ORDER[i + 1]} should sell for more than ${RARITY_ORDER[i]}`);
  }
  assert.strictEqual(sellValueFor(equipment['sword.common']), Math.floor(EQUIPMENT_PRICE_BY_RARITY.common * EQUIPMENT_SELL_SHARE));
});

// --- The Camp (docs/guild-hall-overhaul.md §3) ---

test('camp: three doors, Mend, Gems and Gear, and the Gems door pays a Gem Cache', () => {
  assert.deepStrictEqual(CAMP_DOORS, ['mend', 'gems', 'gear']);
  assert.strictEqual(CAMP_GEMS, GEM_CACHE_COUNT);
});

test('camp: the Gear door lays out real pieces on the act\'s standard curve, the same for the same seed', () => {
  for (let act = 1; act <= 4; act++) {
    const weights = rarityWeightsFor(act, 'standard');
    for (let seed = 1; seed <= 10; seed++) {
      const ids = rollCampGear(act, seeded(seed));
      assert.strictEqual(ids.length, CAMP_GEAR_COUNT);
      for (const id of ids) {
        assert.ok(equipment[id], `${id} is a piece`);
        assert.ok(weights[equipment[id].rarity] > 0, `act ${act}: ${id} is off the curve`);
      }
      assert.deepStrictEqual(rollCampGear(act, seeded(seed)), ids);
    }
  }
});
