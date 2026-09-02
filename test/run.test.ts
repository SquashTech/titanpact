import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { progressionTable } from '../src/data/progression';
import { moves } from '../src/data/moves';
import {
  createRunState,
  createRosterEntry,
  addRosterEntry,
  terminateRosterEntry,
  replaceRosterEntry,
  reorderRoster,
  RosterFullError,
  ROSTER_CAP,
} from '../src/run/state';
import { equipItem } from '../src/run/equipment';
import { pickSquad, SquadSelectionError } from '../src/run/squad';
import { buildCombatState } from '../src/run/buildCombatState';
import { getEffectiveStat } from '../src/engine/state';
import {
  levelUpHero,
  levelUpMovePool,
  grantLevelUpMove,
  availableEvolution,
  chooseEvolutionPath,
  applyEvolutionMoves,
  rosterEntryTypes,
  EVOLUTION_LEVEL,
  levelUpCost,
  costToReachLevel,
  ProgressionError,
} from '../src/run/progression';

/** Buys `n` LEVELS (not points) on a hero, ignoring each level's move offer; the caller's pool must cover costToReachLevel over the range. */
function levelUpTimes(run: import('../src/run/state').RunState, rosterId: string, n: number) {
  let next = run;
  for (let i = 0; i < n; i++) next = levelUpHero(next, rosterId);
  return next;
}

function seedRoster(heroIds: string[]) {
  let run = createRunState(10);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- Roster cap / termination ---

test('run: roster accepts up to the 6-hero cap, then throws', () => {
  const allSix = ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk'];
  assert.strictEqual(allSix.length, ROSTER_CAP);
  const run = seedRoster(allSix);
  assert.strictEqual(run.roster.length, ROSTER_CAP);
  assert.throws(
    () => addRosterEntry(run, createRosterEntry('extra', 'cinderKnight', [])),
    RosterFullError
  );
});

test('run: adding a duplicate rosterId throws', () => {
  const run = seedRoster(['cinderKnight']);
  assert.throws(() => addRosterEntry(run, createRosterEntry('cinderKnight', 'cinderKnight', [])));
});

test('run: terminating a roster entry strips its equipment (the entry, and its loadout, are gone)', () => {
  let run = seedRoster(['cinderKnight']);
  run = {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === 'cinderKnight' ? { ...r, equipment: equipItem(r.equipment, equipment.ironBlade) } : r)),
  };
  assert.strictEqual(run.roster[0].equipment.weapon, 'ironBlade');

  const afterTermination = terminateRosterEntry(run, 'cinderKnight');
  assert.strictEqual(afterTermination.roster.length, 0);
});

test('run: replaceRosterEntry swaps one roster slot for a new entry, preserving roster order and size', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden']);
  const newEntry = createRosterEntry('wildOracle', 'wildOracle', heroes.wildOracle.moveIds);

  const next = replaceRosterEntry(run, 'tidecaller', newEntry);
  assert.strictEqual(next.roster.length, 3);
  assert.deepStrictEqual(
    next.roster.map((r) => r.rosterId),
    ['cinderKnight', 'wildOracle', 'ironWarden'] // tidecaller's slot, in place — not appended
  );
});

test('run: replaceRosterEntry rejects an unknown terminated rosterId and a rosterId collision with a different remaining entry', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller']);
  const newEntry = createRosterEntry('wildOracle', 'wildOracle', heroes.wildOracle.moveIds);
  assert.throws(() => replaceRosterEntry(run, 'nonexistent', newEntry));

  const collidingEntry = createRosterEntry('cinderKnight', 'wildOracle', heroes.wildOracle.moveIds);
  assert.throws(() => replaceRosterEntry(run, 'tidecaller', collidingEntry));
});

test('run: reorderRoster rewrites order without touching membership, and the arrangement is what a later pickSquad reads', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle']);

  // Slots 0-1 are active, 2-3 bench, 4-5 reserve (view/run/SquadSelectScreen.tsx).
  const next = reorderRoster(run, ['wildOracle', 'ironWarden', 'cinderKnight', 'tidecaller']);
  assert.deepStrictEqual(
    next.roster.map((r) => r.rosterId),
    ['wildOracle', 'ironWarden', 'cinderKnight', 'tidecaller']
  );
  assert.strictEqual(next.roster.length, run.roster.length);

  const squad = pickSquad(next.roster, next.roster.map((r) => r.rosterId));
  assert.deepStrictEqual(squad.activeIds, ['wildOracle', 'ironWarden']);
});

