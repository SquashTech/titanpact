// Fire slate: tests the mechanics Fire introduced (chanced riders, per-move crit,
// conditional BasePower, statDeltas on damage moves). Hand-off: docs/authoring-moves.md §10.

import { statusApplicationsOf } from '../src/engine/content';
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
import { applyStatus } from '../src/engine/combat/statusEngine';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState } from '../src/engine/state';
import { calcDamage, resolveConditionalPowerMultiplier } from '../src/engine/damage/damagePipeline';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** crimson + cinderKnight vs ironWarden + wildOracle. */
function fireFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'crimson', side: 'A' },
      { combatantId: 'a2', heroId: 'cinderKnight', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

/** Deep mana for everyone and 1200 HP for side B, so riders are reached before a KO. */
function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      {
        ...c,
        currentMana: 999,
        currentHp: c.side === 'B' ? 1200 : c.currentHp,
        statModifiers: { ...c.statModifiers, manaPool: 999, ...(c.side === 'B' ? { hp: 1200 } : {}) },
      },
    ])
  );
  return { ...state, combatants } as CombatState;
}

function burn(state: CombatState, combatantId: string, magnitude: number): CombatState {
  return applyStatus(state, 1, combatantId, statuses.Burn, { magnitude }).state;
}

// --- The pool itself ---

test('fire: the authored pool is exactly the sixteen designed moves, all Fire-typed', () => {
  const fire = Object.values(moves).filter((m) => m.type === 'Fire');
  assert.deepStrictEqual(
    fire.map((m) => m.id).sort(),
    [
      'backdraft', 'ember', 'firebrand', 'firestorm', 'immolate', 'inferno', 'kindle', 'moltenLash',
      'scorch', 'setAlight', 'singe', 'sparkBurst', 'sparkFlash', 'spreadingBlaze', 'stokeTheFlames',
      'volcanicSurge',
    ]
  );
});

test('fire: Stoke the Flames ramps the whole active side, not just the caster', () => {
  const state = withDeepPools(fireFixture(940));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'stokeTheFlames' }];

  const once = resolveRound(state, actions, config);
  assert.strictEqual(once.state.combatants.a1.statuses.FireForce?.magnitude, 20, 'the caster');
  assert.strictEqual(once.state.combatants.a2.statuses.FireForce?.magnitude, 20, 'and its partner');
  const twice = resolveRound(once.state, actions, config);
  assert.strictEqual(twice.state.combatants.a2.statuses.FireForce?.magnitude, 40);
});

test('fire: Fire Force from Stoke the Flames reaches the PARTNER\'s Fire moves as flat Base Power', () => {
  const state = withDeepPools(fireFixture(941));
  const hit: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'firebrand', declaredTarget: 'b1' }];
  const stoke: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'stokeTheFlames' }];

  const plain = resolveRound(state, hit, config);
  const ramped = resolveRound(resolveRound(state, stoke, config).state, hit, config);

  const bonusOf = (r: ReturnType<typeof resolveRound>) =>
    (r.events.find((e) => e.type === 'DamageDealt') as any).elementalForceBonus;
  assert.strictEqual(bonusOf(plain), 0);
  assert.strictEqual(bonusOf(ramped), 20); // a1 cast it; a2 is the one swinging
});

test('fire: every "Spread" move in the design table targets both enemies, and no other Fire move does', () => {
  const spread = Object.values(moves)
    .filter((m) => m.type === 'Fire' && m.target === 'bothEnemies')
    .map((m) => m.id)
    .sort();
  assert.deepStrictEqual(spread, ['backdraft', 'firestorm', 'sparkBurst', 'sparkFlash', 'spreadingBlaze']);
});

test('fire: no Fire move applies a status the catalog does not define', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Fire') continue;
    for (const app of statusApplicationsOf(move)) {
      assert.ok(statuses[app.statusId], `${move.id} applies unknown status ${app.statusId}`);
    }
  }
});

// --- StatusApplication.chance (Ember) ---

