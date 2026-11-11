import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { TYPES } from '../src/data/typechart';
import type { TypeId } from '../src/engine/content';
import { createRng, nextFloat, type RngState } from '../src/engine/rng/seededRng';
import { MOVE_CAP, scheduleEntriesBelow } from '../src/run/progression';
import { MASTERY_EVOLUTION, recruitMastery } from '../src/run/mastery';
import { levelAfterEncounters, levelOf } from '../src/run/growth';
import { createRunState, createRosterEntry, addRosterEntry, replaceRosterEntry, terminateRosterEntry, type RunState } from '../src/run/state';
import { deckRowOf, defaultDeck, deckHeroIds } from '../src/run/deck';
import { GATHERING_FROM_CYCLE } from '../src/run/cycles';
import { generateMap, REWARD_WEIGHTS, MAP_NODE_TYPES } from '../src/run/map';
import { RECRUIT_TYPE_COUNT, recruitNodeEntry, recruitTypeOffers, recruitableOfType, rollRecruitHero } from '../src/run/recruitNode';
import { isRecruitable, freshRosterId } from '../src/run/recruitment';

function seeded(seed: number): () => number {
  let state: RngState = createRng(seed);
  return () => {
    const { value, nextState } = nextFloat(state);
    state = nextState;
    return value;
  };
}

function seedRoster(heroIds: string[], deck: readonly string[] | null = deckHeroIds(defaultDeck(heroes))): RunState {
  let run: RunState = { ...createRunState(0), deck };
  for (const heroId of heroIds) run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  return run;
}

// --- The offer ---

test('recruit: the node offers three distinct types in chart order, each with somebody left to answer it', () => {
  const run = seedRoster(['cinderKnight', 'ironWarden']);
  for (let seed = 1; seed <= 40; seed++) {
    const offered = recruitTypeOffers(run, heroes, [], seeded(seed));
    assert.strictEqual(offered.length, RECRUIT_TYPE_COUNT);
    assert.strictEqual(new Set(offered).size, offered.length);
    assert.deepStrictEqual(offered, TYPES.filter((type) => offered.includes(type)), 'chart order');
    for (const type of offered) assert.ok(recruitableOfType(run, heroes, type).length > 0, `${type} has nobody`);
  }
});

test('recruit: one of the three is a type of the act\'s Location whenever one has a hero left', () => {
  const run = seedRoster(['cinderKnight']);
  const local: TypeId[] = ['Frost', 'Iron'];
  for (let seed = 1; seed <= 40; seed++) {
    const offered = recruitTypeOffers(run, heroes, local, seeded(seed));
    assert.ok(offered.some((type) => local.includes(type)), `seed ${seed}: ${offered.join(', ')}`);
  }
});

test('recruit: a Gathering offers one more type', () => {
  const run = { ...seedRoster(['cinderKnight']), cycle: GATHERING_FROM_CYCLE };
  assert.strictEqual(recruitTypeOffers(run, heroes, [], seeded(3)).length, RECRUIT_TYPE_COUNT + 1);
});

test('recruit: the roll is a deck hero of the picked type, never one on the roster or one that left it', () => {
  const deck = deckHeroIds(defaultDeck(heroes));
  const fire = deck.filter((id) => deckRowOf(heroes[id]) === 'Fire');
  assert.ok(fire.length >= 2, 'the default deck holds two Fire heroes');
  let run = seedRoster([fire[0]]);
  for (let seed = 1; seed <= 20; seed++) {
    const heroId = rollRecruitHero(run, heroes, 'Fire', seeded(seed));
    assert.ok(heroId && deck.includes(heroId) && deckRowOf(heroes[heroId]) === 'Fire' && heroId !== fire[0]);
  }
  // Both gone — one held, one dismissed — and Fire has nobody left to offer.
  run = addRosterEntry(run, createRosterEntry('placeholder', 'valor', heroes.valor.moveIds));
  run = replaceRosterEntry(run, 'placeholder', createRosterEntry(fire[1], fire[1], heroes[fire[1]].moveIds));
  run = terminateRosterEntry(run, fire[1]);
  assert.deepStrictEqual(run.departedHeroIds, ['valor', fire[1]]);
  const left = fire.filter((id) => id !== fire[0] && id !== fire[1]);
  assert.deepStrictEqual(recruitableOfType(run, heroes, 'Fire'), left);
  if (left.length === 0) assert.ok(!recruitTypeOffers(run, heroes, ['Fire'], seeded(1)).includes('Fire'), 'a type with nobody left is never offered');
});

