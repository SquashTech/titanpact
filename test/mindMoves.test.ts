// Mind slate: statDeltaChance, requiresTargetStatReduction (Brain Flay), the stat floor. Hand-off findings: docs/authoring-moves.md §10.

import { firstStatusApplication } from '../src/engine/content';
import * as assert from 'assert';
import { test } from './harness';
import { createFightState, withFullPools } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { signatureMoves } from '../src/data/signatures';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { statKeysForMove } from '../src/engine/damage/damagePipeline';
import { getEffectiveStat } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';
import type { Action } from '../src/engine/combat/actions';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Cortex (the mono-Mind starter) and Lucius (mono-Mind since 2026-09-05, Int 90) attack; Warden and Sentinel defend. */
function mindFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'mindweaver', side: 'A' },
      { combatantId: 'a2', heroId: 'lucius', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/** Deep mana and HP so riders are reached before a KO; the hp modifier must move with currentHp (getMaxHp reads both). */
function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      withFullPools({ ...c, statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 } }),
    ])
  );
  return { ...state, combatants } as CombatState;
}

/** Sets in-fight stat modifiers directly, the way a resolved debuff would. */
function withModifiers(state: CombatState, combatantId: string, mods: Record<string, number>): CombatState {
  const c = state.combatants[combatantId];
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...c, statModifiers: { ...c.statModifiers, ...mods } } },
  } as CombatState;
}

function modifiersOf(state: CombatState, combatantId: string) {
  return state.combatants[combatantId].statModifiers as Record<string, number>;
}

// --- statDeltaChance ---

test('mind: a chanced stat delta actually rolls — the same seed sweep lands it sometimes and not others', () => {
  let landed = 0;
  let missed = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const state = withDeepPools(mindFixture(seed));
    const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'psiBolt', declaredTarget: 'b1' }];
    const { state: next } = resolveRound(state, actions, config);
    if ((modifiersOf(next, 'b1').wisdom ?? 0) < 0) landed++;
    else missed++;
  }
  assert.ok(landed > 0, 'the 20% Wisdom debuff never landed across 40 seeds');
  assert.ok(missed > 0, 'the 20% Wisdom debuff landed on every one of 40 seeds');
});

test('mind: the chance gates the RIDER, never the hit — Psi Bolt always deals damage', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const state = withDeepPools(mindFixture(seed));
    const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'psiBolt', declaredTarget: 'b1' }];
    const { events } = resolveRound(state, actions, config);
    const dealt = events.find((e) => e.type === 'DamageDealt') as { amount: number } | undefined;
    assert.ok(dealt && dealt.amount > 0, `seed ${seed}: Psi Bolt dealt no damage`);
  }
});

test('mind: an UNCHANCED stat delta draws no RNG — Enervate costs exactly what no rider costs', () => {
  for (const moveId of ['enervate', 'lull']) {
    const state = withDeepPools(mindFixture(7));
    const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId, declaredTarget: 'b1' }];
    const { state: next } = resolveRound(state, actions, config);
    assert.deepStrictEqual(next.rngState, state.rngState, `${moveId} drew RNG it should not have`);
  }
});

test('mind: a chanced SPREAD rider rolls per target — Psionic Wave can catch one foe and miss the other', () => {
  let split = false;
  for (let seed = 1; seed <= 60 && !split; seed++) {
    const state = withDeepPools(mindFixture(seed));
    const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'psionicWave', declaredTarget: 'b1' }];
    const { state: next } = resolveRound(state, actions, config);
    const hitB1 = (modifiersOf(next, 'b1').wisdom ?? 0) < 0;
    const hitB2 = (modifiersOf(next, 'b2').wisdom ?? 0) < 0;
    if (hitB1 !== hitB2) split = true;
  }
  assert.ok(split, 'Psionic Wave never debuffed exactly one of its two targets across 60 seeds');
});

// --- conditionalPower.requiresTargetStatReduction ---

// Brain Flay cashes in the slate's debuffs: ×2 against a foe carrying ANY in-fight reduction.
// It doubled the reductions themselves until 2026-09-14; the floor (−½ of base + loadout,
// state.ts statModifierFloor) left a doubling nothing to double once one scaled Mid debuff had
// landed, so the punisher became a hit and the doubling vocabulary went with it.
function flayHits(events: readonly { type: string }[]) {
  return events.filter((e) => e.type === 'DamageDealt') as unknown as { sourceCombatantId: string; targetCombatantId: string; basePowerMultiplier: number; amount: number }[];
}

