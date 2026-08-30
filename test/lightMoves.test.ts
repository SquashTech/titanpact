// Light's authored movepool (src/data/moves.ts, 2026-08-30) and the one engine
// field it is the first content to need:
//
//   - `conditionalPower.requiresFieldEffect` (Smite) — the same BasePower-stage
//     multiplier Immolate, Cold Snap, Seed Shot and Branch Slam use, asked of
//     the BOARD instead of of a combatant. The first damage condition in the
//     game that nobody holds.
//
// Same discipline as fire/water/frost/storm/stone/natureMoves: these assert the
// MECHANIC with Light's moves as the vehicle, never Light's numbers, which are
// balance and will move. What IS pinned is what is easy to get wrong and hard to
// notice afterwards:
//
//   1. the field-side multiplier lands on the formula's BasePower INPUT and not
//      on `multiplierTerm` — the two-pipeline separation is LOCKED (CLAUDE.md),
//      and a term on the wrong side of it is invisible until two of them stack;
//   2. it reads ONE global slot, so a spread cast is doubled against every
//      target or none, and a DIFFERENT field effect overriding Sanctuary
//      switches the bonus straight back off. Only one field is ever active
//      (docs/field-effects.md), which makes "someone else set theirs" a real
//      counterplay rather than a hypothetical;
//   3. it is read at resolution, so a Consecrate cast by a faster ally earlier
//      in the same round already counts — the same freshness rule the status
//      forms follow;
//   4. `consumesStatus` is INERT on this form. There is no holder to strip, and
//      ending a global both-sides field early is a different mechanic that has
//      not been decided (content.ts);
//   5. it draws no RNG and leaves every board-free caller answering exactly as
//      before — golden replays depend on a new optional field being inert
//      (authoring-moves.md §5).

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
import { FIELD_EFFECT_DURATION_ROUNDS } from '../src/engine/combat/fieldEffectEngine';
import { calcDamage, resolveConditionalPowerMultiplier } from '../src/engine/damage/damagePipeline';
import { hasStatus } from '../src/engine/state';
import type { CombatState, FieldEffectContext } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Solace (the magical line, speed 61) and Aegis (the physical one, speed 35) attack; Warden and Sentinel defend. */
function lightFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'dawnwarden', side: 'A' },
      { combatantId: 'a2', heroId: 'aegis', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/**
 * The two fixture problems every authored slate hits (authoring-moves.md §8),
 * solved once:
 *
 * - **Mana.** Light's curve tops out at 120 (Judgment, the most expensive move
 *   in the game), far above every Light hero's STARTING pool — which is the
 *   intended shape (docs/mana.md, pools grow all run), not something these
 *   tests should be gated on.
 * - **Lethality.** A defender that faints to the hit never reaches the riders,
 *   which would silently turn a Daze test into a KO test. getMaxHp reads
 *   baseStats + statModifiers, so the hp modifier has to move with currentHp.
 */
function withDeepPools(state: CombatState): CombatState {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      { ...c, currentMana: 999, currentHp: 1200, statModifiers: { ...c.statModifiers, manaPool: 999, hp: 1200 } },
    ])
  );
  return { ...state, combatants } as CombatState;
}

/** Turns the ground, the way a resolved fieldEffectApplication would. */
function withField(state: CombatState, fieldEffectId: string): CombatState {
  return { ...state, activeFieldEffect: { fieldEffectId, roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
}

const ctxOf = (state: CombatState): FieldEffectContext => ({ active: state.activeFieldEffect, defs: fieldEffects });

// --- conditionalPower.requiresFieldEffect: a condition nobody holds ----------

test('light: Smite doubles off the active FIELD, not off either combatant', () => {
  const bare = withDeepPools(lightFixture(101));
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.smite, bare.combatants.b1, bare.combatants.a1, ctxOf(bare)), 1);

  const hallowed = withField(bare, 'sanctuary');
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.smite, hallowed.combatants.b1, hallowed.combatants.a1, ctxOf(hallowed)),
    2
  );

  // A DIFFERENT field is not a weaker Sanctuary, it is no Sanctuary: only one
  // effect is ever active (docs/field-effects.md), so anyone setting theirs
  // switches this bonus off. That is the counterplay the 40 mana is priced
  // against, and it is the half a "is a field up at all" implementation would
  // silently get wrong.
  const overridden = withField(bare, 'verdantEarth');
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.smite, overridden.combatants.b1, overridden.combatants.a1, ctxOf(overridden)),
    1
  );
});

