// The event vocabulary's second wave (docs/wild-innates-and-events.md §3.1): weights, costs,
// gambles and recruits, plus the slate's Location coverage.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { passives } from '../src/data/passives';
import { locations } from '../src/data/locations';
import { runEvents, type ResolvableOutcome, type RunEventDefinition } from '../src/data/events';
import { moves } from '../src/data/moves';
import {
  applyEventCost,
  deltaPoints,
  movePoolFor,
  outcomeForAct,
  scaleDeltas,
  applyHeroOutcome,
  costAffordable,
  eventRecruitEntry,
  joinEventRecruit,
  recruitCandidates,
  recruitPool,
  resolveGamble,
  rollRecruits,
  rollRunEvent,
  RunEventError,
} from '../src/run/events';
import { levelAfterEncounters, levelOf } from '../src/run/growth';
import { addRosterEntry, createRosterEntry, createRunState, ROSTER_CAP, type RunState } from '../src/run/state';
import { FINALE_LOCATION_ID } from '../src/data/locations';

function seedRoster(heroIds: string[]): RunState {
  let run = createRunState(0);
  for (const heroId of heroIds) run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  return run;
}

const FULL = Object.keys(heroes).slice(0, ROSTER_CAP);

// --- Weights ---

test('event vocabulary: the roll honours weight — a zero-weight event never lands, a sole weighted one always does', () => {
  const defs: Record<string, RunEventDefinition> = {
    common: { id: 'common', name: 'C', eyebrow: 'T', flavor: 'T', tone: 'gold', outcome: { kind: 'loot', count: 1 }, weight: 10 },
    never: { id: 'never', name: 'N', eyebrow: 'T', flavor: 'T', tone: 'gold', outcome: { kind: 'loot', count: 1 }, weight: 0 },
  };
  for (const roll of [0, 0.3, 0.99]) assert.strictEqual(rollRunEvent(defs, 1, 'wildsEdge', () => roll)?.id, 'common');
});

test('event vocabulary: a lighter event lands in proportion — 6 against 10 sits at 6/16 of the rolls', () => {
  const defs: Record<string, RunEventDefinition> = {
    heavy: { id: 'heavy', name: 'H', eyebrow: 'T', flavor: 'T', tone: 'gold', outcome: { kind: 'loot', count: 1 } },
    light: { id: 'light', name: 'L', eyebrow: 'T', flavor: 'T', tone: 'gold', outcome: { kind: 'loot', count: 1 }, weight: 6 },
  };
  let light = 0;
  const steps = 1600;
  for (let i = 0; i < steps; i++) if (rollRunEvent(defs, 1, null, () => (i + 0.5) / steps)?.id === 'light') light++;
  assert.strictEqual(light, 600);
});

// --- Costs ---

test('event vocabulary: a gold cost comes off the purse, and one the purse cannot cover is refused', () => {
  const run = { ...seedRoster(['cinderKnight']), gold: 50 };
  assert.ok(costAffordable(run, { gold: 50 }));
  assert.ok(!costAffordable(run, { gold: 51 }));
  assert.strictEqual(applyEventCost(run, { gold: 30 }, () => 100).gold, 20);
  assert.throws(() => applyEventCost(run, { gold: 60 }, () => 100), RunEventError);
});

test('event vocabulary: a wound cost takes its share of max HP off every standing hero, never drops one, and skips the downed', () => {
  let run = seedRoster(['cinderKnight', 'tidecaller', 'crag']);
  run = {
    ...run,
    roster: run.roster.map((entry, i) => (i === 1 ? { ...entry, wounds: 95 } : i === 2 ? { ...entry, down: true, wounds: 100 } : entry)),
  };
  const next = applyEventCost(run, { woundAll: 0.2 }, () => 100);
  assert.strictEqual(next.roster[0].wounds, 20);
  assert.strictEqual(next.roster[1].wounds, 99, 'a wound stops at 1 HP');
  assert.strictEqual(next.roster[1].down, false);
  assert.deepStrictEqual(next.roster[2], run.roster[2], 'a downed hero is left as it lies');
});

