import * as assert from 'assert';
import { test } from './harness';
import { classes } from '../src/data/classes';
import { CHAMPION_IDS } from '../src/data/enemies';
import { equipment } from '../src/data/equipment';
import { heroes } from '../src/data/heroes';
import { locations } from '../src/data/locations';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { relics } from '../src/data/relics';
import { passives } from '../src/data/passives';
import { TYPES } from '../src/data/typechart';
import { generateMap } from '../src/run/map';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { equipItem } from '../src/run/equipment';
import { buildContentIndex, decodeSave, encodeSave, saveSummary, SAVE_VERSION } from '../src/run/save';

const index = buildContentIndex({
  heroes,
  moves,
  equipment,
  relics,
  passives,
  classes,
  locations,
  championIds: CHAMPION_IDS,
  types: TYPES,
  progression: progressionTable,
});

/** A run shaped like one mid-Act-2: geared, levelled, relics held, half the map walked. */
function sampleRun(): RunState {
  const map = generateMap(1234, 2);
  const walked = map.rows[0][0];
  let run: RunState = { ...createRunState(3, 120), map, actNumber: 2 };
  run = addRosterEntry(run, createRosterEntry('cinderKnight-1', 'cinderKnight', heroes.cinderKnight.moveIds));
  run = addRosterEntry(run, createRosterEntry('rime-1', 'rime', heroes.rime.moveIds));
  const geared = {
    ...run.roster[0],
    level: 6,
    equipment: equipItem(run.roster[0].equipment, equipment.dagger),
    bonusStatGrants: { attack: 10, speed: 5 },
    masteryStatGrants: { hp: 10 },
  };
  return {
    ...run,
    roster: [geared, run.roster[1]],
    relics: [Object.keys(relics)[0]],
    currentNodeId: walked,
    visitedNodeIds: [walked],
    fightsStarted: 2,
    encountersWon: 5,
    locationIds: Object.keys(locations).slice(0, 5),
  };
}

/** Storage is a string round trip, so every assertion has to survive JSON. */
function roundTrip(run: RunState, checkpoint: 'map' | 'actIntro' = 'map') {
  return decodeSave(JSON.parse(JSON.stringify(encodeSave(run, checkpoint))), index);
}

// --- Round trip ---

test('save: a mid-run state survives encode -> JSON -> decode unchanged', () => {
  const run = sampleRun();
  const result = roundTrip(run);
  assert.ok(result.ok, result.ok ? '' : result.reason);
  assert.deepStrictEqual(result.save.run, run);
  assert.strictEqual(result.save.checkpoint, 'map');
  assert.strictEqual(result.save.version, SAVE_VERSION);
});

test('save: the actIntro checkpoint round trips too', () => {
  const result = roundTrip(sampleRun(), 'actIntro');
  assert.ok(result.ok);
  assert.strictEqual(result.save.checkpoint, 'actIntro');
});

test('save: an empty roster and an unwalked map are legal (a run parked at its act intro)', () => {
  const run: RunState = { ...createRunState(0, 40), map: generateMap(7, 1) };
  const result = roundTrip(run, 'actIntro');
  assert.ok(result.ok, result.ok ? '' : result.reason);
});

test('save: the summary reads the act, roster size and that act location', () => {
  const save = encodeSave(sampleRun(), 'map', 5_000);
  const summary = saveSummary(save);
  assert.strictEqual(summary.actNumber, 2);
  assert.strictEqual(summary.rosterSize, 2);
  assert.strictEqual(summary.savedAt, 5_000);
  // Act 2 reads index 1 of the itinerary, not index 2.
  assert.strictEqual(summary.locationId, Object.keys(locations)[1]);
});

// --- Rejection. Each of these would otherwise reach the run as quiet corruption. ---

function rejectionOf(mutate: (raw: any) => void): string {
  const raw = JSON.parse(JSON.stringify(encodeSave(sampleRun(), 'map')));
  mutate(raw);
  const result = decodeSave(raw, index);
  assert.ok(!result.ok, 'expected the save to be refused');
  return result.reason;
}

test('save: a file from another save version is refused', () => {
  assert.ok(rejectionOf((raw) => (raw.version = SAVE_VERSION + 1)).includes('version'));
});

