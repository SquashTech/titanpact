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
import { passives, BROADSIDE_MAGAZINE, BROADSIDE_SHOT, TITANS_MARK_FORCE, titansMarkFor } from '../src/data/passives';
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
import { createRosterEntry, createRunState } from '../src/run/state';
import { recordPermanentStatGains } from '../src/run/runProgress';
import { combatantIdFor } from '../src/run/combatantIds';
import { innatePassiveOf, titansMarkOf } from '../src/run/innate';
import { collectPassiveDamageModifiers } from '../src/engine/combat/passiveEngine';
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

test('build: a roster hero arrives with its innate held, an endure counted and Ironbound locked; a Titanspawn with its Mark', () => {
  // No catalog card endures any more (Lingering was Revenant's until 2026-09-20); the verb stays, so a
  // test-local definition stands in for it on Revenant's entry through bonusPassiveGrants.
  const endure = { id: 'testEndure', name: 'Endure', description: 'test', enduresOnce: true as const };
  const roster = [
    { ...createRosterEntry('r1', 'revenant', heroes.revenant.moveIds), bonusPassiveGrants: [endure.id] },
    createRosterEntry('r2', 'steamColossus', heroes.steamColossus.moveIds),
    createRosterEntry('r3', 'valor', heroes.valor.moveIds),
    createRosterEntry('r4', 'emberling', titanspawn.emberling.moveIds),
  ];
  const state = buildCombatState(
    1,
    allCombatants,
    equipment,
    [{ side: 'A', squad: { activeIds: ['r1', 'r2'], benchIds: ['r3', 'r4'] }, roster }],
    { ...passives, [endure.id]: endure }
  );
  const byRoster = (rosterId: string) => state.combatants[Object.keys(state.combatants).find((k) => k.endsWith(rosterId))!];
  assert.ok('ghostlight' in byRoster('r1').passives);
  assert.strictEqual(byRoster('r1').enduresLeft, 1);
  assert.strictEqual(byRoster('r1').switchLocked, undefined);
  assert.ok('ironbound' in byRoster('r2').passives);
  assert.strictEqual(byRoster('r2').switchLocked, true);
  assert.strictEqual(byRoster('r2').enduresLeft, undefined);
  assert.ok('rallyingStandard' in byRoster('r3').passives);
  assert.ok((titansMarkFor.Fire as string) in byRoster('r4').passives, 'a spawn fields its Mark on either side');
});

// --- Out of the box: an innate a starting kit can fire ---

test('verdurous: every Renew Sylva grants rolls Poison 5 onto a random enemy — Regrowth on both allies is two rolls', () => {
  const state = withPassive(
    createFightState(
      5,
      [
        { combatantId: 'a1', heroId: 'wildOracle', side: 'A' },
        { combatantId: 'a2', heroId: 'valor', side: 'A' },
      ],
      [
        { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
        { combatantId: 'b2', heroId: 'crag', side: 'B' },
      ]
    ),
    'a1',
    'verdurous'
  );
  const r = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'regrowth', declaredTarget: 'a1' }, ...restAll(state).filter((a) => a.combatantId !== 'a1')], config);
  const poisons = r.events.filter((e) => e.type === 'StatusApplied' && e.statusId === 'Poison');
  assert.strictEqual(poisons.length, 2, 'one roll a grant, two grants');
  for (const e of poisons) assert.ok(e.type === 'StatusApplied' && ['b1', 'b2'].includes(e.combatantId), 'onto an enemy');
  const total = statusMagnitude(r.state.combatants.b1, 'Poison') + statusMagnitude(r.state.combatants.b2, 'Poison');
  assert.strictEqual(total, 10, 'two Poison 5s, wherever they landed');
});

// --- The 2026-09-20 pass: five verbs the second wave of innates needed ---

function twoVTwo(seed: number, a1: string, a2: string, b1: string, b2: string): CombatState {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: a1, side: 'A' },
      { combatantId: 'a2', heroId: a2, side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: b1, side: 'B' },
      { combatantId: 'b2', heroId: b2, side: 'B' },
    ]
  );
}

const withStatus = (state: CombatState, id: string, statusId: string, magnitude?: number): CombatState =>
  withField(state, id, { statuses: { ...state.combatants[id].statuses, [statusId]: { statusId, ...(magnitude !== undefined ? { magnitude } : {}) } } });

