// The Titan's Eyes (docs/titan-eyes.md, src/data/enemies.ts titanEyes): the gaze telegraph, the
// taunt that takes a Regard, the reserve phases that hold a pair until the phase before it is
// down, the AI that fires once it has looked, and — since §10 — the one finale fight they sit
// behind: the Herald's ward, the Withering Gaze and the Clock that counts from the phase.

import * as assert from 'assert';
import { test } from './harness';
import { allCombatants } from '../src/data/content';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { ENDBRINGER_ID, EYE_IDS, EYE_PHASES, LEFT_EYE_ID, RIGHT_EYE_ID, finaleEnemies, titanEyes, enemies } from '../src/data/enemies';
import { HERALDS_STANDARD_ID, WITHERING_GAZE_CADENCE, WITHERING_GAZE_FALLS_ID, WITHERING_GAZE_RETURNS_ID, boonPassives } from '../src/data/passives';
import { WITHERING_GAZE_FRACTION } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { applyStatus, selectableTargets } from '../src/engine/combat/statusEngine';
import { applyForcedReplacement, replacementCandidates } from '../src/engine/combat/switching';
import { resolvePassiveReactions } from '../src/engine/combat/passiveEngine';
import { wardOn } from '../src/engine/combat/ward';
import { DEFAULT_PACT_CLOCK, pactRoundOf } from '../src/engine/combat/pactClock';
import { createCombatant, getMaxHp, getMaxMana, hasStatus, type CombatState, type Side } from '../src/engine/state';
import { createRng } from '../src/engine/rng/seededRng';
import { pickAiAction } from '../src/run/ai';
import { generateFinaleEncounter } from '../src/run/enemyGen';
import { buildCombatState } from '../src/run/buildCombatState';
import { equipment } from '../src/data/equipment';
import { locations } from '../src/data/locations';
import { COMBAT_BUDGET_STATS, statBudgetTotal } from '../src/run/statBudget';
import { guardianMarkup, isGuardianFigure } from '../src/view/shared/guardianFigures';
import { cinematicEntranceFor } from '../src/view/shared/entrances';

