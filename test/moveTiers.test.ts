// The movepool tier gate: a move's `tier` decides the BAND — the level range on a hero's schedule —
// at which it may first be offered (run/progression.ts bandRank, levelMovePool, docs/xp-overhaul.md
// §4). The bands are unchanged since the slates were authored; only what opens them has moved:
// level, then Mastery Rank (2026-09-10), then the schedule's midLevel / lateLevel (2026-09-13).
//
// An omitted tier reads as Early (ungated), so TIERED_TYPES records which slates carry a tier
// column — a slate silently losing its tiers would otherwise look exactly like the pre-gate
// behaviour.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { classMoves } from '../src/data/classes';
import { signatureMoves } from '../src/data/signatures';
import { progressionTable } from '../src/data/progression';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import type { RunState } from '../src/run/state';
import {
  DEFAULT_SCHEDULE,
  MAX_BAND_RANK,
  MOVE_CAP,
  MOVE_TIER_RANK,
  MOVE_TIER_RANK_EXPIRY,
  atEvolution,
  availableEvolution,
  bandRank,
  chooseEvolutionPath,
  entryBandRank,
  grantMove,
  grantOfferedMove,
  isMoveTierOfferable,
  levelMovePool,
  movePoolFloor,
  pendingScheduleEntry,
  recordMoveOffer,
  scheduleEntries,
  scheduleEntriesBelow,
  scheduleFor,
  scheduleRemaining,
  takeScheduleEntry,
} from '../src/run/progression';
import { heroes as heroesById } from '../src/data/heroes';
import { MAX_LEVEL, levelOf, levelUpEntry, xpForLevel } from '../src/run/growth';
import { MASTERY_EVOLUTION } from '../src/run/mastery';
import type { MoveTier, TypeId } from '../src/engine/content';

/** Every authored slate; Ancient is the only type still untiered (no authored slate yet). */
const TIERED_TYPES: readonly TypeId[] = [
  'Fire',
  'Water',
  'Frost',
  'Storm',
  'Stone',
  'Nature',
  'Light',
  'Shadow',
  'Arcane',
  'Mind',
  'Spirit',
  'Iron',
  'Beast',
  'Mech',
];

/** The level at which band `rank` opens on the hero's own schedule: 1 for Early, midLevel for Mid, lateLevel for Late. */
function levelForRank(heroId: string, rank: number): number {
  const schedule = scheduleFor(heroesById[heroId]);
  return rank >= MOVE_TIER_RANK.late ? schedule.lateLevel : rank >= MOVE_TIER_RANK.mid ? schedule.midLevel : 1;
}

function entryAtRank(heroId: string, rank: number, unlocked: readonly string[] = []) {
  let run = createRunState(0);
  run = addRosterEntry(run, { ...createRosterEntry(heroId, heroId, unlocked), xp: xpForLevel(levelForRank(heroId, rank)) });
  return run.roster[0];
}

const WARDEN = scheduleFor(heroesById.ironWarden);
const WARDEN_FIRST_OFFER = scheduleEntries(WARDEN).find((e) => e.kind === 'offer')!.level;

function poolOf(entry: RunState['roster'][number]): string[] {
  return levelMovePool(progressionTable, moves, heroesById[entry.heroId], entry);
}

test('move tiers: every move of a tiered slate carries a tier, and no other type does', () => {
  for (const move of Object.values(moves)) {
    // A class move wears a type for flavour and no tier: it is in no pool (test/classes.test.ts).
    // A signature likewise: its only source is the tenth Mastery pip (test/mastery.test.ts).
    if (classMoves[move.id] || signatureMoves[move.id]) continue;
    if (TIERED_TYPES.includes(move.type)) {
      assert.ok(move.tier, `${move.id} (${move.type}) has no tier`);
    } else {
      assert.strictEqual(move.tier, undefined, `${move.id} (${move.type}) carries a tier its slate does not`);
    }
  }
});