test('light: the field-side multiplier is a BasePower-stage term, not a damage modifier', () => {
  // The LOCKED two-pipeline separation (CLAUDE.md), asserted structurally for
  // the same reason fire/natureMoves assert it for their forms: a term on the
  // wrong side of the split produces identical damage until a second modifier
  // stacks against it, at which point it is already shipped.
  const doubled = calcDamage(moves.smite, 1, ['Light'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 2);
  assert.strictEqual(doubled.basePowerMultiplier, 2, 'the multiplier rides the BasePower input');
  assert.strictEqual(doubled.multiplierTerm, 1, 'and never becomes a multiplier on the finished hit');

  const plain = calcDamage(moves.smite, 1, ['Light'], ['Iron'], typeChart, 1, false, [], undefined, undefined, 0, 1);
  assert.strictEqual(doubled.damage, plain.damage * 2, 'BasePower is linear, so ×2 BasePower is ×2 damage');
});

test('light: Smite actually hits twice as hard through resolveRound once Sanctuary is up', () => {
  const swing = (hallowed: boolean) => {
    const base = withDeepPools(lightFixture(102));
    const state = hallowed ? withField(base, 'sanctuary') : base;
    const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'smite', declaredTarget: 'b1' }], config);
    const hit = events.find((e) => e.type === 'DamageDealt');
    return hit && hit.type === 'DamageDealt' ? hit : null;
  };

  const bare = swing(false);
  const boosted = swing(true);
  assert.ok(bare && boosted);
  // Same seed, so the same variance and crit roll — the only difference is the
  // BasePower term the event now carries, which is also what the Battle Log
  // prints (events.ts DamageDealtEvent.basePowerMultiplier).
  assert.strictEqual(bare.basePowerMultiplier, 1);
  assert.strictEqual(boosted.basePowerMultiplier, 2);
  assert.ok(boosted.amount > bare.amount, `expected the hallowed swing to hit harder (${boosted.amount} vs ${bare.amount})`);
});

test('light: a Consecrate cast earlier in the SAME round already counts', () => {
  // The freshness rule, on the field side: Solace (speed 61) outruns Aegis (35),
  // so Consecrate turns the ground before Smite resolves. Sanctuary also gives
  // heals +1 priority, which is what puts Consecrate first here twice over.
  const state = withDeepPools(lightFixture(103));
  const { events } = resolveRound(
    state,
    [
      { kind: 'move', combatantId: 'a1', moveId: 'consecrate' },
      { kind: 'move', combatantId: 'a2', moveId: 'smite', declaredTarget: 'b1' },
    ],
    config
  );
  const hit = events.find((e) => e.type === 'DamageDealt');
  assert.ok(hit && hit.type === 'DamageDealt');
  assert.strictEqual(hit.basePowerMultiplier, 2, "the partner's Consecrate arrived in time");
});

test('light: a field-side conditional is all-or-nothing across a spread, where a target-side one is per target', () => {
  // The asymmetry worth pinning: the target-side form is read per hit off each
  // defender, so it can double against one foe and not the other. The field form
  // asks one question of one global slot, so every target of a single cast gets
  // the same answer — the same shape the user-side form has, arrived at for a
  // different reason.
  const state = withField(withDeepPools(lightFixture(104)), 'sanctuary');
  const spread = { ...moves.smite, id: 'testSpreadSmite', target: 'bothEnemies' as const };
  const { events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'testSpreadSmite' }],
    { ...config, moves: { ...moves, testSpreadSmite: spread } }
  );
  const hits = events.filter((e) => e.type === 'DamageDealt');
  assert.strictEqual(hits.length, 2);
  for (const hit of hits) {
    assert.ok(hit.type === 'DamageDealt');
    assert.strictEqual(hit.basePowerMultiplier, 2, 'both halves of the spread read the same board');
  }
});

test('light: consumesStatus is inert on the field form — Sanctuary survives the hit it powered', () => {
  // There is no holder to strip (content.ts). A move authoring both is
  // malformed content today; this asserts it is a NO-OP rather than a third,
  // guessed-at meaning — an early field clear would be a mechanic nobody
  // designed, arriving through a field that means something else.
  const state = withField(withDeepPools(lightFixture(105)), 'sanctuary');
  const greedy = { ...moves.smite, id: 'testGreedySmite', conditionalPower: { requiresFieldEffect: 'sanctuary', multiplier: 2, consumesStatus: true } };
  const { state: after, events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'testGreedySmite', declaredTarget: 'b1' }],
    { ...config, moves: { ...moves, testGreedySmite: greedy } }
  );

  const hit = events.find((e) => e.type === 'DamageDealt');
  assert.ok(hit && hit.type === 'DamageDealt' && hit.basePowerMultiplier === 2, 'it still got the multiplier');
  assert.deepStrictEqual(events.filter((e) => e.type === 'StatusRemoved'), [], 'and stripped nothing to pay for it');
  assert.strictEqual(after.activeFieldEffect?.fieldEffectId, 'sanctuary', 'the ground is still hallowed');
});

