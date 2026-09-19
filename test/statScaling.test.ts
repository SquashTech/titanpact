// Scaled stat deltas (docs/stat-scaling.md §2, phase 1): an authored delta is a BASE the caster
// scales — a buff off Wisdom, a debuff off the move's offensive stat — and what is exempt.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState, landedDelta } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState } from '../src/engine/state';
import { getEffectiveStat, statModifierCeiling, statModifierFloor } from '../src/engine/state';
import {
  resolveStatDeltaFor,
  statDeltaLandsOnCasterSide,
  statDeltaRole,
} from '../src/engine/combat/statDeltaScaling';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** crimson (Fire, Wis 75, Int 80) + cinderKnight (Fire/Iron, Wis 40, Atk 85) vs ironWarden + wildOracle. */
function fixture(seed: number, a1 = 'crimson', a2 = 'cinderKnight'): CombatState {
  const state = createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: a1, side: 'A' },
      { combatantId: 'a2', heroId: a2, side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
    ]
  );
  const combatants = Object.fromEntries(
    Object.entries(state.combatants).map(([id, c]) => [
      id,
      { ...c, currentMana: 999, currentHp: c.side === 'B' ? 1200 : c.currentHp, statModifiers: { ...c.statModifiers, manaPool: 999, ...(c.side === 'B' ? { hp: 1200 } : {}) } },
    ])
  );
  return { ...state, combatants } as CombatState;
}

const cast = (state: CombatState, combatantId: string, moveId: string, declaredTarget?: string) =>
  resolveRound(state, [{ kind: 'move', combatantId, moveId, declaredTarget } as Action], config);

const statChanged = (events: readonly { type: string }[]) => events.filter((e) => e.type === 'StatChanged') as any[];

// --- Which stat is read ---

test('scaling: a buff reads the caster\'s WISDOM — Kindle off Cinder Knight (Wis 40) is ×0.9, off Crimson (Wis 75) ×1.25, both with STAB', () => {
  // 20 × 0.9 × 1.25 = 22.5 → 23; 20 × 1.25 × 1.25 = 31.25 → 31.
  const knight = cast(fixture(1), 'a2', 'kindle');
  assert.strictEqual(knight.state.combatants.a2.statModifiers.attack, 23);
  const crimson = cast(fixture(1), 'a1', 'kindle');
  assert.strictEqual(crimson.state.combatants.a1.statModifiers.attack, 31);
});

test('scaling: a debuff reads the OFFENSIVE stat the move swings with — Weaken (magical) off Int, Pin Down (physical) off Attack', () => {
  // Crimson, Int 80, off-type for Shadow: 20 × 1.3 = 26 each, on Attack and Defense since the
  // 2026-09-19 pass; neither reaches Iron Warden's floor (the floor tests below use Enervate).
  const weaken = cast(fixture(2), 'a1', 'weaken', 'b1');
  assert.strictEqual(weaken.state.combatants.b1.statModifiers.attack, -26);
  assert.strictEqual(weaken.state.combatants.b1.statModifiers.defense, -26);
  // Cinder Knight, Attack 85, off-type for Iron (mono-Fire since 2026-09-19): 20 × 1.35 = 27; the Speed 10 → 14, inside the −15 floor on Iron Warden's Speed 30 (the Wisdom line above is where the floor binds).
  const pin = cast(fixture(2), 'a2', 'pinDown', 'b1');
  assert.strictEqual(pin.state.combatants.b1.statModifiers.defense, -27);
  assert.strictEqual(pin.state.combatants.b1.statModifiers.speed, -14);
});

test('scaling: the SIGN classes each delta — Landslide\'s ally buff reads Wisdom while its hit reads Attack', () => {
  const role = (amount: number, onCasterSide: boolean) => statDeltaRole('defense', amount, onCasterSide);
  assert.strictEqual(role(20, true), 'buff');
  assert.strictEqual(role(-20, false), 'debuff');
  assert.strictEqual(role(-20, true), 'cost');
  assert.strictEqual(role(0, false), 'flat');
  assert.strictEqual(statDeltaRole('mpRegen', 10, true), 'flat');
});

// --- What is exempt ---

test('scaling: a negative delta on the caster\'s own side is a COST and lands flat', () => {
  const move = { ...moves.weaken, target: 'self' as const };
  const caster = { stats: { intelligence: 100, wisdom: 100 }, types: ['Shadow' as const] };
  assert.strictEqual(resolveStatDeltaFor('defense', -20, move, caster, true), -20);
  assert.strictEqual(resolveStatDeltaFor('defense', -20, moves.weaken, caster, false), -38, '20 × 1.5 × 1.25 STAB');
});

