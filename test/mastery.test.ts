// Mastery (src/run/mastery.ts, docs/mastery.md): ten pips a hero, five the Evolution, ten the
// signature; a pip is one Scroll, landed the moment it is paid; the map pays them, never a fight.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { rosterHeroes } from '../src/data/content';
import { progressionTable } from '../src/data/progression';
import {
  MASTERY_CAP,
  MASTERY_EVOLUTION,
  MASTERY_SIGNATURE,
  MasteryError,
  SCRIBE_PICKS,
  SCRIBE_PIPS_EACH,
  SCROLL_CACHE_COUNT,
  SCROLL_PURCHASE_COST,
  SCROLL_PURCHASE_LIMIT,
  anyMasteryEligible,
  buyScroll,
  canBuyScroll,
  canTakeMastery,
  crossesMastery,
  grantMastery,
  guildHallMastery,
  masteryForAct,
  masteryRoom,
} from '../src/run/mastery';
import { atEvolution, availableEvolution, chooseEvolutionPath, pendingScheduleEntry, scheduleEntries, scheduleFor } from '../src/run/progression';
import { companionOf, companionTierStep, joinCompanion } from '../src/run/companion';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { generateMap, MAP_NODE_TYPES, REWARD_WEIGHTS } from '../src/run/map';
import { TUTORIAL_ROW_TYPES } from '../src/run/tutorial';
import { xpForLevel } from '../src/run/growth';
import { decodeSave, encodeSave, buildContentIndex } from '../src/run/save';
import { equipment } from '../src/data/equipment';
import { classes } from '../src/data/classes';
import { relics } from '../src/data/relics';
import { passives } from '../src/data/passives';
import { moves } from '../src/data/moves';
import { CHAMPION_IDS } from '../src/data/enemies';
import { TYPES } from '../src/data/typechart';
import { locations } from '../src/data/locations';

function seed(ids: readonly string[], gold = 0): RunState {
  let run = createRunState(gold);
  for (const id of ids) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  return run;
}

test('mastery: the two milestones are uniform — five the Evolution, ten the signature and the cap', () => {
  assert.strictEqual(MASTERY_EVOLUTION, 5);
  assert.strictEqual(MASTERY_SIGNATURE, 10);
  assert.strictEqual(MASTERY_CAP, 10);
  assert.deepStrictEqual([SCRIBE_PICKS, SCRIBE_PIPS_EACH], [2, 2], 'the Scribe: two heroes, two pips each');
});

test('mastery: a pip lands the moment it is granted, caps at ten, and a hero at the cap is refused', () => {
  let run = seed(['cinderKnight']);
  assert.strictEqual(run.roster[0].mastery, 0, 'a fresh entry holds no pips');
  assert.ok(canTakeMastery(run.roster[0]));
  run = grantMastery(run, 'cinderKnight', 3);
  assert.strictEqual(run.roster[0].mastery, 3);
  assert.strictEqual(masteryRoom(run.roster[0], SCRIBE_PIPS_EACH), 2);
  run = grantMastery(run, 'cinderKnight', 6);
  assert.strictEqual(run.roster[0].mastery, 9);
  assert.strictEqual(masteryRoom(run.roster[0], SCRIBE_PIPS_EACH), 1, 'a hero at nine takes one of the Scribe\'s two; the other is lost');
  run = grantMastery(run, 'cinderKnight', SCRIBE_PIPS_EACH);
  assert.strictEqual(run.roster[0].mastery, MASTERY_CAP, 'never past the cap');
  assert.ok(!canTakeMastery(run.roster[0]));
  assert.throws(() => grantMastery(run, 'cinderKnight', 1), MasteryError);
  assert.throws(() => grantMastery(run, 'nobody', 1), MasteryError);
  assert.ok(!anyMasteryEligible(run.roster));
});

test('mastery: the fifth pip opens the Evolution, at any level, and the Evolution spends no schedule entry', () => {
  let run = seed(['cinderKnight']);
  const hero = heroes.cinderKnight;
  run = grantMastery(run, 'cinderKnight', MASTERY_EVOLUTION - 1);
  assert.strictEqual(availableEvolution(progressionTable, run.roster[0]), null, 'four pips open nothing');
  assert.ok(crossesMastery(run.roster[0], 1, MASTERY_EVOLUTION), 'and the card says the next one will');
  assert.ok(!crossesMastery(run.roster[0], 1, MASTERY_CAP));
  run = grantMastery(run, 'cinderKnight', 1);
  const node = availableEvolution(progressionTable, run.roster[0]);
  assert.ok(node && node.paths.length === 3, 'the fifth opens it — at level 1');
  assert.strictEqual(pendingScheduleEntry(hero, run.roster[0]), null, 'nothing on the schedule is involved');
  const taken = run.roster[0].scheduleTaken;
  run = chooseEvolutionPath(run, progressionTable, heroes, 'cinderKnight', node!.paths[0].id);
  assert.strictEqual(run.roster[0].scheduleTaken, taken, 'the pips paid, not a level');
  assert.strictEqual(availableEvolution(progressionTable, run.roster[0]), null, 'one-shot');
  assert.deepStrictEqual(atEvolution(seed(['cinderKnight']).roster[0]).mastery, MASTERY_EVOLUTION, 'the fixture stands a hero at the pip');
  // No schedule anywhere carries an Evolution any more.
  for (const h of Object.values(heroes)) assert.ok(scheduleEntries(scheduleFor(h)).every((e) => e.kind === 'offer'), h.id);
});