test('live wire: a StatusDetonated hook — Tempest cashing a Conduct with a Storm hit gains Shield 20; a partner cashing it does not', () => {
  let state = withPassive(twoVTwo(11, 'tempest', 'stormRanger', 'ironWarden', 'crag'), 'a1', 'liveWire');
  state = withStatus(state, 'b1', 'Conduct');
  const r = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'jolt', declaredTarget: 'b1' }, ...restAll(state).filter((a) => a.combatantId !== 'a1')], config);
  const det = r.events.find((e) => e.type === 'StatusDetonated');
  assert.ok(det && det.type === 'StatusDetonated' && det.sourceCombatantId === 'a1', 'the detonation names its striker');
  assert.strictEqual(statusMagnitude(r.state.combatants.a1, 'Shield'), 20);

  let other = withPassive(twoVTwo(12, 'tempest', 'stormRanger', 'ironWarden', 'crag'), 'a1', 'liveWire');
  other = withStatus(other, 'b1', 'Conduct');
  const r2 = resolveRound(other, [{ kind: 'move', combatantId: 'a2', moveId: 'thunderclap', declaredTarget: 'b1' }, ...restAll(other).filter((a) => a.combatantId !== 'a2')], config);
  assert.ok(r2.events.some((e) => e.type === 'StatusDetonated'), 'the partner did cash it');
  assert.strictEqual(statusMagnitude(r2.state.combatants.a1, 'Shield'), 0, 'source-role: not on a partner’s strike');
});

test('arcane repose: a Rested hook — the Shield equals the Mana the Rest restored, and a full pool grants nothing', () => {
  let state = withPassive(twoVTwo(13, 'runescribe', 'valor', 'ironWarden', 'crag'), 'a1', 'arcaneRepose');
  state = withField(state, 'a1', { currentMana: state.combatants.a1.currentMana - 45 });
  const r = resolveRound(state, restAll(state), config);
  const rested = r.events.find((e) => e.type === 'Rested' && e.combatantId === 'a1');
  assert.ok(rested && rested.type === 'Rested' && rested.manaRestored === 45);
  assert.strictEqual(statusMagnitude(r.state.combatants.a1, 'Shield'), 45);

  const full = withPassive(twoVTwo(14, 'runescribe', 'valor', 'ironWarden', 'crag'), 'a1', 'arcaneRepose');
  const r2 = resolveRound(full, restAll(full), config);
  assert.strictEqual(statusMagnitude(r2.state.combatants.a1, 'Shield'), 0, 'nothing restored, no Shield');
  assert.ok(!r2.events.some((e) => e.type === 'StatusApplied' && e.combatantId === 'a1'), 'and no empty status beat');
});

test('neuroplastic: a statDelta read off the event — Cortex gains exactly the Wisdom an enemy lost, and nothing when it rose', () => {
  const state = withPassive(twoVTwo(15, 'mindweaver', 'trance', 'ironWarden', 'crag'), 'a1', 'neuroplastic');
  const before = state.combatants.a1.statModifiers.wisdom ?? 0;
  const r = resolveRound(state, [{ kind: 'move', combatantId: 'a2', moveId: 'enervate', declaredTarget: 'b1' }, ...restAll(state).filter((a) => a.combatantId !== 'a2')], config);
  const drop = r.events.find((e) => e.type === 'StatChanged' && e.combatantId === 'b1' && e.stat === 'wisdom');
  assert.ok(drop && drop.type === 'StatChanged' && drop.delta < 0, 'Enervate lowered its Wisdom');
  const gained = (r.state.combatants.a1.statModifiers.wisdom ?? 0) - before;
  assert.strictEqual(gained, -(drop as { delta: number }).delta, 'that much, as landed');
});