test('run: reorderRoster tolerates a stale or partial list — unknown ids are dropped, unmentioned heroes keep their place at the back', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle']);

  // The caller is a view holding six slots that outlive any one roster, so this reorders rather than throwing.
  const next = reorderRoster(run, ['stormRanger', 'wildOracle', 'tidecaller', 'tidecaller']);
  assert.deepStrictEqual(
    next.roster.map((r) => r.rosterId),
    ['wildOracle', 'tidecaller', 'cinderKnight', 'ironWarden']
  );
});

// --- Squad selection (bring-6-pick-4) ---

test('squad: picking 4 of 6 splits into 2 active + 2 bench, in pick order', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'shadowMonk']);
  const squad = pickSquad(run.roster, ['stormRanger', 'shadowMonk', 'cinderKnight', 'tidecaller']);
  assert.deepStrictEqual(squad.activeIds, ['stormRanger', 'shadowMonk']);
  assert.deepStrictEqual(squad.benchIds, ['cinderKnight', 'tidecaller']);
});

test('squad: below 4 recruited heroes, the whole roster must be picked (early-run roster) and leaves an empty active slot below 2 picks', () => {
  const run = seedRoster(['cinderKnight']);
  const squad = pickSquad(run.roster, ['cinderKnight']);
  assert.deepStrictEqual(squad.activeIds, ['cinderKnight', null]);
  assert.deepStrictEqual(squad.benchIds, []);
});

test('squad: a partial pick is rejected at every roster size below the cap — a player can never accidentally leave a recruited hero out', () => {
  const twoHero = seedRoster(['cinderKnight', 'tidecaller']);
  assert.throws(() => pickSquad(twoHero.roster, ['cinderKnight']), SquadSelectionError);

  const threeHero = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden']);
  assert.throws(() => pickSquad(threeHero.roster, ['cinderKnight', 'tidecaller']), SquadSelectionError);

  const fourHero = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle']);
  assert.throws(() => pickSquad(fourHero.roster, ['cinderKnight', 'tidecaller', 'ironWarden']), SquadSelectionError);
  const fullSquad = pickSquad(fourHero.roster, ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle']);
  assert.strictEqual(fullSquad.benchIds.length, 2);
});

test('squad: 0 picks, 5 picks (roster of 5, above the 4-cap), duplicates, and unknown ids are all rejected', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger']);
  assert.throws(() => pickSquad(run.roster, []), SquadSelectionError);
  assert.throws(() => pickSquad(run.roster, run.roster.map((r) => r.rosterId)), SquadSelectionError); // 5 picks
  assert.throws(() => pickSquad(run.roster, ['cinderKnight', 'cinderKnight']), SquadSelectionError);
  assert.throws(() => pickSquad(run.roster, ['nonexistent']), SquadSelectionError);
});

// --- buildCombatState ---

test('buildCombatState: equipped item stat grants raise the combatant\'s effective stat', () => {
  let run = seedRoster(['cinderKnight', 'tidecaller']);
  run = {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === 'cinderKnight' ? { ...r, equipment: equipItem(r.equipment, equipment.ironBlade) } : r)),
  };
  const squad = pickSquad(run.roster, ['cinderKnight', 'tidecaller']);
  const aiRun = seedRoster(['ironWarden', 'wildOracle']);
  const aiSquad = pickSquad(aiRun.roster, ['ironWarden', 'wildOracle']);

  const state = buildCombatState(1, heroes, equipment, [
    { side: 'A', squad, roster: run.roster },
    { side: 'B', squad: aiSquad, roster: aiRun.roster },
  ]);

  const combatant = state.combatants['A:cinderKnight'];
  assert.ok(combatant, 'expected a combatant keyed A:cinderKnight');
  const effectiveAttack = getEffectiveStat(heroes.cinderKnight, combatant, 'attack');
  assert.strictEqual(effectiveAttack, heroes.cinderKnight.baseStats.attack + 10);
});

