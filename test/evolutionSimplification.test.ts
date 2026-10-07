// The simplified Evolution (docs/evolution-simplification.md): a path pays exactly two of a type,
// a move and a passive, never a stat line, and a hero's three paths are the three pairs. Every hero
// is on it (the roster pass landed 2026-09-29).

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { passives } from '../src/data/passives';
import { progressionTable } from '../src/data/progression';
import { spawnSlate } from '../src/data/titanspawn';
import { atEvolution, chooseEvolutionPath, levelMovePool, pendingSignature, type EvolutionPath } from '../src/run/progression';
import { rewiredSignatureId } from '../src/data/signatures';
import { equipment } from '../src/data/equipment';
import { constructedMovePool, withPath } from '../src/run/constructed';
import { entryGradesFor, gradesFor, grantXp } from '../src/run/growth';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';

/** The rewire is rare by rule: a new holder is a decision, not a habit. One a line. */
const REWIRES = [
  'cinderKnight-explosive',
  'hollowbark-wraithwood',
  'wildOracle-druid',
  'revenant-wraithblade',
  'sorrow-dirge',
  'nightshade-hemlock',
  'mindweaver-construct',
  'packAlpha-warhowl',
  'steamColossus-overpressure',
];

function pathsOf(heroId: string): EvolutionPath[] {
  return (progressionTable.evolutions[heroId] ?? []).flatMap((node) => node.paths);
}

const heroIds = Object.keys(heroes);

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

test('evolution simplification: every hero has one Evolution node of three paths', () => {
  for (const heroId of heroIds) assert.strictEqual(pathsOf(heroId).length, 3, heroId);
});

/**
 * The type audit (2026-10-07, per user direction) loosened "exactly two": a dual hero gains nothing
 * by a retype that also costs a type, so EVERY path of a converted dual pays a move and a passive,
 * and a few named paths carry more than a pair. Both lists are pinned so each addition is a decision.
 */
const DUALS_MOVE_AND_PASSIVE = ['brimstone'];
const BEYOND_THE_PAIR: Record<string, string> = {
  'crimson-pyroclasm': 'passive+passive',
  'ashwing-sunbird': 'type+move+passive',
  'brimstone-ashguard': 'type+move+passive',
  'brimstone-hexfume': 'type+move+passive',
};

function grantCount(path: EvolutionPath): number {
  return (path.typeGraft ? 1 : 0) + path.unlocksMoveIds.length + (path.grantsPassiveIds ?? []).length;
}

test('evolution simplification: past the pair only by name — every pinned path pays exactly what it is pinned to', () => {
  for (const heroId of heroIds) {
    for (const path of pathsOf(heroId)) {
      const pinned = BEYOND_THE_PAIR[path.id];
      if (!pinned) continue;
      const passives = (path.grantsPassiveIds ?? []).length;
      const shape = [path.typeGraft ? 'type' : null, path.unlocksMoveIds.length ? 'move' : null, ...Array(passives).fill('passive')].filter(Boolean).join('+');
      assert.strictEqual(shape, pinned, path.id);
    }
  }
  for (const heroId of DUALS_MOVE_AND_PASSIVE) {
    assert.strictEqual(heroes[heroId].types.length, 2, `${heroId} is not dual`);
    for (const path of pathsOf(heroId)) {
      assert.ok(path.unlocksMoveIds.length === 1 && (path.grantsPassiveIds ?? []).length === 1, `${path.id}: a dual pays a move and a passive on every path`);
    }
  }
});

