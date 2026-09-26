// The Deck (docs/collection.md): the default is the base roster, edits stay legal against what is
// owned, the draft draws one hero a row, and a recruitable fight always fields two deck heroes.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { allCombatants } from '../src/data/content';
import { progressionTable } from '../src/data/progression';
import { TYPES } from '../src/data/typechart';
import { createProfile, decodeProfile } from '../src/run/profile';
import { generateStarterOptions, STARTER_OPTION_COUNT } from '../src/run/draft';
import { heroPool, isRecruitable } from '../src/run/recruitment';
import { generateMap } from '../src/run/map';
import { generateItinerary, locationForAct } from '../src/run/locations';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { nodeEncounter } from '../src/run/encounters';
import { generateEncounter } from '../src/run/enemyGen';
import {
  DECK_HEROES_PER_FIGHT,
  DECK_ROW_SIZE,
  DeckError,
  defaultDeck,
  deckHeroIds,
  deckRows,
  draftableTypes,
  encounterPools,
  lookupOf,
  normalizeDeck,
  profileDeck,
  reserveOfType,
  swapIntoDeck,
} from '../src/run/deck';

const FREE_COMPANY = 'bundle.freeCompany';

test('deck: the default is the base roster, three a draftable type', () => {
  const deck = defaultDeck(heroes);
  assert.strictEqual(Object.keys(deck).length, 14);
  assert.deepStrictEqual(draftableTypes(heroes).sort(), TYPES.filter((t) => t !== 'Ancient').sort());
  for (const [type, row] of Object.entries(deck)) {
    assert.strictEqual(row.length, DECK_ROW_SIZE, `${type} holds ${row.length}`);
    for (const id of row) assert.strictEqual(heroes[id].types[0], type);
  }
  assert.deepStrictEqual(deckHeroIds(deck).sort(), Object.keys(heroPool(heroes)).sort(), 'the default deck is the base roster');
});

test('deck: a stored deck is made legal — unknown, unowned, mistyped and repeated ids dropped, short rows topped up', () => {
  const deck = normalizeDeck({ Fire: ['crimson', 'crimson', 'noSuchHero', 'rime', 'drake'], Iron: 'junk' }, heroes, []);
  assert.strictEqual(deck.Fire[0], 'crimson', 'a legal pick is kept');
  assert.strictEqual(deck.Fire.length, DECK_ROW_SIZE);
  assert.ok(!deck.Fire.includes('drake'), 'an unowned bundle hero is not decked');
  assert.ok(!deck.Fire.includes('rime'), 'a Frost hero cannot sit in the Fire row');
  assert.deepStrictEqual(deck.Iron, defaultDeck(heroes).Iron);
  assert.deepStrictEqual(normalizeDeck(null, heroes, []), defaultDeck(heroes));
});

test('deck: an owned hero is traded into its own row only', () => {
  assert.deepStrictEqual(reserveOfType(defaultDeck(heroes), heroes, [], 'Iron'), [], 'the base game has no reserve');
  const owned = normalizeDeck({}, heroes, [FREE_COMPANY]);
  assert.deepStrictEqual(reserveOfType(owned, heroes, [FREE_COMPANY], 'Iron'), ['scallywag']);
  const traded = swapIntoDeck(owned, heroes, [FREE_COMPANY], 'scallywag', owned.Iron[2]);
  assert.ok(traded.Iron.includes('scallywag'));
  assert.throws(() => swapIntoDeck(owned, heroes, [FREE_COMPANY], 'scallywag', owned.Fire[1]), DeckError, 'wrong row');
  assert.throws(() => swapIntoDeck(owned, heroes, [], 'scallywag', owned.Iron[2]), DeckError, 'not owned');
});

