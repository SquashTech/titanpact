// Water's authored movepool (src/data/moves.ts, 2026-08-30) and the three
// engine fields it is the first content to need: `drainPercent` (Siphon,
// Engulf), `cleanseCount` (Wash Away), and `manaDiscountOnUse` (Wave Shred).
//
// Same discipline as test/fireMoves.test.ts: these assert the MECHANIC with
// Water's moves as the vehicle, not Water's numbers, which are balance and
// will move. The numbers that ARE asserted are the ones the design table
// locks — which moves are spread, which drain, and the two structural facts
// that are easy to get wrong and hard to notice afterwards:
//
//   1. drain scales the HP actually REMOVED, not the rolled damage, and does
//      not run the healing formula (CLAUDE.md's healing lock covers heal-kind
//      moves; a drain rider is a share of a hit, see content.ts drainPercent);
//   2. a limited cleanse draws RNG only when it genuinely has to choose, so
//      every fight authored before cleanseCount existed replays identically
//      (the same guarantee StatusApplication.chance carries).

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
import { applyStatus, cleanseStatuses } from '../src/engine/combat/statusEngine';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState } from '../src/engine/state';
import { effectiveManaCost, hasAffordableMove } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** tidecaller (Int 59, mono Water) and pincer (Atk 70, mono Water) attack; ironWarden/wildOracle defend — the same shape the other combat tests use. */
function waterFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'tidecaller', side: 'A' },
      { combatantId: 'a2', heroId: 'pincer', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

/**
 * The two fixture problems every one of these shares, solved once — same
 * reasoning as fireMoves.test.ts's withDeepPools:
 *
 * - **Mana.** Water's authored curve tops out at Wave Shred's 80 and Tsunami's
 *   70, both above every Water hero's real pool. That is a live design finding
 *   (docs/combat.md), not something these tests should be gated on.
 * - **Lethality.** A defender that faints to the hit never reaches the riders,
 *   which silently turns a drain test into a KO test. getMaxHp reads
 *   baseStats + statModifiers, so the hp modifier has to move with currentHp.
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

/** Drops a combatant to `hp` so a drain has somewhere to go — healing into a full bar is clamped and proves nothing. */
function wounded(state: CombatState, combatantId: string, hp: number): CombatState {
  const c = state.combatants[combatantId];
  return { ...state, combatants: { ...state.combatants, [combatantId]: { ...c, currentHp: hp } } };
}

function afflict(state: CombatState, combatantId: string, statusId: string, magnitude?: number): CombatState {
  return applyStatus(state, 1, combatantId, statuses[statusId], magnitude !== undefined ? { magnitude } : {}).state;
}

// --- The pool itself -------------------------------------------------------

test('water: the authored pool is exactly the fifteen designed moves, all Water-typed', () => {
  const water = Object.values(moves).filter((m) => m.type === 'Water');
  assert.deepStrictEqual(
    water.map((m) => m.id).sort(),
    [
      'aquaSlice', 'deluge', 'engulf', 'highTide', 'maelstrom', 'oasis', 'refresh', 'siphon',
      'splash', 'tideGuard', 'torrent', 'tsunami', 'undertow', 'washAway', 'waveShred',
    ]
  );
});

test('water: every "Spread" move in the design table targets both enemies, and no other Water move does', () => {
  const spread = Object.values(moves)
    .filter((m) => m.type === 'Water' && m.target === 'bothEnemies')
    .map((m) => m.id)
    .sort();
  assert.deepStrictEqual(spread, ['deluge', 'maelstrom']);
});

test('water: no Water move applies a status the catalog does not define', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Water' || !move.statusApplication) continue;
    assert.ok(statuses[move.statusApplication.statusId], `${move.id} applies unknown status ${move.statusApplication.statusId}`);
  }
});

test('water: the authored pool resolves entirely in priority bracket 0 — Water has no priority move', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Water') continue;
    assert.strictEqual(move.priority, 0, `${move.id} should be priority 0`);
  }
});

