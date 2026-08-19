// docs/conditions.md — the 6th engine contract. Covers the paths the browser
// playtest can't cheaply exercise exhaustively: Daze blocking a move,
// Freeze halving Speed, Conduct's apply-vs-detonate split off Storm/Iron
// hits, Poison's active-only timer, Haunt's singleEnemy-to-spread expansion,
// Stealth's speed-dependent redirect, Regen's decay mirroring Burn, and
// Cleanse always sparing positive statuses.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import { getEffectiveStat, hasStatus } from '../src/engine/state';
import { applyStatus, cleanseStatuses } from '../src/engine/combat/statusEngine';

const config = { typeChart, heroes, moves, statuses, benchHpRegenFlat: 5 };

function twoVTwoFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
}

function withStatus(
  state: ReturnType<typeof twoVTwoFixture>,
  combatantId: string,
  statusId: string,
  fields: { magnitude?: number; duration?: number }
) {
  const combatant = state.combatants[combatantId];
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...combatant, statuses: { ...combatant.statuses, [statusId]: { statusId, ...fields } } },
    },
  };
}

// --- Daze: hard action-denial ------------------------------------------------

test('status: Daze blocks a move action — no MoveUsed, mana untouched, ActionBlocked emitted', () => {
  const state = withStatus(twoVTwoFixture(100), 'a1', 'Daze', { duration: 2 });
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.strictEqual(events.some((e) => e.type === 'MoveUsed'), false);
  assert.strictEqual(events.some((e) => e.type === 'ActionBlocked' && e.combatantId === 'a1' && e.reason === 'dazed'), true);
  assert.strictEqual(next.combatants.a1.currentMana, heroes.cinderKnight.baseStats.manaPool);
  assert.strictEqual(next.combatants.b1.currentHp, heroes.ironWarden.baseStats.hp); // no damage landed
});

// --- Freeze: halves Speed, including in turn-order resolution ---------------

test('status: Freeze halves Speed (floored) and does not touch other stats', () => {
  const state = twoVTwoFixture(150);
  const frozen = withStatus(state, 'b1', 'Freeze', {});
  const hero = heroes.ironWarden;

  assert.strictEqual(getEffectiveStat(hero, state.combatants.b1, 'speed'), hero.baseStats.speed);
  assert.strictEqual(getEffectiveStat(hero, frozen.combatants.b1, 'speed'), Math.floor(hero.baseStats.speed / 2));
  assert.strictEqual(getEffectiveStat(hero, frozen.combatants.b1, 'attack'), hero.baseStats.attack);
  assert.ok(hasStatus(frozen.combatants.b1, 'Freeze'));
});

test('status: a frozen combatant with higher base Speed is outsped by a faster-after-halving opponent', () => {
  // tidecaller (55 speed) vs ironWarden (30 speed) frozen -> 30/2 = 15: tidecaller should now act first in the same priority bracket.
  const state = twoVTwoFixture(151);
  const frozen = withStatus(state, 'b1', 'Freeze', {});
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a2', moveId: 'aquaJet', declaredTarget: 'b1' }, // tidecaller, 55 speed
    { kind: 'move', combatantId: 'b1', moveId: 'quickJab', declaredTarget: 'a2' }, // ironWarden, 30 base -> 15 frozen
  ];
  const { events } = resolveRound(frozen, actions, config);
  const moveUsedOrder = events.filter((e) => e.type === 'MoveUsed').map((e: any) => e.combatantId);
  assert.deepStrictEqual(moveUsedOrder, ['a2', 'b1']);
});

// --- Regen: the positive mirror of Burn --------------------------------------

test('status: Regen heals at end of round and decays by halving, like Burn', () => {
  const state = twoVTwoFixture(106);
  const hurt = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 10 } } };
  const regenerating = withStatus(hurt, 'a1', 'Regen', { magnitude: 20 });

  const { state: afterRound1, events } = resolveRound(regenerating, [], config);
  assert.strictEqual(afterRound1.combatants.a1.currentHp, 30); // 10 + 20
  assert.strictEqual(afterRound1.combatants.a1.statuses.Regen.magnitude, 10); // floor(20/2)
  assert.ok(events.some((e) => e.type === 'StatusTicked' && e.statusId === 'Regen' && e.kind === 'heal' && e.amount === 20));

  const { state: afterRound2 } = resolveRound(afterRound1, [], config);
  assert.strictEqual(afterRound2.combatants.a1.currentHp, 40); // 30 + 10
  assert.strictEqual(afterRound2.combatants.a1.statuses.Regen.magnitude, 5); // floor(10/2)
});

