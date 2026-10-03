// The event vocabulary's second wave (docs/wild-innates-and-events.md §3.1): weights, costs,
// gambles and recruits, plus the slate's Location coverage.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { passives } from '../src/data/passives';
import { locations } from '../src/data/locations';
import { runEvents, type RunEventDefinition } from '../src/data/events';
import {
  applyEventCost,
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
