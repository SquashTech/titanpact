// One node, one encounter (src/run/encounters.ts): the draw is seeded off the map so the tile's
// preview and the tap's fight agree, and the fork's two options never show the same typing
// (docs/titanspawn-overhaul.md §4, phase 3).

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { allCombatants } from '../src/data/content';
import { progressionTable } from '../src/data/progression';
import { titanspawn } from '../src/data/titanspawn';
import { generateMap } from '../src/run/map';
import { generateItinerary, locationForAct } from '../src/run/locations';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { encounterSeedFor, nodeEncounter, scoutedTypes, type EncounterContext } from '../src/run/encounters';
import { isRecruitable } from '../src/run/recruitment';
import { wokenChampion, wokenChampionMark, wokenEscortCount } from '../src/run/ascension';
import { guardianEscortPool } from '../src/run/spawn';
import { championGradeFor, encounterScaling, guardianEscortCount } from '../src/run/difficulty';
import { appendFinalEnemy } from '../src/run/enemyGen';

function runAt(seed: number, act: number): RunState {
  let run = createRunState(50);
  for (const id of ['valor', 'packAlpha', 'crimson', 'tidecaller']) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  return { ...run, map: generateMap(seed, act), locationIds: generateItinerary(seed), actNumber: act, fightsStarted: 2, encountersWon: 4 };
}

function contextFor(run: RunState): EncounterContext {
  return { run, location: locationForAct(run.locationIds, run.actNumber), heroes, allCombatants, enemies, progression: progressionTable };
}

function nodesOfType(run: RunState, type: string) {
  return Object.values(run.map!.nodes).filter((n) => n.type === type);
}

test('encounters: the seed is a function of the map and the node, so two builds of one node agree', () => {
  const run = runAt(11, 3);
  const ctx = contextFor(run);
  for (const node of Object.values(run.map!.nodes)) {
    if (!['fight', 'skirmish', 'elite', 'boss'].includes(node.type)) continue;
    const a = nodeEncounter(node, ctx);
    const b = nodeEncounter(node, ctx);
    assert.deepStrictEqual(a.run.roster, b.run.roster, `${node.id} drew twice and differed`);
    assert.deepStrictEqual(a.squad, b.squad);
  }
  assert.notStrictEqual(encounterSeedFor(run.map!, 'r2-c0'), encounterSeedFor(run.map!, 'r5-c0'));
  assert.notStrictEqual(encounterSeedFor(run.map!, 'r2-c0'), encounterSeedFor({ ...run.map!, seed: run.map!.seed + 1 }, 'r2-c0'));
  assert.notStrictEqual(encounterSeedFor(run.map!, 'r2-c0'), encounterSeedFor(run.map!, 'r2-c0', 1), 'the salt re-rolls');
});

test('encounters: the fork is Elite-or-Skirmish, both recruitable, and the two never show the same typing', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const run = runAt(seed, 2 + (seed % 3));
    const ctx = contextFor(run);
    const [elite] = nodesOfType(run, 'elite');
    const fork = run.map!.rows[elite.row].map((id) => run.map!.nodes[id]);
    assert.deepStrictEqual(fork.map((n) => n.type).sort(), ['elite', 'skirmish'], `seed ${seed}: the fork is not Elite-or-Skirmish`);
    const [eliteTypes, skirmishTypes] = fork.map((n) => scoutedTypes(nodeEncounter(n, ctx), allCombatants).sort());
    assert.notDeepStrictEqual(eliteTypes, skirmishTypes, `seed ${seed}: both options read ${eliteTypes.join('/')}`);
    for (const n of fork) {
      for (const entry of nodeEncounter(n, ctx).run.roster) assert.ok(isRecruitable(entry.heroId, heroes), `${entry.heroId} is not a contract`);
    }
  }
});

test('encounters: the preview lists every type on the enemy side, active first, deduped', () => {
  const run = runAt(5, 2);
  const [skirmish] = nodesOfType(run, 'skirmish');
  const encounter = nodeEncounter(skirmish, contextFor(run));
  const types = scoutedTypes(encounter, allCombatants);
  assert.strictEqual(new Set(types).size, types.length);
  const [firstActive] = encounter.squad.activeIds;
  const firstHero = allCombatants[encounter.run.roster.find((r) => r.rosterId === firstActive)!.heroId];
  assert.strictEqual(types[0], firstHero.types[0], 'the lead is the first active hero');
  for (const entry of encounter.run.roster) for (const t of allCombatants[entry.heroId].types) assert.ok(types.includes(t));
});

