import * as assert from 'assert';
import { test } from './harness';
import { createFightState, fixtureMaxHp } from './fixtures';
import { heroes } from '../src/data/heroes';
import { createCombatant, getMaxMana } from '../src/engine/state';
import type { CombatState } from '../src/engine/state';
import type { ConsumableUsedEvent } from '../src/engine/events';
import { CONSUMABLE_RESTORE_FRACTION, ConsumableUseError, consumableRefusal, useConsumable } from '../src/engine/combat/consumables';
import {
  CONSUMABLE_HOLD_CAP,
  CONSUMABLE_PRICE,
  REVIVE_PRICE,
  REVIVE_PURCHASE_LIMIT,
  ConsumableError,
  consumablePrice,
  STARTING_CONSUMABLES,
  buyConsumable,
  canBuyConsumable,
  grantConsumable,
  rollConsumableDrop,
  spendConsumables,
} from '../src/run/consumables';
import { createRunState } from '../src/run/state';

function fixture(seed = 1): CombatState {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
      { combatantId: 'a3', heroId: 'ironWarden', side: 'A' },
    ],
    [{ combatantId: 'b1', heroId: 'ironWarden', side: 'B' }]
  );
}

function fixtureMaxMana(heroId: string): number {
  return getMaxMana(heroes[heroId], createCombatant('probe', heroId, 'A', 0, 0));
}

const maxHpOf = (state: CombatState) => (id: string) => fixtureMaxHp(state.combatants[id].heroId);
const maxManaOf = (state: CombatState) => (id: string) => fixtureMaxMana(state.combatants[id].heroId);

function withHp(state: CombatState, id: string, currentHp: number): CombatState {
  return { ...state, combatants: { ...state.combatants, [id]: { ...state.combatants[id], currentHp } } };
}
function withMana(state: CombatState, id: string, currentMana: number): CombatState {
  return { ...state, combatants: { ...state.combatants, [id]: { ...state.combatants[id], currentMana } } };
}

// --- The engine half ---

test('consumables: an HP potion restores half of max HP, capped at max, with no faint and no formula', () => {
  const base = fixture();
  const maxHp = fixtureMaxHp('cinderKnight');
  const state = withHp(base, 'a1', 10);
  const result = useConsumable(state, 3, 'a1', 'hpPotion', maxHpOf(state), maxManaOf(state));
  const expected = Math.round(maxHp * CONSUMABLE_RESTORE_FRACTION);
  assert.strictEqual(result.state.combatants.a1.currentHp, 10 + expected);
  const used = result.events[0] as ConsumableUsedEvent;
  assert.strictEqual(used.type, 'ConsumableUsed');
  assert.strictEqual(used.kind, 'hpPotion');
  assert.strictEqual(used.amount, expected);
  assert.strictEqual(result.events[1].type, 'HpChanged');
  assert.ok(!result.events.some((e) => e.type === 'PassiveTriggered'), 'a potion is not a trigger source');

  // Near full: the restore is clipped and the event says what actually landed.
  const nearFull = withHp(base, 'a1', maxHp - 7);
  const clipped = useConsumable(nearFull, 3, 'a1', 'hpPotion', maxHpOf(nearFull), maxManaOf(nearFull));
  assert.strictEqual(clipped.state.combatants.a1.currentHp, maxHp);
  assert.strictEqual((clipped.events[0] as ConsumableUsedEvent).amount, 7);
});

test('consumables: an MP potion restores half of max Mana and never overflows the pool', () => {
  const base = fixture();
  const maxMana = fixtureMaxMana('tidecaller');
  const state = withMana(base, 'a2', 0);
  const result = useConsumable(state, 1, 'a2', 'mpPotion', maxHpOf(state), maxManaOf(state));
  assert.strictEqual(result.state.combatants.a2.currentMana, Math.round(maxMana * CONSUMABLE_RESTORE_FRACTION));
  assert.strictEqual(result.events[1].type, 'ManaChanged');

  const nearFull = withMana(base, 'a2', maxMana - 3);
  const clipped = useConsumable(nearFull, 1, 'a2', 'mpPotion', maxHpOf(nearFull), maxManaOf(nearFull));
  assert.strictEqual(clipped.state.combatants.a2.currentMana, maxMana, 'a restore caps at the pool');
  assert.strictEqual((clipped.events[0] as ConsumableUsedEvent).amount, 3);

  // Overflow reads as full: a potion never stacks on a grant.
  const over = withMana(base, 'a2', maxMana + 20);
  assert.strictEqual(consumableRefusal(over, 'a2', 'mpPotion', maxHpOf(over), maxManaOf(over)), 'Full Mana');
});