const config = { typeChart, heroes: allCombatants, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

interface Placed {
  id: string;
  heroId: string;
  side: Side;
  /** A later phase's reserve (Combatant.reservePhase). */
  phase?: number;
}

/** Full pools, first two a side active, the rest benched; `phase` marks a held-back bench entry. Innate passives are held. */
function fight(seed: number, a: Placed[], b: Placed[]): CombatState {
  const combatants: CombatState['combatants'] = {};
  for (const c of [...a, ...b]) {
    const hero = allCombatants[c.heroId];
    const blank = createCombatant(c.id, c.heroId, c.side, 0, 0);
    const held = Object.fromEntries((hero.passiveIds ?? []).map((id) => [id, { passiveId: id, stacks: 1 }]));
    combatants[c.id] = {
      ...blank,
      currentHp: getMaxHp(hero, blank),
      currentMana: getMaxMana(hero, blank),
      passives: held,
      ...(c.phase !== undefined ? { reservePhase: c.phase } : {}),
    };
  }
  return {
    seed,
    rngState: createRng(seed),
    round: 1,
    active: { A: [a[0]?.id ?? null, a[1]?.id ?? null], B: [b[0]?.id ?? null, b[1]?.id ?? null] },
    bench: { A: a.slice(2).map((c) => c.id), B: b.slice(2).map((c) => c.id) },
    combatants,
    koCount: { A: 0, B: 0 },
    activeFieldEffect: null,
  };
}

/** The Eyes on the field, a second pair of bodies held in a later phase — the engine's phase rule is generic, so a fixture may stage one however it likes. */
const eyesFixture = (seed: number) =>
  fight(
    seed,
    [
      { id: 'a1', heroId: 'valor', side: 'A' },
      { id: 'a2', heroId: 'crag', side: 'A' },
      { id: 'a3', heroId: 'tempest', side: 'A' },
    ],
    [
      { id: 'b1', heroId: LEFT_EYE_ID, side: 'B' },
      { id: 'b2', heroId: RIGHT_EYE_ID, side: 'B' },
      { id: 'b3', heroId: 'pyroclast', side: 'B', phase: 1 },
      { id: 'b4', heroId: 'breakwater', side: 'B', phase: 1 },
    ]
  );

/** The merged finale's shape (docs/titan-eyes.md §10): the Herald and two spawn, then the Eyes — plus a third phase of spawn to prove the rule past two. */
const heraldFixture = (seed: number) =>
  fight(
    seed,
    [
      { id: 'a1', heroId: 'valor', side: 'A' },
      { id: 'a2', heroId: 'crag', side: 'A' },
      { id: 'a3', heroId: 'tempest', side: 'A' },
    ],
    [
      { id: 'h', heroId: ENDBRINGER_ID, side: 'B' },
      { id: 's1', heroId: 'pyroclast', side: 'B' },
      { id: 's2', heroId: 'breakwater', side: 'B' },
      { id: 'e1', heroId: LEFT_EYE_ID, side: 'B', phase: 1 },
      { id: 'e2', heroId: RIGHT_EYE_ID, side: 'B', phase: 1 },
      { id: 'w1', heroId: 'pyroclast', side: 'B', phase: 2 },
      { id: 'w2', heroId: 'breakwater', side: 'B', phase: 2 },
    ]
  );

const down = (s: CombatState, id: string): CombatState => ({
  ...s,
  combatants: { ...s.combatants, [id]: { ...s.combatants[id], fainted: true, currentHp: 0 } },
  active: { ...s.active, B: s.active.B.map((slot) => (slot === id ? null : slot)) as [string | null, string | null] },
  bench: { ...s.bench, B: s.bench.B.filter((b) => b !== id) },
});

const aiCtx = { heroes: allCombatants, moves, statuses, typeChart, moveIdsFor: (id: string) => allCombatants[eyesFixture(1).combatants[id]?.heroId ?? id]?.moveIds ?? [] };

test('titanEyes: two mono-Ancient definitions, held apart from the champion pool, one phase', () => {
  assert.deepStrictEqual([...EYE_IDS], [LEFT_EYE_ID, RIGHT_EYE_ID]);
  for (const id of EYE_IDS) {
    const eye = titanEyes[id];
    assert.deepStrictEqual([...eye.types], ['Ancient'], `${id} is not mono-Ancient`);
    assert.ok(!(id in enemies), `${id} leaked into the champion pool`);
    assert.strictEqual(eye.starter, false);
    for (const moveId of eye.moveIds) assert.ok(moves[moveId], `${id} points at missing ${moveId}`);
    assert.strictEqual(eye.baseStats.attack, 40, 'Attack is the dump stat');
  }
  const total = (id: string) => statBudgetTotal(titanEyes[id].baseStats, COMBAT_BUDGET_STATS);
  assert.ok(total(RIGHT_EYE_ID) > total(LEFT_EYE_ID), 'the one that holds carries the bigger body');
  // The pair share the gaze and differ beside it.
  for (const id of EYE_IDS) assert.ok(titanEyes[id].moveIds.includes('gaze') && titanEyes[id].moveIds.includes('regard'), id);
  assert.deepStrictEqual(EYE_PHASES, [[LEFT_EYE_ID, RIGHT_EYE_ID]], 'one phase, the pair');
});

test('titanEyes: Gaze goes first and marks one hero Beheld through the whole of the next round', () => {
  const state = eyesFixture(11);
  const r1 = resolveRound(state, [{ kind: 'move', combatantId: 'b1', moveId: 'gaze', declaredTarget: 'a1' }], config);
  assert.ok(hasStatus(r1.state.combatants.a1, 'Beheld'), 'marked at the end of the round it was cast in');
  assert.strictEqual(moves.gaze.priority, 1);
  const r2 = resolveRound(r1.state, [], config);
  assert.ok(!hasStatus(r2.state.combatants.a1, 'Beheld'), 'gone at the end of the next round');
});

test('titanEyes: Regard can only be declared at a Beheld hero — with nobody marked it is blocked, and the AI never picks it', () => {
  const state = eyesFixture(12);
  const blocked = resolveRound(state, [{ kind: 'move', combatantId: 'b1', moveId: 'regard', declaredTarget: 'a1' }], config);
  assert.ok(blocked.events.some((e) => e.type === 'ActionBlocked' && (e as any).reason === 'targetStatusMissing'));
  for (let i = 0; i < 40; i++) {
    const action = pickAiAction(state, 'b1', { ...aiCtx, random: () => (i % 40) / 40 });
    assert.notStrictEqual(action.kind === 'move' ? action.moveId : '', 'regard', 'the AI declared a Regard with nobody Beheld');
  }
});

test('titanEyes: switching the Beheld hero out breaks the gaze, and the Regard has nothing to land on', () => {
  const state = eyesFixture(13);
  const marked = applyStatus(state, 1, 'a1', statuses.Beheld, { duration: 2 }).state;
  const after = resolveRound(
    marked,
    [
      { kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' },
      { kind: 'move', combatantId: 'b1', moveId: 'regard', declaredTarget: 'a1' },
    ],
    config
  );
  assert.ok(!hasStatus(after.state.combatants.a1, 'Beheld'), 'Beheld clears on switch');
  assert.ok(after.events.some((e) => e.type === 'ActionBlocked' && (e as any).reason === 'targetStatusMissing'), 'the Regard fizzled');
  assert.ok(!after.events.some((e) => e.type === 'DamageDealt' && (e as any).moveId === 'regard'));
});

test('titanEyes: a taunt takes the Regard — the pull lands on the taunter although it is not Beheld (taunt wins)', () => {
  const state = eyesFixture(14);
  let s = applyStatus(state, 1, 'a1', statuses.Beheld, { duration: 2 }).state;
  s = applyStatus(s, 1, 'a2', statuses.Provoke, { duration: 1 }).state;
  const after = resolveRound(s, [{ kind: 'move', combatantId: 'b1', moveId: 'regard', declaredTarget: 'a1' }], config);
  const hit = after.events.find((e) => e.type === 'DamageDealt') as any;
  assert.ok(hit, 'the Regard landed');
  assert.strictEqual(hit.targetCombatantId, 'a2', 'on the taunter');
  assert.ok(moves.regard.gateYieldsToRedirect);
});

test('titanEyes: a Regard on a Beheld hero lands as a hit, and the AI prefers it to gazing again', () => {
  const state = eyesFixture(15);
  const marked = applyStatus(state, 1, 'a1', statuses.Beheld, { duration: 2 }).state;
  const after = resolveRound(marked, [{ kind: 'move', combatantId: 'b1', moveId: 'regard', declaredTarget: 'a1' }], config);
  const hit = after.events.find((e) => e.type === 'DamageDealt') as any;
  assert.ok(hit && hit.targetCombatantId === 'a1' && hit.amount > 0);
  let regards = 0;
  const trials = 200;
  for (let i = 0; i < trials; i++) {
    let n = i;
    const random = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    const action = pickAiAction(marked, 'b1', { ...aiCtx, random });
    if (action.kind === 'move' && action.moveId === 'regard') regards++;
  }
  // Gaze is filtered as inert (a1 already Beheld); Regard at 3x weight against two neutral moves ≈ 60%.
  assert.ok(regards > trials * 0.45 && regards < trials * 0.8, `the AI Regarded ${regards}/${trials} times`);
});

test('titanEyes: a reserve waits for the field to empty — the first faint brings nobody in, the second brings the next phase', () => {
  const state = eyesFixture(16);
  assert.deepStrictEqual(replacementCandidates(state, 'B'), [], 'nothing may enter while both Eyes stand');
  const oneDown = down(state, 'b1');
  assert.deepStrictEqual(replacementCandidates(oneDown, 'B'), [], 'a reserve never replaces a first faint');
  const bothDown = down(oneDown, 'b2');
  assert.deepStrictEqual(replacementCandidates(bothDown, 'B'), ['b3', 'b4']);
  const entered = applyForcedReplacement(bothDown, 3, 'B', 0, 'b3', statuses);
  assert.strictEqual(entered.state.active.B[0], 'b3');
  // The first reserve in does not close the door on the second: the pair enter together.
  assert.deepStrictEqual(replacementCandidates(entered.state, 'B'), ['b4']);
  // A player bench with no reserves is untouched by the rule.
  assert.deepStrictEqual(replacementCandidates(state, 'A'), ['a3']);
});

test('titanEyes: phases — the spawn replace freely, the Eyes wait on the company, a later phase waits on them', () => {
  let state = heraldFixture(17);
  assert.deepStrictEqual(replacementCandidates(state, 'B'), ['s2'], 'phase 0 replaces from its own bench, never from an Eye');
  state = down(state, 's1');
  state = applyForcedReplacement(state, 2, 'B', 1, 's2', statuses).state;
  state = down(state, 's2');
  assert.deepStrictEqual(replacementCandidates(state, 'B'), [], 'the Herald still stands: no Eye while any of phase 0 does');
  state = down(state, 'h');
  assert.deepStrictEqual(replacementCandidates(state, 'B'), ['e1', 'e2'], 'phase 1 and only phase 1');
  state = applyForcedReplacement(state, 4, 'B', 0, 'e1', statuses).state;
  assert.strictEqual(state.phaseStartedRound, 4, 'the first body of a later phase starts the phase');
  assert.deepStrictEqual(replacementCandidates(state, 'B'), ['e2'], 'its partner, not the phase after');
  state = applyForcedReplacement(state, 4, 'B', 1, 'e2', statuses).state;
  assert.strictEqual(state.phaseStartedRound, 4, 'the second body of the same phase does not restart it');
  state = down(down(state, 'e1'), 'e2');
  assert.deepStrictEqual(replacementCandidates(state, 'B'), ['w1', 'w2']);
  state = applyForcedReplacement(state, 9, 'B', 0, 'w1', statuses).state;
  assert.strictEqual(state.phaseStartedRound, 9);
  // The Clock reads from the phase: round 9 is the third phase's round 1.
  assert.strictEqual(pactRoundOf(state, 9), 1);
  assert.strictEqual(pactRoundOf(state, 9 + DEFAULT_PACT_CLOCK.startRound - 1), DEFAULT_PACT_CLOCK.startRound);
  assert.strictEqual(pactRoundOf(eyesFixture(1), 12), 12, 'an unphased fight counts from round 1');
});

test('titanEyes: the finale encounter fields the Herald and its spawn, then the Eyes as a phase, and buildCombatState numbers it', () => {
  const seals = [1, 2, 3].map((act) => ({ actNumber: act, locationId: 'wildsEdge', championId: 'manticore', level: 20, statGrants: {}, growthStatGrants: {} }));
  const escorts = { spawnTypesFor: (locationId: string) => locations[locationId]?.spawnTypes ?? null, heraldLeads: true };
  const encounter = generateFinaleEncounter(seals, ENDBRINGER_ID, finaleEnemies, 7, { level: 30, mastery: 10 }, escorts, { phases: EYE_PHASES, pool: titanEyes });
  assert.strictEqual(encounter.squad.activeIds[0], ENDBRINGER_ID);
  assert.strictEqual(encounter.squad.benchIds.length, 2, 'the spawn behind the one beside the Herald');
  assert.deepStrictEqual(encounter.squad.reserves, [[LEFT_EYE_ID, RIGHT_EYE_ID]]);
  assert.strictEqual(encounter.run.roster.length, 1 + 3 + 2, 'six bodies, one fight');
  const state = buildCombatState(1, allCombatants, equipment, [{ side: 'B', squad: encounter.squad, roster: encounter.run.roster }], passives);
  assert.strictEqual(state.bench.B.length, 2 + 2);
  const phase = (rosterId: string) => state.combatants[`B:${rosterId}`]?.reservePhase ?? state.combatants[Object.keys(state.combatants).find((k) => k.endsWith(rosterId))!].reservePhase;
  assert.strictEqual(phase(LEFT_EYE_ID), 1);
  assert.strictEqual(phase(RIGHT_EYE_ID), 1);
  assert.strictEqual(phase(ENDBRINGER_ID), undefined);
  // The innate passives are held at fight build: the Titan's pieces theirs, a spawn its type's Mark (docs/innate-passives.md §3).
  const held = (rosterId: string) => Object.keys(state.combatants[Object.keys(state.combatants).find((k) => k.endsWith(rosterId))!].passives);
  assert.deepStrictEqual(held(ENDBRINGER_ID), [HERALDS_STANDARD_ID]);
  assert.deepStrictEqual(held(LEFT_EYE_ID), [WITHERING_GAZE_FALLS_ID, WITHERING_GAZE_RETURNS_ID]);
  const spawnHeld = held(encounter.squad.benchIds[0]);
  assert.strictEqual(spawnHeld.length, 1);
  assert.ok(spawnHeld[0].startsWith('markOf'), `a finale spawn carries its Mark, not ${spawnHeld[0]}`);
  for (const id of [HERALDS_STANDARD_ID, WITHERING_GAZE_FALLS_ID, WITHERING_GAZE_RETURNS_ID]) assert.ok(!(id in boonPassives), `${id} is in the Boon pool`);
  assert.strictEqual(cinematicEntranceFor(LEFT_EYE_ID), 'titanRise', 'the first Eye in brings the scene');
  assert.strictEqual(cinematicEntranceFor(RIGHT_EYE_ID), null);
});

// --- The Herald's Standard (docs/titan-eyes.md §10) ---

test("herald: warded while any of its company stands, bench included — the Eyes behind it are a later phase and do not count", () => {
  let state = heraldFixture(21);
  assert.strictEqual(wardOn(state, 'h', passives), HERALDS_STANDARD_ID);
  state = down(state, 's1');
  assert.strictEqual(wardOn(state, 'h', passives), HERALDS_STANDARD_ID, 'a spawn still on the bench keeps it up');
  state = down(state, 's2');
  assert.strictEqual(wardOn(state, 'h', passives), null, 'the company is down: the Eyes waiting behind are not company');
  assert.strictEqual(wardOn(state, 's1', passives), null, 'nobody else holds it');
});

test('herald: a move aimed at it turns away and a spread lands on the spawn alone; single-target pickers skip it; the ward drops with the last spawn', () => {
  const state = heraldFixture(22);
  const r = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: allCombatants.valor.moveIds[0], declaredTarget: 'h' }], config);
  const guarded = r.events.find((e) => e.type === 'MoveGuarded');
  assert.ok(guarded && guarded.type === 'MoveGuarded' && guarded.combatantId === 'h' && guarded.passiveId === HERALDS_STANDARD_ID, 'turned away by the passive');
  assert.strictEqual(r.state.combatants.h.currentHp, state.combatants.h.currentHp, 'untouched');
  assert.deepStrictEqual(selectableTargets(state, 'singleEnemy', ['h', 's1'], statuses, passives), ['s1'], 'the picker never offers a warded foe');
  assert.deepStrictEqual(selectableTargets(state, 'singleEnemy', ['h', 's1'], statuses), ['h', 's1'], 'without the passive table it narrows nothing');
  const bare = down(down(state, 's1'), 's2');
  assert.deepStrictEqual(selectableTargets(bare, 'singleEnemy', ['h'], statuses, passives), ['h']);
  const hit = resolveRound(bare, [{ kind: 'move', combatantId: 'a1', moveId: allCombatants.valor.moveIds[0], declaredTarget: 'h' }], config);
  assert.ok(hit.state.combatants.h.currentHp < bare.combatants.h.currentHp, 'alone, it is hit');
});