test('fire: an unchanced rider draws no RNG — only a chanced one advances the stream', () => {
  // All three moves spend the same two draws (variance, crit); any rngState difference is the rider's.
  const state = withDeepPools(fireFixture(900));
  const after = (moveId: string) =>
    resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId, declaredTarget: 'b1' }] as Action[], config).state.rngState;

  assert.strictEqual(after('scorch'), after('inferno'), 'an unchanced Burn rider must cost the same RNG as no rider at all');
  assert.notStrictEqual(after('ember'), after('inferno'), 'a chanced rider must draw its own roll');
  // Crimson (Fire, Int 80) lands Burn 15 x 1.30 x 1.25 STAB = 24, then the round tick halves it.
  const scorched = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'scorch', declaredTarget: 'b1' }] as Action[], config);
  assert.strictEqual(scorched.state.combatants.b1.statuses.Burn?.magnitude, 12);
});

test("fire: Ember's 10% Burn lands sometimes and not others across seeds, and the hit itself always resolves", () => {
  let landed = 0;
  const rounds = 200;
  for (let seed = 0; seed < rounds; seed++) {
    const state = withDeepPools(fireFixture(seed));
    const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'ember', declaredTarget: 'b1' }];
    const { state: next, events } = resolveRound(state, actions, config);
    assert.ok(events.some((e) => e.type === 'DamageDealt'), `seed ${seed}: Ember must still hit`);
    if (next.combatants.b1.statuses.Burn) landed++;
  }
  assert.ok(landed > 0, 'expected Ember to inflict Burn at least once in 200 seeds');
  assert.ok(landed < rounds, 'expected Ember to whiff its Burn at least once in 200 seeds');
  // Wide band: asserts the roll is a roll, not that the RNG is uniform.
  assert.ok(landed < rounds * 0.4, `expected roughly 10% Burn uptake, got ${landed}/${rounds}`);
});

// --- MoveDefinition.critChance (Singe, Firebrand) ---

test('fire: a 30%-crit move crits far more often than the 1/16 default, and both stay honest on the event', () => {
  function critRate(moveId: string, targetId: string) {
    let crits = 0;
    const rounds = 200;
    for (let seed = 0; seed < rounds; seed++) {
      const state = withDeepPools(fireFixture(seed));
      const actions: Action[] = [{ kind: 'move', combatantId: 'a2', moveId, declaredTarget: targetId }];
      const { events } = resolveRound(state, actions, config);
      const dealt = events.find((e) => e.type === 'DamageDealt');
      assert.ok(dealt && dealt.type === 'DamageDealt');
      if (dealt.type === 'DamageDealt') {
        crits += dealt.isCrit ? 1 : 0;
        assert.strictEqual(dealt.critMultiplier, dealt.isCrit ? 1.5 : 1);
      }
    }
    return crits / rounds;
  }

  const authored = critRate('firebrand', 'b1'); // critChance 0.3
  const defaulted = critRate('moltenLash', 'b1'); // no critChance — the 1/16 default
  assert.ok(authored > defaulted * 2, `expected the 30% move to crit far more often (${authored} vs ${defaulted})`);
  assert.ok(authored > 0.15 && authored < 0.5, `expected roughly a 30% crit rate, got ${authored}`);
});

// --- MoveDefinition.conditionalPower (Immolate) ---

test('fire: Immolate triples BasePower against a Burned target and leaves a clean one alone', () => {
  const plain = fireFixture(910);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.immolate, plain.combatants.b1, plain.combatants.a1), 1);
  const burned = burn(plain, 'b1', 20);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.immolate, burned.combatants.b1, burned.combatants.a1), 3);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.inferno, burned.combatants.b1, burned.combatants.a1), 1);
});

