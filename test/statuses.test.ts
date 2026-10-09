// Status conditions (docs/conditions.md).

import { statusApplicationsOf, STAT_ORDER } from '../src/engine/content';
import type { StatKey } from '../src/engine/content';
import * as assert from 'assert';
import { test } from './harness';
import { createFightState, fixtureMaxHp } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import { applyForcedReplacement } from '../src/engine/combat/switching';
import type { Action } from '../src/engine/combat/actions';
import { getEffectiveStat, hasStatus } from '../src/engine/state';
import { applyStatus, cleanseStatuses, selectableTargets } from '../src/engine/combat/statusEngine';
import { resolveStatusMagnitudeFor, scaleStatusMagnitude } from '../src/engine/status/statusMagnitude';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

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

/** Enough mana for any single cast, so a fixture never Rests instead of casting. */
function deepMana<T extends { combatants: Record<string, any> }>(state: T): T {
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [id, { ...c, currentMana: 999, statModifiers: { ...c.statModifiers, manaPool: 999 } }])
  );
  return { ...state, combatants };
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

// --- Daze: flinch ---

test('status: Daze blocks a move action — no MoveUsed, mana untouched, ActionBlocked emitted', () => {
  const state = withStatus(twoVTwoFixture(100), 'a1', 'Daze', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.strictEqual(events.some((e) => e.type === 'MoveUsed'), false);
  assert.strictEqual(events.some((e) => e.type === 'ActionBlocked' && e.combatantId === 'a1' && e.reason === 'dazed'), true);
  assert.strictEqual(next.combatants.a1.currentMana, heroes.cinderKnight.baseStats.manaPool);
  assert.strictEqual(next.combatants.b1.currentHp, fixtureMaxHp('ironWarden'));
});

test('status: Daze is gone by the end of the round it was applied in — nobody ever starts a round Dazed', () => {
  const state = withStatus(twoVTwoFixture(101), 'a1', 'Daze', {});
  const { state: next, events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }],
    config
  );

  assert.strictEqual(hasStatus(next.combatants.a1, 'Daze'), false);
  assert.strictEqual(
    events.some((e) => e.type === 'StatusRemoved' && e.combatantId === 'a1' && e.statusId === 'Daze' && e.reason === 'expired'),
    true,
    'the clear is an event, so the view can drop the badge'
  );
  assert.strictEqual(statuses.Daze.shape, 'boolean');
  assert.strictEqual(statuses.Daze.clearsAtEndOfRound, true);
});

test('status: a Daze only denies a turn when its applier moved first — flinch, not a purchased turn', () => {
  // Blind is the guaranteed Daze applier. cinderKnight (speed 50) vs ironWarden (30).
  const fast = resolveRound(
    twoVTwoFixture(102),
    [
      { kind: 'move', combatantId: 'a1', moveId: 'blind', declaredTarget: 'b1' },
      { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a1' },
    ],
    config
  );
  assert.strictEqual(
    fast.events.some((e) => e.type === 'ActionBlocked' && e.combatantId === 'b1' && e.reason === 'dazed'),
    true,
    'the slower hero never gets to swing'
  );

  const slow = resolveRound(
    twoVTwoFixture(102),
    [
      { kind: 'move', combatantId: 'b1', moveId: 'blind', declaredTarget: 'a1' },
      { kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' },
    ],
    config
  );
  assert.strictEqual(
    slow.events.some((e) => e.type === 'ActionBlocked'),
    false,
    'a Daze landed on a hero that already acted is worth nothing at all'
  );
  assert.strictEqual(hasStatus(slow.state.combatants.a1, 'Daze'), false, 'and is gone before it could ever matter');
});

// --- Freeze: halves Speed, including in turn-order resolution ---

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
  // Both moves are priority 0, so Speed is the only tiebreak.
  const state = twoVTwoFixture(151);
  const frozen = withStatus(state, 'b1', 'Freeze', {});
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a2', moveId: 'splash', declaredTarget: 'b1' },
    { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a2' },
  ];
  const { events } = resolveRound(frozen, actions, config);
  const moveUsedOrder = events.filter((e) => e.type === 'MoveUsed').map((e: any) => e.combatantId);
  assert.deepStrictEqual(moveUsedOrder, ['a2', 'b1']);
});

