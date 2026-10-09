// A save on every screen (docs/save-system.md): the screen round trips, a bad one falls back, a
// settled grant is skipped, a fight resumed mid-way resolves as it would have, and the envelope
// survives a torn write.

import * as assert from 'assert';
import { test } from './harness';
import { classes } from '../src/data/classes';
import { allCombatants } from '../src/data/content';
import { CHAMPION_IDS, ENDBRINGER_ID, EYE_PHASES, finaleEnemies, titanEyes } from '../src/data/enemies';
import { equipment } from '../src/data/equipment';
import { runEvents } from '../src/data/events';
import { fieldEffects } from '../src/data/fieldEffects';
import { heroes } from '../src/data/heroes';
import { locations } from '../src/data/locations';
import { moves } from '../src/data/moves';
import { passives } from '../src/data/passives';
import { progressionTable } from '../src/data/progression';
import { relics } from '../src/data/relics';
import { statuses } from '../src/data/statuses';
import { TYPES, typeChart } from '../src/data/typechart';
import type { Action } from '../src/engine/combat/actions';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { derivedRandom, type CombatState, type Side } from '../src/engine/state';
import { pickAiAction, type AiContext } from '../src/run/ai';
import { buildCombatState } from '../src/run/buildCombatState';
import { encounterScaling } from '../src/run/difficulty';
import { generateEncounter, generateFinaleEncounter, type Encounter } from '../src/run/enemyGen';
import { generateMap } from '../src/run/map';
import { emptyMvpTally, mvpLedgersFromEvents, tallyMvpEvents } from '../src/run/mvp';
import { decodeResume, isResumable, resumeTarget, type CombatSnapshot, type ResumePayload, type RunScreen } from '../src/run/resume';
import { buildContentIndex, decodeSave, encodeSave, SAVE_VERSION } from '../src/run/save';
import { checksumOf, pickReadable, unwrapEnvelope, wrapEnvelope } from '../src/run/saveEnvelope';
import { openingSquad } from '../src/run/squad';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';

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
  combatants: allCombatants,
  events: runEvents,
});

function sampleRun(): RunState {
  let run: RunState = { ...createRunState(120), map: generateMap(99, 1), locationIds: [Object.keys(locations)[0]] };
  run = addRosterEntry(run, createRosterEntry('cinderKnight-1', 'cinderKnight', heroes.cinderKnight.moveIds));
  run = addRosterEntry(run, createRosterEntry('rime-1', 'rime', heroes.rime.moveIds));
  return run;
}

function roundTrip(payload: ResumePayload, run: RunState): ResumePayload | null {
  return decodeResume(JSON.parse(JSON.stringify(payload)), index, run);
}

const anyNode = (run: RunState) => run.map!.rows[0][0];

// --- Screens ---