// --- MoveDefinition.drainPercent (Siphon, Engulf) --------------------------

test('water: Siphon heals its caster for half the damage it dealt, and a plain attack heals nobody', () => {
  const state = wounded(withDeepPools(waterFixture(700)), 'a1', 20);
  const siphon: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'siphon', declaredTarget: 'b1' }];
  const splash: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'splash', declaredTarget: 'b1' }];

  const drained = resolveRound(state, siphon, config);
  const plain = resolveRound(state, splash, config);

  const hit = drained.events.find((e) => e.type === 'DamageDealt');
  const healed = drained.events.find((e) => e.type === 'Healed');
  assert.ok(hit && hit.type === 'DamageDealt');
  assert.ok(healed && healed.type === 'Healed');
  assert.strictEqual(healed.amount, Math.round(hit.amount * 0.5));
  assert.strictEqual(healed.targetCombatantId, 'a1', 'the drain goes to the USER');
  assert.strictEqual(healed.drain?.fromCombatantId, 'b1');
  assert.ok(drained.state.combatants.a1.currentHp > 20);

  assert.strictEqual(plain.events.some((e) => e.type === 'Healed'), false, 'a move with no drainPercent must not heal');
});

test('water: a drain does NOT run the healing formula — no HealPower, Wisdom or STAB term on the event', () => {
  // The distinction content.ts drainPercent turns on. What it returns has
  // already been through variance, crit, STAB and TypeMult as DAMAGE; running
  // the heal formula over it too would scale one action twice. Asserted
  // structurally, because with a Wisdom-40 caster the two happen to differ by
  // little enough that a numeric check would pass either way.
  const state = wounded(withDeepPools(waterFixture(701)), 'a1', 20);
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'engulf', declaredTarget: 'b1' }], config);

  const healed = events.find((e) => e.type === 'Healed');
  assert.ok(healed && healed.type === 'Healed');
  assert.strictEqual(healed.healPower, undefined);
  assert.strictEqual(healed.wisdomMult, undefined);
  assert.strictEqual(healed.stab, undefined);
  assert.strictEqual(healed.drain?.percent, 0.5);

  // ...and a real heal-kind move still carries all three.
  const oasis = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'oasis' }], config);
  const realHeal = oasis.events.find((e) => e.type === 'Healed');
  assert.ok(realHeal && realHeal.type === 'Healed');
  assert.strictEqual(realHeal.healPower, moves.oasis.healPower);
  assert.ok(realHeal.wisdomMult !== undefined && realHeal.stab === 1.25, 'a Water heal off a Water caster takes STAB');
  assert.strictEqual(realHeal.drain, undefined);
});

test('water: a drain returns a share of the HP actually removed, so overkill is not a windfall', () => {
  // b1 on 3 HP: Siphon rolls for far more than that, but only 3 leaves the
  // target, so only 2 (round(3 x 0.5)) comes back. Reading the rolled amount
  // instead would hand the caster a full drain off a 3 HP kill.
  const base = wounded(withDeepPools(waterFixture(702)), 'a1', 20);
  const state = wounded(base, 'b1', 3);
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'siphon', declaredTarget: 'b1' }], config);

  const hit = events.find((e) => e.type === 'DamageDealt');
  const healed = events.find((e) => e.type === 'Healed');
  assert.ok(hit && hit.type === 'DamageDealt');
  assert.ok(healed && healed.type === 'Healed');
  assert.ok(hit.amount > 3, 'the fixture only means anything if the hit overkills');
  assert.strictEqual(healed.drain?.damageDealt, 3);
  assert.strictEqual(healed.amount, 2);
});

test('water: a drain into a target that is already down heals nothing at all', () => {
  const state = wounded(withDeepPools(waterFixture(703)), 'a1', 20);
  // Both enemies drop to the first hit; the second attacker's Siphon redirects
  // onto the survivor, so this instead checks the simple case: no target left
  // standing means no DamageDealt and therefore no drain.
  const dead = {
    ...state,
    combatants: Object.fromEntries(
      Object.entries(state.combatants).map(([id, c]) => [id, c.side === 'B' ? { ...c, fainted: true, currentHp: 0 } : c])
    ),
  } as CombatState;
  const { events } = resolveRound(dead, [{ kind: 'move', combatantId: 'a1', moveId: 'siphon', declaredTarget: 'b1' }], config);
  assert.strictEqual(events.some((e) => e.type === 'Healed'), false);
});