// --- Renew: the positive mirror of Burn ---

test('status: Renew heals a tenth of max HP at each of three round ends, nothing as it lands, then goes out', () => {
  const state = twoVTwoFixture(106);
  const maxHp = fixtureMaxHp('cinderKnight');
  const hurt = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 10 } } };
  const per = Math.ceil(maxHp * 0.1);

  const landed = applyStatus(hurt, 1, 'a1', statuses.Renew, { holderMaxHp: maxHp });
  assert.strictEqual(landed.state.combatants.a1.currentHp, 10, 'no heal on landing');
  assert.strictEqual(landed.state.combatants.a1.statuses.Renew.duration, 3);
  assert.strictEqual(landed.state.combatants.a1.statuses.Renew.magnitude, undefined, 'a timed status carries no number');
  assert.ok(landed.events.some((e) => e.type === 'StatusApplied' && e.statusId === 'Renew' && e.duration === 3 && e.magnitude === undefined));
  assert.strictEqual(landed.events.some((e) => e.type === 'StatusTicked'), false);

  const r1 = resolveRound(landed.state, [], config);
  assert.strictEqual(r1.state.combatants.a1.currentHp, 10 + per);
  assert.strictEqual(r1.state.combatants.a1.statuses.Renew.duration, 2);
  assert.ok(r1.events.some((e) => e.type === 'StatusTicked' && e.statusId === 'Renew' && e.kind === 'heal' && e.amount === per && e.newDuration === 2));

  const r2 = resolveRound(r1.state, [], config);
  assert.strictEqual(r2.state.combatants.a1.currentHp, 10 + 2 * per);
  assert.strictEqual(r2.state.combatants.a1.statuses.Renew.duration, 1);

  const r3 = resolveRound(r2.state, [], config);
  assert.strictEqual(r3.state.combatants.a1.currentHp, 10 + 3 * per);
  assert.strictEqual(hasStatus(r3.state.combatants.a1, 'Renew'), false, 'three heals in all, then expired');
  assert.ok(r3.events.some((e) => e.type === 'StatusRemoved' && e.statusId === 'Renew' && e.reason === 'expired'));
});

test('status: a second Renew resets the three rounds rather than adding to them, and heals nothing as it lands', () => {
  const state = twoVTwoFixture(108);
  const maxHp = fixtureMaxHp('cinderKnight');
  const hurt = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 10 } } };
  const first = applyStatus(hurt, 1, 'a1', statuses.Renew, { holderMaxHp: maxHp });
  const ticked = resolveRound(resolveRound(first.state, [], config).state, [], config).state; // 3 -> 1
  assert.strictEqual(ticked.combatants.a1.statuses.Renew.duration, 1);
  const before = ticked.combatants.a1.currentHp;
  const second = applyStatus(ticked, 3, 'a1', statuses.Renew, { holderMaxHp: maxHp });
  assert.strictEqual(second.state.combatants.a1.statuses.Renew.duration, 3, 'back to three, not 1 + 3');
  assert.strictEqual(second.state.combatants.a1.currentHp, before);
});

test('status: an authored magnitude on a Renew is ignored — every Renew is the same three tenths', () => {
  const state = twoVTwoFixture(109);
  const maxHp = fixtureMaxHp('cinderKnight');
  const hurt = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 10 } } };
  const landed = applyStatus(hurt, 1, 'a1', statuses.Renew, { magnitude: 7, duration: 9, holderMaxHp: maxHp });
  assert.deepStrictEqual(landed.state.combatants.a1.statuses.Renew, { statusId: 'Renew', duration: 3 });
  assert.strictEqual(landed.state.combatants.a1.currentHp, 10);
});

// --- Cleanse: always spares positive statuses ---

test('status: cleanseStatuses strips every non-positive status, leaving Renew (positive) alone', () => {
  const state = twoVTwoFixture(108);
  let afflicted = withStatus(state, 'a1', 'Bleed', {});
  afflicted = withStatus(afflicted, 'a1', 'Poison', { magnitude: 20, duration: 3 });
  afflicted = withStatus(afflicted, 'a1', 'Renew', { duration: 3 });

  const { state: cleansed } = cleanseStatuses(afflicted, 1, 'a1', statuses);
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Bleed'), false);
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Poison'), false);
  assert.strictEqual(hasStatus(cleansed.combatants.a1, 'Renew'), true);
});

