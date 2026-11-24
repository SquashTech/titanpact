// The Library (docs/worlds.md §2.1): a new run reads every hero, the draft draws one a type row, and
// a run saved with a deck snapshot (docs/collection.md) keeps reading it, strangers and all.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { allCombatants } from '../src/data/content';
import { progressionTable } from '../src/data/progression';
import { TYPES } from '../src/data/typechart';
import { createProfile, decodeProfile } from '../src/run/profile';
import { generateStarterOptions, STARTER_OPTION_COUNT } from '../src/run/draft';
import { isRecruitable } from '../src/run/recruitment';
import { generateMap } from '../src/run/map';
import { generateItinerary, locationForAct } from '../src/run/locations';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { nodeEncounter } from '../src/run/encounters';
import { generateEncounter } from '../src/run/enemyGen';
import { draftableTypes, encounterPools, libraryRows, lookupOf } from '../src/run/deck';

test('deck: the Library is every hero, a row a draftable type', () => {
  const rows = libraryRows(heroes);
  assert.deepStrictEqual(draftableTypes(heroes).sort(), TYPES.filter((t) => t !== 'Ancient').sort());
  assert.strictEqual(rows.length, draftableTypes(heroes).length);
  for (const row of rows) assert.strictEqual(new Set(row.map((id) => heroes[id].types[0])).size, 1, 'a row is one type');
  assert.deepStrictEqual(rows.flat().sort(), Object.keys(heroes).sort(), 'the Library is every hero');
});

test('deck: the draft draws one hero a Library row, four rows shown, and every hero can be drawn', () => {
  const rows = libraryRows(heroes);
  const seen = new Set<string>();
  for (let seed = 1; seed <= 400; seed++) {
    const options = generateStarterOptions(seed, rows);
    assert.strictEqual(options.length, STARTER_OPTION_COUNT);
    const types = options.map((id) => heroes[id].types[0]);
    assert.strictEqual(new Set(types).size, STARTER_OPTION_COUNT, `seed ${seed} offers two of a type`);
    for (const id of options) seen.add(id);
  }
  assert.deepStrictEqual([...seen].sort(), rows.flat().sort(), 'no hero is kept out of the draft');
});

test('deck: a profile keeps no deck, and an old file holding one decodes without it', () => {
  assert.ok(!('deck' in createProfile()));
  assert.ok(!('deck' in decodeProfile({ deck: { Fire: ['crimson'] } })));
});

function deckRun(seed: number, act: number, deck: readonly string[] | null): RunState {
  let run = createRunState();
  for (const id of ['valor', 'packAlpha', 'crimson', 'tidecaller']) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  return { ...run, map: generateMap(seed, act), locationIds: generateItinerary(seed), actNumber: act, fightsStarted: 2, encountersWon: 4, deck };
}

test('deck: a run saved with a deck draws deck and strangers together, never a roster hero, and the preview agrees', () => {
  const thin = libraryRows(heroes).map((row) => row[0]);
  let strangersSeen = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const run = deckRun(seed, 2 + (seed % 4), thin);
    const pools = encounterPools(run, heroes);
    const ctx = { run, location: locationForAct(run.locationIds, run.actNumber), ...pools, allCombatants, enemies, progression: progressionTable };
    for (const node of Object.values(run.map!.nodes).filter((n) => n.type === 'skirmish' || n.type === 'elite')) {
      const encounter = nodeEncounter(node, ctx);
      const ids = encounter.run.roster.map((r) => r.heroId);
      const decked = ids.filter((id) => isRecruitable(id, pools.heroes));
      strangersSeen += ids.length - decked.length;
      for (const id of ids) assert.ok(!run.roster.some((r) => r.heroId === id), `${id} is on the roster`);
      assert.deepStrictEqual(nodeEncounter(node, ctx).run.roster, encounter.run.roster, 'the draw is deterministic');
    }
  }
  assert.ok(strangersSeen > 0, 'a thin deck meets strangers');
});

test('deck: a run with no deck reads its fallback whole and fields no strangers', () => {
  const run = deckRun(7, 3, null);
  const pools = encounterPools(run, heroes, heroes);
  assert.strictEqual(pools.heroes, heroes);
  assert.strictEqual(pools.strangers, undefined);
  // And a draw handed an empty stranger table is the plain draw, seed for seed.
  const plain = generateEncounter('fight', 99, heroes, { heroCount: 4 });
  const withNone = generateEncounter('fight', 99, heroes, { heroCount: 4, strangers: {} });
  assert.deepStrictEqual(withNone.run.roster, plain.run.roster);
  assert.deepStrictEqual(lookupOf(heroes, ['valor', 'nobody']), { valor: heroes.valor });
});
