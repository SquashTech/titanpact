// Spirit's authored slate (src/data/moves.ts, 2026-08-30) and the TWO engine
// fields it is the first content to need:
//
//   - `conditionalPower.requiresUserHpBelow` (Spite x2 at 50%, Vengeance x3 at
//     25%) — the fifth sibling on the same BasePower-stage multiplier, and the
//     exact mirror of Shadow's `requiresTargetHpBelow` across the field. It
//     was named in Shadow's hand-off as a shape deliberately left unbuilt;
//     this is what asked for it.
//   - `selfHpCost` (Soul Offering's 25% of max HP, Last Rites' drop to 1) —
//     the THIRD way a move can hurt its own caster, after Stone's
//     `recoilPercent` (a share of damage dealt) and Fire's self-inflicted
//     Burn, and the only one whose price is knowable before the button is
//     pressed.
//
// Both are pinned here for what would be invisible if it broke:
//
//   1. requiresUserHpBelow scales the formula's BasePower INPUT, never
//      `multiplierTerm` — the two-pipeline separation is LOCKED (CLAUDE.md).
//      fireMoves/natureMoves/lightMoves/shadowMoves each carry the equivalent.
//   2. It is asked ONCE PER CAST off a snapshot, unlike the target-side form
//      which is re-read per hit. That is what makes it all-or-nothing across a
//      spread — and on this type "spread" is not hypothetical, because Haunt
//      turns every single-target Spirit move into two hits.
//   3. selfHpCost is paid LAST, after the payload has landed, so Soul
//      Offering's +40/+40 reaches the ally even when the 25% kills the caster.
//   4. `percentMaxHp` CAN faint the user and has no floor (2026-08-30 designer
//      call); `reduceToHp` cannot faint anyone and never heals one already
//      lower.
//
// Plus the type's own shape, which is the thing no design row states: Haunt
// lists Spirit in `spreadTriggerTypes` (src/data/statuses.ts), so the slate's
// twelve single-target damage moves are twelve spread moves against a Haunted
// pair — and three of them plant the mark themselves. Storm's Conduct
// arrangement, except Spirit both plants and cashes with one kit.

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
import { resolveConditionalPowerMultiplier } from '../src/engine/damage/damagePipeline';
import { getMaxHp } from '../src/engine/state';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

/** Revenant (Int 77) attacks alongside Lucius; Warden and Sentinel defend. */
function spiritFixture(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'revenant', side: 'A' },
      { combatantId: 'a2', heroId: 'lucius', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'sentinel', side: 'B' },
    ]
  );
}

/**
 * The fixture problems every authored slate hits (authoring-moves.md §8),
 * solved once — plus the one this type adds.
 *
 * - **Mana.** Spirit tops out at 100 (Last Rites), above every hero's STARTING
 *   pool, which is the intended shape (docs/mana.md) rather than something
 *   these tests gate on.
 * - **Lethality.** A defender that faints to the hit never reaches the riders,
 *   and getMaxHp reads baseStats + statModifiers, so the hp modifier has to
 *   move with currentHp or the two disagree.
 * - **Spirit's own: the CASTER's HP is an input.** Every combatant starts at
 *   full here, which is what makes the "not below the line" control honest —
 *   and `wounded` below is how a test opts into being under it.
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

/** Puts one combatant at `fraction` of the max HP `withDeepPools` gave it. */
function wounded(state: CombatState, combatantId: string, fraction: number): CombatState {
  const c = state.combatants[combatantId];
  const maxHp = getMaxHp(heroes[c.heroId], c);
  return {
    ...state,
    combatants: { ...state.combatants, [combatantId]: { ...c, currentHp: Math.round(maxHp * fraction) } },
  } as CombatState;
}

/** Grants a status the way a resolved statusApplication would, without spending a round on the setter. */
function withStatus(state: CombatState, combatantId: string, statusId: string, instance: object): CombatState {
  const c = state.combatants[combatantId];
  return {
    ...state,
    combatants: {
      ...state.combatants,
      [combatantId]: { ...c, statuses: { ...c.statuses, [statusId]: { statusId, ...instance } } },
    },
  } as CombatState;
}

