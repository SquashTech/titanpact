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
import { CYCLES, MAX_BUILT_CYCLE, cycleOf, fallenAfterFight, isPermadeath, openCycle, releaseFallen, smithyPrice } from '../src/run/cycles';
import { actOneLocationFor, generateItinerary, locationForAct, locationPool } from '../src/run/locations';
import { bannerArtId, guardianBannersFor } from '../src/data/relics';
import { TITANS_WARD_ID } from '../src/data/passives';
import { allCombatants } from '../src/data/content';
import { enemies } from '../src/data/enemies';
import { nodeEncounter } from '../src/run/encounters';
import { joinCompanion } from '../src/run/companion';
import { equipItem } from '../src/run/equipment';
import { generateMap } from '../src/run/map';
import { companionStarId, createProfile, decodeProfile, recordRunEnded, starCycleOf } from '../src/run/profile';
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
  assert.strictEqual(openCycle(wonOnTwo), 3, 'a Cycle II clear opens Cycle III');
  assert.strictEqual(openCycle({ cyclesCleared: 99 }), MAX_BUILT_CYCLE, 'never past the Cycles that are built');
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

test('cycles: a star is coloured by the highest Cycle it was earned on, never walked back', () => {
  const pathId = progressionTable.evolutions.valor[0].paths[0].id;
  const end = (cycle: number, outcome: 'win' | 'loss' = 'win') => ({
    outcome,
    actReached: 5,
    locationId: null,
    encountersWon: 12,
    cycle,
    roster: [{ heroId: 'valor', level: 24, evolutionPathId: pathId }],
    companionType: 'Fire',
  });
  const first = recordRunEnded(createProfile(), end(1), 1);
  assert.strictEqual(starCycleOf(first, pathId, true), 1);
  assert.strictEqual(starCycleOf(first, companionStarId('Fire'), true), 1, 'the companion star takes a Cycle the same way');
  const raised = recordRunEnded(first, end(2), 2);
  assert.strictEqual(starCycleOf(raised, pathId, true), 2, 'a clear on a higher Cycle raises it');
  assert.deepStrictEqual(raised.runHistory[0].starsEarned, [], 'a raised star is not a new star');
  assert.strictEqual(raised.bonusStars - first.bonusStars, cycleOf(2).clearBonus, 'raising pays nothing beyond the clear');
  const back = recordRunEnded(raised, end(1), 3);
  assert.strictEqual(starCycleOf(back, pathId, true), 2, 'a lower Cycle never walks it back');
  assert.strictEqual(starCycleOf(recordRunEnded(raised, end(5, 'loss'), 4), pathId, true), 2, 'a loss colours nothing');
  // A star earned before the Cycles has no entry, and reads as Cycle I.
  const legacy = decodeProfile(JSON.parse(JSON.stringify({ ...first, starCycles: undefined })));
  assert.strictEqual(starCycleOf(legacy, pathId, true), 1);
  assert.strictEqual(starCycleOf(legacy, 'nobody-path', false), 0, 'an unearned star has no colour');
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(raised))).starCycles, raised.starCycles);
});

test('cycles: the Long Winter loses Wild’s Edge, frays the Banners and prices the Smithy half again', () => {
  assert.ok(locationPool(2).includes('wildsEdge'));
  assert.ok(!locationPool(3).includes('wildsEdge'), 'Wild’s Edge is lost from Cycle III');
  assert.strictEqual(actOneLocationFor(2), 'wildsEdge');
  assert.strictEqual(actOneLocationFor(3), 'frozenReach', 'the Long Winter opens in the snow');
  assert.strictEqual(actOneLocationFor(5), 'frozenReach', 'and keeps opening there');
  assert.ok(locationPool(3).includes('frozenReach') && locationPool(3).includes('dreamingSpires'), 'Cycle III grants the Reach and the Spires');
  assert.ok(!locationPool(2).includes('frozenReach'));

  const whole = guardianBannersFor(false);
  const frayed = guardianBannersFor(true);
  assert.deepStrictEqual(frayed.map((r) => r.frayedOf), whole.map((r) => r.id), 'one frayed Banner for each, in order');
  for (const relic of frayed) {
    const original = relics[relic.frayedOf!];
    for (const [stat, amount] of Object.entries(relic.statGrants)) {
      assert.ok(amount! % 5 === 0, `${relic.id} ${stat} is a multiple of 5`);
      assert.ok(amount! <= original.statGrants[stat as keyof typeof original.statGrants]!, `${relic.id} ${stat} is no more than the whole Banner's`);
    }
    assert.strictEqual(bannerArtId(relic.id), relic.frayedOf, 'a frayed Banner wears its original’s art');
  }

  assert.strictEqual(smithyPrice({ cycle: 2 }, 45), 45);
  assert.strictEqual(smithyPrice({ cycle: 3 }, 45), 70, '×1.5, rounded to 5 gold');
  assert.strictEqual(smithyPrice({ cycle: 3 }, 20), 30);
});

test('cycles: a Long Winter wards the Guardian while its company stands', () => {
  for (const act of [1, 2, 3, 4]) {
    let run = createRunState(50, 1, 3);
    for (const id of ['packAlpha', 'crimson']) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
    run = { ...run, map: generateMap(31, act), locationIds: generateItinerary(31), actNumber: act, fightsStarted: 2, encountersWon: 4 };
    const location = locationForAct(run.locationIds, act);
    const boss = Object.values(run.map!.nodes).find((n) => n.type === 'boss')!;
    const ctx = { run, location, heroes, allCombatants, enemies, progression: progressionTable };
    const champion = (cycle: number) => nodeEncounter(boss, { ...ctx, run: { ...run, cycle } }).run.roster.find((r) => r.rosterId === location.guardianFinalEnemyId)!;
    assert.ok(champion(3).bonusPassiveGrants.includes(TITANS_WARD_ID), `act ${act}: warded in Cycle III`);
    assert.ok(!champion(2).bonusPassiveGrants.includes(TITANS_WARD_ID), `act ${act}: not before it`);
  }
  assert.ok(passives[TITANS_WARD_ID].wardedWhileCompanyStands);
});