// --- MoveDefinition.cleanseCount (Wash Away) -------------------------------

test('water: Wash Away strips exactly one negative status and leaves the rest — and never the positive one', () => {
  let state = withDeepPools(waterFixture(710));
  state = afflict(state, 'a1', 'Burn', 20);
  state = afflict(state, 'a1', 'Bleed');
  state = afflict(state, 'a1', 'Freeze');
  state = afflict(state, 'a1', 'Renew', 20);

  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a2', moveId: 'washAway', declaredTarget: 'a1' }],
    config
  );

  const negatives = ['Burn', 'Bleed', 'Freeze'].filter((id) => next.combatants.a1.statuses[id] !== undefined);
  assert.strictEqual(negatives.length, 2, 'exactly one of the three negatives is gone');
  assert.ok(next.combatants.a1.statuses.Renew, 'Cleanse never strips a positive status, limited or not');
});

test('water: which status Wash Away takes varies with the seed — it is a roll, not an order', () => {
  const survivors = new Set<string>();
  for (let seed = 0; seed < 40; seed++) {
    let state = withDeepPools(waterFixture(seed));
    state = afflict(state, 'a1', 'Burn', 20);
    state = afflict(state, 'a1', 'Bleed');
    state = afflict(state, 'a1', 'Freeze');
    const { state: next } = resolveRound(
      state,
      [{ kind: 'move', combatantId: 'a2', moveId: 'washAway', declaredTarget: 'a1' }],
      config
    );
    for (const id of ['Burn', 'Bleed', 'Freeze']) {
      if (next.combatants.a1.statuses[id] === undefined) survivors.add(id);
    }
  }
  // Wide deliberately: this asserts the choice is random across seeds, not that
  // mulberry32 is uniform over three buckets.
  assert.ok(survivors.size > 1, `expected the cleansed status to vary across seeds, only ever saw ${[...survivors]}`);
});

test('water: a limited cleanse draws RNG only when it actually has to choose', () => {
  // The replay guarantee. With one eligible status there is nothing to pick
  // between, so the stream must be untouched — exactly as it is with none.
  const base = withDeepPools(waterFixture(711));
  const cast: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'washAway', declaredTarget: 'a1' }];

  const clean = resolveRound(base, cast, config).state.rngState;
  const one = resolveRound(afflict(base, 'a1', 'Burn', 20), cast, config).state.rngState;
  const three = resolveRound(afflict(afflict(afflict(base, 'a1', 'Burn', 20), 'a1', 'Bleed'), 'a1', 'Freeze'), cast, config).state
    .rngState;

  assert.strictEqual(one, clean, 'nothing to choose between: no draw');
  assert.notStrictEqual(three, clean, 'a real choice draws');
});

test('water: an unlimited cleanse still strips everything, and draws nothing either way', () => {
  // Purify (cleanses, no cleanseCount) is the control: the new field must
  // leave every Cleanse move authored before it byte-identical.
  let state = withDeepPools(waterFixture(712));
  state = afflict(state, 'a1', 'Burn', 20);
  state = afflict(state, 'a1', 'Bleed');
  state = afflict(state, 'a1', 'Freeze');

  const stripped = cleanseStatuses(state, 1, 'a1', statuses);
  assert.deepStrictEqual(Object.keys(stripped.state.combatants.a1.statuses), []);
  assert.strictEqual(stripped.state.rngState, state.rngState, 'an unlimited cleanse never draws');

  const limited = cleanseStatuses(state, 1, 'a1', statuses, 1);
  assert.strictEqual(Object.keys(limited.state.combatants.a1.statuses).length, 2);
});

