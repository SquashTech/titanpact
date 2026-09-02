// Water's movepool: drainPercent, cleanseCount, manaDiscountOnUse. Hand-off findings for this slate: docs/authoring-moves.md §10.

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
import { applyStatus, cleanseStatuses } from '../src/engine/combat/statusEngine';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState } from '../src/engine/state';
import { effectiveManaCost, hasAffordableMove } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** tidecaller (Int) and pincer (Atk) attack; ironWarden/wildOracle defend. */
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

/** Unlimited mana for everyone and 1200 HP for side B, so riders resolve instead of KOs (hp modifier moves with currentHp because getMaxHp reads both). */
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

/** Drops a combatant to `hp` so a drain has somewhere to go. */
function wounded(state: CombatState, combatantId: string, hp: number): CombatState {
  const c = state.combatants[combatantId];
  return { ...state, combatants: { ...state.combatants, [combatantId]: { ...c, currentHp: hp } } };
}

function afflict(state: CombatState, combatantId: string, statusId: string, magnitude?: number): CombatState {
  return applyStatus(state, 1, combatantId, statuses[statusId], magnitude !== undefined ? { magnitude } : {}).state;
}

// --- The pool itself ---

test('water: the authored pool is the fifteen designed moves plus Riptide\'s two Evolution moves, all Water-typed', () => {
  const water = Object.values(moves).filter((m) => m.type === 'Water');
  assert.deepStrictEqual(
    water.map((m) => m.id).sort(),
    [
      'aquaSlice', 'deluge', 'engulf', 'highTide', 'lizardRush', 'maelstrom', 'oasis', 'refresh',
      'shockBubble', 'siphon', 'splash', 'tideGuard', 'torrent', 'tsunami', 'undertow', 'washAway',
      'waveShred',
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
    if (move.type !== 'Water') continue;
    for (const app of statusApplicationsOf(move)) {
      assert.ok(statuses[app.statusId], `${move.id} applies unknown status ${app.statusId}`);
    }
  }
});

test('water: the authored pool resolves entirely in priority bracket 0 — Water has no priority move', () => {
  for (const move of Object.values(moves)) {
    if (move.type !== 'Water') continue;
    assert.strictEqual(move.priority, 0, `${move.id} should be priority 0`);
  }
});

// --- MoveDefinition.drainPercent (Siphon, Engulf) ---

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
  // Asserted structurally: with a Wisdom-40 caster the two formulas differ too little for a numeric check to tell them apart.
  const state = wounded(withDeepPools(waterFixture(701)), 'a1', 20);
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'engulf', declaredTarget: 'b1' }], config);

  const healed = events.find((e) => e.type === 'Healed');
  assert.ok(healed && healed.type === 'Healed');
  assert.strictEqual(healed.healPower, undefined);
  assert.strictEqual(healed.wisdomMult, undefined);
  assert.strictEqual(healed.stab, undefined);
  assert.strictEqual(healed.drain?.percent, 0.5);

  const oasis = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'oasis' }], config);
  const realHeal = oasis.events.find((e) => e.type === 'Healed');
  assert.ok(realHeal && realHeal.type === 'Healed');
  assert.strictEqual(realHeal.healPower, moves.oasis.healPower);
  assert.ok(realHeal.wisdomMult !== undefined && realHeal.stab === 1.25, 'a Water heal off a Water caster takes STAB');
  assert.strictEqual(realHeal.drain, undefined);
});

test('water: a drain returns a share of the HP actually removed, so overkill is not a windfall', () => {
  // b1 on 3 HP: only 3 leaves the target, so round(3 x 0.5) = 2 comes back.
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
  const dead = {
    ...state,
    combatants: Object.fromEntries(
      Object.entries(state.combatants).map(([id, c]) => [id, c.side === 'B' ? { ...c, fainted: true, currentHp: 0 } : c])
    ),
  } as CombatState;
  const { events } = resolveRound(dead, [{ kind: 'move', combatantId: 'a1', moveId: 'siphon', declaredTarget: 'b1' }], config);
  assert.strictEqual(events.some((e) => e.type === 'Healed'), false);
});

// --- MoveDefinition.cleanseCount (Wash Away) ---

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
  // Wide deliberately: asserts the choice varies across seeds, not that the RNG is uniform over three buckets.
  assert.ok(survivors.size > 1, `expected the cleansed status to vary across seeds, only ever saw ${[...survivors]}`);
});

test('water: a limited cleanse draws RNG only when it actually has to choose', () => {
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
  // Called directly: no authored move is an unlimited cleanse any more, so this is the only coverage of that path.
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

// --- MoveDefinition.manaDiscountOnUse (Wave Shred) ---

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
  const cost = moves.waveShred.manaCost;
  assert.strictEqual(hasAffordableMove(cost - 20, ['waveShred'], moves), false);
  assert.strictEqual(hasAffordableMove(cost - 20, ['waveShred'], moves, { waveShred: 20 }), true);
});

// --- Distribution ---

test('water: every move id a hero or level-up pool points at actually exists', () => {
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
      // levelUpMovePool filters unlocked moves out, so a starter in the pool can never be offered.
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

// --- StatusApplication target 'bothAllies' (Lizard Rush) ---

test('water: Lizard Rush damages one enemy and mends BOTH allies — the rider resolves against the caster, not the move target', () => {
  const state = withDeepPools(waterFixture(730));
  const before = state.combatants.b1.currentHp;
  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'lizardRush', declaredTarget: 'b1' }],
    config
  );

  assert.ok(next.combatants.b1.currentHp < before, 'the damage body still lands on the declared enemy');
  assert.ok(next.combatants.a1.statuses.Renew, 'the caster is an ally of itself');
  assert.ok(next.combatants.a2.statuses.Renew, 'and so is its partner');
  assert.strictEqual(next.combatants.b1.statuses.Renew, undefined, 'the enemy it hit gets nothing');
});

test('water: an unchanced bothAllies rider draws no RNG — same rngState as the same hit without one', () => {
  const state = withDeepPools(waterFixture(731));
  const rush = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'lizardRush', declaredTarget: 'b1' }], config);
  const plain = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'waveShred', declaredTarget: 'b1' }], config);
  assert.deepStrictEqual(rush.state.rngState, plain.state.rngState);
});

test('water: Shock Bubble plants Conduct for a Storm partner to cash — Water itself never detonates it', () => {
  const state = withDeepPools(waterFixture(732));
  const { state: next } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'shockBubble', declaredTarget: 'b1' }],
    config
  );
  assert.ok(next.combatants.b1.statuses.Conduct, 'the mark is left standing');
  assert.ok(!statuses.Conduct.triggerTypes?.includes('Water'));
});
