// The Titan's Eyes (docs/titan-eyes.md, src/data/enemies.ts titanEyes): the gaze telegraph, the
// taunt that takes a Regard, the reserve bench that holds phase 2 until phase 1 is down, the AI
// that fires once it has looked, and the finale corridor's third node.

import * as assert from 'assert';
import { test } from './harness';
import { allCombatants } from '../src/data/content';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { EYE_IDS, LEFT_EYE_ID, LEFT_EYE_WIDE_ID, RIGHT_EYE_ID, RIGHT_EYE_WIDE_ID, WIDE_EYE_IDS, titanEyes, enemies } from '../src/data/enemies';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { applyStatus } from '../src/engine/combat/statusEngine';
import { applyForcedReplacement, replacementCandidates } from '../src/engine/combat/switching';
import { createCombatant, getMaxHp, getMaxMana, hasStatus, type CombatState, type Side } from '../src/engine/state';
import { createRng } from '../src/engine/rng/seededRng';
import { pickAiAction } from '../src/run/ai';
import { generateTitanEncounter } from '../src/run/enemyGen';
import { buildCombatState } from '../src/run/buildCombatState';
import { equipment } from '../src/data/equipment';
import { COMBAT_BUDGET_STATS, statBudgetTotal } from '../src/run/statBudget';
import { ENEMY_LEVEL_OFFSET } from '../src/run/difficulty';
import { guardianMarkup, isGuardianFigure } from '../src/view/shared/guardianFigures';

const config = { typeChart, heroes: allCombatants, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

interface Placed {
  id: string;
  heroId: string;
  side: Side;
  reserve?: boolean;
}

/** Full pools, first two a side active, the rest benched; `reserve` marks a held-back bench entry. */
function fight(seed: number, a: Placed[], b: Placed[]): CombatState {
  const combatants: CombatState['combatants'] = {};
  for (const c of [...a, ...b]) {
    const hero = allCombatants[c.heroId];
    const blank = createCombatant(c.id, c.heroId, c.side, 0, 0);
    combatants[c.id] = { ...blank, currentHp: getMaxHp(hero, blank), currentMana: getMaxMana(hero, blank), ...(c.reserve ? { reserve: true } : {}) };
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
      { id: 'b3', heroId: LEFT_EYE_WIDE_ID, side: 'B', reserve: true },
      { id: 'b4', heroId: RIGHT_EYE_WIDE_ID, side: 'B', reserve: true },
    ]
  );

const aiCtx = { heroes: allCombatants, moves, statuses, typeChart, moveIdsFor: (id: string) => allCombatants[eyesFixture(1).combatants[id]?.heroId ?? id]?.moveIds ?? [] };

test('titanEyes: four mono-Ancient definitions, held apart from the champion pool, the wide pair stronger on every combat stat', () => {
  assert.deepStrictEqual([...EYE_IDS], [LEFT_EYE_ID, RIGHT_EYE_ID, LEFT_EYE_WIDE_ID, RIGHT_EYE_WIDE_ID]);
  for (const id of EYE_IDS) {
    const eye = titanEyes[id];
    assert.deepStrictEqual([...eye.types], ['Ancient'], `${id} is not mono-Ancient`);
    assert.ok(!(id in enemies), `${id} leaked into the champion pool`);
    assert.strictEqual(eye.starter, false);
    for (const moveId of eye.moveIds) assert.ok(moves[moveId], `${id} points at missing ${moveId}`);
    assert.strictEqual(eye.baseStats.attack, 40, 'Attack is the dump stat');
  }
  const total = (id: string) => statBudgetTotal(titanEyes[id].baseStats, COMBAT_BUDGET_STATS);
  assert.ok(total(LEFT_EYE_WIDE_ID) > total(LEFT_EYE_ID) && total(RIGHT_EYE_WIDE_ID) > total(RIGHT_EYE_ID));
  // The pair share the gaze and differ beside it: phase 1 Gaze/Regard, phase 2 Stare/Glare.
  for (const id of [LEFT_EYE_ID, RIGHT_EYE_ID]) assert.ok(titanEyes[id].moveIds.includes('gaze') && titanEyes[id].moveIds.includes('regard'), id);
  for (const id of WIDE_EYE_IDS) assert.ok(titanEyes[id].moveIds.includes('stare') && titanEyes[id].moveIds.includes('glare'), id);
  assert.ok(ENEMY_LEVEL_OFFSET.titan >= ENEMY_LEVEL_OFFSET.finale, 'the Eyes sit at least as high as the Herald');
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
  assert.ok(moves.regard.gateYieldsToRedirect && moves.glare.gateYieldsToRedirect);
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

test('titanEyes: a reserve waits for the field to empty — the first faint brings nobody in, the second brings the wide pair', () => {
  const state = eyesFixture(16);
  assert.deepStrictEqual(replacementCandidates(state, 'B'), [], 'nothing may enter while both Eyes stand');
  const down = (s: CombatState, id: string): CombatState => ({ ...s, combatants: { ...s.combatants, [id]: { ...s.combatants[id], fainted: true, currentHp: 0 } } });
  const oneDown: CombatState = { ...down(state, 'b1'), active: { ...state.active, B: [null, 'b2'] } };
  assert.deepStrictEqual(replacementCandidates(oneDown, 'B'), [], 'a reserve never replaces a first faint');
  const bothDown: CombatState = { ...down(oneDown, 'b2'), active: { ...oneDown.active, B: [null, null] } };
  assert.deepStrictEqual(replacementCandidates(bothDown, 'B'), ['b3', 'b4']);
  const entered = applyForcedReplacement(bothDown, 3, 'B', 0, 'b3', statuses);
  assert.strictEqual(entered.state.active.B[0], 'b3');
  // The first reserve in does not close the door on the second: the pair enter together.
  assert.deepStrictEqual(replacementCandidates(entered.state, 'B'), ['b4']);
  // A player bench with no reserves is untouched by the rule.
  assert.deepStrictEqual(replacementCandidates(state, 'A'), ['a3']);
});

test('titanEyes: the encounter fields the half-lidded pair with the wide pair in reserve, and buildCombatState flags them', () => {
  const encounter = generateTitanEncounter(EYE_IDS, titanEyes, 7, { level: 30, mastery: 0 });
  assert.deepStrictEqual([...encounter.squad.activeIds], [LEFT_EYE_ID, RIGHT_EYE_ID]);
  assert.deepStrictEqual(encounter.squad.benchIds, []);
  assert.deepStrictEqual(encounter.squad.reserveIds, [...WIDE_EYE_IDS]);
  const state = buildCombatState(1, allCombatants, equipment, [{ side: 'B', squad: encounter.squad, roster: encounter.run.roster }]);
  assert.strictEqual(state.bench.B.length, 2);
  for (const id of state.bench.B) assert.strictEqual(state.combatants[id].reserve, true);
  for (const id of state.active.B) assert.ok(id && !state.combatants[id].reserve);
});

test('titanEyes: every Eye has a figure, and the wide pair are drawn wide', () => {
  for (const id of EYE_IDS) {
    assert.ok(isGuardianFigure(id));
    assert.ok(guardianMarkup(id, 'idle', 't').length > 0, `${id} has no figure`);
  }
  assert.notStrictEqual(guardianMarkup(LEFT_EYE_ID, 'idle', 't'), guardianMarkup(LEFT_EYE_WIDE_ID, 'idle', 't'));
  assert.notStrictEqual(guardianMarkup(LEFT_EYE_ID, 'idle', 't'), guardianMarkup(RIGHT_EYE_ID, 'idle', 't'), 'the pair tilt opposite ways');
});