// --- MoveDefinition.manaDiscountOnUse (Wave Shred) -------------------------

test('water: Wave Shred is charged its authored cost the first time and 20 less every time after', () => {
  const state = withDeepPools(waterFixture(720));
  const cast: Action[] = [{ kind: 'move', combatantId: 'a2', moveId: 'waveShred', declaredTarget: 'b1' }];

  const spentOn = (r: ReturnType<typeof resolveRound>) => (r.events.find((e) => e.type === 'MoveUsed') as any).manaSpent;

  const first = resolveRound(state, cast, config);
  const second = resolveRound(first.state, cast, config);
  const third = resolveRound(second.state, cast, config);

  assert.strictEqual(spentOn(first), moves.waveShred.manaCost, 'the cast that starts the ramp pays full price');
  assert.strictEqual(spentOn(second), moves.waveShred.manaCost - 20);
  assert.strictEqual(spentOn(third), moves.waveShred.manaCost - 40);

  // Stated on the event so the Battle Log can say so rather than silently
  // printing a smaller number.
  assert.strictEqual((first.events.find((e) => e.type === 'MoveUsed') as any).manaDiscount, undefined);
  assert.strictEqual((second.events.find((e) => e.type === 'MoveUsed') as any).manaDiscount, 20);
});

test('water: the discount is per hero, and the authored content is never mutated', () => {
  const state = withDeepPools(waterFixture(721));
  const authored = moves.waveShred.manaCost;
  const after = resolveRound(state, [{ kind: 'move', combatantId: 'a2', moveId: 'waveShred', declaredTarget: 'b1' }], config).state;

  assert.strictEqual(after.combatants.a2.moveManaDiscounts.waveShred, 20);
  assert.deepStrictEqual(after.combatants.a1.moveManaDiscounts, {}, 'the partner has not cast it and gets nothing');
  assert.strictEqual(moves.waveShred.manaCost, authored, 'content data stays immutable — the ramp lives on the combatant');
});

test('water: effectiveManaCost floors at 0 and leaves every move without a discount alone', () => {
  assert.strictEqual(effectiveManaCost(moves.waveShred), moves.waveShred.manaCost);
  assert.strictEqual(effectiveManaCost(moves.waveShred, { waveShred: 20 }), moves.waveShred.manaCost - 20);
  assert.strictEqual(effectiveManaCost(moves.waveShred, { waveShred: 999 }), 0, 'never negative');
  assert.strictEqual(effectiveManaCost(moves.splash, { waveShred: 999 }), moves.splash.manaCost, 'discounts are per move id');
});

test('water: the affordability query prices a ramped move at what it now costs, not what it was authored at', () => {
  // The half of this that is easy to miss: the engine charges the discounted
  // price, so a legality check still reading move.manaCost would hide a move
  // the hero can in fact afford (state.ts hasAffordableMove).
  const cost = moves.waveShred.manaCost;
  assert.strictEqual(hasAffordableMove(cost - 20, ['waveShred'], moves), false);
  assert.strictEqual(hasAffordableMove(cost - 20, ['waveShred'], moves, { waveShred: 20 }), true);
});

// --- Distribution ----------------------------------------------------------

test('water: every move id a hero or level-up pool points at actually exists', () => {
  // Nothing else catches a dangling id — the run layer only looks a move up
  // when the hero is offered it, which can be several fights in.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId}'s kit points at missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId}'s level-up pool points at missing move ${moveId}`);
  }
});

test('water: neither Water hero starts with a move it cannot pay for, or has a starter listed in its own pool', () => {
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  for (const heroId of ['tidecaller', 'pincer']) {
    const hero = heroes[heroId];
    const cheapest = Math.min(...hero.moveIds.map((id) => moves[id].manaCost));
    assert.ok(cheapest <= hero.baseStats.manaPool, `${heroId} cannot afford its own cheapest starting move`);
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      // levelUpMovePool filters unlocked moves out, so a starter in the pool is
      // dead weight that can never be offered.
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});
