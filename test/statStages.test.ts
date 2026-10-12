// Stat stages (docs/stat-stages.md): a move's buff or debuff is a count of steps, ×1.5 / ÷1.5 each on
// what the hero brought, held at ±5; derived grants and MP Regen stay flat.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState } from '../src/engine/state';
import { applyStageDelta, applyStatModifierDelta, getEffectiveStat, stageMultiplier, STAGED_STATS, STAGE_LIMIT, STAT_HARD_CAP, statDeltaLandsOnCasterSide } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** crimson + cinderKnight vs ironWarden + wildOracle, every pool deep enough to cast anything. */
function fixture(seed: number, a1 = 'crimson', a2 = 'cinderKnight'): CombatState {
  const state = createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: a1, side: 'A' },
      { combatantId: 'a2', heroId: a2, side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      { ...c, currentMana: 999, currentHp: c.side === 'B' ? 1200 : c.currentHp, statModifiers: { ...c.statModifiers, manaPool: 999, ...(c.side === 'B' ? { hp: 1200 } : {}) } },
    ])
  );
  return { ...state, combatants } as CombatState;
}

const cast = (state: CombatState, combatantId: string, moveId: string, declaredTarget?: string) =>
  resolveRound(state, [{ kind: 'move', combatantId, moveId, declaredTarget } as Action], config);

const statChanged = (events: readonly { type: string }[]) => events.filter((e) => e.type === 'StatChanged') as any[];

// --- The curve ---

test('stages: the curve is ×1.5 … ×3.5 up and the same divided down, and +n then −n cancels exactly', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 5].map(stageMultiplier), [1.5, 2, 2.5, 3, 3.5]);
  for (let n = 1; n <= STAGE_LIMIT; n++) assert.strictEqual(stageMultiplier(n) * stageMultiplier(-n), 1);
  assert.strictEqual(stageMultiplier(0), 1);
});

test('stages: a change is held at ±5, lands short when it crosses, and reports it', () => {
  const c = { ...fixture(1).combatants.a1, statStages: { attack: 4 } };
  assert.deepStrictEqual(applyStageDelta(c, 'attack', 2), { newValue: 5, landed: 1, capped: true });
  assert.deepStrictEqual(applyStageDelta({ ...c, statStages: { attack: 5 } }, 'attack', 1), { newValue: 5, landed: 0, capped: true });
  assert.deepStrictEqual(applyStageDelta({ ...c, statStages: { attack: -5 } }, 'attack', -1), { newValue: -5, landed: 0, capped: true });
  assert.deepStrictEqual(applyStageDelta(c, 'attack', -2), { newValue: 2, landed: -2, capped: false });
});

test('stages: the multiplier is on base + loadout, and a flat fight change adds after it', () => {
  const state = fixture(2);
  const hero = heroes.crimson;
  const brought = hero.baseStats.attack + (state.combatants.a1.baselineStatModifiers.attack ?? 0);
  const staged = { ...state.combatants.a1, statStages: { attack: 2 } };
  assert.strictEqual(getEffectiveStat(hero, staged, 'attack'), brought * 2);
  assert.strictEqual(getEffectiveStat(hero, { ...staged, statModifiers: { attack: 10 } }, 'attack'), brought * 2 + 10);
});

// --- Moves land stages ---

test('stages: Kindle raises its caster\'s Attack one step, whoever casts it — no caster scaling', () => {
  for (const heroId of ['crimson', 'cinderKnight']) {
    const { state, events } = cast(fixture(3, heroId, heroId === 'crimson' ? 'cinderKnight' : 'crimson'), 'a1', 'kindle');
    assert.strictEqual(state.combatants.a1.statStages?.attack, 1);
    assert.strictEqual(state.combatants.a1.statModifiers.attack ?? 0, 0, 'nothing on the flat channel');
    const [rise] = statChanged(events);
    assert.strictEqual(rise.stages, true);
    assert.strictEqual(rise.delta, 1);
  }
});

