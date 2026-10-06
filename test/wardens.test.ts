// The Wardens (src/run/wardens.ts, docs/cycles.md §2): the first Cycle I win's band, seated by type
// on the six base seals, standing beside each beast from Cycle II as an extra body.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { allCombatants } from '../src/data/content';
import { classes } from '../src/data/classes';
import { locations } from '../src/data/locations';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { generateMap } from '../src/run/map';
import { generateItinerary, locationForAct } from '../src/run/locations';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { nodeEncounter, type EncounterContext } from '../src/run/encounters';
import { createProfile, decodeProfile, recordRunEnded } from '../src/run/profile';
import { equipItem } from '../src/run/equipment';
import { MOVE_CAP } from '../src/run/progression';
import {
  SEAL_IDS,
  WARDEN_CLASS_FROM_ACT,
  buildWarden,
  isWarden,
  isWardenCombatant,
  recordWardens,
  seatWardens,
  wardenAt,
  wardenRosterId,
  wardensFromRun,
  withBackfilledWardens,
  type Warden,
} from '../src/run/wardens';

const BAND = ['valor', 'packAlpha', 'crimson', 'tidecaller', 'rime', 'cinderKnight'].filter((id) => heroes[id]);
const valorPath = progressionTable.evolutions.valor[0].paths[0].id;
const classId = Object.keys(classes)[0];

function wonRun(): RunState {
  let run = createRunState(50);
  for (const id of BAND) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  return {
    ...run,
    roster: run.roster.map((r) =>
      r.heroId === 'valor' ? { ...r, chosenPathIds: [valorPath], classId, equipment: equipItem(r.equipment, 'dagger.common') } : r
    ),
  };
}

function bossAt(seed: number, act: number, cycle: number, wardens: readonly Warden[]) {
  let run = createRunState(50, 1, cycle);
  for (const id of ['packAlpha', 'crimson']) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  run = { ...run, map: generateMap(seed, act), locationIds: generateItinerary(seed), actNumber: act, fightsStarted: 2, encountersWon: 4 };
  const ctx: EncounterContext = { run, location: locationForAct(run.locationIds, act), heroes, allCombatants, enemies, progression: progressionTable, wardens };
  const boss = Object.values(run.map!.nodes).find((n) => n.type === 'boss')!;
  return { ctx, encounter: nodeEncounter(boss, ctx) };
}

test('wardens: six heroes take the six base seals, one each, the best fit for the band', () => {
  const band = BAND.map((id) => ({ heroId: id, types: heroes[id].types }));
  const seats = seatWardens(band);
  assert.strictEqual(seats.size, band.length);
  assert.strictEqual(new Set(seats.values()).size, band.length, 'no seal held twice');
  for (const sealId of seats.values()) assert.ok(SEAL_IDS.includes(sealId), `${sealId} is not a base seal`);
  assert.ok(!SEAL_IDS.includes('theThreshold') && SEAL_IDS.length === 6);
  // A Fire hero beside five that are not Fire takes the Foundry, which spawns Fire.
  const fire = seatWardens([{ heroId: 'f', types: ['Fire'] }, { heroId: 'w', types: ['Water'] }]);
  assert.strictEqual(fire.get('f'), 'moltenFoundry');
  assert.strictEqual(fire.get('w'), 'stormCoast');
});

test('wardens: the band is the run as it won — path, kit, Class and gear — and only the first win keeps one', () => {
  const band = wardensFromRun(wonRun(), heroes);
  assert.strictEqual(band.length, BAND.length);
  const valor = band.find((w) => w.heroId === 'valor')!;
  assert.strictEqual(valor.pathId, valorPath);
  assert.strictEqual(valor.classId, classId);
  assert.deepStrictEqual(valor.itemIds, ['dagger.common']);
  assert.deepStrictEqual(valor.moveIds, heroes.valor.moveIds);

  const first = recordWardens(createProfile(), band);
  assert.strictEqual(first.wardens.length, BAND.length);
  const second = recordWardens(first, band.slice(0, 1).map((w) => ({ ...w, heroId: 'rime' })));
  assert.strictEqual(second, first, 'the first band is kept forever');
  assert.strictEqual(recordWardens(createProfile(), []).wardens.length, 0);
});