test('light: the new field draws no RNG and leaves board-free callers answering as before', () => {
  // Default-to-inert (authoring-moves.md §5). Two halves:
  //   - reading the board costs no roll, so the same cast under Sanctuary and
  //     without it advances the stream identically. Golden replays depend on it;
  //   - a caller with no fight in scope (the compendium, a hero sheet, the
  //     draft) passes no context at all and must get the unbuffed answer rather
  //     than a crash or a silent double.
  const bare = withDeepPools(lightFixture(106));
  const hallowed = withField(bare, 'sanctuary');
  const cast = [{ kind: 'move' as const, combatantId: 'a1', moveId: 'smite', declaredTarget: 'b1' }];
  assert.strictEqual(
    resolveRound(hallowed, cast, config).state.rngState,
    resolveRound(bare, cast, config).state.rngState,
    'the field read is not a roll'
  );

  assert.strictEqual(resolveConditionalPowerMultiplier(moves.smite, bare.combatants.b1, bare.combatants.a1), 1);
  // And a move with no conditional at all is untouched whatever the board says.
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.judgment, hallowed.combatants.b1, hallowed.combatants.a1, ctxOf(hallowed)),
    1
  );
});

// --- the slate's own shape --------------------------------------------------

test('light: no Light move applies or scales off something the catalog does not define', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Light') continue;
    if (move.statusApplication) {
      assert.ok(statuses[move.statusApplication.statusId], `${move.id} applies unknown status ${move.statusApplication.statusId}`);
    }
    if (move.fieldEffectApplication) {
      assert.ok(fieldEffects[move.fieldEffectApplication], `${move.id} sets unknown field effect ${move.fieldEffectApplication}`);
    }
    if (move.conditionalPower) {
      const { requiresTargetStatus, requiresUserStatus, requiresFieldEffect } = move.conditionalPower;
      const authored = [requiresTargetStatus, requiresUserStatus, requiresFieldEffect].filter(Boolean);
      assert.strictEqual(authored.length, 1, `${move.id} must author exactly one side of conditionalPower`);
      if (requiresFieldEffect) assert.ok(fieldEffects[requiresFieldEffect], `${move.id} scales off unknown field ${requiresFieldEffect}`);
      else assert.ok(statuses[authored[0] as string], `${move.id} scales off unknown status`);
    }
  }
});

test('light: no Daze applier authors a number — the status is flinch-shaped', () => {
  // The inverse of the assertion this file shipped with. Daze was a
  // duration-shape lockout authored per-move at 2; the 2026-08-30 redesign made
  // it boolean and end-of-round (statuses.ts, content.ts clearsAtEndOfRound), so
  // a magnitude or duration here is now stale content rather than a missing
  // one. Six of Light's seventeen carry Daze, which is why this is pinned.
  assert.strictEqual(statuses.Daze.shape, 'boolean');
  for (const move of Object.values(moves)) {
    if (move.statusApplication?.statusId !== 'Daze') continue;
    assert.strictEqual(move.statusApplication.duration, undefined, `${move.id} still authors a Daze duration`);
    assert.strictEqual(move.statusApplication.magnitude, undefined, `${move.id} still authors a Daze magnitude`);
  }
});

