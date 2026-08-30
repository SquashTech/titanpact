// Field Effects (docs/field-effects.md) — resolves docs/mana.md's former
// "weather subsystem" open question. Covers the locked shape end to end: only
// one active at a time, a flat 5-round duration regardless of which effect,
// no-op on re-applying the active effect, override-and-restart on a
// different one, and Magical Surge's mpRegenMultiplier actually doubling
// regen through the round loop.

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
import type { Action } from '../src/engine/combat/actions';
import { setFieldEffect, tickFieldEffect, FIELD_EFFECT_DURATION_ROUNDS } from '../src/engine/combat/fieldEffectEngine';
import { applyManaRegen } from '../src/engine/combat/manaRegen';
import { tickEndOfRound, applyStatus } from '../src/engine/combat/statusEngine';
import { orderActions } from '../src/engine/combat/priority';
import { resolveStatRatio } from '../src/engine/damage/damagePipeline';
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

// --- fieldEffectEngine.ts: the locked shape in isolation ---------------------

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

// --- manaRegen.ts: Magical Surge actually doubles regen ---------------------

test('fieldEffects: Magical Surge doubles every combatant\'s MP Regen', () => {
  const built = twoVTwoFixture(405);
  // Drain every combatant well below full mana first — createFightState
  // starts everyone at max, and the regen tick clamps to 0 headroom there,
  // which would make both the plain and doubled runs indistinguishably zero.
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
  // Drain b3's mana below full first — otherwise the regen tick clamps to 0
  // (already at maxMana) and the doubling would be invisible either way.
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

// --- End to end via resolveRound: the magicCloak move sets the field -------
// Repointed from arcaneSurge, which the authored Arcane slate deleted
// (src/data/moves.ts, 2026-08-30). Magic Cloak rather than Mana Font, the
// slate's other setter: Mana Font also grants +10 MP Regen to both allies,
// which is the very quantity these tests measure. Magic Cloak's own rider is
// Stealth on the caster, which none of them read.

test('fieldEffects: casting magicCloak sets Magical Surge, and the very next regen tick is doubled', () => {
  const state = twoVTwoFixture(407);
    const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'magicCloak' }];
  const { state: next, events } = resolveRound(state, actions, config);

  // The casting round's own end-of-round tick already fires once (resolveRound.ts
  // ticks every round, including the one that just set the effect), so the clock
  // reads 4 immediately afterward, not 5.
  assert.deepStrictEqual(next.activeFieldEffect, { fieldEffectId: 'surgingMagic', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS - 1 });
  assert.ok(events.some((e) => e.type === 'FieldEffectSet' && e.fieldEffectId === 'surgingMagic'));

  // a1 (cinderKnight, mpRegen 5) spent Magic Cloak's mana this same round,
  // then the round's own end-of-round mana regen tick already runs doubled —
  // Magical Surge takes effect the same round it's cast, not the round after.
  const spent = moves.magicCloak.manaCost;
  const expectedRegen = heroes.cinderKnight.baseStats.mpRegen * 2;
  assert.strictEqual(next.combatants.a1.currentMana, heroes.cinderKnight.baseStats.manaPool - spent + expectedRegen);
});

test('fieldEffects: Magical Surge expires after 5 rounds of resolveRound, reverting regen to normal', () => {
  let state = twoVTwoFixture(408);
  // The cast round's own end-of-round tick already fires (resolveRound.ts
  // ticks every round, including the one that just set the effect), so the
  // clock reads 4 immediately after the casting round, not 5.
  state = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'magicCloak' }], config).state;
  assert.strictEqual(state.activeFieldEffect?.roundsRemaining, FIELD_EFFECT_DURATION_ROUNDS - 1);

  // Two more empty rounds keep it alive (remaining 3, then 2)...
  for (let i = 0; i < FIELD_EFFECT_DURATION_ROUNDS - 3; i++) {
    state = resolveRound(state, [], config).state;
    assert.ok(state.activeFieldEffect, `still active after round ${i + 2}`);
  }

  // ...and the next two ticks bring it to 1, then expire it.
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

// --- Scorched Land: Burn no longer decays ------------------------------------

