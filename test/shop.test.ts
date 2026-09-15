import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { guildHallOffers } from '../src/data/recruitment';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { rollGuildHallOffers, ANVIL_PRICE_BY_TARGET, EQUIPMENT_PRICE_BY_RARITY, EQUIPMENT_SELL_SHARE, sellValueFor } from '../src/run/shop';
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