test('event vocabulary: no cost is no change', () => {
  const run = seedRoster(['cinderKnight']);
  assert.strictEqual(applyEventCost(run, undefined, () => 100), run);
});

// --- Gamble ---

test('event vocabulary: a gamble lands its win under the chance and its loss at or over it', () => {
  assert.strictEqual(resolveGamble(0.6, () => 0.59), 'win');
  assert.strictEqual(resolveGamble(0.6, () => 0.6), 'lose');
  const run = seedRoster(['cinderKnight']);
  const won = applyHeroOutcome(run, 'cinderKnight', { kind: 'statShift', deltas: { speed: 30 } }, passives);
  assert.deepStrictEqual(won.roster[0].bonusStatGrants, { speed: 30 });
  const taught = applyHeroOutcome(run, 'cinderKnight', { kind: 'grantPassive', passiveId: 'imposingPresence' }, passives);
  assert.deepStrictEqual(taught.roster[0].bonusPassiveGrants, ['imposingPresence']);
});

// --- Recruit ---

test('event vocabulary: a recruit never offers a hero already on the roster, and honours its type filter', () => {
  const run = seedRoster(['cinderKnight', 'crimson']);
  const fire = recruitCandidates(run, { types: ['Fire'] }, heroes);
  assert.ok(fire.length > 0);
  assert.ok(!fire.includes('cinderKnight') && !fire.includes('crimson'));
  assert.ok(fire.every((id) => heroes[id].types.includes('Fire')));
  const rolled = rollRecruits(run, { types: ['Fire'] }, 2, heroes, () => 0);
  assert.strictEqual(new Set(rolled).size, rolled.length, 'a recruit roll offers a hero once');
});

test("event vocabulary: a recruit draws from the run's deck, and a run from before decks reads the catalog whole", () => {
  const run = { ...seedRoster(['cinderKnight']), deck: ['crimson', 'tidecaller'] };
  assert.deepStrictEqual(Object.keys(recruitPool(run, heroes)).sort(), ['crimson', 'tidecaller']);
  assert.strictEqual(Object.keys(recruitPool({ deck: null }, heroes)).length, Object.keys(heroes).length);
});

test("event vocabulary: an event recruit arrives RAW at the player's par — its authored kit, no Evolution, nothing taken", () => {
  const run = { ...seedRoster(['cinderKnight']), encountersWon: 6, actNumber: 3 };
  const entry = eventRecruitEntry(run, heroes.crimson, 'crimson', () => 0.5);
  assert.strictEqual(levelOf(entry), levelAfterEncounters(6));
  assert.deepStrictEqual(entry.unlockedMoveIds, [...heroes.crimson.moveIds]);
  assert.deepStrictEqual(entry.chosenPathIds, []);
  assert.strictEqual(entry.scheduleTaken, 0);
});

test('event vocabulary: below the cap a recruit simply joins; at it, someone has to leave', () => {
  const small = seedRoster(['cinderKnight']);
  const joined = joinEventRecruit(small, eventRecruitEntry(small, heroes.crimson, 'crimson'));
  assert.deepStrictEqual(joined.roster.map((e) => e.heroId), ['cinderKnight', 'crimson']);

  const full = seedRoster(FULL);
  const spare = Object.keys(heroes).find((id) => !FULL.includes(id))!;
  const incoming = eventRecruitEntry(full, heroes[spare], spare);
  assert.throws(() => joinEventRecruit(full, incoming), RunEventError);
  const swapped = joinEventRecruit(full, incoming, FULL[0]);
  assert.strictEqual(swapped.roster.length, ROSTER_CAP);
  assert.ok(swapped.roster.some((e) => e.heroId === spare));
  assert.ok(!swapped.roster.some((e) => e.heroId === FULL[0]));
});