test('consumables: refused for a full, benched or fainted hero, and the refusal throws rather than spending', () => {
  const state = fixture();
  assert.strictEqual(consumableRefusal(state, 'a1', 'hpPotion', maxHpOf(state), maxManaOf(state)), 'Full HP');
  const benched = withHp(state, 'a3', 5);
  assert.strictEqual(consumableRefusal(benched, 'a3', 'hpPotion', maxHpOf(benched), maxManaOf(benched)), 'Not on the field');
  const down = { ...state, combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 0, fainted: true } } };
  assert.strictEqual(consumableRefusal(down, 'a1', 'hpPotion', maxHpOf(down), maxManaOf(down)), 'Down');
  assert.throws(() => useConsumable(state, 1, 'a1', 'hpPotion', maxHpOf(state), maxManaOf(state)), ConsumableUseError);
  const hurt = withHp(state, 'a1', 1);
  assert.strictEqual(consumableRefusal(hurt, 'a1', 'hpPotion', maxHpOf(hurt), maxManaOf(hurt)), null);
});

test('consumables: a Revive in a fight stands a fallen hero onto the bench at half, eases lock-in, and is refused for anyone standing', () => {
  const state = fixture();
  // a1 fell on the field: off both lists, the slot open, the side's KO counted.
  const down: CombatState = {
    ...state,
    combatants: { ...state.combatants, a1: { ...state.combatants.a1, currentHp: 0, fainted: true, statModifiers: { attack: -10 } } },
    active: { ...state.active, A: [null, state.active.A[1]] },
    koCount: { ...state.koCount, A: 1 },
  };
  assert.strictEqual(consumableRefusal(down, 'a1', 'revive', maxHpOf(down), maxManaOf(down)), null);
  assert.strictEqual(consumableRefusal(down, 'a2', 'revive', maxHpOf(down), maxManaOf(down)), 'Standing');
  assert.strictEqual(consumableRefusal(down, 'a3', 'revive', maxHpOf(down), maxManaOf(down)), 'Standing', 'the bench is standing too');
  assert.throws(() => useConsumable(down, 2, 'a2', 'revive', maxHpOf(down), maxManaOf(down)), ConsumableUseError);

  const { state: up, events } = useConsumable(down, 2, 'a1', 'revive', maxHpOf(down), maxManaOf(down));
  const max = fixtureMaxHp('cinderKnight');
  assert.strictEqual(up.combatants.a1.fainted, false);
  assert.strictEqual(up.combatants.a1.currentHp, Math.round(max * CONSUMABLE_RESTORE_FRACTION), 'half, flat');
  assert.deepStrictEqual(up.bench.A, ['a3', 'a1'], 'onto the bench, at the back');
  assert.deepStrictEqual(up.active.A, [null, 'a2'], 'the open slot is the replacement panel’s to fill, not the Revive’s');
  assert.strictEqual(up.koCount.A, 0, 'no longer down, so no longer counted against lock-in');
  assert.deepStrictEqual(up.combatants.a1.statModifiers, { attack: -10 }, 'a KO cleared nothing, and neither does standing up');
  const used = events[0] as ConsumableUsedEvent;
  assert.strictEqual(used.type, 'ConsumableUsed');
  assert.strictEqual(used.kind, 'revive');
  assert.strictEqual(used.amount, up.combatants.a1.currentHp);
  assert.ok(events.some((e) => e.type === 'HpChanged' && e.combatantId === 'a1'), 'the restore is an ordinary HpChanged');
  assert.ok(!events.some((e) => e.type === 'Fainted'));
});

