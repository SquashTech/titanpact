// Field Effects (docs/field-effects.md): one active at a time, flat 5-round clock, re-apply is a
// no-op, a different effect overrides and restarts, and each authored effect's payload end to end.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives, fieldHeraldPassiveFor } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import { setFieldEffect, tickFieldEffect, FIELD_EFFECT_DURATION_ROUNDS } from '../src/engine/combat/fieldEffectEngine';
import { applyManaRegen } from '../src/engine/combat/manaRegen';
import { tickEndOfRound, applyStatus } from '../src/engine/combat/statusEngine';
import { resolveBattleStartEntries } from '../src/engine/combat/passiveEngine';
import { orderActions, previewOrder, bracketEffect } from '../src/engine/combat/priority';
import { fieldTypeMultFloor, resolveStatRatio } from '../src/engine/damage/damagePipeline';
import { getEffectiveStat, getMaxHp } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';

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

// --- fieldEffectEngine.ts ---

test('fieldEffects: setFieldEffect activates a new effect for the full duration', () => {
  const state = twoVTwoFixture(400);
  const { state: next, events } = setFieldEffect(state, 1, 'surgingMagic');

  assert.deepStrictEqual(next.activeFieldEffect, { fieldEffectId: 'surgingMagic', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS });
  assert.ok(events.some((e) => e.type === 'FieldEffectSet' && e.fieldEffectId === 'surgingMagic' && e.previousFieldEffectId === null));
});

test('fieldEffects: re-applying the already-active effect is a no-op — no event, clock unchanged', () => {
  const state = twoVTwoFixture(401);
  const set = setFieldEffect(state, 1, 'surgingMagic');
  const ticked = tickFieldEffect(set.state, 1); // 5 -> 4
  const reapplied = setFieldEffect(ticked.state, 2, 'surgingMagic');

  assert.strictEqual(reapplied.events.length, 0);
  assert.strictEqual(reapplied.state.activeFieldEffect?.roundsRemaining, 4); // NOT refreshed back to 5
});

test('fieldEffects: setting a different effect overrides the active one and restarts the clock', () => {
  const state = twoVTwoFixture(402);
  const withFakeOther: typeof state = { ...state, activeFieldEffect: { fieldEffectId: 'scorchedLand', roundsRemaining: 1 } };
  const { state: next, events } = setFieldEffect(withFakeOther, 3, 'surgingMagic');

  assert.deepStrictEqual(next.activeFieldEffect, { fieldEffectId: 'surgingMagic', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS });
  assert.ok(events.some((e) => e.type === 'FieldEffectSet' && e.fieldEffectId === 'surgingMagic' && e.previousFieldEffectId === 'scorchedLand'));
});

test('fieldEffects: tickFieldEffect counts down and expires exactly after 5 rounds', () => {
  let state = setFieldEffect(twoVTwoFixture(403), 1, 'surgingMagic').state;

  for (let round = 1; round < FIELD_EFFECT_DURATION_ROUNDS; round++) {
    const result = tickFieldEffect(state, round);
    state = result.state;
    assert.strictEqual(state.activeFieldEffect?.roundsRemaining, FIELD_EFFECT_DURATION_ROUNDS - round);
    assert.ok(result.events.some((e) => e.type === 'FieldEffectTicked'));
  }

  const final = tickFieldEffect(state, FIELD_EFFECT_DURATION_ROUNDS);
  assert.strictEqual(final.state.activeFieldEffect, null);
  assert.ok(final.events.some((e) => e.type === 'FieldEffectExpired' && e.fieldEffectId === 'surgingMagic'));
});

test('fieldEffects: tickFieldEffect is a no-op when nothing is active', () => {
  const state = twoVTwoFixture(404);
  const { state: next, events } = tickFieldEffect(state, 1);
  assert.strictEqual(next, state);
  assert.strictEqual(events.length, 0);
});

// --- manaRegen.ts: Magical Surge ---

test('fieldEffects: Magical Surge doubles every combatant\'s MP Regen', () => {
  const built = twoVTwoFixture(405);
  // Everyone starts at max mana, where the regen tick clamps to 0 — drain first so the doubling is visible.
  const combatants = Object.fromEntries(Object.entries(built.combatants).map(([id, c]) => [id, { ...c, currentMana: 1 }]));
  const state = { ...built, combatants };

  const plain = applyManaRegen(state, 1, heroes, fieldEffects);
  const doubled = applyManaRegen(setFieldEffect(state, 1, 'surgingMagic').state, 1, heroes, fieldEffects);

  for (const id of ['a1', 'a2', 'b1', 'b2']) {
    const plainRegen = plain.state.combatants[id].currentMana - 1;
    const doubledRegen = doubled.state.combatants[id].currentMana - 1;
    assert.ok(plainRegen > 0, `${id} should have regenerated some mana`);
    assert.strictEqual(doubledRegen, plainRegen * 2);
  }
});