test('move tiers: each band offers its own tier — Early expires when Mid opens, Mid when Late does — and an untiered move is ungated', () => {
  const early = moves.swiftBlow; // Iron, Early
  const mid = moves.momentumSwing; // Iron, Mid
  const late = moves.juggernaut; // Iron, Late
  assert.deepStrictEqual([early.tier, mid.tier, late.tier], ['early', 'mid', 'late']);

  assert.deepStrictEqual(
    [1, 2, 3].map((rank) => [early, mid, late].filter((m) => isMoveTierOfferable(m, rank)).map((m) => m.tier)),
    [['early'], ['mid'], ['late']],
    'the band you are in is the band you learn from'
  );

  assert.strictEqual(moves.runicBlast.tier, undefined);
  assert.ok(isMoveTierOfferable(moves.runicBlast, 1));
  assert.ok(isMoveTierOfferable(moves.runicBlast, MAX_BAND_RANK), 'and an untiered move never expires either');
  assert.ok(isMoveTierOfferable(undefined, 1), 'a missing move must not gate — it is a content bug, not a lock');

  assert.deepStrictEqual(MOVE_TIER_RANK, { early: 1, mid: 2, late: 3 });
  assert.deepStrictEqual(MOVE_TIER_RANK_EXPIRY, { early: MOVE_TIER_RANK.mid, mid: MOVE_TIER_RANK.late, late: Infinity });
  assert.strictEqual(MAX_BAND_RANK, MOVE_TIER_RANK.late, 'the top band is the last one');
});

test('schedule: the default is the table a generated hero already read — offers every three levels, Mid at 10, Late at 21, and no Evolution on it', () => {
  assert.deepStrictEqual(DEFAULT_SCHEDULE, { offerLevels: [4, 7, 10, 13, 16, 19, 22, 25, 28], midLevel: 10, lateLevel: 21 });
  const entries = scheduleEntries(DEFAULT_SCHEDULE);
  assert.deepStrictEqual(
    entries.map((e) => [e.level, e.kind]),
    [[4, 'offer'], [7, 'offer'], [10, 'offer'], [13, 'offer'], [16, 'offer'], [19, 'offer'], [22, 'offer'], [25, 'offer'], [28, 'offer']],
    'every entry is an offer — the Evolution sits behind Mastery pips, not a level (docs/mastery.md)'
  );
  // A level not on the list is a plain level; an entry is owed once the level reaches it.
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const owed = pendingScheduleEntry(heroesById.ironWarden, { ...entryAtRank('ironWarden', 1), xp: xpForLevel(level) });
    assert.strictEqual(owed?.level, level >= WARDEN_FIRST_OFFER ? WARDEN_FIRST_OFFER : undefined, `level ${level} with nothing taken owes the first entry once it has reached it`);
  }
  const wardenEntries = scheduleEntries(WARDEN);
  assert.strictEqual(scheduleEntriesBelow(heroesById.ironWarden, 1), 0);
  assert.strictEqual(scheduleEntriesBelow(heroesById.ironWarden, WARDEN.midLevel), wardenEntries.filter((e) => e.level <= WARDEN.midLevel).length);
  assert.strictEqual(scheduleEntriesBelow(heroesById.ironWarden, MAX_LEVEL), wardenEntries.length);
  assert.strictEqual(scheduleFor(undefined), DEFAULT_SCHEDULE, 'an unauthored hero reads the default');
});

test('schedule: the band is read off level — Early below midLevel, Mid to lateLevel, Late past it', () => {
  assert.deepStrictEqual([1, 9, 10, 20, 21, 30].map((level) => bandRank(DEFAULT_SCHEDULE, level)), [1, 1, 2, 2, 3, 3]);
  assert.strictEqual(entryBandRank(heroesById.ironWarden, entryAtRank('ironWarden', 2)), 2);
});

