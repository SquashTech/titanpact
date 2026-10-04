// The companion (src/run/companion.ts, docs/companion-call.md): joins after the first fight and
// cannot be declined, and is a summon, not a party member — off the roster, its tier read off the
// act, seated in every fight as the side's Called caster at the run's par.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { allCombatants, rosterHeroes } from '../src/data/content';
import { equipment } from '../src/data/equipment';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { spawnLineOf, spawnPosition } from '../src/data/titanspawn';
import { locations } from '../src/data/locations';
import { statuses } from '../src/data/statuses';
import { generateMap } from '../src/run/map';
import {
  ANCIENT,
  COMPANION_ROSTER_ID,
  awakenCompanion,
  companionCallFor,
  companionCallMoveId,
  companionCandidate,
  companionGrowth,
  companionHeroId,
  companionJoinDue,
  companionToAwaken,
  joinCompanion,
} from '../src/run/companion';
import { mobEncounter } from '../src/run/spawn';
import { encounterScaling } from '../src/run/difficulty';
import { ROSTER_CAP, addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { isRecruitable } from '../src/run/recruitment';
import { nodeEncounter } from '../src/run/encounters';
import { buildCombatState } from '../src/run/buildCombatState';
import { pickSquad } from '../src/run/squad';
import { decodeSave, encodeSave, buildContentIndex } from '../src/run/save';
import { classes } from '../src/data/classes';
import { relics } from '../src/data/relics';
import { passives } from '../src/data/passives';
import { CHAMPION_IDS } from '../src/data/enemies';
import { TYPES } from '../src/data/typechart';
import { expectedGrowthAt, levelAfterEncounters, levelOf, xpForLevel } from '../src/run/growth';
import { applyForcedReplacement } from '../src/engine/combat/switching';

function starterRun(level = 3): RunState {
  let run = createRunState(50);
  for (const id of ['valor', 'packAlpha']) run = addRosterEntry(run, { ...createRosterEntry(id, id, heroes[id].moveIds), xp: xpForLevel(level) });
  return { ...run, fightsStarted: 1 };
}

const contentIndex = () =>
  buildContentIndex({ heroes: rosterHeroes, moves, equipment, relics, passives, classes, locations, championIds: CHAMPION_IDS, types: TYPES, progression: progressionTable });

test('companion: the join is due exactly once — the first fight, won, nothing joined yet', () => {
  const run = starterRun();
  assert.ok(companionJoinDue(run, 'fight'));
  assert.ok(!companionJoinDue(run, 'skirmish'));
  assert.ok(!companionJoinDue({ ...run, fightsStarted: 2 }, 'fight'));
  assert.ok(!companionJoinDue({ ...run, companion: { type: 'Beast', ascended: false } }, 'fight'), 'one per run');
});

test('companion: the candidate is the beaten side\'s lead Early, and the Act 1 opener always has one', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const encounter = mobEncounter('fight', locations.wildsEdge, 1, seed, encounterScaling('fight', 1));
    const id = companionCandidate(encounter);
    assert.ok(id && spawnPosition(id)?.tier === 'early', `seed ${seed}: no Early asked`);
    assert.strictEqual(id, encounter.run.roster.find((r) => r.rosterId === encounter.squad.activeIds[0])!.heroId);
  }
});

test('companion: it joins as its line, off the roster — no slot, no cap, and never a contract', () => {
  const run = starterRun(3);
  const next = joinCompanion(run, 'cubling');
  assert.deepStrictEqual(next.companion, { type: 'Beast', ascended: false });
  assert.strictEqual(next.roster, run.roster, 'the roster is untouched');
  assert.ok(!isRecruitable('cubling', heroes));
  assert.throws(() => joinCompanion(run, 'valor'), 'a hero cannot be the companion');

  let full = starterRun();
  for (const id of ['crimson', 'tidecaller', 'rime', 'crag']) full = addRosterEntry(full, createRosterEntry(id, id, heroes[id].moveIds));
  assert.strictEqual(full.roster.length, ROSTER_CAP);
  assert.ok(companionJoinDue(full, 'fight'), 'a full roster still takes it — it presses on nothing');
});