// --- The slate ---

test('event slate: every Location a run can visit before the finale holds at least one event of its own', () => {
  const bare = Object.keys(locations).filter(
    (id) => id !== FINALE_LOCATION_ID && !Object.values(runEvents).some((e) => e.locationIds?.includes(id))
  );
  assert.deepStrictEqual(bare, []);
});

// --- Balance (docs/events.md "Balance") ---
// The bar is the Item Cache: the best of three items on the act's curve, ~50 budget points in Act 1.
// An event is never a bad pick — the price of one is not knowing which you will get.

const CACHE_FLOOR_ACT_ONE = 45;

function everyOutcome(): { id: string; outcome: ResolvableOutcome }[] {
  return Object.values(runEvents).flatMap((event) =>
    event.outcome.kind === 'choice'
      ? event.outcome.options.map((option) => ({ id: `${event.id}/${option.label}`, outcome: option.outcome }))
      : [{ id: event.id, outcome: event.outcome }]
  );
}

test('event balance: every stat trade nets at least an Item Cache in Act 1, costs included', () => {
  for (const { id, outcome } of everyOutcome()) {
    if (outcome.kind !== 'statShift') continue;
    const points = deltaPoints(outcome.deltas);
    assert.ok(points >= CACHE_FLOOR_ACT_ONE, `${id} nets ${points.toFixed(1)} points`);
  }
});

test('event balance: a gamble never loses — both branches pay, and the expected payout clears the cache', () => {
  for (const { id, outcome } of everyOutcome()) {
    if (outcome.kind !== 'gamble') continue;
    for (const branch of [outcome.win, outcome.lose]) {
      if (branch.kind !== 'statShift') continue;
      assert.ok(Object.values(branch.deltas).every((amount) => (amount ?? 0) > 0), `${id}: a branch takes something away`);
    }
    const value = (branch: typeof outcome.win) => (branch.kind === 'statShift' ? deltaPoints(branch.deltas) : CACHE_FLOOR_ACT_ONE);
    const expected = outcome.chance * value(outcome.win) + (1 - outcome.chance) * value(outcome.lose);
    assert.ok(expected >= CACHE_FLOOR_ACT_ONE + 10, `${id} pays ${expected.toFixed(1)} on average — a gamble should beat the cache`);
    assert.ok(value(outcome.win) > value(outcome.lose), `${id}: the jackpot is not the bigger prize`);
  }
});

test('event balance: gains grow with the act as the cache does — doubled by Act 5, costs left as written, still multiples of 5', () => {
  assert.deepStrictEqual(scaleDeltas({ hp: -20, attack: 30, speed: 25 }, 1), { hp: -20, attack: 30, speed: 25 });
  assert.deepStrictEqual(scaleDeltas({ hp: -20, attack: 30, speed: 25 }, 5), { hp: -20, attack: 60, speed: 50 });
  for (let act = 1; act <= 6; act++) {
    for (const { outcome } of everyOutcome()) {
      const scaled = outcomeForAct(outcome, act);
      const lines = scaled.kind === 'statShift' ? [scaled.deltas] : scaled.kind === 'gamble' ? [scaled.win, scaled.lose].flatMap((b) => (b.kind === 'statShift' ? [b.deltas] : [])) : [];
      for (const line of lines) for (const amount of Object.values(line)) assert.strictEqual(Math.abs(amount ?? 0) % 5, 0);
    }
  }
});

test('event balance: a typed move event teaches a Mid or Late move, never an Early one', () => {
  for (const { id, outcome } of everyOutcome()) {
    if (outcome.kind !== 'learnMove' || !outcome.pool?.types) continue;
    const pool = movePoolFor(outcome.pool, moves);
    assert.ok(pool.length > 0, `${id} has an empty pool`);
    assert.ok(pool.every((moveId) => (moves[moveId].tier ?? 'early') !== 'early'), `${id} can roll an Early move`);
  }
});
