// The companion (src/run/companion.ts, docs/titanspawn-overhaul.md §5): joins after the first
// fight and cannot be declined, is a hero in every respect but one, and that one is `mortal`.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { rosterHeroes } from '../src/data/content';
import { equipment } from '../src/data/equipment';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { spawnPosition, spawnSlate, titanspawn } from '../src/data/titanspawn';
import { locations } from '../src/data/locations';
import { generateMap } from '../src/run/map';
import {
  absorbCompanions,
  applyCompanionTierStep,
  companionCandidate,
  companionJoinDue,
  companionOf,
  companionTierStep,
  joinCompanion,
} from '../src/run/companion';
import { mobEncounter } from '../src/run/spawn';
import { actScaling } from '../src/run/difficulty';
import { DEFAULT_SCHEDULE, entryBandRank, levelMovePool, scheduleEntries, scheduleFor } from '../src/run/progression';
import { ROSTER_CAP, addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { equipItem } from '../src/run/equipment';
import { isRecruitable } from '../src/run/recruitment';
import { nodeEncounter } from '../src/run/encounters';
import { decodeSave, encodeSave, buildContentIndex } from '../src/run/save';
import { classes } from '../src/data/classes';
import { relics } from '../src/data/relics';
import { passives } from '../src/data/passives';
import { CHAMPION_IDS } from '../src/data/enemies';
import { TYPES } from '../src/data/typechart';
import { levelOf, xpForLevel, MAX_XP } from '../src/run/growth';

function starterRun(level = 3): RunState {
  let run = createRunState(50);
  for (const id of ['valor', 'packAlpha']) run = addRosterEntry(run, { ...createRosterEntry(id, id, heroes[id].moveIds), xp: xpForLevel(level) });
  return { ...run, fightsStarted: 1 };
}

test('companion: the join is due exactly once — the first fight, won, nothing joined yet', () => {
  const run = starterRun();
  assert.ok(companionJoinDue(run, 'fight'));
  assert.ok(!companionJoinDue(run, 'skirmish'));
  assert.ok(!companionJoinDue({ ...run, fightsStarted: 2 }, 'fight'));
  assert.ok(!companionJoinDue({ ...run, companionHeroId: 'cubling' }, 'fight'), 'one per run, and a dead one is still the one');
});

test('companion: the candidate is the beaten side\'s lead Early, and the Act 1 opener always has one', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const encounter = mobEncounter('fight', locations.wildsEdge, 1, seed, actScaling('monsters', 1));
    const id = companionCandidate(encounter);
    assert.ok(id && spawnPosition(id)?.tier === 'early', `seed ${seed}: no Early asked`);
    assert.strictEqual(id, encounter.run.roster.find((r) => r.rosterId === encounter.squad.activeIds[0])!.heroId);
  }
});

test('companion: it joins at the roster\'s par with its growth rolled, mortal, in its authored kit, and is never a contract', () => {
  const run = starterRun(3);
  const next = joinCompanion(run, 'cubling', rosterHeroes, () => 0.99);
  const companion = companionOf(next)!;
  assert.strictEqual(next.roster.length, 3);
  assert.strictEqual(companion.heroId, 'cubling');
  assert.strictEqual(companion.mortal, true);
  assert.strictEqual(levelOf(companion), 3);
  assert.ok(Object.keys(companion.growthStatGrants).length > 0, 'two levels of growth rolled — RAW is unbuilt, not hollow');
  assert.deepStrictEqual(companion.unlockedMoveIds, [...titanspawn.cubling.moveIds]);
  assert.strictEqual(next.companionHeroId, 'cubling');
  assert.ok(!isRecruitable('cubling', heroes));
  assert.throws(() => joinCompanion(run, 'valor', rosterHeroes), 'a hero cannot be the companion');
  for (const entry of run.roster) assert.strictEqual(entry.mortal, false);
});

test('companion: a knockout takes it — off the roster, its items to the bag; a KO\'d hero stays', () => {
  let run = joinCompanion(starterRun(), 'cubling', rosterHeroes);
  const companion = companionOf(run)!;
  run = { ...run, roster: run.roster.map((r) => (r === companion ? { ...r, equipment: equipItem(r.equipment, 'dagger.common') } : r)) };
  const { run: after, absorbed } = absorbCompanions(run, [companion.rosterId, 'valor'], equipment);
  assert.deepStrictEqual(absorbed.map((r) => r.heroId), ['cubling']);
  assert.strictEqual(companionOf(after), null);
  assert.ok(after.roster.some((r) => r.rosterId === 'valor'), 'a hero KO is not a death');
  assert.ok(after.stash.includes('dagger.common'), 'the unit is the price, the item is not');
  assert.strictEqual(after.companionHeroId, 'cubling', 'the run remembers it had one');
  const untouched = absorbCompanions(run, ['valor'], equipment);
  assert.strictEqual(untouched.run, run);
});

