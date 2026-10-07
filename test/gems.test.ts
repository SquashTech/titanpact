// Gems (src/run/gems.ts, docs/gems.md): a Gem is a stat and a Mastery pip at once, placed for good;
// a pip with no Gem behind it is filled by fit, so every hero holding Mastery holds its stats.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { passives } from '../src/data/passives';
import { entryPassiveCounts, entryStatModifiers } from '../src/run/entryStats';
import {
  GEM_DROP,
  GEM_ORDER,
  SCRIBE_GEMS,
  SHELF_GEM_COUNT,
  buyShelfGem,
  canBuyShelfGem,
  gemAmount,
  gemPointsForAct,
  gemStatModifiers,
  placeGem,
  rollGemDrop,
  rollGems,
  rollShelfGems,
  shelfGemPrice,
} from '../src/run/gems';
import { MASTERY_CAP, MasteryError } from '../src/run/mastery';
import { addRosterEntry, createRosterEntry, createRunState } from '../src/run/state';
import { fightXpFor, MVP_XP_SHARE } from '../src/run/growth';

function seed(id: string) {
  return addRosterEntry(createRunState(0), createRosterEntry(id, id, heroes[id].moveIds));
}

test('gems: a Gem lands its stat and its pip, for good', () => {
  let run = seed('cinderKnight');
  run = placeGem(run, 'cinderKnight', { stat: 'attack', points: 5 });
  run = placeGem(run, 'cinderKnight', { stat: 'hp', points: 10 });
  const entry = run.roster[0];
  assert.strictEqual(entry.mastery, 2);
  assert.deepStrictEqual(gemStatModifiers(entry, heroes.cinderKnight), { attack: 5, hp: 30 }, 'HP at three a point');
  const mods = entryStatModifiers(entry, equipment, passives, entryPassiveCounts(entry, equipment));
  assert.strictEqual(mods.attack, 5, 'summed into the hero sheet and the fight build');
});

test('gems: a mastered hero takes no Gem', () => {
  const run = seed('cinderKnight');
  const capped = { ...run, roster: [{ ...run.roster[0], mastery: MASTERY_CAP }] };
  assert.throws(() => placeGem(capped, 'cinderKnight', { stat: 'speed', points: 5 }), MasteryError);
});

test('gems: rolled in the fixed order, small through Act 2 and large from Act 3', () => {
  let i = 0;
  const draws = [0.99, 0.0, 0.5, 0.3];
  const gems = rollGems(4, 1, () => draws[i++ % draws.length]);
  assert.deepStrictEqual(gems.map((g) => GEM_ORDER.indexOf(g.stat)), [...gems.map((g) => GEM_ORDER.indexOf(g.stat))].sort((a, b) => a - b));
  assert.ok(gems.every((g) => g.points === 5));
  assert.deepStrictEqual([1, 2, 3, 4].map(gemPointsForAct), [5, 5, 10, 10]);
  assert.strictEqual(gemAmount({ stat: 'hp', points: 10 }), 30);
});

test('gems: pips without Gems — an enemy, a hire, an old save — are filled by fit', () => {
  const entry = { ...createRosterEntry('x', 'cinderKnight', heroes.cinderKnight.moveIds), mastery: 6 };
  const mods = gemStatModifiers(entry, heroes.cinderKnight);
  const points = Object.entries(mods).reduce((sum, [stat, amount]) => sum + amount / (stat === 'hp' ? 3 : 1), 0);
  assert.strictEqual(points, 5 * 4 + 10 * 2, 'two pips an act: four small, two large');
  assert.ok(Object.keys(mods).length <= 3, 'on the hero\'s best three grades');
});

test('gems: the MVP takes half the fight again in XP', () => {
  assert.strictEqual(MVP_XP_SHARE, 0.5);
  assert.strictEqual(fightXpFor(560, 'a', 'a'), 840);
  assert.strictEqual(fightXpFor(560, 'b', 'a'), 560);
  assert.strictEqual(fightXpFor(560, 'b', null), 560);
});

test('gems: the Elite and the Guardian always drop two, the small fights sometimes one, the finale none', () => {
  assert.strictEqual(SCRIBE_GEMS, 3, 'the Lapidary hands out three');
  assert.strictEqual(rollGemDrop('elite', 1, () => 0.99).length, 2);
  assert.strictEqual(rollGemDrop('boss', 3, () => 0.99).length, 2);
  assert.ok(rollGemDrop('boss', 3, () => 0.99).every((g) => g.points === 10), 'sized by the act like any other Gem');
  assert.strictEqual(rollGemDrop('skirmish', 1, () => 0.99).length, 0, 'a miss');
  assert.strictEqual(rollGemDrop('skirmish', 1, () => 0).length, 1, 'a hit');
  assert.ok(GEM_DROP.skirmish.chance > 0 && GEM_DROP.skirmish.chance < 1);
  assert.strictEqual(rollGemDrop('finale', 4, () => 0).length, 0);
});

test('gems: the shelf sells single Gems, priced by their points, while somebody can take one', () => {
  assert.ok(SHELF_GEM_COUNT > 4, 'more on the shelf than the two packs it replaced');
  const stock = rollShelfGems(3);
  assert.strictEqual(stock.length, SHELF_GEM_COUNT);
  assert.strictEqual(new Set(stock.map((g) => g.stat)).size, SHELF_GEM_COUNT, 'every one a different stat');
  assert.ok(stock.every((g) => g.points === 10), 'sized by the act');
  const small = { stat: 'attack' as const, points: 5 };
  const large = { stat: 'attack' as const, points: 10 };
  assert.strictEqual(shelfGemPrice(large), shelfGemPrice(small) * 2, 'the price walks with the act');
  let run = { ...seed('cinderKnight'), gold: shelfGemPrice(small) };
  assert.ok(canBuyShelfGem(run, small, false));
  assert.ok(!canBuyShelfGem(run, small, true), 'each sold once a visit');
  assert.ok(!canBuyShelfGem(run, large, false), 'gold');
  run = buyShelfGem(run, small);
  assert.strictEqual(run.gold, 0, 'the gold is the whole price');
  assert.strictEqual(run.roster[0].mastery, 0, 'the Gem lands through placeGem, once the player has said who');
  const capped = { ...run, gold: 99, roster: [{ ...run.roster[0], mastery: MASTERY_CAP }] };
  assert.ok(!canBuyShelfGem(capped, small, false), 'nobody to take it');
  assert.throws(() => buyShelfGem(capped, small), MasteryError);
});