// --- Conduct: apply-vs-detonate split off Storm/Iron/Mech hits ---

test('status: Conduct is only applied by its dedicated move, not any Storm/Iron/Mech hit', () => {
  const state = twoVTwoFixture(200);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'ironFist', declaredTarget: 'b1' }]; // Iron-typed, no statusApplication
  const { state: next, events } = resolveRound(state, actions, config);

  assert.strictEqual(hasStatus(next.combatants.b1, 'Conduct'), false);
  assert.strictEqual(events.some((e) => e.type === 'StatusApplied' && e.statusId === 'Conduct'), false);
});

test('status: Conduct applies via a move that names it (stormLash) — no bonus damage yet', () => {
  const state = twoVTwoFixture(200);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'stormLash', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(hasStatus(next.combatants.b1, 'Conduct'));
  assert.ok(events.some((e) => e.type === 'StatusApplied' && e.statusId === 'Conduct' && e.combatantId === 'b1'));
});

test('status: Conduct detonates on the next Storm/Iron/Mech hit — bonus damage, then consumed', () => {
  const state = twoVTwoFixture(201);
  const marked = withStatus(state, 'b1', 'Conduct', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'ironFist', declaredTarget: 'b1' }];

  const plainResult = resolveRound(state, actions, config);
  const markedResult = resolveRound(marked, actions, config);

  const maxHp = fixtureMaxHp('ironWarden');
  const plainDamage = maxHp - plainResult.state.combatants.b1.currentHp;
  const markedDamage = maxHp - markedResult.state.combatants.b1.currentHp;
  const expectedBonus = Math.ceil(maxHp * 0.15);

  assert.strictEqual(markedDamage - plainDamage, expectedBonus);
  assert.strictEqual(hasStatus(markedResult.state.combatants.b1, 'Conduct'), false);
  assert.ok(markedResult.events.some((e) => e.type === 'StatusRemoved' && e.statusId === 'Conduct' && e.reason === 'consumed'));
});

// --- Poison: active-only timer, then delayed detonation ---

test('status: Poison counts down while active without dealing damage until the timer hits zero', () => {
  const state = twoVTwoFixture(210);
  const poisoned = withStatus(state, 'b1', 'Poison', { magnitude: 20, duration: 2 });
  const maxHp = fixtureMaxHp('ironWarden');

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

  assert.strictEqual(next.combatants.b3.statuses.Poison.duration, 2);
});

test('status: reapplying Poison mid-timer adds to magnitude without resetting the duration', () => {
  const state = twoVTwoFixture(212);
  const poisoned = withStatus(state, 'b1', 'Poison', { magnitude: 10, duration: 2 });
  const { state: reapplied } = applyStatus(poisoned, 1, 'b1', statuses.Poison, { magnitude: 15, duration: 3 });

  assert.strictEqual(reapplied.combatants.b1.statuses.Poison.magnitude, 25);
  assert.strictEqual(reapplied.combatants.b1.statuses.Poison.duration, 2); // held, not reset to 3
});

// --- Haunt: singleEnemy Spirit/Mind attacks become spread ---

test('status: Haunt turns a singleEnemy Spirit/Mind attack ON the Haunted hero into a spread hit on its partner', () => {
  const state = twoVTwoFixture(220);
  const haunted = withStatus(state, 'b1', 'Haunt', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'soulRend', declaredTarget: 'b1' }]; // Spirit-typed

  const { state: next, events } = resolveRound(haunted, actions, config);

  assert.ok(events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b1' && !e.viaStatusId));
  assert.ok(events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b2' && e.viaStatusId === 'Haunt'));
  assert.ok(next.combatants.b2.currentHp < fixtureMaxHp('wildOracle'));
});

test('status: a hit on the Haunted hero\'s PARTNER does not spread — the echo follows the hit on the Haunted one', () => {
  const state = twoVTwoFixture(222);
  const haunted = withStatus(state, 'b2', 'Haunt', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'soulRend', declaredTarget: 'b1' }];

  const { state: next, events } = resolveRound(haunted, actions, config);
  assert.ok(!events.some((e) => e.type === 'DamageDealt' && e.viaStatusId === 'Haunt'));
  assert.strictEqual(next.combatants.b2.currentHp, fixtureMaxHp('wildOracle'));
});

