// Blessings (docs/blessings-and-statuses.md §1): a knockout's whole loss prevented once, after the
// Shield and never against the Pact Clock or a cost; carried on the roster entry from fight to fight.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState, fixtureMaxHp } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { equipment } from '../src/data/equipment';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { tickPactClock } from '../src/engine/combat/pactClock';
import { applyHpDelta } from '../src/engine/combat/faintHandling';
import type { CombatState } from '../src/engine/state';
import type { Action } from '../src/engine/combat/actions';
import type { DamageDealtEvent } from '../src/engine/events';
import { buildCombatState } from '../src/run/buildCombatState';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { pickSquad } from '../src/run/squad';
import { recordWounds } from '../src/run/wounds';
import { BlessingError, blessOpeningPair, grantBlessing } from '../src/run/blessings';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

function fixture(seed: number): CombatState {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

function withField(state: CombatState, combatantId: string, fields: Partial<CombatState['combatants'][string]>): CombatState {
  return { ...state, combatants: { ...state.combatants, [combatantId]: { ...state.combatants[combatantId], ...fields } } };
}

const maxHp = fixtureMaxHp('cinderKnight');

test('blessing: a lethal loss is prevented whole — HP untouched, no KO, the Blessing spent, a BlessingSpent carrying the loss', () => {
  const state = withField(fixture(1), 'a1', { blessed: true, currentHp: 30 });
  const r = applyHpDelta(state, 1, 'a1', -500, maxHp, { source: 'hit', statusDefs: statuses });
  const a1 = r.state.combatants.a1;
  assert.strictEqual(a1.currentHp, 30, 'prevented, not endured at 1');
  assert.strictEqual(a1.fainted, false);
  assert.strictEqual(a1.blessed, false, 'spent');
  assert.strictEqual(r.prevented, 500);
  assert.strictEqual(r.state.koCount.A, 0);
  assert.ok(r.events.some((e) => e.type === 'BlessingSpent' && e.combatantId === 'a1' && e.prevented === 500));
  assert.ok(!r.events.some((e) => e.type === 'Fainted'));
  const again = applyHpDelta(r.state, 2, 'a1', -500, maxHp, { source: 'hit', statusDefs: statuses });
  assert.strictEqual(again.state.combatants.a1.fainted, true, 'once');
});

test('blessing: a loss that is not lethal never spends it, and a DoT or passive loss (direct) is answered like a hit', () => {
  const graze = applyHpDelta(withField(fixture(2), 'a1', { blessed: true }), 1, 'a1', -10, maxHp);
  assert.strictEqual(graze.state.combatants.a1.blessed, true);
  assert.strictEqual(graze.prevented, 0);
  const tick = applyHpDelta(withField(fixture(2), 'a1', { blessed: true, currentHp: 5 }), 1, 'a1', -50, maxHp);
  assert.strictEqual(tick.state.combatants.a1.currentHp, 5);
  assert.strictEqual(tick.state.combatants.a1.blessed, false);
});

test('blessing: never the Pact Clock, never a cost — recoil and a self-HP price still knock out', () => {
  const state = withField(fixture(3), 'a1', { blessed: true, currentHp: 3 });
  const clock = { startRound: 2, baseFraction: 0.5, stepFraction: 0 };
  const ticked = tickPactClock(state, 2, clock, (id) => fixtureMaxHp(state.combatants[id].heroId));
  assert.strictEqual(ticked.state.combatants.a1.fainted, true, 'the Clock ends stalls and nothing answers it');
  assert.ok(!ticked.events.some((e) => e.type === 'BlessingSpent'));
  const cost = applyHpDelta(state, 1, 'a1', -50, maxHp, { source: 'cost' });
  assert.strictEqual(cost.state.combatants.a1.fainted, true, 'a cost stays a cost');
  assert.strictEqual(cost.state.combatants.a1.blessed, true, 'and it does not spend the Blessing');
});

test('blessing: the Shield takes its share first, and the Blessing is spent only on what gets through to a knockout', () => {
  const shielded = withField(fixture(4), 'a1', { blessed: true, currentHp: 20, statuses: { Shield: { statusId: 'Shield', magnitude: 100 } } });
  const soaked = applyHpDelta(shielded, 1, 'a1', -90, maxHp, { source: 'hit', statusDefs: statuses });
  assert.strictEqual(soaked.absorbed, 90);
  assert.strictEqual(soaked.state.combatants.a1.blessed, true, 'the Shield took it whole');
  const through = applyHpDelta(shielded, 1, 'a1', -150, maxHp, { source: 'hit', statusDefs: statuses });
  assert.strictEqual(through.absorbed, 100);
  assert.strictEqual(through.prevented, 50, 'what reached HP');
  assert.strictEqual(through.state.combatants.a1.currentHp, 20);
  assert.strictEqual(through.state.combatants.a1.blessed, false);
});

test('blessing: Lingering refuses first, so the renewable guard is spent before the scarce one', () => {
  const state = withField(fixture(5), 'a1', { blessed: true, enduresLeft: 1, currentHp: 5 });
  const r = applyHpDelta(state, 1, 'a1', -500, maxHp, { source: 'hit', statusDefs: statuses });
  assert.strictEqual(r.state.combatants.a1.currentHp, 1);
  assert.strictEqual(r.state.combatants.a1.enduresLeft, 0);
  assert.strictEqual(r.state.combatants.a1.blessed, true);
});

test('blessing: in a round, the killing hit lands as a DamageDealt of 0 carrying `prevented`, and the hero stays on the field', () => {
  const state = withField(fixture(6), 'a1', { blessed: true, currentHp: 1 });
  const actions: Action[] = [
    { kind: 'rest', combatantId: 'a1' },
    { kind: 'rest', combatantId: 'a2' },
    { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a1' },
    { kind: 'rest', combatantId: 'b2' },
  ];
  const r = resolveRound(state, actions, config);
  const hit = r.events.find((e): e is DamageDealtEvent => e.type === 'DamageDealt' && e.targetCombatantId === 'a1');
  assert.ok(hit, 'the hit was struck');
  assert.strictEqual(hit.amount, 0);
  assert.ok((hit.prevented ?? 0) > 0);
  assert.ok(!hit.finishing);
  assert.ok(r.state.active.A.includes('a1'));
  assert.strictEqual(r.state.combatants.a1.blessed, false);
});

// --- The run side ---

function seedRun(ids: string[]): RunState {
  let run = createRunState();
  for (const id of ids) run = addRosterEntry(run, createRosterEntry(id, id, heroes[id].moveIds));
  return run;
}

test('blessing: the opening pair are Blessed, a second Blessing is refused, and an unknown hero is an error', () => {
  const run = blessOpeningPair(seedRun(['cinderKnight', 'tidecaller']));
  assert.ok(run.roster.every((e) => e.blessed));
  assert.throws(() => grantBlessing(run, 'cinderKnight'), BlessingError);
  assert.throws(() => grantBlessing(run, 'nobody'), BlessingError);
  const later = addRosterEntry(run, createRosterEntry('ironWarden', 'ironWarden', heroes.ironWarden.moveIds));
  assert.strictEqual(later.roster[2].blessed, false, 'a hero joining later arrives without one');
  assert.strictEqual(grantBlessing(later, 'ironWarden').roster[2].blessed, true);
});

test('blessing: carried into the fight at build, and read back at the end — spent stays spent, unspent stays held', () => {
  const run = blessOpeningPair(seedRun(['cinderKnight', 'tidecaller']));
  const ai = seedRun(['ironWarden']);
  const state = buildCombatState(1, heroes, equipment, [
    { side: 'A', squad: pickSquad(run.roster, ['cinderKnight', 'tidecaller'], 2), roster: run.roster },
    { side: 'B', squad: pickSquad(ai.roster, ['ironWarden']), roster: ai.roster },
  ]);
  assert.strictEqual(state.combatants['A:cinderKnight'].blessed, true);
  assert.strictEqual(state.combatants['B:ironWarden'].blessed, undefined, 'the enemy holds none');
  const spent = withField(state, 'A:cinderKnight', { blessed: false });
  const next = recordWounds(run, spent, 'A', heroes);
  assert.strictEqual(next.roster[0].blessed, false);
  assert.strictEqual(next.roster[1].blessed, true);
  assert.strictEqual(next.roster[1].down, false);
});
