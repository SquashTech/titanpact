// Mind's authored slate (src/data/moves.ts, 2026-08-30) and the TWO engine
// fields it is the first content to need, plus one invariant it forced into
// existence:
//
//   - `statDeltaChance` (Psi Bolt, Psychock, Psionic Wave) — the exact sibling
//     of `StatusApplication.chance`, and it has to behave identically or the
//     two riders mean different things: it gates the DELTAS and never the
//     move's own body, it rolls once PER TARGET, and it draws no RNG at all
//     when absent.
//   - `doublesStatReductions` (Brain Flay) — the capstone, which has no Base
//     Power and no authored number. Four things fix it and none is enforced by
//     a type: it reads `statModifiers` and NEVER `baselineStatModifiers` (the
//     loadout must not change how hard debuffs amplify), it touches negative
//     modifiers only, it COMPOUNDS (2026-08-30 designer call), and on a clean
//     board it is worth exactly nothing.
//   - **`getEffectiveStat` now floors every stat at 1** (state.ts, 2026-08-30
//     designer call). Raised by this slate but not caused by it: Break Will
//     alone is -50 Attack, and before the floor a negative defStat inverted
//     the off/def ratio so an attack HEALED its target. Pinned here from both
//     ends because nothing else in the codebase asserts it.
//
// Plus the type's own shape, which is invisible in the design table: Mind is
// one of Haunt's `spreadTriggerTypes` (src/data/statuses.ts), so every
// single-target Mind damage move carries a free rider against a Haunted
// target's partner — the same hidden hook Conduct is for Storm, and the count
// is pinned below so it cannot drift silently.

import { firstStatusApplication } from '../src/engine/content';
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
import { statKeysForMove } from '../src/engine/damage/damagePipeline';
import { getEffectiveStat } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';
import type { Action } from '../src/engine/combat/actions';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Cortex (the mono-Mind starter) and Lucius (Shadow/Mind) attack; Warden and Sentinel defend. */
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