test('evolution simplification: every hero offers the three pairs, one of each — one move, one passive, never a stat line', () => {
  for (const heroId of heroIds) {
    const paths = pathsOf(heroId);
    const pairsOnly = paths.every((path) => !BEYOND_THE_PAIR[path.id]);
    if (pairsOnly) assert.deepStrictEqual(paths.map(pairOf).sort(), ['move+passive', 'type+move', 'type+passive'], heroId);
    for (const path of paths) {
      assert.ok(grantCount(path) >= 2, `${path.id} grants fewer than two things`);
      if (!BEYOND_THE_PAIR[path.id]) assert.strictEqual(grantCount(path), 2, `${path.id} grants more than a pair and is not pinned`);
      assert.ok(path.unlocksMoveIds.length <= 1, `${path.id} grants more than one move`);
      for (const id of path.grantsPassiveIds ?? []) {
        const passive = passives[id];
        assert.ok(passive, `${path.id} grants unknown passive ${id}`);
        const verbs = Object.keys(passive).filter((key) => !['id', 'name', 'description', 'statGrants'].includes(key));
        assert.ok(verbs.length > 0, `${path.id}'s ${id} is a bare stat line`);
      }
      assert.strictEqual(!!path.swapsOffense, REWIRES.includes(path.id), `${path.id}: a rewire must be on the pinned list, and only a rewire`);
    }
    const grafts = paths.filter((path) => path.typeGraft).map((path) => path.typeGraft);
    assert.strictEqual(new Set(grafts).size, grafts.length, `${heroId}'s two type paths graft the same type`);
  }
});

test('evolution simplification: a line is the rule, not a list — a hit and a tool of the new type at Mid and at Late, on the column the hero swings with', () => {
  for (const heroId of heroIds) {
    const hero = heroes[heroId];
    const own = new Set([...hero.moveIds, ...(progressionTable.moveTiers[heroId] ?? [])]);
    for (const path of pathsOf(heroId)) {
      const lineType = path.typeGraft ?? (path.swapsOffense ? hero.types[0] : null);
      if (!lineType) {
        assert.ok(!path.learnableMoveIds?.length, `${path.id} keeps the typing and still opens a line`);
        continue;
      }
      const physical = hero.baseStats.attack >= hero.baseStats.intelligence !== !!path.swapsOffense;
      const open = spawnSlate(lineType).filter(
        (id) =>
          !own.has(id) &&
          !path.unlocksMoveIds.includes(id) &&
          (moves[id].kind !== 'damage' || moves[id].category === (physical ? 'physical' : 'magical'))
      );
      const line = [...(path.learnableMoveIds ?? [])];
      assert.ok(line.length > 0, `${path.id} opens an empty line`);
      for (const id of line) assert.ok(open.includes(id), `${path.id}: ${id} is not on the open slate`);
      assert.ok(line.every((id) => moves[id].tier === 'mid' || moves[id].tier === 'late'), `${path.id}: a line is Mid and Late only`);
      for (const tier of ['mid', 'late'] as const) {
        const inTier = open.filter((id) => moves[id].tier === tier);
        const taken = line.filter((id) => moves[id].tier === tier);
        // A rewire's own attacks are on the wrong stat, so it takes a second hit a tier where there is one.
        const hits = inTier.filter((id) => moves[id].kind === 'damage').length;
        const tools = inTier.length - hits;
        const expected = path.swapsOffense ? Math.max(Math.min(2, inTier.length), Math.min(2, hits) + Math.min(1, tools)) : Math.min(2, inTier.length);
        assert.strictEqual(taken.length, expected, `${path.id}: two ${tier} moves where the slate has them`);
        if (path.swapsOffense) assert.ok(taken.filter((id) => moves[id].kind === 'damage').length >= Math.min(2, hits), `${path.id}: a rewire takes two ${tier} hits`);
        if (inTier.some((id) => moves[id].kind === 'damage')) assert.ok(taken.some((id) => moves[id].kind === 'damage'), `${path.id}: a ${tier} hit`);
        if (inTier.some((id) => moves[id].kind !== 'damage')) assert.ok(taken.some((id) => moves[id].kind !== 'damage'), `${path.id}: a ${tier} tool`);
      }
    }
  }
});