test('mastery: enemies, contracts and hires read their pips off the act — one model for everybody', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 5, 6].map(masteryForAct), [1, 3, 5, 7, 9, 10]);
  assert.deepStrictEqual([1, 2, 3, 4, 5, 6].map(guildHallMastery), [0, 2, 4, 6, 8, 9]);
  assert.strictEqual(masteryForAct(0), 1, 'clamped below');
  assert.strictEqual(masteryForAct(99), MASTERY_CAP, 'clamped above');
  for (let act = 1; act <= 6; act++) assert.ok(masteryForAct(act) > guildHallMastery(act), `act ${act}: a contract is a pip ahead of a hire`);
});

test('mastery: the companion steps up at the pips a hero would evolve and master at, and its pips die with it', () => {
  let run = joinCompanion(seed(['valor', 'packAlpha']), 'cubling', rosterHeroes);
  const id = companionOf(run)!.rosterId;
  run = grantMastery(run, id, MASTERY_EVOLUTION);
  assert.strictEqual(companionTierStep(companionOf(run)!), 'ravager');
  assert.strictEqual(availableEvolution(progressionTable, companionOf(run)!), null, 'a spawn has no branch, only a step');
});

test('mastery: the shelf sells a Scroll for flat gold, capped a visit, only while somebody can take one', () => {
  let run = seed(['cinderKnight'], SCROLL_PURCHASE_COST * 3);
  assert.ok(canBuyScroll(run, 0));
  run = buyScroll(run, 0);
  assert.strictEqual(run.gold, SCROLL_PURCHASE_COST * 2, 'the gold is the whole price');
  assert.strictEqual(run.roster[0].mastery, 0, 'the pip lands through grantMastery, once the player has said who');
  assert.ok(canBuyScroll(run, 1));
  assert.ok(!canBuyScroll(run, SCROLL_PURCHASE_LIMIT), 'the visit\'s limit');
  assert.throws(() => buyScroll(run, SCROLL_PURCHASE_LIMIT), MasteryError);
  assert.ok(!canBuyScroll({ ...run, gold: SCROLL_PURCHASE_COST - 1 }, 0), 'gold');
  const capped = { ...run, roster: [{ ...run.roster[0], mastery: MASTERY_CAP }] };
  assert.ok(!canBuyScroll(capped, 0), 'nobody to take it');
  assert.throws(() => buyScroll(capped, 0), MasteryError);
});

test('mastery: the Scroll Cache sits in the reward pool at the seat Ichor held, and Ichor is gone', () => {
  assert.strictEqual(SCROLL_CACHE_COUNT, 3);
  assert.ok(MAP_NODE_TYPES.includes('scrollReward'));
  const types = MAP_NODE_TYPES as readonly string[];
  assert.ok(!types.includes('ichorReward') && !types.includes('ichorDropReward'), 'Ichor retired (docs/mastery.md §4)');
  const cache = REWARD_WEIGHTS.find(([type]) => type === 'scrollReward');
  assert.ok(cache && cache[1] === 46, 'the Scroll Cache took back its own weight from Ichor');
  assert.ok(!REWARD_WEIGHTS.some(([type]) => (type as string).startsWith('ichor')), 'and the Drop seat is not re-pointed');
  assert.ok(TUTORIAL_ROW_TYPES.includes('scrollReward'), 'the corridor shows both Scroll grammars');
  // Three pips, any split: three on one hero from two lands the fifth.
  let run = seed(['cinderKnight', 'crimson']);
  run = grantMastery(run, 'cinderKnight', 2);
  for (let i = 0; i < SCROLL_CACHE_COUNT; i++) run = grantMastery(run, 'cinderKnight', 1);
  assert.strictEqual(run.roster[0].mastery, MASTERY_EVOLUTION);
  assert.ok(availableEvolution(progressionTable, run.roster[0]));
});

test('mastery: the Scribe is a forced row every act, never in the reward pool, and the tutorial corridor carries it', () => {
  assert.ok(MAP_NODE_TYPES.includes('scribeReward'));
  assert.ok(!REWARD_WEIGHTS.some(([type]) => type === 'scribeReward'), 'absent from REWARD_WEIGHTS');
  for (const act of [1, 2, 3, 4, 5]) {
    const map = generateMap(7, act);
    const scribes = Object.values(map.nodes).filter((n) => n.type === 'scribeReward');
    assert.strictEqual(scribes.length, 1, `act ${act}`);
    const fork = map.rows[scribes[0].row + 1].map((id) => map.nodes[id].type).sort();
    assert.deepStrictEqual(fork, ['elite', 'skirmish'], `act ${act}: the Scribe sits right above the fork`);
  }
  assert.strictEqual(Object.values(generateMap(7, 6).nodes).filter((n) => n.type === 'scribeReward').length, 0, 'the finale has no Scribe');
  assert.ok(TUTORIAL_ROW_TYPES.includes('scribeReward'));
});

test('mastery: pips round-trip through a save', () => {
  const index = buildContentIndex({ heroes: rosterHeroes, moves, equipment, relics, passives, classes, locations, championIds: CHAMPION_IDS, types: TYPES, progression: progressionTable });
  let run = seed(['cinderKnight']);
  run = { ...run, map: generateMap(3, 1), currentNodeId: null, roster: [{ ...run.roster[0], xp: xpForLevel(4), mastery: 7 }] };
  const decoded = decodeSave(JSON.parse(JSON.stringify(encodeSave(run, 'map', 0))), index);
  assert.ok(decoded.ok, decoded.ok ? '' : decoded.reason);
  if (decoded.ok) assert.strictEqual(decoded.save.run.roster[0].mastery, 7);
  const bad = JSON.parse(JSON.stringify(encodeSave(run, 'map', 0)));
  bad.run.roster[0].mastery = MASTERY_CAP + 1;
  assert.ok(!decodeSave(bad, index).ok, 'a pip count past the cap is refused');
});
