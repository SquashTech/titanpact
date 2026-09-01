// The Goblin Lord (src/data/enemies.ts) and Archon Blast (src/data/moves.ts),
// added 2026-09-01 per user direction: a Beast/Ancient champion held on the
// bench of Wild's Edge's Guardian fight so he is the LAST enemy to reach the
// field, and the Ancient row authored for him.
//
// What is worth pinning here is not that the data exists — a typo in a stat
// line is caught by reading it. It is the handful of numbers that were
// DECIDED, and that a later balance pass could move without noticing what it
// was moving: the 600 stat total, the 20 MP Regen, and whether his kit is
// actually castable on the mana he was given. The wiring (bench placement,
// non-recruitability) lives in enemyGen.test.ts alongside the seam it tests.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { enemies, GOBLIN_LORD_ID } from '../src/data/enemies';
import { locations, ACT_ONE_LOCATION_ID } from '../src/data/locations';
import type { StatKey } from '../src/engine/content';

/** The game's own stat-total convention (docs/run-loop.md "Measured baseline") — the six combat stats, NOT mana or MP Regen. */
const COMBAT_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'];

test('goblinLord: the authored stat total is 600, on the same six stats the difficulty curve measures', () => {
  const lord = enemies[GOBLIN_LORD_ID];
  const total = COMBAT_STATS.reduce((sum, stat) => sum + lord.baseStats[stat], 0);
  assert.strictEqual(total, 600);
  // For scale, and so a later tuning pass sees what it is moving relative to:
  // the mean Act 1 Guardian sits at 432 and the Goblin Chief at 218.
  assert.ok(total > 432, 'the champion should out-stat the boss he reinforces');
});

test('goblinLord: every stat is a multiple of 5 — the locked authoring rule, not a coincidence', () => {
  const lord = enemies[GOBLIN_LORD_ID];
  for (const [stat, value] of Object.entries(lord.baseStats)) {
    assert.strictEqual(value % 5, 0, `${stat} = ${value} is not a multiple of 5 (CLAUDE.md "Stat modifiers")`);
  }
});

test('goblinLord: 20 MP Regen is the highest in the game, and it is what makes the kit castable', () => {
  const lord = enemies[GOBLIN_LORD_ID];
  assert.strictEqual(lord.baseStats.mpRegen, 20);
  for (const other of Object.values(enemies)) {
    if (other.id === GOBLIN_LORD_ID) continue;
    assert.ok(other.baseStats.mpRegen <= 20, `${other.id} out-regens the champion`);
  }
  // The point of the number: he must never be the boss's reinforcement that
  // arrives and then Rests. His cheapest move has to be affordable on one
  // round of regen alone, and his opening pool has to buy more than one cast.
  const costs = lord.moveIds.map((id) => moves[id].manaCost);
  assert.ok(Math.min(...costs) <= lord.baseStats.mpRegen * 2, 'a full round of regen does not reach his cheapest move');
  assert.ok(lord.baseStats.manaPool >= Math.min(...costs) * 2, 'he cannot open with two moves');
});

test('goblinLord: the kit is four moves — the MOVE_CAP — spanning both damage pipelines', () => {
  const lord = enemies[GOBLIN_LORD_ID];
  assert.deepStrictEqual([...lord.moveIds], ['thrash', 'momentumSwing', 'enfeeble', 'archonBlast']);
  const categories = new Set(lord.moveIds.map((id) => moves[id].category));
  // Both pipelines, so a squad that answered only one of them still has a
  // problem — which is the whole reason the stat line funds Attack AND
  // Intelligence rather than dumping everything into one.
  assert.ok(categories.has('physical') && categories.has('magical'));
  // Both of his types are represented, so neither half of Beast/Ancient is
  // decoration.
  const kitTypes = new Set(lord.moveIds.map((id) => moves[id].type));
  for (const type of lord.types) assert.ok(kitTypes.has(type), `nothing in the kit gets STAB off ${type}`);
});

test('goblinLord: Wild\'s Edge is the only location that fields a Guardian champion today', () => {
  assert.strictEqual(locations[ACT_ONE_LOCATION_ID].guardianFinalEnemyId, GOBLIN_LORD_ID);
  const withChampions = Object.values(locations).filter((l) => l.guardianFinalEnemyId !== null);
  assert.deepStrictEqual(withChampions.map((l) => l.id), [ACT_ONE_LOCATION_ID]);
  // Every id a location points at has to resolve, or the entrance silently
  // does not happen (appendFinalEnemy no-ops on an unknown id by design).
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
  // The half that is easy to lose in a refactor: without statDeltaTarget the
  // deltas follow the move's targets, and this move would hand the ENEMY 20
  // Wisdom on every cast — the exact inverse of what it is for.
  assert.strictEqual(move.statDeltaTarget, 'self');
});

test('archonBlast: stays untiered, because Ancient is still the one type with no authored slate', () => {
  // Enforced from the other side by moveTiers.test.ts's TIERED_TYPES. Repeated
  // here because this is the first Ancient row authored since that list was
  // written, and it is the obvious place to have added a tier out of habit.
  assert.strictEqual(moves.archonBlast.tier, undefined);
  for (const move of Object.values(moves)) {
    if (move.type === 'Ancient') assert.strictEqual(move.tier, undefined, `${move.id} carries a tier`);
  }
});