test('mind: Brain Flay hits both foes, and doubles against the one whose stats have been lowered — per target', () => {
  let state = withDeepPools(mindFixture(3));
  state = withModifiers(state, 'b1', { attack: -10 });

  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'brainFlay', declaredTarget: 'b1' }];
  const { events } = resolveRound(state, actions, config);

  const hits = flayHits(events).filter((e) => e.sourceCombatantId === 'a1');
  assert.strictEqual(hits.length, 2, 'a spread lands on both');
  const onB1 = hits.find((h) => h.targetCombatantId === 'b1')!;
  const onB2 = hits.find((h) => h.targetCombatantId === 'b2')!;
  assert.strictEqual(onB1.basePowerMultiplier, 2);
  assert.strictEqual(onB2.basePowerMultiplier, 1);
  assert.ok(onB1.amount > 0 && onB2.amount > 0);
});

test('mind: a foe held at its floor still counts as lowered — the floor is where Brain Flay is strongest, not where it dies', () => {
  let state = withDeepPools(mindFixture(4));
  // Break Will into Iron Warden (Attack 60) is held at −30; the punisher reads the sign, not the depth.
  state = withModifiers(state, 'b1', { attack: -30 });
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'brainFlay', declaredTarget: 'b1' }];
  const { events } = resolveRound(state, actions, config);
  const onB1 = flayHits(events).find((h) => h.sourceCombatantId === 'a1' && h.targetCombatantId === 'b1')!;
  assert.strictEqual(onB1.basePowerMultiplier, 2);
});

test('mind: Brain Flay reads statModifiers, NEVER baselineStatModifiers — armor does not arm it, and a buff does not either', () => {
  let state = withDeepPools(mindFixture(5));
  state = withModifiers(state, 'b1', { defense: 20 });
  const c = state.combatants.b1;
  state = {
    ...state,
    combatants: {
      ...state.combatants,
      b1: { ...c, baselineStatModifiers: { ...c.baselineStatModifiers, intelligence: 20, wisdom: -40 } },
    },
  } as CombatState;

  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'brainFlay', declaredTarget: 'b1' }];
  const { events, state: next } = resolveRound(state, actions, config);
  const onB1 = flayHits(events).find((h) => h.sourceCombatantId === 'a1' && h.targetCombatantId === 'b1')!;
  assert.strictEqual(onB1.basePowerMultiplier, 1);
  // The hit writes nothing back: the reductions on the board are read, never touched.
  assert.deepStrictEqual(modifiersOf(next, 'b1'), modifiersOf(state, 'b1'));
});

test('mind: Brain Flay on a clean board is a plain spread hit and still spends the mana', () => {
  const state = withDeepPools(mindFixture(6));
  const before = state.combatants.a1.currentMana;
  const regen = getEffectiveStat(heroes.mindweaver, state.combatants.a1, 'mpRegen');
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'brainFlay', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  const hits = flayHits(events).filter((e) => e.sourceCombatantId === 'a1');
  assert.strictEqual(hits.length, 2);
  assert.ok(hits.every((h) => h.basePowerMultiplier === 1 && h.amount > 0));
  assert.strictEqual(events.some((e) => e.type === 'StatChanged'), false);
  // Net of the end-of-round MP Regen tick.
  assert.strictEqual(next.combatants.a1.currentMana, before - moves.brainFlay.manaCost + regen);
});

// --- The stat floor ---

test('mind: no effective stat can fall below 1, however far the modifier goes', () => {
  let state = withDeepPools(mindFixture(9));
  state = withModifiers(state, 'b1', { attack: -9999, wisdom: -9999, speed: -9999 });
  const hero = heroes[state.combatants.b1.heroId];

  for (const stat of ['attack', 'wisdom', 'speed'] as const) {
    assert.strictEqual(getEffectiveStat(hero, state.combatants.b1, stat), 1);
  }
});

test('mind: the floor is applied AFTER Freeze halves Speed, so a bottomed-out hero still reads 1', () => {
  let state = withDeepPools(mindFixture(10));
  state = withModifiers(state, 'b1', { speed: -9999 });
  const c = state.combatants.b1;
  state = {
    ...state,
    combatants: { ...state.combatants, b1: { ...c, statuses: { ...c.statuses, Freeze: { statusId: 'Freeze' } } } },
  } as CombatState;
  assert.strictEqual(getEffectiveStat(heroes[c.heroId], state.combatants.b1, 'speed'), 1);
});