test('fire: the conditional multiplier is a BasePower-stage term, not a damage modifier', () => {
  // Two-pipeline separation: x3 scales the BasePower input, not the multiplier product.
  const tripled = calcDamage(moves.immolate, 1, ['Fire'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 3);
  const plain = calcDamage(moves.immolate, 1, ['Fire'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 1);
  assert.strictEqual(tripled.basePowerMultiplier, 3);
  assert.strictEqual(tripled.multiplierTerm, 1, 'the conditional term must NOT leak into the damage-modifier product');
  assert.strictEqual(tripled.damage / plain.damage, 3);

  // With Fire Force 10 on top: (30 x 3) + 10 = 100, not (30 + 10) x 3 = 120.
  const withForce = calcDamage(moves.immolate, 1, ['Fire'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 10, 3);
  const stab = withForce.stab;
  const typeMult = withForce.typeMult;
  assert.strictEqual(withForce.damage, 100 * stab * typeMult);
});

test('fire: Immolate reads the target Burn a faster ally applied EARLIER in the same round', () => {
  const state = withDeepPools(fireFixture(911));
  const setup: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'setAlight', declaredTarget: 'b1' }, // crimson, speed 62
    { kind: 'move', combatantId: 'a2', moveId: 'immolate', declaredTarget: 'b1' }, // cinderKnight, speed 50
  ];
  const soloImmolate: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'immolate', declaredTarget: 'b1' }];

  const paired = resolveRound(state, setup, config);
  const alone = resolveRound(state, soloImmolate, config);

  const immolateHit = (events: readonly { type: string }[]) =>
    events.find((e: any) => e.type === 'DamageDealt' && e.moveId === 'immolate') as any;

  assert.strictEqual(immolateHit(paired.events).basePowerMultiplier, 3);
  assert.strictEqual(immolateHit(alone.events).basePowerMultiplier, 1);
});

// --- statDeltas on a damage move (Molten Lash) ---

test("fire: Molten Lash deals damage, applies Burn, and drops the target's Defense in one action", () => {
  const state = withDeepPools(fireFixture(920));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'moltenLash', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(events.some((e) => e.type === 'DamageDealt'));
  // Cinder Knight (Fire/Iron, Attack 85) on a PHYSICAL move: Burn 15 x 1.35 x 1.25 STAB = 25, halved.
  assert.strictEqual(next.combatants.b1.statuses.Burn?.magnitude, 12);
  assert.strictEqual(next.combatants.b1.statModifiers.defense, -10);
  assert.ok(events.some((e) => e.type === 'StatChanged' && (e as any).stat === 'defense' && (e as any).delta === -10));
});

test('fire: the Defense drop lands AFTER the hit that delivered it, so it only pays off next round', () => {
  const state = withDeepPools(fireFixture(921));
  const once: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'moltenLash', declaredTarget: 'b1' }];

  const first = resolveRound(state, once, config);
  const firstHit = first.events.find((e: any) => e.type === 'DamageDealt') as any;
  assert.strictEqual(firstHit.defStat, heroes.ironWarden.baseStats.defense, 'the lash must not soften its own target first');

  const second = resolveRound(first.state, once, config);
  const secondHit = second.events.find((e: any) => e.type === 'DamageDealt') as any;
  assert.strictEqual(secondHit.defStat, heroes.ironWarden.baseStats.defense - 10);
});

// --- Spread + field effect + self-inflicted riders ---

test('fire: Spreading Blaze Burns both foes and sets Scorched Land in one cast', () => {
  const state = withDeepPools(fireFixture(930));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'spreadingBlaze' }];
  const { state: next } = resolveRound(state, actions, config);

  assert.strictEqual(next.activeFieldEffect?.fieldEffectId, 'scorchedLand');
  // Crimson lands Burn 15 x 1.30 x 1.25 STAB = 24 on both, and Scorched Land takes the round
  // tick's decay down to a quarter rather than a half.
  assert.strictEqual(next.combatants.b1.statuses.Burn?.magnitude, 18);
  assert.strictEqual(next.combatants.b2.statuses.Burn?.magnitude, 18);
});

test('fire: Volcanic Surge Burns the USER, not the target', () => {
  const state = withDeepPools(fireFixture(931));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'volcanicSurge', declaredTarget: 'b1' }];
  const { state: next } = resolveRound(state, actions, config);

  assert.ok(next.combatants.a2.statuses.Burn, 'the user pays the recoil');
  assert.strictEqual(next.combatants.b1.statuses.Burn, undefined, 'the target takes damage, not Burn');
  assert.ok(next.combatants.b1.currentHp < state.combatants.b1.currentHp);
});