const hpOf = (s: CombatState, id: string) => s.combatants[id].currentHp;

// --- conditionalPower.requiresUserHpBelow: the condition is YOUR bar ---------

test('spirit: Spite doubles off the USER HP fraction, and reads nothing about the target', () => {
  const healthy = withDeepPools(spiritFixture(11));
  const attacker = healthy.combatants.a1;
  const maxHp = getMaxHp(heroes[attacker.heroId], attacker);
  const hp = (fraction: number) => ({ currentHp: Math.round(maxHp * fraction), maxHp });

  // The target is untouched in all three: this form asks about nobody but the
  // caster, which is the whole difference from Shadow's execute.
  const target = healthy.combatants.b1;
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.spite, target, attacker, undefined, maxHp, hp(0.9)), 1);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.spite, target, attacker, undefined, maxHp, hp(0.3)), 2);
  // Strictly below, matching the target-side form: exactly half is not yet it.
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.spite, target, attacker, undefined, maxHp, hp(0.5)), 1);
});

test('spirit: Vengeance draws the line at 25% and pays x3 — a number, not a second field', () => {
  // The reason requiresUserHpBelow is a fraction rather than a boolean: two
  // moves in one slate already want two different lines.
  const healthy = withDeepPools(spiritFixture(12));
  const attacker = healthy.combatants.a1;
  const maxHp = getMaxHp(heroes[attacker.heroId], attacker);
  const hp = (fraction: number) => ({ currentHp: Math.round(maxHp * fraction), maxHp });
  const target = healthy.combatants.b1;

  assert.strictEqual(resolveConditionalPowerMultiplier(moves.vengeance, target, attacker, undefined, maxHp, hp(0.3)), 1);
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.vengeance, target, attacker, undefined, maxHp, hp(0.2)), 3);
  // Spite is already live at 30%, so the two lines really are independent.
  assert.strictEqual(resolveConditionalPowerMultiplier(moves.spite, target, attacker, undefined, maxHp, hp(0.3)), 2);
});

test('spirit: with no user-HP context the multiplier reports 1 rather than throwing', () => {
  // The "omit it and everything else behaves exactly as before" discipline
  // fieldEffectCtx and targetMaxHp both follow — every caller with no hero
  // definition in scope keeps working.
  const state = withDeepPools(spiritFixture(13));
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.spite, state.combatants.b1, state.combatants.a1, undefined, undefined, undefined),
    1
  );
});

test('spirit: the user-HP multiplier lands on BasePower, never on multiplierTerm', () => {
  // The LOCKED two-pipeline separation (CLAUDE.md). A BasePower-stage term
  // changes the formula's INPUT; a DamageModifier scales the RESULT. If this
  // ever leaks into multiplierTerm it stacks differently with relics and
  // nothing else would notice.
  const state = wounded(withDeepPools(spiritFixture(14)), 'a1', 0.3);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'spite', declaredTarget: 'b1' }];
  const { events } = resolveRound(state, actions, config);

  const hit = events.find((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'b1');
  assert.ok(hit && hit.type === 'DamageDealt');
  assert.strictEqual(hit.basePowerMultiplier, 2);
  assert.strictEqual(hit.multiplierTerm, 1);
  assert.strictEqual(hit.basePower, moves.spite.basePower);
});

test('spirit: the user-HP form is asked ONCE PER CAST — a Haunted pair is doubled on both hits or neither', () => {
  // The behavioural difference from Shadow's execute, and on this type it is
  // not hypothetical: Haunt (statuses.ts spreadTriggerTypes) makes every
  // singleEnemy Spirit move a two-hit cast, so "per target vs per cast" is a
  // question Spirit's own content asks constantly.
  const wounded30 = wounded(withDeepPools(spiritFixture(15)), 'a1', 0.3);
  const haunted = withStatus(wounded30, 'b2', 'Haunt', {});
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'spite', declaredTarget: 'b1' }];
  const { events } = resolveRound(haunted, actions, config);

  const hits = events.filter((e) => e.type === 'DamageDealt' && e.sourceCombatantId === 'a1');
  assert.strictEqual(hits.length, 2, 'Haunt should have spread this single-target move onto the partner');
  for (const hit of hits) {
    assert.ok(hit.type === 'DamageDealt');
    assert.strictEqual(hit.basePowerMultiplier, 2, 'every hit in one cast gets the same answer');
  }
});