test('status: a non-Spirit/Mind attack does not trigger Haunt spread', () => {
  const state = twoVTwoFixture(221);
  const haunted = withStatus(state, 'b1', 'Haunt', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }]; // Fire-typed

  const { state: next } = resolveRound(haunted, actions, config);
  assert.strictEqual(next.combatants.b2.currentHp, fixtureMaxHp('wildOracle'));
});

// --- Haunt passes on a knockout (passesOnFaint) ---

function hauntBenchFixture(seed: number) {
  return deepMana(
    createFightState(
      seed,
      [
        { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
        { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
      ],
      [
        { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
        { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
        { combatantId: 'b3', heroId: 'crag', side: 'B' },
      ]
    )
  );
}

const koB1: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }];

test('status: a Haunted hero knocked out passes its Haunt to its partner, the same round', () => {
  let state = withStatus(hauntBenchFixture(230), 'b1', 'Haunt', {});
  state = { ...state, combatants: { ...state.combatants, b1: { ...state.combatants.b1, currentHp: 1 } } };
  const { state: next, events } = resolveRound(state, koB1, config);
  assert.ok(next.combatants.b1.fainted);
  assert.ok(hasStatus(next.combatants.b2, 'Haunt'), 'the partner took it');
  assert.ok(!hasStatus(next.combatants.b1, 'Haunt'), 'and the fallen no longer holds it');
  assert.ok(events.some((e) => e.type === 'StatusRemoved' && e.combatantId === 'b1' && e.statusId === 'Haunt' && e.reason === 'passed'));
  assert.ok(events.some((e) => e.type === 'StatusApplied' && e.combatantId === 'b2' && e.statusId === 'Haunt'));
});

test('status: with its partner already Haunted, a fallen Haunt waits for the next hero in — one pass, never two', () => {
  let state = withStatus(withStatus(hauntBenchFixture(231), 'b1', 'Haunt', {}), 'b2', 'Haunt', {});
  state = { ...state, combatants: { ...state.combatants, b1: { ...state.combatants.b1, currentHp: 1 } } };
  const r = resolveRound(state, koB1, config);
  assert.deepStrictEqual(r.state.pendingSideStatuses?.B, ['Haunt']);
  assert.ok(!hasStatus(r.state.combatants.b3, 'Haunt'), 'still on the bench');
  const slot = r.state.active.B[0] === null ? 0 : 1;
  const replaced = applyForcedReplacement(r.state, r.state.round, 'B', slot, 'b3', statuses);
  assert.ok(hasStatus(replaced.state.combatants.b3, 'Haunt'), 'the hero taking the fallen one\'s place is Haunted');
  assert.deepStrictEqual(replaced.state.pendingSideStatuses?.B, []);
  assert.ok(replaced.events.some((e) => e.type === 'StatusApplied' && e.combatantId === 'b3' && e.statusId === 'Haunt'));
});

test('status: a status without passesOnFaint dies with its holder', () => {
  let state = withStatus(hauntBenchFixture(232), 'b1', 'Bleed', {});
  state = { ...state, combatants: { ...state.combatants, b1: { ...state.combatants.b1, currentHp: 1 } } };
  const { state: next } = resolveRound(state, koB1, config);
  assert.ok(next.combatants.b1.fainted);
  assert.ok(!hasStatus(next.combatants.b2, 'Bleed'));
  assert.strictEqual(next.pendingSideStatuses, undefined);
});

// --- Ambush: a typeless Force, spent on the next attack ---

/** Side A carries a bench hero so the switch-clearing test has somewhere to go. */
function ambushFixture(seed: number) {
  return deepMana(
    createFightState(
      seed,
      [
        { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
        { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
        { combatantId: 'a3', heroId: 'nightshade', side: 'A' },
      ],
      [
        { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
        { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
      ]
    )
  );
}

const forceBonusOn = (events: readonly any[], targetId: string) =>
  events.find((e) => e.type === 'DamageDealt' && e.targetCombatantId === targetId)?.elementalForceBonus;

test('status: Ambush adds its magnitude to Base Power and is spent by the attack that reads it', () => {
  const loaded = withStatus(ambushFixture(240), 'a1', 'Ambush', { magnitude: 45 });
  const action: Action = { kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' };
  const { state: next, events } = resolveRound(loaded, [action], config);

  assert.strictEqual(forceBonusOn(events, 'b1'), 45);
  assert.strictEqual(hasStatus(next.combatants.a1, 'Ambush'), false);
  assert.ok(events.some((e) => e.type === 'StatusRemoved' && e.combatantId === 'a1' && e.statusId === 'Ambush' && e.reason === 'consumed'));
});

test('status: Ambush is TYPELESS — it pays on a move that shares nothing with the caster', () => {
  // Cinder Knight is Fire/Iron; Splash is Water, so an Elemental Force would contribute nothing here.
  const loaded = withStatus(ambushFixture(241), 'a1', 'Ambush', { magnitude: 30 });
  const { events } = resolveRound(loaded, [{ kind: 'move', combatantId: 'a1', moveId: 'splash', declaredTarget: 'b1' }], config);

  assert.strictEqual(forceBonusOn(events, 'b1'), 30);
});

test('status: a spread cashes Ambush on BOTH targets and still spends it once', () => {
  const loaded = withStatus(ambushFixture(242), 'a1', 'Ambush', { magnitude: 25 });
  const { state: next, events } = resolveRound(loaded, [{ kind: 'move', combatantId: 'a1', moveId: 'umbralWave' }], config);

  assert.strictEqual(forceBonusOn(events, 'b1'), 25);
  assert.strictEqual(forceBonusOn(events, 'b2'), 25, 'read per hit, so the second target is not shortchanged');
  assert.strictEqual(hasStatus(next.combatants.a1, 'Ambush'), false);
  assert.strictEqual(events.filter((e) => e.type === 'StatusRemoved' && e.statusId === 'Ambush').length, 1);
});

test('status: a buff move never spends Ambush — only an attack cashes it', () => {
  const loaded = withStatus(ambushFixture(243), 'a1', 'Ambush', { magnitude: 25 });
  const { state: next } = resolveRound(loaded, [{ kind: 'move', combatantId: 'a1', moveId: 'weaken', declaredTarget: 'b1' }], config);

  assert.strictEqual(next.combatants.a1.statuses.Ambush?.magnitude, 25);
});

test('status: Ambush stacks additively, and switching to the bench clears it rather than banking it', () => {
  const state = ambushFixture(244);
  const twice = applyStatus(applyStatus(state, 1, 'a1', statuses.Ambush, { magnitude: 20 }).state, 1, 'a1', statuses.Ambush, {
    magnitude: 45,
  }).state;
  assert.strictEqual(twice.combatants.a1.statuses.Ambush?.magnitude, 65);

  const { state: next } = resolveRound(twice, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' }], config);
  assert.strictEqual(hasStatus(next.combatants.a1, 'Ambush'), false, 'no banking a loaded hit on the bench');
});

// --- The magnitude formula (docs/combat.md "Scaled status magnitudes") ---

test('status: a Burn lands as three rounds and no number, whoever casts it', () => {
  // docs/timed-statuses.md: a Burn is timed — no StatMult, no STAB, no authored figure to scale.
  const cast = (heroId: string, moveId: string) => {
    const state = deepMana(
      createFightState(
        700,
        [{ combatantId: 'a1', heroId, side: 'A' }],
        [{ combatantId: 'b1', heroId: 'ironWarden', side: 'B' }]
      )
    );
    const applied = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId, declaredTarget: 'b1' }] as Action[], config);
    const event = applied.events.find((e) => e.type === 'StatusApplied' && e.statusId === 'Burn');
    return event && event.type === 'StatusApplied' ? { magnitude: event.magnitude, duration: event.duration } : null;
  };

  for (const [heroId, moveId] of [['crimson', 'setAlight'], ['wildOracle', 'setAlight'], ['cinderKnight', 'moltenLash']]) {
    assert.deepStrictEqual(cast(heroId, moveId), { magnitude: undefined, duration: 3 }, `${heroId} / ${moveId}`);
    const app = statusApplicationsOf(moves[moveId]).find((a) => a.statusId === 'Burn')!;
    assert.strictEqual(app.magnitude, undefined, `${moveId} still authors a Burn magnitude`);
  }
});

test('status: a Burn ticks 15, 8 then 4% of the HOLDER\'s max HP and goes out, and a fresh Burn starts it over', () => {
  const maxHp = fixtureMaxHp('ironWarden');
  const landed = applyStatus(twoVTwoFixture(705), 1, 'b1', statuses.Burn, { magnitude: 3 });
  assert.deepStrictEqual(landed.state.combatants.b1.statuses.Burn, { statusId: 'Burn', duration: 3 }, 'no number, three rounds');
  assert.ok(landed.events.some((e) => e.type === 'StatusApplied' && e.statusId === 'Burn' && e.duration === 3 && e.magnitude === undefined));

  let state = landed.state;
  for (const [share, left] of [[0.15, 2], [0.08, 1], [0.04, 0]] as const) {
    const r = resolveRound(state, [], config);
    const tick = r.events.find((e) => e.type === 'StatusTicked' && e.statusId === 'Burn');
    assert.ok(tick && tick.type === 'StatusTicked' && tick.kind === 'damage');
    assert.strictEqual(tick.type === 'StatusTicked' ? tick.amount : 0, Math.ceil(maxHp * share), `${share * 100}%`);
    assert.strictEqual(tick.type === 'StatusTicked' ? tick.newDuration : -1, left);
    assert.strictEqual(state.combatants.b1.currentHp - r.state.combatants.b1.currentHp, Math.ceil(maxHp * share));
    state = r.state;
  }
  assert.strictEqual(hasStatus(state.combatants.b1, 'Burn'), false, 'out after the third round');

  // Re-lit one round in: back to three rounds left and the 15% tick.
  const once = resolveRound(landed.state, [], config).state;
  assert.strictEqual(once.combatants.b1.statuses.Burn?.duration, 2);
  const relit = applyStatus(once, 2, 'b1', statuses.Burn, {}).state;
  assert.strictEqual(relit.combatants.b1.statuses.Burn?.duration, 3);
  const r = resolveRound(relit, [], config);
  const tick = r.events.find((e) => e.type === 'StatusTicked' && e.statusId === 'Burn');
  assert.strictEqual(tick && tick.type === 'StatusTicked' ? tick.amount : 0, Math.ceil(maxHp * 0.15));
});

test('status: a Rest puts out a Burn — the turn is the price', () => {
  const state = withStatus(twoVTwoFixture(706), 'a1', 'Burn', { duration: 3 });
  const { state: next, events } = resolveRound(state, [{ kind: 'rest', combatantId: 'a1' }] as Action[], config);
  assert.strictEqual(hasStatus(next.combatants.a1, 'Burn'), false);
  assert.ok(events.some((e) => e.type === 'StatusRemoved' && e.statusId === 'Burn' && e.reason === 'rest'));
  assert.ok(!events.some((e) => e.type === 'StatusTicked' && e.statusId === 'Burn' && e.combatantId === 'a1'), 'out before the round end could tick it');
});

test('status: a Rest leaves a status it does not put out', () => {
  const state = withStatus(twoVTwoFixture(707), 'a1', 'Bleed', {});
  const { state: next } = resolveRound(state, [{ kind: 'rest', combatantId: 'a1' }] as Action[], config);
  assert.strictEqual(hasStatus(next.combatants.a1, 'Bleed'), true);
});

test('status: a self-Burn is a cost — the same three rounds as any Burn, knowable before the button is pressed', () => {
  const authored = statusApplicationsOf(moves.volcanicSurge).find((app) => app.statusId === 'Burn')!;
  assert.strictEqual(authored.target, 'self');

  const state = deepMana(
    createFightState(
      702,
      [{ combatantId: 'a1', heroId: 'cinderKnight', side: 'A' }],
      [{ combatantId: 'b1', heroId: 'ironWarden', side: 'B' }]
    )
  );
  const { events } = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'volcanicSurge', declaredTarget: 'b1' }] as Action[],
    config
  );
  const applied = events.find((e) => e.type === 'StatusApplied' && e.statusId === 'Burn');
  assert.ok(applied && applied.type === 'StatusApplied');
  assert.strictEqual(applied.type === 'StatusApplied' ? applied.combatantId : null, 'a1');
  assert.strictEqual(applied.type === 'StatusApplied' ? applied.magnitude : null, undefined);
  assert.strictEqual(applied.type === 'StatusApplied' ? applied.duration : null, 3);
});

test('status: a Renew lands as three rounds and no number, whoever casts it', () => {
  // docs/timed-statuses.md: no Wisdom StatMult, no STAB, no authored count.
  const state = deepMana(
    createFightState(
      703,
      [{ combatantId: 'a1', heroId: 'revenant', side: 'A' }],
      [{ combatantId: 'b1', heroId: 'ironWarden', side: 'B' }]
    )
  );
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'secondWind' }] as Action[], config);
  const applied = events.find((e) => e.type === 'StatusApplied' && e.statusId === 'Renew');
  assert.ok(applied && applied.type === 'StatusApplied');
  const app = statusApplicationsOf(moves.secondWind).find((a) => a.statusId === 'Renew')!;
  assert.strictEqual(app.magnitude, undefined, 'Second Wind still authors a Renew count');
  assert.strictEqual(applied.type === 'StatusApplied' ? applied.magnitude : null, undefined);
  assert.strictEqual(applied.type === 'StatusApplied' ? applied.duration : null, 3);
});

