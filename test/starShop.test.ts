import * as assert from 'assert';
import { test } from './harness';
import { LEFT_BASE_2026_09_28, PROFILE_VERSION, createProfile, decodeProfile, recordRunEnded, recordRunStarted } from '../src/run/profile';
import { MAX_BUILT_CYCLE, cycleOf } from '../src/run/cycles';
import { STAR_SHOP_OFFERS, starShopCatalog } from '../src/data/starShop';
import { locations } from '../src/data/locations';
import { locationPool, unvisitedLocationIds } from '../src/run/locations';
import { heroes } from '../src/data/heroes';
import { guildHallOffers, guildHallOffersFor } from '../src/data/recruitment';
import { heroPool, isRecruitable, starfallLedgerId } from '../src/run/recruitment';
import { deckHeroIds, profileDeck } from '../src/run/deck';
import { STARFALL_PRICE, buyOffer, bundleOwnedHeroIds, canBuy, canCallStarfall, isPurchased, offerHeld, offerPrice, starfall, starfallPool, starBalance, starsSpent, StarShopError, type StarShopCatalog, type StarShopGrant } from '../src/run/starShop';

const pack: StarShopGrant = { kind: 'location', locationId: 'holySanctum' };

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
      { outcome: 'win', actReached: 6, locationId: null, encountersWon: 1, cycle: 1, roster: [{ heroId, level: 30, evolutionPathId: `${heroId}-${kinds[i % 3]}` }] },
      i
    );
  }
  // Hero stars only: the clear bonus each of those clears paid is the stakes test's business.
  return { ...profile, bonusStars: 0 };
}

test('star shop: the balance is stars earned minus stars spent, and a star is never un-earned', () => {
  let profile = withStars(5);
  assert.strictEqual(starBalance(profile, catalog), 5);
  profile = buyOffer(profile, catalog, catalog.banner);
  assert.strictEqual(starsSpent(profile, catalog), 3);
  assert.strictEqual(starBalance(profile, catalog), 2);
  assert.strictEqual(Object.values(profile.evolutionStars).flat().length, 5, 'the Stars page still shows every star');
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
  assert.deepStrictEqual(decodeProfile({ version: PROFILE_VERSION, purchases: ['lantern', 'lantern', 4, ''] }).purchases, ['lantern']);
  assert.deepStrictEqual(decodeProfile({ version: PROFILE_VERSION }).purchases, []);
});

test('star shop: a profile from before the 2026-09-28 base swap keeps the heroes that left the base, free', () => {
  const old = decodeProfile({ version: 1, purchases: [] });
  for (const id of LEFT_BASE_2026_09_28) {
    assert.ok(heroes[id].unlock, `${id} is no longer base`);
    assert.ok(heroPool(heroes, old.purchases)[id], `${id} is still owned`);
  }
  assert.strictEqual(starsSpent(old, starShopCatalog), 0);
  const fresh = decodeProfile(JSON.parse(JSON.stringify(createProfile())));
  for (const id of LEFT_BASE_2026_09_28) assert.ok(!heroPool(heroes, fresh.purchases)[id], `a new account does not own ${id}`);
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
    // A bundle names real heroes, each of which names the bundle back.
    if (offer.grant.kind === 'heroBundle') {
      assert.ok(offer.grant.heroIds.length > 0, `${offer.id} is an empty bundle`);
      for (const heroId of offer.grant.heroIds) {
        assert.strictEqual(heroes[heroId]?.unlock, offer.id, `${offer.id} and ${heroId} disagree`);
      }
    }
  }
  // Every Location that has to be bought is on the shelf.
  for (const location of Object.values(locations)) {
    if (location.unlock) assert.ok(starShopCatalog[location.unlock], `${location.id} is locked behind an offer that is not for sale`);
  }
  // Every hero outside the base is in the bundle it names, or is the Starfall's alone. No hero is sold singly.
  for (const hero of Object.values(heroes)) {
    if (!hero.unlock || hero.unlock === 'starfall') continue;
    const offer = starShopCatalog[hero.unlock];
    assert.ok(offer?.grant.kind === 'heroBundle' && offer.grant.heroIds.includes(hero.id), `${hero.id} is locked behind an offer that does not list it`);
  }
  assert.deepStrictEqual(
    STAR_SHOP_OFFERS.filter((o) => o.grant.kind === 'heroBundle').map((o) => o.id),
    ['bundle.tallGrass'],
    'From the Tall Grass is the one bundle'
  );
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
  assert.ok(!('drake' in base), 'Drake is in the base pool');
  assert.ok(!isRecruitable('drake', base), 'a fight cannot hand over a contract for him');
  assert.ok(!guildHallOffers.some((o) => o.heroId === 'drake'), 'the base Guild Hall shelf sells him');
  for (const hero of Object.values(base)) assert.strictEqual(hero.unlock, undefined, `${hero.id} is in the base pool with an unlock`);

  const bundle = starShopCatalog['bundle.tallGrass'].grant as { kind: 'heroBundle'; heroIds: readonly string[] };
  const held = heroPool(heroes, ['bundle.tallGrass']);
  for (const id of bundle.heroIds) assert.ok(id in held, `${id} is held and not in the pool`);
  assert.strictEqual(Object.keys(held).length, Object.keys(base).length + bundle.heroIds.length, 'a purchase adds its heroes, never replaces one');
  assert.ok(isRecruitable('drake', held));
  assert.ok(guildHallOffersFor(held).some((o) => o.heroId === 'drake'), 'the Guild Hall shelf sells him once the bundle is held');
});