test('fieldEffects: Magical Surge also doubles regen for a benched combatant', () => {
  const built = createFightState(
    4051,
    [{ combatantId: 'a1', heroId: 'cinderKnight', side: 'A' }],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
      { combatantId: 'b3', heroId: 'wildOracle', side: 'B' }, // benched
    ]
  );
  const state = { ...built, combatants: { ...built.combatants, b3: { ...built.combatants.b3, currentMana: 10 } } };
  const surging = setFieldEffect(state, 1, 'surgingMagic').state;
  const { state: next } = applyManaRegen(surging, 1, heroes, fieldEffects);

  assert.strictEqual(next.combatants.b3.currentMana, 10 + heroes.wildOracle.baseStats.mpRegen * 2);
});

test('fieldEffects: mana regen is unaffected once no Field Effect is active', () => {
  const built = twoVTwoFixture(406);
  const state = { ...built, combatants: { ...built.combatants, a1: { ...built.combatants.a1, currentMana: 1 } } };
  const { state: next } = applyManaRegen(state, 1, heroes, fieldEffects);
  assert.strictEqual(next.combatants.a1.currentMana, 1 + heroes.cinderKnight.baseStats.mpRegen);
});

// --- End to end via resolveRound: magicCloak sets the field ---
// Magic Cloak rather than Mana Font: Mana Font also grants +10 MP Regen, the quantity measured here.

test('fieldEffects: casting magicCloak sets Magical Surge, and the very next regen tick is doubled', () => {
  const state = twoVTwoFixture(407);
    const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'magicCloak' }];
  const { state: next, events } = resolveRound(state, actions, config);

  // The casting round's own end-of-round tick already fires, so the clock reads 4, not 5.
  assert.deepStrictEqual(next.activeFieldEffect, { fieldEffectId: 'surgingMagic', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS - 1 });
  assert.ok(events.some((e) => e.type === 'FieldEffectSet' && e.fieldEffectId === 'surgingMagic'));

  // Magical Surge takes effect the same round it's cast: the cast round's regen tick is already doubled.
  const spent = moves.magicCloak.manaCost;
  const expectedRegen = heroes.cinderKnight.baseStats.mpRegen * 2;
  assert.strictEqual(next.combatants.a1.currentMana, heroes.cinderKnight.baseStats.manaPool - spent + expectedRegen);
});

test('fieldEffects: Magical Surge expires after 5 rounds of resolveRound, reverting regen to normal', () => {
  let state = twoVTwoFixture(408);
  state = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'magicCloak' }], config).state;
  assert.strictEqual(state.activeFieldEffect?.roundsRemaining, FIELD_EFFECT_DURATION_ROUNDS - 1);

  for (let i = 0; i < FIELD_EFFECT_DURATION_ROUNDS - 3; i++) {
    state = resolveRound(state, [], config).state;
    assert.ok(state.activeFieldEffect, `still active after round ${i + 2}`);
  }

  state = resolveRound(state, [], config).state;
  assert.strictEqual(state.activeFieldEffect?.roundsRemaining, 1);

  const last = resolveRound(state, [], config);
  assert.strictEqual(last.state.activeFieldEffect, null);
  assert.ok(last.events.some((e) => e.type === 'FieldEffectExpired'));
});

test('fieldEffects: casting magicCloak again while it is already active does not refresh the duration', () => {
  let state = twoVTwoFixture(409);
  state = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'magicCloak' }], config).state; // cast: 5 -> 4 (this round's own tick)
  state = resolveRound(state, [], config).state; // empty round: 4 -> 3

  const { state: next, events } = resolveRound(state, [{ kind: 'move', combatantId: 'a2', moveId: 'magicCloak' }], config);
  assert.strictEqual(events.some((e) => e.type === 'FieldEffectSet'), false);
  assert.strictEqual(next.activeFieldEffect?.roundsRemaining, 2); // ticked down again this round (3 -> 2), not reset to 5
});

// --- Scorched Land: Burn doesn't fade ---

