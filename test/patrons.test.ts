import * as assert from 'assert';
import { test } from './harness';
import { equipment } from '../src/data/equipment';
import { heroes } from '../src/data/heroes';
import { patronMoves, patronPassives, patronUniques, patrons } from '../src/data/patrons';
import { classes } from '../src/data/classes';
import { UNIQUE_EQUIPMENT } from '../src/data/equipment';
import { rollClassOffers } from '../src/run/classes';
import { generateMap, PATRON_ROWS } from '../src/run/map';
import {
  capstoneCandidates,
  createPatronState,
  drawSeatOffers,
  forgeUnique,
  liftHeldItem,
  meetPatron,
  patronAtSeat,
  patronItemId,
  PROMISED_SEATS,
  ROAD_TRUST_CAP,
  rollPromise,
  SEAT_COUNT,
  seatIndexFor,
  studentOf,
  setStudent,
} from '../src/run/patrons';
import { advanceToNode } from '../src/run/runProgress';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';

function mappedRun(seed = 7, actNumber = 1): RunState {
  let run: RunState = { ...createRunState(0), actNumber, map: generateMap(seed, actNumber) };
  run = addRosterEntry(run, createRosterEntry('a', 'cinderKnight', heroes.cinderKnight.moveIds));
  return addRosterEntry(run, createRosterEntry('b', 'cinderKnight', heroes.cinderKnight.moveIds));
}

test('patrons: the seats are rows 2 and 6 of acts 1-4, numbered 0-7 down the run', () => {
  assert.deepStrictEqual(PATRON_ROWS, [2, 6]);
  assert.strictEqual(seatIndexFor(1, 2, PATRON_ROWS), 0);
  assert.strictEqual(seatIndexFor(1, 6, PATRON_ROWS), 1);
  assert.strictEqual(seatIndexFor(4, 6, PATRON_ROWS), SEAT_COUNT - 1);
  assert.strictEqual(seatIndexFor(1, 3, PATRON_ROWS), null);
  assert.strictEqual(seatIndexFor(5, 2, PATRON_ROWS), null, 'the finale has no seat');
});

test('patrons: a seat offers two different patrons, drawn the moment it comes into reach and kept', () => {
  let run = mappedRun();
  const rows = run.map!.rows;
  run = advanceToNode(run, rows[0][0]);
  assert.strictEqual(patronAtSeat(run, 0, 0), null, 'row 2 is not in reach from the opener');
  run = advanceToNode(run, rows[1][0]);
  const offers = [patronAtSeat(run, 0, 0), patronAtSeat(run, 0, 1)];
  assert.ok(offers.every((id) => id && patrons[id]), `${offers}`);
  assert.notStrictEqual(offers[0], offers[1]);
  // Taking a patron changes Trust, but the seat in front of you does not re-roll under it.
  const met = meetPatron(run, offers[0]!, 0).run;
  assert.deepStrictEqual([patronAtSeat(met, 0, 0), patronAtSeat(met, 0, 1)], offers);
});

test('patrons: a meeting raises Trust by one and pays that rung; the first seat is promised three more', () => {
  const run = mappedRun();
  const first = meetPatron(run, 'swordsman', 0);
  assert.strictEqual(first.rung, 1);
  assert.strictEqual(first.run.patrons!.trust.swordsman, 1);
  const promise = first.run.patrons!.promise!;
  assert.strictEqual(promise.patronId, 'swordsman');
  assert.strictEqual(promise.seats.length, PROMISED_SEATS);
  assert.ok(promise.seats.every((s) => s >= 1 && s < SEAT_COUNT), `${promise.seats}`);
  assert.strictEqual(new Set(promise.seats).size, PROMISED_SEATS);
  // Only the first seat promises.
  const second = meetPatron(first.run, 'archmage', 1);
  assert.strictEqual(second.run.patrons!.promise!.patronId, 'swordsman');
  assert.strictEqual(meetPatron(run, 'archmage', 1).run.patrons!.promise, null);
});

