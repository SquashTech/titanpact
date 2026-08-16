import * as assert from 'assert';
import { test } from './harness';
import { generateEncounter } from '../src/run/enemyGen';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';

test('enemyGen: fight encounters field 4 heroes (2 active + 2 bench) with no stat bonus', () => {
  const { run, squad } = generateEncounter('fight', 1, heroes);
  assert.strictEqual(run.roster.length, 4);
  assert.strictEqual(squad.activeIds.filter(Boolean).length, 2);
  assert.strictEqual(squad.benchIds.length, 2);
  for (const entry of run.roster) assert.deepStrictEqual(entry.rankStatGrants, {});
});

test('enemyGen: elite encounters grant +10 to exactly 2 stats per hero', () => {
  const { run } = generateEncounter('elite', 1, heroes);
  assert.strictEqual(run.roster.length, 4);
  for (const entry of run.roster) {
    const grants = Object.values(entry.rankStatGrants);
    assert.strictEqual(grants.length, 2);
    assert.ok(grants.every((v) => v === 10));
  }
});

test('enemyGen: boss encounters field 2 heroes with no bench and +20 to exactly 3 stats per hero', () => {
  const { run, squad } = generateEncounter('boss', 1, heroes);
  assert.strictEqual(run.roster.length, 2);
  assert.strictEqual(squad.activeIds.filter(Boolean).length, 2);
  assert.strictEqual(squad.benchIds.length, 0);
  for (const entry of run.roster) {
    const grants = Object.values(entry.rankStatGrants);
    assert.strictEqual(grants.length, 3);
    assert.ok(grants.every((v) => v === 20));
  }
});

test('enemyGen: the same seed produces the same encounter; a different seed can differ', () => {
  const a = generateEncounter('elite', 42, heroes);
  const b = generateEncounter('elite', 42, heroes);
  assert.deepStrictEqual(
    a.run.roster.map((r) => r.heroId),
    b.run.roster.map((r) => r.heroId)
  );

  const c = generateEncounter('elite', 43, heroes);
  assert.notStrictEqual(JSON.stringify(a.run.roster), JSON.stringify(c.run.roster));
});

test('enemyGen: picked heroIds are distinct and drawn from the given pool', () => {
  const { run } = generateEncounter('fight', 5, heroes);
  const heroIds = run.roster.map((r) => r.heroId);
  assert.strictEqual(new Set(heroIds).size, heroIds.length);
  for (const id of heroIds) assert.ok(heroes[id], `${id} is not in the fixture hero pool`);
});

test('enemyGen: is generic over any HeroDefinition-shaped pool, gracefully capping a fight encounter to the enemy pool\'s size (docs/run-loop.md "Non-recruitable enemy content")', () => {
  const { run, squad } = generateEncounter('fight', 1, enemies);
  assert.strictEqual(run.roster.length, Object.keys(enemies).length);
  assert.strictEqual(squad.activeIds.filter(Boolean).length, 2);
  assert.strictEqual(squad.benchIds.length, 0);
  for (const entry of run.roster) assert.ok(enemies[entry.heroId], `${entry.heroId} is not in the enemy pool`);
});