test('buildCombatState: same rosterId on both sides does not collide (side-prefixed combatant ids)', () => {
  const runA = seedRoster(['cinderKnight']);
  const runB = seedRoster(['cinderKnight']); // deliberately the same rosterId as side A
  const squadA = pickSquad(runA.roster, ['cinderKnight']);
  const squadB = pickSquad(runB.roster, ['cinderKnight']);

  const state = buildCombatState(1, heroes, equipment, [
    { side: 'A', squad: squadA, roster: runA.roster },
    { side: 'B', squad: squadB, roster: runB.roster },
  ]);

  assert.strictEqual(Object.keys(state.combatants).length, 2);
  assert.ok(state.combatants['A:cinderKnight']);
  assert.ok(state.combatants['B:cinderKnight']);
  assert.strictEqual(state.active.A[0], 'A:cinderKnight');
  assert.strictEqual(state.active.B[0], 'B:cinderKnight');
});

// --- Level-up pool: moves + Evolution ---

test('progression: levelUpHero spends levelUpCost and bumps level; insufficient points is rejected', () => {
  let run = seedRoster(['cinderKnight']);
  run = { ...run, levelUpPool: 0 };
  assert.throws(() => levelUpHero(run, 'cinderKnight'), ProgressionError);

  // A level-1 hero's first level costs 1; the curve itself is test/levelCost.test.ts's subject.
  run = { ...run, levelUpPool: 1 };
  const next = levelUpHero(run, 'cinderKnight');
  assert.strictEqual(next.levelUpPool, 0);
  assert.strictEqual(next.roster[0].level, 2);
});

test('progression: levelUpMovePool + grantLevelUpMove resolve a level-up\'s move offer', () => {
  let run = seedRoster(['cinderKnight']);
  const entry = run.roster[0];
  assert.deepStrictEqual(
    // Read at a level past every tier gate, so this pins the authored POOL, not the level curve.
    levelUpMovePool(progressionTable, moves, { ...entry, level: 99 }),
    [
      'moltenLash',
      'firebrand',
      'volcanicSurge',
      'heavyBlow',
      'momentumSwing',
      'ironFist',
      'openingStrike',
      'serratedSlice',
    ]
  );

  const withMove = grantLevelUpMove(run, 'cinderKnight', 'firebrand');
  assert.ok(withMove.roster[0].unlockedMoveIds.includes('firebrand'));
  assert.ok(!levelUpMovePool(progressionTable, moves, { ...withMove.roster[0], level: 99 }).includes('firebrand')); // granted move drops out of the pool
  assert.strictEqual(withMove.roster[0].unlockedMoveIds.length, 4); // starting 3 + this grant hits MOVE_CAP

  // Already at MOVE_CAP: further offers require replacing an unlocked move.
  const swapped = grantLevelUpMove(withMove, 'cinderKnight', 'heavyBlow', 'sharpen');
  assert.ok(!swapped.roster[0].unlockedMoveIds.includes('sharpen'));
  assert.ok(swapped.roster[0].unlockedMoveIds.includes('heavyBlow'));
  assert.throws(() => grantLevelUpMove(withMove, 'cinderKnight', 'heavyBlow', 'notUnlocked'), ProgressionError);
});

test('progression: Evolution unlocks only at EVOLUTION_LEVEL, offers exactly three paths, grants stats, and is one-shot', () => {
  let run = seedRoster(['cinderKnight']);
  run = { ...run, levelUpPool: costToReachLevel(1, EVOLUTION_LEVEL) };

  assert.strictEqual(availableEvolution(progressionTable, run.roster[0]), null);

  run = levelUpTimes(run, 'cinderKnight', EVOLUTION_LEVEL - 2);
  assert.strictEqual(run.roster[0].level, EVOLUTION_LEVEL - 1);
  assert.strictEqual(availableEvolution(progressionTable, run.roster[0]), null); // level EVOLUTION_LEVEL - 1 hasn't crossed yet

  run = { ...run, levelUpPool: levelUpCost(EVOLUTION_LEVEL - 1) };
  run = levelUpTimes(run, 'cinderKnight', 1);
  assert.strictEqual(run.roster[0].level, EVOLUTION_LEVEL);
  const node = availableEvolution(progressionTable, run.roster[0]);
  assert.ok(node, 'expected an Evolution node to be available at EVOLUTION_LEVEL');
  assert.strictEqual(node!.paths.length, 3, 'CLAUDE.md: a choice of three options');

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'cinderKnight', 'cinderKnight-offensive');
  assert.strictEqual(next.roster[0].evolutionStatGrants.attack, 10);
  assert.ok(next.roster[0].chosenPathIds.includes('cinderKnight-offensive'));

  // one-shot: no second node authored for cinderKnight, so nothing further is offered
  assert.strictEqual(availableEvolution(progressionTable, next.roster[0]), null);
});