test('scaling: MP Regen is a resource grant, not a ratio — Mana Font lands its authored +10', () => {
  const { state, events } = cast(fixture(3, 'runescribe', 'crimson'), 'a1', 'manaFont');
  assert.strictEqual(state.combatants.a1.statModifiers.mpRegen, 10);
  assert.strictEqual(state.combatants.a2.statModifiers.mpRegen, 10);
  for (const e of statChanged(events)) assert.strictEqual(e.authored, 10, 'still reported as a base — the multiplier was 1');
});

test('scaling: a DERIVED delta passes through unscaled and carries no authored base', () => {
  const { state, events } = cast(fixture(4, 'runescribe', 'crimson'), 'a1', 'arcaneOverflow');
  const before = fixture(4, 'runescribe', 'crimson').combatants.a1.currentMana;
  assert.strictEqual(state.combatants.a1.statModifiers.intelligence, Math.min(before, statModifierCeiling(heroes.runescribe, state.combatants.a1, 'intelligence')));
  for (const e of statChanged(events)) assert.strictEqual(e.authored, undefined);
});

// --- The event, the snapshot, the helper ---

test('scaling: StatChanged carries the authored base beside what landed', () => {
  const { events } = cast(fixture(6), 'a2', 'moltenLash', 'b1');
  const [drop] = statChanged(events);
  assert.strictEqual(drop.authored, -20);
  assert.strictEqual(drop.delta, -34);
  assert.strictEqual(drop.newValue, -34);
});

test('scaling: the caster\'s stat is SNAPSHOTTED at cast — a Wisdom self-buff makes the next buff bigger, never the one that raised it', () => {
  // Brain Ward (+30 Wisdom, Mind, magical) on self: Crimson Wis 75 → 30 × 1.25 = 37.5 → 38 (off-type, no STAB).
  const state = fixture(7);
  const once = cast(state, 'a1', 'brainWard', 'a1');
  assert.strictEqual(once.state.combatants.a1.statModifiers.wisdom, 38);
  // Second cast reads Wisdom 113: 30 × 1.63 = 48.9 → 49, so the pile is 38 + 49, not 2 × 38.
  const twice = cast(once.state, 'a1', 'brainWard', 'a1');
  assert.strictEqual(twice.state.combatants.a1.statModifiers.wisdom, 38 + 49);
});

test('scaling: landedDelta agrees with the engine, and a caster with no stat to read lands the base', () => {
  const state = fixture(8);
  assert.strictEqual(landedDelta(state, 'a1', moves.kindle, 'attack', 20, 'a1'), 31);
  assert.strictEqual(resolveStatDeltaFor('attack', 20, moves.kindle, { stats: {}, types: [] }, true), 20);
});

test('scaling: the card-only side read — self, ally and bothAllies deltas are the caster\'s side; a hit\'s rider is not', () => {
  assert.strictEqual(statDeltaLandsOnCasterSide(moves.kindle), true);
  assert.strictEqual(statDeltaLandsOnCasterSide(moves.landslide), true);
  assert.strictEqual(statDeltaLandsOnCasterSide(moves.spireClaw), true);
  assert.strictEqual(statDeltaLandsOnCasterSide(moves.moltenLash), false);
  assert.strictEqual(statDeltaLandsOnCasterSide(moves.weaken), false);
});

// --- The floor: a debuff can at most halve a stat (§3, phase 2 — the debuff half) ---

test('floor: a stat\'s fight modifier never goes under −½(base + loadout), and the drop that hits it lands short and says so', () => {
  // Iron Warden's Wisdom 50: floor −25. Enervate (−30, off-type for Mind: 30 × 1.3 = 39) lands −25 capped; a second lands 0, capped, and still emits.
  const state = fixture(20);
  const once = cast(state, 'a1', 'enervate', 'b1');
  const first = statChanged(once.events).find((e) => e.stat === 'wisdom');
  assert.strictEqual(first.delta, -25);
  assert.strictEqual(first.authored, -30);
  assert.strictEqual(first.capped, true);
  assert.strictEqual(statModifierFloor(heroes.ironWarden, state.combatants.b1, 'wisdom'), -25);

  const twice = cast(once.state, 'a1', 'enervate', 'b1');
  const second = statChanged(twice.events).find((e) => e.stat === 'wisdom');
  assert.strictEqual(second.delta, 0, 'a drop at the floor lands nothing');
  assert.strictEqual(second.capped, true);
  assert.strictEqual(twice.state.combatants.b1.statModifiers.wisdom, -25);
  assert.strictEqual(getEffectiveStat(heroes.ironWarden, twice.state.combatants.b1, 'wisdom'), 25, 'halved, never floored at 1');
});

