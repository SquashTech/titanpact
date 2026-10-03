// Gilded Mane (docs/wild-innates-and-events.md §2): Aurum's innate reads the run's purse as a stat.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { passives } from '../src/data/passives';
import { equipment } from '../src/data/equipment';
import { isValidPassiveDefinition } from '../src/engine/content';
import { passiveStatModifiers } from '../src/run/passives';
import { buildCombatState } from '../src/run/buildCombatState';
import { addRosterEntry, createRosterEntry, createRunState } from '../src/run/state';
import { getEffectiveStat } from '../src/engine/state';

test('gilded mane: +5 Attack and +5 Defense for every whole 50 gold — 49 is nothing, 149 is two', () => {
  const counts = { gildedMane: 1 };
  assert.deepStrictEqual(passiveStatModifiers(counts, passives, 0), {});
  assert.deepStrictEqual(passiveStatModifiers(counts, passives, 49), {});
  assert.deepStrictEqual(passiveStatModifiers(counts, passives, 149), { attack: 10, defense: 10 });
  assert.deepStrictEqual(passiveStatModifiers(counts, passives), {}, 'no purse, no grant');
});

test('gilded mane+: the mastered card pays the same grant at half the gold', () => {
  assert.deepStrictEqual(passiveStatModifiers({ gildedManeMastered: 1 }, passives, 100), { attack: 20, defense: 20 });
});

test("gilded mane: the fight build reads the side's purse — Aurum swings harder with gold in hand", () => {
  let run = createRunState(0);
  run = addRosterEntry(run, createRosterEntry('aurum', 'aurum', heroes.aurum.moveIds));
  const build = (gold: number | undefined) =>
    buildCombatState(1, heroes, equipment, [{ side: 'A', squad: { activeIds: ['aurum', null], benchIds: [] }, roster: run.roster, gold }], passives);
  const broke = build(undefined);
  const rich = build(200);
  const id = Object.keys(rich.combatants)[0];
  assert.strictEqual(getEffectiveStat(heroes.aurum, rich.combatants[id], 'attack') - getEffectiveStat(heroes.aurum, broke.combatants[id], 'attack'), 20);
  assert.strictEqual(getEffectiveStat(heroes.aurum, rich.combatants[id], 'defense') - getEffectiveStat(heroes.aurum, broke.combatants[id], 'defense'), 20);
});

test('gilded mane: the schema refuses a grant per zero gold or off the multiples of 5', () => {
  assert.ok(isValidPassiveDefinition(passives.gildedMane));
  assert.ok(!isValidPassiveDefinition({ id: 'x', name: 'x', description: 'x', goldStatGrants: { perGold: 0, statGrants: { attack: 5 } } }));
  assert.ok(!isValidPassiveDefinition({ id: 'x', name: 'x', description: 'x', goldStatGrants: { perGold: 50, statGrants: { attack: 3 } } }));
});
