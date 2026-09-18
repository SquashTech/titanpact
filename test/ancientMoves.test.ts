// The Ancient slate (docs/authoring-moves.md §10 "Ancient", 2026-09-17): the seal's vocabulary,
// enemy-only, every hit at 1x into everything. What the tests pin is the shape the lore locks —
// nothing here is draftable, nothing here is super-effective — and the Herald's kit.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { heroes } from '../src/data/heroes';
import { progressionTable } from '../src/data/progression';
import { allCombatants } from '../src/data/content';
import { enemies, ENDBRINGER_ID } from '../src/data/enemies';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState, Side } from '../src/engine/state';
import { createCombatant, getMaxHp, getMaxMana, hasStatus } from '../src/engine/state';
import { createRng } from '../src/engine/rng/seededRng';
import { resolveTypeMult } from '../src/engine/damage/typeMult';

const config = { typeChart, heroes: allCombatants, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

const EYE_MOVES = new Set(['gaze', 'regard', 'lidded']);
const ancient = () => Object.values(moves).filter((m) => m.type === 'Ancient');
const slate = () => ancient().filter((m) => !EYE_MOVES.has(m.id));

function fight(seed: number, a: { id: string; heroId: string }[], b: { id: string; heroId: string }[]): CombatState {
  const combatants: CombatState['combatants'] = {};
  const place = (list: { id: string; heroId: string }[], side: Side) => {
    for (const c of list) {
      const hero = allCombatants[c.heroId];
      const blank = createCombatant(c.id, c.heroId, side, 0, 0);
      combatants[c.id] = { ...blank, currentHp: getMaxHp(hero, blank), currentMana: getMaxMana(hero, blank) };
    }
  };
  place(a, 'A');
  place(b, 'B');
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

/** The Herald and a spawn against Valor and Solace (dawnwarden) — the finale's front row. */
const heraldFixture = (seed: number) =>
  fight(seed, [{ id: 'a1', heroId: 'valor' }, { id: 'a2', heroId: 'dawnwarden' }], [{ id: 'b1', heroId: ENDBRINGER_ID }, { id: 'b2', heroId: 'armillary' }]);

test('ancient: the slate is eleven moves plus the Eyes’ three, every one tiered and Ancient-typed, three of the hits physical', () => {
  assert.strictEqual(slate().length, 11);
  assert.strictEqual(ancient().length, 14);
  for (const m of ancient()) assert.ok(m.tier, `${m.id} carries no tier`);
  // An all-magical enemy type would make Defense worthless in every Guardian fight and the finale.
  const physical = ancient().filter((m) => m.category === 'physical').map((m) => m.id).sort();
  assert.deepStrictEqual(physical, ['longDrink', 'transfix', 'weightOfAges']);
  // The Eyes look; they hold no physical move at 40 Attack.
  for (const id of EYE_MOVES) assert.strictEqual(moves[id].category, 'magical');
});

test('ancient: nothing on the slate is in any hero’s kit or pool, an Evolution grant, or a Class — the seal is enemy-only', () => {
  const ids = new Set(ancient().map((m) => m.id));
  for (const hero of Object.values(heroes)) {
    for (const id of hero.moveIds) assert.ok(!ids.has(id), `${hero.id} starts with ${id}`);
    for (const id of progressionTable.moveTiers[hero.id] ?? []) assert.ok(!ids.has(id), `${hero.id}'s pool offers ${id}`);
    for (const node of progressionTable.evolutions[hero.id] ?? []) {
      for (const path of node.paths) {
        for (const id of [...path.unlocksMoveIds, ...(path.learnableMoveIds ?? [])]) assert.ok(!ids.has(id), `${path.id} grants ${id}`);
      }
    }
    assert.ok(!hero.signatureMoveId || !ids.has(hero.signatureMoveId), `${hero.id}'s signature is Ancient`);
  }
});

test('ancient: every hit resolves at exactly 1x into every type — a seal is not a weapon', () => {
  for (const defender of Object.keys(typeChart) as (keyof typeof typeChart)[]) {
    assert.strictEqual(resolveTypeMult(typeChart, 'Ancient', [defender]), 1, `Ancient into ${defender}`);
  }
});

test('ancient: the bodies sit under the hero slates’ at each tier, because Ancient STAB is never resisted', () => {
  assert.strictEqual(moves.runicBlast.basePower, 50);
  assert.strictEqual(moves.runicBlast.manaCost, 20);
  assert.strictEqual(moves.archonBlast.basePower, 55);
  assert.strictEqual(moves.archonBlast.manaCost, 40);
  // 90 since the finale became one fight (docs/titan-eyes.md §10.3) — still the slate's one big hit.
  assert.strictEqual(moves.oblivion.basePower, 90);
  assert.strictEqual(moves.oblivion.manaCost, 70);
  // Every damaging body on the slate is a spread at 50 or under, or a single at 60 or under, save the Late hit.
  for (const m of slate()) {
    if (m.kind !== 'damage' || m.id === 'oblivion') continue;
    assert.ok((m.basePower ?? 0) <= 60, `${m.id} hits like a hero slate's move`);
  }
});

test('ancient: the Herald’s kit is the banner, the softening, the flinch and the one hit — and Enfeeble is off it', () => {
  assert.deepStrictEqual([...enemies[ENDBRINGER_ID].moveIds], ['raiseTheStandard', 'erode', 'transfix', 'oblivion']);
  const pool = enemies[ENDBRINGER_ID].baseStats.manaPool;
  for (const id of enemies[ENDBRINGER_ID].moveIds) assert.ok(moves[id].manaCost <= pool, `the Herald cannot afford ${id}`);
});

test('ancient: Raise the Standard lands on BOTH of the Herald’s side, and on nobody across from it', () => {
  const state = heraldFixture(1);
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'b1', moveId: 'raiseTheStandard' } as Action], config);
  for (const id of ['b1', 'b2']) {
    assert.ok((next.combatants[id].statModifiers.attack ?? 0) >= 20, `${id} gained no Attack`);
    assert.ok((next.combatants[id].statModifiers.intelligence ?? 0) >= 20, `${id} gained no Intelligence`);
  }
  for (const id of ['a1', 'a2']) {
    assert.strictEqual(next.combatants[id].statModifiers.attack ?? 0, 0);
    assert.strictEqual(next.combatants[id].statModifiers.intelligence ?? 0, 0);
  }
});

