// The simplified Evolution (docs/evolution-simplification.md): a path pays exactly two of a type,
// a move and a passive, never a stat line, and a hero's three paths are the three pairs. Pinned
// for the heroes converted so far; the list grows until it is the roster.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { spawnSlate } from '../src/data/titanspawn';
import { atEvolution, chooseEvolutionPath, levelMovePool, type EvolutionPath } from '../src/run/progression';
import { entryGradesFor, gradesFor, grantXp } from '../src/run/growth';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';

const SIMPLIFIED = ['cinderKnight'];
/** The rewire is rare by rule — a new holder is a decision, not a habit. */
const REWIRES = ['cinderKnight-explosive'];

function pairOf(path: EvolutionPath): string {
  const parts = [
    path.typeGraft ? 'type' : null,
    path.unlocksMoveIds.length > 0 ? 'move' : null,
    (path.grantsPassiveIds ?? []).length > 0 ? 'passive' : null,
  ];
  return parts.filter(Boolean).join('+');
}

function seed(id: string): RunState {
  return addRosterEntry(createRunState(0), atEvolution(createRosterEntry(id, id, heroes[id].moveIds)));
}

test('evolution simplification: a converted hero offers the three pairs, one of each, and no stat line', () => {
  for (const heroId of SIMPLIFIED) {
    const paths = progressionTable.evolutions[heroId].flatMap((node) => node.paths);
    assert.deepStrictEqual(paths.map(pairOf).sort(), ['move+passive', 'type+move', 'type+passive'], heroId);
    for (const path of paths) {
      assert.deepStrictEqual(path.statGrants, {}, `${path.id} carries a stat line`);
      assert.ok(path.unlocksMoveIds.length <= 1, `${path.id} grants more than one move`);
      assert.ok((path.grantsPassiveIds ?? []).length <= 1, `${path.id} grants more than one passive`);
      assert.strictEqual(!!path.swapsOffense, REWIRES.includes(path.id), `${path.id} rewire is not on the pinned list`);
    }
  }
});

test('evolution simplification: a line is the rule, not a list — the new type\'s slate on the column the hero swings with', () => {
  for (const heroId of SIMPLIFIED) {
    const hero = heroes[heroId];
    const own = new Set([...hero.moveIds, ...progressionTable.moveTiers[heroId]]);
    for (const path of progressionTable.evolutions[heroId].flatMap((node) => node.paths)) {
      const lineType = path.typeGraft ?? (path.swapsOffense ? hero.types[0] : null);
      if (!lineType) continue;
      const physical = hero.baseStats.attack >= hero.baseStats.intelligence !== !!path.swapsOffense;
      const expected = spawnSlate(lineType).filter(
        (id) =>
          !own.has(id) &&
          !path.unlocksMoveIds.includes(id) &&
          (moves[id].kind !== 'damage' || moves[id].category === (physical ? 'physical' : 'magical'))
      );
      assert.deepStrictEqual([...(path.learnableMoveIds ?? [])], expected, path.id);
      assert.ok(expected.length > 0, `${path.id} opens an empty line`);
    }
  }
});

test('evolution simplification: the rewire trades Attack and Intelligence — base, growth and every later grade — and never the gear', () => {
  const hero = heroes.cinderKnight;
  let run = seed('cinderKnight');
  run = { ...run, roster: [grantXp(run.roster[0], hero, 20_000, () => 0.3).entry] };
  const before = run.roster[0];
  const atk = hero.baseStats.attack + (before.growthStatGrants.attack ?? 0);
  const int = hero.baseStats.intelligence + (before.growthStatGrants.intelligence ?? 0);

  run = chooseEvolutionPath(run, progressionTable, heroes, 'cinderKnight', 'cinderKnight-explosive');
  const after = run.roster[0];
  assert.ok(after.offenseSwapped);
  assert.strictEqual(hero.baseStats.attack + (after.growthStatGrants.attack ?? 0) + (after.evolutionStatGrants.attack ?? 0), int);
  assert.strictEqual(hero.baseStats.intelligence + (after.growthStatGrants.intelligence ?? 0) + (after.evolutionStatGrants.intelligence ?? 0), atk);
  assert.ok(after.unlockedMoveIds.includes('immolate'), 'below the cap, the move lands');
  assert.deepStrictEqual(after.evolutionPassiveGrants, ['flashpoint']);

  const grades = entryGradesFor(hero, after);
  assert.strictEqual(grades.attack, gradesFor(hero).intelligence);
  assert.strictEqual(grades.intelligence, gradesFor(hero).attack);

  // Every later level rolls Intelligence on the grade Attack used to have.
  const levelled = grantXp(after, hero, 27_000 - after.xp, () => 0.05).gained;
  const unswapped = grantXp({ ...after, offenseSwapped: false }, hero, 27_000 - after.xp, () => 0.05).gained;
  assert.strictEqual(levelled.intelligence ?? 0, unswapped.attack ?? 0);
  assert.strictEqual(levelled.attack ?? 0, unswapped.intelligence ?? 0);
});

test('evolution simplification: a grafted Cinder is offered its new type\'s line on the level-up roll', () => {
  let run = seed('cinderKnight');
  run = chooseEvolutionPath(run, progressionTable, heroes, 'cinderKnight', 'cinderKnight-thunderblaze');
  const entry = { ...run.roster[0], xp: 30 ** 3 };
  const pool = levelMovePool(progressionTable, moves, heroes.cinderKnight, entry);
  assert.ok(pool.some((id) => moves[id].type === 'Storm'), 'the Storm line joins the pool');
  assert.ok(!pool.includes('stormLash'), 'the granted move is not offered again');
});