test('herald: a reaction from the far side cannot afflict it while warded, and can once the company is down', () => {
  // A Thorns-shaped passive on Valor: whenever an enemy lands a hit, Burn that enemy. Transfix, not
  // Oblivion — a fainted holder's passives never fire, and Oblivion one-shots a level-1 Valor.
  const thorns = {
    ...passives,
    thornsTest: {
      id: 'thornsTest',
      name: 'Thorns (test)',
      description: 'test',
      reactive: { hook: 'DamageDealt' as const, condition: { relativeTo: 'enemy' as const, subjectRole: 'source' as const }, effect: { kind: 'applyStatus' as const, target: 'triggerSubject' as const, statusId: 'Burn', magnitude: 20 } },
    },
  };
  const arm = (s: CombatState): CombatState => ({ ...s, combatants: { ...s.combatants, a1: { ...s.combatants.a1, passives: { thornsTest: { passiveId: 'thornsTest', stacks: 1 } } } } });
  const cfg = { ...config, passives: thorns };
  const wardedHit = resolveRound(arm(heraldFixture(23)), [{ kind: 'move', combatantId: 'h', moveId: 'transfix', declaredTarget: 'a1' }], cfg);
  assert.ok(wardedHit.events.some((e) => e.type === 'DamageDealt' && e.sourceCombatantId === 'h'), 'the Herald landed its hit');
  assert.ok(!hasStatus(wardedHit.state.combatants.h, 'Burn'), 'the ward refuses the reaction');
  const bare = down(down(arm(heraldFixture(23)), 's1'), 's2');
  const bareHit = resolveRound(bare, [{ kind: 'move', combatantId: 'h', moveId: 'transfix', declaredTarget: 'a1' }], cfg);
  assert.ok(bareHit.events.some((e) => e.type === 'DamageDealt' && e.sourceCombatantId === 'h'));
  assert.ok(hasStatus(bareHit.state.combatants.h, 'Burn'), 'alone, it burns');
  // Its own side's benefit lands either way (Raise the Standard is the Herald's own buff).
  const buffed = applyStatus(heraldFixture(23), 1, 'h', statuses.Renew, { magnitude: 20, sourceCombatantId: 's1' });
  assert.ok(hasStatus(buffed.state.combatants.h, 'Renew'));
});

