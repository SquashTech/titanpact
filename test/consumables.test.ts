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
  ConsumableError,
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
  assert.deepStrictEqual(spent.consumables, { hpPotion: 0, mpPotion: 1 });
  assert.throws(() => spendConsumables(run, { mpPotion: 2 }));
});

test('consumables: the drop roll pays one potion of an even kind at the node’s odds, and the finale pays none', () => {
  assert.strictEqual(rollConsumableDrop('fight', () => 0.99), null);
  assert.strictEqual(rollConsumableDrop('fight', () => 0), 'hpPotion');
  let second = 0;
  assert.strictEqual(rollConsumableDrop('elite', () => (second++ === 0 ? 0 : 0.7)), 'mpPotion');
  assert.strictEqual(rollConsumableDrop('finale', () => 0), null);
});
