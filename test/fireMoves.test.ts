// Fire's authored movepool (src/data/moves.ts, 2026-08-29) and the four
// engine fields it is the first content to need. Three of the four are
// generic vocabulary that any later type can reach for, so these tests are
// written against the MECHANIC (a chanced rider, a per-move crit rate, a
// conditional BasePower term, stat deltas on a damage move) with Fire's moves
// as the vehicle — not against Fire's numbers, which are balance and will move.
//
// The numbers that ARE asserted here are the ones the design table locks:
// which moves are spread, which carry Burn, and that Immolate's multiplier is
// a BasePower-stage term rather than a damage modifier (CLAUDE.md
// "Two-pipeline separation") — that last one is the easy thing to get wrong
// and the hard thing to notice.

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

/** crimson (Int 80, mono Fire) attacks; ironWarden/wildOracle defend — the same shape every other combat test uses. */
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

/**
 * Two fixture problems these tests all share, solved once:
 *
 * - **Mana.** Inferno costs 75, more than any fixture hero's whole pool — Fire's
 *   authored cost curve is steeper than the fixture heroes were statted for.
 * - **Lethality.** Crimson's Ember into ironWarden is 40 BP x 1.6 ratio x 1.25
 *   STAB x 2 (Fire beats Iron) — comfortably more than ironWarden's 135 HP. A
 *   target that faints to the hit never reaches the status/stat riders at all
 *   (resolveRound skips a fainted combatant), which silently turns a rider test
 *   into a KO test.
 *
 * Both are fixture facts, not the mechanics under test, so everyone gets a deep
 * pool and the defenders get enough HP to survive being studied.
 */
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

// --- The pool itself -------------------------------------------------------

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
  // Additive stacking, and no decay — this is a ramp, not a burst.
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

// --- StatusApplication.chance (Ember) --------------------------------------

test('fire: an unchanced rider draws no RNG — only a chanced one advances the stream', () => {
  // The guard that keeps every fight authored before `chance` existed
  // byte-identical: the roll happens only when the field is present. All three
  // moves below are single-target Fire damage at the default crit rate, so each
  // spends exactly the two documented draws (variance, then crit) on its hit —
  // any difference in the surviving rngState is the rider's doing and nothing
  // else's.
  const state = withDeepPools(fireFixture(900));
  const after = (moveId: string) =>
    resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId, declaredTarget: 'b1' }] as Action[], config).state.rngState;

  assert.strictEqual(after('scorch'), after('inferno'), 'an unchanced Burn rider must cost the same RNG as no rider at all');
  assert.notStrictEqual(after('ember'), after('inferno'), 'a chanced rider must draw its own roll');
  // ...and the unchanced one lands unconditionally. Burn 10 applied, then the
  // end-of-round tick fires it and halves it (docs/conditions.md).
  const scorched = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'scorch', declaredTarget: 'b1' }] as Action[], config);
  assert.strictEqual(scorched.state.combatants.b1.statuses.Burn?.magnitude, 5);
});

test("fire: Ember's 10% Burn lands sometimes and not others across seeds, and the hit itself always resolves", () => {
  let landed = 0;
  const rounds = 200;
  for (let seed = 0; seed < rounds; seed++) {
    const state = withDeepPools(fireFixture(seed));
    const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'ember', declaredTarget: 'b1' }];
    const { state: next, events } = resolveRound(state, actions, config);
    // CLAUDE.md "No accuracy stat": only the rider is chanced. The damage lands every time.
    assert.ok(events.some((e) => e.type === 'DamageDealt'), `seed ${seed}: Ember must still hit`);
    if (next.combatants.b1.statuses.Burn) landed++;
  }
  assert.ok(landed > 0, 'expected Ember to inflict Burn at least once in 200 seeds');
  assert.ok(landed < rounds, 'expected Ember to whiff its Burn at least once in 200 seeds');
  // Wide band deliberately: this asserts the roll is a roll, not that mulberry32 is uniform.
  assert.ok(landed < rounds * 0.4, `expected roughly 10% Burn uptake, got ${landed}/${rounds}`);
});

// --- MoveDefinition.critChance (Singe, Firebrand) --------------------------

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
        // The crit term on the event is the one that was actually applied.
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

// --- MoveDefinition.conditionalPower (Immolate) ----------------------------

test('fire: Immolate triples BasePower against a Burned target and leaves a clean one alone', () => {
  const plain = fireFixture(910);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.immolate, plain.combatants.b1, plain.combatants.a1), 1);
  const burned = burn(plain, 'b1', 20);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.immolate, burned.combatants.b1, burned.combatants.a1), 3);
  // A move with no condition is unaffected either way.
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.inferno, burned.combatants.b1, burned.combatants.a1), 1);
});

test('fire: the conditional multiplier is a BasePower-stage term, not a damage modifier', () => {
  // The distinction CLAUDE.md's two-pipeline rule turns on: x3 must scale the
  // formula's BasePower INPUT, so it reads as "a 90 BP move" and composes with
  // Elemental Force additively at that stage — not as a multiplierTerm on the
  // finished number. Both happen to produce the same damage with no Force
  // present, which is exactly why this is asserted structurally.
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
  // Declare-then-resolve does not mean resolve-in-a-vacuum: Set Alight from the
  // faster hero lands its Burn before Immolate's own action comes up.
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

// --- statDeltas on a damage move (Molten Lash) -----------------------------

test("fire: Molten Lash deals damage, applies Burn, and drops the target's Defense in one action", () => {
  const state = withDeepPools(fireFixture(920));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'moltenLash', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(events.some((e) => e.type === 'DamageDealt'));
  // Burn 10 applied, then halved by the end-of-round tick it also triggered.
  assert.strictEqual(next.combatants.b1.statuses.Burn?.magnitude, 5);
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

// --- Spread + field effect + self-inflicted riders -------------------------

test('fire: Spreading Blaze Burns both foes and sets Scorched Land in one cast', () => {
  const state = withDeepPools(fireFixture(930));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'spreadingBlaze' }];
  const { state: next } = resolveRound(state, actions, config);

  assert.strictEqual(next.activeFieldEffect?.fieldEffectId, 'scorchedLand');
  // Scorched Land suppresses Burn's decay, so the end-of-round tick that just
  // ran left both stacks at full magnitude rather than halving them.
  assert.strictEqual(next.combatants.b1.statuses.Burn?.magnitude, 10);
  assert.strictEqual(next.combatants.b2.statuses.Burn?.magnitude, 10);
});

test('fire: Volcanic Surge Burns the USER, not the target', () => {
  const state = withDeepPools(fireFixture(931));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'volcanicSurge', declaredTarget: 'b1' }];
  const { state: next } = resolveRound(state, actions, config);

  assert.ok(next.combatants.a2.statuses.Burn, 'the user pays the recoil');
  assert.strictEqual(next.combatants.b1.statuses.Burn, undefined, 'the target takes damage, not Burn');
  assert.ok(next.combatants.b1.currentHp < state.combatants.b1.currentHp);
});
