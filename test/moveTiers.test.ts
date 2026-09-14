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

/** The level at which band `rank` opens on the default schedule: 1 for Early, midLevel for Mid, lateLevel for Late. */
function levelForRank(rank: number): number {
  return rank >= MOVE_TIER_RANK.late ? DEFAULT_SCHEDULE.lateLevel : rank >= MOVE_TIER_RANK.mid ? DEFAULT_SCHEDULE.midLevel : 1;
}

function entryAtRank(heroId: string, rank: number, unlocked: readonly string[] = []) {
  let run = createRunState(0);
  run = addRosterEntry(run, { ...createRosterEntry(heroId, heroId, unlocked), xp: xpForLevel(levelForRank(rank)) });
  return run.roster[0];
}

function poolOf(entry: RunState['roster'][number]): string[] {
  return levelMovePool(progressionTable, moves, heroesById[entry.heroId], entry);
}

test('move tiers: every move of a tiered slate carries a tier, and no other type does', () => {
  for (const move of Object.values(moves)) {
    // A class move wears a type for flavour and no tier: it is in no pool (test/classes.test.ts).
    if (classMoves[move.id]) continue;
    if (TIERED_TYPES.includes(move.type)) {
      assert.ok(move.tier, `${move.id} (${move.type}) has no tier`);
    } else {
      assert.strictEqual(move.tier, undefined, `${move.id} (${move.type}) carries a tier its slate does not`);
    }
  }
});

test('move tiers: Early EXPIRES when Mid opens, Mid and Late accumulate, and an untiered move is ungated', () => {
  const early = moves.swiftBlow; // Iron, Early
  const mid = moves.momentumSwing; // Iron, Mid
  const late = moves.juggernaut; // Iron, Late
  assert.deepStrictEqual([early.tier, mid.tier, late.tier], ['early', 'mid', 'late']);

  assert.deepStrictEqual(
    [1, 2, 3].map((rank) => [early, mid, late].filter((m) => isMoveTierOfferable(m, rank)).map((m) => m.tier)),
    [['early'], ['mid'], ['mid', 'late']],
    'Early is off the table from MOVE_TIER_RANK.mid; nothing else ever closes'
  );

  assert.strictEqual(moves.runicBlast.tier, undefined);
  assert.ok(isMoveTierOfferable(moves.runicBlast, 1));
  assert.ok(isMoveTierOfferable(moves.runicBlast, MAX_BAND_RANK), 'and an untiered move never expires either');
  assert.ok(isMoveTierOfferable(undefined, 1), 'a missing move must not gate — it is a content bug, not a lock');

  assert.deepStrictEqual(MOVE_TIER_RANK, { early: 1, mid: 2, late: 3 });
  assert.deepStrictEqual(MOVE_TIER_RANK_EXPIRY, { early: MOVE_TIER_RANK.mid, mid: Infinity, late: Infinity });
  assert.strictEqual(MAX_BAND_RANK, MOVE_TIER_RANK.late, 'the top band is the last one');
});