test('encounters: the mob nodes draw spawn and the Guardian draws escorts plus its champion', () => {
  const run = runAt(9, 4);
  const ctx = contextFor(run);
  const [opener] = nodesOfType(run, 'fight');
  for (const entry of nodeEncounter(opener, ctx).run.roster) assert.ok(entry.heroId in titanspawn, `${entry.heroId} is not a spawn`);
  const [boss] = nodesOfType(run, 'boss');
  const guardian = nodeEncounter(boss, ctx);
  assert.strictEqual(guardian.run.roster.length, 3);
  assert.strictEqual(guardian.squad.benchIds[0], ctx.location.guardianFinalEnemyId);
  for (const id of guardian.squad.activeIds) assert.ok(id && id in titanspawn, `${id} is not a spawn escort`);
});

test('encounters: from A1 the Guardian wakes — it leads, wears its Mark, grows on hero grades, and gains an escort from Act 3', () => {
  for (const act of [1, 2, 3, 4]) {
    const base = runAt(9, act);
    const [boss] = nodesOfType(base, 'boss');
    const asleep = nodeEncounter(boss, contextFor(base));
    const woken = nodeEncounter(boss, contextFor({ ...base, ascension: 1 }));
    const championId = contextFor(base).location.guardianFinalEnemyId!;
    const champion = (e: typeof woken) => e.run.roster.find((r) => r.rosterId === championId)!;

    // Base fields one escort in Acts 1-2 (difficulty.ts GUARDIAN_ESCORTS_BY_ACT), and the champion
    // takes the lead slot it leaves; with two it waits on the bench for the first KO.
    const lone = guardianEscortCount(act) === 1;
    if (lone) assert.strictEqual(asleep.squad.activeIds[1], championId, `act ${act}: a lone escort leaves the champion a lead slot`);
    else assert.ok(asleep.squad.benchIds.includes(championId) && !asleep.squad.activeIds.includes(championId), `act ${act}: Base keeps the champion benched`);
    assert.deepStrictEqual(champion(asleep).bonusPassiveGrants, [], `act ${act}: Base keeps the Mark off`);
    assert.strictEqual(woken.squad.activeIds[1], championId, `act ${act}: the woken champion leads`);
    assert.deepStrictEqual(champion(woken).bonusPassiveGrants, [wokenChampionMark(enemies[championId])]);
    assert.notDeepStrictEqual(wokenChampion(enemies[championId]).growthGrades, enemies[championId].growthGrades, 'the woken champion trades its E grades');

    const escorts = (e: typeof woken) => e.run.roster.filter((r) => r.rosterId !== championId).length;
    assert.strictEqual(escorts(asleep), act === 1 ? Math.min(guardianEscortCount(act), base.roster.length) : guardianEscortCount(act));
    assert.strictEqual(escorts(woken), Math.min(wokenEscortCount(act), Object.keys(guardianEscortPool(contextFor(base).location, act)).length));
    assert.strictEqual(new Set([...woken.squad.activeIds, ...woken.squad.benchIds]).size, woken.run.roster.length, `act ${act}: every body fielded once`);
  }
});

test("encounters: a Base champion grows on its act's grade — E to Act 3, C in Act 4, the last seal", () => {
  assert.deepStrictEqual([1, 2, 3, 4].map(championGradeFor), ['E', 'E', 'E', 'C']);
  // The same champion, seed and level on E and on C: the draw walks the row in order, so the
  // stronger row never pays less on a draw.
  const championId = 'manticore';
  const empty = { run: createRunState(0), squad: { activeIds: [null, null] as [null, null], benchIds: [] } };
  const scaling = encounterScaling('boss', 4);
  const onE = appendFinalEnemy(empty, championId, enemies, 7, scaling).run.roster[0];
  const graded = { ...enemies[championId], growthGrades: Object.fromEntries(Object.keys(enemies[championId].growthGrades!).map((k) => [k, 'C'])) as typeof enemies[string]['growthGrades'] };
  const onC = appendFinalEnemy(empty, championId, { ...enemies, [championId]: graded }, 7, scaling).run.roster[0];
  const total = (grants: Record<string, number | undefined>) => Object.values(grants).reduce<number>((sum, v) => sum + (v ?? 0), 0);
  assert.ok(total(onC.growthStatGrants) > total(onE.growthStatGrants), 'C grows the champion further than E');
});

test('encounters: a hero on the roster is never drawn against the player', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const run = runAt(seed, 3);
    const ctx = contextFor(run);
    for (const node of [...nodesOfType(run, 'skirmish'), ...nodesOfType(run, 'elite')]) {
      for (const entry of nodeEncounter(node, ctx).run.roster) assert.ok(!run.roster.some((r) => r.heroId === entry.heroId));
    }
  }
});

test('encounters: a non-encounter node is refused rather than drawn', () => {
  const run = runAt(3, 2);
  const [reward] = Object.values(run.map!.nodes).filter((n) => n.type === 'shop');
  assert.throws(() => nodeEncounter(reward, contextFor(run)));
});