test('status: Burn/Regen decay to 0 removes the status entirely', () => {
  const state = twoVTwoFixture(107);
  const burning = withStatus(state, 'b1', 'Burn', { magnitude: 1 }); // floor(1/2) = 0
  const { state: next, events } = resolveRound(burning, [], config);

  assert.strictEqual(hasStatus(next.combatants.b1, 'Burn'), false);
  assert.ok(events.some((e) => e.type === 'StatusRemoved' && e.statusId === 'Burn' && e.reason === 'decay'));
});

// --- Cleanse: always spares positive statuses --------------------------------

test('status: cleanseStatuses strips every non-positive status, leaving Regen (positive) alone', () => {
  const state = twoVTwoFixture(108);
  let afflicted = withStatus(state, 'a1', 'Bleed', {});
  afflicted = withStatus(afflicted, 'a1', 'Poison', { magnitude: 20, duration: 3 });
  afflicted = withStatus(afflicted, 'a1', 'Regen', { magnitude: 15 });

  const { state: cleansed } = cleanseStatuses(afflicted, 1, 'a1', statuses);
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Bleed'), false);
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Poison'), false);
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Regen'), true);
});

// --- Conduct: apply-vs-detonate split off Storm/Iron hits --------------------

test('status: Conduct applies on a clean Storm/Iron hit — no bonus damage yet', () => {
  const state = twoVTwoFixture(200);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'quickJab', declaredTarget: 'b1' }]; // quickJab is Iron-typed
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(hasStatus(next.combatants.b1, 'Conduct'));
  assert.ok(events.some((e) => e.type === 'StatusApplied' && e.statusId === 'Conduct' && e.combatantId === 'b1'));
});

test('status: Conduct detonates on the next Storm/Iron hit — bonus damage, then consumed', () => {
  const state = twoVTwoFixture(201);
  const marked = withStatus(state, 'b1', 'Conduct', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'quickJab', declaredTarget: 'b1' }];

  const plainResult = resolveRound(state, actions, config);
  const markedResult = resolveRound(marked, actions, config);

  const maxHp = heroes.ironWarden.baseStats.hp;
  const plainDamage = maxHp - plainResult.state.combatants.b1.currentHp;
  const markedDamage = maxHp - markedResult.state.combatants.b1.currentHp;
  const expectedBonus = Math.ceil(maxHp * 0.1);

  assert.strictEqual(markedDamage - plainDamage, expectedBonus);
  assert.strictEqual(hasStatus(markedResult.state.combatants.b1, 'Conduct'), false);
  assert.ok(markedResult.events.some((e) => e.type === 'StatusRemoved' && e.statusId === 'Conduct' && e.reason === 'consumed'));
});

// --- Poison: active-only timer, then delayed detonation ---------------------

test('status: Poison counts down while active without dealing damage until the timer hits zero', () => {
  const state = twoVTwoFixture(210);
  const poisoned = withStatus(state, 'b1', 'Poison', { magnitude: 20, duration: 2 });
  const maxHp = heroes.ironWarden.baseStats.hp;

  const { state: afterRound1 } = resolveRound(poisoned, [], config);
  assert.strictEqual(afterRound1.combatants.b1.statuses.Poison.duration, 1);
  assert.strictEqual(afterRound1.combatants.b1.currentHp, maxHp);

  const { state: afterRound2, events } = resolveRound(afterRound1, [], config);
  const expectedDmg = Math.ceil((maxHp * 20) / 100);
  assert.strictEqual(afterRound2.combatants.b1.currentHp, maxHp - expectedDmg);
  assert.strictEqual(hasStatus(afterRound2.combatants.b1, 'Poison'), false);
  assert.ok(events.some((e) => e.type === 'StatusRemoved' && e.statusId === 'Poison' && e.reason === 'expired'));
});

test('status: Poison does not tick while benched — switching stalls the timer instead of clearing it', () => {
  const state = createFightState(
    211,
    [{ combatantId: 'a1', heroId: 'cinderKnight', side: 'A' }],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
      { combatantId: 'b3', heroId: 'wildOracle', side: 'B' }, // benched
    ]
  );
  const poisoned = withStatus(state, 'b3', 'Poison', { magnitude: 20, duration: 2 });
  const { state: next } = resolveRound(poisoned, [], config);

  assert.strictEqual(next.combatants.b3.statuses.Poison.duration, 2); // unchanged — still benched
});

test('status: reapplying Poison mid-timer adds to magnitude without resetting the duration', () => {
  const state = twoVTwoFixture(212);
  const poisoned = withStatus(state, 'b1', 'Poison', { magnitude: 10, duration: 2 });
  const { state: reapplied } = applyStatus(poisoned, 1, 'b1', statuses.Poison, { magnitude: 15, duration: 3 });

  assert.strictEqual(reapplied.combatants.b1.statuses.Poison.magnitude, 25);
  assert.strictEqual(reapplied.combatants.b1.statuses.Poison.duration, 2); // held, not reset to 3
});