test('companion: the tier-steps sit on the schedule\'s Evolution level and its Late level, and everything carries', () => {
  // A mortal entry's schedule carries a `step` where a branch would be and where Late opens
  // (progression.ts scheduleEntries); the steps are taken in order like any entry.
  const schedule = scheduleFor(rosterHeroes.cubling);
  const entries = scheduleEntries(schedule, true);
  assert.deepStrictEqual(
    entries.filter((e) => e.kind === 'step').map((e) => e.level),
    [schedule.evolutionLevel, schedule.lateLevel]
  );
  assert.ok(entries.every((e) => e.kind !== 'evolution'), 'a companion has no branch');
  let run = joinCompanion(starterRun(), 'cubling', rosterHeroes);
  const id = companionOf(run)!.rosterId;
  const stepIndex = entries.findIndex((e) => e.kind === 'step');
  const at = (level: number, taken: number) => ({ ...run, roster: run.roster.map((r) => (r.rosterId === id ? { ...r, xp: xpForLevel(level), scheduleTaken: taken, unlockedMoveIds: ['claw', 'venomBite', 'prowl', 'lacerate'], equipment: ['dagger.common'] } : r)) });
  const hero = rosterHeroes.cubling;
  assert.strictEqual(companionTierStep(hero, companionOf(at(schedule.evolutionLevel - 1, stepIndex))!), null, 'not before the level');
  assert.strictEqual(companionTierStep(hero, companionOf(at(schedule.evolutionLevel, stepIndex - 1))!), null, 'not before the entries ahead of it are taken');
  assert.strictEqual(companionTierStep(hero, companionOf(at(schedule.evolutionLevel, stepIndex))!), 'ravager');
  const mid = applyCompanionTierStep(at(schedule.evolutionLevel, stepIndex), id, rosterHeroes);
  const grown = companionOf(mid)!;
  assert.strictEqual(grown.heroId, 'ravager');
  assert.deepStrictEqual(grown.unlockedMoveIds, ['claw', 'venomBite', 'prowl', 'lacerate']);
  assert.deepStrictEqual(grown.equipment, ['dagger.common']);
  assert.strictEqual(grown.scheduleTaken, stepIndex + 1, 'the step is taken');
  assert.strictEqual(companionTierStep(rosterHeroes.ravager, grown), null, 'one step per entry');
  const lateIndex = entries.findIndex((e) => e.kind === 'step' && e.level === schedule.lateLevel);
  const lateReady = { ...grown, xp: xpForLevel(schedule.lateLevel), scheduleTaken: lateIndex };
  assert.strictEqual(companionTierStep(rosterHeroes.ravager, lateReady), 'behemoth');
  assert.strictEqual(companionTierStep(rosterHeroes.behemoth, { ...lateReady, heroId: 'behemoth' }), null, 'the Late is the end of the line');
  // A hero at the same level is not stepped: the flag is what the rule reads.
  assert.strictEqual(companionTierStep(rosterHeroes.valor, { ...run.roster[0], xp: xpForLevel(schedule.evolutionLevel), scheduleTaken: stepIndex }), null);
});

test('companion: its level-up pool is its type\'s slate, gated by band like anyone\'s', () => {
  const run = joinCompanion(starterRun(), 'cubling', rosterHeroes);
  const entry = companionOf(run)!;
  const hero = rosterHeroes.cubling;
  assert.deepStrictEqual([...progressionTable.moveTiers.cubling].sort(), spawnSlate('Beast').sort());
  const early = levelMovePool(progressionTable, moves, hero, entry);
  assert.ok(early.length > 0 && early.every((id: string) => moves[id].tier === 'early'), 'below midLevel offers Early only');
  assert.ok(!early.includes('claw'), 'the kit is filtered out');
  const mid = { ...entry, xp: xpForLevel(DEFAULT_SCHEDULE.midLevel) };
  assert.strictEqual(entryBandRank(hero, mid), 2);
  assert.ok(levelMovePool(progressionTable, moves, hero, mid).some((id: string) => moves[id].tier === 'mid'));
  void MAX_XP;
});

test('companion: the flag and the run\'s memory of it survive a save', () => {
  const run = { ...joinCompanion(starterRun(), 'cubling', rosterHeroes), map: generateMap(3), locationIds: Object.keys(locations).slice(0, 5) };
  const index = buildContentIndex({ heroes: rosterHeroes, moves, equipment, relics, passives, classes, locations, championIds: CHAMPION_IDS, types: TYPES, progression: progressionTable });
  const saved = JSON.parse(JSON.stringify(encodeSave(run, 'map')));
  const loaded = decodeSave(saved, index);
  assert.ok(loaded.ok, loaded.ok ? '' : loaded.reason);
  if (!loaded.ok) return;
  const companion = companionOf(loaded.save.run)!;
  assert.strictEqual(companion.heroId, 'cubling');
  assert.strictEqual(companion.mortal, true);
  assert.strictEqual(loaded.save.run.companionHeroId, 'cubling');
});

test('companion: it presses on the cap like anyone — a full roster refuses the join', () => {
  let run = starterRun();
  for (const id of ['crimson', 'tidecaller', 'rime', 'crag']) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  assert.strictEqual(run.roster.length, ROSTER_CAP);
  assert.ok(!companionJoinDue(run, 'fight'));
  assert.throws(() => joinCompanion(run, 'cubling', rosterHeroes));
});

test('companion: it does not count toward Act 1\'s enemy-count cap — the Skirmish is 3v2 with it on the roster', () => {
  // Per user direction (2026-09-13): the companion is half a hero and must not invite a whole enemy.
  let run = joinCompanion({ ...starterRun(), map: generateMap(5, 1), locationIds: Object.keys(locations).slice(0, 5), actNumber: 1, fightsStarted: 2 }, 'cubling', rosterHeroes);
  // fightsStarted 2: past the run's 2v2 breather, so the count is the cap's and nothing else's.
  assert.strictEqual(run.roster.length, 3);
  const skirmish = Object.values(run.map!.nodes).find((n) => n.type === 'skirmish')!;
  const ctx = { run, location: locations.wildsEdge, heroes, allCombatants: rosterHeroes, enemies: {}, progression: progressionTable };
  assert.strictEqual(nodeEncounter(skirmish, ctx).run.roster.length, 2, 'two enemies against two heroes and a companion');
  // A real third hero does raise it.
  run = addRosterEntry(run, createRosterEntry('crimson', 'crimson', heroes.crimson.moveIds));
  assert.strictEqual(nodeEncounter(skirmish, { ...ctx, run }).run.roster.length, 3);
});