test('status: the formula is gated on the pipeline — a timer status is scaled by nothing', () => {
  for (const def of Object.values(statuses)) {
    if (def.pipeline === 'hot' || def.pipeline === 'dot') continue;
    assert.notStrictEqual(def.pipeline, undefined, `${def.id} has no pipeline to gate on`);
  }
  // Poison is the one magnitude-carrying status outside both, and its magnitude is a
  // PERCENTAGE of max HP — it already tracks the HP pool and must not be scaled again.
  assert.strictEqual(statuses.Poison.pipeline, 'timer');
});

// The out-of-combat entry point exists so a level-up screen or a hero sheet can print the figure
// a rider will land instead of the authored base. It must never disagree with the fight's answer.
test('status: the sheet formula and the fight formula are the same formula', () => {
  const state = createFightState(
    911,
    [{ combatantId: 'a1', heroId: 'crimson', side: 'A' }],
    [{ combatantId: 'b1', heroId: 'ironWarden', side: 'B' }]
  );
  const caster = state.combatants.a1;
  const casterHero = heroes[caster.heroId];
  const sheetCaster = {
    stats: Object.fromEntries(STAT_ORDER.map((stat) => [stat, getEffectiveStat(casterHero, caster, stat)])) as Record<
      StatKey,
      number
    >,
    types: casterHero.types,
  };

  let compared = 0;
  for (const move of Object.values(moves)) {
    for (const app of statusApplicationsOf(move)) {
      const def = statuses[app.statusId];
      if (!def || app.magnitude == null) continue;
      assert.strictEqual(
        resolveStatusMagnitudeFor(app.magnitude, def, app, move, sheetCaster),
        scaleStatusMagnitude(app.magnitude, def, app, move, casterHero, caster),
        `${move.id} / ${def.id} reads differently off a sheet than in a fight`
      );
      compared += 1;
    }
  }
  assert.ok(compared > 40, `only ${compared} riders compared — the sweep found nothing`);
});