// --- Withering Gaze (docs/titan-eyes.md §10) ---

test('gaze: the field is set as an Eye opens, drains a tenth of every active non-Ancient body a round, spares the Eyes and the bench', () => {
  assert.strictEqual(fieldEffects.witheringGaze.drainsPercentMaxHp?.fraction, WITHERING_GAZE_FRACTION);
  assert.deepStrictEqual(fieldEffects.witheringGaze.drainsPercentMaxHp?.exemptTypes, ['Ancient']);
  let state = down(down(down(heraldFixture(31), 's1'), 's2'), 'h');
  const entered = applyForcedReplacement(state, 5, 'B', 0, 'e1', statuses);
  const opened = resolvePassiveReactions(entered.state, 5, entered.events, allCombatants, statuses, passives, fieldEffects);
  assert.strictEqual(opened.state.activeFieldEffect?.fieldEffectId, 'witheringGaze', 'set on entry');
  assert.ok(opened.events.some((e) => e.type === 'PassiveTriggered' && e.passiveId === WITHERING_GAZE_FALLS_ID));
  state = applyForcedReplacement(opened.state, 5, 'B', 1, 'e2', statuses).state;
  const before = { a1: state.combatants.a1.currentHp, a2: state.combatants.a2.currentHp, a3: state.combatants.a3.currentHp, e1: state.combatants.e1.currentHp };
  const r = resolveRound(state, [], config);
  const drained = r.events.find((e) => e.type === 'FieldEffectDrained');
  assert.ok(drained && drained.type === 'FieldEffectDrained' && drained.fraction === WITHERING_GAZE_FRACTION);
  const maxA1 = getMaxHp(allCombatants.valor, state.combatants.a1);
  assert.strictEqual(r.state.combatants.a1.currentHp, before.a1 - Math.ceil(maxA1 * WITHERING_GAZE_FRACTION), 'a tenth, direct');
  assert.ok(r.state.combatants.a2.currentHp < before.a2);
  assert.strictEqual(r.state.combatants.a3.currentHp, before.a3, 'the bench is out of it');
  assert.strictEqual(r.state.combatants.e1.currentHp, before.e1, 'the Eyes are spared');
  // The drain is the Clock's shape: no reaction pass follows it (the drain's HpChanged is not a DamageDealt).
  assert.ok(!r.events.some((e) => e.type === 'DamageDealt'));
});

