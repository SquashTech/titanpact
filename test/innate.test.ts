// Innate passives (docs/innate-passives.md): the three engine verbs the overhaul added — the
// Titan's Mark (a Force stack that climbs each round on the field), Lingering (a knockout refused
// once) and Ironbound (a hero that never leaves on its own) — and the fight build that reads them
// off the definition. The catalog rules (one a hero, a verb never a number) are test/roster.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState, fixtureMaxHp } from './fixtures';
import { heroes } from '../src/data/heroes';
import { allCombatants } from '../src/data/content';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives, TITANS_MARK_FORCE, titansMarkFor } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { equipment } from '../src/data/equipment';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { applyForcedReplacement } from '../src/engine/combat/switching';
import { tickPactClock } from '../src/engine/combat/pactClock';
import { applyHpDelta } from '../src/engine/combat/faintHandling';
import { canSwitchOut, statusMagnitude } from '../src/engine/state';
import type { CombatState, PassiveInstance } from '../src/engine/state';
import type { Action } from '../src/engine/combat/actions';
import { buildCombatState } from '../src/run/buildCombatState';
import { createRosterEntry } from '../src/run/state';
import { innatePassiveOf, titansMarkOf } from '../src/run/innate';
import { titanspawn } from '../src/data/titanspawn';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

function fixture(seed: number): CombatState {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
      { combatantId: 'a3', heroId: 'ironWarden', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
      { combatantId: 'b3', heroId: 'crag', side: 'B' },
    ]
  );
}

function withPassive(state: CombatState, combatantId: string, passiveId: string): CombatState {
  const combatant = state.combatants[combatantId];
  const instance: PassiveInstance = { passiveId, stacks: 1 };
  return { ...state, combatants: { ...state.combatants, [combatantId]: { ...combatant, passives: { ...combatant.passives, [passiveId]: instance } } } };
}

function withField(state: CombatState, combatantId: string, fields: Partial<CombatState['combatants'][string]>): CombatState {
  return { ...state, combatants: { ...state.combatants, [combatantId]: { ...state.combatants[combatantId], ...fields } } };
}

const restAll = (state: CombatState): Action[] =>
  (['A', 'B'] as const).flatMap((side) => state.active[side].filter((id): id is string => !!id).map((combatantId) => ({ kind: 'rest', combatantId }) as Action));

// --- The Titan's Mark ---

test("mark: a Force stack that climbs by TITANS_MARK_FORCE each round the holder stands on the field, and not on the bench", () => {
  const mark = titansMarkFor.Fire as string;
  let state = withPassive(withPassive(fixture(1), 'b1', mark), 'b3', mark);
  assert.strictEqual(statusMagnitude(state.combatants.b1, 'FireForce'), 0);
  state = resolveRound(state, restAll(state), config).state;
  assert.strictEqual(statusMagnitude(state.combatants.b1, 'FireForce'), TITANS_MARK_FORCE, 'one round on the field, one tick');
  state = resolveRound(state, restAll(state), config).state;
  assert.strictEqual(statusMagnitude(state.combatants.b1, 'FireForce'), TITANS_MARK_FORCE * 2, 'it is additive and never decays');
  assert.strictEqual(statusMagnitude(state.combatants.b3, 'FireForce'), 0, 'a benched holder is out of it, as it is out of the Clock');
});

test('mark: every spawn carries exactly its own type, read by titansMarkOf, and it is not an innate', () => {
  for (const spawn of Object.values(titanspawn)) {
    assert.strictEqual(titansMarkOf(spawn)?.id, titansMarkFor[spawn.types[0] as keyof typeof titansMarkFor]);
    assert.strictEqual(innatePassiveOf(spawn), null, `${spawn.id} has an innate beside its Mark`);
    const def = passives[titansMarkOf(spawn)!.id];
    assert.ok(def.reactive?.effect.kind === 'applyStatus' && def.reactive.effect.statusId === `${spawn.types[0]}Force`, `${spawn.id}'s Mark is not its type's Force`);
  }
  assert.strictEqual(titansMarkOf(heroes.valor), null);
  assert.strictEqual(innatePassiveOf(heroes.valor)?.id, 'rallyingStandard');
});

// --- Lingering ---

