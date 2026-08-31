import * as assert from 'assert';
import { test } from './harness';
import { generateEncounter, generateGoblinChiefEncounter } from '../src/run/enemyGen';
import { heroes } from '../src/data/heroes';
import { enemies, basicGoblins, BASIC_GOBLIN_IDS, GOBLIN_CHIEF_ID } from '../src/data/enemies';

test('enemyGen: fight encounters field 4 heroes (2 active + 2 bench) with no stat bonus', () => {
  const { run, squad } = generateEncounter('fight', 1, heroes);
  assert.strictEqual(run.roster.length, 4);
  assert.strictEqual(squad.activeIds.filter(Boolean).length, 2);
  assert.strictEqual(squad.benchIds.length, 2);
  for (const entry of run.roster) assert.deepStrictEqual(entry.evolutionStatGrants, {});
});

test('enemyGen: elite encounters grant +10 to exactly 2 stats per hero', () => {
  const { run } = generateEncounter('elite', 1, heroes);
  assert.strictEqual(run.roster.length, 4);
  for (const entry of run.roster) {
    const grants = Object.values(entry.evolutionStatGrants);
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
    const grants = Object.values(entry.evolutionStatGrants);
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

test('enemyGen: options.heroCount shrinks a fight encounter below the default 4 (the run\'s 2nd-fight 2v2 breather)', () => {
  const { run, squad } = generateEncounter('fight', 1, heroes, { heroCount: 2 });
  assert.strictEqual(run.roster.length, 2);
  assert.strictEqual(squad.activeIds.filter(Boolean).length, 2);
  assert.strictEqual(squad.benchIds.length, 0);
});

test('enemyGen: is generic over any HeroDefinition-shaped pool, gracefully capping a fight encounter to the pool\'s size (docs/run-loop.md "Non-recruitable enemy content")', () => {
  // A pool smaller than the default heroCount of 4 — enemies.ts itself has
  // grown past 4 entries, so this test builds its own undersized pool to
  // keep exercising the cap rather than relying on enemies.ts staying small.
  const smallPool = Object.fromEntries(Object.entries(enemies).slice(0, 2));
  const { run, squad } = generateEncounter('fight', 1, smallPool);
  assert.strictEqual(run.roster.length, Object.keys(smallPool).length);
  assert.strictEqual(squad.activeIds.filter(Boolean).length, 2);
  assert.strictEqual(squad.benchIds.length, 0);
  for (const entry of run.roster) assert.ok(smallPool[entry.heroId], `${entry.heroId} is not in the enemy pool`);
});

test('enemyGen: the opening (row 0) fight draws exactly 2 random heroes from the basic-Goblin pool, never the Chief', () => {
  const { run, squad } = generateEncounter('fight', 7, basicGoblins, { heroCount: 2 });
  assert.strictEqual(run.roster.length, 2);
  assert.strictEqual(squad.activeIds.filter(Boolean).length, 2);
  assert.strictEqual(squad.benchIds.length, 0);
  for (const entry of run.roster) {
    assert.ok(BASIC_GOBLIN_IDS.includes(entry.heroId as (typeof BASIC_GOBLIN_IDS)[number]));
    assert.notStrictEqual(entry.heroId, GOBLIN_CHIEF_ID);
  }
});

test('enemyGen: generateGoblinChiefEncounter always fields the Chief plus 3 distinct random basic Goblins', () => {
  const { run, squad } = generateGoblinChiefEncounter(11, BASIC_GOBLIN_IDS, GOBLIN_CHIEF_ID, enemies);
  assert.strictEqual(run.roster.length, 4);
  assert.strictEqual(squad.activeIds.filter(Boolean).length, 2);
  assert.strictEqual(squad.benchIds.length, 2);
  const heroIds = run.roster.map((r) => r.heroId);
  assert.strictEqual(heroIds[0], GOBLIN_CHIEF_ID);
  assert.strictEqual(new Set(heroIds).size, 4);
  for (const id of heroIds.slice(1)) assert.ok(BASIC_GOBLIN_IDS.includes(id as (typeof BASIC_GOBLIN_IDS)[number]));
});

test('enemyGen: generateGoblinChiefEncounter is deterministic for a given seed', () => {
  const a = generateGoblinChiefEncounter(99, BASIC_GOBLIN_IDS, GOBLIN_CHIEF_ID, enemies);
  const b = generateGoblinChiefEncounter(99, BASIC_GOBLIN_IDS, GOBLIN_CHIEF_ID, enemies);
  assert.deepStrictEqual(
    a.run.roster.map((r) => r.heroId),
    b.run.roster.map((r) => r.heroId)
  );
});
