// Motley's Trick (docs/wild-innates-and-events.md §1): a metamorphic, permanent move swapped each
// round for a face rolled from the whole catalog, and the hero re-based around it.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { passives } from '../src/data/passives';
import { signatureMoves } from '../src/data/signatures';
import { classMoves } from '../src/data/classes';
import { kitForRound, metamorphicPool } from '../src/run/metamorphic';
import { pickAiAction, type AiContext } from '../src/run/ai';
import { grantMove, isLockedMove, ProgressionError, replaceableMoveIds } from '../src/run/progression';
import { movePoolFor } from '../src/run/events';
import { heroStatTotal } from '../src/run/statBudget';
import { addRosterEntry, createRosterEntry, createRunState } from '../src/run/state';
import { statuses } from '../src/data/statuses';
import { typeChart } from '../src/data/typechart';
import type { CombatState } from '../src/engine/state';

const KIT = heroes.motley.moveIds;

function fight(seed = 7): CombatState {
  return createFightState(
    seed,
    [
      { combatantId: 'm', heroId: 'motley', side: 'A' },
      { combatantId: 'c', heroId: 'cinderKnight', side: 'A' },
    ],
    [
      { combatantId: 'e1', heroId: 'tidecaller', side: 'B' },
      { combatantId: 'e2', heroId: 'crag', side: 'B' },
    ]
  );
}

function holding(state: CombatState, passiveId: string): CombatState {
  return {
    ...state,
    combatants: { ...state.combatants, m: { ...state.combatants.m, passives: { [passiveId]: { passiveId, stacks: 1 } } } },
  };
}

// --- The hero ---

test("motley: the re-base — 170 HP, five identical combat stats, the roster's deepest pool, on the 550", () => {
  const { baseStats, growthGrades } = heroes.motley;
  assert.strictEqual(heroStatTotal(baseStats), 550);
  const five = [baseStats.attack, baseStats.defense, baseStats.intelligence, baseStats.wisdom, baseStats.speed];
  assert.strictEqual(new Set(five).size, 1, 'Attack, Defense, Intelligence, Wisdom and Speed are one number');
  const deepest = Math.max(...Object.values(heroes).filter((h) => h.id !== 'motley').map((h) => h.baseStats.manaPool));
  assert.ok(baseStats.manaPool > deepest, `Motley's pool ${baseStats.manaPool} is not the roster's deepest (${deepest})`);
  const grades = [growthGrades!.attack, growthGrades!.defense, growthGrades!.intelligence, growthGrades!.wisdom, growthGrades!.speed];
  assert.strictEqual(new Set(grades).size, 1, 'the five grow alike, so the shape survives levelling');
  assert.deepStrictEqual(heroes.motley.passiveIds, ['motleysTrick']);
  assert.ok(KIT.includes('motleysTrick'));
});

// --- The lock ---

test("motley's trick: permanent — no replace path takes it, and the replace list never offers it", () => {
  assert.ok(isLockedMove('motleysTrick'));
  assert.deepStrictEqual(replaceableMoveIds(KIT), KIT.filter((id) => id !== 'motleysTrick'));
  let run = createRunState(0);
  run = addRosterEntry(run, createRosterEntry('motley', 'motley', KIT));
  assert.throws(() => grantMove(run, 'motley', 'lull', 'motleysTrick'), ProgressionError);
  assert.doesNotThrow(() => grantMove(run, 'motley', 'lull', 'psiBolt'));
});

test("motley's trick: in no event pool, and no face is ever another Trick, a signature or a Class move", () => {
  assert.ok(!movePoolFor(undefined, moves).includes('motleysTrick'));
  const pool = new Set(metamorphicPool(moves));
  assert.ok(!pool.has('motleysTrick'));
  for (const id of Object.keys(signatureMoves)) assert.ok(!pool.has(id), `signature ${id} can be a face`);
  for (const id of Object.keys(classMoves)) assert.ok(!pool.has(id), `class move ${id} can be a face`);
  const owned = Object.keys(moves).filter((id) => signatureMoves[id] || classMoves[id] || moves[id].metamorphic).length;
  assert.strictEqual(pool.size, Object.keys(moves).length - owned, 'the pool is the catalog less what belongs to somebody, not a list');
});

// --- The roll ---

test("motley's trick: the face is derived — the same round always shows the same face, and it sits in the Trick's own slot", () => {
  const state = fight();
  const a = kitForRound(state, 'm', KIT, moves, passives);
  const b = kitForRound(state, 'm', KIT, moves, passives);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.length, KIT.length);
  assert.strictEqual(a[KIT.indexOf('psiBolt')], 'psiBolt', 'the fixed moves stay where they are');
  const face = a[KIT.indexOf('motleysTrick')];
  assert.ok(moves[face] && !moves[face].metamorphic && face !== 'psiBolt', `face ${face} is not a fresh move`);
});

test("motley's trick: it changes with the round — twenty rounds show more than a handful of faces", () => {
  const faces = new Set<string>();
  for (let round = 1; round <= 20; round++) faces.add(kitForRound({ ...fight(), round }, 'm', KIT, moves, passives)[0]);
  assert.ok(faces.size >= 15, `only ${faces.size} distinct faces in 20 rounds`);
});

test("motley's trick: a kit with no metamorphic move is returned as it is", () => {
  assert.deepStrictEqual(kitForRound(fight(), 'c', heroes.cinderKnight.moveIds, moves, passives), [...heroes.cinderKnight.moveIds]);
});

test("motley's trick+: the mastered card shows two distinct faces, both declarable", () => {
  const kit = kitForRound(holding(fight(), 'motleysTrickMastered'), 'm', KIT, moves, passives);
  assert.strictEqual(kit.length, KIT.length + 1);
  const faces = kit.filter((id) => !KIT.includes(id));
  assert.strictEqual(faces.length, 2);
  assert.notStrictEqual(faces[0], faces[1]);
  // The base card is one face, as an absent card is.
  assert.strictEqual(kitForRound(holding(fight(), 'motleysTrick'), 'm', KIT, moves, passives).length, KIT.length);
});

// --- The AI ---

test("motley's trick: an enemy Motley declares a face, never the Trick itself", () => {
  const ctx: AiContext = { heroes, moves, statuses, typeChart, moveIdsFor: (id) => (id === 'm' ? KIT : heroes[id === 'c' ? 'cinderKnight' : 'tidecaller'].moveIds), random: () => 0 };
  for (let round = 1; round <= 12; round++) {
    const state = { ...fight(round), round };
    const action = pickAiAction(state, 'm', ctx);
    if (action.kind !== 'move') continue;
    assert.notStrictEqual(action.moveId, 'motleysTrick', `round ${round}: the Trick was declared as itself`);
    assert.ok(kitForRound(state, 'm', KIT, moves, passives).includes(action.moveId), `round ${round}: ${action.moveId} is not this round's kit`);
  }
});
