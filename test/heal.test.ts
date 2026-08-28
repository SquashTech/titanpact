// The healing formula (docs/combat.md "The healing formula",
// src/engine/heal/healPipeline.ts).
//
//   Heal = HealPower x WisdomMult x STAB
//
// The three things worth pinning down are the three that took a decision:
// healing scales with the CASTER (Wisdom + STAB, so the same move is worth
// different amounts in different hands), it does NOT scale with the target
// (no max-HP term — a heal buys turns, and % of max HP would make low-HP
// heroes un-healable), and it carries no variance.

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
import type { CombatState } from '../src/engine/state';
import {
  calcHeal,
  resolveHealFor,
  wisdomMultFromStat,
  HEAL_MULT_MAX,
  HEAL_MULT_MIN,
  HEAL_WISDOM_REFERENCE,
} from '../src/engine/heal/healPipeline';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Side A is the pair under test; side B is inert filler. */
function fixture(seed: number, a1: string, a2: string) {
  return createFightState(
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
}

function hurt(state: CombatState, ids: readonly string[], hp: number): CombatState {
  const combatants = { ...state.combatants };
  for (const id of ids) combatants[id] = { ...combatants[id], currentHp: hp };
  return { ...state, combatants };
}

function healedAmounts(events: readonly { type: string }[]): number[] {
  return events.filter((e): e is { type: 'Healed'; amount: number } => e.type === 'Healed').map((e) => e.amount);
}

// --- The Wisdom term ---------------------------------------------------------

test('heal: Wisdom at the reference heals exactly the authored HealPower', () => {
  assert.strictEqual(wisdomMultFromStat(HEAL_WISDOM_REFERENCE), 1);
  assert.strictEqual(calcHeal(40, 1, 1).heal, 40);
});

test('heal: every point of Wisdom off the reference is 1% — so +10 Wisdom is +10% healing', () => {
  assert.strictEqual(wisdomMultFromStat(60), 1.1);
  assert.strictEqual(wisdomMultFromStat(40), 0.9);
  assert.strictEqual(calcHeal(40, wisdomMultFromStat(60), 1).heal, 44);
});

test('heal: the Wisdom term clamps at both ends, so an unopposed stat can not run away', () => {
  assert.strictEqual(wisdomMultFromStat(500), HEAL_MULT_MAX);
  assert.strictEqual(wisdomMultFromStat(-100), HEAL_MULT_MIN);
});

// --- STAB --------------------------------------------------------------------

test('heal: a heal takes STAB off the caster, exactly as a damage move does', () => {
  // Revenant is Spirit and Mend Wounds is Spirit: 45 x 0.96 x 1.25.
  assert.strictEqual(resolveHealFor(moves.mendWounds, { wisdom: 46, types: ['Spirit'] }).stab, 1.25);
  assert.strictEqual(resolveHealFor(moves.mendWounds, { wisdom: 46, types: ['Spirit'] }).heal, 54);
  // Sylva is Nature — more Wisdom, no STAB, and ends up healing LESS.
  assert.strictEqual(resolveHealFor(moves.mendWounds, { wisdom: 60, types: ['Nature'] }).heal, 50);
});

// --- Through a real round ----------------------------------------------------

test('heal: the same move restores different amounts in different hands', () => {
  // Restore Vigor (Light, 40) on its caster. Solace is Light with 70 Wisdom;
  // Cinder is Fire/Iron with 40. Same move, same target, 24 HP apart.
  const solace = resolveRound(
    hurt(fixture(200, 'dawnwarden', 'ironWarden'), ['a1'], 10),
    [{ kind: 'move', combatantId: 'a1', moveId: 'restoreVigor' }] as Action[],
    config
  );
  const cinder = resolveRound(
    hurt(fixture(200, 'cinderKnight', 'ironWarden'), ['a1'], 10),
    [{ kind: 'move', combatantId: 'a1', moveId: 'restoreVigor' }] as Action[],
    config
  );

  assert.deepStrictEqual(healedAmounts(solace.events), [60]); // 40 x 1.20 x 1.25 STAB
  assert.deepStrictEqual(healedAmounts(cinder.events), [36]); // 40 x 0.90, no STAB
});

test('heal: the Healed event carries the formula terms, the way DamageDealt does', () => {
  const { events } = resolveRound(
    hurt(fixture(201, 'dawnwarden', 'ironWarden'), ['a1'], 10),
    [{ kind: 'move', combatantId: 'a1', moveId: 'restoreVigor' }] as Action[],
    config
  );
  const healed = events.find((e) => e.type === 'Healed');
  assert.ok(healed && healed.type === 'Healed');
  assert.strictEqual(healed.healPower, 40);
  assert.strictEqual(healed.wisdomMult, 1.2);
  assert.strictEqual(healed.stab, 1.25);
});

test('heal: NO max-HP term — one caster restores the same amount to a 135 HP wall and an 80 HP caster', () => {
  const onWall = resolveRound(
    hurt(fixture(202, 'revenant', 'ironWarden'), ['a2'], 10),
    [{ kind: 'move', combatantId: 'a1', moveId: 'mendWounds', declaredTarget: 'a2' }] as Action[],
    config
  );
  const onGlass = resolveRound(
    hurt(fixture(202, 'revenant', 'wildOracle'), ['a2'], 10),
    [{ kind: 'move', combatantId: 'a1', moveId: 'mendWounds', declaredTarget: 'a2' }] as Action[],
    config
  );

  assert.strictEqual(heroes.ironWarden.baseStats.hp, 135);
  assert.strictEqual(heroes.wildOracle.baseStats.hp, 80);
  assert.deepStrictEqual(healedAmounts(onWall.events), [54]);
  assert.deepStrictEqual(healedAmounts(onGlass.events), [54]);
});

test('heal: a bothAllies heal resolves once and pays every ally the same number', () => {
  // Healing Rain is Nature; Tidecaller is not, so this is the bare Wisdom term.
  const { events } = resolveRound(
    hurt(fixture(203, 'tidecaller', 'ironWarden'), ['a1', 'a2'], 10),
    [{ kind: 'move', combatantId: 'a1', moveId: 'healingRain' }] as Action[],
    config
  );
  assert.deepStrictEqual(healedAmounts(events), [25, 25]); // 28 x 0.90
});

test('heal: no variance — the same heal on two different seeds lands on the same number', () => {
  const cast = (seed: number) =>
    healedAmounts(
      resolveRound(
        hurt(fixture(seed, 'dawnwarden', 'ironWarden'), ['a1'], 10),
        [{ kind: 'move', combatantId: 'a1', moveId: 'restoreVigor' }] as Action[],
        config
      ).events
    );

  assert.deepStrictEqual(cast(1), cast(99999));
});

// --- Renew: the snapshot -----------------------------------------------------

test('heal: a HoT snapshots the caster Wisdom and STAB at application time', () => {
  // Second Wind grants Renew 20 and is Spirit. Revenant (Spirit, 46 Wisdom)
  // gets STAB on it; Sylva (Nature, 60 Wisdom) does not.
  // Read off the end-of-round tick rather than off the surviving magnitude:
  // Renew decays by halving the moment it ticks, so the stored number is
  // already half the snapshot by the time the round returns.
  const firstTick = (heroId: string) => {
    const { events } = resolveRound(
      hurt(fixture(204, heroId, 'ironWarden'), ['a1'], 10),
      [{ kind: 'move', combatantId: 'a1', moveId: 'secondWind' }] as Action[],
      config
    );
    const tick = events.find((e) => e.type === 'StatusTicked' && e.statusId === 'Renew');
    return tick && tick.type === 'StatusTicked' ? tick.amount : null;
  };

  assert.strictEqual(firstTick('revenant'), 24); // 20 x 0.96 x 1.25
  assert.strictEqual(firstTick('wildOracle'), 22); // 20 x 1.10, no STAB
});

test('heal: the snapshot is gated on the HoT pipeline — a DoT rider is not scaled by the caster Wisdom', () => {
  // Venomous Bite inflicts Poison 10. Sylva's 60 Wisdom must not touch it.
  const { state } = resolveRound(
    fixture(205, 'wildOracle', 'ironWarden'),
    [{ kind: 'move', combatantId: 'a1', moveId: 'venomousBite', declaredTarget: 'b1' }] as Action[],
    config
  );
  assert.strictEqual(state.combatants.b1.statuses.Poison.magnitude, 10);
});
