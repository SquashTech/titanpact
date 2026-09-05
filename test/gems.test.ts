import * as assert from 'assert';
import { test } from './harness';
import { STAT_ORDER } from '../src/engine/content';
import { GEM_STAT_GRANT, drawableRelics, gemForStat, gemRelics, relics } from '../src/data/relics';
import { GEM_DROP_CHANCE, GEM_OFFER_COUNT, gemDropChanceFor, pickGemOffers, rollGemOffers } from '../src/run/gems';
import { relicTeamStatModifiers } from '../src/run/relics';
import { MAP_NODE_TYPES } from '../src/run/map';

// --- The catalog (docs/run-loop.md "Gems") ---

test('gems: exactly one Gem per stat, in STAT_ORDER, each a flat +GEM_STAT_GRANT to that one stat', () => {
  assert.strictEqual(gemRelics.length, STAT_ORDER.length);
  STAT_ORDER.forEach((stat, i) => {
    const gem = gemRelics[i];
    assert.strictEqual(gemForStat[stat], gem, `${stat} maps to the wrong Gem`);
    assert.deepStrictEqual(gem.statGrants, { [stat]: GEM_STAT_GRANT }, `${gem.id} grants more than its own stat`);
    assert.strictEqual(gem.gem, true, `${gem.id} is not flagged as a Gem`);
    assert.strictEqual(relics[gem.id], gem, `${gem.id} is missing from the relic catalog`);
  });
});

test('gems: no Gem is drawable by a random relic offer', () => {
  const drawableIds = new Set(drawableRelics.map((r) => r.id));
  for (const gem of gemRelics) assert.ok(!drawableIds.has(gem.id), `${gem.id} leaked into the random relic pool`);
});

test('gems: Gems stack through the ordinary relic stat pipeline', () => {
  const ruby = gemForStat.attack.id;
  assert.deepStrictEqual(relicTeamStatModifiers([ruby, ruby, ruby], relics), { attack: GEM_STAT_GRANT * 3 });
});

// --- Handing them out (src/run/gems.ts) ---

test('gems: the map carries a Gem Cache node', () => {
  assert.ok((MAP_NODE_TYPES as readonly string[]).includes('gemReward'));
});

test('gems: every drop chance is a probability, and the Guardian and finale pay none', () => {
  for (const [nodeType, chance] of Object.entries(GEM_DROP_CHANCE)) {
    assert.ok(chance >= 0 && chance <= 1, `${nodeType} chance ${chance} is not a probability`);
  }
  assert.strictEqual(GEM_DROP_CHANCE.boss, 0);
  assert.strictEqual(GEM_DROP_CHANCE.finale, 0);
});

test('gems: the run opener always pays, whatever its node type would otherwise roll', () => {
  assert.strictEqual(gemDropChanceFor('fight', true), 1);
  assert.strictEqual(gemDropChanceFor('fight', false), GEM_DROP_CHANCE.fight);
  // A roll of 0.999 fails every ordinary fight and still pays on the opener.
  assert.strictEqual(rollGemOffers('fight', true, () => 0.999).length, GEM_OFFER_COUNT);
  assert.deepStrictEqual(rollGemOffers('fight', false, () => 0.999), []);
});

test('gems: an offer is GEM_OFFER_COUNT distinct Gems', () => {
  for (let i = 0; i < 50; i++) {
    const offer = pickGemOffers();
    assert.strictEqual(offer.length, GEM_OFFER_COUNT);
    assert.strictEqual(new Set(offer).size, GEM_OFFER_COUNT, `offer repeated a Gem: ${offer}`);
    for (const id of offer) assert.ok(relics[id]?.gem, `${id} is not a Gem`);
  }
});