test('spirit: consumesStatus is inert on the user-HP form — there is no status to strip', () => {
  // Same reason it is inert on requiresFieldEffect and requiresTargetHpBelow:
  // resolveRound's consume branch reads `requiresTargetStatus ??
  // requiresUserStatus`, which this form leaves undefined.
  for (const id of ['spite', 'vengeance']) {
    assert.strictEqual(moves[id].conditionalPower?.requiresTargetStatus, undefined);
    assert.strictEqual(moves[id].conditionalPower?.requiresUserStatus, undefined);
  }
  const state = wounded(withDeepPools(spiritFixture(16)), 'a1', 0.2);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'vengeance', declaredTarget: 'b1' }];
  const { events } = resolveRound(state, actions, config);
  assert.ok(!events.some((e) => e.type === 'StatusRemoved' && e.reason === 'consumed'));
});

// --- selfHpCost: the third way a move hurts its own caster -------------------

test('spirit: Soul Offering pays the ally FIRST and bills the caster after', () => {
  // The placement is the mechanic. If the 25% came off before the buff, a
  // caster the cost killed would never deliver it — which would make this a
  // gamble on surviving rather than the sacrifice the design row describes.
  const state = withDeepPools(spiritFixture(20));
  const before = hpOf(state, 'a1');
  const maxHp = getMaxHp(heroes.revenant, state.combatants.a1);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'soulOffering', declaredTarget: 'a2' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.strictEqual(next.combatants.a2.statModifiers.intelligence, 40);
  assert.strictEqual(next.combatants.a2.statModifiers.attack, 40);
  assert.strictEqual(hpOf(next, 'a1'), before - Math.round(maxHp * 0.25));
  // Its own beat, with the authored bill on it rather than a share of a hit.
  const bill = events.find((e) => e.type === 'DamageDealt' && e.selfCost);
  assert.ok(bill && bill.type === 'DamageDealt');
  assert.deepStrictEqual(bill.selfCost, { mode: 'percentMaxHp', amount: 0.25 });
  assert.strictEqual(bill.sourceCombatantId, 'a1');
  assert.strictEqual(bill.targetCombatantId, 'a1');
});

test('spirit: Soul Offering can be pointed at the caster — ally modes include self', () => {
  // 2026-08-30 designer call, the same one Arcane's Font of Power got:
  // targeting.ts activeOf puts the caster in every ally mode, so paying 25% to
  // buff yourself is legal content rather than an oversight.
  const state = withDeepPools(spiritFixture(21));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'soulOffering', declaredTarget: 'a1' }];
  const { state: next } = resolveRound(state, actions, config);
  assert.strictEqual(next.combatants.a1.statModifiers.intelligence, 40);
  assert.strictEqual(next.combatants.a1.statModifiers.attack, 40);
});

test('spirit: a percentMaxHp cost has NO floor — it can faint its own caster, and the buff still lands', () => {
  // The explicit designer call (2026-08-30), and the same answer recoilPercent
  // got. Both halves matter: the KO is real, AND the ally keeps the buff,
  // which is what makes the move worth pressing at 10% HP.
  const state = wounded(withDeepPools(spiritFixture(22)), 'a1', 0.1);
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'soulOffering', declaredTarget: 'a2' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(next.combatants.a1.fainted, '25% of MAX HP should out-bill a caster sitting at 10%');
  assert.ok(events.some((e) => e.type === 'Fainted' && e.combatantId === 'a1'));
  assert.strictEqual(next.combatants.a2.statModifiers.intelligence, 40);
});

test('spirit: Last Rites deals its damage, then drops the caster to exactly 1 HP', () => {
  const state = withDeepPools(spiritFixture(23));
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'lastRites', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.ok(hpOf(next, 'b1') < getMaxHp(heroes.ironWarden, state.combatants.b1), 'the 120 BP body still landed');
  assert.strictEqual(hpOf(next, 'a1'), 1);
  assert.ok(!next.combatants.a1.fainted, 'reduceToHp cannot faint by construction');
  const bill = events.find((e) => e.type === 'DamageDealt' && e.selfCost);
  assert.ok(bill && bill.type === 'DamageDealt');
  assert.deepStrictEqual(bill.selfCost, { mode: 'reduceToHp', amount: 1 });
});

