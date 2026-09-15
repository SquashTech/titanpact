import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import type { MoveDefinition } from '../src/engine/content';
import type { CombatState } from '../src/engine/state';
import { pickAiAction, type AiContext } from '../src/run/ai';
import { getMaxHp, statModifierCeiling, statModifierFloor } from '../src/engine/state';
import { setFieldEffect } from '../src/engine/combat/fieldEffectEngine';

/** Test-local movepool: the AI's rules are about SHAPES of move, so authored content would make this fail on every slate retune. */
const base = {
  category: 'magical' as const,
  manaCost: 10,
  priority: 0,
};

const testMoves: Record<string, MoveDefinition> = {
  fireBolt: { ...base, id: 'fireBolt', name: 'Fire Bolt', type: 'Fire', kind: 'damage', basePower: 40, target: 'singleEnemy' },
  arcaneBolt: { ...base, id: 'arcaneBolt', name: 'Arcane Bolt', type: 'Mind', kind: 'damage', basePower: 40, target: 'singleEnemy' },
  pureHeal: { ...base, id: 'pureHeal', name: 'Pure Heal', type: 'Light', kind: 'heal', healPower: 30, target: 'singleAlly' },
  renewer: {
    ...base,
    id: 'renewer',
    name: 'Renewer',
    type: 'Nature',
    kind: 'buff',
    target: 'singleAlly',
    statusApplication: { statusId: 'Renew', magnitude: 20, target: 'moveTarget' },
  },
  freezer: {
    ...base,
    id: 'freezer',
    name: 'Freezer',
    type: 'Frost',
    kind: 'buff',
    target: 'singleEnemy',
    statusApplication: { statusId: 'Freeze', target: 'moveTarget' },
  },
  surger: { ...base, id: 'surger', name: 'Surger', type: 'Mind', kind: 'buff', target: 'self', fieldEffectApplication: 'surgingMagic' },
  // Both authorings of conditionalTarget: single-by-default (Arcane's Overload) and spread-by-default.
  spreadUnderSurge: {
    ...base,
    id: 'spreadUnderSurge',
    name: 'Spread Under Surge',
    type: 'Arcane',
    kind: 'damage',
    basePower: 40,
    target: 'singleEnemy',
    conditionalTarget: { requiresFieldEffect: 'surgingMagic', target: 'bothEnemies' },
  },
  singleUnderSurge: {
    ...base,
    id: 'singleUnderSurge',
    name: 'Single Under Surge',
    type: 'Arcane',
    kind: 'damage',
    basePower: 40,
    target: 'bothEnemies',
    conditionalTarget: { requiresFieldEffect: 'surgingMagic', target: 'singleEnemy' },
  },
};

const AI = 'ai:caster';

/** Holds a player hero at its floor on `stats` (state.ts statModifierFloor) — the board a drop can do nothing to. */
function atFloor(state: CombatState, id: string, stats: readonly ('defense' | 'wisdom')[]): CombatState {
  const c = state.combatants[id];
  const hero = heroes[c.heroId];
  const held = Object.fromEntries(stats.map((stat) => [stat, statModifierFloor(hero, c, stat)]));
  return { ...state, combatants: { ...state.combatants, [id]: { ...c, statModifiers: { ...c.statModifiers, ...held } } } } as CombatState;
}
const LEFT = 'p:left';
const RIGHT = 'p:right';

/** Caster on side B; two player heroes in A's slots, left first. */
function board(casterHeroId: string, leftHeroId: string, rightHeroId: string): CombatState {
  return createFightState(
    99,
    [
      { combatantId: LEFT, heroId: leftHeroId, side: 'A' },
      { combatantId: RIGHT, heroId: rightHeroId, side: 'A' },
    ],
    [{ combatantId: AI, heroId: casterHeroId, side: 'B' }]
  );
}

function contextFor(moveIds: readonly string[], random: () => number): AiContext {
  return { heroes, moves: testMoves, statuses, typeChart, moveIdsFor: () => moveIds, random };
}

/** Every action the AI would take across the [0, 1) roll space; assertions are about the SET of outcomes, never one roll. */
function sweep(state: CombatState, moveIds: readonly string[]): { moveIds: Set<string>; targets: Set<string | null> } {
  const picked = { moveIds: new Set<string>(), targets: new Set<string | null>() };
  for (let i = 0; i < 200; i++) {
    const roll = (i + 0.5) / 200;
    const action = pickAiAction(state, AI, contextFor(moveIds, () => roll));
    assert.strictEqual(action.kind, 'move', 'affordable moves in hand should never fall back to Rest');
    if (action.kind !== 'move') continue;
    picked.moveIds.add(action.moveId);
    picked.targets.add(action.declaredTarget ?? null);
  }
  return picked;
}

