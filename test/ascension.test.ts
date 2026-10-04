// The Ascension ladder (src/run/ascension.ts, docs/ascension.md): Ascension 1 is Permadeath,
// the Revive the one way back at the Fallen beat. The companion is off the roster and cannot fall.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { rosterHeroes } from '../src/data/content';
import { equipment } from '../src/data/equipment';
import { moves } from '../src/data/moves';
import { relics } from '../src/data/relics';
import { passives } from '../src/data/passives';
import { classes } from '../src/data/classes';
import { locations } from '../src/data/locations';
import { CHAMPION_IDS } from '../src/data/enemies';
import { TYPES } from '../src/data/typechart';
import { progressionTable } from '../src/data/progression';
import { ASCENSION_RUNGS, MAX_ASCENSION, fallenAfterFight, isPermadeath, openAscension, releaseFallen } from '../src/run/ascension';
import { joinCompanion } from '../src/run/companion';
import { equipItem } from '../src/run/equipment';
import { generateMap } from '../src/run/map';
import { createProfile, decodeProfile, recordRunEnded } from '../src/run/profile';
import { buildContentIndex, decodeSave, encodeSave } from '../src/run/save';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { reviveHero } from '../src/run/wounds';

function run(ascension: number): RunState {
  let next = createRunState(50, 1, ascension);
  for (const id of ['valor', 'packAlpha', 'rime']) next = addRosterEntry(next, createRosterEntry(id, id, heroes[id].moveIds));
  next = joinCompanion({ ...next, fightsStarted: 1 }, 'cubling');
  return next;
}

/** A fight's aftermath: the KO'd are `down` (run/wounds.ts recordWounds) before anything reads them. */
function knockedOut(state: RunState, rosterIds: readonly string[]): RunState {
  return { ...state, roster: state.roster.map((r) => (rosterIds.includes(r.rosterId) ? { ...r, down: true } : r)) };
}

test('ascension: Base is rung 0, Permadeath is rung 1, and the ladder stops where the rules do', () => {
  assert.strictEqual(isPermadeath(createRunState()), false);
  assert.strictEqual(createRunState().ascension, 0);
  assert.strictEqual(isPermadeath(run(1)), true);
  assert.strictEqual(ASCENSION_RUNGS.length, MAX_ASCENSION + 1, 'a rung the picker can offer has a rule to show');
  assert.deepStrictEqual(ASCENSION_RUNGS.map((r) => r.rung), Array.from({ length: MAX_ASCENSION + 1 }, (_, i) => i));
});

test('ascension: the Fallen are the knocked-out heroes, in roster order, and none at Base', () => {
  const base = knockedOut(run(0), ['valor']);
  assert.deepStrictEqual(fallenAfterFight(base, ['valor']), [], 'Base: a KO stands back up later');

  const a1 = knockedOut(run(1), ['valor', 'rime']);
  assert.deepStrictEqual(fallenAfterFight(a1, ['valor', 'rime']).map((r) => r.rosterId), ['valor', 'rime']);
  assert.ok(a1.companion, 'the companion travels on, off the roster');
});

test('ascension: a Revive keeps a fallen hero at half; letting go takes it and its gear off the run', () => {
  let a1 = run(1);
  a1 = { ...a1, roster: a1.roster.map((r) => (r.rosterId === 'valor' ? { ...r, equipment: equipItem(r.equipment, 'dagger.common') } : r)) };
  a1 = knockedOut(a1, ['valor', 'rime']);
  const kept = reviveHero(a1, 'rime', 200);
  const rime = kept.roster.find((r) => r.rosterId === 'rime')!;
  assert.strictEqual(rime.down, false);
  assert.strictEqual(rime.wounds, 100, 'the Revive\'s half');
  // Continue: whoever is still down is let go — the revived stays.
  const stillDown = fallenAfterFight(kept, ['valor', 'rime']).map((r) => r.rosterId);
  assert.deepStrictEqual(stillDown, ['valor']);
  const after = releaseFallen(kept, stillDown);
  assert.deepStrictEqual(after.roster.map((r) => r.rosterId), ['packAlpha', 'rime']);
  assert.ok(!after.roster.some((r) => r.equipment.includes('dagger.common')), 'gear is absorbed, never handed on');
  assert.strictEqual(releaseFallen(after, []), after, 'nothing to release, nothing changes');
});

test('ascension: a rung opens on a clear one below it, and a clear records the rung it was on', () => {
  const fresh = createProfile();
  assert.strictEqual(openAscension(fresh), 0, 'nothing open until something is cleared');
  const end = (ascension: number, outcome: 'win' | 'loss') => ({ outcome, actReached: 6, locationId: null, encountersWon: 16, ascension, roster: [] });
  const baseCleared = recordRunEnded(fresh, end(0, 'win'), 1);
  assert.strictEqual(baseCleared.ascensionCleared, 0);
  assert.strictEqual(openAscension(baseCleared), 1, 'a Base clear opens Ascension 1');
  const lostOnOne = recordRunEnded(baseCleared, end(1, 'loss'), 2);
  assert.strictEqual(lostOnOne.ascensionCleared, 0, 'a loss clears nothing');
  const wonOnOne = recordRunEnded(baseCleared, end(1, 'win'), 3);
  assert.strictEqual(wonOnOne.ascensionCleared, 1);
  assert.strictEqual(openAscension(wonOnOne), MAX_ASCENSION, 'never past the rungs that exist');
  assert.strictEqual(wonOnOne.runHistory[0].ascension, 1, 'the history line knows the rung');
  // A profile written before the ladder decodes to Base with nothing above it cleared.
  const decoded = decodeProfile(JSON.parse(JSON.stringify({ ...wonOnOne, ascensionCleared: undefined })));
  assert.strictEqual(decoded.ascensionCleared, 0);
});

test('ascension: the rung survives a save, and a file written before the ladder loads as Base', () => {
  const index = buildContentIndex({ heroes: rosterHeroes, moves, equipment, relics, passives, classes, locations, championIds: CHAMPION_IDS, types: TYPES, progression: progressionTable });
  const state: RunState = { ...run(1), map: generateMap(77, 1) };
  const raw = JSON.parse(JSON.stringify(encodeSave(state, 'map')));
  const result = decodeSave(raw, index);
  assert.ok(result.ok, result.ok ? '' : result.reason);
  assert.strictEqual(result.save.run.ascension, 1);
  delete raw.run.ascension;
  const old = decodeSave(raw, index);
  assert.ok(old.ok, old.ok ? '' : old.reason);
  assert.strictEqual(old.save.run.ascension, 0);
  raw.run.ascension = -1;
  assert.ok(!decodeSave(raw, index).ok, 'a rung below Base is not a rung');
});