test("fieldEffects: under Scorched Land Burn doesn't fade — 15% every round it lasts, against 15/8/4 with none up", () => {
  const built = twoVTwoFixture(410);
  const maxHp = getMaxHp(heroes.ironWarden, built.combatants.b1);
  const burnTicks = (state: CombatState) => {
    let working = applyStatus(state, 1, 'b1', statuses.Burn, {}).state;
    const amounts: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = resolveRound(working, [], config);
      const tick = r.events.find((e) => e.type === 'StatusTicked' && e.statusId === 'Burn' && e.combatantId === 'b1');
      amounts.push(tick && tick.type === 'StatusTicked' ? tick.amount : 0);
      working = r.state;
    }
    assert.strictEqual(working.combatants.b1.statuses.Burn, undefined, 'out after three rounds either way');
    return amounts;
  };
  assert.deepStrictEqual(burnTicks(built), [0.15, 0.08, 0.04].map((p) => Math.ceil(maxHp * p)));
  const scorched = { ...built, activeFieldEffect: { fieldEffectId: 'scorchedLand', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
  const held = Math.ceil(maxHp * 0.15);
  assert.deepStrictEqual(burnTicks(scorched), [held, held, held]);
});

test('fieldEffects: a Burn cast under Scorched Land lands as an ordinary Burn and holds its 15% tick, end to end', () => {
  const built = twoVTwoFixture(411);
  const maxHp = getMaxHp(heroes.ironWarden, built.combatants.b1);
  const state = {
    ...built,
    activeFieldEffect: { fieldEffectId: 'scorchedLand', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS },
    combatants: { ...built.combatants, a1: { ...built.combatants.a1, currentMana: 999 } },
  };
  const first = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'moltenLash', declaredTarget: 'b1' }] as Action[], config);
  const applied = first.events.find((e) => e.type === 'StatusApplied' && e.statusId === 'Burn' && e.combatantId === 'b1');
  assert.ok(applied && applied.type === 'StatusApplied' && applied.duration === 3 && applied.magnitude === undefined, 'the field changes nothing at landing');
  const second = resolveRound(first.state, [], config);
  const tick = second.events.find((e) => e.type === 'StatusTicked' && e.statusId === 'Burn' && e.combatantId === 'b1');
  assert.strictEqual(tick && tick.type === 'StatusTicked' ? tick.amount : 0, Math.ceil(maxHp * 0.15), 'its second round still 15%, not 8');
});

// --- Stasis Bubble: reverse Speed order within a shared priority bracket ---

test('fieldEffects: Stasis Bubble reverses the Speed tiebreak within a shared priority bracket', () => {
  const state = twoVTwoFixture(420);
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }, // cinderKnight, speed 50
    { kind: 'move', combatantId: 'b2', moveId: 'vineLash', declaredTarget: 'a1' }, // wildOracle, speed 65
  ];

  const normal = orderActions(state, heroes, actions, moves, state.rngState, fieldEffects);
  assert.deepStrictEqual(normal.ordered.map((a) => a.combatantId), ['b2', 'a1']); // faster (65) first, as always

  const stasis = { ...state, activeFieldEffect: { fieldEffectId: 'stasisBubble', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
  const reversed = orderActions(stasis, heroes, actions, moves, stasis.rngState, fieldEffects);
  assert.deepStrictEqual(reversed.ordered.map((a) => a.combatantId), ['a1', 'b2']); // slower (50) first
});