test('progression: an Evolution path with a non-multiple-of-5 stat grant is rejected', () => {
  let run = seedRoster(['cinderKnight']);
  run = { ...run, levelUpPool: costToReachLevel(1, EVOLUTION_LEVEL) };
  run = levelUpTimes(run, 'cinderKnight', EVOLUTION_LEVEL - 1);

  const badTable = {
    moveTiers: {},
    evolutions: {
      cinderKnight: [
        {
          level: EVOLUTION_LEVEL,
          paths: [
            { id: 'bad', heroId: 'cinderKnight', kind: 'offensive' as const, name: 'Bad Path', statGrants: { attack: 7 }, unlocksMoveIds: [] },
          ],
        },
      ],
    },
  };
  assert.throws(() => chooseEvolutionPath(run, badTable, heroes, 'cinderKnight', 'bad'), ProgressionError);
});

// --- learnableMoveIds: Evolution steers future level-up offerings (docs/leveling-and-ranks.md) ---

test('progression: a graft path adds its learnableMoveIds to the level-up pool without granting them', () => {
  let run = seedRoster(['crimson']);
  run = { ...run, levelUpPool: costToReachLevel(1, EVOLUTION_LEVEL) };
  run = levelUpTimes(run, 'crimson', EVOLUTION_LEVEL - 1);

  const before = levelUpMovePool(progressionTable, moves, { ...run.roster[0], level: 99 });
  assert.ok(!before.includes('soulRend'), 'Spirit moves must not be offerable before the graft');

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'crimson', 'crimson-defensive');
  const after = levelUpMovePool(progressionTable, moves, { ...next.roster[0], level: 99 });

  for (const id of ['drain', 'secondWind', 'soulRend', 'banish']) {
    assert.ok(after.includes(id), `${id} should be learnable after Cinderveil`);
    assert.ok(!next.roster[0].unlockedMoveIds.includes(id), `${id} should be LEARNABLE, not granted`);
  }
  // The Fire pool is widened, not replaced.
  assert.ok(after.includes('inferno'));
  // Cinderveil's own grant is the one exception to "learnable, not granted": Flicker arrives outright.
  assert.deepStrictEqual(next.roster[0].unlockedMoveIds, [...heroes.crimson.moveIds, 'flicker']);
});

test('progression: an untaken path\'s learnableMoveIds stay out of the pool, and tier gating still applies', () => {
  let run = seedRoster(['crimson']);
  run = { ...run, levelUpPool: costToReachLevel(1, EVOLUTION_LEVEL) };
  run = levelUpTimes(run, 'crimson', EVOLUTION_LEVEL - 1);

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'crimson', 'crimson-utility');
  const atEvolutionLevel = levelUpMovePool(progressionTable, moves, next.roster[0]);

  assert.ok(atEvolutionLevel.includes('manaTap')); // Early — reachable the moment the graft lands
  assert.ok(!atEvolutionLevel.includes('cataclysm')); // Late — still gated until level 7
  assert.ok(!atEvolutionLevel.includes('soulRend')); // Cinderveil's, and Cinderveil was not taken
});

test('progression: a path that grants a Passive records it on the entry (Crimson\'s Pyroclasm)', () => {
  let run = seedRoster(['crimson']);
  run = { ...run, levelUpPool: costToReachLevel(1, EVOLUTION_LEVEL) };
  run = levelUpTimes(run, 'crimson', EVOLUTION_LEVEL - 1);

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'crimson', 'crimson-offensive');
  assert.deepStrictEqual(next.roster[0].evolutionPassiveGrants, ['firestarter']);
  assert.ok(!next.roster[0].evolutionTypeGraft); // the mono path stays mono
  assert.strictEqual(next.roster[0].evolutionStatGrants.defense, 10);
  assert.strictEqual(next.roster[0].evolutionStatGrants.manaPool, 10);
});

