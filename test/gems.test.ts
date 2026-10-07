// Gems (src/run/gems.ts, docs/gems.md): a Gem is a stat and a Mastery pip at once, placed for good;
// a pip with no Gem behind it is filled by fit, so every hero holding Mastery holds its stats.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { passives } from '../src/data/passives';
import { entryPassiveCounts, entryStatModifiers } from '../src/run/entryStats';
import { GEM_ORDER, gemAmount, gemPointsForAct, gemStatModifiers, placeGem, rollGems } from '../src/run/gems';
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