test('fieldEffects: Stasis Bubble does not touch priority BRACKETS — a priority move still resolves in its own bracket', () => {
  const state = twoVTwoFixture(421);
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a2', moveId: 'splash', declaredTarget: 'b1' }, // tidecaller, priority 0, speed 55
    { kind: 'move', combatantId: 'b1', moveId: 'swiftBlow', declaredTarget: 'a2' }, // ironWarden, priority 1, speed 30 (slower, but higher priority)
  ];

  const stasis = { ...state, activeFieldEffect: { fieldEffectId: 'stasisBubble', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
  const { ordered } = orderActions(stasis, heroes, actions, moves, stasis.rngState, fieldEffects);
  assert.deepStrictEqual(ordered.map((a) => a.combatantId), ['b1', 'a2']);
});

// --- Sanctuary: healing moves gain +1 priority ---

test('fieldEffects: Sanctuary bumps a heal-kind move\'s priority bracket by 1, regardless of Speed', () => {
  const state = twoVTwoFixture(430);
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'mend', declaredTarget: 'a1' }, // cinderKnight, heal, speed 50, cast on itself
    { kind: 'move', combatantId: 'b2', moveId: 'vineLash', declaredTarget: 'a1' }, // wildOracle, damage, speed 65
  ];

  const normal = orderActions(state, heroes, actions, moves, state.rngState, fieldEffects);
  assert.deepStrictEqual(normal.ordered.map((a) => a.combatantId), ['b2', 'a1']); // both priority 0 -> faster (65) first

  const sanctuary = { ...state, activeFieldEffect: { fieldEffectId: 'sanctuary', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
  const withSanctuary = orderActions(sanctuary, heroes, actions, moves, sanctuary.rngState, fieldEffects);
  assert.deepStrictEqual(withSanctuary.ordered.map((a) => a.combatantId), ['a1', 'b2']); // heal now bracket 1, resolves first
});

test('fieldEffects: Sanctuary — a heal actually lands before a same-bracket damage move once resolveRound runs', () => {
  const built = twoVTwoFixture(431);
  const state = { ...built, activeFieldEffect: { fieldEffectId: 'sanctuary', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'mend', declaredTarget: 'a1' },
    { kind: 'move', combatantId: 'b2', moveId: 'vineLash', declaredTarget: 'a1' },
  ];

  const { events } = resolveRound(state, actions, config);
  const turnOrder = events.filter((e) => e.type === 'TurnStarted').map((e) => (e.type === 'TurnStarted' ? e.combatantId : ''));
  assert.deepStrictEqual(turnOrder, ['a1', 'b2']);
});

// --- Verdant Earth: Renew heals twice as much, and what passes max HP becomes Shield (docs/blessings-and-statuses.md §5) ---

const verdant = (state: CombatState): CombatState => ({ ...state, activeFieldEffect: { fieldEffectId: 'verdantEarth', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } });

test('fieldEffects: under Verdant Earth a Renew tick heals twice its tenth', () => {
  const base = twoVTwoFixture(430);
  const maxHp = getMaxHp(heroes.cinderKnight, base.combatants.a1);
  const hurt = { ...base, combatants: { ...base.combatants, a1: { ...base.combatants.a1, currentHp: 10 } } };
  const renewed = applyStatus(hurt, 1, 'a1', statuses.Renew, {}).state;
  const plain = resolveRound(renewed, [], config).state.combatants.a1.currentHp;
  const doubled = resolveRound(verdant(renewed), [], config).state.combatants.a1.currentHp;
  assert.strictEqual(plain, 10 + Math.ceil(maxHp * 0.1));
  assert.strictEqual(doubled, 10 + 2 * Math.ceil(maxHp * 0.1));
});

test('fieldEffects: under Verdant Earth a Renew heal past max HP lands as Shield, and without it the excess is lost', () => {
  const base = twoVTwoFixture(431);
  const maxHp = getMaxHp(heroes.cinderKnight, base.combatants.a1);
  const nearlyWhole = { ...base, combatants: { ...base.combatants, a1: { ...base.combatants.a1, currentHp: maxHp - 5 } } };
  const renewed = applyStatus(nearlyWhole, 1, 'a1', statuses.Renew, {}).state;

  const plain = resolveRound(renewed, [], config).state.combatants.a1;
  assert.strictEqual(plain.currentHp, maxHp);
  assert.strictEqual(plain.statuses.Shield, undefined, 'no field, no Shield');

  const grown = resolveRound(verdant(renewed), [], config);
  const a1 = grown.state.combatants.a1;
  assert.strictEqual(a1.currentHp, maxHp);
  assert.strictEqual(a1.statuses.Shield?.magnitude, 2 * Math.ceil(maxHp * 0.1) - 5, 'everything past max HP');
  assert.ok(grown.events.some((e) => e.type === 'StatusApplied' && e.combatantId === 'a1' && e.statusId === 'Shield'));
});

test('fieldEffects: under Verdant Earth a Renew still heals nothing as it lands — the doubling is on its round-end ticks', () => {
  const base = verdant(twoVTwoFixture(432));
  const maxHp = getMaxHp(heroes.cinderKnight, base.combatants.a1);
  const hurt = { ...base, combatants: { ...base.combatants, a1: { ...base.combatants.a1, currentHp: 10 } } };
  const landed = applyStatus(hurt, 1, 'a1', statuses.Renew, { holderMaxHp: maxHp, fieldEffect: fieldEffects.verdantEarth, statusDefs: statuses });
  assert.strictEqual(landed.state.combatants.a1.currentHp, 10);
  const r = resolveRound(landed.state, [], config);
  assert.strictEqual(r.state.combatants.a1.currentHp, 10 + 2 * Math.ceil(maxHp * 0.1));
});

test('fieldEffects: Verdant Earth grants no stats any more — Attack and Intelligence read the same with Renew held', () => {
  const renewed = applyStatus(twoVTwoFixture(433), 1, 'a1', statuses.Renew, {}).state;
  const ctx = { active: { fieldEffectId: 'verdantEarth', roundsRemaining: 5 }, defs: fieldEffects };
  assert.strictEqual(getEffectiveStat(heroes.cinderKnight, renewed.combatants.a1, 'attack', ctx), getEffectiveStat(heroes.cinderKnight, renewed.combatants.a1, 'attack'));
});

// --- Sanctuary's second job (2026-09-15, per user direction): a heal-pipeline term, beside the priority ---

test('fieldEffects: Sanctuary multiplies a heal-kind move\'s restored HP by healMultiplier, as a pipeline term, and the Healed event says so', () => {
  const built = twoVTwoFixture(450);
  const hurt: CombatState = { ...built, combatants: { ...built.combatants, a1: { ...built.combatants.a1, currentHp: 1 } } };
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'mend', declaredTarget: 'a1' }];

  const plain = resolveRound(hurt, actions, config).events.find((e) => e.type === 'Healed');
  const sanctuary = { ...hurt, activeFieldEffect: { fieldEffectId: 'sanctuary', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
  const blessed = resolveRound(sanctuary, actions, config).events.find((e) => e.type === 'Healed');
  assert.ok(plain && plain.type === 'Healed' && blessed && blessed.type === 'Healed');
  if (plain?.type === 'Healed' && blessed?.type === 'Healed') {
    assert.strictEqual(plain.fieldMult, 1);
    assert.strictEqual(blessed.fieldMult, fieldEffects.sanctuary.healMultiplier);
    assert.strictEqual(blessed.amount, Math.round(plain.healPower! * plain.wisdomMult! * plain.stab! * fieldEffects.sanctuary.healMultiplier!));
    // The term is the field's, not Wisdom's — the Wisdom multiplier is unchanged under it.
    assert.strictEqual(blessed.wisdomMult, plain.wisdomMult);
  }
});

test('fieldEffects: Sanctuary\'s heal term does not reach a Renew tick — a HoT is not a heal-kind move', () => {
  const built = applyStatus(twoVTwoFixture(451), 1, 'a1', statuses.Renew, {}).state;
  const hurt: CombatState = { ...built, combatants: { ...built.combatants, a1: { ...built.combatants.a1, currentHp: 1 } } };
  const maxHpOf = (id: string) => getMaxHp(heroes[hurt.combatants[id].heroId], hurt.combatants[id]);
  const plainTick = tickEndOfRound(hurt, 1, statuses, fieldEffects, maxHpOf).events.find((e) => e.type === 'StatusTicked');
  const sanctuary = { ...hurt, activeFieldEffect: { fieldEffectId: 'sanctuary', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
  const blessedTick = tickEndOfRound(sanctuary, 1, statuses, fieldEffects, maxHpOf).events.find((e) => e.type === 'StatusTicked');
  assert.ok(plainTick && plainTick.type === 'StatusTicked' && blessedTick && blessedTick.type === 'StatusTicked');
  if (plainTick?.type === 'StatusTicked' && blessedTick?.type === 'StatusTicked') {
    assert.strictEqual(blessedTick.amount, plainTick.amount);
  }
});

// --- The Heralds (docs/field-effects.md "Heralds"): a field set on entry, costing no turn ---

test('fieldEffects: every field has a Herald that sets it on entry, and a Herald on the opening lead sets it before round 1', () => {
  for (const [fieldEffectId, def] of Object.entries(fieldEffects)) {
    // The Titan's own field (docs/titan-eyes.md §10) is set by the Eyes and by nothing a hero can hold.
    if (def.drainsPercentMaxHp) continue;
    const heraldId = fieldHeraldPassiveFor[def.flavorType as keyof typeof fieldHeraldPassiveFor];
    assert.ok(heraldId, `${fieldEffectId} has no Herald`);
    const herald = passives[heraldId!];
    assert.deepStrictEqual(herald.reactive, {
      hook: 'SwitchedIn',
      condition: { relativeTo: 'self' },
      effect: { kind: 'setFieldEffect', fieldEffectId },
    });
    assert.ok(!herald.reactive?.oncePerFight, `${heraldId} is once-per-fight — a lapsed field must be re-settable by a pivot`);
  }

  const built = twoVTwoFixture(452);
  const a1 = built.combatants.a1;
  const state = { ...built, combatants: { ...built.combatants, a1: { ...a1, passives: { heraldOfDawn: { passiveId: 'heraldOfDawn', stacks: 1 } } } } };
  const opened = resolveBattleStartEntries(state, 1, heroes, statuses, passives, fieldEffects);
  assert.strictEqual(opened.state.activeFieldEffect?.fieldEffectId, 'sanctuary');
  assert.ok(opened.events.some((e) => e.type === 'FieldEffectSet' && e.fieldEffectId === 'sanctuary'));
});

test('fieldEffects: a Herald\'s re-entry re-sets a LAPSED field but never refreshes an active one — the clock is the locked shape', () => {
  const built = twoVTwoFixture(453);
  const a1 = built.combatants.a1;
  const state = { ...built, combatants: { ...built.combatants, a1: { ...a1, passives: { heraldOfSurge: { passiveId: 'heraldOfSurge', stacks: 1 } } } } };
  const opened = resolveBattleStartEntries(state, 1, heroes, statuses, passives, fieldEffects).state;
  const ticked = tickFieldEffect(opened, 1).state; // 5 -> 4
  const again = resolveBattleStartEntries(ticked, 2, heroes, statuses, passives, fieldEffects);
  assert.strictEqual(again.state.activeFieldEffect?.roundsRemaining, 4);
  assert.ok(!again.events.some((e) => e.type === 'FieldEffectSet'));

  const lapsed = { ...ticked, activeFieldEffect: null };
  const reset = resolveBattleStartEntries(lapsed, 3, heroes, statuses, passives, fieldEffects);
  assert.strictEqual(reset.state.activeFieldEffect?.roundsRemaining, FIELD_EFFECT_DURATION_ROUNDS);
});

// --- previewOrder: the command-phase readout of the same sort, with no RNG spun ---

test('previewOrder: undeclared combatants sit at bracket 0 in Speed order; a declared bracket, switch or Rest moves its hero', () => {
  const state = twoVTwoFixture(430);
  // tidecaller 66 > wildOracle 65 > cinderKnight 55 > ironWarden 30 at bracket 0.
  const ids = ['a1', 'a2', 'b1', 'b2'];
  const base = orderPreviewIds(state, ids, []);
  assert.deepStrictEqual(base, ['a2', 'b2', 'a1', 'b1']);

  const { entries: withPriority } = previewOrder(state, heroes, ids, [{ kind: 'move', combatantId: 'b1', moveId: 'swiftBlow', declaredTarget: 'a2' }], moves, fieldEffects);
  assert.deepStrictEqual(withPriority.map((e) => e.combatantId), ['b1', 'a2', 'b2', 'a1']);
  assert.strictEqual(withPriority[0].priority, 1);

  const { entries: withSwitchAndRest } = previewOrder(
    state,
    heroes,
    ids,
    [
      { kind: 'rest', combatantId: 'b2' },
      { kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' },
    ],
    moves,
    fieldEffects
  );
  assert.deepStrictEqual(withSwitchAndRest.map((e) => e.combatantId), ['a1', 'a2', 'b1', 'b2']);
});

test('previewOrder: an exact bracket + Speed collision is flagged, never shuffled, and a rolled bracket reads as unknown at 0', () => {
  const state = twoVTwoFixture(431);
  // Lift ironWarden (30) to wildOracle's 65: the two collide at bracket 0.
  const tied: CombatState = {
    ...state,
    combatants: { ...state.combatants, b1: { ...state.combatants.b1, statModifiers: { ...state.combatants.b1.statModifiers, speed: 35 } } },
  };
  const ids = ['a1', 'a2', 'b1', 'b2'];
  const { entries } = previewOrder(tied, heroes, ids, [], moves, fieldEffects);
  assert.deepStrictEqual(entries.map((e) => e.combatantId), ['a2', 'b1', 'b2', 'a1']); // input order kept inside the tie
  assert.deepStrictEqual(entries.map((e) => e.tiedWithPrevious), [false, false, true, false]);

  const { entries: rolled } = previewOrder(tied, heroes, ids, [{ kind: 'move', combatantId: 'a1', moveId: 'cogBop', declaredTarget: 'b1' }], moves, fieldEffects);
  const a1 = rolled.find((e) => e.combatantId === 'a1')!;
  assert.strictEqual(a1.priority, null);
  assert.strictEqual(rolled.indexOf(a1), 3); // placed as a 0 until the reel spins
});

function orderPreviewIds(state: CombatState, ids: readonly string[], declared: readonly Action[]): string[] {
  return previewOrder(state, heroes, ids, declared, moves, fieldEffects).entries.map((e) => e.combatantId);
}

test('resolveRound: RoundOrdered names the settled order — brackets rolled, a switch and a Rest at their own — before anything resolves', () => {
  const state = twoVTwoFixture(432);
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' },
    { kind: 'rest', combatantId: 'a2' },
    { kind: 'move', combatantId: 'b1', moveId: 'swiftBlow', declaredTarget: 'a2' },
    { kind: 'move', combatantId: 'b2', moveId: 'vineLash', declaredTarget: 'a1' },
  ];
  const { events } = resolveRound(state, actions, config);
  const ordered = events.find((e) => e.type === 'RoundOrdered');
  assert.ok(ordered && ordered.type === 'RoundOrdered');
  assert.strictEqual(events.indexOf(ordered), 1); // right after RoundStarted
  assert.deepStrictEqual(ordered.order.map((o) => o.combatantId), ['b1', 'b2', 'a1', 'a2']);
  assert.deepStrictEqual(ordered.order.map((o) => o.priority), [1, 0, 0, Number.NEGATIVE_INFINITY]);
  assert.strictEqual(ordered.reversedSpeed, false);
  // The turns then begin in that order.
  const turns = events.flatMap((e) => (e.type === 'TurnStarted' ? [e.combatantId] : []));
  assert.deepStrictEqual(turns, ['b1', 'b2', 'a1', 'a2']);
});

test('previewOrder + bracketEffect: under Stasis Bubble the slower is the favoured one, and a cut reads against that', () => {
  const state = twoVTwoFixture(433);
  const stasis: CombatState = { ...state, activeFieldEffect: { fieldEffectId: 'stasisBubble', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
  const ids = ['a1', 'a2', 'b1', 'b2'];
  // Speeds: ironWarden 30 < cinderKnight 55 < wildOracle 65 < tidecaller 66, so reversed is b1, a1, b2, a2.
  const plain = previewOrder(stasis, heroes, ids, [], moves, fieldEffects);
  assert.strictEqual(plain.reversedSpeed, true);
  assert.deepStrictEqual(plain.entries.map((e) => e.combatantId), ['b1', 'a1', 'b2', 'a2']);

  // tidecaller's +1 cuts ahead of everyone the field favoured over it — a cut, read on the reversed axis.
  const { entries, reversedSpeed } = previewOrder(stasis, heroes, ids, [{ kind: 'move', combatantId: 'a2', moveId: 'swiftBlow', declaredTarget: 'b1' }], moves, fieldEffects);
  assert.deepStrictEqual(entries.map((e) => e.combatantId), ['a2', 'b1', 'a1', 'b2']);
  assert.strictEqual(bracketEffect(entries, 0, reversedSpeed), 'cut');
  // The same bracket on the hero the field already sent first moves nothing.
  const first = previewOrder(stasis, heroes, ids, [{ kind: 'move', combatantId: 'b1', moveId: 'swiftBlow', declaredTarget: 'a2' }], moves, fieldEffects);
  assert.strictEqual(bracketEffect(first.entries, 0, first.reversedSpeed), null);
  // Read on the wrong axis, b1's bracket would have looked like a cut past three faster heroes.
  assert.strictEqual(bracketEffect(first.entries, 0, false), 'cut');

  // Without the field, a2 (66) is already first: its +1 is a pip and no effect.
  const normal = previewOrder(state, heroes, ids, [{ kind: 'move', combatantId: 'a2', moveId: 'swiftBlow', declaredTarget: 'b1' }], moves, fieldEffects);
  assert.strictEqual(bracketEffect(normal.entries, 0, normal.reversedSpeed), null);
  // A Rest under the field is held behind the three the field would have sent after it.
  const rested = previewOrder(stasis, heroes, ids, [{ kind: 'rest', combatantId: 'b1' }], moves, fieldEffects);
  assert.strictEqual(rested.entries[3].combatantId, 'b1');
  assert.strictEqual(bracketEffect(rested.entries, 3, rested.reversedSpeed), 'held');
});

// --- Blood Moon, Downpour, Bedrock (docs/status-ladders-and-fields.md §3–5) ---

function underField<T extends CombatState>(state: T, fieldEffectId: string): T {
  return { ...state, activeFieldEffect: { fieldEffectId, roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
}

function withBleed(state: CombatState, id: string): CombatState {
  const c = state.combatants[id];
  return { ...state, combatants: { ...state.combatants, [id]: { ...c, statuses: { ...c.statuses, Bleed: { statusId: 'Bleed' } } } } };
}

test('fieldEffects: under Blood Moon a Bleeding hero is healed by nothing — a heal move, a Renew tick, a passive', () => {
  const base = underField(twoVTwoFixture(470), 'bloodMoon');
  const hurt = { ...base, combatants: { ...base.combatants, a1: { ...base.combatants.a1, currentHp: 50, currentMana: 999 }, a2: { ...base.combatants.a2, currentMana: 999 } } };
  const bleeding = withBleed(hurt, 'a1');
  const renewed = applyStatus(bleeding, 1, 'a1', statuses.Renew, {}).state;
  const { state: next, events } = resolveRound(renewed, [{ kind: 'move', combatantId: 'a2', moveId: 'refresh', declaredTarget: 'a1' }] as Action[], config);
  const ticks = events.filter((e) => e.type === 'StatusTicked' && e.statusId === 'Renew' && e.combatantId === 'a1');
  assert.ok(ticks.length > 0 && ticks.every((e) => e.type === 'StatusTicked' && e.blocked && e.amount === 0), 'every Renew heal refused');
  const maxHp = getMaxHp(heroes.cinderKnight, next.combatants.a1);
  const bled = Math.ceil(maxHp * 0.06);
  assert.strictEqual(next.combatants.a1.currentHp, 50 - bled, 'only the Bleed tick moved the bar');
});

test('fieldEffects: under Blood Moon a hit on a Bleeding hero heals the attacker a quarter of the HP it removed', () => {
  const base = underField(twoVTwoFixture(471), 'bloodMoon');
  const state = withBleed({ ...base, combatants: { ...base.combatants, a1: { ...base.combatants.a1, currentHp: 20, currentMana: 999 } } }, 'b1');
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'moltenLash', declaredTarget: 'b1' }] as Action[], config);
  const hit = events.find((e) => e.type === 'DamageDealt' && e.sourceCombatantId === 'a1' && e.targetCombatantId === 'b1');
  const fed = events.find((e) => e.type === 'Healed' && e.targetCombatantId === 'a1' && e.drain);
  assert.ok(hit && hit.type === 'DamageDealt' && fed && fed.type === 'Healed');
  assert.strictEqual(fed.type === 'Healed' ? fed.amount : 0, Math.round((hit.type === 'DamageDealt' ? hit.amount : 0) * 0.25));

  const clean = resolveRound(underField(twoVTwoFixture(471), 'bloodMoon'), [{ kind: 'move', combatantId: 'a1', moveId: 'moltenLash', declaredTarget: 'b1' }] as Action[], config);
  assert.ok(!clean.events.some((e) => e.type === 'Healed'), 'no Bleed, no feed');
});

test('fieldEffects: under Blood Moon a Bleeding attacker feeds on nothing', () => {
  const base = underField(twoVTwoFixture(472), 'bloodMoon');
  const state = withBleed(withBleed({ ...base, combatants: { ...base.combatants, a1: { ...base.combatants.a1, currentHp: 20, currentMana: 999 } } }, 'b1'), 'a1');
  const { events } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'moltenLash', declaredTarget: 'b1' }] as Action[], config);
  assert.ok(!events.some((e) => e.type === 'Healed' && e.targetCombatantId === 'a1'));
});

test('fieldEffects: under Downpour a Water attack on a Nature hero lands at ×1, not resisted', () => {
  const state = createFightState(
    473,
    [{ combatantId: 'a1', heroId: 'tidecaller', side: 'A' }],
    [{ combatantId: 'b1', heroId: 'wildOracle', side: 'B' }]
  );
  const deep = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentMana: 999 } } };
  const read = (s: CombatState) => {
    const { events } = resolveRound(s, [{ kind: 'move', combatantId: 'a1', moveId: 'splash', declaredTarget: 'b1' }] as Action[], config);
    const hit = events.find((e) => e.type === 'DamageDealt');
    return hit && hit.type === 'DamageDealt' ? hit.typeMult : NaN;
  };
  assert.ok(read(deep) < 1, 'the fixture must be a resisted matchup');
  assert.strictEqual(read(underField(deep, 'downpour')), 1);
});