test('evolution simplification: a dual hero retypes on both type paths, and the path that keeps its pairing grants a Late move of the type the others trade away', () => {
  for (const heroId of heroIds) {
    const hero = heroes[heroId];
    if (hero.types.length < 2) continue;
    const paths = pathsOf(heroId);
    for (const path of paths.filter((p) => p.typeGraft)) {
      assert.ok(!hero.types.includes(path.typeGraft!), `${path.id} trades ${path.typeGraft} for itself`);
    }
    const keeper = paths.find((p) => !p.typeGraft)!;
    const move = moves[keeper.unlocksMoveIds[0]];
    assert.strictEqual(move.type, hero.types[1], `${keeper.id}'s move is not of ${hero.types[1]}`);
    assert.strictEqual(move.tier, 'late', `${keeper.id}'s move is not Late`);
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

  const grades = entryGradesFor(hero, after);
  assert.strictEqual(grades.attack, gradesFor(hero).intelligence);
  assert.strictEqual(grades.intelligence, gradesFor(hero).attack);

  // Every later level rolls Intelligence on the grade Attack used to have.
  const levelled = grantXp(after, hero, 27_000 - after.xp, () => 0.05).gained;
  const unswapped = grantXp({ ...after, offenseSwapped: false }, hero, 27_000 - after.xp, () => 0.05).gained;
  assert.strictEqual(levelled.intelligence ?? 0, unswapped.attack ?? 0);
  assert.strictEqual(levelled.attack ?? 0, unswapped.intelligence ?? 0);
});

test('evolution simplification: the signature follows the rewire — learned before it, owed after it, and in Constructed', () => {
  const twin = rewiredSignatureId('hammerbrand');
  assert.strictEqual(moves[twin].category, 'magical');
  assert.strictEqual(moves[twin].basePower, moves.hammerbrand.basePower);

  // Learned first: it changes hands with the stats.
  let run = seed('cinderKnight');
  run = { ...run, roster: [{ ...run.roster[0], unlockedMoveIds: ['singe', 'hammerbrand'] }] };
  run = chooseEvolutionPath(run, progressionTable, heroes, 'cinderKnight', 'cinderKnight-explosive');
  assert.ok(run.roster[0].unlockedMoveIds.includes(twin));
  assert.ok(!run.roster[0].unlockedMoveIds.includes('hammerbrand'));

  // Owed after: the level-up teaches the twin.
  const swapped = { ...seed('cinderKnight').roster[0], offenseSwapped: true, xp: 30 ** 3 };
  assert.strictEqual(pendingSignature(heroes.cinderKnight, swapped), twin);
  assert.strictEqual(pendingSignature(heroes.cinderKnight, { ...swapped, offenseSwapped: false }), 'hammerbrand');

  // Constructed: the pool holds the form's own, and a path change carries a held one across.
  const content = { heroes, table: progressionTable, equipment };
  const slot = { heroId: 'cinderKnight', pathId: 'cinderKnight-ironclad', moveIds: ['hammerbrand'], itemIds: [] };
  assert.ok(constructedMovePool(content, { ...slot, pathId: 'cinderKnight-explosive' }).includes(twin));
  assert.ok(!constructedMovePool(content, { ...slot, pathId: 'cinderKnight-explosive' }).includes('hammerbrand'));
  assert.deepStrictEqual(withPath(content, slot, 'cinderKnight-explosive').moveIds, [twin]);
  assert.deepStrictEqual(withPath(content, withPath(content, slot, 'cinderKnight-explosive'), null).moveIds, ['hammerbrand']);
});

test('evolution simplification: a grafted Cinder is offered its new type\'s line on the level-up roll', () => {
  let run = seed('cinderKnight');
  run = chooseEvolutionPath(run, progressionTable, heroes, 'cinderKnight', 'cinderKnight-thunderblaze');
  const entry = { ...run.roster[0], xp: 30 ** 3 };
  const pool = levelMovePool(progressionTable, moves, heroes.cinderKnight, entry);
  assert.ok(pool.some((id) => moves[id].type === 'Storm'), 'the Storm line joins the pool');
  assert.ok(!pool.includes('stormLash'), 'the granted move is not offered again');
});