test('boiler: chance and scaledBy — at chance 1 every Mech hit Burns, the magnitude scaled by the owner’s Intelligence and no STAB; at chance 0 never', () => {
  const always = { ...passives, boiler: { ...passives.boiler, reactive: { ...passives.boiler.reactive!, chance: 1 } } };
  const never = { ...passives, boiler: { ...passives.boiler, reactive: { ...passives.boiler.reactive!, chance: 0 } } };
  const base = withPassive(twoVTwo(16, 'forgewright', 'valor', 'ironWarden', 'crag'), 'a1', 'boiler');
  const cast: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'pistonPunch', declaredTarget: 'b1' }, ...restAll(base).filter((a) => a.combatantId !== 'a1')];
  const hit = resolveRound(base, cast, { ...config, passives: always });
  const burn = hit.events.find((e) => e.type === 'StatusApplied' && e.statusId === 'Burn' && e.combatantId === 'b1');
  assert.ok(burn && burn.type === 'StatusApplied', 'Burned');
  // Clockwork is Intelligence 45: StatMult = 1 + (45 - 50) / 100 = 0.95 → 10 × 0.95 = 9.5 → 10 (rounded), and below 50 it can only shrink.
  const expected = Math.round(10 * (1 + (heroes.forgewright.baseStats.intelligence - 50) / 100));
  assert.strictEqual(burn.magnitude, expected);
  const miss = resolveRound(base, cast, { ...config, passives: never });
  assert.ok(!miss.events.some((e) => e.type === 'StatusApplied' && e.statusId === 'Burn'), 'chance 0 never fires');
  assert.ok(passives.boiler.reactive?.chance === 0.3, 'the shipped odds');
});

test('lethal bite: a damage modifier gated on the target — doubles against Bleed AND Poison, nothing against one, and unfired with no target', () => {
  const state = withPassive(twoVTwo(17, 'widow', 'valor', 'ironWarden', 'crag'), 'a1', 'lethalBite');
  const attacker = state.combatants.a1;
  const move = moves.fadeStrike;
  const bare = collectPassiveDamageModifiers(attacker, move, passives, state.combatants.b1);
  assert.deepStrictEqual(bare, []);
  const bleeding = withStatus(state, 'b1', 'Bleed').combatants.b1;
  assert.deepStrictEqual(collectPassiveDamageModifiers(attacker, move, passives, bleeding), [], 'one of the two is not enough');
  const both = withStatus(withStatus(state, 'b1', 'Bleed'), 'b1', 'Poison', 5).combatants.b1;
  assert.deepStrictEqual(collectPassiveDamageModifiers(attacker, move, passives, both), [{ source: 'lethalBite', amount: 1 }]);
  assert.deepStrictEqual(collectPassiveDamageModifiers(attacker, move, passives), [], 'a forecast with no target reports it unfired');
});

test('hunger and ghostlight: out of the box — Lucius drains a fifth of a Mind hit, Revenant gains Spirit Force 10 the moment Torment Haunts', () => {
  const l = withPassive(twoVTwo(18, 'lucius', 'valor', 'ironWarden', 'crag'), 'a1', 'hunger');
  const wounded = withField(l, 'a1', { currentHp: 50 });
  const r = resolveRound(wounded, [{ kind: 'move', combatantId: 'a1', moveId: 'psiBolt', declaredTarget: 'b1' }, ...restAll(wounded).filter((a) => a.combatantId !== 'a1')], config);
  const dealt = r.events.find((e) => e.type === 'DamageDealt' && e.sourceCombatantId === 'a1');
  // A passive's heal lands as an HpChanged (as Sanguine's does), never a Healed — so it feeds no Healed hook.
  const healed = r.events.find((e) => e.type === 'HpChanged' && e.combatantId === 'a1' && e.newHp > e.previousHp);
  assert.ok(dealt && dealt.type === 'DamageDealt' && healed && healed.type === 'HpChanged');
  assert.strictEqual(healed.newHp - healed.previousHp, Math.round(dealt.amount * 0.2));

  const v = withPassive(twoVTwo(19, 'revenant', 'valor', 'ironWarden', 'crag'), 'a1', 'ghostlight');
  const r2 = resolveRound(v, [{ kind: 'move', combatantId: 'a1', moveId: 'torment', declaredTarget: 'b1' }, ...restAll(v).filter((a) => a.combatantId !== 'a1')], config);
  assert.ok(r2.events.some((e) => e.type === 'StatusApplied' && e.statusId === 'Haunt' && e.combatantId === 'b1'));
  assert.strictEqual(statusMagnitude(r2.state.combatants.a1, 'SpiritForce'), 10);
});

// --- The third wave: finishing blows, a run-permanent gain, a target-status read, percent-of-max damage ---