test('fieldEffects: Downpour lifts only Water and Frost, and never lowers a super-effective hit', () => {
  const ctx = (id: string | null) => ({ active: id ? { fieldEffectId: id, roundsRemaining: 5 } : null, defs: fieldEffects });
  assert.strictEqual(fieldTypeMultFloor('Water', ctx('downpour')), 1);
  assert.strictEqual(fieldTypeMultFloor('Frost', ctx('downpour')), 1);
  assert.strictEqual(fieldTypeMultFloor('Fire', ctx('downpour')), 0);
  assert.strictEqual(fieldTypeMultFloor('Water', ctx(null)), 0);
});

test('fieldEffects: under Bedrock a physical hit swings with Defense when Defense is the higher', () => {
  const built = twoVTwoFixture(474);
  const attacker = built.combatants.b1; // Iron Warden: Defense well above Attack
  const defender = built.combatants.a1;
  const hero = heroes[attacker.heroId];
  assert.ok(getEffectiveStat(hero, attacker, 'defense') > getEffectiveStat(hero, attacker, 'attack'), 'the fixture must be a wall');
  const plain = resolveStatRatio('physical', hero, attacker, heroes[defender.heroId], defender, { active: null, defs: fieldEffects });
  const bedrock = resolveStatRatio('physical', hero, attacker, heroes[defender.heroId], defender, {
    active: { fieldEffectId: 'bedrock', roundsRemaining: 5 },
    defs: fieldEffects,
  });
  const defStat = getEffectiveStat(heroes[defender.heroId], defender, 'defense');
  assert.strictEqual(plain, getEffectiveStat(hero, attacker, 'attack') / defStat);
  assert.strictEqual(bedrock, getEffectiveStat(hero, attacker, 'defense') / defStat);
  const magical = resolveStatRatio('magical', hero, attacker, heroes[defender.heroId], defender, { active: { fieldEffectId: 'bedrock', roundsRemaining: 5 }, defs: fieldEffects });
  assert.strictEqual(magical, getEffectiveStat(hero, attacker, 'intelligence') / getEffectiveStat(heroes[defender.heroId], defender, 'wisdom'), 'a magical hit is untouched');
});

