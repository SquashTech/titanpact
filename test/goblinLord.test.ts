// The Goblin Lord (src/data/enemies.ts) and Archon Blast (src/data/moves.ts): the decided numbers a
// balance pass could move without noticing. Bench placement and non-recruitability: enemyGen.test.ts.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { enemies, GOBLIN_LORD_ID } from '../src/data/enemies';
import { locations, ACT_ONE_LOCATION_ID } from '../src/data/locations';
import type { StatKey } from '../src/engine/content';

/** The game's stat-total convention (docs/run-loop.md "Measured baseline") — six combat stats, not mana or MP Regen. */
const COMBAT_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'];

test('goblinLord: the authored stat total is 600, on the same six stats the difficulty curve measures', () => {
  const lord = enemies[GOBLIN_LORD_ID];
  const total = COMBAT_STATS.reduce((sum, stat) => sum + lord.baseStats[stat], 0);
  assert.strictEqual(total, 600);
  // Mean Act 1 Guardian sits at 432, the Goblin Chief at 218.
  assert.ok(total > 432, 'the champion should out-stat the boss he reinforces');
});

test('goblinLord: every stat is a multiple of 5 — the locked authoring rule, not a coincidence', () => {
  const lord = enemies[GOBLIN_LORD_ID];
  for (const [stat, value] of Object.entries(lord.baseStats)) {
    assert.strictEqual(value % 5, 0, `${stat} = ${value} is not a multiple of 5 (CLAUDE.md "Stat modifiers")`);
  }
});

test('goblinLord: 20 MP Regen is the ceiling, and it is what makes the kit castable', () => {
  const lord = enemies[GOBLIN_LORD_ID];
  assert.strictEqual(lord.baseStats.mpRegen, 20);
  for (const other of Object.values(enemies)) {
    if (other.id === GOBLIN_LORD_ID) continue;
    assert.ok(other.baseStats.mpRegen <= 20, `${other.id} out-regens the champion`);
  }
  // He must never arrive and then Rest.
  const costs = lord.moveIds.map((id) => moves[id].manaCost);
  assert.ok(Math.min(...costs) <= lord.baseStats.mpRegen * 2, 'a full round of regen does not reach his cheapest move');
  assert.ok(lord.baseStats.manaPool >= Math.min(...costs) * 2, 'he cannot open with two moves');
});

test('goblinLord: the kit is four moves — the MOVE_CAP — spanning both damage pipelines', () => {
  const lord = enemies[GOBLIN_LORD_ID];
  assert.deepStrictEqual([...lord.moveIds], ['thrash', 'momentumSwing', 'enfeeble', 'archonBlast']);
  const categories = new Set(lord.moveIds.map((id) => moves[id].category));
  assert.ok(categories.has('physical') && categories.has('magical'));
  const kitTypes = new Set(lord.moveIds.map((id) => moves[id].type));
  for (const type of lord.types) assert.ok(kitTypes.has(type), `nothing in the kit gets STAB off ${type}`);
});

test('goblinLord: only the locations with an authored faction field a Guardian champion today', () => {
  assert.strictEqual(locations[ACT_ONE_LOCATION_ID].guardianFinalEnemyId, GOBLIN_LORD_ID);
  const withChampions = Object.values(locations).filter((l) => l.guardianFinalEnemyId !== null);
  assert.deepStrictEqual(withChampions.map((l) => l.id), [ACT_ONE_LOCATION_ID, 'blightedShrine', 'stormCoast']);
  // appendFinalEnemy no-ops on an unknown id, so a dangling id silently skips the entrance.
  for (const location of withChampions) assert.ok(location.guardianFinalEnemyId! in enemies);
});

test('archonBlast: 75 base power for 50 mana, magical, and the +20 Wisdom lands on the CASTER', () => {
  const move = moves.archonBlast;
  assert.strictEqual(move.type, 'Ancient');
  assert.strictEqual(move.category, 'magical');
  assert.strictEqual(move.kind, 'damage');
  assert.strictEqual(move.basePower, 75);
  assert.strictEqual(move.manaCost, 50);
  assert.deepStrictEqual(move.statDeltas, [{ stat: 'wisdom', amount: 20 }]);
  // Without statDeltaTarget the deltas follow the move's targets and hand the ENEMY the Wisdom.
  assert.strictEqual(move.statDeltaTarget, 'self');
});

test('archonBlast: stays untiered, because Ancient is still the one type with no authored slate', () => {
  assert.strictEqual(moves.archonBlast.tier, undefined);
  for (const move of Object.values(moves)) {
    if (move.type === 'Ancient') assert.strictEqual(move.tier, undefined, `${move.id} carries a tier`);
  }
});