test('ancient: Erode drops both heroes’ walls, scaled off the Herald’s Intelligence and held at the floor', () => {
  const state = heraldFixture(2);
  const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'b1', moveId: 'erode' } as Action], config);
  for (const id of ['a1', 'a2']) {
    assert.ok((next.combatants[id].statModifiers.defense ?? 0) <= -15, `${id}'s Defense did not drop`);
    assert.ok((next.combatants[id].statModifiers.wisdom ?? 0) <= -15, `${id}'s Wisdom did not drop`);
  }
});

test('ancient: Transfix is physical, lands first from the Herald, and the target loses its turn — Daze is cleared by the end of the round', () => {
  assert.strictEqual(moves.transfix.category, 'physical');
  const state = heraldFixture(3);
  const before = state.combatants.b2.currentHp;
  const { state: next, events } = resolveRound(
    state,
    [
      { kind: 'move', combatantId: 'b1', moveId: 'transfix', declaredTarget: 'a1' } as Action,
      { kind: 'move', combatantId: 'a1', moveId: 'ironFist', declaredTarget: 'b2' } as Action,
    ],
    config
  );
  assert.ok(events.some((e) => e.type === 'StatusApplied' && e.combatantId === 'a1' && e.statusId === 'Daze'), 'the Daze landed');
  assert.ok(!events.some((e) => e.type === 'DamageDealt' && e.sourceCombatantId === 'a1'), 'Valor never swung');
  assert.strictEqual(next.combatants.b2.currentHp, before);
  assert.ok(!hasStatus(next.combatants.a1, 'Daze'), 'and the flinch does not carry into the next round');
});

test('ancient: Long Drink puts half of what it takes back on the caster', () => {
  const base = heraldFixture(4);
  const hurt = { ...base, combatants: { ...base.combatants, b1: { ...base.combatants.b1, currentHp: 200 } } };
  const { state: next, events } = resolveRound(hurt, [{ kind: 'move', combatantId: 'b1', moveId: 'longDrink', declaredTarget: 'a1' } as Action], config);
  const hit = events.find((e) => e.type === 'DamageDealt' && e.sourceCombatantId === 'b1');
  const drank = events.find((e) => e.type === 'Healed' && e.targetCombatantId === 'b1');
  assert.ok(hit && hit.type === 'DamageDealt' && drank && drank.type === 'Healed' && drank.drain, 'the hit landed and the drain healed');
  assert.ok(Math.abs(drank.amount - hit.amount * 0.5) <= 1, `drank ${drank.amount} of a ${hit.amount} hit`);
  assert.strictEqual(next.combatants.b1.currentHp, 200 + drank.amount);
});