test('fieldEffects: every new field has its three routes — a Herald, an Early rider and a Mid reader, pooled together', () => {
  for (const [fieldEffectId, rider, reader] of [
    ['bloodMoon', 'gash', 'bloodFrenzy'],
    ['downpour', 'rainfall', 'drench'],
    ['bedrock', 'digIn', 'tectonicSlam'],
  ] as const) {
    assert.strictEqual(moves[rider].fieldEffectApplication, fieldEffectId);
    assert.strictEqual(moves[rider].tier, 'early');
    assert.strictEqual(moves[reader].conditionalPower?.requiresFieldEffect, fieldEffectId);
    assert.ok(fieldHeraldPassiveFor[fieldEffects[fieldEffectId].flavorType as keyof typeof fieldHeraldPassiveFor], `${fieldEffectId} has no Herald`);
  }
});

test('fieldEffects: each new rider sets its field when cast, end to end', () => {
  for (const [moveId, fieldEffectId, target] of [
    ['rainfall', 'downpour', 'a2'],
    ['digIn', 'bedrock', undefined],
    ['gash', 'bloodMoon', 'b1'],
  ] as const) {
    const built = twoVTwoFixture(480);
    const state = { ...built, combatants: { ...built.combatants, a1: { ...built.combatants.a1, currentMana: 999 } } };
    const { state: next } = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId, ...(target ? { declaredTarget: target } : {}) }] as Action[], config);
    assert.strictEqual(next.activeFieldEffect?.fieldEffectId, fieldEffectId, moveId);
  }
});