test('stages: a rider debuff lands on the foe it hit, in steps', () => {
  const { state } = cast(fixture(4), 'a2', 'moltenLash', 'b1');
  assert.strictEqual(state.combatants.b1.statStages?.defense, moves.moltenLash.statDeltas![0].stages);
});

test('stages: casting past the limit lands nothing and still says so', () => {
  let state = fixture(5);
  state = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, statStages: { attack: STAGE_LIMIT } } } };
  const { events } = cast(state, 'a1', 'kindle');
  const [held] = statChanged(events);
  assert.strictEqual(held.delta, 0);
  assert.strictEqual(held.capped, true);
  assert.strictEqual(held.newValue, STAGE_LIMIT);
});

test('stages: Mana Font\'s MP Regen stays flat, outside the stage system', () => {
  const { state, events } = cast(fixture(6, 'runescribe', 'crimson'), 'a1', 'manaFont');
  assert.strictEqual(state.combatants.a1.statModifiers.mpRegen, moves.manaFont.mpRegenGrant);
  assert.strictEqual(state.combatants.a2.statModifiers.mpRegen, moves.manaFont.mpRegenGrant);
  for (const e of statChanged(events)) assert.strictEqual(e.stages, undefined);
});

test('stages: an uncapped flat grant (Stampede) stops at the hard ceiling, and no stat ever reads past it', () => {
  const tusk = { ...fixture(7).combatants.a1, heroId: 'tusk' };
  const { newValue } = applyStatModifierDelta(heroes.tusk, tusk, 'speed', 1e12, true);
  assert.strictEqual(newValue, STAT_HARD_CAP);
  assert.strictEqual(getEffectiveStat(heroes.tusk, { ...tusk, statModifiers: { speed: newValue } }, 'speed'), STAT_HARD_CAP);
});

test('stages: the card-only side read — self, ally and bothAllies deltas are the caster\'s side; a hit\'s rider is not', () => {
  assert.strictEqual(statDeltaLandsOnCasterSide(moves.kindle), true);
  assert.strictEqual(statDeltaLandsOnCasterSide(moves.moltenLash), false);
});

// --- The data ---

test('stages: every authored delta is a whole, non-zero step count inside ±5, on a stat a stage can move', () => {
  for (const move of Object.values(moves)) {
    const all = [...(move.statDeltas ?? []), ...(move.randomStatDeltas ? move.randomStatDeltas.from.map((stat) => ({ stat, stages: move.randomStatDeltas!.stages })) : [])];
    for (const { stat, stages } of all) {
      assert.ok(Number.isInteger(stages) && stages !== 0 && Math.abs(stages) <= STAGE_LIMIT, `${move.id} authors ${stages} stages`);
      assert.ok(STAGED_STATS.includes(stat), `${move.id} stages ${stat}, which has no stages`);
    }
  }
});

// --- The statement moves (docs/stat-stages.md §6.2) ---

test('stages: Break Will clears what both foes had raised, then lowers both offences a step from there', () => {
  let state = fixture(8, 'crimson', 'cinderKnight');
  const b1 = state.combatants.b1;
  state = { ...state, combatants: { ...state.combatants, b1: { ...b1, statStages: { attack: 3, defense: 2, speed: -2 } } } };
  const { state: next, events } = cast(state, 'a1', 'breakWill', 'b1');
  assert.deepStrictEqual(next.combatants.b1.statStages, { attack: -1, defense: 0, speed: -2, intelligence: -1 }, 'raised cleared, lowered kept, then the drops');
  assert.deepStrictEqual(next.combatants.b2.statStages, { intelligence: -1, attack: -1 });
  const clears = statChanged(events).filter((e) => e.combatantId === 'b1' && e.newValue === 0);
  assert.deepStrictEqual(clears.map((e) => [e.stat, e.delta]).sort(), [['attack', -3], ['defense', -2]]);
});

