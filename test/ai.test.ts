import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import type { MoveDefinition } from '../src/engine/content';
import type { CombatState } from '../src/engine/state';
import { pickAiAction, type AiContext } from '../src/run/ai';

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
};

const AI = 'ai:caster';
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