test('spirit: reduceToHp never HEALS — a caster already at 1 pays nothing and gets no event', () => {
  // The one thing that would be wrong to guess at: `min(currentHp, amount)`
  // rather than an assignment. A Last Rites that topped a dying hero back up
  // to 1 would be a heal move with 120 base power.
  const base = withDeepPools(spiritFixture(24));
  const state = {
    ...base,
    combatants: { ...base.combatants, a1: { ...base.combatants.a1, currentHp: 1 } },
  } as CombatState;
  const actions: Action[] = [{ kind: 'move', combatantId: 'a1', moveId: 'lastRites', declaredTarget: 'b1' }];
  const { state: next, events } = resolveRound(state, actions, config);

  assert.strictEqual(hpOf(next, 'a1'), 1);
  assert.ok(!events.some((e) => e.type === 'DamageDealt' && e.selfCost), 'a zero bill emits no beat at all');
});

test('spirit: Last Rites hands the survivor straight to Vengeance', () => {
  // The two fields the slate added, composing — and the reason they are in one
  // slate. 1 HP is under 25% of anything, so the round after Last Rites is the
  // round Vengeance is worth x3.
  const state = withDeepPools(spiritFixture(25));
  const afterRites = resolveRound(
    state,
    [{ kind: 'move', combatantId: 'a1', moveId: 'lastRites', declaredTarget: 'b1' }] as Action[],
    config
  ).state;

  const attacker = afterRites.combatants.a1;
  const maxHp = getMaxHp(heroes.revenant, attacker);
  assert.strictEqual(
    resolveConditionalPowerMultiplier(moves.vengeance, afterRites.combatants.b1, attacker, undefined, maxHp, {
      currentHp: attacker.currentHp,
      maxHp,
    }),
    3
  );
});

test('spirit: no move authors a selfHpCost the engine cannot price', () => {
  // There is still no isValidMoveDefinition (authoring-moves.md §4), and both
  // modes have a range outside which they are nonsense: a percentMaxHp over 1
  // bills more than the bar holds, and a reduceToHp of 0 is a suicide move
  // wearing a cost's clothes.
  for (const move of Object.values(moves)) {
    if (!move.selfHpCost) continue;
    if (move.selfHpCost.mode === 'percentMaxHp') {
      assert.ok(move.selfHpCost.amount > 0 && move.selfHpCost.amount <= 1, `${move.id} bills an impossible fraction`);
    } else {
      assert.ok(move.selfHpCost.amount >= 1, `${move.id} would reduce its caster to ${move.selfHpCost.amount} HP`);
    }
  }
});

// --- The hook the design table never mentions -------------------------------

test('spirit: every damage move in the slate is single-target, and Haunt is what makes them spread', () => {
  // The type's whole engine, invisible in the design table (authoring-moves.md
  // §10). Pinned as a COUNT so it cannot drift: a Spirit slate that quietly
  // authored a bothEnemies move would be paying twice for the same reach.
  const spirit = Object.values(moves).filter((m) => m.type === 'Spirit');
  const damage = spirit.filter((m) => m.kind === 'damage');
  assert.strictEqual(spirit.length, 17);
  assert.strictEqual(damage.length, 12);
  for (const move of damage) {
    assert.strictEqual(move.target, 'singleEnemy', `${move.id} is a spread move in a slate that has none`);
  }
  assert.ok(statuses.Haunt.spreadTriggerTypes?.includes('Spirit'));
});

test('spirit: three moves plant Haunt and all twelve damage moves cash it in', () => {
  const planters = Object.values(moves)
    .filter((m) => m.type === 'Spirit' && firstStatusApplication(m)?.statusId === 'Haunt')
    .map((m) => m.id)
    .sort();
  assert.deepStrictEqual(planters, ['poltergeist', 'torment', 'wisp']);
  // Exactly one of the three is a roll, which is what separates the 20-mana
  // opener from the 25-mana guarantee.
  assert.strictEqual(firstStatusApplication(moves.wisp)?.chance, 0.2);
  assert.strictEqual(firstStatusApplication(moves.torment)?.chance, undefined);
  assert.strictEqual(firstStatusApplication(moves.poltergeist)?.chance, undefined);
});