test('ai splits a neutral attack across both enemy slots instead of always the left one', () => {
  // Fire is 1x into Storm both ways, so nothing distinguishes the two slots.
  const state = board('crimson', 'tempest', 'stormRanger');
  const { targets } = sweep(state, ['fireBolt']);
  assert.deepStrictEqual([...targets].sort(), [LEFT, RIGHT].sort());
});

test('ai aims a super-effective attack at the slot it is super-effective against', () => {
  // Fire is 2x into Frost, 1x into Storm; the Frost hero is on the RIGHT so always-leftmost would fail.
  const state = board('crimson', 'tempest', 'rime');
  const { targets } = sweep(state, ['fireBolt']);
  assert.deepStrictEqual([...targets], [RIGHT]);
});

test('ai favours the super-effective move without ever committing to it', () => {
  const state = board('crimson', 'tempest', 'rime');
  const { moveIds } = sweep(state, ['fireBolt', 'arcaneBolt']);
  assert.deepStrictEqual([...moveIds].sort(), ['arcaneBolt', 'fireBolt']);

  // Weights 6 (super) against 2 (neutral).
  let fire = 0;
  for (let i = 0; i < 200; i++) {
    const roll = (i + 0.5) / 200;
    const action = pickAiAction(state, AI, contextFor(['fireBolt', 'arcaneBolt'], () => roll));
    if (action.kind === 'move' && action.moveId === 'fireBolt') fire++;
  }
  assert.ok(fire > 100 && fire < 200, `expected a majority but not a monopoly of super-effective picks, got ${fire}/200`);
});

test('ai does not spend a turn healing a side that is already at full HP', () => {
  const state = board('crimson', 'tempest', 'stormRanger');
  const { moveIds } = sweep(state, ['arcaneBolt', 'pureHeal']);
  assert.deepStrictEqual([...moveIds], ['arcaneBolt']);
});

test('ai heals once someone is actually hurt, and aims it at the most wounded', () => {
  const state = board('crimson', 'tempest', 'stormRanger');
  state.combatants[AI].currentHp = 10;
  const { moveIds, targets } = sweep(state, ['arcaneBolt', 'pureHeal']);
  assert.ok(moveIds.has('pureHeal'), 'a hurt caster should put its heal back in the pool');
  assert.ok(targets.has(AI), 'the heal should be aimed at the wounded hero');
});

test('ai still applies Renew at full HP — a heal-over-time is not a wasted turn', () => {
  const state = board('crimson', 'tempest', 'stormRanger');
  const { moveIds } = sweep(state, ['arcaneBolt', 'pureHeal', 'renewer']);
  assert.ok(moveIds.has('renewer'), 'Renew is a standing investment, not a no-op heal');
  assert.ok(!moveIds.has('pureHeal'), 'the flat heal is still wasted at full HP');
});

test('ai does not re-apply the field effect that is already up', () => {
  const state = board('crimson', 'tempest', 'stormRanger');
  state.activeFieldEffect = { fieldEffectId: 'surgingMagic', roundsRemaining: 3 };
  assert.deepStrictEqual([...sweep(state, ['arcaneBolt', 'surger']).moveIds], ['arcaneBolt']);

  state.activeFieldEffect = null;
  assert.ok(sweep(state, ['arcaneBolt', 'surger']).moveIds.has('surger'), 'an empty field is worth setting');
});

test('ai plants a non-stacking status on the enemy that does not already hold it', () => {
  const state = board('crimson', 'tempest', 'stormRanger');
  state.combatants[LEFT].statuses.Freeze = { statusId: 'Freeze' };
  const { targets } = sweep(state, ['freezer']);
  assert.deepStrictEqual([...targets], [RIGHT]);
});

test('ai falls back to Rest only when nothing at all is affordable', () => {
  const state = board('crimson', 'tempest', 'stormRanger');
  state.combatants[AI].currentMana = 0;
  const action = pickAiAction(state, AI, contextFor(['arcaneBolt'], () => 0.5));
  assert.strictEqual(action.kind, 'rest');
});

// --- Declarability: the crash the batch simulator found (seed 39462) ---

test('ai never declares a single-target move it has no target for — it Rests instead', () => {
  // `glaciate` needs a Frozen target. With nobody Frozen the candidate pool is EMPTY, so
  // there is no id to declare; targeting.ts throws a bare Error for a missing declared
  // target, which resolveRound does not catch, and the whole fight goes down.
  const gated: MoveDefinition = {
    ...base,
    id: 'glaciate',
    name: 'Glaciate',
    type: 'Frost',
    kind: 'damage',
    basePower: 60,
    target: 'singleEnemy',
    requiresTargetStatus: 'Freeze',
  };
  const ctx: AiContext = {
    heroes,
    moves: { ...testMoves, glaciate: gated },
    statuses,
    typeChart,
    moveIdsFor: () => ['glaciate'],
    random: () => 0.5,
  };
  const state = board('crimson', 'tempest', 'rime');

  const action = pickAiAction(state, AI, ctx);
  assert.strictEqual(action.kind, 'rest', 'the only affordable move cannot be declared, so the turn is a Rest');
});

