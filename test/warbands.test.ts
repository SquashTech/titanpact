// The Gathering (docs/cycles.md §3, Cycle IV): warbands cast around an engine, and a bigger Tavern board.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { allCombatants } from '../src/data/content';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { spawnPosition } from '../src/data/titanspawn';
import { warbands } from '../src/data/warbands';
import { generateMap } from '../src/run/map';
import { generateItinerary, locationForAct } from '../src/run/locations';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { nodeEncounter, type EncounterContext } from '../src/run/encounters';
import { ELITE_EXTRA_ENEMIES } from '../src/run/difficulty';
import { castHeroWarband, learnableIn, learnableMoves } from '../src/run/warbands';
import { RECRUIT_TYPE_COUNT, recruitTypeOffers } from '../src/run/recruitNode';

function runAt(seed: number, act: number, cycle: number): RunState {
  let run = createRunState(50, cycle);
  for (const id of ['packAlpha', 'crimson']) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  return { ...run, map: generateMap(seed, act), locationIds: generateItinerary(seed), actNumber: act, fightsStarted: 2, encountersWon: 3 * act };
}

function contextFor(run: RunState): EncounterContext {
  return { run, location: locationForAct(run.locationIds, run.actNumber), heroes, allCombatants, enemies, progression: progressionTable };
}

test('warbands: every slot names real moves, and every warband has at least two', () => {
  for (const warband of Object.values(warbands)) {
    assert.ok(warband.slots.length >= 2, `${warband.id} is no engine`);
    for (const slot of warband.slots) {
      assert.ok(slot.moveIds.length > 0, `${warband.id} has an empty slot`);
      for (const id of slot.moveIds) assert.ok(moves[id], `${warband.id}: ${id} is not a move`);
    }
  }
  assert.strictEqual(Object.keys(warbands).length, 12);
});

test('warbands: a cast is seeded, fits the party, and every body can learn what it is handed', () => {
  const learnable = learnableIn(heroes, progressionTable);
  const ids = Object.keys(heroes);
  for (let seed = 1; seed <= 40; seed++) {
    const cast = castHeroWarband(seed, ids, 4, learnable);
    assert.ok(cast, `seed ${seed}: the whole roster casts nothing`);
    assert.deepStrictEqual(castHeroWarband(seed, ids, 4, learnable)?.warband.id, cast!.warband.id, 'the same seed casts the same warband');
    assert.strictEqual(cast!.cast.size, cast!.warband.slots.length);
    for (const [heroId, forced] of cast!.cast) for (const id of forced) assert.ok(learnable(heroId).has(id), `${heroId} cannot learn ${id}`);
    const pair = castHeroWarband(seed, ids, 2, learnable);
    assert.ok(!pair || pair.warband.slots.length <= 2, 'a 2v2 never draws a three-slot engine');
  }
});

test('warbands: a Gathering’s Elite is cast around one from the deck, its moves in the kits; Cycle III is drawn as ever', () => {
  let cast = 0;
  for (let seed = 1; seed <= 12; seed++) {
    for (const act of [2, 3, 4]) {
      const run = runAt(seed, act, 4);
      const elite = Object.values(run.map!.nodes).find((n) => n.type === 'elite')!;
      const gathering = nodeEncounter(elite, contextFor(run));
      assert.strictEqual(gathering.run.roster.length, 4 + ELITE_EXTRA_ENEMIES, 'a warband never shrinks the party');
      const withEngine = Object.values(warbands).some((w) =>
        w.slots.every((slot) => gathering.run.roster.some((r) => slot.moveIds.some((id) => r.unlockedMoveIds.includes(id))))
      );
      if (withEngine) cast++;
      for (const entry of gathering.run.roster) assert.ok(entry.unlockedMoveIds.length <= 4);
    }
  }
  assert.ok(cast >= 30, `only ${cast} of 36 Gathering Elites fielded a whole engine`);
});

test('warbands: a Titanspawn learns its own tier and below, never ahead', () => {
  for (const id of Object.keys(allCombatants)) {
    const position = spawnPosition(id);
    if (position?.tier !== 'early') continue;
    const own = learnableMoves(id, undefined, progressionTable);
    for (const moveId of [...position.line.moveIds.mid, ...position.line.moveIds.late]) {
      assert.ok(!own.has(moveId) || position.line.moveIds.early.includes(moveId), `${id} reaches ${moveId}`);
    }
  }
});

test('warbands: a Gathering’s Guardian fields its escorts as an engine', () => {
  let fitted = 0;
  for (let seed = 1; seed <= 10; seed++) {
    for (const act of [3, 4]) {
      const run = runAt(seed, act, 4);
      const ctx = contextFor(run);
      const boss = Object.values(run.map!.nodes).find((n) => n.type === 'boss')!;
      const escorts = nodeEncounter(boss, ctx).run.roster.filter((r) => spawnPosition(r.heroId));
      const plain = nodeEncounter(boss, { ...ctx, run: { ...run, cycle: 3 } }).run.roster.filter((r) => spawnPosition(r.heroId));
      const changed = escorts.some((e, i) => e.unlockedMoveIds.join() !== plain[i]?.unlockedMoveIds.join());
      if (changed) fitted++;
      for (const escort of escorts) for (const id of escort.unlockedMoveIds) assert.ok(learnableMoves(escort.heroId, undefined, progressionTable).has(id), `${escort.heroId} holds ${id} from past its tier`);
    }
  }
  assert.ok(fitted >= 10, `only ${fitted} of 20 Gathering Guardians fitted a warband`);
});

test('warbands: the Gathering widens the Recruit', () => {
  const base = { ...runAt(1, 2, 3), deck: null };
  const trained = { ...base, cycle: 4 };
  for (let i = 1; i <= 20; i++) {
    const random = () => (i * 0.618) % 1;
    assert.strictEqual(recruitTypeOffers(trained, heroes, [], random).length, RECRUIT_TYPE_COUNT + 1, 'a Gathering Recruit offers four types');
    assert.strictEqual(recruitTypeOffers(base, heroes, [], random).length, RECRUIT_TYPE_COUNT);
  }
});