test('deck: the profile round-trips it, and a file without one opens on the default', () => {
  const owned = normalizeDeck({}, heroes, [FREE_COMPANY]);
  const edited = { ...createProfile(), purchases: [FREE_COMPANY], deck: { ...swapIntoDeck(owned, heroes, [FREE_COMPANY], 'scallywag', owned.Iron[0]) } as Record<string, string[]> };
  const read = decodeProfile(JSON.parse(JSON.stringify(edited)));
  assert.deepStrictEqual(profileDeck(read, heroes), profileDeck(edited, heroes));
  assert.deepStrictEqual(decodeProfile({}).deck, {});
  assert.deepStrictEqual(profileDeck(decodeProfile({ equippedPackId: 'secondString' }), heroes), defaultDeck(heroes), 'a pack from before decks is dropped');
});

test('deck: the draft draws one hero a row, four rows shown, and every decked hero can be drawn', () => {
  const rows = deckRows(defaultDeck(heroes));
  const seen = new Set<string>();
  for (let seed = 1; seed <= 400; seed++) {
    const options = generateStarterOptions(seed, rows);
    assert.strictEqual(options.length, STARTER_OPTION_COUNT);
    const types = options.map((id) => heroes[id].types[0]);
    assert.strictEqual(new Set(types).size, STARTER_OPTION_COUNT, `seed ${seed} offers two of a type`);
    for (const id of options) seen.add(id);
  }
  assert.deepStrictEqual([...seen].sort(), deckHeroIds(defaultDeck(heroes)).sort(), 'no decked hero is kept out of the draft');
});

function deckRun(seed: number, act: number, deck: readonly string[] | null): RunState {
  let run = createRunState(50);
  for (const id of ['valor', 'packAlpha', 'crimson', 'tidecaller']) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  return { ...run, map: generateMap(seed, act), locationIds: generateItinerary(seed), actNumber: act, fightsStarted: 2, encountersWon: 4, deck };
}

test('deck: a recruitable fight fields at least two deck heroes, strangers past them, and the preview agrees', () => {
  // A thin deck, so strangers have somewhere to come from.
  const deck = defaultDeck(heroes);
  const thin = Object.values(deck).map((row) => row[0]);
  let strangersSeen = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const run = deckRun(seed, 2 + (seed % 4), thin);
    const pools = encounterPools(run, heroes);
    const ctx = { run, location: locationForAct(run.locationIds, run.actNumber), ...pools, allCombatants, enemies, progression: progressionTable };
    for (const node of Object.values(run.map!.nodes).filter((n) => n.type === 'skirmish' || n.type === 'elite')) {
      const encounter = nodeEncounter(node, ctx);
      const ids = encounter.run.roster.map((r) => r.heroId);
      const decked = ids.filter((id) => isRecruitable(id, pools.heroes));
      assert.ok(decked.length >= Math.min(DECK_HEROES_PER_FIGHT, ids.length), `seed ${seed} ${node.id}: ${decked.length} deck heroes in ${ids.join(', ')}`);
      strangersSeen += ids.length - decked.length;
      for (const id of ids) assert.ok(!run.roster.some((r) => r.heroId === id), `${id} is on the roster`);
      assert.deepStrictEqual(nodeEncounter(node, ctx).run.roster, encounter.run.roster, 'the draw is deterministic');
    }
  }
  assert.ok(strangersSeen > 0, 'a thin deck meets strangers');
});

test('deck: a run saved before decks reads its fallback whole and fields no strangers', () => {
  const run = deckRun(7, 3, null);
  const owned = heroPool(heroes);
  const pools = encounterPools(run, heroes, owned);
  assert.strictEqual(pools.heroes, owned);
  assert.strictEqual(pools.strangers, undefined);
  // And a draw handed an empty stranger table is the plain draw, seed for seed.
  const plain = generateEncounter('fight', 99, owned, { heroCount: 4 });
  const withNone = generateEncounter('fight', 99, owned, { heroCount: 4, strangers: {}, deckFloor: DECK_HEROES_PER_FIGHT });
  assert.deepStrictEqual(withNone.run.roster, plain.run.roster);
  assert.deepStrictEqual(lookupOf(heroes, ['valor', 'nobody']), { valor: heroes.valor });
});