test('status: a scaled rider is a BASE, so a low-stat caster lands LESS than the card authored', () => {
  // Shield, the one scaled pool left (Burn and Renew are timed and carry no number).
  const shield = statuses.Shield;
  const tideGuard = moves.tideGuard;
  const app = statusApplicationsOf(tideGuard).find((a) => a.statusId === 'Shield');
  assert.ok(app?.magnitude != null, 'Tide Guard no longer carries a Shield magnitude');

  const hot = { stats: { defense: 90 }, types: ['Water'] as const };
  const cold = { stats: { defense: 20 }, types: ['Stone'] as const };
  assert.ok(resolveStatusMagnitudeFor(app!.magnitude, shield, app!, tideGuard, hot)! > app!.magnitude!, 'a high-Defense caster does not exceed the base');
  assert.ok(resolveStatusMagnitudeFor(app!.magnitude, shield, app!, tideGuard, cold)! < app!.magnitude!, 'a low-Defense caster does not fall under the base');
});

test('status: a caster carrying no stats reads the authored base, never a scaled guess', () => {
  const tideGuard = moves.tideGuard;
  const app = statusApplicationsOf(tideGuard).find((a) => a.statusId === 'Shield');
  assert.ok(app?.magnitude != null);
  // Types still count — STAB is knowable without a stat line — so this probes a non-Water caster.
  assert.strictEqual(resolveStatusMagnitudeFor(app!.magnitude, statuses.Shield, app!, tideGuard, { stats: {}, types: ['Stone'] }), app!.magnitude);
});

