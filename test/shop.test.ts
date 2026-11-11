import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { rollGuildHallOffers, EQUIPMENT_PRICE_BY_RARITY, EQUIPMENT_SELL_SHARE, sellValueFor, SHOP_ITEM_COUNT, shopItemPrice, buyShopItem, ShopItemError } from '../src/run/shop';
import { RARITY_ORDER } from '../src/run/equipment';

function seedRoster(heroIds: string[], gold = 0) {
  let run = createRunState(gold);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- Gear is valued, and the Shop's bottom plank sells two pieces a visit ---

test('shop: sellValueFor pays the sell share of the tier\'s value, rising with the tier', () => {
  for (let i = 0; i + 1 < RARITY_ORDER.length; i++) {
    const lower = sellValueFor(equipment[`spear.${RARITY_ORDER[i]}`]);
    const higher = sellValueFor(equipment[`spear.${RARITY_ORDER[i + 1]}`]);
    assert.ok(higher > lower, `${RARITY_ORDER[i + 1]} should sell for more than ${RARITY_ORDER[i]}`);
  }
  assert.strictEqual(sellValueFor(equipment['sword.common']), Math.floor(EQUIPMENT_PRICE_BY_RARITY.common * EQUIPMENT_SELL_SHARE));
});

test('shop: the gear shelf holds SHOP_ITEM_COUNT real items', () => {
  const run = seedRoster(['ironWarden'], 1000);
  const offers = rollGuildHallOffers(run);
  assert.strictEqual(offers.itemIds.length, SHOP_ITEM_COUNT);
  assert.ok(offers.itemIds.every((id) => equipment[id]));
});

test('shop: a shelf piece costs its price, and never sells back for as much', () => {
  const item = equipment['sword.rare'];
  assert.ok(shopItemPrice(item) > sellValueFor(item));
  assert.strictEqual(buyShopItem(seedRoster([], 100), item).gold, 100 - shopItemPrice(item));
  assert.throws(() => buyShopItem(seedRoster([], shopItemPrice(item) - 1), item), ShopItemError);
});