test('spirit: Flicker is the slate only bracket play — everything else resolves at priority 0', () => {
  // The type's ONE answer to a Speed disadvantage, and it matters more here
  // than on any other type: Spite and Vengeance both want the caster still
  // standing at low HP, so acting first is the difference between cashing them
  // in and dying holding them.
  const bracketed = Object.values(moves).filter((m) => m.type === 'Spirit' && (m.priority ?? 0) !== 0);
  assert.deepStrictEqual(bracketed.map((m) => m.id), ['flicker']);
  assert.strictEqual(moves.flicker.priority, 1);
});

test('spirit: the slate authors no heal-kind move and no cleanse', () => {
  // Named rather than patched (authoring-moves.md §6). Spirit reads as the
  // game's healer and can no longer put HP on an ALLY at all — Drain and Soul
  // Rend return a share of a hit to the CASTER, and Second Wind is a HoT on
  // itself. This is what deleting Mend Wounds cost, and it is deliberate.
  const spirit = Object.values(moves).filter((m) => m.type === 'Spirit');
  assert.ok(!spirit.some((m) => m.kind === 'heal'));
  assert.ok(!spirit.some((m) => m.cleanses));
  assert.deepStrictEqual(
    spirit.filter((m) => m.drainPercent).map((m) => m.id).sort(),
    ['drain', 'soulRend']
  );
});

// --- Distribution -----------------------------------------------------------

test('spirit: every move id a hero or level-up pool points at actually exists', () => {
  // The dangling-id half. Nothing else catches it — the run layer only looks a
  // move up when the hero is offered it, which can be several fights in.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) assert.ok(moves[moveId], `${heroId}'s kit points at missing move ${moveId}`);
  }
  for (const [heroId, pool] of Object.entries(progressionTable.moveTiers)) {
    for (const moveId of pool) assert.ok(moves[moveId], `${heroId}'s level-up pool points at missing move ${moveId}`);
  }
});

test('spirit: no hero or enemy starts with a move it cannot pay for, or has a starter in its own pool', () => {
  // The affordability check that IS a finding (authoring-moves.md §8): a
  // starting kit is the one thing a player cannot fix by drafting, and an
  // enemy's pool is fixed for the whole game — no relics, no equipment, no
  // Evolution. This is what raised Spooky Goblin from 30/4 to 40/10.
  //
  // Deliberately widened past Spirit holders: Second Wind is re-priced by this
  // slate from 15 to 30 and sits in SIX non-Spirit starting kits, so the check
  // that matters most here is on heroes that have nothing to do with the type.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  for (const [heroId, hero] of Object.entries({ ...heroes, ...enemies })) {
    for (const moveId of hero.moveIds) {
      assert.ok(
        moves[moveId].manaCost <= hero.baseStats.manaPool,
        `${heroId} cannot afford its own starting move ${moveId} (${moves[moveId].manaCost} vs ${hero.baseStats.manaPool})`
      );
    }
    for (const moveId of progressionTable.moveTiers[heroId] ?? []) {
      assert.ok(!hero.moveIds.includes(moveId), `${heroId}'s pool lists its own starting move ${moveId}`);
    }
  }
});