test('patrons: the promised patron takes a tile at every promised seat', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const state = { ...createPatronState(), trust: { swordsman: 1 }, promise: rollPromise('swordsman', seed) };
    for (const seat of state.promise.seats) {
      assert.ok(drawSeatOffers(state, patrons, seat, seed).includes('swordsman'), `seed ${seed} seat ${seat}`);
    }
  }
});

test('patrons: a patron at the road cap is offered no more, and is owed the capstone', () => {
  const state = { ...createPatronState(), trust: { swordsman: ROAD_TRUST_CAP } };
  for (let seat = 0; seat < SEAT_COUNT; seat++) assert.ok(!drawSeatOffers(state, patrons, seat, 11).includes('swordsman'));
  assert.deepStrictEqual(capstoneCandidates({ patrons: state }, patrons), ['swordsman']);
  assert.deepStrictEqual(capstoneCandidates({ patrons: createPatronState() }, patrons), []);
});

test('patrons: the student is whoever took the first rung, while they stay on the roster', () => {
  const run = setStudent(mappedRun(), 'swordsman', 'a');
  assert.strictEqual(studentOf(run, 'swordsman'), 'a');
  assert.strictEqual(studentOf({ ...run, roster: run.roster.filter((r) => r.rosterId !== 'a') }, 'swordsman'), null);
});

test('patrons: a lift takes the piece a tier up inside the act window; the Unique keeps its enchant', () => {
  let run = mappedRun(7, 2);
  run = { ...run, roster: run.roster.map((r) => (r.rosterId === 'a' ? { ...r, equipment: ['sword.rare.blazing'] } : r)) };
  const lifted = liftHeldItem(run, 'a', 'sword', equipment);
  assert.deepStrictEqual(lifted.roster[0].equipment, ['sword.epic.blazing']);
  const act1 = { ...run, actNumber: 1, roster: run.roster.map((r) => (r.rosterId === 'a' ? { ...r, equipment: ['sword.epic'] } : r)) };
  assert.deepStrictEqual(liftHeldItem(act1, 'a', 'sword', equipment).roster[0].equipment, ['sword.epic'], 'Act 1 stops short of Legendary');
  const forged = forgeUnique(run, 'a', 'sword', 'moonfang');
  assert.deepStrictEqual(forged.roster[0].equipment, ['moonfang.blazing']);
  assert.ok(equipment['moonfang.blazing']);
  assert.strictEqual(forgeUnique(run, 'b', 'sword', 'moonfang'), run, 'nothing to forge on a hero holding no Sword');
});

test('patrons: content — five rungs each, every id real, nothing leaks into another pool', () => {
  for (const patron of Object.values(patrons)) {
    assert.strictEqual(patron.rungs.length, 5, patron.id);
    for (const step of patron.rungs.flat()) {
      if (step.kind === 'item' || step.kind === 'liftItem') assert.ok(equipment[patronItemId(step.familyId, 1)], `${patron.id}: ${step.familyId}`);
      if (step.kind === 'unique') assert.ok(patronUniques[step.uniqueId] && equipment[step.uniqueId], `${patron.id}: ${step.uniqueId}`);
      if (step.kind === 'move') assert.ok(patronMoves[step.moveId], `${patron.id}: ${step.moveId}`);
      if (step.kind === 'passive') assert.ok(patronPassives[step.passiveId], `${patron.id}: ${step.passiveId}`);
      if (step.kind === 'masterClass') for (const id of step.classIds) assert.ok(classes[id]?.master, `${patron.id}: ${id}`);
    }
  }
  for (const id of Object.keys(patronUniques)) assert.ok(!UNIQUE_EQUIPMENT.some((u) => u.id === id), `${id} is a Guardian drop`);
  for (const move of Object.values(patronMoves)) {
    assert.strictEqual(move.typeFollowsUser, true, move.id);
    assert.strictEqual(move.tier, undefined, move.id);
  }
  // A Master Class is never rolled at an ordinary meeting.
  let i = 0;
  const rng = () => ((i = (i * 9301 + 49297) % 233280) / 233280);
  for (let n = 0; n < 200; n++) assert.ok(rollClassOffers(classes, rng, 5).every((c) => !c.master));
});
