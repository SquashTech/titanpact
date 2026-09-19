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
import { pickSquad, SquadSelectionError, STANDARD_SQUAD_SIZE } from '../src/run/squad';
import { buildCombatState } from '../src/run/buildCombatState';
import { getEffectiveStat } from '../src/engine/state';
import { MAX_XP, levelOf, xpForLevel } from '../src/run/growth';
import { MASTERY_EVOLUTION } from '../src/run/mastery';
import {
  levelMovePool,
  atEvolution,
  grantOfferedMove,
  recordMoveOffer,
  availableEvolution,
  chooseEvolutionPath,
  applyEvolutionMoves,
  rosterEntryTypes,
  DEFAULT_SCHEDULE,
  ProgressionError,
  scheduleFor,
} from '../src/run/progression';

/** Stands a hero at its Evolution — MASTERY_EVOLUTION pips (docs/mastery.md §2) — a fixture, not a walk. */
function atEvolutionRung(run: import('../src/run/state').RunState, rosterId: string) {
  return {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === rosterId ? atEvolution(r) : r)),
  };
}

/** The pool at the top of the schedule — every band open, Early expired. */
function poolAtTop(entry: import('../src/run/state').RosterEntry) {
  return levelMovePool(progressionTable, moves, heroes[entry.heroId], { ...entry, xp: MAX_XP });
}

/** The pool in the Mid band — Mid only. */
function poolAtMid(entry: import('../src/run/state').RosterEntry) {
  const hero = heroes[entry.heroId];
  return levelMovePool(progressionTable, moves, hero, { ...entry, xp: xpForLevel(scheduleFor(hero).midLevel) });
}

/** The pool at level 1 — Early only. */
function poolAtStart(entry: import('../src/run/state').RosterEntry) {
  return levelMovePool(progressionTable, moves, heroes[entry.heroId], { ...entry, xp: xpForLevel(1) });
}

function seedRoster(heroIds: string[]) {
  let run = createRunState(0);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

// --- Roster cap / termination ---

test('run: roster accepts up to the 6-hero cap, then throws', () => {
  const allSix = ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'nightshade'];
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
    roster: run.roster.map((r) => (r.rosterId === 'cinderKnight' ? { ...r, equipment: equipItem(r.equipment, equipment['sword.common'].id) } : r)),
  };
  assert.strictEqual(run.roster[0].equipment[0], 'sword.common');

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

// --- Squad selection (the whole roster fields; the pick is lead order) ---

test('squad: a full roster splits into 2 active + 4 bench, in pick order', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'nightshade']);
  const squad = pickSquad(run.roster, ['stormRanger', 'nightshade', 'cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle']);
  assert.deepStrictEqual(squad.activeIds, ['stormRanger', 'nightshade']);
  assert.deepStrictEqual(squad.benchIds, ['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle']);
});