test("tyrant's due: a finishing blow banks +10 Attack for the run, once a fight, and a won fight writes it onto the roster", () => {
  let state = withPassive(twoVTwo(21, 'rex', 'valor', 'ironWarden', 'crag'), 'a1', 'tyrantsDue');
  state = withField(state, 'b1', { currentHp: 1 });
  state = withField(state, 'b2', { currentHp: 1 });
  const kill = (s: CombatState, target: string) =>
    resolveRound(s, [{ kind: 'move', combatantId: 'a1', moveId: 'steamVent', declaredTarget: target }, ...restAll(s).filter((a) => a.combatantId !== 'a1')], config);
  const r1 = kill(state, 'b1');
  const hit = r1.events.find((e) => e.type === 'DamageDealt' && e.sourceCombatantId === 'a1');
  assert.ok(hit && hit.type === 'DamageDealt' && hit.finishing === true, 'the hit is flagged as the finishing blow');
  assert.strictEqual(r1.state.combatants.a1.statModifiers.attack, 10, 'landed this fight');
  assert.deepStrictEqual(r1.state.combatants.a1.permanentStatGains, { attack: 10 }, 'and banked');
  // A second kill the same fight: nothing more.
  const r2 = kill(r1.state, 'b2');
  assert.strictEqual(r2.state.combatants.a1.statModifiers.attack, 10);
  assert.deepStrictEqual(r2.state.combatants.a1.permanentStatGains, { attack: 10 });
  // A hit that does not finish never fires it.
  const fresh = withPassive(twoVTwo(22, 'rex', 'valor', 'ironWarden', 'crag'), 'a1', 'tyrantsDue');
  const r3 = kill(fresh, 'b1');
  assert.strictEqual(r3.state.combatants.a1.statModifiers.attack, undefined);

  // The write-back: the roster keeps it as a bonus grant, beside the Mana Well's.
  const run = { ...createRunState(0, 0), roster: [createRosterEntry('r1', 'rex', heroes.rex.moveIds), createRosterEntry('r9', 'valor', heroes.valor.moveIds)] };
  const banked = { ...r2.state, combatants: { ...r2.state.combatants, [combatantIdFor('A', 'r1')]: { ...r2.state.combatants.a1, combatantId: combatantIdFor('A', 'r1') } } };
  const next = recordPermanentStatGains(run, banked, 'A');
  assert.strictEqual(next.roster[0].bonusStatGrants.attack, 10);
  assert.deepStrictEqual(next.roster[1].bonusStatGrants, {}, 'nobody else');
  assert.strictEqual(recordPermanentStatGains(run, r3.state, 'A'), run, 'nothing banked, nothing written');
});

test('feast: a finishing blow heals Ursa half its max HP; a hit that leaves the target standing heals nothing', () => {
  let state = withPassive(twoVTwo(23, 'ursa', 'valor', 'ironWarden', 'crag'), 'a1', 'feast');
  state = withField(state, 'a1', { currentHp: 10 });
  state = withField(state, 'b1', { currentHp: 1 });
  const maxHp = fixtureMaxHp('ursa');
  const cast = (s: CombatState) => resolveRound(s, [{ kind: 'move', combatantId: 'a1', moveId: 'claw', declaredTarget: 'b1' }, ...restAll(s).filter((a) => a.combatantId !== 'a1')], config);
  const r = cast(state);
  assert.strictEqual(r.state.combatants.a1.currentHp, 10 + Math.round(maxHp * 0.5));
  const standing = withField(withPassive(twoVTwo(24, 'ursa', 'valor', 'ironWarden', 'crag'), 'a1', 'feast'), 'a1', { currentHp: 10 });
  assert.strictEqual(cast(standing).state.combatants.a1.currentHp, 10);
});

test('lament: a hit on a Haunted enemy heals Sorrow for its amount, and nothing on an unhaunted one', () => {
  const base = withField(withPassive(twoVTwo(25, 'sorrow', 'valor', 'ironWarden', 'crag'), 'a1', 'lament'), 'a1', { currentHp: 20 });
  const strike = (s: CombatState) =>
    resolveRound(s, [{ kind: 'move', combatantId: 'a1', moveId: 'phantomStrike', declaredTarget: 'b1' }, ...restAll(s).filter((a) => a.combatantId !== 'a1')], config);
  // Torment (a buff-kind move) sets the table out of the box; the next Phantom Strike drains.
  const r = strike(withStatus(base, 'b1', 'Haunt'));
  const dealt = r.events.find((e) => e.type === 'DamageDealt' && e.sourceCombatantId === 'a1');
  assert.ok(dealt && dealt.type === 'DamageDealt');
  assert.strictEqual(r.state.combatants.a1.currentHp, 20 + dealt.amount);
  assert.strictEqual(strike(base).state.combatants.a1.currentHp, 20, 'not Haunted: nothing');
});

