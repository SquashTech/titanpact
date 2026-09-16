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
  pendingSignature,
} from '../src/run/mastery';
import { MOVE_CAP, atEvolution, availableEvolution, chooseEvolutionPath, grantOfferedMove, pendingScheduleEntry, recordMoveOffer, scheduleEntries, scheduleFor } from '../src/run/progression';
import { signatureMoves } from '../src/data/signatures';
import { generateEncounter } from '../src/run/enemyGen';
import { mentorMovePool, tutorMovePool } from '../src/run/tutor';
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
  assert.deepStrictEqual([1, 2, 3, 4, 5, 6].map(masteryForAct), [0, 2, 4, 6, 8, 10]);
  assert.deepStrictEqual([1, 2, 3, 4, 5, 6].map(guildHallMastery), [0, 1, 3, 5, 7, 9]);
  assert.strictEqual(masteryForAct(0), 0, 'clamped below');
  assert.strictEqual(masteryForAct(99), MASTERY_CAP, 'clamped above');
  for (let act = 2; act <= 6; act++) assert.ok(masteryForAct(act) > guildHallMastery(act), `act ${act}: a contract is a pip ahead of a hire`);
  assert.strictEqual(guildHallMastery(1), 0, 'and both are raw in Act 1');
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

// --- The signature (docs/mastery.md §5) ---

test('signature: every authored signature exists, wears its hero\'s primary type, carries no tier, and is in NO pool, list or grant — the Class-move rule\'s sibling', () => {
  const authored = Object.values(heroes).filter((h) => h.signatureMoveId);
  assert.ok(authored.length >= 1, 'Riptide\'s Lizard Rush is the template');
  const pools = new Set(Object.values(progressionTable.moveTiers).flat());
  const pathMoves = new Set(
    Object.values(progressionTable.evolutions).flatMap((nodes) => nodes.flatMap((node) => node.paths.flatMap((p) => [...p.unlocksMoveIds, ...(p.learnableMoveIds ?? [])])))
  );
  const kits = new Set(Object.values(heroes).flatMap((h) => h.moveIds));
  for (const hero of authored) {
    const id = hero.signatureMoveId!;
    const move = moves[id];
    assert.ok(move && signatureMoves[id], `${hero.id}: ${id} is not in the signature catalog`);
    assert.strictEqual(move.type, hero.types[0], `${hero.id}: ${id} is not at the hero's primary type`);
    assert.strictEqual(move.tier, undefined, `${hero.id}: ${id} carries a tier`);
    assert.strictEqual(move.typeFollowsUser, undefined, `${hero.id}: ${id} needs no typeFollowsUser — it is authored at the type`);
    assert.ok(!pools.has(id), `${hero.id}: ${id} is in a level-up pool`);
    assert.ok(!pathMoves.has(id), `${hero.id}: ${id} is granted or made learnable by an Evolution path`);
    assert.ok(!kits.has(id), `${hero.id}: ${id} is in a starting kit`);
    for (const entry of [createRosterEntry('x', hero.id, hero.moveIds)]) {
      assert.deepStrictEqual(mentorMovePool(progressionTable, moves, entry).includes(id), false, `${hero.id}: the Mentor could roll it`);
      assert.deepStrictEqual(tutorMovePool(progressionTable, moves, entry).includes(id), false, `${hero.id}: the Tutor could roll it`);
    }
  }
  // One per hero: no two heroes point at one move.
  const ids = authored.map((h) => h.signatureMoveId);
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('signature: the tenth pip owes it once — below the cap it lands, at the cap it is replace-or-decline, and made is spent', () => {
  const hero = heroes.tidecaller;
  let run = seed(['tidecaller']);
  assert.strictEqual(pendingSignature(hero, { ...run.roster[0], mastery: MASTERY_SIGNATURE - 1 }), null, 'nine pips owe nothing');
  run = grantMastery(run, 'tidecaller', MASTERY_SIGNATURE);
  assert.strictEqual(pendingSignature(hero, run.roster[0]), 'lizardRush');
  assert.strictEqual(pendingSignature(rosterHeroes.cubling, { ...run.roster[0], heroId: 'cubling' }), null, 'a hero with none authored — a spawn — is simply mastered');
  // Below the cap: granted, and the offer is spent.
  const landed = grantOfferedMove(run, 'tidecaller', 'lizardRush');
  assert.ok(landed.roster[0].unlockedMoveIds.includes('lizardRush'));
  assert.strictEqual(pendingSignature(hero, landed.roster[0]), null, 'held is not owed');
  // Declined at the cap: the offer was made, so it is spent — a signature is offered once.
  const declined = recordMoveOffer(run, 'tidecaller', ['lizardRush']);
  assert.ok(!declined.roster[0].unlockedMoveIds.includes('lizardRush'));
  assert.strictEqual(pendingSignature(hero, declined.roster[0]), null, 'declined is not owed either');
});

test('signature: a generated hero at ten holds it — in the last slot when its kit is full — and one below ten does not', () => {
  const at = (mastery: number) => generateEncounter('elite', 5, heroes, { forcedHeroIds: ['tidecaller'], scaling: { level: 25, mastery }, progression: progressionTable }).run.roster.find((r) => r.heroId === 'tidecaller')!;
  const mastered = at(MASTERY_SIGNATURE);
  assert.ok(mastered.unlockedMoveIds.includes('lizardRush'), `a Riptide at ten fights with Lizard Rush: ${mastered.unlockedMoveIds}`);
  assert.ok(mastered.unlockedMoveIds.length <= MOVE_CAP);
  assert.ok(mastered.chosenPathIds.length === 1, 'and is evolved');
  assert.ok(!at(MASTERY_SIGNATURE - 1).unlockedMoveIds.includes('lizardRush'));
});

test('signature: Tidecaller grants Maelstrom at the Evolution — off Riptide\'s own pool, as Rime\'s Avalanche grants Snowball — and Lizard Rush is nobody\'s to grant', () => {
  const path = progressionTable.evolutions.tidecaller[0].paths.find((p) => p.id === 'tidecaller-tidecaller')!;
  assert.deepStrictEqual(path.unlocksMoveIds, ['maelstrom']);
  assert.ok(!(progressionTable.moveTiers.tidecaller ?? []).includes('maelstrom'), 'a grant that duplicates the pool pays in timing alone (test/roster.test.ts)');
  assert.ok((progressionTable.moveTiers.tidecaller ?? []).includes('tsunami'), 'the pool keeps its other Late moves');
});
