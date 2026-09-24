import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { guildHallOffers } from '../src/data/recruitment';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { rollGuildHallOffers, rerollGuildHallOffers, tavernRerollCost, TavernRerollError, ANVIL_PRICE_BY_TARGET, EQUIPMENT_PRICE_BY_RARITY, EQUIPMENT_SELL_SHARE, sellValueFor } from '../src/run/shop';
import { RARITY_ORDER } from '../src/run/equipment';

function seedRoster(heroIds: string[], gold = 0) {
  let run = createRunState(gold);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- Gear is valued, never bought (docs/gear-absorption.md §6) ---

test('shop: sellValueFor pays the sell share of the tier\'s value, rising with the tier', () => {
  for (let i = 0; i + 1 < RARITY_ORDER.length; i++) {
    const lower = sellValueFor(equipment[`spear.${RARITY_ORDER[i]}`]);
    const higher = sellValueFor(equipment[`spear.${RARITY_ORDER[i + 1]}`]);
    assert.ok(higher > lower, `${RARITY_ORDER[i + 1]} should sell for more than ${RARITY_ORDER[i]}`);
  }
  assert.strictEqual(sellValueFor(equipment['sword.common']), Math.floor(EQUIPMENT_PRICE_BY_RARITY.common * EQUIPMENT_SELL_SHARE));
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

// --- The Tavern's reroll ---

test('shop: a Tavern reroll charges its price and each one a visit costs more', () => {
  const run = seedRoster([], 100);
  const offers = rollGuildHallOffers(run, guildHallOffers);
  const first = rerollGuildHallOffers(run, guildHallOffers, offers, 0);
  assert.strictEqual(first.run.gold, 100 - tavernRerollCost(0));
  assert.ok(tavernRerollCost(1) > tavernRerollCost(0));
  assert.throws(() => rerollGuildHallOffers(seedRoster([], tavernRerollCost(0) - 1), guildHallOffers, offers, 0), TavernRerollError);
});

test('shop: a Tavern reroll keeps the shelf size and shows new faces, never a roster hero', () => {
  const run = seedRoster(['ironWarden'], 1000);
  for (let i = 0; i < 20; i++) {
    const offers = rollGuildHallOffers(run, guildHallOffers);
    const next = rerollGuildHallOffers(run, guildHallOffers, offers, 0).offers;
    assert.strictEqual(next.heroOfferIds.length, offers.heroOfferIds.length);
    assert.strictEqual(new Set(next.heroOfferIds).size, next.heroOfferIds.length);
    assert.ok(next.heroOfferIds.every((id) => !offers.heroOfferIds.includes(id)), 'a deep pool rerolls into new faces');
    assert.ok(!next.heroOfferIds.some((id) => guildHallOffers.find((o) => o.id === id)?.heroId === 'ironWarden'));
  }
});

test('shop: a Tavern reroll over a thin pool tops up from the faces just shown', () => {
  const pool = guildHallOffers.slice(0, 3);
  const run = seedRoster([], 1000);
  const offers = { heroOfferIds: pool.slice(0, 2).map((o) => o.id) };
  const next = rerollGuildHallOffers(run, pool, offers, 0).offers;
  assert.strictEqual(next.heroOfferIds.length, 2);
  assert.ok(next.heroOfferIds.includes(pool[2].id));
});

// --- No gold printer (docs/equipment.md §5) ---
//
// With no shelf and no sale of held gear there is no path from gold back to gold at all: the
// Anvil spends, and the only sale is an unheld drop on the who-screen, priced by its own tier.
// What survives is the shape of the Anvil table — a lift must cost more than the tier it reaches
// would sell for, so a Sell can never read as the Anvil undone at a profit.

test('shop: an Anvil lift always costs more than the tier it reaches sells for', () => {
  for (let i = 0; i + 1 < RARITY_ORDER.length; i++) {
    const to = RARITY_ORDER[i + 1];
    const proceeds = Math.floor(EQUIPMENT_PRICE_BY_RARITY[to] * EQUIPMENT_SELL_SHARE);
    assert.ok(ANVIL_PRICE_BY_TARGET[to] > proceeds, `lifting to ${to} (${ANVIL_PRICE_BY_TARGET[to]}) costs less than a ${to} sells for (${proceeds})`);
  }
});