test('nightmare: at round end every Haunted active enemy loses a tenth of its max HP, direct — past a Shield, never an unhaunted one', () => {
  let state = withPassive(twoVTwo(26, 'dread', 'valor', 'ironWarden', 'crag'), 'a1', 'nightmare');
  state = withStatus(state, 'b1', 'Haunt');
  state = withStatus(state, 'b1', 'Shield', 100);
  const b1Max = fixtureMaxHp('ironWarden');
  const r = resolveRound(state, restAll(state), config);
  assert.strictEqual(r.state.combatants.b1.currentHp, b1Max - Math.round(b1Max * 0.1), 'a tenth, straight through');
  assert.strictEqual(statusMagnitude(r.state.combatants.b1, 'Shield'), 100, 'the Shield took none of it');
  assert.strictEqual(r.state.combatants.b2.currentHp, fixtureMaxHp('crag'), 'not Haunted, untouched');
});

test('rivet: at each round end the partner gains 5 Defense, and alone on the field nobody does', () => {
  const state = withPassive(twoVTwo(27, 'ironWarden', 'valor', 'crag', 'rime'), 'a1', 'rivet');
  const r = resolveRound(state, restAll(state), config);
  assert.strictEqual(r.state.combatants.a2.statModifiers.defense, 5);
  assert.strictEqual(r.state.combatants.a1.statModifiers.defense, undefined);
});

// --- Broadside: the one bench-side reaction ---

test('broadside: a cannonball loads each round on the bench (never on the field, capped at the magazine), and every one fires on the way in, direct, then the magazine is empty', () => {
  const holder = (s: CombatState) => withPassive(withPassive(s, 'a3', 'broadside'), 'a3', 'broadsideFire');
  let state = holder(fixture(31));
  assert.strictEqual(state.bench.A[0], 'a3', 'benched from the start');
  for (let i = 0; i < BROADSIDE_MAGAZINE + 2; i++) state = resolveRound(state, restAll(state), config).state;
  assert.strictEqual(statusMagnitude(state.combatants.a3, 'Cannonball'), BROADSIDE_MAGAZINE, 'one a round, and no more than the magazine');
  // On the field it loads nothing.
  let fielded = holder(fixture(32));
  fielded = { ...fielded, active: { ...fielded.active, A: ['a3', 'a2'] }, bench: { ...fielded.bench, A: ['a1'] } };
  fielded = resolveRound(fielded, restAll(fielded), config).state;
  assert.strictEqual(statusMagnitude(fielded.combatants.a3, 'Cannonball'), 0);
  // The firing: a switch brings a3 in with a full magazine.
  const b1Max = fixtureMaxHp(state.combatants.b1.heroId);
  const b2Max = fixtureMaxHp(state.combatants.b2.heroId);
  const r = resolveRound(state, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }, ...restAll(state).filter((a) => a.combatantId !== 'a1')], config);
  assert.strictEqual(r.state.combatants.b1.currentHp, b1Max - Math.round(b1Max * BROADSIDE_SHOT * BROADSIDE_MAGAZINE));
  assert.strictEqual(r.state.combatants.b2.currentHp, b2Max - Math.round(b2Max * BROADSIDE_SHOT * BROADSIDE_MAGAZINE));
  assert.strictEqual(statusMagnitude(r.state.combatants.a3, 'Cannonball'), 0, 'spent');
  // The removal carries what it held: the view draws exactly that many balls (view/combat/TypeFx.tsx).
  const emptied = r.events.find((e) => e.type === 'StatusRemoved' && e.combatantId === 'a3' && e.statusId === 'Cannonball');
  assert.ok(emptied && emptied.type === 'StatusRemoved');
  assert.strictEqual(emptied.magnitude, BROADSIDE_MAGAZINE, 'the magazine it spent, for the volley to be drawn at');
  // Entering with nothing loaded fires nothing — the opening lead included.
  const empty = holder(fixture(33));
  const r2 = resolveRound(empty, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }, ...restAll(empty).filter((a) => a.combatantId !== 'a1')], config);
  assert.strictEqual(r2.state.combatants.b1.currentHp, fixtureMaxHp(empty.combatants.b1.heroId));
});