test('lingering: the first knockout is refused at 1 HP with an Endured event, and the second is real', () => {
  const maxHp = fixtureMaxHp('cinderKnight');
  let state = withField(fixture(2), 'a1', { enduresLeft: 1, currentHp: 5 });
  let r = applyHpDelta(state, 1, 'a1', -500, maxHp, { source: 'hit', statusDefs: statuses });
  assert.strictEqual(r.state.combatants.a1.currentHp, 1);
  assert.strictEqual(r.state.combatants.a1.fainted, false);
  assert.strictEqual(r.state.combatants.a1.enduresLeft, 0, 'spent');
  assert.ok(r.events.some((e) => e.type === 'Endured' && e.combatantId === 'a1'));
  assert.ok(!r.events.some((e) => e.type === 'Fainted'));
  assert.strictEqual(r.state.koCount.A, 0);
  state = r.state;
  r = applyHpDelta(state, 2, 'a1', -500, maxHp, { source: 'hit', statusDefs: statuses });
  assert.strictEqual(r.state.combatants.a1.fainted, true, 'once');
  assert.ok(r.events.some((e) => e.type === 'Fainted'));
});

test('lingering: a floor, not a trigger — the Pact Clock is refused the same way, and a non-lethal loss never spends it', () => {
  const state = withField(fixture(3), 'a1', { enduresLeft: 1, currentHp: 3 });
  const clock = { startRound: 2, baseFraction: 0.5, stepFraction: 0 };
  const ticked = tickPactClock(state, 2, clock, (id) => fixtureMaxHp(state.combatants[id].heroId));
  assert.strictEqual(ticked.state.combatants.a1.currentHp, 1);
  assert.strictEqual(ticked.state.combatants.a1.fainted, false);
  assert.strictEqual(ticked.state.combatants.a1.enduresLeft, 0);
  const grazed = applyHpDelta(fixture(3), 1, 'a1', -10, fixtureMaxHp('cinderKnight'));
  assert.strictEqual(withField(fixture(3), 'a1', { enduresLeft: 1 }).combatants.a1.enduresLeft, 1);
  assert.strictEqual(grazed.state.combatants.a1.enduresLeft, undefined, 'a hero without it never gains it');
  const keep = applyHpDelta(withField(fixture(3), 'a1', { enduresLeft: 1 }), 1, 'a1', -10, fixtureMaxHp('cinderKnight'));
  assert.strictEqual(keep.state.combatants.a1.enduresLeft, 1, 'unspent on a loss that was not lethal');
});

// --- Ironbound ---

test('ironbound: a declared switch is a no-op and a pivot degrades to its buff, while a forced replacement still happens', () => {
  let state = withField(fixture(4), 'a1', { switchLocked: true });
  assert.strictEqual(canSwitchOut(state, 'a1'), false);
  assert.strictEqual(canSwitchOut(state, 'a2'), true, 'per hero, not per side');
  const r = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }, ...restAll(state).filter((a) => a.combatantId !== 'a1')], config);
  assert.ok(r.state.active.A.includes('a1'), 'still on the field');
  assert.ok(!r.events.some((e) => e.type === 'SwitchedIn' && e.side === 'A'));
  // Downed, it is replaced like anyone: the lock is on leaving under its own power.
  state = withField(r.state, 'a1', { fainted: true, currentHp: 0 });
  state = { ...state, active: { ...state.active, A: [null, state.active.A[1]] } };
  const replaced = applyForcedReplacement(state, 2, 'A', 0, 'a3', statuses);
  assert.strictEqual(replaced.state.active.A[0], 'a3');
});

// --- The fight build ---

test('build: a roster hero arrives with its innate held, Lingering counted and Ironbound locked; a Titanspawn with its Mark', () => {
  const roster = [
    createRosterEntry('r1', 'revenant', heroes.revenant.moveIds),
    createRosterEntry('r2', 'steamColossus', heroes.steamColossus.moveIds),
    createRosterEntry('r3', 'valor', heroes.valor.moveIds),
    createRosterEntry('r4', 'emberling', titanspawn.emberling.moveIds),
  ];
  const state = buildCombatState(
    1,
    allCombatants,
    equipment,
    [{ side: 'A', squad: { activeIds: ['r1', 'r2'], benchIds: ['r3', 'r4'] }, roster }],
    passives
  );
  const byRoster = (rosterId: string) => state.combatants[Object.keys(state.combatants).find((k) => k.endsWith(rosterId))!];
  assert.ok('lingering' in byRoster('r1').passives);
  assert.strictEqual(byRoster('r1').enduresLeft, 1);
  assert.strictEqual(byRoster('r1').switchLocked, undefined);
  assert.ok('ironbound' in byRoster('r2').passives);
  assert.strictEqual(byRoster('r2').switchLocked, true);
  assert.strictEqual(byRoster('r2').enduresLeft, undefined);
  assert.ok('rallyingStandard' in byRoster('r3').passives);
  assert.ok((titansMarkFor.Fire as string) in byRoster('r4').passives, 'a spawn fields its Mark on either side');
});