test('move tiers: levelMovePool only offers what the hero\'s LEVEL has opened', () => {
  // Warden's pool: ironFist/pinDown/rockToss/bodyBlow are Early or untiered, rendArmor Mid, juggernaut Late.
  const atOne = poolOf(entryAtRank('ironWarden', 1));
  assert.ok(!atOne.includes('rendArmor'), 'a Mid move must not be offered below midLevel');
  assert.ok(!atOne.includes('juggernaut'), 'a Late move must not be offered below lateLevel');
  assert.ok(atOne.includes('ironFist'));

  const atTwo = poolOf(entryAtRank('ironWarden', 2));
  assert.ok(atTwo.includes('rendArmor'), 'Mid unlocks at midLevel');
  assert.ok(!atTwo.includes('juggernaut'));
  assert.ok(!atTwo.includes('ironFist'), 'and Early has EXPIRED — past midLevel a starter-tier move is never paid');

  const atThree = poolOf(entryAtRank('ironWarden', 3));
  assert.ok(atThree.includes('juggernaut'), 'Late unlocks at lateLevel');
  assert.ok(!atThree.includes('rendArmor'), 'and Mid has EXPIRED — the Late band teaches Late');
  assert.ok(!atThree.includes('ironFist'));

  const held = poolOf(entryAtRank('ironWarden', 3, ['juggernaut']));
  assert.ok(!held.includes('juggernaut'));
});

test("move tiers: a graft's line is gated on REACHING a tier, so its Early moves survive the expiry", () => {
  // Gating learnableMoveIds the way the base pool is gated would make every Early move in a grafted
  // type's line dead on arrival for any hero already past midLevel — and the Early moves are the way
  // INTO a type the hero has only just acquired.
  const early = Object.values(heroesById).flatMap((hero) =>
    (progressionTable.evolutions[hero.id] ?? [])
      .flatMap((node) => node.paths)
      .filter((path) => path.typeGraft)
      .flatMap((path) => (path.learnableMoveIds ?? []).filter((id) => (moves[id].tier ?? 'early') === 'early'))
  );
  assert.ok(early.length > 0, 'if no graft line carries an Early move, this exemption is dead code — delete it');

  // Cinderveil grafts Spirit and its line opens with Drain, an Early Spirit move.
  const path = progressionTable.evolutions.crimson[0].paths.find((p) => p.typeGraft === 'Spirit')!;
  assert.strictEqual(moves.drain.tier, 'early');
  assert.ok(path.learnableMoveIds?.includes('drain'));
  assert.ok(!isMoveTierOfferable(moves.drain, 2), 'Early is expired from Mid');

  const grafted = entryAtRank('crimson', 2);
  const pool = poolOf({ ...grafted, chosenPathIds: [path.id] });
  assert.ok(pool.includes('drain'), 'the graft carries its own Early moves past the expiry');
  assert.ok(
    !poolOf(grafted).includes('drain'),
    'and only for a hero that actually took the path'
  );
  assert.ok(!pool.includes('setAlight'), "the BASE pool's Early half is still expired");
});

test('move tiers: every move pool holds something a level-1 hero can be offered', () => {
  // A pool of nothing but Mid and Late moves means that hero learns nothing until midLevel.
  const starved = Object.keys(progressionTable.moveTiers)
    .filter((heroId) => poolOf(entryAtRank(heroId, 1)).length === 0)
    .sort();
  assert.deepStrictEqual(starved, [], 'these pools hold no move a level-1 hero can be offered');
});

test('schedule: the band is read at the level the offer lands on, so the level that reaches midLevel offers from Mid', () => {
  // The whole reason that level is the bigger moment rather than one more roll.
  const atMid = { ...entryAtRank('ironWarden', 1), xp: xpForLevel(WARDEN.midLevel) };
  const pool = poolOf(atMid);
  assert.ok(pool.includes('rendArmor'), 'the level that reaches midLevel rolls from Mid, not from Early');
  assert.ok(!pool.includes('ironFist'), 'and Early is already expired for it');
});

