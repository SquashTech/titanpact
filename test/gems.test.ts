import * as assert from 'assert';
import { test } from './harness';
import { STAT_ORDER } from '../src/engine/content';
import { GEM_HP_GRANT, GEM_STAT_GRANT, gemForStat, gemRelics, relics } from '../src/data/relics';
import { GEM_DROP_CHANCE, GEM_OFFER_COUNT, gemDropChanceFor, pickGemOffers, rollGemOffers } from '../src/run/gems';
import { relicTeamStatModifiers } from '../src/run/relics';
import { MAP_NODE_TYPES } from '../src/run/map';

// --- The catalog (docs/run-loop.md "Gems") ---

// MP Regen has no Gem (2026-09-07): at a flat base 10 across the roster, +5 was +50% of a
// throughput stat and read as the correct pick from every offer. It lives on the Wellspring
// Banner instead. Every OTHER stat keeps its Gem, in STAT_ORDER.
const GEM_STATS = STAT_ORDER.filter((stat) => stat !== 'mpRegen');

// The Emerald carries twice the figure for the same worth: HP is authored in the units the bar draws.
test('gems: one Gem per stat but MP Regen, in STAT_ORDER, each a flat grant to that one stat', () => {
  assert.strictEqual(gemRelics.length, GEM_STATS.length);
  assert.strictEqual(gemForStat.mpRegen, undefined, 'MP Regen still has a Gem');
  GEM_STATS.forEach((stat, i) => {
    const gem = gemRelics[i];
    assert.strictEqual(gemForStat[stat], gem, `${stat} maps to the wrong Gem`);
    const grant = stat === 'hp' ? GEM_HP_GRANT : GEM_STAT_GRANT;
    assert.deepStrictEqual(gem.statGrants, { [stat]: grant }, `${gem.id} grants more than its own stat`);
    assert.strictEqual(gem.gem, true, `${gem.id} is not flagged as a Gem`);
    assert.strictEqual(relics[gem.id], gem, `${gem.id} is missing from the relic catalog`);
  });
});

test('gems: Gems stack through the ordinary relic stat pipeline', () => {
  const ruby = gemForStat.attack!.id;
  assert.deepStrictEqual(relicTeamStatModifiers([ruby, ruby, ruby], relics), { attack: GEM_STAT_GRANT * 3 });
});

// --- Handing them out (src/run/gems.ts) ---

test('gems: the map carries a Gem Cache node, and no Regen Spring', () => {
  assert.ok((MAP_NODE_TYPES as readonly string[]).includes('gemReward'));
  assert.ok(!(MAP_NODE_TYPES as readonly string[]).includes('manaRegenBoostReward'));
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