test("light: Daze is a bet on turn order — Solace's own riders only pay when it moves first", () => {
  // The redesign's whole point, exercised on the slate that leans on it hardest.
  // Blind is guaranteed, so this isolates SPEED as the variable: Solace (61)
  // against Warden (30) deletes a turn, and the same cast from the slow side
  // buys nothing.
  const state = withDeepPools(lightFixture(107));
  const fast = resolveRound(
    state,
    [
      { kind: 'move', combatantId: 'a1', moveId: 'blind', declaredTarget: 'b1' }, // Solace, 61
      { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a1' }, // Warden, 30
    ],
    config
  );
  assert.ok(fast.events.some((e) => e.type === 'ActionBlocked' && e.combatantId === 'b1' && e.reason === 'dazed'));
  assert.strictEqual(hasStatus(fast.state.combatants.b1, 'Daze'), false, 'and it does not carry into the next round');

  // The same guaranteed cast from the slow side of the same matchup. Warden is
  // given +20 Speed so it outruns Aegis (35): the Daze still LANDS, it is just
  // worth nothing, because the hero it lands on has already swung.
  const outsped = {
    ...state,
    combatants: {
      ...state.combatants,
      b1: { ...state.combatants.b1, statModifiers: { ...state.combatants.b1.statModifiers, speed: 20 } },
    },
  } as CombatState;
  const slow = resolveRound(
    outsped,
    [
      { kind: 'move', combatantId: 'a2', moveId: 'blind', declaredTarget: 'b1' }, // Aegis, 35 — acts second
      { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a2' }, // Warden, 30 + 20 = 50
    ],
    config
  );
  assert.ok(
    slow.events.some((e) => e.type === 'MoveUsed' && e.combatantId === 'b1'),
    'the foe got its swing off before the Daze existed'
  );
  assert.strictEqual(
    slow.events.some((e) => e.type === 'ActionBlocked'),
    false,
    '25 mana and a whole turn bought nothing'
  );

  // And the slate authors no priority anywhere, so there is no way for Light to
  // buy its way past a Speed disadvantage — the redesign's cost is real.
  for (const move of Object.values(moves)) {
    if (move.type !== 'Light' || move.statusApplication?.statusId !== 'Daze') continue;
    assert.strictEqual(move.priority, 0, `${move.id} would let Light buy its way past Speed`);
  }
});

test('light: every Light move resolves in bracket 0 — the slate authors no priority column', () => {
  // Sanctuary is the type's only bracket play, and it is RENTED for 5 rounds
  // rather than owned by any one move.
  for (const move of Object.values(moves)) {
    if (move.type !== 'Light') continue;
    assert.strictEqual(move.priority, 0, `${move.id} has an unexpected priority bracket`);
  }
});

// --- Distribution -----------------------------------------------------------

test('light: every move id a hero or level-up pool points at actually exists', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId}'s kit points at missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId}'s level-up pool points at missing move ${moveId}`);
  }
});

test('light: no Light hero starts with a move it cannot pay for, or has a starter listed in its own pool', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const heroId of ['dawnwarden', 'aegis']) {
    const hero = heroes[heroId];
    for (const moveId of hero.moveIds) {
      assert.ok(
        moves[moveId].manaCost <= hero.baseStats.manaPool,
        `${heroId} cannot afford its own starting move ${moveId} — the one thing a player cannot fix by drafting`
      );
    }
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('light: every authored Light move has a holder', () => {
  // The reachability half of the dangling-id check (authoring-moves.md §10).
  // Light is the first slate to come out of it at zero: two heroes, one
  // magical and one physical, are exactly enough to split seventeen moves.
  // If a later slate legitimately orphans one, name it here rather than
  // deleting the assertion — and see stoneMoves' pinned list for the shape.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  const reachable = new Set<string>();
  for (const hero of Object.values({ ...heroes, ...enemies })) for (const id of hero.moveIds) reachable.add(id);
  for (const pool of Object.values(progressionTable.moveTiers)) for (const id of pool) reachable.add(id);

  const orphans = Object.values(moves)
    .filter((m) => m.type === 'Light' && !reachable.has(m.id))
    .map((m) => m.id)
    .sort();
  assert.deepStrictEqual(orphans, []);
});

test('light: every hero that can be offered Smite can also reach the field effect that turns it on', () => {
  // The equivalent of frostMoves' "the gate has a guaranteed key in the same
  // pool" assertion, and the reason it matters more here: Consecrate is the
  // ONLY Sanctuary setter in the game. Nothing in the engine pairs them — a
  // Smite in a pool with no route to Sanctuary is a permanently half-power
  // move, which is the trap pick the north star forbids (CLAUDE.md).
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const [heroId, hero] of Object.entries(heroes)) {
    const reachable = [...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])];
    const gated = reachable.filter((id) => moves[id]?.conditionalPower?.requiresFieldEffect);
    for (const moveId of gated) {
      const wants = moves[moveId].conditionalPower!.requiresFieldEffect;
      assert.ok(
        reachable.some((id) => moves[id]?.fieldEffectApplication === wants),
        `${heroId} can be offered ${moveId} but has no way to set ${wants}`
      );
    }
  }
});