test('progression: Warhowl inverts Fang\'s attacking stat — a NEGATIVE Evolution grant is legal and lands', () => {
  let run = seedRoster(['packAlpha']);
  run = { ...run, levelUpPool: costToReachLevel(1, EVOLUTION_LEVEL) };
  run = levelUpTimes(run, 'packAlpha', EVOLUTION_LEVEL - 1);

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'packAlpha', 'packAlpha-utility');
  const grants = next.roster[0].evolutionStatGrants;
  assert.strictEqual(grants.attack, -30);
  assert.strictEqual(grants.intelligence, 60);
  assert.strictEqual(grants.mpRegen, 5);
  assert.ok(next.roster[0].unlockedMoveIds.includes('poltergeist'), 'Warhowl hands Fang a Spirit attack to use the new Intelligence on');

  const base = heroes.packAlpha.baseStats;
  assert.ok(base.attack > base.intelligence, 'base Fang attacks with Attack');
  assert.ok(base.intelligence + grants.intelligence! > base.attack + grants.attack!, 'Warhowl Fang attacks with Intelligence');

  // Animal Spirit is Beast's one magical row, absent from base Fang's pool (Int 20); Warhowl makes it reachable.
  const pool = levelUpMovePool(progressionTable, moves, { ...next.roster[0], level: 99 });
  assert.ok(!progressionTable.moveTiers.packAlpha.includes('animalSpirit'));
  assert.ok(pool.includes('animalSpirit'));
  assert.strictEqual(moves.animalSpirit.type, 'Beast');
});

// --- unlocksMoveIds: an Evolution grants its move outright, under the same MOVE_CAP as a level-up ---

test('progression: an Evolution grant fills an open slot, and the cap refuses the rest as overflow rather than growing the loadout', () => {
  const under = applyEvolutionMoves(['a', 'b', 'c'], ['spireClaw']);
  assert.deepStrictEqual(under.unlockedMoveIds, ['a', 'b', 'c', 'spireClaw']);
  assert.deepStrictEqual(under.overflow, []);

  const atCap = applyEvolutionMoves(['a', 'b', 'c', 'd'], ['spireClaw']);
  assert.deepStrictEqual(atCap.unlockedMoveIds, ['a', 'b', 'c', 'd'], 'never five moves');
  assert.deepStrictEqual(atCap.overflow, ['spireClaw'], 'the caller offers it as a replace-or-decline');

  // Already known is neither granted again nor overflow — it costs the player no choice.
  assert.deepStrictEqual(applyEvolutionMoves(['a', 'b', 'c', 'spireClaw'], ['spireClaw']).overflow, []);
});

test('progression: choosing Stonehide at the move cap leaves the loadout untouched — the grant does not silently displace a move', () => {
  let run = createRunState(0);
  run = addRosterEntry(run, createRosterEntry('packAlpha', 'packAlpha', [...heroes.packAlpha.moveIds, 'maul']));
  run = { ...run, levelUpPool: costToReachLevel(1, EVOLUTION_LEVEL) };
  run = levelUpTimes(run, 'packAlpha', EVOLUTION_LEVEL - 1);
  assert.strictEqual(run.roster[0].unlockedMoveIds.length, 4);

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'packAlpha', 'packAlpha-defensive');
  assert.deepStrictEqual(next.roster[0].unlockedMoveIds, run.roster[0].unlockedMoveIds);
  assert.strictEqual(next.roster[0].evolutionTypeGraft, 'Stone');
});

// --- Type-graft Evolution paths (docs/progression.md "Type-graft paths") ---