test('fieldEffects: Scorched Land suppresses Burn\'s end-of-round decay; normally it halves', () => {
  const built = twoVTwoFixture(410);
  const burned = applyStatus(built, 1, 'a1', statuses.Burn, { magnitude: 20 }).state;
  const maxHpOf = (id: string) => getMaxHp(heroes[burned.combatants[id].heroId], burned.combatants[id]);

  const normalTick = tickEndOfRound(burned, 1, statuses, fieldEffects, maxHpOf);
  assert.strictEqual(normalTick.state.combatants.a1.statuses.Burn?.magnitude, 10); // halved as usual
  assert.ok(normalTick.events.some((e) => e.type === 'StatusTicked' && e.statusId === 'Burn' && e.newMagnitude === 10));

  const scorched = { ...burned, activeFieldEffect: { fieldEffectId: 'scorchedLand', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
  const scorchedTick = tickEndOfRound(scorched, 1, statuses, fieldEffects, maxHpOf);
  assert.strictEqual(scorchedTick.state.combatants.a1.statuses.Burn?.magnitude, 20); // decay suppressed
  const tickEvent = scorchedTick.events.find((e) => e.type === 'StatusTicked' && e.statusId === 'Burn');
  assert.ok(tickEvent && tickEvent.type === 'StatusTicked' && tickEvent.kind === 'damage' && tickEvent.amount === 20 && tickEvent.newMagnitude === undefined);
});

test('fieldEffects: Scorched Land keeps Burn at full magnitude across several rounds, then decay resumes once it expires', () => {
  const built = twoVTwoFixture(411);
  // ironWarden (135 HP) rather than a1 — needs to survive 5 rounds of an
  // un-decayed 20-damage Burn (100 HP worth) plus one round past expiry.
  let state = applyStatus(built, 1, 'b1', statuses.Burn, { magnitude: 20 }).state;
  state = { ...state, activeFieldEffect: { fieldEffectId: 'scorchedLand', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };

  // 5 rounds of Scorched Land: Burn deals its full 20 every round without ever halving.
  for (let i = 0; i < FIELD_EFFECT_DURATION_ROUNDS; i++) {
    state = resolveRound(state, [], config).state;
    assert.strictEqual(state.combatants.b1.statuses.Burn?.magnitude, 20, `still full magnitude after round ${i + 1}`);
  }
  assert.strictEqual(state.activeFieldEffect, null); // expired exactly on schedule

  // Now that Scorched Land is gone, the next end-of-round tick halves it as normal.
  state = resolveRound(state, [], config).state;
  assert.strictEqual(state.combatants.b1.statuses.Burn?.magnitude, 10);
});

// --- Stasis Bubble: reverse Speed order within a shared priority bracket ----

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
    { kind: 'move', combatantId: 'b1', moveId: 'quickJab', declaredTarget: 'a2' }, // ironWarden, priority 1, speed 30 (slower, but higher priority)
  ];

  const stasis = { ...state, activeFieldEffect: { fieldEffectId: 'stasisBubble', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
  const { ordered } = orderActions(stasis, heroes, actions, moves, stasis.rngState, fieldEffects);
  // b1's priority-1 quickJab still goes first even though it's the slower actor and
  // Stasis Bubble is active — the reversal only ever changes a same-bracket tiebreak.
  assert.deepStrictEqual(ordered.map((a) => a.combatantId), ['b1', 'a2']);
});

// --- Sanctuary: healing moves gain +1 priority -------------------------------

test('fieldEffects: Sanctuary bumps a heal-kind move\'s priority bracket by 1, regardless of Speed', () => {
  const state = twoVTwoFixture(430);
  const actions: Action[] = [
    { kind: 'move', combatantId: 'a1', moveId: 'mendWounds', declaredTarget: 'a1' }, // cinderKnight, heal, speed 50, cast on itself
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
    { kind: 'move', combatantId: 'a1', moveId: 'mendWounds', declaredTarget: 'a1' },
    { kind: 'move', combatantId: 'b2', moveId: 'vineLash', declaredTarget: 'a1' },
  ];

  const { events } = resolveRound(state, actions, config);
  const turnOrder = events.filter((e) => e.type === 'TurnStarted').map((e) => (e.type === 'TurnStarted' ? e.combatantId : ''));
  assert.deepStrictEqual(turnOrder, ['a1', 'b2']);
});

// --- Verdant Earth: bonus Attack/Intelligence equal to the Renew status ------
// Reworked 2026-08-26: originally read the mpRegen STAT (a naming mix-up between
// "MP Regen" and the HoT status, which is why that status is now "Renew"). The
// bonus is a build-around payoff keyed to the status, so a hero not carrying
// Renew gains nothing and the bonus decays as Renew's magnitude halves.

/** Puts `magnitude` Renew on one combatant, through the real status engine. */
function withRenew(state: CombatState, combatantId: string, magnitude: number): CombatState {
  return applyStatus(state, 1, combatantId, statuses.Renew, { magnitude }).state;
}

test('fieldEffects: Verdant Earth adds the combatant\'s own Renew magnitude to Attack and Intelligence, not other stats', () => {
  const state = withRenew(twoVTwoFixture(440), 'a1', 20);
  const hero = heroes.cinderKnight;
  const combatant = state.combatants.a1;

  const noCtx = getEffectiveStat(hero, combatant, 'attack');
  assert.strictEqual(noCtx, hero.baseStats.attack); // no field effect context passed -> unaffected

  const inactiveCtx = { active: null, defs: fieldEffects };
  assert.strictEqual(getEffectiveStat(hero, combatant, 'attack', inactiveCtx), hero.baseStats.attack);

  const activeCtx = { active: { fieldEffectId: 'verdantEarth', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS }, defs: fieldEffects };
  assert.strictEqual(getEffectiveStat(hero, combatant, 'attack', activeCtx), hero.baseStats.attack + 20);
  assert.strictEqual(getEffectiveStat(hero, combatant, 'intelligence', activeCtx), hero.baseStats.intelligence + 20);
  // Not in statBonusEqualToStatusMagnitude -> untouched
  assert.strictEqual(getEffectiveStat(hero, combatant, 'defense', activeCtx), hero.baseStats.defense);
  assert.strictEqual(getEffectiveStat(hero, combatant, 'speed', activeCtx), hero.baseStats.speed);
});

test('fieldEffects: Verdant Earth does nothing for a hero not carrying Renew, and shrinks as Renew decays', () => {
  const activeCtx = { active: { fieldEffectId: 'verdantEarth', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS }, defs: fieldEffects };
  const hero = heroes.cinderKnight;

  // No Renew -> magnitude 0 -> no bonus at all, even with the effect up.
  const bare = twoVTwoFixture(443);
  assert.strictEqual(getEffectiveStat(hero, bare.combatants.a1, 'attack', activeCtx), hero.baseStats.attack);

  // Renew halves at end of round (StatusDefinition.decay: 'halve'), so the
  // Attack bonus tracks it down rather than holding at its opening value.
  const renewed = withRenew(bare, 'a1', 20);
  assert.strictEqual(getEffectiveStat(hero, renewed.combatants.a1, 'attack', activeCtx), hero.baseStats.attack + 20);
  const maxHpOf = (id: string) => getMaxHp(heroes[renewed.combatants[id].heroId], renewed.combatants[id]);
  const afterRound = tickEndOfRound(renewed, 1, statuses, fieldEffects, maxHpOf).state;
  assert.strictEqual(afterRound.combatants.a1.statuses.Renew.magnitude, 10);
  assert.strictEqual(getEffectiveStat(hero, afterRound.combatants.a1, 'attack', activeCtx), hero.baseStats.attack + 10);
});

test('fieldEffects: Verdant Earth raises the damage-pipeline stat ratio via the boosted offStat', () => {
  const state = withRenew(twoVTwoFixture(441), 'a1', 20);
  const attackerHero = heroes.cinderKnight; // physical: Attack/Defense
  const attacker = state.combatants.a1;
  const defenderHero = heroes.ironWarden;
  const defender = state.combatants.b1;

  const plainRatio = resolveStatRatio('physical', attackerHero, attacker, defenderHero, defender);
  const activeCtx = { active: { fieldEffectId: 'verdantEarth', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS }, defs: fieldEffects };
  const boostedRatio = resolveStatRatio('physical', attackerHero, attacker, defenderHero, defender, activeCtx);

  const expectedRatio = (attackerHero.baseStats.attack + 20) / defenderHero.baseStats.defense;
  assert.ok(boostedRatio > plainRatio);
  assert.strictEqual(boostedRatio, expectedRatio);
});

test('fieldEffects: Verdant Earth — a DamageDealt event\'s offStat reflects the Renew bonus end to end', () => {
  const built = withRenew(twoVTwoFixture(442), 'a1', 20);
  const state = { ...built, activeFieldEffect: { fieldEffectId: 'verdantEarth', roundsRemaining: FIELD_EFFECT_DURATION_ROUNDS } };
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' }]; // physical, cinderKnight

  const { events } = resolveRound(state, actions, config);
  const dmg = events.find((e) => e.type === 'DamageDealt');
  assert.ok(dmg && dmg.type === 'DamageDealt');
  if (dmg && dmg.type === 'DamageDealt') {
    assert.strictEqual(dmg.offStat, heroes.cinderKnight.baseStats.attack + 20);
  }
});