test('schedule: entries are taken in order, one per level-up, and a hero owed several works them off one at a time', () => {
  // What a raw hire's runway IS (docs/xp-overhaul.md §4): it arrives with the entries below its
  // level un-taken, and each level-up pays the next one until it has caught up.
  const hero = heroesById.ironWarden;
  const entries = scheduleEntries(WARDEN);
  const last = entries[entries.length - 1].level;
  const arriveAt = last - 1;
  let run = addRosterEntry(createRunState(0), { ...createRosterEntry('ironWarden', 'ironWarden', hero.moveIds), xp: xpForLevel(arriveAt) });
  assert.strictEqual(run.roster[0].scheduleTaken, 0);
  const owed = [];
  for (let i = 0; i < entries.length; i++) {
    const next = pendingScheduleEntry(hero, run.roster[0]);
    if (!next) break;
    owed.push(next.level);
    run = takeScheduleEntry(run, 'ironWarden');
  }
  const below = entries.filter((e) => e.level <= arriveAt).map((e) => e.level);
  assert.ok(below.length >= 2, 'the fixture needs a backlog');
  assert.deepStrictEqual(owed, below, `the offers below ${arriveAt}, in order`);
  assert.strictEqual(pendingScheduleEntry(hero, run.roster[0]), null, 'and then nothing, until the level moves');
  assert.ok(scheduleRemaining(hero, run.roster[0]), 'but the schedule is not finished');
  run = { ...run, roster: [levelUpEntry(run.roster[0], hero, 1).entry] };
  assert.strictEqual(pendingScheduleEntry(hero, run.roster[0])?.level, last, `level ${last} owes its offer`);
  assert.strictEqual(availableEvolution(progressionTable, run.roster[0]), null, 'and no level ever raises the Evolution');
  assert.ok(availableEvolution(progressionTable, atEvolution(run.roster[0])), `${MASTERY_EVOLUTION} pips do`);
  const done = { ...run.roster[0], xp: xpForLevel(MAX_LEVEL), scheduleTaken: entries.length };
  assert.strictEqual(scheduleRemaining(hero, done), false, 'past the last entry the hero is finished learning from levels');
  assert.strictEqual(pendingScheduleEntry(hero, done), null);
});

test('schedule: a dry band pays nothing and the entry is still taken — the next level is what opens the next band', () => {
  const wardenEarly = (progressionTable.moveTiers.ironWarden ?? []).filter((id) => (moves[id].tier ?? 'early') === 'early');
  const dryAtOne = { ...entryAtRank('ironWarden', 1), xp: xpForLevel(WARDEN_FIRST_OFFER), offeredMoveIds: wardenEarly };
  assert.deepStrictEqual(poolOf(dryAtOne), [], 'the band really is dry');
  assert.strictEqual(pendingScheduleEntry(heroesById.ironWarden, dryAtOne)?.level, WARDEN_FIRST_OFFER, 'the entry is still owed');
  const wholePool = progressionTable.moveTiers.ironWarden ?? [];
  const finished = { ...entryAtRank('ironWarden', MAX_BAND_RANK), offeredMoveIds: wholePool };
  assert.deepStrictEqual(poolOf(finished), [], 'nothing left to teach');
});

test('move tiers: the floor is a BAND surviving the offers the schedule makes from it', () => {
  // What a band must survive is the offers the schedule makes from it: two Early (4, 7) before
  // midLevel opens Mid, four Mid (10, 13, 16, 19) before lateLevel, and three Late (22, 25, 28)
  // from it.
  assert.deepStrictEqual(movePoolFloor(), { early: 2, mid: 4, late: 3 });
  assert.deepStrictEqual(movePoolFloor({ offerLevels: [3, 5, 8, 12, 20], midLevel: 6, lateLevel: 20 }), { early: 2, mid: 2, late: 1 });
});

test('move tiers: every hero clears every band without it running dry', () => {
  const floor = movePoolFloor();
  const tierOf = (id: string) => moves[id].tier ?? 'early';
  for (const hero of Object.values(heroesById)) {
    const pool = (progressionTable.moveTiers[hero.id] ?? []).filter((id) => !hero.moveIds.includes(id));
    const early = pool.filter((id) => tierOf(id) === 'early').length;
    const mid = pool.filter((id) => tierOf(id) === 'mid').length;
    const late = pool.filter((id) => tierOf(id) === 'late').length;
    assert.ok(early >= floor.early, `${hero.id} holds ${early} Early, floor is ${floor.early}`);
    assert.ok(mid >= floor.mid, `${hero.id} holds ${mid} Mid, floor is ${floor.mid}`);
    assert.ok(late >= floor.late, `${hero.id} holds ${late} Late, floor is ${floor.late}`);
  }
});

