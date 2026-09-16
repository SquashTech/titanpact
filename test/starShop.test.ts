import * as assert from 'assert';
import { test } from './harness';
import { createProfile, decodeProfile, recordRunEnded } from '../src/run/profile';
import { STAR_SHOP_OFFERS, starShopCatalog } from '../src/data/starShop';
import { buyOffer, canBuy, isPurchased, starBalance, starsSpent, StarShopError, type StarShopCatalog } from '../src/run/starShop';

/** A three-offer catalog for the rules; the shipped one is empty until the design lands. */
const catalog: StarShopCatalog = {
  lantern: { id: 'lantern', name: 'Lantern', description: 'A thing.', cost: 1 },
  banner: { id: 'banner', name: 'Banner', description: 'Another.', cost: 3 },
  crown: { id: 'crown', name: 'Crown', description: 'A dear one.', cost: 10 },
};

function withStars(count: number) {
  // A star per evolved hero on a clear; three heroes a clear, so `count` clears' worth by distinct paths.
  let profile = createProfile();
  const kinds = ['a', 'b', 'c'];
  for (let i = 0; i < count; i++) {
    const heroId = `hero${Math.floor(i / 3)}`;
    profile = recordRunEnded(
      profile,
      { outcome: 'win', actReached: 6, locationId: null, encountersWon: 1, roster: [{ heroId, level: 30, evolutionPathId: `${heroId}-${kinds[i % 3]}` }] },
      i
    );
  }
  return profile;
}

test('star shop: the balance is stars earned minus stars spent, and a star is never un-earned', () => {
  let profile = withStars(5);
  assert.strictEqual(starBalance(profile, catalog), 5);
  profile = buyOffer(profile, catalog, catalog.banner);
  assert.strictEqual(starsSpent(profile, catalog), 3);
  assert.strictEqual(starBalance(profile, catalog), 2);
  assert.strictEqual(Object.values(profile.evolutionStars).flat().length, 5, 'the Compendium still shows every star');
  assert.ok(isPurchased(profile, 'banner'));
});

test('star shop: an offer is bought once, and never past the balance', () => {
  let profile = withStars(3);
  assert.ok(canBuy(profile, catalog, catalog.banner));
  assert.ok(!canBuy(profile, catalog, catalog.crown), 'ten costs more than three');
  profile = buyOffer(profile, catalog, catalog.banner);
  assert.ok(!canBuy(profile, catalog, catalog.banner), 'held');
  assert.throws(() => buyOffer(profile, catalog, catalog.banner), StarShopError);
  assert.throws(() => buyOffer(profile, catalog, catalog.lantern), StarShopError, 'the balance is now zero');
});

test('star shop: a purchase whose offer was withdrawn costs nothing against the balance', () => {
  const profile = { ...withStars(2), purchases: ['aThingNoLongerSold'] };
  assert.strictEqual(starBalance(profile, catalog), 2);
});

test('star shop: purchases survive a round trip and decode deduplicated', () => {
  const profile = buyOffer(withStars(4), catalog, catalog.lantern);
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(profile))).purchases, ['lantern']);
  assert.deepStrictEqual(decodeProfile({ purchases: ['lantern', 'lantern', 4, ''] }).purchases, ['lantern']);
  assert.deepStrictEqual(decodeProfile({}).purchases, []);
});

test('star shop: the shipped catalog is consistent with itself', () => {
  const ids = new Set<string>();
  for (const offer of STAR_SHOP_OFFERS) {
    assert.ok(!ids.has(offer.id), `${offer.id} is listed twice`);
    ids.add(offer.id);
    assert.ok(Number.isInteger(offer.cost) && offer.cost > 0, `${offer.id} must cost a whole number of stars`);
    assert.strictEqual(starShopCatalog[offer.id], offer);
  }
});