/**
 * The two fixture problems every authored slate hits (authoring-moves.md §8):
 * an authored curve the fixture pools cannot pay for, and defenders fragile
 * enough that the hit KOs them before the rider is ever reached — which
 * silently turns a rider test into a KO test. getMaxHp reads
 * `baseStats + statModifiers`, so the hp modifier has to move with currentHp.
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

// --- statDeltaChance: the sibling of StatusApplication.chance ---------------

test('mind: a chanced stat delta actually rolls — the same seed sweep lands it sometimes and not others', () => {
  // The point of the field. If it always landed (or never did) the assertion
  // below would still pass on one seed, so this sweeps until it has seen both.
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
  // CLAUDE.md "No accuracy stat": moves always land. This is the invariant
  // keeping the chance on the rider rather than on the move.
  for (let seed = 1; seed <= 20; seed++) {
    const state = withDeepPools(mindFixture(seed));
    const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'psiBolt', declaredTarget: 'b1' }];
    const { events } = resolveRound(state, actions, config);
    const dealt = events.find((e) => e.type === 'DamageDealt') as { amount: number } | undefined;
    assert.ok(dealt && dealt.amount > 0, `seed ${seed}: Psi Bolt dealt no damage`);
  }
});

test('mind: an UNCHANCED stat delta draws no RNG — Enervate costs exactly what no rider costs', () => {
  // Golden-replay discipline (authoring-moves.md §5 step 3): a new optional
  // field must leave every move authored before it byte-identical, which for
  // anything touching RNG means drawing NOTHING when absent. Enervate and Lull
  // are both unchanced buff-kind moves, so neither may advance rngState at all.
  for (const moveId of ['enervate', 'lull']) {
    const state = withDeepPools(mindFixture(7));
    const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId, declaredTarget: 'b1' }];
    const { state: next } = resolveRound(state, actions, config);
    assert.deepStrictEqual(next.rngState, state.rngState, `${moveId} drew RNG it should not have`);
  }
});

test('mind: a chanced SPREAD rider rolls per target — Psionic Wave can catch one foe and miss the other', () => {
  // Same per-target rule Ember's chanced Burn follows. Swept, because a single
  // seed proves nothing about whether there were one or two draws.
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

// --- doublesStatReductions: the capstone with no number --------------------

test('mind: Brain Flay doubles the reductions standing on both enemies and leaves buffs alone', () => {
  let state = withDeepPools(mindFixture(3));
  state = withModifiers(state, 'b1', { intelligence: -50, attack: -50, defense: 20 });
  state = withModifiers(state, 'b2', { wisdom: -30 });

  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'brainFlay', declaredTarget: 'b1' }];
  const { state: next } = resolveRound(state, actions, config);

  assert.strictEqual(modifiersOf(next, 'b1').intelligence, -100);
  assert.strictEqual(modifiersOf(next, 'b1').attack, -100);
  // A POSITIVE modifier is untouched: the move doubles reductions, and doubling
  // an enemy's own buff would be the exact opposite of what it says.
  assert.strictEqual(modifiersOf(next, 'b1').defense, 20);
  // Spread, so the partner is amplified in the same cast.
  assert.strictEqual(modifiersOf(next, 'b2').wisdom, -60);
});

test('mind: Brain Flay COMPOUNDS — a second cast doubles the already-doubled figure', () => {
  // 2026-08-30 designer call. Pinned because "doubles" has a second reading
  // ("adds the original reduction again") that would be linear instead.
  let state = withDeepPools(mindFixture(4));
  state = withModifiers(state, 'b1', { intelligence: -50 });

  const cast: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'brainFlay', declaredTarget: 'b1' }];
  const once = resolveRound(state, cast, config).state;
  assert.strictEqual(modifiersOf(once, 'b1').intelligence, -100);

  const twice = resolveRound(once, cast, config).state;
  assert.strictEqual(modifiersOf(twice, 'b1').intelligence, -200);
});

test('mind: Brain Flay reads statModifiers, NEVER baselineStatModifiers', () => {
  // The whole definition of the field. baselineStatModifiers is the loadout
  // (equipment, relics, class, Evolution grants); statModifiers is what THIS
  // fight inflicted. A target's armor must not change how hard its debuffs
  // amplify, and a purely equipment-shaped penalty must not be doubled at all.
  let state = withDeepPools(mindFixture(5));
  state = withModifiers(state, 'b1', { intelligence: -30 });
  const c = state.combatants.b1;
  state = {
    ...state,
    combatants: {
      ...state.combatants,
      b1: { ...c, baselineStatModifiers: { ...c.baselineStatModifiers, intelligence: -20, wisdom: -40 } },
    },
  } as CombatState;

  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'brainFlay', declaredTarget: 'b1' }];
  const { state: next } = resolveRound(state, actions, config);

  // The in-fight -30 doubled; the baseline -20 alongside it did not feed in.
  assert.strictEqual(modifiersOf(next, 'b1').intelligence, -60);
  // A stat debuffed ONLY on the baseline is not touched at all.
  assert.strictEqual(modifiersOf(next, 'b1').wisdom, undefined);
  assert.strictEqual((next.combatants.b1.baselineStatModifiers as Record<string, number>).wisdom, -40);
});

test('mind: Brain Flay on a clean board changes nothing and still spends the mana', () => {
  // The Retribution shape (authoring-moves.md §3): a move that is worth 0 when
  // mistimed stays PRESSABLE rather than blinking out of the kit, and the cost
  // is the price of pressing it early. This is why the button carries a live
  // "−N more" chip (FightScreen MoveRow).
  const state = withDeepPools(mindFixture(6));
  const before = state.combatants.a1.currentMana;
  const regen = getEffectiveStat(heroes.mindweaver, state.combatants.a1, 'mpRegen');
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'brainFlay', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.deepStrictEqual(modifiersOf(next, 'b1'), modifiersOf(state, 'b1'));
  assert.strictEqual(events.some((e) => e.type === 'StatChanged'), false);
  // Net of the end-of-round MP Regen tick, which lands before the round returns.
  assert.strictEqual(next.combatants.a1.currentMana, before - moves.brainFlay.manaCost + regen);
});

test('mind: Brain Flay reports the amount ADDED, not the new total', () => {
  // So the Battle Log and every event-stream reader treat it as an ordinary
  // debuff beat rather than needing a special case.
  let state = withDeepPools(mindFixture(8));
  state = withModifiers(state, 'b1', { attack: -40 });
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'brainFlay', declaredTarget: 'b1' }];
  const { events } = resolveRound(state, actions, config);

  const changed = events.find(
    (e) => e.type === 'StatChanged' && (e as { combatantId: string }).combatantId === 'b1'
  ) as { delta: number; newValue: number } | undefined;
  assert.ok(changed);
  assert.strictEqual(changed.delta, -40);
  assert.strictEqual(changed.newValue, -80);
});

// --- The stat floor --------------------------------------------------------

test('mind: no effective stat can fall below 1, however far the modifier goes', () => {
  // state.ts getEffectiveStat, 2026-08-30. The single chokepoint every reader
  // goes through, which is why the clamp lives there and not in Brain Flay.
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
  // The bug the floor actually fixes, and the reason it is not merely cosmetic:
  // a negative defStat inverted the ratio and made the hit heal its target, and
  // a defStat of exactly 0 made it Infinity. Break Will alone is -50 Attack.
  let state = withDeepPools(mindFixture(13));
  state = withModifiers(state, 'b1', { wisdom: -9999 });
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'psiBolt', declaredTarget: 'b1' }];
  const { events } = resolveRound(state, actions, config);
  const dealt = events.find((e) => e.type === 'DamageDealt') as { amount: number } | undefined;
  assert.ok(dealt);
  assert.ok(Number.isFinite(dealt.amount) && dealt.amount > 0, `damage was ${dealt.amount}`);
});

// --- Mind Shatter: offStatOverride on the MAGICAL pair ----------------------

test('mind: Mind Shatter swings Wisdom, and only the numerator moves', () => {
  // PIPELINE 1 (CLAUDE.md two-pipeline separation): it changes WHICH stat is
  // read, it scales nothing. The defender still blocks with the category's
  // stat, which makes this the only attack in the game with one stat on both
  // sides of the ratio — Enervate shrinks the bottom, Mental Fortress grows
  // the top.
  assert.deepStrictEqual(statKeysForMove(moves.mindShatter), ['wisdom', 'wisdom']);
  assert.deepStrictEqual(statKeysForMove(moves.psychock), ['intelligence', 'wisdom']);
});

test('mind: buffing the caster Wisdom actually makes Mind Shatter hit harder', () => {
  // The loop the slate is built around, asserted end to end rather than off the
  // stat keys alone. Not a specific damage number — that is balance and moves.
  const base = withDeepPools(mindFixture(2));
  const buffed = withModifiers(base, 'a1', { wisdom: 60 });
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'mindShatter', declaredTarget: 'b1' }];

  const plain = resolveRound(base, actions, config).events.find((e) => e.type === 'DamageDealt') as { amount: number };
  const big = resolveRound(buffed, actions, config).events.find((e) => e.type === 'DamageDealt') as { amount: number };
  assert.ok(big.amount > plain.amount, `${big.amount} was not greater than ${plain.amount}`);
});

// --- The hidden hook: Mind is one of Haunt's spreadTriggerTypes -------------

test('mind: every single-target Mind damage move carries the Haunt spread for free', () => {
  // The type's engine, and it is invisible in the design table (same shape as
  // Conduct on Storm — stormMoves.test.ts pins its count for the same reason).
  // Pinned as an exact count so a later slate change cannot quietly alter how
  // much free value the type's raw numbers are already carrying.
  assert.deepStrictEqual(statuses.Haunt.spreadTriggerTypes, ['Spirit', 'Mind']);
  const singleTargetMindDamage = Object.values(moves).filter(
    (m) => m.type === 'Mind' && m.kind === 'damage' && m.target === 'singleEnemy'
  );
  assert.strictEqual(singleTargetMindDamage.length, 6);
  // And exactly one move in the slate plants the mark it all keys off.
  const haunters = Object.values(moves).filter(
    (m) => m.type === 'Mind' && firstStatusApplication(m)?.statusId === 'Haunt'
  );
  assert.deepStrictEqual(haunters.map((m) => m.id), ['wickedFear']);
});

test('mind: Cerebral Shock plants a mark no Mind move can cash in', () => {
  // 2026-08-30 designer call: INTENDED. Mind sets up, a Storm or Iron partner
  // detonates. Pinned because it looks like a bug in every file it touches, and
  // because the move is deliberately left unreachable for the same reason
  // (test/stoneMoves.test.ts's orphan list).
  assert.strictEqual(firstStatusApplication(moves.cerebralShock)?.statusId, 'Conduct');
  assert.deepStrictEqual(statuses.Conduct.triggerTypes, ['Storm', 'Iron']);
  assert.strictEqual((statuses.Conduct.triggerTypes as readonly string[]).includes('Mind'), false);
});

// --- Distribution (§7) and the two checks every slate copies ---------------

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
      // levelUpMovePool filters unlocked moves out, so a starter in the pool is
      // dead weight that can never be offered.
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('mind: each Mind hero attacks with a stat it is actually good at', () => {
  // The north star's trap-pick rule (CLAUDE.md). The whole slate is magical, so
  // this is really the check that neither Mind hero was left holding a kit with
  // no attack in it at all — which is exactly what Shadow's Vesper turned out
  // to be until a slate went looking.
  for (const heroId of ['mindweaver', 'lucius']) {
    const hero = heroes[heroId];
    const damage = hero.moveIds.map((id) => moves[id]).filter((m) => m.kind === 'damage');
    assert.ok(damage.length > 0, `${heroId} has no damage move at all`);
    const wants = hero.baseStats.attack > hero.baseStats.intelligence ? 'physical' : 'magical';
    assert.ok(damage.some((m) => m.category === wants), `${heroId} attacks off its weaker stat`);
  }
});

test('mind: the authored slate is 16 moves and every authored stat delta is still a multiple of 5', () => {
  // The multiples-of-5/10 lock (CLAUDE.md). Brain Flay needs no exemption —
  // doubling a multiple of 5 is a multiple of 5 — unlike derivedStatDeltas,
  // which is the one documented hole in the rule.
  const mind = Object.values(moves).filter((m) => m.type === 'Mind');
  assert.strictEqual(mind.length, 16);
  for (const m of mind) {
    for (const d of m.statDeltas ?? []) {
      assert.strictEqual(Math.abs(d.amount) % 5, 0, `${m.id} authors a non-multiple-of-5 delta`);
    }
  }
});