test('ai still reaches for a gated move once something is marked', () => {
  const gated: MoveDefinition = {
    ...base,
    id: 'glaciate',
    name: 'Glaciate',
    type: 'Frost',
    kind: 'damage',
    basePower: 60,
    target: 'singleEnemy',
    requiresTargetStatus: 'Freeze',
  };
  const ctx: AiContext = {
    heroes,
    moves: { ...testMoves, glaciate: gated },
    statuses,
    typeChart,
    moveIdsFor: () => ['glaciate'],
    random: () => 0.5,
  };
  const base_ = board('crimson', 'tempest', 'rime');
  const frozen: CombatState = {
    ...base_,
    combatants: {
      ...base_.combatants,
      [RIGHT]: { ...base_.combatants[RIGHT], statuses: { Freeze: { statusId: 'Freeze' } } },
    },
  };

  const action = pickAiAction(frozen, AI, ctx);
  assert.strictEqual(action.kind, 'move');
  if (action.kind !== 'move') return;
  assert.strictEqual(action.moveId, 'glaciate');
  assert.strictEqual(action.declaredTarget, RIGHT, 'and it aims at the one marked hero');
});

test('ai prefers a declarable move over a gated one rather than Resting', () => {
  const gated: MoveDefinition = {
    ...base,
    id: 'glaciate',
    name: 'Glaciate',
    type: 'Frost',
    kind: 'damage',
    basePower: 200,
    target: 'singleEnemy',
    requiresTargetStatus: 'Freeze',
  };
  const ctx: AiContext = {
    heroes,
    moves: { ...testMoves, glaciate: gated },
    statuses,
    typeChart,
    moveIdsFor: () => ['glaciate', 'fireBolt'],
    random: () => 0.5,
  };
  const state = board('crimson', 'tempest', 'rime');

  // Sweeping the whole roll space: the gated move must never be picked, however good it looks.
  for (let i = 0; i < 200; i++) {
    const roll = (i + 0.5) / 200;
    const action = pickAiAction(state, AI, { ...ctx, random: () => roll });
    assert.strictEqual(action.kind, 'move');
    if (action.kind !== 'move') continue;
    assert.strictEqual(action.moveId, 'fireBolt');
    assert.ok(action.declaredTarget !== null, 'a declared single-target action always carries an id');
  }
});

/**
 * A conditionalTarget move is declared against the pre-round snapshot and resolved against
 * mid-round state, so an id has to ride along whenever EITHER mode is single-target. The
 * spread modes ignore it; the single one would otherwise fizzle the turn away when an earlier
 * action that round moves the field out from under it.
 */
test('ai carries a declared target for a conditionalTarget move however the field is standing', () => {
  const plain = board('crimson', 'tempest', 'stormRanger');
  const surging = setFieldEffect(plain, 1, 'surgingMagic').state;

  for (const [label, state] of [['no field', plain], ['Magical Surge', surging]] as const) {
    for (const moveId of ['spreadUnderSurge', 'singleUnderSurge']) {
      for (let i = 0; i < 50; i++) {
        const roll = (i + 0.5) / 50;
        const action = pickAiAction(state, AI, contextFor([moveId], () => roll));
        assert.strictEqual(action.kind, 'move');
        if (action.kind !== 'move') continue;
        assert.ok(action.declaredTarget, `${moveId} declared with no target under ${label}`);
      }
    }
  }
});

// --- The floor (docs/stat-scaling.md §3, phase 5): a drop that lands nothing is a wasted turn ---

const weakener: MoveDefinition = {
  ...base,
  id: 'weakener',
  name: 'Weakener',
  type: 'Shadow',
  kind: 'buff',
  target: 'singleEnemy',
  statDeltas: [
    { stat: 'defense', amount: -20 },
    { stat: 'wisdom', amount: -20 },
  ],
};

test('ai: a pure debuff aims at the foe whose stats can still drop, not the one already at the floor', () => {
  const ctx: AiContext = { heroes, moves: { ...testMoves, weakener }, statuses, typeChart, moveIdsFor: () => ['weakener'], random: () => 0.9 };
  const state = atFloor(board('crimson', 'tempest', 'rime'), LEFT, ['defense', 'wisdom']);
  for (let i = 0; i < 6; i++) {
    const action = pickAiAction(state, AI, { ...ctx, random: () => i / 6 });
    assert.strictEqual(action.kind, 'move');
    assert.strictEqual(action.kind === 'move' && action.declaredTarget, RIGHT, 'aimed at the hero it can still lower');
  }
});