test('recruit: a run saved before decks rolls from the catalog whole', () => {
  const run = seedRoster([], null);
  assert.ok(recruitableOfType(run, heroes, 'Fire').length >= deckHeroIds(defaultDeck(heroes)).filter((id) => deckRowOf(heroes[id]) === 'Fire').length);
});

// --- The arrival: raw, at par, scaled by act ---

test('recruit: arrives at the player\'s par with the act\'s pips, unevolved, its kit filled only by what needed no decision', () => {
  for (const act of [1, 2, 3, 4]) {
    const run = { ...seedRoster(['cinderKnight']), actNumber: act, encountersWon: (act - 1) * 3 + 1 };
    const entry = recruitNodeEntry(run, heroes.ironWarden, 'ironWarden', seeded(act));
    const level = levelAfterEncounters(run.encountersWon);
    assert.strictEqual(levelOf(entry), level, `act ${act}: at par`);
    assert.strictEqual(entry.mastery, recruitMastery(act), `act ${act}: the act's pips`);
    assert.deepStrictEqual(entry.chosenPathIds, [], `act ${act}: never arrives evolved`);
    const starting = heroes.ironWarden.moveIds.length;
    const receipts = Math.min(scheduleEntriesBelow(heroes.ironWarden, level), MOVE_CAP - starting);
    assert.strictEqual(entry.scheduleTaken, receipts, `act ${act}: the receipts taken, the questions still owed`);
    assert.strictEqual(entry.unlockedMoveIds.length, starting + receipts, `act ${act}`);
  }
  assert.deepStrictEqual([1, 2, 3, 4].map(recruitMastery), [0, 1, 3, 5]);
  assert.ok(recruitMastery(4) >= MASTERY_EVOLUTION, 'an Act 4 recruit has the pips to evolve, and the path is the player\'s');
});

test('recruit: raw is unbuilt, not hollow — a recruit carries the growth its levels earned', () => {
  const run = { ...seedRoster(['cinderKnight']), actNumber: 3, encountersWon: 7 };
  const entry = recruitNodeEntry(run, heroes.ironWarden, 'ironWarden', seeded(9));
  const gained = Object.values(entry.growthStatGrants).reduce<number>((sum, n) => sum + (n ?? 0), 0);
  assert.ok(gained > (levelOf(entry) - 1) * 4, `${gained} points over ${levelOf(entry) - 1} levels is too thin to be a real roll`);
});

test('recruit: the same seed meets the same hero at the same build', () => {
  const run = { ...seedRoster(['cinderKnight']), actNumber: 3, encountersWon: 7 };
  assert.deepStrictEqual(recruitNodeEntry(run, heroes.ironWarden, 'x', seeded(5)), recruitNodeEntry(run, heroes.ironWarden, 'x', seeded(5)));
  assert.strictEqual(rollRecruitHero(run, heroes, 'Water', seeded(5)), rollRecruitHero(run, heroes, 'Water', seeded(5)));
});

// --- The map ---

test('recruit: Act 1\'s first reward row always holds a Recruit; the Contract node is gone', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const map = generateMap(seed, 1);
    assert.ok(map.rows[1].some((id) => map.nodes[id].type === 'recruitReward'), `seed ${seed}`);
    assert.strictEqual(new Set(map.rows[1].map((id) => map.nodes[id].type)).size, map.rows[1].length, 'a reward row never repeats');
    for (const id of map.rows[1]) assert.ok(map.nodes[map.startNodeIds[0]].nextIds.includes(id), 'every path meets it');
  }
  assert.ok(REWARD_WEIGHTS.some(([type]) => type === 'recruitReward'));
  assert.ok(!(MAP_NODE_TYPES as readonly string[]).includes('contractReward'));
});

// --- Ids and pools ---

test('recruitment: freshRosterId returns the heroId itself when unclaimed, else disambiguates', () => {
  const run = seedRoster(['cinderKnight']);
  assert.strictEqual(freshRosterId(run, 'ironWarden'), 'ironWarden');
  assert.strictEqual(freshRosterId(run, 'cinderKnight'), 'cinderKnight-2');
});

test('recruitment: isRecruitable accepts a heroId from the recruitable pool and rejects one that is not in it', () => {
  assert.strictEqual(isRecruitable('cinderKnight', heroes), true);
  assert.strictEqual(isRecruitable('cubling', heroes), false);
});

test('recruitment: the enemy pool shares no ids with the recruitable hero pool', () => {
  const overlap = Object.keys(enemies).filter((id) => id in heroes);
  assert.deepStrictEqual(overlap, []);
});
