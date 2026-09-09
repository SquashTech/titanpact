import * as assert from 'assert';
import { test } from './harness';
import { STAT_ORDER } from '../src/engine/content';
import { GEM_HP_GRANT, GEM_STAT_GRANT, gemForStat, gemRelics, relics } from '../src/data/relics';
import {
  GEM_CAP_PER_HERO,
  GEM_CAP_PER_STAT,
  GEM_DROP_CHANCE,
  GEM_OFFER_COUNT,
  GEM_STATS,
  GemError,
  gemDropChanceFor,
  gemHeadroom,
  gemPool,
  gemPoolTotal,
  gemStatModifiers,
  gemsHeldBy,
  grantGems,
  isGemStat,
  pickGemOffers,
  pullGems,
  rollGemOffers,
  socketGems,
  unsocketGems,
} from '../src/run/gems';
import { entryStatModifiers } from '../src/run/entryStats';
import { relicTeamStatModifiers } from '../src/run/relics';
import type { RunState } from '../src/run/state';
import { addRosterEntry, createRosterEntry, createRunState, terminateRosterEntry } from '../src/run/state';
import { MAP_NODE_TYPES } from '../src/run/map';

// --- The catalog (docs/run-loop.md "Gems") ---

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

// --- The per-hero allocation model ---

const hero = (rosterId: string) => createRosterEntry(rosterId, 'valor', []);

/** A run holding `earned` of every Gem stat and the named heroes. */
function runWith(earned: number, ...rosterIds: string[]): RunState {
  let run = createRunState();
  for (const id of rosterIds) run = addRosterEntry(run, hero(id));
  for (const stat of GEM_STATS) run = grantGems(run, stat, earned);
  return run;
}

// The whole point of the pair: neither cap alone would force a spread.
test('gems: the caps force at least three stats to fill a hero', () => {
  assert.ok(GEM_CAP_PER_STAT < GEM_CAP_PER_HERO, 'a per-stat cap at or over the hero cap never binds');
  assert.strictEqual(Math.ceil(GEM_CAP_PER_HERO / GEM_CAP_PER_STAT), 3);
});

test('gems: no Gem carries MP Regen, so neither income nor a socket can name it', () => {
  assert.ok(!isGemStat('mpRegen'));
  assert.deepStrictEqual([...GEM_STATS], STAT_ORDER.filter((stat) => stat !== 'mpRegen'));
  assert.throws(() => grantGems(createRunState(), 'mpRegen'), GemError);
});

test('gems: headroom is whichever cap binds first, and a socket past it is refused', () => {
  let run = runWith(40, 'a');
  run = socketGems(run, 'a', 'attack', GEM_CAP_PER_STAT);
  assert.strictEqual(gemHeadroom(run.roster[0], 'attack'), 0, 'the per-stat cap did not bind');
  assert.throws(() => socketGems(run, 'a', 'attack'), GemError);

  // Filled to one short of the hero cap, every remaining stat has exactly that one seat.
  run = socketGems(run, 'a', 'defense', GEM_CAP_PER_STAT);
  run = socketGems(run, 'a', 'speed', GEM_CAP_PER_HERO - GEM_CAP_PER_STAT * 2 - 1);
  assert.strictEqual(gemsHeldBy(run.roster[0]), GEM_CAP_PER_HERO - 1);
  assert.strictEqual(gemHeadroom(run.roster[0], 'wisdom'), 1, 'the hero cap did not bind');
  run = socketGems(run, 'a', 'wisdom');
  assert.throws(() => socketGems(run, 'a', 'intelligence'), GemError);
});

test('gems: a socket is capped by the POOL as well as by the hero', () => {
  const run = runWith(2, 'a');
  assert.throws(() => socketGems(run, 'a', 'attack', 3), GemError);
  const placed = socketGems(run, 'a', 'attack', 2);
  assert.strictEqual(gemPool(placed).attack, undefined, 'a drained stat should leave the pool');
  assert.throws(() => socketGems(placed, 'a', 'attack'), GemError);
});

test('gems: the pool is derived, so a Gem is never duplicated or lost', () => {
  let run = runWith(5, 'a', 'b');
  const total = () => gemPoolTotal(run) + run.roster.reduce((sum, entry) => sum + gemsHeldBy(entry), 0);
  const earned = GEM_STATS.length * 5;
  assert.strictEqual(total(), earned);

  run = socketGems(run, 'a', 'attack', 4);
  run = socketGems(run, 'b', 'attack', 1);
  assert.strictEqual(gemPool(run).attack, undefined);
  assert.strictEqual(total(), earned, 'socketing changed the run total');

  run = unsocketGems(run, 'a', 'attack', 2);
  assert.strictEqual(gemPool(run).attack, 2);
  assert.strictEqual(total(), earned, 'unsocketing changed the run total');
});

// The whole reason reallocation is free: a hero swapped out is not a hero's worth of Gems lost.
test('gems: terminating a hero returns its Gems to the pool by construction', () => {
  let run = runWith(8, 'a', 'b');
  run = socketGems(run, 'a', 'speed', GEM_CAP_PER_STAT);
  assert.strictEqual(gemPool(run).speed, undefined);
  run = terminateRosterEntry(run, 'a');
  assert.strictEqual(gemPool(run).speed, GEM_CAP_PER_STAT, 'the terminated hero took its Gems with it');
});

test('gems: pullGems empties one hero in a call and leaves the rest of the roster alone', () => {
  let run = runWith(8, 'a', 'b');
  run = socketGems(run, 'a', 'wisdom', 3);
  run = socketGems(run, 'b', 'wisdom', 3);
  run = pullGems(run, 'a');
  assert.strictEqual(gemsHeldBy(run.roster[0]), 0);
  assert.strictEqual(gemsHeldBy(run.roster[1]), 3);
  assert.strictEqual(gemPool(run).wisdom, 8 - 3);
});

test('gems: an allocation reads out as flat stats, HP at twice the figure', () => {
  let run = runWith(8, 'a');
  run = socketGems(run, 'a', 'hp', 2);
  run = socketGems(run, 'a', 'attack', 3);
  const entry = run.roster[0];
  assert.deepStrictEqual(gemStatModifiers(entry), { hp: GEM_HP_GRANT * 2, attack: GEM_STAT_GRANT * 3 });
  // And it reaches the hero sheet through the one assembly point, alongside every other grant.
  assert.deepStrictEqual(entryStatModifiers(entry, {}, {}, {}), { hp: GEM_HP_GRANT * 2, attack: GEM_STAT_GRANT * 3 });
});

test('gems: a hero with no Gems contributes nothing to its stat line', () => {
  assert.deepStrictEqual(gemStatModifiers(hero('a')), {});
  assert.strictEqual(gemPoolTotal(createRunState()), 0);
});

test('gems: an unsocket past what a hero holds is refused, and a count must be a positive integer', () => {
  const run = socketGems(runWith(4, 'a'), 'a', 'defense', 2);
  assert.throws(() => unsocketGems(run, 'a', 'defense', 3), GemError);
  assert.throws(() => socketGems(run, 'a', 'defense', 0), GemError);
  assert.throws(() => socketGems(run, 'a', 'defense', 1.5), GemError);
  assert.throws(() => socketGems(run, 'nobody', 'defense'), GemError);
});