test('resume: every resumable kind round trips, nested chains included', () => {
  const run = sampleRun();
  const nodeId = anyNode(run);
  const enemy = generateEncounter('elite', 5, heroes, { scaling: encounterScaling('elite', 2), progression: progressionTable });
  const item = Object.keys(equipment)[0];
  const map: RunScreen = { kind: 'map' };
  const chain: RunScreen = {
    kind: 'fallen',
    rosterIds: ['rime-1'],
    next: {
      kind: 'levelUp',
      report: [{ rosterId: 'rime-1', heroId: 'rime', fromLevel: 4, toLevel: 5, fromXp: 64, toXp: 125, gained: { attack: 2 } }],
      seed: 7,
      taken: ['rime-1'],
      next: {
        kind: 'companion',
        beat: { kind: 'join', heroId: 'rime' },
        next: {
          kind: 'itemWho',
          itemId: item,
          next: { kind: 'guardianBanner', next: { kind: 'recruit', offers: enemy.run.roster, claimedRosterIds: [], next: { kind: 'pactSeal' } } },
        },
      },
    },
  };
  const screens: RunScreen[] = [
    map,
    chain,
    { kind: 'actIntro' },
    { kind: 'locationChoice', candidateIds: Object.keys(locations).slice(0, 2) },
    { kind: 'herald', next: { kind: 'titanBound', next: { kind: 'champions' } } },
    { kind: 'shop', nodeId, offers: { heroOfferIds: ['a'], itemIds: [item], gems: [{ stat: 'wisdom', points: 10 }] }, gemsBought: [0], rerolls: 2, itemsBought: [0] },
    { kind: 'reward', nodeId, nodeType: 'currencyReward', seed: 11 },
    { kind: 'boonNode', nodeId, seed: 1 },
    { kind: 'mentorNode', nodeId, seed: 2 },
    { kind: 'tutorNode', nodeId, seed: 3, settled: true },
    { kind: 'academyNode', nodeId, seed: 5 },
    { kind: 'event', nodeId, eventId: Object.keys(runEvents)[0], seed: 4 },
    { kind: 'manaWell', nodeId },
    { kind: 'rest', nodeId },
    { kind: 'scrolls', plan: { source: 'scribe', gems: [{ stat: 'attack', points: 5 }, { stat: 'speed', points: 5 }] }, nodeId, bought: false, next: map, progress: { remaining: 1, pickedIds: ['rime-1'] } },
    { kind: 'rosterReplace', candidate: { source: 'guildHall', offer: { id: 'o', heroId: 'rime', startingMoveIds: heroes.rime.moveIds } }, next: map },
    {
      kind: 'fight',
      nodeId,
      nodeType: 'elite',
      squad: openingSquad(run.roster),
      encounter: enemy,
      goldReward: 30,
      xpGained: 100,
      equipmentRewardId: item,
      consumableReward: 'hpPotion',
      contractReward: true,
      gemReward: [{ stat: 'hp', points: 5 }, { stat: 'speed', points: 5 }],
      levelSeed: 9,
    },
  ];
  for (const screen of screens) {
    assert.ok(isResumable(screen.kind), screen.kind);
    const back = roundTrip({ screen }, run);
    assert.ok(back, `${screen.kind} did not decode`);
    assert.deepStrictEqual(back!.screen, JSON.parse(JSON.stringify(screen)), screen.kind);
  }
});

test('resume: the finale party and every act a Guardian brings decode', () => {
  const run = sampleRun();
  const seals = [1, 2, 3, 4].map((act) => ({ actNumber: act, locationId: 'wildsEdge', championId: 'manticore', level: 20, statGrants: {}, growthStatGrants: {} }));
  const escorts = { spawnTypesFor: (locationId: string) => locations[locationId]?.spawnTypes ?? null, heraldLeads: true };
  const parties: Encounter[] = [generateFinaleEncounter(seals, ENDBRINGER_ID, finaleEnemies, 7, { level: 30, mastery: 10 }, escorts, { phases: EYE_PHASES, pool: titanEyes })];
  for (let act = 1; act <= 4; act++) parties.push(generateEncounter('boss', act, heroes, { scaling: encounterScaling('boss', act), progression: progressionTable }));
  for (const encounter of parties) {
    const screen: RunScreen = {
      kind: 'fight',
      nodeId: anyNode(run),
      nodeType: 'boss',
      squad: openingSquad(run.roster),
      encounter,
      goldReward: 0,
      xpGained: 0,
      equipmentRewardId: null,
      consumableReward: null,
      contractReward: false,
      gemReward: [],
      levelSeed: 1,
    };
    assert.ok(roundTrip({ screen }, run), `a party led by ${encounter.run.roster[0].heroId} did not decode`);
  }
});

test('resume: a bad node, item or hero fails the screen, which then falls back rather than throwing', () => {
  const run = sampleRun();
  assert.strictEqual(roundTrip({ screen: { kind: 'manaWell', nodeId: 'nowhere' } }, run), null);
  assert.strictEqual(roundTrip({ screen: { kind: 'itemWho', itemId: 'itemThatWasCut', next: { kind: 'map' } } }, run), null);
  assert.strictEqual(roundTrip({ screen: { kind: 'fallen', rosterIds: ['ghost-1'], next: { kind: 'map' } } }, run), null);
  assert.strictEqual(decodeResume('junk', index, run), null);
  assert.strictEqual(decodeResume({ screen: { kind: 'map', next: 5 } }, index, run)?.screen.kind, 'map');
});

test('resume: a run saved in the old Guardian Crucible walks on to what followed it', () => {
  const run = sampleRun();
  const back = roundTrip({ screen: { kind: 'crucible', seed: 3, next: { kind: 'pactSeal' } } as unknown as RunScreen }, run);
  assert.strictEqual(back?.screen.kind, 'pactSeal');
});

