import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { relics } from '../src/data/relics';
import { guildHallOffers } from '../src/data/recruitment';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { buyEquipment, buyRelic, rollGuildHallOffers, ShopError, EQUIPMENT_PRICE_BY_RARITY, RELIC_PURCHASE_COST } from '../src/run/shop';

function seedRoster(heroIds: string[], gold = 0) {
  let run = createRunState(0, gold);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- Equipment purchase ----------------------------------------------------

test('shop: buyEquipment spends gold priced by rarity', () => {
  const run = seedRoster([], 100);
  const next = buyEquipment(run, equipment.ironBlade); // common
  assert.strictEqual(next.gold, 100 - EQUIPMENT_PRICE_BY_RARITY.common);
});

test('shop: buyEquipment rejects insufficient gold', () => {
  const run = seedRoster([], 1);
  assert.throws(() => buyEquipment(run, equipment.guardianPlate), ShopError); // mythic, expensive
});

// --- Relic purchase ---------------------------------------------------------

test('shop: buyRelic spends gold and adds the relic id', () => {
  const run = seedRoster([], 100);
  const next = buyRelic(run, relics.ironStandard);
  assert.strictEqual(next.gold, 100 - RELIC_PURCHASE_COST);
  assert.deepStrictEqual(next.relics, ['ironStandard']);
});

test('shop: buyRelic rejects insufficient gold and leaves relics untouched', () => {
  const run = seedRoster([], 5);
  assert.throws(() => buyRelic(run, relics.ironStandard), ShopError);
});

// --- Offer rolling ------------------------------------------------------

test('shop: rollGuildHallOffers excludes heroes already on the roster', () => {
  const run = seedRoster(['ironWarden']);
  for (let i = 0; i < 20; i++) {
    const offers = rollGuildHallOffers(run, guildHallOffers, Object.values(equipment), Object.values(relics));
    assert.ok(!offers.heroOfferIds.some((id) => guildHallOffers.find((o) => o.id === id)?.heroId === 'ironWarden'));
  }
});

test('shop: rollGuildHallOffers offers at most 3 heroes and at least 2 when the pool allows', () => {
  const run = seedRoster([]);
  const offers = rollGuildHallOffers(run, guildHallOffers, Object.values(equipment), Object.values(relics));
  assert.ok(offers.heroOfferIds.length >= 2 && offers.heroOfferIds.length <= 3);
});

test('shop: rollGuildHallOffers excludes relics already owned', () => {
  const ownedIds = Object.keys(relics);
  const run = { ...seedRoster([]), relics: ownedIds };
  const offers = rollGuildHallOffers(run, guildHallOffers, Object.values(equipment), Object.values(relics));
  assert.deepStrictEqual(offers.relicOfferIds, []);
});

test('shop: rollGuildHallOffers never offers duplicate ids within one category', () => {
  const run = seedRoster([]);
  const offers = rollGuildHallOffers(run, guildHallOffers, Object.values(equipment), Object.values(relics));
  assert.strictEqual(new Set(offers.heroOfferIds).size, offers.heroOfferIds.length);
  assert.strictEqual(new Set(offers.equipmentOfferIds).size, offers.equipmentOfferIds.length);
  assert.strictEqual(new Set(offers.relicOfferIds).size, offers.relicOfferIds.length);
});
