// The Cycles (src/run/cycles.ts, docs/cycles.md): Cycle II is Permadeath, the Revive the one way
// back at the Fallen beat. The companion is off the roster and cannot fall.

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
import { CYCLES, MAX_BUILT_CYCLE, cycleOf, fallenAfterFight, isPermadeath, openCycle, releaseFallen } from '../src/run/cycles';
import { joinCompanion } from '../src/run/companion';
import { equipItem } from '../src/run/equipment';
import { generateMap } from '../src/run/map';
import { createProfile, decodeProfile, recordRunEnded } from '../src/run/profile';
import { buildContentIndex, decodeSave, encodeSave } from '../src/run/save';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { reviveHero } from '../src/run/wounds';

function run(cycle: number): RunState {
  let next = createRunState(50, 1, cycle);
  for (const id of ['valor', 'packAlpha', 'rime']) next = addRosterEntry(next, createRosterEntry(id, id, heroes[id].moveIds));
  next = joinCompanion({ ...next, fightsStarted: 1 }, 'cubling');
  return next;
}

/** A fight's aftermath: the KO'd are `down` (run/wounds.ts recordWounds) before anything reads them. */
function knockedOut(state: RunState, rosterIds: readonly string[]): RunState {
  return { ...state, roster: state.roster.map((r) => (rosterIds.includes(r.rosterId) ? { ...r, down: true } : r)) };
}

test('cycles: Cycle I is the base game, Cycle II is Permadeath, and only the first five exist', () => {
  assert.strictEqual(isPermadeath(createRunState()), false);
  assert.strictEqual(createRunState().cycle, 1);
  assert.strictEqual(isPermadeath(run(2)), true);
  assert.deepStrictEqual(CYCLES.map((c) => c.cycle), [1, 2, 3, 4, 5]);
  for (const c of CYCLES) {
    const built = c.cycle <= MAX_BUILT_CYCLE;
    assert.strictEqual(c.line.length > 0, built, `Cycle ${c.numeral}: a line exactly when it has rules`);
    assert.ok(!built || c.clearBonus > 0, `Cycle ${c.numeral}: a built Cycle pays a clear`);
  }
  assert.strictEqual(cycleOf(99).cycle, 1, 'an unknown Cycle reads as Cycle I');
});

test('cycles: the Fallen are the knocked-out heroes, in roster order, and none in Cycle I', () => {
  const base = knockedOut(run(1), ['valor']);
  assert.deepStrictEqual(fallenAfterFight(base, ['valor']), [], 'Cycle I: a KO stands back up later');

  const a1 = knockedOut(run(2), ['valor', 'rime']);
  assert.deepStrictEqual(fallenAfterFight(a1, ['valor', 'rime']).map((r) => r.rosterId), ['valor', 'rime']);
  assert.ok(a1.companion, 'the companion travels on, off the roster');
});

test('cycles: a Revive keeps a fallen hero at half; letting go takes it and its gear off the run', () => {
  let a1 = run(2);
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

test('cycles: a Cycle opens on a clear of the one before, and a clear records the Cycle it was on', () => {
  const fresh = createProfile();
  assert.strictEqual(openCycle(fresh), 1, 'Cycle I until something is cleared');
  const end = (cycle: number, outcome: 'win' | 'loss') => ({ outcome, actReached: 6, locationId: null, encountersWon: 16, cycle, roster: [] });
  const firstCleared = recordRunEnded(fresh, end(1, 'win'), 1);
  assert.strictEqual(firstCleared.cyclesCleared, 1);
  assert.strictEqual(openCycle(firstCleared), 2, 'a Cycle I clear opens Cycle II');
  const lostOnTwo = recordRunEnded(firstCleared, end(2, 'loss'), 2);
  assert.strictEqual(lostOnTwo.cyclesCleared, 1, 'a loss clears nothing');
  const wonOnTwo = recordRunEnded(firstCleared, end(2, 'win'), 3);
  assert.strictEqual(wonOnTwo.cyclesCleared, 2);
  assert.strictEqual(openCycle(wonOnTwo), MAX_BUILT_CYCLE, 'never past the Cycles that are built');
  assert.strictEqual(wonOnTwo.runHistory[0].cycle, 2, 'the history line knows the Cycle');
});

test('cycles: a profile from before the Cycles reads its Ascension rungs one Cycle up', () => {
  const won = recordRunEnded(createProfile(), { outcome: 'win', actReached: 6, locationId: null, encountersWon: 16, cycle: 2, roster: [] }, 1);
  const legacy = (fields: Record<string, unknown>) => {
    const raw = JSON.parse(JSON.stringify(won));
    delete raw.cyclesCleared;
    delete raw.runHistory[0].cycle;
    return decodeProfile({ ...raw, ...fields, runHistory: [{ ...raw.runHistory[0], ascension: 1 }] });
  };
  assert.strictEqual(legacy({ ascensionCleared: 1 }).cyclesCleared, 2, 'an A1 clear is a Cycle II clear');
  assert.strictEqual(legacy({ ascensionCleared: 0 }).cyclesCleared, 1, 'a Base clear is a Cycle I clear');
  assert.strictEqual(legacy({ ascensionCleared: 0, runsCompleted: 0 }).cyclesCleared, 0, 'nothing cleared is nothing cleared');
  assert.strictEqual(legacy({}).runHistory[0].cycle, 2, 'an A1 history line is Cycle II');
});

test('cycles: the Cycle survives a save, and a file from before the Cycles reads its rung one up', () => {
  const index = buildContentIndex({ heroes: rosterHeroes, moves, equipment, relics, passives, classes, locations, championIds: CHAMPION_IDS, types: TYPES, progression: progressionTable });
  const state: RunState = { ...run(2), map: generateMap(77, 1) };
  const raw = JSON.parse(JSON.stringify(encodeSave(state, 'map')));
  const result = decodeSave(raw, index);
  assert.ok(result.ok, result.ok ? '' : result.reason);
  assert.strictEqual(result.save.run.cycle, 2);
  delete raw.run.cycle;
  const before = (ascension: unknown) => decodeSave({ ...raw, run: { ...raw.run, ascension } }, index);
  const a1 = before(1);
  assert.ok(a1.ok && a1.save.run.cycle === 2, 'an A1 run is Cycle II');
  const ladderless = before(undefined);
  assert.ok(ladderless.ok && ladderless.save.run.cycle === 1, 'a file from before the ladder is Cycle I');
  assert.ok(!before(-1).ok, 'a rung below Base is not a Cycle');
  assert.ok(!decodeSave({ ...raw, run: { ...raw.run, cycle: 0 } }, index).ok, 'Cycle 0 is not a Cycle');
});