test('resume: the title, the draft, the dev fights and the run end are never resumed', () => {
  const run = sampleRun();
  for (const kind of ['title', 'draft', 'lore', 'quickBattle', 'sandboxBattle', 'statusTestFight', 'runComplete', 'runFailed'] as const) {
    assert.ok(!isResumable(kind), kind);
    assert.strictEqual(decodeResume({ screen: { kind } }, index, run), null, kind);
  }
});

test('resume: a settled grant is gone past — a node walks on, a chain link opens what follows it', () => {
  const run = sampleRun();
  const nodeId = anyNode(run);
  const walked = resumeTarget({ kind: 'boonNode', nodeId, seed: 1, settled: true }, run);
  assert.deepStrictEqual(walked.screen, { kind: 'map' });
  assert.ok(walked.run.visitedNodeIds.includes(nodeId), 'the node is walked, so it cannot be granted twice');
  const after = resumeTarget({ kind: 'itemWho', itemId: 'x', settled: true, next: { kind: 'guardianBanner', settled: true, next: { kind: 'pactSeal' } } }, run);
  assert.deepStrictEqual(after.screen, { kind: 'pactSeal' });
  assert.strictEqual(after.run, run);
  const open: RunScreen = { kind: 'boonNode', nodeId, seed: 1 };
  assert.strictEqual(resumeTarget(open, run).screen, open, 'an unsettled screen opens on itself');
});

// --- The save file ---

test('save: v21 carries the screen and the checkpoint behind it; a bad run half falls back to it', () => {
  const checkpointRun = sampleRun();
  const run = { ...checkpointRun, gold: checkpointRun.gold + 50 };
  const resume: ResumePayload = { screen: { kind: 'boonNode', nodeId: anyNode(run), seed: 4 } };
  const raw = JSON.parse(JSON.stringify(encodeSave(run, 'map', 1, { fallbackRun: checkpointRun, resume })));
  const read = decodeSave(raw, index);
  assert.ok(read.ok);
  assert.strictEqual(read.save.version, SAVE_VERSION);
  assert.deepStrictEqual(read.save.run, run);
  assert.deepStrictEqual(read.save.fallbackRun, checkpointRun);
  assert.deepStrictEqual(decodeResume(read.save.resume, index, read.save.run)?.screen, resume.screen);

  raw.run.roster[0].heroId = 'heroThatWasCut';
  const fallen = decodeSave(raw, index);
  assert.ok(fallen.ok, 'the checkpoint still reads');
  assert.deepStrictEqual(fallen.save.run, checkpointRun);
  assert.strictEqual(fallen.save.resume, undefined, 'and nothing of the bad half rides with it');
});

test('save: a v20 file still loads, as its checkpoint (D4)', () => {
  const run = sampleRun();
  const raw = { version: 20, savedAt: 5, checkpoint: 'actIntro', run: JSON.parse(JSON.stringify(run)), resume: { screen: { kind: 'map' } } };
  const read = decodeSave(raw, index);
  assert.ok(read.ok, read.ok ? '' : read.reason);
  assert.strictEqual(read.save.checkpoint, 'actIntro');
  assert.deepStrictEqual(read.save.run, run);
  assert.strictEqual(read.save.resume, undefined);
});

test('save: the index names every fieldable body and every event', () => {
  assert.ok(index.combatantIds.has(ENDBRINGER_ID));
  for (const id of Object.keys(titanEyes)) assert.ok(index.combatantIds.has(id));
  assert.ok(!index.heroIds.has(ENDBRINGER_ID), 'a roster still cannot hold the Herald');
  for (const id of Object.keys(runEvents)) assert.ok(index.eventIds.has(id));
});

// --- Mid-fight ---

function aliveActiveIdsOn(state: CombatState, side: Side): string[] {
  return state.active[side].filter((id): id is string => id !== null && !state.combatants[id].fainted);
}

function sideDefeated(state: CombatState, side: Side): boolean {
  const combatants = Object.values(state.combatants).filter((c) => c.side === side);
  return combatants.length > 0 && combatants.every((c) => c.fainted);
}

const config = { typeChart, heroes: allCombatants, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 10 };

function ctxFor(roster: RunState['roster']): AiContext {
  return {
    heroes: allCombatants,
    moves,
    statuses,
    typeChart,
    passives,
    moveIdsFor: (combatantId) => roster.find((entry) => combatantId.endsWith(`:${entry.rosterId}`))!.unlockedMoveIds,
  };
}

