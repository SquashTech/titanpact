import * as assert from 'assert';
import { test } from './harness';
import { createProfile, decodeProfile, recordRunEnded } from '../src/run/profile';
import { STAR_SHOP_OFFERS, starShopCatalog } from '../src/data/starShop';
import { locations } from '../src/data/locations';
import { locationPool, unvisitedLocationIds } from '../src/run/locations';
import { heroes } from '../src/data/heroes';
import { guildHallOffers, guildHallOffersFor } from '../src/data/recruitment';
import { heroPool, isRecruitable } from '../src/run/recruitment';
import { buyOffer, canBuy, isPurchased, starBalance, starsSpent, StarShopError, type StarShopCatalog, type StarShopGrant } from '../src/run/starShop';

const pack: StarShopGrant = { kind: 'starterPack' };

/** A three-offer catalog for the rules, apart from the shipped one. */
const catalog: StarShopCatalog = {
  lantern: { id: 'lantern', name: 'Lantern', description: 'A thing.', cost: 1, grant: pack },
  banner: { id: 'banner', name: 'Banner', description: 'Another.', cost: 3, grant: pack },
  crown: { id: 'crown', name: 'Crown', description: 'A dear one.', cost: 10, grant: pack },
};

function withStars(count: number) {
  // A star per evolved hero on a clear; three heroes a clear, so `count` clears' worth by distinct paths.
  let profile = createProfile();
  const kinds = ['a', 'b', 'c'];
  for (let i = 0; i < count; i++) {
    const heroId = `hero${Math.floor(i / 3)}`;
    profile = recordRunEnded(
      profile,
      { outcome: 'win', actReached: 6, locationId: null, encountersWon: 1, ascension: 0, roster: [{ heroId, level: 30, evolutionPathId: `${heroId}-${kinds[i % 3]}` }] },
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
    // A Location offer names a real place, and that place names the offer back: the pool gate reads the pair.
    if (offer.grant.kind === 'location') assert.strictEqual(locations[offer.grant.locationId]?.unlock, offer.id, `${offer.id} and its Location disagree`);
    // A bundle names real heroes, each of which names the bundle back, and none of them stands in the draft.
    if (offer.grant.kind === 'heroBundle') {
      assert.ok(offer.grant.heroIds.length > 0, `${offer.id} is an empty bundle`);
      for (const heroId of offer.grant.heroIds) {
        assert.strictEqual(heroes[heroId]?.unlock, offer.id, `${offer.id} and ${heroId} disagree`);
        assert.strictEqual(heroes[heroId].starter, false, `${heroId} is a bundle hero and a starter`);
      }
    }
  }
  // Every Location that has to be bought is on the shelf.
  for (const location of Object.values(locations)) {
    if (location.unlock) assert.ok(starShopCatalog[location.unlock], `${location.id} is locked behind an offer that is not for sale`);
  }
  // Every hero that has to be bought is on the shelf, in the bundle it names.
  for (const hero of Object.values(heroes)) {
    if (!hero.unlock) continue;
    const offer = starShopCatalog[hero.unlock];
    assert.ok(offer?.grant.kind === 'heroBundle' && offer.grant.heroIds.includes(hero.id), `${hero.id} is locked behind an offer that does not list it`);
  }
});

test('star shop: a bought Location joins the pool the road draws from, and only then', () => {
  const base = locationPool();
  assert.ok(!base.includes('holySanctum'), 'the Sanctum is in the base pool');
  assert.ok(!unvisitedLocationIds(['wildsEdge']).includes('holySanctum'));
  const held = locationPool(['location.holySanctum']);
  assert.ok(held.includes('holySanctum'));
  assert.strictEqual(held.length, base.length + 1, 'a purchase adds a place, never replaces one');
  // Every bought place at once: the road still offers two, and the base five are still in it.
  const all = locationPool(Object.values(locations).flatMap((l) => (l.unlock ? [l.unlock] : [])));
  assert.strictEqual(all.length, Object.keys(locations).length - 1, 'a held offer opens its place and nothing else');
  for (const id of base) assert.ok(all.includes(id));
  assert.ok(unvisitedLocationIds(['wildsEdge', 'holySanctum'], held).every((id) => id !== 'holySanctum'), 'a bought place is still visited once');
});

test('star shop: a bought bundle puts its heroes in the recruit pool, and only then', () => {
  const base = heroPool(heroes);
  assert.ok(!('scallywag' in base), 'Scallywag is in the base pool');
  assert.ok(!isRecruitable('scallywag', base), 'a fight cannot hand over a contract for him');
  assert.ok(!guildHallOffers.some((o) => o.heroId === 'scallywag'), 'the base Guild Hall shelf sells him');
  for (const hero of Object.values(base)) assert.strictEqual(hero.unlock, undefined, `${hero.id} is in the base pool with an unlock`);

  const bundle = starShopCatalog['bundle.freeCompany'].grant as { kind: 'heroBundle'; heroIds: readonly string[] };
  const held = heroPool(heroes, ['bundle.freeCompany']);
  for (const id of bundle.heroIds) assert.ok(id in held, `${id} is held and not in the pool`);
  assert.strictEqual(Object.keys(held).length, Object.keys(base).length + bundle.heroIds.length, 'a purchase adds its heroes, never replaces one');
  assert.ok(isRecruitable('scallywag', held));
  assert.ok(guildHallOffersFor(held).some((o) => o.heroId === 'scallywag'), 'the Guild Hall shelf sells him once the bundle is held');
});