test('move tiers: every hero walks its whole schedule with a move to show for each offer, down every path', () => {
  // The arithmetic above models the drain; this WALKS it through the real calls, so the
  // offeredMoveIds bookkeeping is in the loop, and the Evolution lands where the pips put it —
  // taken at the hero's midLevel here, with a graft's line in the pool for the offers after. Both
  // answers to an offer are exercised because both spend it: declining burns the move exactly as
  // taking it does.
  for (const hero of Object.values(heroesById)) {
    const paths = (progressionTable.evolutions[hero.id] ?? []).flatMap((node) => node.paths);
    const schedule = scheduleFor(hero);
    const entries = scheduleEntries(schedule);
    for (const path of paths) {
      let run = addRosterEntry(createRunState(0), createRosterEntry(hero.id, hero.id, hero.moveIds));
      let decline = false;
      for (const step of entries) {
        run = { ...run, roster: [{ ...run.roster[0], xp: xpForLevel(step.level) }] };
        const owed = pendingScheduleEntry(hero, run.roster[0]);
        assert.strictEqual(owed?.level, step.level, `${hero.id}: level ${step.level} owes its entry`);
        if (step.level >= schedule.midLevel && run.roster[0].chosenPathIds.length === 0) {
          run = { ...run, roster: [atEvolution(run.roster[0])] };
          assert.ok(availableEvolution(progressionTable, run.roster[0]), `${hero.id}: the Evolution opened at ${MASTERY_EVOLUTION} pips`);
          run = chooseEvolutionPath(run, progressionTable, heroesById, hero.id, path.id);
        }
        const offerable = poolOf(run.roster[0]);
        assert.ok(
          offerable.length > 0,
          `${hero.id} via ${path.id}: the offer at level ${step.level} had nothing to offer in band ${entryBandRank(hero, run.roster[0])}`
        );
        const moveId = offerable[0];
        run = takeScheduleEntry(run, hero.id);
        run = decline
          ? recordMoveOffer(run, hero.id, [moveId])
          : grantOfferedMove(run, hero.id, moveId, run.roster[0].unlockedMoveIds[0]);
        decline = !decline;
      }
      assert.strictEqual(run.roster[0].scheduleTaken, entries.length, `${hero.id} via ${path.id} did not take every entry`);
      assert.strictEqual(scheduleRemaining(hero, run.roster[0]), false);
      assert.ok(run.roster[0].chosenPathIds.includes(path.id), `${hero.id} via ${path.id} never evolved`);
    }
  }
});

test('move tiers: a loadout filled from the hero\'s own pool still leaves the first offer something to roll', () => {
  // Worst case, not the tidy one: before a single offer, events fill the whole loadout with moves
  // out of this hero's own Early pool. They spend no offer (grantMove) but they are HELD, so
  // levelMovePool filters them all the same — which is the thinnest an Early band ever gets.
  for (const hero of Object.values(heroesById)) {
    let run = addRosterEntry(createRunState(0), createRosterEntry(hero.id, hero.id, hero.moveIds));
    for (let slot = 0; slot < MOVE_CAP; slot++) {
      const gift = poolOf(run.roster[0])[slot];
      if (!gift) break;
      run = grantMove(run, hero.id, gift, run.roster[0].unlockedMoveIds[0]);
    }
    const first = scheduleEntries(scheduleFor(hero)).find((e) => e.kind === 'offer')!;
    assert.ok(
      poolOf({ ...run.roster[0], xp: xpForLevel(first.level) }).length > 0,
      `${hero.id} has nothing to offer at its first schedule level with a loadout drawn from its own pool`
    );
  }
});