test('star shop: a clear pays its Cycle bonus every time, and no Cycle costs a star to enter', () => {
  const end = (cycle: number, outcome: 'win' | 'loss') => ({ outcome, actReached: 6, locationId: null, encountersWon: 1, cycle, roster: [] });
  let profile = recordRunEnded(createProfile(), end(1, 'win'), 1);
  profile = recordRunEnded(profile, end(1, 'win'), 2);
  assert.strictEqual(profile.bonusStars, 2 * cycleOf(1).clearBonus, 'Cycle I pays on every clear');
  assert.strictEqual(profile.runHistory[0].clearBonus, cycleOf(1).clearBonus);
  assert.strictEqual(recordRunEnded(profile, end(2, 'loss'), 3).bonusStars, profile.bonusStars, 'a loss pays nothing');

  const balance = starBalance(profile, catalog);
  const sealed = recordRunStarted(profile, 4);
  assert.strictEqual(starBalance(sealed, catalog), balance, 'sealing the pact spends nothing');
  const won = recordRunEnded(sealed, end(2, 'win'), 5);
  assert.strictEqual(starBalance(won, catalog), balance + cycleOf(2).clearBonus);
});

test('star shop: every built Cycle pays more a run than the one before it, at the measured win rates', () => {
  // docs/ascension.md §9b, skilled pilot: Cycle I 73.7%, Cycle II 31.2%. Directional (docs/collection.md §5).
  const winRate: Record<number, number> = { 1: 0.737, 2: 0.312 };
  const expected = (cycle: number) => winRate[cycle] * cycleOf(cycle).clearBonus;
  for (let cycle = 2; cycle <= MAX_BUILT_CYCLE; cycle++) assert.ok(expected(cycle) > expected(cycle - 1), `Cycle ${cycle} pays ${expected(cycle).toFixed(2)} against ${expected(cycle - 1).toFixed(2)}`);
});

test('star shop: a profile written before the stakes reads as none earned and none paid', () => {
  const old = decodeProfile({ runHistory: [{ outcome: 'win', actReached: 6, roster: [] }] });
  assert.strictEqual(old.bonusStars, 0);
  assert.strictEqual(old.feesPaid, 0);
  assert.strictEqual(old.runHistory[0].clearBonus, 0);
});

test('star shop: a bundle is discounted by the heroes already owned, charged what it cost the day it was bought', () => {
  const rich = { ...createProfile(), bonusStars: 30 };
  const bundle = starShopCatalog['bundle.tallGrass'];
  assert.strictEqual(offerPrice(rich, bundle), bundle.cost);
  // One of the three drawn by a Starfall: the bundle is now the other two's share.
  const oneOwned = { ...rich, purchases: [starfallLedgerId('drake')] };
  assert.deepStrictEqual(bundleOwnedHeroIds(oneOwned, bundle), ['drake']);
  assert.strictEqual(offerPrice(oneOwned, bundle), Math.ceil((bundle.cost * 2) / 3));
  const twoOwned = { ...rich, purchases: [starfallLedgerId('drake'), starfallLedgerId('tixwick')] };
  assert.strictEqual(offerPrice(twoOwned, bundle), Math.ceil(bundle.cost / 3));
  assert.ok(offerPrice(twoOwned, bundle) < offerPrice(oneOwned, bundle) && offerPrice(oneOwned, bundle) < bundle.cost);

  const bought = buyOffer(oneOwned, starShopCatalog, bundle);
  assert.ok(['drake', 'nautilus', 'tixwick'].every((id) => id in heroPool(heroes, bought.purchases)));
  assert.strictEqual(starsSpent(bought, starShopCatalog), STARFALL_PRICE + offerPrice(oneOwned, bundle), 'the discount is kept in the ledger');
  assert.ok(offerHeld(bought, bundle) && !canBuy(bought, starShopCatalog, bundle));
  assert.throws(() => buyOffer(bought, starShopCatalog, bundle), StarShopError, 'owned already');

  const allDrawn = { ...rich, purchases: ['drake', 'nautilus', 'tixwick'].map(starfallLedgerId) };
  assert.ok(offerHeld(allDrawn, bundle), 'three drawn heroes hold the bundle');
});

test('star shop: a single hero bought before singles were withdrawn is still owned, and refunded', () => {
  const legacy = { ...createProfile(), bonusStars: 5, purchases: ['hero.scallywag', 'bundle.freeCompany'] };
  assert.ok('scallywag' in heroPool(heroes, legacy.purchases));
  assert.strictEqual(starBalance(legacy, starShopCatalog), 5);
});

test('star shop: a Starfall draws only heroes not owned, costs its price, and stops when there are none', () => {
  let profile = { ...createProfile(), bonusStars: 100 };
  const outside = Object.values(heroes).filter((h) => h.unlock).length;
  const seen = new Set<string>();
  for (let i = 0; i < outside; i++) {
    const before = starBalance(profile, starShopCatalog);
    const result = starfall(profile, starShopCatalog, (i * 0.37) % 1);
    assert.ok(!seen.has(result.heroId), `${result.heroId} drawn twice`);
    seen.add(result.heroId);
    assert.ok(result.heroId in heroPool(heroes, result.profile.purchases));
    assert.strictEqual(starBalance(result.profile, starShopCatalog), before - STARFALL_PRICE);
    profile = result.profile;
  }
  assert.strictEqual(starfallPool(profile).length, 0);
  assert.ok(!canCallStarfall(profile, starShopCatalog));
  assert.throws(() => starfall(profile, starShopCatalog, 0.5), StarShopError);
  assert.throws(() => starfall(createProfile(), starShopCatalog, 0.5), StarShopError, 'no stars');
  // A drawn hero is in the deck's reserve, not the deck.
  const drawn = starfall({ ...createProfile(), bonusStars: 5 }, starShopCatalog, 0);
  const deck = profileDeck(drawn.profile, heroes);
  assert.ok(!deckHeroIds(deck).includes(drawn.heroId));
});