test('schedule: the default is the table a generated hero already read — offers every three levels, Mid at 10, the Evolution at 16, Late at 21', () => {
  assert.deepStrictEqual(DEFAULT_SCHEDULE, { offerLevels: [4, 7, 10, 13, 16, 19, 22, 25, 28], midLevel: 10, evolutionLevel: 16, lateLevel: 21 });
  const entries = scheduleEntries(DEFAULT_SCHEDULE);
  assert.deepStrictEqual(
    entries.map((e) => [e.level, e.kind]),
    [[4, 'offer'], [7, 'offer'], [10, 'offer'], [13, 'offer'], [16, 'evolution'], [19, 'offer'], [22, 'offer'], [25, 'offer'], [28, 'offer']],
    'the offer at evolutionLevel IS the Evolution'
  );
  // A mortal entry: the Evolution level and the Late level are tier-steps, Late added if it was not an offer level.
  assert.deepStrictEqual(
    scheduleEntries(DEFAULT_SCHEDULE, true).filter((e) => e.kind !== 'offer').map((e) => [e.level, e.kind]),
    [[16, 'step'], [21, 'step']]
  );
  // A level not on the list is a plain level; an entry is owed once the level reaches it.
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const owed = pendingScheduleEntry(heroesById.ironWarden, { ...entryAtRank('ironWarden', 1), xp: xpForLevel(level) });
    assert.strictEqual(owed?.level, level >= 4 ? 4 : undefined, `level ${level} with nothing taken owes the first entry once it has reached it`);
  }
  assert.strictEqual(scheduleEntriesBelow(heroesById.ironWarden, 1), 0);
  assert.strictEqual(scheduleEntriesBelow(heroesById.ironWarden, 16), 5);
  assert.strictEqual(scheduleEntriesBelow(heroesById.ironWarden, 30), 9);
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
  assert.ok(atThree.includes('rendArmor'), 'and Mid is still on the table — only Early ever closes');
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
  const atMid = { ...entryAtRank('ironWarden', 1), xp: xpForLevel(DEFAULT_SCHEDULE.midLevel) };
  const pool = poolOf(atMid);
  assert.ok(pool.includes('rendArmor'), 'the level that reaches midLevel rolls from Mid, not from Early');
  assert.ok(!pool.includes('ironFist'), 'and Early is already expired for it');
});

test('schedule: entries are taken in order, one per level-up, and a hero owed several works them off one at a time', () => {
  // What a raw hire's runway IS (docs/xp-overhaul.md §4): it arrives with the entries below its
  // level un-taken, and each level-up pays the next one until it has caught up.
  const hero = heroesById.ironWarden;
  let run = addRosterEntry(createRunState(0), { ...createRosterEntry('ironWarden', 'ironWarden', hero.moveIds), xp: xpForLevel(15) });
  assert.strictEqual(run.roster[0].scheduleTaken, 0);
  const owed = [];
  for (let i = 0; i < 6; i++) {
    const next = pendingScheduleEntry(hero, run.roster[0]);
    if (!next) break;
    owed.push(next.level);
    run = takeScheduleEntry(run, 'ironWarden');
  }
  assert.deepStrictEqual(owed, [4, 7, 10, 13], 'the four offers below 15, in order — the Evolution at 16 is not yet reached');
  assert.strictEqual(pendingScheduleEntry(hero, run.roster[0]), null, 'and then nothing, until the level moves');
  assert.ok(scheduleRemaining(hero, run.roster[0]), 'but the schedule is not finished');
  run = { ...run, roster: [levelUpEntry(run.roster[0], hero, 1).entry] };
  assert.strictEqual(pendingScheduleEntry(hero, run.roster[0])?.kind, 'evolution', 'level 16 owes the Evolution');
  assert.ok(availableEvolution(progressionTable, hero, run.roster[0]), 'and availableEvolution reads the same entry');
  const done = { ...run.roster[0], xp: xpForLevel(MAX_LEVEL), scheduleTaken: scheduleEntries(DEFAULT_SCHEDULE).length };
  assert.strictEqual(scheduleRemaining(hero, done), false, 'past the last entry the hero is finished learning from levels');
  assert.strictEqual(pendingScheduleEntry(hero, done), null);
});

test('schedule: a dry band pays nothing and the entry is still taken — the next level is what opens the next band', () => {
  const wardenEarly = (progressionTable.moveTiers.ironWarden ?? []).filter((id) => (moves[id].tier ?? 'early') === 'early');
  const dryAtOne = { ...entryAtRank('ironWarden', 1), xp: xpForLevel(4), offeredMoveIds: wardenEarly };
  assert.deepStrictEqual(poolOf(dryAtOne), [], 'the band really is dry');
  assert.strictEqual(pendingScheduleEntry(heroesById.ironWarden, dryAtOne)?.level, 4, 'the entry is still owed');
  const wholePool = progressionTable.moveTiers.ironWarden ?? [];
  const finished = { ...entryAtRank('ironWarden', MAX_BAND_RANK), offeredMoveIds: wholePool };
  assert.deepStrictEqual(poolOf(finished), [], 'nothing left to teach');
});