test('spirit: Revenant holds the magical line and Sorrow the physical one — split by pipeline, not by tier', () => {
  // The distribution pass as a roster audit (authoring-moves.md §7), and the
  // one type where it took two passes. Spirit was a roster of ONE when the
  // slate landed, so Revenant drew the whole magical half and the three
  // physical moves were named as orphans (test/stoneMoves.test.ts) rather than
  // stuffed into an Int-77 hero's pool. Sorrow (2026-09-01, Atk 80 / Spd 90)
  // is the second line the slate was always missing.
  //
  // What this pins is the SPLIT, in both directions: neither hero may reach
  // the other's pipeline. A Spirit move drifting into the wrong pool is the
  // trap pick the north star forbids, and it would be invisible — the move
  // works, it just lands for less than everything beside it.
  const { progressionTable } = require('../src/data/progression') as typeof import('../src/data/progression');
  const reachableBy = (heroId: string) => [
    ...heroes[heroId].moveIds,
    ...progressionTable.moveTiers[heroId],
  ];
  const revenant = reachableBy('revenant');
  const sorrow = reachableBy('sorrow');
  const spiritMoves = Object.values(moves).filter((m) => m.type === 'Spirit');

  for (const move of spiritMoves) {
    if (move.category === 'physical') {
      assert.ok(!revenant.includes(move.id), `${move.id} is physical and Revenant is Int 77 / Atk 56`);
      assert.ok(sorrow.includes(move.id), `${move.id} is physical Spirit and Sorrow does not reach it`);
    } else {
      assert.ok(revenant.includes(move.id), `${move.id} is magical Spirit and nothing points at it`);
    }
  }

  // The mirror the split rests on — if either hero's frame ever flips, the
  // pools above are pointing the wrong way round.
  assert.ok(heroes.revenant.baseStats.intelligence > heroes.revenant.baseStats.attack);
  assert.ok(heroes.sorrow.baseStats.attack > heroes.sorrow.baseStats.intelligence);

  // Sorrow takes NO magical damage move off the type. Soul Offering is the
  // deliberate exception and the only one: it is a buff, and it grants Attack
  // and Intelligence both, so it is the one Spirit support that does not care
  // which pipeline holds it.
  const magicalReached = spiritMoves.filter((m) => m.category === 'magical' && sorrow.includes(m.id));
  assert.deepStrictEqual(
    magicalReached.filter((m) => m.kind === 'damage').map((m) => m.id),
    [],
    'Sorrow is Int 45 — a magical Spirit attack in its pool is strictly worse than the physical row beside it'
  );
  assert.ok(magicalReached.every((m) => m.kind !== 'damage'));
});

test('spirit: Sorrow is a recruit-only mirror of Revenant, and its kit is all its own type', () => {
  // The two facts about this hero that live outside any move row, both easy to
  // break by a one-word edit and neither caught anywhere else.
  //
  // `starter: false` is load-bearing rather than cosmetic: it is the single
  // source of truth for the draft pool vs. the Guild Hall pool
  // (src/data/recruitment.ts derives its offers from it), so flipping it does
  // not add Sorrow to the draft — it silently REMOVES it from the Guild Hall.
  assert.strictEqual(heroes.sorrow.starter, false);
  assert.strictEqual(heroes.revenant.starter, true, 'Spirit keeps exactly one hero in the draft');

  // The kit rule is exactly three (heroes.ts header), and Sorrow is one of the
  // few heroes whose three are all its own type — the pitch is legible on turn
  // one only if Torment and the move it sets up are both in hand.
  assert.strictEqual(heroes.sorrow.moveIds.length, 3);
  for (const id of heroes.sorrow.moveIds) assert.strictEqual(moves[id].type, 'Spirit');
  assert.ok(
    firstStatusApplication(moves[heroes.sorrow.moveIds[1]])?.statusId === 'Haunt',
    'Sorrow starts able to plant the mark its own physical line cashes'
  );
});

test('spirit: the enemy side can demonstrate Haunt end to end', () => {
  // Nature, Arcane and Mind each shipped with zero enemies of their type, so
  // their signature status was something a player could only ever inflict.
  // Spooky Goblin plants the mark (Wisp) and cashes it (Drain, or Wisp again),
  // which makes Spirit the first authored type since Storm whose engine the
  // player can learn by having it used against them.
  const { enemies } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  const spookyGoblin = enemies.spookyGoblin;
  const kit = spookyGoblin.moveIds.map((id: string) => moves[id]);
  assert.ok(kit.some((m) => firstStatusApplication(m)?.statusId === 'Haunt'), 'no way to plant the mark');
  assert.ok(kit.some((m) => m.kind === 'damage' && m.type === 'Spirit'), 'no way to cash it in');
  // And it can actually afford to do both on its own pool, every other round.
  for (const move of kit) assert.ok(move.manaCost <= spookyGoblin.baseStats.manaPool);
});