test('ai: a pure debuff with nowhere left to land is inert, so a hit is cast instead — and with nothing else, it Rests', () => {
  const ctx: AiContext = { heroes, moves: { ...testMoves, weakener }, statuses, typeChart, moveIdsFor: () => ['weakener', 'fireBolt'], random: () => 0.99 };
  const state = atFloor(atFloor(board('crimson', 'tempest', 'rime'), LEFT, ['defense', 'wisdom']), RIGHT, ['defense', 'wisdom']);
  for (let i = 0; i < 6; i++) {
    const action = pickAiAction(state, AI, { ...ctx, random: () => i / 6 });
    assert.strictEqual(action.kind === 'move' && action.moveId, 'fireBolt', 'the drop would land nothing anywhere');
  }
  const alone = pickAiAction(state, AI, { ...ctx, moveIdsFor: () => ['weakener'] });
  assert.strictEqual(alone.kind, 'move', 'the inert filter falls back rather than Resting — a wasted cast beats a wasted Rest by the cascade\'s own rule');
});

test('ai: a self-buff whose stat can\'t go any higher is inert, so a hit is cast instead', () => {
  const sharpener: MoveDefinition = { ...base, id: 'sharpener', name: 'Sharpener', type: 'Iron', kind: 'buff', target: 'self', statDeltas: [{ stat: 'attack', amount: 20 }] };
  const ctx: AiContext = { heroes, moves: { ...testMoves, sharpener }, statuses, typeChart, moveIdsFor: () => ['sharpener', 'fireBolt'], random: () => 0.99 };
  let state = board('crimson', 'tempest', 'rime');
  const c = state.combatants[AI];
  state = { ...state, combatants: { ...state.combatants, [AI]: { ...c, statModifiers: { ...c.statModifiers, attack: statModifierCeiling(heroes.crimson, c, 'attack') } } } } as CombatState;
  for (let i = 0; i < 6; i++) {
    const action = pickAiAction(state, AI, { ...ctx, random: () => i / 6 });
    assert.strictEqual(action.kind === 'move' && action.moveId, 'fireBolt', 'the rise would land nothing');
  }
});

test('ai: a drop that lands on ONE of a move\'s two stats is not inert', () => {
  const ctx: AiContext = { heroes, moves: { ...testMoves, weakener }, statuses, typeChart, moveIdsFor: () => ['weakener', 'fireBolt'], random: () => 0.01 };
  const state = atFloor(atFloor(board('crimson', 'tempest', 'rime'), LEFT, ['defense']), RIGHT, ['defense']);
  let debuffs = 0;
  for (let i = 0; i < 20; i++) {
    const action = pickAiAction(state, AI, { ...ctx, random: () => i / 20 });
    if (action.kind === 'move' && action.moveId === 'weakener') debuffs += 1;
  }
  assert.ok(debuffs > 0, 'Wisdom can still drop, so the move stays on the table');
});

// --- A Shield at the cap can't go any higher (docs/shield.md §3.6) ---

test('ai: a self-Shield on a hero whose pool is already at its max HP is inert, so a hit is cast instead', () => {
  const shielder: MoveDefinition = { ...base, id: 'shielder', name: 'Shielder', type: 'Iron', kind: 'buff', target: 'self', statusApplication: { statusId: 'Shield', magnitude: 30, target: 'self' } };
  const ctx: AiContext = { heroes, moves: { ...testMoves, shielder }, statuses, typeChart, moveIdsFor: () => ['shielder', 'fireBolt'], random: () => 0.99 };
  let state = board('crimson', 'tempest', 'rime');
  const c = state.combatants[AI];
  state = { ...state, combatants: { ...state.combatants, [AI]: { ...c, statuses: { ...c.statuses, Shield: { statusId: 'Shield', magnitude: getMaxHp(heroes.crimson, c) } } } } } as CombatState;
  for (let i = 0; i < 6; i++) {
    const action = pickAiAction(state, AI, { ...ctx, random: () => i / 6 });
    assert.strictEqual(action.kind === 'move' && action.moveId, 'fireBolt', 'the pool would take nothing');
  }
  // Under the cap it is a real option again.
  const below = { ...state, combatants: { ...state.combatants, [AI]: { ...c, statuses: { ...c.statuses, Shield: { statusId: 'Shield', magnitude: 10 } } } } } as CombatState;
  const picked = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const action = pickAiAction(below, AI, { ...ctx, random: () => i / 12 });
    if (action.kind === 'move') picked.add(action.moveId);
  }
  assert.ok(picked.has('shielder'), 'a Shield with room to grow is cast');
});
