import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { guildHallOffers } from '../src/data/recruitment';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import {
  buyEquipment,
  rollGuildHallOffers,
  ShopError,
  ANVIL_PRICE_BY_TARGET,
  EQUIPMENT_PRICE_BY_RARITY,
  EQUIPMENT_SELL_SHARE,
  GUILD_HALL_EQUIPMENT_OFFER_COUNT,
} from '../src/run/shop';
import { RARITY_ORDER } from '../src/run/equipment';

function seedRoster(heroIds: string[], gold = 0) {
  let run = createRunState(gold);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- Equipment purchase ---

test('shop: buyEquipment spends gold priced by rarity', () => {
  const run = seedRoster([], 100);
  const next = buyEquipment(run, equipment['sword.common']); // common
  assert.strictEqual(next.gold, 100 - EQUIPMENT_PRICE_BY_RARITY.common);
});

test('shop: buyEquipment rejects insufficient gold', () => {
  const run = seedRoster([], 1);
  assert.throws(() => buyEquipment(run, equipment.guardianPlate), ShopError); // mythic, expensive
});

// --- Offer rolling ---

test('shop: rollGuildHallOffers excludes heroes already on the roster', () => {
  const run = seedRoster(['ironWarden']);
  for (let i = 0; i < 20; i++) {
    const offers = rollGuildHallOffers(run, guildHallOffers, Object.values(equipment));
    assert.ok(!offers.heroOfferIds.some((id) => guildHallOffers.find((o) => o.id === id)?.heroId === 'ironWarden'));
  }
});

test('shop: rollGuildHallOffers offers at most 3 heroes and at least 2 when the pool allows', () => {
  const run = seedRoster([]);
  const offers = rollGuildHallOffers(run, guildHallOffers, Object.values(equipment));
  assert.ok(offers.heroOfferIds.length >= 2 && offers.heroOfferIds.length <= 3);
});

// The Guild Hall layout assumes a 4-wide shelf.
test('shop: rollGuildHallOffers stocks the full equipment shelf', () => {
  const run = seedRoster([]);
  const offers = rollGuildHallOffers(run, guildHallOffers, Object.values(equipment));
  assert.strictEqual(offers.equipmentOfferIds.length, GUILD_HALL_EQUIPMENT_OFFER_COUNT);
  assert.strictEqual(GUILD_HALL_EQUIPMENT_OFFER_COUNT, 4);
});

test('shop: rollGuildHallOffers never offers duplicate ids within one category', () => {
  const run = seedRoster([]);
  const offers = rollGuildHallOffers(run, guildHallOffers, Object.values(equipment));
  assert.strictEqual(new Set(offers.heroOfferIds).size, offers.heroOfferIds.length);
  assert.strictEqual(new Set(offers.equipmentOfferIds).size, offers.equipmentOfferIds.length);
});

// --- No gold printer (docs/equipment.md §5) ---
//
// The Anvil is repeatable and unbounded, so no path from gold back to gold may profit. Both
// price tables are untuned and will move; these two inequalities are what may not.

test('shop: buy -> Anvil -> sell never profits, at any tier', () => {
  for (let i = 0; i + 1 < RARITY_ORDER.length; i++) {
    const from = RARITY_ORDER[i];
    const to = RARITY_ORDER[i + 1];
    const outlay = EQUIPMENT_PRICE_BY_RARITY[from] + ANVIL_PRICE_BY_TARGET[to];
    const proceeds = Math.floor(EQUIPMENT_PRICE_BY_RARITY[to] * EQUIPMENT_SELL_SHARE);
    assert.ok(outlay > proceeds, `buying a ${from} (${EQUIPMENT_PRICE_BY_RARITY[from]}), upgrading to ${to} (${ANVIL_PRICE_BY_TARGET[to]}) and selling (${proceeds}) profits`);
  }
});

test('shop: buy two -> merge -> sell never profits, which constrains the shelf curve alone', () => {
  // Merging is FREE, so this loop is governed entirely by EQUIPMENT_PRICE_BY_RARITY. It is the
  // non-obvious one: a future pass that steepens the shelf past 4x a tier opens a printer with
  // the Anvil untouched.
  for (let i = 0; i + 1 < RARITY_ORDER.length; i++) {
    const from = RARITY_ORDER[i];
    const to = RARITY_ORDER[i + 1];
    const outlay = 2 * EQUIPMENT_PRICE_BY_RARITY[from];
    const proceeds = Math.floor(EQUIPMENT_PRICE_BY_RARITY[to] * EQUIPMENT_SELL_SHARE);
    assert.ok(outlay > proceeds, `buying two ${from}s (${outlay}) and selling the merged ${to} (${proceeds}) profits`);
    assert.ok(EQUIPMENT_PRICE_BY_RARITY[to] < 4 * EQUIPMENT_PRICE_BY_RARITY[from], `${to} costs 4x or more than ${from}`);
  }
});

test('shop: the full Common -> Mythic Anvil run costs far more than buying a Mythic outright', () => {
  // The intended relationship: the Anvil is a luxury for an item you are attached to, never the
  // efficient route to power. Merging is the efficient route, and it is free.
  const ladder = RARITY_ORDER.slice(1).reduce((sum, rarity) => sum + ANVIL_PRICE_BY_TARGET[rarity], 0);
  assert.ok(ladder > EQUIPMENT_PRICE_BY_RARITY.mythic, `lifting a Common to Mythic (${ladder}) should cost more than buying one (${EQUIPMENT_PRICE_BY_RARITY.mythic})`);
});