test('wardens: they survive the profile, and a win from before them is read off its history line', () => {
  const profile = recordWardens(createProfile(), wardensFromRun(wonRun(), heroes));
  const decoded = decodeProfile(JSON.parse(JSON.stringify(profile)));
  assert.deepStrictEqual(decoded.wardens, profile.wardens);
  assert.deepStrictEqual(decodeProfile({}).wardens, []);

  const end = (cycle: number) => ({
    outcome: 'win' as const,
    actReached: 5,
    locationId: null,
    encountersWon: 12,
    cycle,
    roster: BAND.map((heroId) => ({ heroId, level: 24, evolutionPathId: heroId === 'valor' ? valorPath : null })),
  });
  let history = recordRunEnded(createProfile(), end(1), 1);
  history = recordRunEnded(history, { ...end(1), roster: end(1).roster.slice(0, 2) }, 2);
  const backfilled = withBackfilledWardens(history, heroes, progressionTable);
  assert.strictEqual(backfilled.wardens.length, BAND.length, 'the OLDEST win is the band');
  const valor = backfilled.wardens.find((w) => w.heroId === 'valor')!;
  assert.strictEqual(valor.pathId, valorPath);
  assert.deepStrictEqual(valor.moveIds, heroes.valor.moveIds, 'a history line kept no kit: the hero’s own');
  assert.strictEqual(withBackfilledWardens(backfilled, heroes, progressionTable), backfilled, 'nothing to do once seated');
  assert.strictEqual(withBackfilledWardens(recordRunEnded(createProfile(), end(2), 1), heroes, progressionTable).wardens.length, 0, 'only a Cycle I win seats a band');
});

test('wardens: a Warden is grown to the fight — its level, its kit as far as the level has opened, its Class from Act 2, gear as the act allows', () => {
  const band = wardensFromRun(wonRun(), heroes);
  const valor = band.find((w) => w.heroId === 'valor')!;
  const lateMove = Object.keys(moves).find((id) => moves[id].tier === 'late')!;
  const warden = { ...valor, moveIds: [lateMove, ...valor.moveIds] };
  const early = buildWarden(warden, allCombatants, progressionTable, { level: 4, mastery: 0, actNumber: 1, seed: 7 })!;
  assert.strictEqual(early.rosterId, wardenRosterId('valor'));
  assert.ok(isWarden(early));
  assert.ok(!early.unlockedMoveIds.includes(lateMove), 'a Late move waits for the Late band');
  assert.ok(early.unlockedMoveIds.length > 0 && early.unlockedMoveIds.length <= MOVE_CAP);
  assert.strictEqual(early.classId, null, 'no Class before the first Guardian has fallen');
  assert.strictEqual(early.chosenPathIds.length, 0, 'no Evolution below the pips');
  assert.deepStrictEqual(early.equipment, [], 'bare where the act’s enemies are');

  const gear = { gear: { common: 1, rare: 0, epic: 0, legendary: 0, mythic: 0 }, gearCount: 1 };
  const late = buildWarden(warden, allCombatants, progressionTable, { level: 24, mastery: 6, actNumber: 4, loadout: gear, seed: 7 })!;
  assert.ok(late.unlockedMoveIds.includes(lateMove), 'its own Late move, once Late has opened');
  assert.ok(late.unlockedMoveIds.length <= MOVE_CAP);
  assert.strictEqual(late.classId, classId, `its Class from Act ${WARDEN_CLASS_FROM_ACT}`);
  assert.deepStrictEqual(late.chosenPathIds, [valorPath], 'its own path, at the pips');
  assert.deepStrictEqual(late.equipment, ['dagger.common']);
});

test('wardens: from Cycle II the seal’s Warden joins its Guardian last on the bench; never in Cycle I', () => {
  const band = wardensFromRun(wonRun(), heroes);
  for (const act of [1, 2, 3, 4]) {
    const seed = 21;
    const { ctx, encounter } = bossAt(seed, act, 2, band);
    const held = wardenAt(band, ctx.location.id);
    const warden = encounter.run.roster.find(isWarden);
    if (!held) {
      assert.strictEqual(warden, undefined, `act ${act}: an unheld seal keeps its beast alone`);
      continue;
    }
    assert.ok(warden, `act ${act}: ${ctx.location.id} is held by ${held.heroId}`);
    assert.strictEqual(warden!.heroId, held.heroId);
    assert.strictEqual(encounter.squad.benchIds[encounter.squad.benchIds.length - 1], warden!.rosterId, 'last on the bench');
    const asleep = bossAt(seed, act, 2, []).encounter;
    assert.strictEqual(encounter.run.roster.length, asleep.run.roster.length + 1, 'an extra body, no escort displaced');
    assert.strictEqual(bossAt(seed, act, 1, band).encounter.run.roster.some(isWarden), false, 'Cycle I has no Wardens');
  }
  // Every base seal is someone's when six hold them.
  assert.deepStrictEqual(new Set(band.map((w) => w.sealId)), new Set(SEAL_IDS.filter((id) => locations[id])));
});

test('wardens: the view finds a Warden by its combatant id, and nothing else reads as one', () => {
  assert.ok(isWardenCombatant('enemy:' + wardenRosterId('valor')));
  assert.ok(!isWardenCombatant('enemy:valor'));
  assert.ok(!isWardenCombatant('player:packAlpha'));
});