test('save: content the build no longer ships is refused, never silently dropped', () => {
  assert.ok(rejectionOf((raw) => raw.run.roster[0].unlockedMoveIds.push('moveThatWasCut')).includes('moveThatWasCut'));
  assert.ok(rejectionOf((raw) => (raw.run.roster[0].heroId = 'heroThatWasCut')).includes('heroThatWasCut'));
  assert.ok(rejectionOf((raw) => (raw.run.roster[0].equipment.weapon = 'itemThatWasCut')).includes('itemThatWasCut'));
  assert.ok(rejectionOf((raw) => raw.run.relics.push('relicThatWasCut')).includes('relicThatWasCut'));
  assert.ok(rejectionOf((raw) => raw.run.roster[0].bonusPassiveGrants.push('passiveThatWasCut')).includes('passiveThatWasCut'));
  assert.ok(rejectionOf((raw) => raw.run.roster[0].chosenPathIds.push('pathThatWasCut')).includes('pathThatWasCut'));
  assert.ok(rejectionOf((raw) => (raw.run.roster[0].classId = 'classThatWasCut')).includes('classThatWasCut'));
  assert.ok(rejectionOf((raw) => (raw.run.roster[0].evolutionTypeGraft = 'Plasma')).includes('Plasma'));
  assert.ok(rejectionOf((raw) => raw.run.locationIds.push('placeThatWasCut')).includes('placeThatWasCut'));
});

test('save: a map with a dangling edge is refused rather than stranding the player', () => {
  const reason = rejectionOf((raw) => {
    const first = Object.keys(raw.run.map.nodes)[0];
    raw.run.map.nodes[first].nextIds = ['nodeThatIsNotOnThisMap'];
  });
  assert.ok(reason.includes('nodeThatIsNotOnThisMap'));
});

test('save: a currentNodeId or visited id off the map is refused', () => {
  assert.ok(rejectionOf((raw) => (raw.run.currentNodeId = 'ghost')).includes('ghost'));
  assert.ok(rejectionOf((raw) => raw.run.visitedNodeIds.push('ghost')).includes('ghost'));
});

test('save: a run with no map is refused — no checkpoint is written without one', () => {
  assert.ok(rejectionOf((raw) => (raw.run.map = null)).includes('map'));
});

test('save: an over-cap or duplicated roster is refused', () => {
  const reason = rejectionOf((raw) => {
    raw.run.roster = Array.from({ length: 7 }, () => raw.run.roster[0]);
  });
  assert.ok(reason.includes('cap'));
  assert.ok(rejectionOf((raw) => raw.run.roster.push({ ...raw.run.roster[0] })).includes('repeats'));
});

test('save: a run field this version added is required, so a v1 file cannot slip through', () => {
  assert.ok(rejectionOf((raw) => delete raw.run.encountersWon).includes('encountersWon'));
});

test('save: nonsense numbers are refused', () => {
  assert.ok(rejectionOf((raw) => (raw.run.gold = -5)).includes('gold'));
  assert.ok(rejectionOf((raw) => (raw.run.gold = 1.5)).includes('gold'));
  assert.ok(rejectionOf((raw) => (raw.run.actNumber = 9)).includes('actNumber'));
  assert.ok(rejectionOf((raw) => (raw.run.roster[0].level = 0)).includes('level'));
  assert.ok(rejectionOf((raw) => (raw.run.roster[0].bonusStatGrants.charisma = 10)).includes('charisma'));
});

test('save: junk in the slot is refused, not thrown', () => {
  for (const junk of [null, 42, 'nope', [], {}]) {
    const result = decodeSave(junk, index);
    assert.ok(!result.ok, `expected ${JSON.stringify(junk)} to be refused`);
  }
});

test('save: decode rebuilds the run, so a smuggled extra field never reaches it', () => {
  const raw: any = JSON.parse(JSON.stringify(encodeSave(sampleRun(), 'map')));
  raw.run.gold = 999_999;
  raw.run.somethingElse = 'injected';
  raw.run.roster[0].somethingElse = 'injected';
  const result = decodeSave(raw, index);
  assert.ok(result.ok);
  // The legal edit stands; the unknown fields do not survive the rebuild.
  assert.strictEqual(result.save.run.gold, 999_999);
  assert.ok(!('somethingElse' in result.save.run));
  assert.ok(!('somethingElse' in result.save.run.roster[0]));
});