/** Both sides declared off the board's derived stream, as the enemy is on screen. */
function playRounds(state: CombatState, rounds: number, a: Encounter, b: Encounter, tally = emptyMvpTally()) {
  const ctxA = ctxFor(a.run.roster);
  const ctxB = ctxFor(b.run.roster);
  for (let i = 0; i < rounds && !sideDefeated(state, 'A') && !sideDefeated(state, 'B'); i++) {
    const actions: Action[] = [
      ...aliveActiveIdsOn(state, 'A').map((id) => pickAiAction(state, id, { ...ctxA, random: derivedRandom(state, id, 'ai') })),
      ...aliveActiveIdsOn(state, 'B').map((id) => pickAiAction(state, id, { ...ctxB, random: derivedRandom(state, id, 'ai') })),
    ];
    if (actions.length === 0) break;
    const result = resolveRound(state, actions, config);
    tally = tallyMvpEvents(tally, result.events, result.state, 'A', statuses);
    state = result.state;
  }
  return { state, tally };
}

function openFight(): { state: CombatState; a: Encounter; b: Encounter } {
  const a = generateEncounter('fight', 21, heroes, { heroCount: 4, scaling: encounterScaling('fight', 2), progression: progressionTable });
  const b = generateEncounter('fight', 22, heroes, { heroCount: 4, scaling: encounterScaling('fight', 2), progression: progressionTable });
  const state = buildCombatState(31, allCombatants, equipment, [{ side: 'A', squad: a.squad, roster: a.run.roster }, { side: 'B', squad: b.squad, roster: b.run.roster }], passives);
  return { state, a, b };
}

test('combatSnapshot: a board through JSON resolves the next rounds exactly as the live one does', () => {
  const { state, a, b } = openFight();
  const mid = playRounds(state, 3, a, b);
  const saved: CombatSnapshot = { state: mid.state, usedConsumables: { hpPotion: 0, mpPotion: 0, revive: 0 }, leadsPending: false, mvpTally: mid.tally };
  const restored = JSON.parse(JSON.stringify(saved)) as CombatSnapshot;
  const live = playRounds(mid.state, 4, a, b, mid.tally);
  const resumed = playRounds(restored.state, 4, a, b, restored.mvpTally);
  // Through JSON an undefined field is an absent one; the comparison reads both the same way.
  const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
  assert.deepStrictEqual(plain(resumed.state), plain(live.state));
  assert.ok(live.state.round > mid.state.round + 1, 'the fight ran on past the save');
  assert.deepStrictEqual(resumed.tally, live.tally);
});

test('combatSnapshot: the enemy declares the same moves across a reload (D1)', () => {
  const { state, a, b } = openFight();
  const board = playRounds(state, 2, a, b).state;
  const reloaded = JSON.parse(JSON.stringify(board)) as CombatState;
  const ctx = ctxFor(b.run.roster);
  for (const id of aliveActiveIdsOn(board, 'B')) {
    const first = pickAiAction(board, id, { ...ctx, random: derivedRandom(board, id, 'ai') });
    const again = pickAiAction(reloaded, id, { ...ctx, random: derivedRandom(reloaded, id, 'ai') });
    assert.deepStrictEqual(again, first);
  }
});

test('combatSnapshot: the running MVP tally equals the ledger read off the whole stream', () => {
  const { state, a, b } = openFight();
  // Tallied a round at a time — as a resumed fight is — it must read as the stream tallied whole.
  const whole = playRounds(state, 4, a, b);
  const pieces = [1, 1, 1, 1].reduce((acc) => playRounds(acc.state, 1, a, b, acc.tally), { state, tally: emptyMvpTally() });
  assert.deepStrictEqual(pieces.tally, whole.tally);
  assert.deepStrictEqual(Object.values(whole.tally.ledgers), mvpLedgersFromEventsOf(state, 4, a, b));
});