// --- Haunt: singleEnemy Spirit/Mind attacks become spread --------------------

test('status: Haunt turns a singleEnemy Spirit/Mind attack into a spread hit on the Haunted partner', () => {
  const state = twoVTwoFixture(220);
  const haunted = withStatus(state, 'b2', 'Haunt', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'soulRend', declaredTarget: 'b1' }]; // Spirit-typed

  const { state: next, events } = resolveRound(haunted, actions, config);

  assert.ok(events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b1' && !e.viaStatusId));
  assert.ok(events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b2' && e.viaStatusId === 'Haunt'));
  assert.ok(next.combatants.b2.currentHp < heroes.wildOracle.baseStats.hp);
});

test('status: a non-Spirit/Mind attack does not trigger Haunt spread', () => {
  const state = twoVTwoFixture(221);
  const haunted = withStatus(state, 'b2', 'Haunt', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b1' }]; // Fire-typed

  const { state: next } = resolveRound(haunted, actions, config);
  assert.strictEqual(next.combatants.b2.currentHp, heroes.wildOracle.baseStats.hp); // untouched
});

// --- Stealth: speed-dependent redirect ---------------------------------------

test('status: a faster Stealth redirects an already-declared attack onto the other active hero', () => {
  const state = twoVTwoFixture(230);
  // wildOracle (b2, 65 speed) out-paces cinderKnight (a1, 50 speed) at equal priority,
  // so b2's Vanish (grants Stealth) resolves before a1's attack comes up.
  const actions: Action[] = [
    { kind: 'move', combatantId: 'b2', moveId: 'vanish' },
    { kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b2' },
  ];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b1')); // redirected onto the partner
  assert.strictEqual(events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b2'), false);
  assert.strictEqual(next.combatants.b2.currentHp, heroes.wildOracle.baseStats.hp); // untouched
});

test('status: a slower Stealth does not save its caster from an attack that resolves first', () => {
  const state = twoVTwoFixture(231);
  // tidecaller (a2, 55 speed) out-paces ironWarden (b1, 30 speed) at equal priority,
  // so a2's attack resolves before b1's Vanish ever lands.
  const actions: Action[] = [
    { kind: 'move', combatantId: 'b1', moveId: 'vanish' },
    { kind: 'move', combatantId: 'a2', moveId: 'tidalBolt', declaredTarget: 'b1' },
  ];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b1'));
  assert.ok(next.combatants.b1.currentHp < heroes.ironWarden.baseStats.hp);
});

test('status: Stealth ticks at the start of a round, so it still protects the round after it lands', () => {
  const state = twoVTwoFixture(230);

  // Round 1: b2 goes Stealth and nothing targets b2, so the redirect never
  // triggers this round — only the start-of-round tick timing is under test.
  const round1 = resolveRound(state, [{ kind: 'move', combatantId: 'b2', moveId: 'vanish' }], config);
  assert.ok(hasStatus(round1.state.combatants.b2, 'Stealth'));

  // Round 2: Stealth is still up (start-of-round tick decremented 1 -> 0 but kept
  // it present), so a single-target attack on b2 still redirects onto b1.
  const round2 = resolveRound(
    round1.state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b2' }],
    config
  );
  assert.ok(round2.events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b1'));
  assert.strictEqual(round2.events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b2'), false);
  assert.ok(hasStatus(round2.state.combatants.b2, 'Stealth')); // still present (duration 0) — expires at the start of round 3

  // Round 3: the start-of-round tick removes Stealth before actions run, so the same attack lands on b2 directly.
  const round3 = resolveRound(
    round2.state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'emberSlash', declaredTarget: 'b2' }],
    config
  );
  assert.ok(round3.events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b2'));
});

test('status: both active heroes can never be Stealthed at once — the slower Vanish fizzles', () => {
  const state = twoVTwoFixture(230);
  // tidecaller (a2, 55 speed) out-paces cinderKnight (a1, 50 speed) at equal priority,
  // so a2's Vanish resolves first and locks out a1's Vanish this same round.
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'vanish' },
    { kind: 'move', combatantId: 'a2', moveId: 'vanish' },
  ];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(hasStatus(next.combatants.a2, 'Stealth'));
  assert.strictEqual(hasStatus(next.combatants.a1, 'Stealth'), false);
  assert.ok(events.some((e) => e.type === 'StatusApplied' && e.combatantId === 'a2' && e.statusId === 'Stealth'));
  assert.strictEqual(events.some((e) => e.type === 'StatusApplied' && e.combatantId === 'a1' && e.statusId === 'Stealth'), false);
  // a1's mana was still spent — the move itself went off, only the status application fizzled.
  assert.ok(events.some((e) => e.type === 'MoveUsed' && e.combatantId === 'a1' && e.manaSpent === moves.vanish.manaCost));
});