test('mind: an attack into a floored defender still deals POSITIVE damage', () => {
  // Without the floor a negative defStat inverted the ratio (a heal) and 0 made it Infinity.
  let state = withDeepPools(mindFixture(13));
  state = withModifiers(state, 'b1', { wisdom: -9999 });
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'psiBolt', declaredTarget: 'b1' }];
  const { events } = resolveRound(state, actions, config);
  const dealt = events.find((e) => e.type === 'DamageDealt') as { amount: number } | undefined;
  assert.ok(dealt);
  assert.ok(Number.isFinite(dealt.amount) && dealt.amount > 0, `damage was ${dealt.amount}`);
});

// --- Mind Shatter: offStatOverride ---

test('mind: Mind Shatter swings Wisdom, and only the numerator moves', () => {
  assert.deepStrictEqual(statKeysForMove(moves.mindShatter), ['wisdom', 'wisdom']);
  assert.deepStrictEqual(statKeysForMove(moves.psyshock), ['intelligence', 'wisdom']);
});

test('mind: buffing the caster Wisdom actually makes Mind Shatter hit harder', () => {
  const base = withDeepPools(mindFixture(2));
  const buffed = withModifiers(base, 'a1', { wisdom: 60 });
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'mindShatter', declaredTarget: 'b1' }];

  const plain = resolveRound(base, actions, config).events.find((e) => e.type === 'DamageDealt') as { amount: number };
  const big = resolveRound(buffed, actions, config).events.find((e) => e.type === 'DamageDealt') as { amount: number };
  assert.ok(big.amount > plain.amount, `${big.amount} was not greater than ${plain.amount}`);
});

// --- Mind is one of Haunt's spreadTriggerTypes ---

test('mind: every single-target Mind damage move carries the Haunt spread for free', () => {
  assert.deepStrictEqual(statuses.Haunt.spreadTriggerTypes, ['Spirit', 'Mind']);
  const singleTargetMindDamage = Object.values(moves).filter(
    (m) => m.type === 'Mind' && !signatureMoves[m.id] && m.kind === 'damage' && m.target === 'singleEnemy'
  );
  assert.strictEqual(singleTargetMindDamage.length, 8);
  const haunters = Object.values(moves).filter(
    (m) => m.type === 'Mind' && !signatureMoves[m.id] && firstStatusApplication(m)?.statusId === 'Haunt'
  );
  assert.deepStrictEqual(haunters.map((m) => m.id), ['wickedFear']);
});

test('mind: Cerebral Shock plants a mark no Mind move can cash in', () => {
  // Intended: Mind sets Conduct, a Storm, Iron or Mech partner detonates it.
  assert.strictEqual(firstStatusApplication(moves.cerebralShock)?.statusId, 'Conduct');
  assert.deepStrictEqual(statuses.Conduct.triggerTypes, ['Storm', 'Iron', 'Mech']);
  assert.strictEqual((statuses.Conduct.triggerTypes as readonly string[]).includes('Mind'), false);
});

// --- Distribution ---

test('mind: neither Mind hero starts with a move it cannot pay for, or has a starter listed in its own pool', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const heroId of ['mindweaver', 'lucius']) {
    const hero = heroes[heroId];
    for (const moveId of hero.moveIds) {
      assert.ok(
        moves[moveId].manaCost <= hero.baseStats.manaPool,
        `${heroId} cannot afford its own starting move ${moveId}`
      );
    }
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('mind: each Mind hero attacks with a stat it is actually good at', () => {
  for (const heroId of ['mindweaver', 'lucius']) {
    const hero = heroes[heroId];
    const damage = hero.moveIds.map((id) => moves[id]).filter((m) => m.kind === 'damage');
    assert.ok(damage.length > 0, `${heroId} has no damage move at all`);
    const wants = hero.baseStats.attack > hero.baseStats.intelligence ? 'physical' : 'magical';
    assert.ok(damage.some((m) => m.category === wants), `${heroId} attacks off its weaker stat`);
  }
});

test('mind: the authored slate is 16 moves plus the three 2026-09-15 additions, and every authored stat delta is still a multiple of 5', () => {
  const mind = Object.values(moves).filter((m) => m.type === 'Mind' && !signatureMoves[m.id]);
  assert.strictEqual(mind.length, 19);
  for (const m of mind) {
    for (const d of m.statDeltas ?? []) {
      assert.strictEqual(Math.abs(d.amount) % 5, 0, `${m.id} authors a non-multiple-of-5 delta`);
    }
  }
});