test('move tiers: every hero has an Evolution node — the precondition the schedule walk asserts on', () => {
  // The walk above asserts the Evolution entry evolves; a hero with no node would pass it silently,
  // which is how Tempest sat evolution-less without a single test noticing.
  const missing = Object.keys(heroesById)
    .filter((heroId) => (progressionTable.evolutions[heroId] ?? []).length === 0)
    .sort();
  assert.deepStrictEqual(missing, [], 'these heroes can never evolve');
});

test('move tiers: every Evolution node offers exactly three paths, differing in kind', () => {
  for (const [heroId, nodes] of Object.entries(progressionTable.evolutions)) {
    for (const node of nodes) {
      const kinds = node.paths.map((p) => p.kind).sort();
      assert.deepStrictEqual(kinds, ['defensive', 'offensive', 'utility'], heroId);
    }
  }
});

test('move tiers: every move an Evolution grants or unlocks exists, and a graft only grants its own type', () => {
  for (const [heroId, nodes] of Object.entries(progressionTable.evolutions)) {
    for (const node of nodes) {
      for (const path of node.paths) {
        assert.strictEqual(path.heroId, heroId, `${path.id} is filed under the wrong hero`);
        for (const id of [...path.unlocksMoveIds, ...(path.learnableMoveIds ?? [])]) {
          assert.ok(moves[id], `${path.id} references unknown move ${id}`);
        }
        // A graft that hands over moves of some third type would be paying in something it did not buy.
        if (path.typeGraft) {
          const off = (path.learnableMoveIds ?? []).filter(
            (id) => moves[id].type !== path.typeGraft && !heroesById[heroId].types.includes(moves[id].type)
          );
          assert.deepStrictEqual(off, [], `${path.id} learns moves of neither its graft nor its innate type`);
        }
      }
    }
  }
});

test("schedule: every hero's schedule is legal — sorted offers, the Evolution inside the run, and the bands in order", () => {
  // The authoring rules docs/xp-overhaul.md §4 sets for the per-hero pass: an Evolution between 10
  // and 24 (a hero that cannot evolve in a run is a trap pick), Mid before Late, and enough offers
  // to climb out of every band. Until phase 4 every hero reads the default, which must pass too.
  for (const hero of Object.values(heroesById)) {
    const schedule = scheduleFor(hero);
    const sorted = [...schedule.offerLevels].sort((a, b) => a - b);
    assert.deepStrictEqual([...schedule.offerLevels], sorted, `${hero.id}: offer levels out of order`);
    assert.strictEqual(new Set(schedule.offerLevels).size, schedule.offerLevels.length, `${hero.id}: a level listed twice`);
    assert.ok(schedule.offerLevels.every((l) => l >= 2 && l <= MAX_LEVEL), `${hero.id}: an offer level off the curve`);
    assert.ok(schedule.midLevel < schedule.lateLevel, `${hero.id}: Late opens before Mid`);
    assert.ok(schedule.midLevel > 1 && schedule.lateLevel <= MAX_LEVEL, `${hero.id}: a band outside the curve`);
    const floor = movePoolFloor(schedule);
    assert.ok(floor.early >= 1 && floor.mid >= 1 && floor.late >= 1, `${hero.id}: a band with no offer from it`);
    void levelOf;
  }
});

test('schedule: every hero authors its own — none on the default — with 4-7 offers', () => {
  // The per-hero pass (docs/xp-overhaul.md §8 phase 4). A hero left on DEFAULT_SCHEDULE would be
  // indistinguishable from a contract hero of the same level. The Evolution's timing is no longer
  // here (every hero turns at MASTERY_EVOLUTION pips, docs/mastery.md); the offers are.
  let offers = 0;
  for (const hero of Object.values(heroesById)) {
    assert.ok(hero.schedule, `${hero.id} is on the default schedule`);
    assert.notStrictEqual(hero.schedule, DEFAULT_SCHEDULE);
    const count = hero.schedule.offerLevels.length;
    assert.ok(count >= 4 && count <= 7, `${hero.id} makes ${count} offers`);
    offers += count;
  }
  const heroCount = Object.keys(heroesById).length;
  assert.ok(offers / heroCount <= 6.5, `${(offers / heroCount).toFixed(1)} offers a hero on average — the ladder's nine was 41 decisions a run`);
});
