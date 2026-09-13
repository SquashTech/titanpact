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
    const run = runAt(seed, 2 + (seed % 4));
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