test('gaze: returns every third round over a field of the player’s own, and never refreshes its own', () => {
  let state = down(down(down(heraldFixture(32), 's1'), 's2'), 'h');
  state = applyForcedReplacement(state, 1, 'B', 0, 'e1', statuses).state;
  state = applyForcedReplacement(state, 1, 'B', 1, 'e2', statuses).state;
  // The player answers with a field of their own before the round ends.
  state = { ...state, activeFieldEffect: { fieldEffectId: 'sanctuary', roundsRemaining: 5 } };
  const r1 = resolveRound({ ...state, round: 1 }, [], config);
  assert.strictEqual(r1.state.activeFieldEffect?.fieldEffectId, 'sanctuary', 'round 1 is not a third round');
  assert.ok(!r1.events.some((e) => e.type === 'FieldEffectDrained'), 'Sanctuary does not drain');
  const r2 = resolveRound(r1.state, [], config);
  assert.strictEqual(r2.state.activeFieldEffect?.fieldEffectId, 'sanctuary');
  const r3 = resolveRound(r2.state, [], config);
  assert.strictEqual(r3.state.round, 4);
  assert.strictEqual(r3.state.activeFieldEffect?.fieldEffectId, 'witheringGaze', `round ${WITHERING_GAZE_CADENCE} takes the field back`);
  const set = r3.events.filter((e) => e.type === 'FieldEffectSet');
  assert.strictEqual(set.length, 1, 'two Eyes, one set — the second is a no-op');
  assert.ok(r3.events.some((e) => e.type === 'PassiveTriggered' && e.passiveId === WITHERING_GAZE_RETURNS_ID));
  const roundsAfterSet = r3.state.activeFieldEffect?.roundsRemaining;
  // Round 6: the Gaze is still up, so the return is a no-op and the clock is NOT refreshed.
  const r4 = resolveRound(r3.state, [], config);
  const r5 = resolveRound(r4.state, [], config);
  const r6 = resolveRound(r5.state, [], config);
  assert.strictEqual(r6.state.activeFieldEffect?.fieldEffectId, 'witheringGaze');
  assert.strictEqual(r6.state.activeFieldEffect?.roundsRemaining, roundsAfterSet! - 3, 'never refreshed');
  assert.ok(!r6.events.some((e) => e.type === 'FieldEffectSet'));
  // A benched Eye does not fire it (the reaction pass reads the field only).
  const benched = { ...r6.state, active: { ...r6.state.active, B: [null, null] as [string | null, string | null] }, bench: { ...r6.state.bench, B: ['e1', 'e2', ...r6.state.bench.B] }, activeFieldEffect: null, round: 9 };
  const r9 = resolveRound(benched, [], config);
  assert.strictEqual(r9.state.activeFieldEffect, null);
});

test('gaze: the passive facts read as a cadence, and the round hook fires only for the active owner on the cadence', () => {
  assert.strictEqual(passives[WITHERING_GAZE_RETURNS_ID].reactive?.hook, 'RoundEnded');
  assert.strictEqual(passives[WITHERING_GAZE_RETURNS_ID].reactive?.condition.everyNRounds, WITHERING_GAZE_CADENCE);
  assert.strictEqual(passives[WITHERING_GAZE_FALLS_ID].reactive?.hook, 'SwitchedIn');
  assert.strictEqual(passives[HERALDS_STANDARD_ID].wardedWhileCompanyStands, true);
});

test('titanEyes: every Eye has a figure, and the pair tilt opposite ways', () => {
  for (const id of EYE_IDS) {
    assert.ok(isGuardianFigure(id));
    assert.ok(guardianMarkup(id, 'idle', 't').length > 0, `${id} has no figure`);
  }
  assert.notStrictEqual(guardianMarkup(LEFT_EYE_ID, 'idle', 't'), guardianMarkup(RIGHT_EYE_ID, 'idle', 't'), 'the pair tilt opposite ways');
});
