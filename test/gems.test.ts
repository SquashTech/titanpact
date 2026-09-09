import * as assert from 'assert';
import { test } from './harness';
import { STAT_ORDER } from '../src/engine/content';
import { GEM_HP_GRANT, GEM_STAT_GRANT, gemForStat, gemList, gems } from '../src/data/gems';
import {
  GEM_CAP_PER_HERO,
  GEM_CAP_PER_STAT,
  GEM_FIGHT_STACK,
  GEM_NODE_STACK,
  GEM_OFFER_COUNT,
  GEM_STATS,
  GemError,
  gemGrant,
  gemHeadroom,
  gemPool,
  gemPoolTotal,
  gemStackFor,
  gemStatModifiers,
  gemsHeldBy,
  grantGems,
  isGemStat,
  pickGemOffers,
  pullGems,
  socketGems,
  unsocketGems,
} from '../src/run/gems';
import { entryStatModifiers } from '../src/run/entryStats';
import { relics } from '../src/data/relics';
import type { RunState } from '../src/run/state';
import { addRosterEntry, createRosterEntry, createRunState, terminateRosterEntry } from '../src/run/state';
import { MAP_NODE_TYPES } from '../src/run/map';

// --- The catalog (src/data/gems.ts) ---

test('gems: one Gem per stat but MP Regen, in STAT_ORDER, each carrying its own stat', () => {
  assert.deepStrictEqual([...GEM_STATS], STAT_ORDER.filter((stat) => stat !== 'mpRegen'));
  assert.strictEqual(gemForStat.mpRegen, undefined, 'MP Regen still has a Gem');
  gemList.forEach((gem, i) => {
    assert.strictEqual(gem.stat, GEM_STATS[i], `${gem.id} is out of STAT_ORDER`);
    assert.strictEqual(gemForStat[gem.stat], gem, `${gem.stat} maps to the wrong Gem`);
    assert.strictEqual(gems[gem.id], gem, `${gem.id} is missing from the catalog`);
  });
});

// The Emerald carries twice the figure for the same worth: HP is authored in the units the bar draws.
test('gems: every Gem is worth GEM_STAT_GRANT but the Emerald, which is worth twice', () => {
  for (const gem of gemList) {
    assert.strictEqual(gem.grant, gem.stat === 'hp' ? GEM_HP_GRANT : GEM_STAT_GRANT, `${gem.id} is priced oddly`);
    assert.strictEqual(gemGrant(gem.stat), gem.grant, `gemGrant disagrees with the catalog about ${gem.stat}`);
  }
  assert.strictEqual(GEM_HP_GRANT, GEM_STAT_GRANT * 2);
});

// A Gem is per-hero now, so it is not in the team-wide catalog at all.
test('gems: no Gem is a relic, and the relic catalog is Banners only', () => {
  for (const gem of gemList) assert.strictEqual(relics[gem.id], undefined, `${gem.id} is still a relic`);
  for (const relic of Object.values(relics)) assert.ok(relic.guardianBanner, `${relic.id} is not a Banner`);
});

// --- Handing them out (src/run/gems.ts) ---

test('gems: the map carries a Gem Cache node, and no Regen Spring', () => {
  assert.ok((MAP_NODE_TYPES as readonly string[]).includes('gemReward'));
  assert.ok(!(MAP_NODE_TYPES as readonly string[]).includes('manaRegenBoostReward'));
});

// Every win pays: the roll the team-wide era used is gone, because the player choosing the stat
// is what keeps two runs from holding the same Gems.
test('gems: every won fight pays a stack, and the Guardian and finale pay none', () => {
  for (const [nodeType, stack] of Object.entries(GEM_FIGHT_STACK)) {
    assert.ok(Number.isInteger(stack) && stack >= 0, `${nodeType} pays ${stack}, which is not a stack`);
  }
  for (const nodeType of ['fight', 'battle', 'skirmish', 'elite'] as const) {
    assert.ok(gemStackFor(nodeType) > 0, `${nodeType} pays no Gems`);
  }
  assert.strictEqual(gemStackFor('boss'), 0, 'the Guardian pays a Gem on top of its Banner');
  assert.strictEqual(gemStackFor('finale'), 0);
});

test('gems: an Elite pays more than an ordinary fight, and a node more than any fight', () => {
  assert.ok(gemStackFor('elite') > gemStackFor('fight'));
  assert.ok(GEM_NODE_STACK > Math.max(...Object.values(GEM_FIGHT_STACK)));
});

test('gems: an offer is GEM_OFFER_COUNT distinct stats, all of them Gem stats', () => {
  for (let i = 0; i < 50; i++) {
    const offer = pickGemOffers();
    assert.strictEqual(offer.length, GEM_OFFER_COUNT);
    assert.strictEqual(new Set(offer).size, GEM_OFFER_COUNT, `offer repeated a stat: ${offer}`);
    for (const stat of offer) assert.ok(isGemStat(stat), `${stat} carries no Gem`);
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
