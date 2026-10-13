import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { guildHallOffers } from '../src/data/recruitment';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { rollGuildHallOffers, callForType, callableTypes, TAVERN_CALL_PRICE, TavernCallError, ANVIL_PRICE_BY_TARGET, EQUIPMENT_PRICE_BY_RARITY, EQUIPMENT_SELL_SHARE, sellValueFor, SHOP_ITEM_COUNT, shopItemPrice, buyShopItem, ShopItemError } from '../src/run/shop';
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

test('shop: the gear shelf holds SHOP_ITEM_COUNT real items, the Vigil included, and a Tavern call keeps them', () => {
  const run = seedRoster(['ironWarden'], 1000);
  for (const muster of [false, true]) {
    const offers = rollGuildHallOffers(run, guildHallOffers, muster);
    assert.strictEqual(offers.itemIds.length, SHOP_ITEM_COUNT);
    assert.ok(offers.itemIds.every((id) => equipment[id]));
  }
  const offers = rollGuildHallOffers(run, guildHallOffers);
  assert.deepStrictEqual(callForType(run, guildHallOffers, offers, callableTypes(run, guildHallOffers, offers)[0]).offers.itemIds, offers.itemIds);
});

test('shop: a shelf piece costs its price, and never sells back for as much', () => {
  const item = equipment['sword.rare'];
  assert.ok(shopItemPrice(item) > sellValueFor(item));
  assert.strictEqual(buyShopItem(seedRoster([], 100), item).gold, 100 - shopItemPrice(item));
  assert.throws(() => buyShopItem(seedRoster([], shopItemPrice(item) - 1), item), ShopItemError);
});

test('shop: rollGuildHallOffers excludes heroes already on the roster', () => {
  const run = seedRoster(['ironWarden']);
  for (let i = 0; i < 20; i++) {
    const offers = rollGuildHallOffers(run, guildHallOffers);
    assert.ok(!offers.heroOfferIds.some((id) => guildHallOffers.find((o) => o.id === id)?.heroId === 'ironWarden'));
  }
});

test('shop: rollGuildHallOffers offers at most 3 heroes and at least 2 when the pool allows', () => {
  const run = seedRoster([]);
  const offers = rollGuildHallOffers(run, guildHallOffers);
  assert.ok(offers.heroOfferIds.length >= 2 && offers.heroOfferIds.length <= 3);
});

test('shop: rollGuildHallOffers never offers duplicate heroes', () => {
  const run = seedRoster([]);
  const offers = rollGuildHallOffers(run, guildHallOffers);
  assert.strictEqual(new Set(offers.heroOfferIds).size, offers.heroOfferIds.length);
});

// --- The Tavern's call ---

const heroTypeOf = (offerId: string) => heroes[guildHallOffers.find((o) => o.id === offerId)!.heroId].types[0];

test('shop: a call charges its price and puts a hero of the named type on the last poster, the board keeping its size', () => {
  const run = seedRoster(['ironWarden'], 100);
  for (let i = 0; i < 20; i++) {
    const offers = rollGuildHallOffers(run, guildHallOffers);
    const type = callableTypes(run, guildHallOffers, offers)[i % 5];
    const called = callForType(run, guildHallOffers, offers, type);
    assert.strictEqual(called.run.gold, 100 - TAVERN_CALL_PRICE);
    assert.strictEqual(called.offers.heroOfferIds.length, offers.heroOfferIds.length);
    assert.strictEqual(called.offers.heroOfferIds[offers.heroOfferIds.length - 1], called.offerId, 'the last poster');
    assert.deepStrictEqual(called.offers.heroOfferIds.slice(0, -1), offers.heroOfferIds.slice(0, -1), 'the rest stay up');
    assert.strictEqual(heroTypeOf(called.offerId), type);
    assert.ok(!offers.heroOfferIds.includes(called.offerId), 'never a face already on the board');
    assert.notStrictEqual(guildHallOffers.find((o) => o.id === called.offerId)!.heroId, 'ironWarden', 'never a roster hero');
  }
  assert.throws(() => callForType(seedRoster([], TAVERN_CALL_PRICE - 1), guildHallOffers, rollGuildHallOffers(run, guildHallOffers), 'Fire'), TavernCallError);
});

test('shop: a type nobody is left to answer cannot be called', () => {
  const run = seedRoster([], 100);
  const pool = guildHallOffers.filter((o) => heroes[o.heroId].types[0] === 'Fire').slice(0, 1);
  const offers = { heroOfferIds: [pool[0].id], itemIds: [], gems: [] };
  assert.deepStrictEqual(callableTypes(run, pool, offers), [], 'the one Fire hero is already posted');
  assert.throws(() => callForType(run, pool, offers, 'Fire'), TavernCallError);
});

test('shop: a call to an empty board posts the hero rather than replacing a hired one', () => {
  const offer = guildHallOffers.find((o) => o.heroId === 'ironWarden')!;
  const run = seedRoster(['ironWarden'], 100);
  const offers = { heroOfferIds: [offer.id], itemIds: [], gems: [] };
  const called = callForType(run, guildHallOffers, offers, 'Fire');
  assert.deepStrictEqual(called.offers.heroOfferIds, [offer.id, called.offerId]);
});

// --- No gold printer (docs/equipment.md §5) ---
//
// With no sale of held gear there is no path from gold back to gold at all: the Anvil and the
// shelf spend, and the only sale is an unheld piece on the who-screen, at half its tier's value.
// What survives is the shape of the Anvil table — a lift must cost more than the tier it reaches
// would sell for, so a Sell can never read as the Anvil undone at a profit.

test('shop: an Anvil lift always costs more than the tier it reaches sells for', () => {
  for (let i = 0; i + 1 < RARITY_ORDER.length; i++) {
    const to = RARITY_ORDER[i + 1];
    const proceeds = Math.floor(EQUIPMENT_PRICE_BY_RARITY[to] * EQUIPMENT_SELL_SHARE);
    assert.ok(ANVIL_PRICE_BY_TARGET[to] > proceeds, `lifting to ${to} (${ANVIL_PRICE_BY_TARGET[to]}) costs less than a ${to} sells for (${proceeds})`);
  }
});