test('stages: the trades — Shadow Form and Juggernaut pay a step on their own side, and land it', () => {
  assert.deepStrictEqual(moves.shadowForm.statDeltas, [{ stat: 'attack', stages: 3 }, { stat: 'defense', stages: -1 }]);
  assert.deepStrictEqual(moves.juggernaut.statDeltas, [{ stat: 'attack', stages: 2 }, { stat: 'defense', stages: 2 }, { stat: 'speed', stages: -1 }]);
  assert.strictEqual(statDeltaLandsOnCasterSide(moves.juggernaut), true, 'a self-side drop is a cost, never a debuff');
});

test('stages: no statement move is still on the mechanical band — nothing over ▲▲▲, and a Mid move at ▲▲', () => {
  for (const move of Object.values(moves)) {
    for (const { stages } of move.statDeltas ?? []) assert.ok(Math.abs(stages) <= 3, `${move.id} authors ${stages} stages`);
  }
  assert.deepStrictEqual(moves.study.statDeltas, [{ stat: 'intelligence', stages: 2 }]);
});

// --- The round rule: a passive affects each hero at most once a round (2026-10-11, per user direction) ---

const REPEATING_EXEMPT_HOOKS = new Set(['SwitchedIn', 'SwitchedOut']);
const MASTERED_INNATES = new Set(Object.values(heroes).flatMap((h) => h.masteredPassiveIds ?? []));

function holding(state: CombatState, id: string, passiveId: string, stacks = 1): CombatState {
  const c = state.combatants[id];
  return { ...state, combatants: { ...state.combatants, [id]: { ...c, passives: { ...c.passives, [passiveId]: { passiveId, stacks } } } } };
}

/** Valor holding Tempering, deep enough in HP to take two hits a round for eight rounds. */
function tempered(seed: number, stacks = 1): CombatState {
  const state = holding(fixture(seed, 'valor', 'crimson'), 'a1', 'tempering', stacks);
  const a1 = state.combatants.a1;
  return { ...state, combatants: { ...state.combatants, a1: { ...a1, currentHp: 9000, statModifiers: { ...a1.statModifiers, hp: 9000 } } } };
}
const struckTwice = (state: CombatState) =>
  resolveRound(state, [
    { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a1' } as Action,
    { kind: 'move', combatantId: 'b2', moveId: 'ironFist', declaredTarget: 'a1' } as Action,
  ], config);

test('round rule: a card affects a hero once a round, however often it is set off', () => {
  const { state, events } = struckTwice(tempered(20));
  assert.strictEqual(state.combatants.a1.statStages?.defense, 1, 'two hits, one step');
  assert.strictEqual(events.filter((e) => e.type === 'PassiveTriggered' && (e as any).passiveId === 'tempering').length, 1);
});

test('round rule: no cap a fight — the five-step limit is the only ceiling', () => {
  let state = tempered(21);
  for (let round = 0; round < 8; round++) state = struckTwice(state).state;
  assert.strictEqual(state.combatants.a1.statStages?.defense, 5);
});

test('round rule: a second stack lands on the same firing — two stacks, two steps a round', () => {
  const { state } = struckTwice(tempered(22, 2));
  assert.strictEqual(state.combatants.a1.statStages?.defense, 2);
});

test('round rule: the data — a repeating card is one step a firing (a mastered innate two), and a flat number is a run-long gain only', () => {
  for (const p of Object.values(passives)) {
    for (const r of [p.reactive, p.alsoReactive]) {
      if (!r) continue;
      for (const e of [r.effect, r.alsoEffect]) {
        if (!e || e.kind !== 'statDelta') continue;
        if (typeof e.amount === 'number') assert.ok(e.permanent, `${p.id} authors a flat number in a fight`);
        if (e.stages === undefined) continue;
        const repeating = !REPEATING_EXEMPT_HOOKS.has(r.hook) && !r.oncePerFight;
        // Keystone (Aegis's Cornerstone) is the one path card at two steps, per user direction 2026-10-12: a broken Shield is rare.
        const maxStep = MASTERED_INNATES.has(p.id) || p.id === 'keystone' ? 2 : 1;
        if (repeating) assert.ok(Math.abs(e.stages) >= 1 && Math.abs(e.stages) <= maxStep, `${p.id}: a repeating card is one step (a mastered innate two)`);
      }
    }
  }
});