test('status: a timed status is never caster-scaled, even by a stat line far off par', () => {
  const setAlight = moves.setAlight;
  const app = statusApplicationsOf(setAlight).find((a) => a.statusId === 'Burn')!;
  assert.strictEqual(resolveStatusMagnitudeFor(app.magnitude, statuses.Burn, app, setAlight, { stats: { intelligence: 150 }, types: ['Fire'] }), app.magnitude);
});

// --- Barrier, the guard (StatusDefinition.blocksIncomingMoves) ---

test('barrier: the far side cannot reach the holder, and the partner beside them still can', () => {
  const state = deepMana(twoVTwoFixture(41));
  const actions: Action[] = [
    // Priority 2 puts the guard in its own bracket above everything, so it is up before the hits land.
    { kind: 'move', combatantId: 'a1', moveId: 'barrier' },
    { kind: 'move', combatantId: 'b1', moveId: 'ironFist', declaredTarget: 'a1' },
    { kind: 'move', combatantId: 'b2', moveId: 'seedShot', declaredTarget: 'a2' },
  ];
  const { state: after, events } = resolveRound(state, actions, config);

  const guarded = events.filter((e) => e.type === 'MoveGuarded');
  assert.strictEqual(guarded.length, 1, 'exactly the one move aimed at the guarded hero turned away');
  assert.strictEqual(guarded[0].type === 'MoveGuarded' && guarded[0].combatantId, 'a1');

  const hits = events.filter((e) => e.type === 'DamageDealt');
  assert.deepStrictEqual(
    hits.map((e) => (e.type === 'DamageDealt' ? e.targetCombatantId : '')),
    ['a2'],
    'the unguarded partner is still a legal target — that is the counterplay'
  );
  assert.strictEqual(after.combatants.a1.currentHp, fixtureMaxHp('cinderKnight'), 'the guarded hero took nothing');
});