test('companion: its body and its Call follow the act, on the escorts\' schedule', () => {
  const line = spawnLineOf('Beast')!;
  const run = joinCompanion(starterRun(), 'cubling');
  const at = (actNumber: number) => ({ ...run, actNumber });
  assert.deepStrictEqual([1, 2, 3, 4, 5].map((act) => companionHeroId(at(act))), ['cubling', 'ravager', 'ravager', 'behemoth', 'behemoth']);
  assert.deepStrictEqual(
    [1, 2, 4].map((act) => companionCallMoveId(at(act))),
    [line.callMoveIds.early, line.callMoveIds.mid, line.callMoveIds.late]
  );
  assert.strictEqual(companionHeroId(starterRun()), null);
});

test('companion: an act boundary that changes the tier is a grown beat, and one that does not is nothing', () => {
  const run = joinCompanion(starterRun(), 'cubling');
  assert.deepStrictEqual(companionGrowth(run, 1, 2), { fromHeroId: 'cubling', toHeroId: 'ravager' });
  assert.strictEqual(companionGrowth(run, 2, 3), null);
  assert.deepStrictEqual(companionGrowth(run, 3, 4), { fromHeroId: 'ravager', toHeroId: 'behemoth' });
  assert.strictEqual(companionGrowth(run, 4, 5), null);
  assert.strictEqual(companionGrowth(starterRun(), 1, 2), null, 'no companion, no beat');
});

test('companion: the Call it brings is the act\'s body at par on the expected line, one Call, nothing the roster carries', () => {
  const run = { ...joinCompanion(starterRun(), 'cubling'), encountersWon: 4, actNumber: 2 };
  const call = companionCallFor(run, allCombatants)!;
  const level = levelAfterEncounters(4);
  assert.strictEqual(call.entry.heroId, 'ravager');
  assert.strictEqual(call.entry.rosterId, COMPANION_ROSTER_ID);
  assert.strictEqual(levelOf(call.entry), level);
  assert.deepStrictEqual(call.entry.growthStatGrants, expectedGrowthAt(allCombatants.ravager, level));
  assert.deepStrictEqual(call.entry.equipment, []);
  assert.strictEqual(call.moveId, spawnLineOf('Beast')!.callMoveIds.mid);
  assert.strictEqual(call.calls, 1);
  assert.strictEqual(call.phaseGrant, 0);
  assert.strictEqual(companionCallFor(starterRun(), allCombatants), null);
});

test('companion: a fight seats it as the side\'s Called caster — on no slot and no bench', () => {
  const run = { ...joinCompanion(starterRun(), 'cubling'), encountersWon: 1 };
  const squad = pickSquad(run.roster, run.roster.map((r) => r.rosterId));
  const state = buildCombatState(1, allCombatants, equipment, [{ side: 'A', squad, roster: run.roster, call: companionCallFor(run, allCombatants) }], passives);
  const caster = state.combatants[`A:${COMPANION_ROSTER_ID}`];
  assert.ok(caster?.called, 'the caster is seated and marked');
  assert.deepStrictEqual(caster.passives, {}, 'no Mark');
  assert.ok(![...state.active.A, ...state.bench.A].includes(caster.combatantId));
  assert.deepStrictEqual(state.calls?.A, { combatantId: caster.combatantId, moveId: companionCallMoveId(run)!, remaining: 1 });
});

