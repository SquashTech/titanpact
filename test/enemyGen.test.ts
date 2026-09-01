import * as assert from 'assert';
import { test } from './harness';
import { generateEncounter, generateGoblinChiefEncounter, appendFinalEnemy } from '../src/run/enemyGen';
import { heroes } from '../src/data/heroes';
import { enemies, basicGoblins, BASIC_GOBLIN_IDS, GOBLIN_CHIEF_ID, GOBLIN_LORD_ID } from '../src/data/enemies';

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

test('enemyGen: options.excludeHeroIds bars heroes already on the roster from spawning, over every seed', () => {
  const owned = Object.keys(heroes).slice(0, 6);
  for (let seed = 0; seed < 60; seed++) {
    const { run } = generateEncounter('fight', seed, heroes, { excludeHeroIds: owned });
    assert.strictEqual(run.roster.length, 4);
    for (const entry of run.roster) {
      assert.ok(!owned.includes(entry.heroId), `seed ${seed} spawned owned hero ${entry.heroId}`);
    }
  }
});

test('enemyGen: options.excludeHeroIds beats the location bias — the preferred stage cannot smuggle an owned hero in', () => {
  const affinity = Object.keys(heroes).slice(0, 8);
  const owned = affinity.slice(0, 4);
  for (let seed = 0; seed < 60; seed++) {
    const { run } = generateEncounter('fight', seed, heroes, {
      bias: { preferredIds: affinity, slots: 3 },
      excludeHeroIds: owned,
    });
    for (const entry of run.roster) {
      assert.ok(!owned.includes(entry.heroId), `seed ${seed} spawned owned hero ${entry.heroId}`);
    }
  }
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

// ── The Guardian's final enemy (appendFinalEnemy) ─────────────────────────
// The Goblin Lord at Wild's Edge (src/data/locations.ts
// `guardianFinalEnemyId`). What these pin is the one property the whole
// design rests on — he is LAST — plus the two ways the seam could quietly go
// wrong: an unknown id crashing a boss fight, and the champion leaking into
// the recruitable pool.

test('enemyGen: appendFinalEnemy puts the champion on the bench, behind everyone already in the fight', () => {
  const boss = generateEncounter('boss', 7, heroes);
  const { run, squad } = appendFinalEnemy(boss, GOBLIN_LORD_ID, enemies, 7);

  assert.strictEqual(run.roster.length, 3);
  // The boss's own pair is untouched — the champion reinforces, it does not
  // take a starting slot.
  assert.deepStrictEqual(squad.activeIds, boss.squad.activeIds);
  assert.deepStrictEqual(squad.benchIds, [GOBLIN_LORD_ID]);
  // Last in the bench order, which is what the AI's forced replacement reads
  // (FightScreen `resolveRoundWith` takes bench[0], and only once a slot has
  // actually opened) — so he cannot arrive before someone falls.
  assert.strictEqual(squad.benchIds[squad.benchIds.length - 1], GOBLIN_LORD_ID);
  assert.strictEqual(run.roster[run.roster.length - 1].heroId, GOBLIN_LORD_ID);
});

test('enemyGen: the appended champion arrives with its authored kit and no node-kind bonus', () => {
  const { run } = appendFinalEnemy(generateEncounter('boss', 3, heroes), GOBLIN_LORD_ID, enemies, 3);
  const lord = run.roster.find((r) => r.heroId === GOBLIN_LORD_ID)!;
  assert.deepStrictEqual(lord.unlockedMoveIds, [...enemies[GOBLIN_LORD_ID].moveIds]);
  // The boss's +20-to-3-stats is a bonus on the heroes the GENERATOR rolled.
  // This one is hand-authored content: its 600 stat total is the number, and
  // stacking a generated bonus on top would make it something else.
  assert.deepStrictEqual(lord.evolutionStatGrants, {});
});

test('enemyGen: appendFinalEnemy is a no-op on an unknown id rather than a crashed boss fight', () => {
  const boss = generateEncounter('boss', 5, heroes);
  const after = appendFinalEnemy(boss, 'noSuchChampion', enemies, 5);
  assert.deepStrictEqual(after.run.roster, boss.run.roster);
  assert.deepStrictEqual(after.squad, boss.squad);
});

test('enemyGen: the champion is not recruitable — he is enemy-pool content, so a Contract can never claim him', () => {
  const { isRecruitable } = require('../src/run/recruitment') as typeof import('../src/run/recruitment');
  assert.ok(!isRecruitable(GOBLIN_LORD_ID, heroes));
  // And he is never randomly drawn either: not a basic Goblin, and not in the
  // recruitable pool the boss's own cast comes from.
  assert.ok(!BASIC_GOBLIN_IDS.includes(GOBLIN_LORD_ID as (typeof BASIC_GOBLIN_IDS)[number]));
  assert.ok(!(GOBLIN_LORD_ID in heroes));
});