test('consumables: the shelf sells a Revive steep, one a visit, never past the cap, and the potions are untouched by the visit count', () => {
  assert.ok(REVIVE_PRICE >= 2 * CONSUMABLE_PRICE, 'steep: it is a KO undone in the pocket, not a potion');
  assert.strictEqual(consumablePrice('revive'), REVIVE_PRICE);
  assert.strictEqual(consumablePrice('hpPotion'), CONSUMABLE_PRICE);
  let run = createRunState(REVIVE_PRICE * 2);
  assert.ok(canBuyConsumable(run, 'revive', 0));
  run = buyConsumable(run, 'revive', 0);
  assert.strictEqual(run.consumables.revive, 1);
  assert.strictEqual(run.gold, REVIVE_PRICE);
  assert.ok(!canBuyConsumable(run, 'revive', REVIVE_PURCHASE_LIMIT), 'one a visit');
  assert.throws(() => buyConsumable(run, 'revive', REVIVE_PURCHASE_LIMIT), ConsumableError);
  assert.ok(canBuyConsumable(run, 'hpPotion', REVIVE_PURCHASE_LIMIT), 'the visit count is the Revive’s alone');
  assert.ok(!canBuyConsumable({ ...run, gold: REVIVE_PRICE - 1 }, 'revive', 0));
  const full = { ...run, consumables: { ...run.consumables, revive: CONSUMABLE_HOLD_CAP } };
  assert.ok(!canBuyConsumable(full, 'revive', 0));
  assert.throws(() => buyConsumable(full, 'revive', 0), ConsumableError);
});

// --- The run half ---

test('consumables: a run opens with one of each, the purse caps per kind, and an over-cap grant is lost', () => {
  const run = createRunState(100);
  assert.deepStrictEqual(run.consumables, STARTING_CONSUMABLES);
  const full = grantConsumable(run, 'hpPotion', 10);
  assert.strictEqual(full.consumables.hpPotion, CONSUMABLE_HOLD_CAP);
  assert.strictEqual(full.consumables.mpPotion, 1, 'the other kind is untouched');
});

test('consumables: the shelf sells at the flat price, refuses at the cap and refuses without the gold', () => {
  let run = createRunState(CONSUMABLE_PRICE * 2 + 5);
  assert.ok(canBuyConsumable(run, 'mpPotion'));
  run = buyConsumable(run, 'mpPotion');
  assert.strictEqual(run.consumables.mpPotion, 2);
  assert.strictEqual(run.gold, CONSUMABLE_PRICE + 5);
  run = buyConsumable(run, 'mpPotion');
  assert.strictEqual(run.consumables.mpPotion, CONSUMABLE_HOLD_CAP);
  assert.ok(!canBuyConsumable(run, 'mpPotion'), 'at the cap');
  assert.throws(() => buyConsumable(run, 'mpPotion'), ConsumableError);
  assert.ok(!canBuyConsumable(run, 'hpPotion'), `${run.gold} gold buys nothing at ${CONSUMABLE_PRICE}`);
  assert.throws(() => buyConsumable(run, 'hpPotion'), ConsumableError);
});

test('consumables: a fight’s use comes off the purse at resolve, and cannot spend more than was held', () => {
  const run = createRunState();
  const spent = spendConsumables(run, { hpPotion: 1 });
  assert.deepStrictEqual(spent.consumables, { hpPotion: 0, mpPotion: 1, revive: 0 });
  assert.throws(() => spendConsumables(run, { mpPotion: 2 }));
});

test('consumables: the drop roll pays one potion of an even kind at the node’s odds, and the finale pays none', () => {
  assert.strictEqual(rollConsumableDrop('fight', () => 0.99), null);
  assert.strictEqual(rollConsumableDrop('fight', () => 0), 'hpPotion');
  let second = 0;
  assert.strictEqual(rollConsumableDrop('elite', () => (second++ === 0 ? 0 : 0.7)), 'mpPotion');
  assert.strictEqual(rollConsumableDrop('finale', () => 0), null);
});