/** The ledgers the old one-pass reader produces over the same four rounds. */
function mvpLedgersFromEventsOf(state: CombatState, rounds: number, a: Encounter, b: Encounter) {
  const ctxA = ctxFor(a.run.roster);
  const ctxB = ctxFor(b.run.roster);
  const events = [];
  for (let i = 0; i < rounds && !sideDefeated(state, 'A') && !sideDefeated(state, 'B'); i++) {
    const actions: Action[] = [
      ...aliveActiveIdsOn(state, 'A').map((id) => pickAiAction(state, id, { ...ctxA, random: derivedRandom(state, id, 'ai') })),
      ...aliveActiveIdsOn(state, 'B').map((id) => pickAiAction(state, id, { ...ctxB, random: derivedRandom(state, id, 'ai') })),
    ];
    const result = resolveRound(state, actions, config);
    events.push(...result.events);
    state = result.state;
  }
  return mvpLedgersFromEvents(events, state, 'A', statuses);
}

test('combatSnapshot: a board naming a combatant the run does not hold costs the board, not the fight', () => {
  const run = sampleRun();
  const enemy = generateEncounter('fight', 5, heroes, { scaling: encounterScaling('fight', 1), progression: progressionTable });
  const squad = openingSquad(run.roster);
  const screen: RunScreen = {
    kind: 'fight',
    nodeId: anyNode(run),
    nodeType: 'fight',
    squad,
    encounter: enemy,
    goldReward: 0,
    xpGained: 0,
    equipmentRewardId: null,
    consumableReward: null,
    contractReward: false,
    gemReward: [],
    levelSeed: 1,
  };
  const state = buildCombatState(3, allCombatants, equipment, [{ side: 'A', squad, roster: run.roster }, { side: 'B', squad: enemy.squad, roster: enemy.run.roster }], passives);
  const combat: CombatSnapshot = { state, usedConsumables: { hpPotion: 0, mpPotion: 0, revive: 0 }, leadsPending: true, mvpTally: emptyMvpTally() };
  const good = roundTrip({ screen, combat }, run);
  assert.ok(good?.combat, 'a whole board resumes');
  assert.strictEqual(good!.combat!.leadsPending, true);

  const broken = JSON.parse(JSON.stringify(combat));
  broken.state.combatants[Object.keys(broken.state.combatants)[0]].heroId = 'heroThatWasCut';
  const fallback = roundTrip({ screen, combat: broken }, run);
  assert.ok(fallback, 'the fight still resumes');
  assert.strictEqual(fallback!.combat, undefined, 'and opens fresh');

  const greedy = JSON.parse(JSON.stringify(combat));
  greedy.usedConsumables.revive = run.consumables.revive + 1;
  assert.strictEqual(roundTrip({ screen, combat: greedy }, run)!.combat, undefined, 'a board that drank more than the purse holds is refused');
});

// --- The envelope ---

test('saveEnvelope: the checksum is stable and catches a torn write', () => {
  assert.strictEqual(checksumOf(''), '811c9dc5');
  assert.strictEqual(checksumOf('titanpact'), checksumOf('titanpact'));
  assert.notStrictEqual(checksumOf('titanpact'), checksumOf('titanpacT'));
  const wrapped = wrapEnvelope('{"a":1}');
  assert.strictEqual(unwrapEnvelope(wrapped), '{"a":1}');
  assert.strictEqual(unwrapEnvelope(wrapped.slice(0, -2)), null, 'cut short');
  assert.strictEqual(unwrapEnvelope('{"legacy":true}'), '{"legacy":true}', 'a file from before the envelope passes');
  assert.strictEqual(unwrapEnvelope('garbage'), null);
});

test('saveEnvelope: a read falls back main → next → backup, and says why when nothing reads', () => {
  const ok = (payload: string) => (payload.includes('good') ? { ok: true as const, value: payload } : { ok: false as const, reason: 'refused' });
  const good = (tag: string) => wrapEnvelope(`{"good":"${tag}"}`);
  assert.deepStrictEqual(pickReadable({ main: good('m'), next: good('n'), backup: good('b') }, ok), { value: '{"good":"m"}', source: 'main' });
  assert.deepStrictEqual(pickReadable({ main: good('m').slice(0, -3), next: good('n'), backup: good('b') }, ok), { value: '{"good":"n"}', source: 'next' });
  assert.deepStrictEqual(pickReadable({ main: wrapEnvelope('{"bad":1}'), next: null, backup: good('b') }, ok), { value: '{"good":"b"}', source: 'backup' });
  assert.deepStrictEqual(pickReadable({ main: wrapEnvelope('{"bad":1}') }, ok), { failure: 'refused' });
  assert.strictEqual(pickReadable({}, ok), null);
});