test('move tiers: the floor is a BAND surviving the offers the schedule makes from it', () => {
  // What a band must survive is the offers the schedule makes from it: two Early (4, 7) before
  // midLevel opens Mid, three Mid (10, 13, 19 — 16 is the Evolution and offers nothing) before
  // lateLevel, and Mid+Late only has to offer once, since the Late band is open-ended.
  assert.deepStrictEqual(movePoolFloor(), { early: 2, mid: 3, midLate: 1 });
  assert.deepStrictEqual(movePoolFloor({ offerLevels: [3, 5, 8, 12, 20], midLevel: 6, evolutionLevel: 12, lateLevel: 20 }), { early: 2, mid: 1, midLate: 1 });
});

test('move tiers: every hero clears every band without it running dry', () => {
  const floor = movePoolFloor();
  const tierOf = (id: string) => moves[id].tier ?? 'early';
  for (const hero of Object.values(heroesById)) {
    const pool = (progressionTable.moveTiers[hero.id] ?? []).filter((id) => !hero.moveIds.includes(id));
    const early = pool.filter((id) => tierOf(id) === 'early').length;
    const mid = pool.filter((id) => tierOf(id) === 'mid').length;
    const midLate = pool.filter((id) => tierOf(id) !== 'early').length;
    assert.ok(early >= floor.early, `${hero.id} holds ${early} Early, floor is ${floor.early}`);
    assert.ok(mid >= floor.mid, `${hero.id} holds ${mid} Mid, floor is ${floor.mid}`);
    assert.ok(midLate >= floor.midLate, `${hero.id} holds ${midLate} Mid+Late, floor is ${floor.midLate}`);
  }
});

test('move tiers: every hero walks its whole schedule with a move to show for each offer, down every path', () => {
  // The arithmetic above models the drain; this WALKS it through the real calls, so the
  // offeredMoveIds bookkeeping is in the loop, and the Evolution lands where the schedule puts it
  // — at evolutionLevel, with a graft's line in the pool for the offer after. Both answers to an
  // offer are exercised because both spend it: declining burns the move exactly as taking it does.
  for (const hero of Object.values(heroesById)) {
    const paths = (progressionTable.evolutions[hero.id] ?? []).flatMap((node) => node.paths);
    const entries = scheduleEntries(scheduleFor(hero));
    for (const path of paths) {
      let run = addRosterEntry(createRunState(0), createRosterEntry(hero.id, hero.id, hero.moveIds));
      let decline = false;
      for (const step of entries) {
        run = { ...run, roster: [{ ...run.roster[0], xp: xpForLevel(step.level) }] };
        const owed = pendingScheduleEntry(hero, run.roster[0]);
        assert.strictEqual(owed?.level, step.level, `${hero.id}: level ${step.level} owes its entry`);
        if (step.kind === 'evolution') {
          assert.ok(availableEvolution(progressionTable, hero, run.roster[0]), `${hero.id}: the Evolution opened at ${step.level}`);
          run = chooseEvolutionPath(run, progressionTable, heroesById, hero.id, path.id);
          continue;
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
      assert.deepStrictEqual(kinds, ['defensive', 'offensive', 'utility'], `${heroId} at level ${scheduleFor(heroesById[heroId]).evolutionLevel}`);
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
    assert.ok(schedule.evolutionLevel >= 10 && schedule.evolutionLevel <= 24, `${hero.id}: evolves at ${schedule.evolutionLevel}, outside 10-24`);
    assert.ok(schedule.midLevel < schedule.lateLevel, `${hero.id}: Late opens before Mid`);
    assert.ok(schedule.midLevel > 1 && schedule.lateLevel <= MAX_LEVEL, `${hero.id}: a band outside the curve`);
    const floor = movePoolFloor(schedule);
    assert.ok(floor.early >= 1 && floor.mid >= 1 && floor.midLate >= 1, `${hero.id}: a band with no offer from it`);
    void atEvolution;
    void levelOf;
  }
});