test('barrier: an ally reaches through it, so a guard is a defensive turn and not an isolating one', () => {
  let state = deepMana(twoVTwoFixture(42));
  state = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 40 } } };
  const { state: after, events } = resolveRound(
    state,
    [
      { kind: 'move', combatantId: 'a1', moveId: 'barrier' },
      { kind: 'move', combatantId: 'a2', moveId: 'refresh', declaredTarget: 'a1' },
    ],
    config
  );
  assert.strictEqual(events.filter((e) => e.type === 'MoveGuarded').length, 0, 'an ally is never turned away');
  assert.ok(after.combatants.a1.currentHp > 40, 'the heal landed on the guarded hero');
});

test('barrier: it is gone when the round ends, so it can never be a wall the holder stands behind', () => {
  const state = deepMana(twoVTwoFixture(43));
  const { state: after } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'barrier' }], config);
  assert.ok(!hasStatus(after.combatants.a1, 'Barrier'), 'clearsAtEndOfRound took it off');

  const guard = statuses.Barrier;
  assert.ok(guard.blocksIncomingMoves, 'the flag is what the engine reads — never the id');
  assert.ok(guard.clearsOnSwitch, 'a guard cannot be banked on the bench');
  assert.ok(guard.positive, 'Cleanse does not strip it');
  assert.strictEqual(moves.barrier.priority, 2, 'the guard outranks every other bracket in the game');
});