test('companion: brought to the finale it wakes once, and a woken Call refreshes when the Eyes\' phase begins', () => {
  const run = joinCompanion(starterRun(), 'cubling');
  assert.deepStrictEqual(companionToAwaken(run), { type: 'Beast', ascended: false });
  const woken = awakenCompanion(run);
  assert.strictEqual(woken.companion?.ascended, true);
  assert.strictEqual(companionToAwaken(woken), null, 'nothing left to wake');
  assert.strictEqual(awakenCompanion(woken), woken);
  assert.strictEqual(companionToAwaken(starterRun()), null, 'no companion, no beat');
  assert.strictEqual(joinCompanion(starterRun(), 'cubling', true).companion?.ascended, true, 'a woken line joins woken');

  const finale = { ...woken, actNumber: 5, encountersWon: 12 };
  const call = companionCallFor(finale, allCombatants)!;
  assert.strictEqual(call.entry.evolutionTypeGraft, ANCIENT);
  assert.strictEqual(call.phaseGrant, 1);

  // A later phase entering on the far side hands the side its refresh.
  const enemy = { ...createRosterEntry('eye', 'valor', heroes.valor.moveIds), xp: xpForLevel(3) };
  const reserve = { ...createRosterEntry('eye2', 'crimson', heroes.crimson.moveIds), xp: xpForLevel(3) };
  const squad = pickSquad(finale.roster, finale.roster.map((r) => r.rosterId));
  const state = buildCombatState(
    1,
    allCombatants,
    equipment,
    [
      { side: 'A', squad, roster: finale.roster, call },
      { side: 'B', squad: { activeIds: ['eye', null], benchIds: [], reserves: [['eye2']] }, roster: [enemy, reserve] },
    ],
    passives
  );
  const spent = { ...state, calls: { ...state.calls, A: { ...state.calls!.A!, remaining: 0 } } };
  const after = applyForcedReplacement(spent, 3, 'B', 0, 'B:eye2', statuses).state;
  assert.strictEqual(after.calls?.A?.remaining, 1);
});

test('companion: it survives a save, and a file from before the Call reads its roster companion off the roster', () => {
  const run = { ...awakenCompanion(joinCompanion(starterRun(), 'cubling')), map: generateMap(3), locationIds: Object.keys(locations).slice(0, 5) };
  const index = contentIndex();
  const saved = JSON.parse(JSON.stringify(encodeSave(run, 'map')));
  const loaded = decodeSave(saved, index);
  assert.ok(loaded.ok, loaded.ok ? '' : loaded.reason);
  if (!loaded.ok) return;
  assert.deepStrictEqual(loaded.save.run.companion, { type: 'Beast', ascended: true });

  // The old shape: the companion on the roster, `mortal`, and the run remembering it by body.
  const old = JSON.parse(JSON.stringify(saved));
  delete old.run.companion;
  old.run.companionHeroId = 'cubling';
  old.run.roster.push({ ...old.run.roster[0], rosterId: 'cubling-1', heroId: 'ravager', mortal: true, evolutionTypeGraft: 'Ancient' });
  const migrated = decodeSave(old, index);
  assert.ok(migrated.ok, migrated.ok ? '' : migrated.reason);
  if (!migrated.ok) return;
  assert.deepStrictEqual(migrated.save.run.companion, { type: 'Beast', ascended: true });
  assert.ok(!migrated.save.run.roster.some((entry) => spawnPosition(entry.heroId)), 'the companion left the roster');
  assert.strictEqual(migrated.save.run.roster.length, run.roster.length);
});

test('companion: Act 1\'s cap reads the roster alone — the Skirmish meets two heroes with two', () => {
  const run = joinCompanion({ ...starterRun(), map: generateMap(5, 1), locationIds: Object.keys(locations).slice(0, 5), actNumber: 1, fightsStarted: 2 }, 'cubling');
  // fightsStarted 2: past the run's 2v2 breather, so the count is the cap's and nothing else's.
  const skirmish = Object.values(run.map!.nodes).find((n) => n.type === 'skirmish')!;
  const ctx = { run, location: locations.wildsEdge, heroes, allCombatants: rosterHeroes, enemies: {}, progression: progressionTable };
  assert.strictEqual(nodeEncounter(skirmish, ctx).run.roster.length, 2);
  const three = addRosterEntry(run, createRosterEntry('crimson', 'crimson', heroes.crimson.moveIds));
  assert.strictEqual(nodeEncounter(skirmish, { ...ctx, run: three }).run.roster.length, 3);
});