test('squad: STANDARD_SQUAD_SIZE is the roster cap — no fight benches a hero by omission (2026-09-17)', () => {
  assert.strictEqual(STANDARD_SQUAD_SIZE, ROSTER_CAP);
  const run = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger', 'nightshade']);
  assert.throws(() => pickSquad(run.roster, ['stormRanger', 'nightshade', 'cinderKnight', 'tidecaller']), SquadSelectionError);
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

test('squad: 0 picks, a short pick (roster of 5), duplicates, and unknown ids are all rejected', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller', 'ironWarden', 'wildOracle', 'stormRanger']);
  assert.throws(() => pickSquad(run.roster, []), SquadSelectionError);
  assert.throws(() => pickSquad(run.roster, run.roster.slice(0, 4).map((r) => r.rosterId)), SquadSelectionError); // 4 of 5
  assert.throws(() => pickSquad(run.roster, ['cinderKnight', 'cinderKnight']), SquadSelectionError);
  assert.throws(() => pickSquad(run.roster, ['nonexistent']), SquadSelectionError);
});

// --- buildCombatState ---

test('buildCombatState: equipped item stat grants raise the combatant\'s effective stat', () => {
  let run = seedRoster(['cinderKnight', 'tidecaller']);
  run = {
    ...run,
    roster: run.roster.map((r) => (r.rosterId === 'cinderKnight' ? { ...r, equipment: equipItem(r.equipment, equipment['sword.common'].id) } : r)),
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
  assert.strictEqual(effectiveAttack, heroes.cinderKnight.baseStats.attack + equipment['sword.common'].statGrants.attack!);
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

// --- The movepool and the Evolution tree (levels themselves: test/growth.test.ts) ---

test('progression: levelMovePool + grantOfferedMove resolve a level\'s move offer', () => {
  let run = seedRoster(['cinderKnight']);
  const entry = run.roster[0];
  // Read at the three bands rather than at one level: each band offers its own tier, so no single
  // level sees the whole authored pool. Together these three pin all of it.
  assert.deepStrictEqual(poolAtStart(entry), [
    'heavyBlow',
    'ironFist',
    'openingStrike',
    'pinDown',
    'swiftBlow',
    'holyStrike',
  ]);
  assert.deepStrictEqual(poolAtMid(entry), ['moltenLash', 'firebrand', 'blazingRetreat', 'momentumSwing', 'serratedSlice', 'rendArmor', 'metallicBlade']);
  assert.deepStrictEqual(poolAtTop(entry), ['volcanicSurge', 'onslaught', 'swingingChain']);

  const withMove = grantOfferedMove(run, 'cinderKnight', 'firebrand');
  assert.ok(withMove.roster[0].unlockedMoveIds.includes('firebrand'));
  assert.ok(!poolAtTop(withMove.roster[0]).includes('firebrand')); // granted move drops out of the pool
  assert.strictEqual(withMove.roster[0].unlockedMoveIds.length, 4); // starting 3 + this grant hits MOVE_CAP

  // Already at MOVE_CAP: further offers require replacing an unlocked move.
  const swapped = grantOfferedMove(withMove, 'cinderKnight', 'heavyBlow', 'kindle');
  assert.ok(!swapped.roster[0].unlockedMoveIds.includes('kindle'));
  assert.ok(swapped.roster[0].unlockedMoveIds.includes('heavyBlow'));
  assert.throws(() => grantOfferedMove(withMove, 'cinderKnight', 'heavyBlow', 'notUnlocked'), ProgressionError);
});

test('progression: an offer is spent by being MADE — declined or swapped away, it never comes back', () => {
  const run = seedRoster(['cinderKnight']);

  // Declined: recordMoveOffer grants nothing and still burns the move out of the pool.
  const declined = recordMoveOffer(run, 'cinderKnight', ['moltenLash']);
  assert.ok(!declined.roster[0].unlockedMoveIds.includes('moltenLash'));
  assert.ok(!poolAtTop(declined.roster[0]).includes('moltenLash'));

  // Taught, then swapped away for something else: still gone.
  const taught = grantOfferedMove(declined, 'cinderKnight', 'firebrand');
  const dropped = grantOfferedMove(taught, 'cinderKnight', 'heavyBlow', 'firebrand');
  assert.ok(!dropped.roster[0].unlockedMoveIds.includes('firebrand'));
  assert.ok(!poolAtTop(dropped.roster[0]).includes('firebrand'));

  // Re-offering an already-spent move is a no-op, not a duplicate entry.
  const again = recordMoveOffer(dropped, 'cinderKnight', ['moltenLash']);
  assert.deepStrictEqual(again.roster[0].offeredMoveIds, ['moltenLash', 'firebrand', 'heavyBlow']);
  assert.throws(() => recordMoveOffer(run, 'nobody', ['moltenLash']), ProgressionError);
});

test('progression: an Evolution opens at MASTERY_EVOLUTION pips and at no level; offers exactly three paths, grants stats, and is one-shot', () => {
  // docs/mastery.md §2: the Scroll that lands the fifth pip raises the Evolution, for that hero,
  // on the node that paid it. Level has nothing to do with it.
  let run = seedRoster(['cinderKnight']);
  assert.strictEqual(availableEvolution(progressionTable, run.roster[0]), null, 'no pips: nothing owed');
  assert.strictEqual(levelOf(run.roster[0]), 1);
  const highLevel = { ...run.roster[0], xp: xpForLevel(30) };
  assert.strictEqual(availableEvolution(progressionTable, highLevel), null, 'level alone never opens it');
  const oneShort = { ...run.roster[0], mastery: MASTERY_EVOLUTION - 1 };
  assert.strictEqual(availableEvolution(progressionTable, oneShort), null, 'nor the pip before it');

  run = atEvolutionRung(run, 'cinderKnight');
  const node = availableEvolution(progressionTable, run.roster[0]);
  assert.ok(node, 'the entry opens it');
  assert.strictEqual(node!.paths.length, 3, 'CLAUDE.md: a choice of three options');

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'cinderKnight', 'cinderKnight-explosive');
  // Explosive is a REFOCUS: it SPENDS the Attack a physical Cinder lived on to buy Intelligence.
  assert.strictEqual(next.roster[0].evolutionStatGrants.attack, -40);
  assert.strictEqual(next.roster[0].evolutionStatGrants.intelligence, 60);
  assert.ok(next.roster[0].chosenPathIds.includes('cinderKnight-explosive'));

  assert.strictEqual(next.roster[0].scheduleTaken, run.roster[0].scheduleTaken, 'no schedule entry is spent — the pips paid');
  // one-shot: no second node authored for cinderKnight, so nothing further is offered
  assert.strictEqual(availableEvolution(progressionTable, next.roster[0]), null);
});

test('progression: an Evolution path with a non-multiple-of-5 stat grant is rejected', () => {
  let run = seedRoster(['cinderKnight']);
  run = atEvolutionRung(run, 'cinderKnight');

  const badTable = {
    moveTiers: {},
    evolutions: {
      cinderKnight: [
        {
          paths: [
            { id: 'bad', heroId: 'cinderKnight', name: 'Bad Path', statGrants: { attack: 7 }, unlocksMoveIds: [] },
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
  run = atEvolutionRung(run, 'crimson');

  const before = poolAtTop(run.roster[0]);
  assert.ok(!before.includes('soulRend'), 'Spirit moves must not be offerable before the graft');

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'crimson', 'crimson-cinderveil');
  const after = poolAtTop(next.roster[0]);

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
  run = atEvolutionRung(run, 'crimson');

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'crimson', 'crimson-emberweave');
  const atEvolutionLevel = levelMovePool(progressionTable, moves, heroes.crimson, next.roster[0]);

  assert.ok(atEvolutionLevel.includes('manaTap')); // Early — reachable the moment the graft lands
  assert.ok(!atEvolutionLevel.includes('cataclysm')); // Late — still gated until lateLevel
  assert.ok(!atEvolutionLevel.includes('soulRend')); // Cinderveil's, and Cinderveil was not taken
});

test('progression: a path that grants a Passive records it on the entry (Crimson\'s Pyroclasm)', () => {
  let run = seedRoster(['crimson']);
  run = atEvolutionRung(run, 'crimson');

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'crimson', 'crimson-pyroclasm');
  assert.deepStrictEqual(next.roster[0].evolutionPassiveGrants, ['firestarter']);
  assert.ok(!next.roster[0].evolutionTypeGraft); // the mono path stays mono
  assert.strictEqual(next.roster[0].evolutionStatGrants.defense, 10);
  assert.strictEqual(next.roster[0].evolutionStatGrants.manaPool, 10);
});

test('progression: Warhowl inverts Fang\'s attacking stat — a NEGATIVE Evolution grant is legal and lands', () => {
  let run = seedRoster(['packAlpha']);
  run = atEvolutionRung(run, 'packAlpha');

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'packAlpha', 'packAlpha-warhowl');
  const grants = next.roster[0].evolutionStatGrants;
  assert.strictEqual(grants.attack, -30);
  assert.strictEqual(grants.intelligence, 60);
  assert.strictEqual(grants.mpRegen, 5);
  assert.ok(next.roster[0].unlockedMoveIds.includes('poltergeist'), 'Warhowl hands Fang a Spirit attack to use the new Intelligence on');

  const base = heroes.packAlpha.baseStats;
  assert.ok(base.attack > base.intelligence, 'base Fang attacks with Attack');
  assert.ok(base.intelligence + grants.intelligence! > base.attack + grants.attack!, 'Warhowl Fang attacks with Intelligence');

  // Animal Spirit is Beast's one magical row, absent from base Fang's pool (Int 20); Warhowl makes it reachable.
  const pool = poolAtTop(next.roster[0]);
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
  run = atEvolutionRung(run, 'packAlpha');
  assert.strictEqual(run.roster[0].unlockedMoveIds.length, 4);

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'packAlpha', 'packAlpha-stonehide');
  assert.deepStrictEqual(next.roster[0].unlockedMoveIds, run.roster[0].unlockedMoveIds);
  assert.strictEqual(next.roster[0].evolutionTypeGraft, 'Stone');

  // The overflow the caller is about to offer is spent here, so declining it does not requeue the move.
  const path = progressionTable.evolutions.packAlpha[0].paths.find((p) => p.id === 'packAlpha-stonehide')!;
  for (const moveId of path.unlocksMoveIds) assert.ok(next.roster[0].offeredMoveIds.includes(moveId));
});

// --- Type-graft Evolution paths (docs/progression.md "Type-graft paths") ---

test('progression: a type-graft path grants a second type without touching the innate HeroDefinition', () => {
  let run = seedRoster(['tidecaller']);
  run = atEvolutionRung(run, 'tidecaller');

  const next = chooseEvolutionPath(run, progressionTable, heroes, 'tidecaller', 'tidecaller-frostbound');
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

test('progression: a graft on an already-dual-typed hero TRADES the innate secondary, never stacks a third', () => {
  let run = seedRoster(['ironWarden']);
  run = atEvolutionRung(run, 'ironWarden');

  // Synthetic dual-typed override so this exercises the rule rather than any hero's canonical typing.
  const dualHeroes = { ...heroes, ironWarden: { ...heroes.ironWarden, types: ['Iron', 'Stone'] as const } };

  const dualGraftTable = {
    moveTiers: {},
    evolutions: {
      ironWarden: [
        {
          paths: [
            {
              id: 'iw-graft',
              heroId: 'ironWarden',
              name: 'Retype',
              statGrants: {},
              unlocksMoveIds: [],
              typeGraft: 'Nature',
            },
            {
              id: 'iw-redundant',
              heroId: 'ironWarden',
              name: 'Redundant',
              statGrants: {},
              unlocksMoveIds: [],
              typeGraft: 'Stone',
            },
          ],
        },
      ],
    },
  };

  const next = chooseEvolutionPath(run, dualGraftTable, dualHeroes, 'ironWarden', 'iw-graft');
  assert.strictEqual(next.roster[0].evolutionTypeGraft, 'Nature');
  // The graft owns the SECONDARY SLOT: Iron (the immutable primary) is kept, Stone is spent.
  assert.deepStrictEqual(rosterEntryTypes(dualHeroes.ironWarden, next.roster[0]), [
    'Iron',
    'Nature',
  ]);
  assert.deepStrictEqual(dualHeroes.ironWarden.types, ['Iron', 'Stone'], 'the HeroDefinition is untouched');

  // Trading the secondary for the secondary it already has is still a no-op, and still refused.
  assert.throws(
    () => chooseEvolutionPath(run, dualGraftTable, dualHeroes, 'ironWarden', 'iw-redundant'),
    ProgressionError
  );
});

test('progression: a later type-graft path shifts (replaces) the secondary type rather than stacking a third', () => {
  let run = seedRoster(['tidecaller']);
  run = atEvolutionRung(run, 'tidecaller');
  run = chooseEvolutionPath(run, progressionTable, heroes, 'tidecaller', 'tidecaller-frostbound');
  assert.strictEqual(run.roster[0].evolutionTypeGraft, 'Frost');

  // A synthetic second node (the future multi-node "Deep line" shape, docs/leveling-and-ranks.md).
  const shiftTable = {
    moveTiers: {},
    evolutions: {
      tidecaller: [
        { paths: [] },
        {
          paths: [
            {
              id: 'tidecaller-shift',
              heroId: 'tidecaller',
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
  // A schedule carries one Evolution entry today, so the second node is stood at it by hand: what
  // is under test is the graft rule, not where a second node would sit on the schedule.
  const shifted = chooseEvolutionPath(atEvolutionRung(run, 'tidecaller'), shiftTable, heroes, 'tidecaller', 'tidecaller-shift');
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