test('floor: loadout raises it — the same drop on a hero wearing +50 Wisdom lands in full', () => {
  const state = fixture(21);
  const b1 = state.combatants.b1;
  const geared = { ...state, combatants: { ...state.combatants, b1: { ...b1, baselineStatModifiers: { ...b1.baselineStatModifiers, wisdom: 50 } } } } as CombatState;
  const { events } = cast(geared, 'a1', 'enervate', 'b1');
  const drop = statChanged(events).find((e) => e.stat === 'wisdom');
  assert.strictEqual(drop.delta, -39);
  assert.strictEqual(drop.capped, undefined);
});

test('ceiling: a buffed stat is at most ×4 what it started the fight at, and the rise that hits it lands short and says so', () => {
  // Crimson's Attack 30: ceiling +90. Two Kindles at +31 land in full (62); the third lands +28, capped; the fourth lands 0.
  let state = fixture(22);
  assert.strictEqual(statModifierCeiling(heroes.crimson, state.combatants.a1, 'attack'), 90);
  for (let i = 0; i < 2; i++) state = cast(state, 'a1', 'kindle').state;
  assert.strictEqual(state.combatants.a1.statModifiers.attack, 62);
  const third = cast(state, 'a1', 'kindle');
  const rise = statChanged(third.events).find((e) => e.stat === 'attack');
  assert.strictEqual(rise.delta, 28);
  assert.strictEqual(rise.capped, true);
  const fourth = cast(third.state, 'a1', 'kindle');
  const none = statChanged(fourth.events).find((e) => e.stat === 'attack');
  assert.strictEqual(none.delta, 0);
  assert.strictEqual(none.capped, true);
  assert.strictEqual(getEffectiveStat(heroes.crimson, fourth.state.combatants.a1, 'attack'), 120, 'four times what it started at');
});

// --- The noise floor (§4, phase 3): a body is authored at ≥ 20, a split body ≥ 15 a stat, a rider ≥ 10, nothing at 5 ---

/** Speed is ordering, not a ratio, and MP Regen is exempt from scaling: neither counts toward the floor. */
const countsTowardFloor = (stat: string) => stat !== 'speed' && stat !== 'mpRegen';

test('floor: no authored delta in any pool is 5, and every rider is at least 10', () => {
  for (const move of Object.values(moves)) {
    for (const d of move.statDeltas ?? []) assert.ok(Math.abs(d.amount) >= 10, `${move.id} ${d.stat} ${d.amount}`);
    if (move.randomStatDeltas) assert.ok(move.randomStatDeltas.amount >= 10, `${move.id} random ${move.randomStatDeltas.amount}`);
  }
});

test('floor: a buff move\'s body sits above the variance band — 20 on one stat, 15 a stat when split or paid to both allies', () => {
  for (const move of Object.values(moves)) {
    // A Class move's body is its verb (Intercept is a redirect; its +10 is a rider on that).
    if (move.kind !== 'buff' || move.typeFollowsUser) continue;
    const body = (move.statDeltas ?? []).filter((d) => countsTowardFloor(d.stat));
    if (!body.length) continue;
    const twoTargets = move.target === 'bothAllies' || move.statDeltaTarget === 'bothAllies';
    const floor = body.length === 1 && !twoTargets ? 20 : 15;
    for (const d of body) assert.ok(Math.abs(d.amount) >= floor, `${move.id} ${d.stat} ${d.amount} is under the ${floor} body floor`);
  }
});

// --- The authoring rule the formula stands on ---

test('scaling: every authored delta is still a multiple of 5 — the base is what the rule binds', () => {
  for (const move of Object.values(moves)) {
    for (const d of move.statDeltas ?? []) assert.strictEqual(Math.abs(d.amount) % 5, 0, `${move.id} ${d.stat} ${d.amount}`);
    if (move.randomStatDeltas) assert.strictEqual(move.randomStatDeltas.amount % 5, 0, move.id);
  }
});