test('progression: a type-graft path grants a second type without touching the innate HeroDefinition', () => {
  let run = seedRoster(['tidecaller']);
  run = { ...run, levelUpPool: costToReachLevel(1, EVOLUTION_LEVEL) };
  run = levelUpTimes(run, 'tidecaller', EVOLUTION_LEVEL - 1);

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'tidecaller', 'tidecaller-defensive');
  assert.strictEqual(next.roster[0].evolutionTypeGraft, 'Frost');
  assert.deepStrictEqual(heroes.tidecaller.types, ['Water']); // innate type untouched

  const squad = pickSquad(next.roster, ['tidecaller']);
  const aiRun = seedRoster(['ironWarden']);
  const aiSquad = pickSquad(aiRun.roster, ['ironWarden']);
  const state = buildCombatState(1, heroes, equipment, [
    { side: 'A', squad, roster: next.roster },
    { side: 'B', squad: aiSquad, roster: aiRun.roster },
  ]);
  assert.deepStrictEqual(state.combatants['A:tidecaller'].grantedTypes, ['Frost']);
  // Out-of-combat screens read the graft off the RosterEntry, with no Combatant built yet.
  assert.deepStrictEqual(rosterEntryTypes(heroes.tidecaller, next.roster[0]), ['Water', 'Frost']);
});

test('progression: a type-graft path is rejected for an already-dual-typed hero', () => {
  let run = seedRoster(['ironWarden']);
  run = { ...run, levelUpPool: costToReachLevel(1, EVOLUTION_LEVEL) };
  run = levelUpTimes(run, 'ironWarden', EVOLUTION_LEVEL - 1);

  // Synthetic dual-typed override so this exercises the enforcement rather than any hero's canonical typing.
  const dualHeroes = { ...heroes, ironWarden: { ...heroes.ironWarden, types: ['Iron', 'Stone'] as const } };

  const dualGraftTable = {
    moveTiers: {},
    evolutions: {
      ironWarden: [
        {
          level: EVOLUTION_LEVEL,
          paths: [
            {
              id: 'iw-graft',
              heroId: 'ironWarden',
              kind: 'utility' as const,
              name: 'Bad Graft',
              statGrants: {},
              unlocksMoveIds: [],
              typeGraft: 'Nature',
            },
          ],
        },
      ],
    },
  };
  assert.throws(() => chooseEvolutionPath(run, dualGraftTable, dualHeroes, 'ironWarden', 'iw-graft'), ProgressionError);
});

test('progression: a later type-graft path shifts (replaces) the secondary type rather than stacking a third', () => {
  let run = seedRoster(['tidecaller']);
  run = { ...run, levelUpPool: costToReachLevel(1, EVOLUTION_LEVEL) };
  run = levelUpTimes(run, 'tidecaller', EVOLUTION_LEVEL - 1);
  run = chooseEvolutionPath(run, progressionTable, heroes, 'tidecaller', 'tidecaller-defensive');
  assert.strictEqual(run.roster[0].evolutionTypeGraft, 'Frost');

  // A synthetic second node (the future multi-node "Deep line" shape, docs/leveling-and-ranks.md).
  const shiftTable = {
    moveTiers: {},
    evolutions: {
      tidecaller: [
        { level: EVOLUTION_LEVEL, paths: [] },
        {
          level: EVOLUTION_LEVEL,
          paths: [
            {
              id: 'tidecaller-shift',
              heroId: 'tidecaller',
              kind: 'utility' as const,
              name: 'Shifted Graft',
              statGrants: {},
              unlocksMoveIds: [],
              typeGraft: 'Spirit',
            },
          ],
        },
      ],
    },
  };
  const shifted = chooseEvolutionPath(run, shiftTable, heroes, 'tidecaller', 'tidecaller-shift');
  assert.strictEqual(shifted.roster[0].evolutionTypeGraft, 'Spirit'); // replaced, not stacked

  const squad = pickSquad(shifted.roster, ['tidecaller']);
  const aiRun = seedRoster(['ironWarden']);
  const aiSquad = pickSquad(aiRun.roster, ['ironWarden']);
  const state = buildCombatState(1, heroes, equipment, [
    { side: 'A', squad, roster: shifted.roster },
    { side: 'B', squad: aiSquad, roster: aiRun.roster },
  ]);
  assert.deepStrictEqual(state.combatants['A:tidecaller'].grantedTypes, ['Spirit']); // not ['Frost', 'Spirit']
});
