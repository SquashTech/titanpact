// The Class system (src/data/classes.ts, src/run/classes.ts): a Class is a VERB — a move or a
// passive, never a stat line — one per hero per run, tempered in at the Crucible
// (docs/growth-overhaul.md §11).

import * as assert from 'assert';
import { test } from './harness';
import { isValidPassiveDefinition } from '../src/engine/content';
import { classes, classMoves, classPassives } from '../src/data/classes';
import { boonPassives, passives } from '../src/data/passives';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { pickSquad } from '../src/run/squad';
import { buildCombatState } from '../src/run/buildCombatState';
import { fullMovepool, MOVE_CAP } from '../src/run/progression';
import { tutorMovePool } from '../src/run/tutor';
import {
  CLASS_KINDS,
  anyClassAvailable,
  chosenClass,
  classMoveOverflows,
  grantClass,
  isValidClassDefinition,
  rollClassOffers,
  CRUCIBLE_OFFER_COUNT,
  ClassError,
} from '../src/run/classes';
import { entryPassiveCounts } from '../src/run/entryStats';

// --- Catalog validity ---

test('classes: every Class grants exactly one verb — a move or a passive, never both, never a stat line', () => {
  for (const cls of Object.values(classes)) {
    assert.ok(isValidClassDefinition(cls), `${cls.id} must grant exactly one of a move or a passive`);
    assert.ok(!('statGrants' in cls), `${cls.id} carries a stat line — a Class is a verb`);
    if (cls.grantsMoveId) assert.ok(classMoves[cls.grantsMoveId] && moves[cls.grantsMoveId], `${cls.id}'s move ${cls.grantsMoveId} is not in the catalog`);
    if (cls.grantsPassiveId) {
      assert.ok(classPassives[cls.grantsPassiveId] && passives[cls.grantsPassiveId], `${cls.id}'s passive is not in the catalog`);
      assert.ok(isValidPassiveDefinition(passives[cls.grantsPassiveId]), `${cls.id}'s passive is not valid content`);
      assert.strictEqual(passives[cls.grantsPassiveId].statGrants, undefined, `${cls.id}'s passive is a bare stat grant`);
    }
  }
});

test('classes: three of each kind, as authored', () => {
  for (const kind of CLASS_KINDS) {
    const ofKind = Object.values(classes).filter((cls) => cls.kind === kind);
    assert.strictEqual(ofKind.length, 3, `${kind} has ${ofKind.length} Classes`);
  }
});

test('classes: a class move is in no Scroll pool and no Tutor pool, and a class passive is in no Boon pool', () => {
  // The exclusivity that keeps a Class from being a Boon with a hat (docs/growth-overhaul.md §11).
  for (const id of Object.keys(classMoves)) {
    assert.strictEqual(moves[id].tier, undefined, `${id} carries a tier — class moves are un-ranked`);
    for (const hero of Object.values(heroes)) {
      assert.ok(!fullMovepool(progressionTable, hero).includes(id), `${id} is in ${hero.id}'s Scroll pool`);
      const entry = createRosterEntry(hero.id, hero.id, hero.moveIds);
      assert.ok(!tutorMovePool(progressionTable, moves, entry).includes(id), `${id} is in ${hero.id}'s Tutor pool`);
    }
  }
  for (const id of Object.keys(classPassives)) {
    assert.ok(!boonPassives[id], `${id} is in the Boon pool`);
  }
});

test('classes: rollClassOffers returns three distinct Classes from the whole catalog', () => {
  const offers = rollClassOffers(classes, () => 0.5);
  assert.strictEqual(offers.length, CRUCIBLE_OFFER_COUNT);
  assert.strictEqual(new Set(offers.map((c) => c.id)).size, CRUCIBLE_OFFER_COUNT, 'no Class is offered twice');
  const first = rollClassOffers(classes, () => 0);
  const last = rollClassOffers(classes, () => 0.999);
  assert.notDeepStrictEqual(first.map((c) => c.id), last.map((c) => c.id), 'the roll should reach different Classes');
  // Kind no longer constrains the roll: three of one kind is a legal spread.
  assert.ok(first.every((c) => c.kind === first[0].kind), 'the lowest rolls walk the catalog in authored order');
});

// --- grantClass / chosenClass ---

function seedRoster(heroIds: string[]) {
  let run = createRunState(0);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

test('classes: a passive-Class sets classId and classPassiveId on the targeted entry only', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller']);
  const next = grantClass(run, classes, 'cinderKnight', 'warden');
  const knight = next.roster.find((r) => r.rosterId === 'cinderKnight')!;
  assert.strictEqual(knight.classId, 'warden');
  assert.strictEqual(knight.classPassiveId, 'warden');
  assert.deepStrictEqual(knight.unlockedMoveIds, [...heroes.cinderKnight.moveIds], 'a passive-Class teaches no move');
  assert.strictEqual(next.roster.find((r) => r.rosterId === 'tidecaller')?.classId, null);
  assert.strictEqual(entryPassiveCounts(knight, equipment).warden, 1, 'the passive is counted off the entry, catalog-free');
});

test('classes: a move-Class lands its move in an open slot, and records no passive', () => {
  const run = seedRoster(['cinderKnight']);
  assert.ok(run.roster[0].unlockedMoveIds.length < MOVE_CAP, 'fixture: the starting kit leaves a slot open');
  const next = grantClass(run, classes, 'cinderKnight', 'duelist');
  assert.strictEqual(next.roster[0].classId, 'duelist');
  assert.strictEqual(next.roster[0].classPassiveId, null);
  assert.ok(next.roster[0].unlockedMoveIds.includes('feint'));
  assert.deepStrictEqual(entryPassiveCounts(next.roster[0], equipment), {}, 'no phantom passive for a move-Class');
});

test('classes: at the cap a move-Class replaces on request, or takes the Class without the move when declined', () => {
  let run = seedRoster(['cinderKnight']);
  const full = [...heroes.cinderKnight.moveIds, 'feint'].slice(0, MOVE_CAP);
  run = { ...run, roster: [{ ...run.roster[0], unlockedMoveIds: full }] };
  assert.ok(classMoveOverflows(classes.ranger, run.roster[0]), 'the kit is full, so Volley overflows');

  const replaced = grantClass(run, classes, 'cinderKnight', 'ranger', full[0]);
  assert.ok(replaced.roster[0].unlockedMoveIds.includes('volley'));
  assert.ok(!replaced.roster[0].unlockedMoveIds.includes(full[0]));
  assert.strictEqual(replaced.roster[0].unlockedMoveIds.length, MOVE_CAP);

  const declined = grantClass(run, classes, 'cinderKnight', 'ranger');
  assert.strictEqual(declined.roster[0].classId, 'ranger', 'the Class is still taken');
  assert.deepStrictEqual(declined.roster[0].unlockedMoveIds, full, 'and the kit is untouched');
});

test('classes: a hero can only hold one Class per run — granting a second REPLACES the first, passive and all', () => {
  const run = seedRoster(['cinderKnight']);
  const withWarden = grantClass(run, classes, 'cinderKnight', 'warden');
  const withDuelist = grantClass(withWarden, classes, 'cinderKnight', 'duelist');
  assert.strictEqual(withDuelist.roster[0].classId, 'duelist');
  assert.strictEqual(withDuelist.roster[0].classPassiveId, null, 'the replaced Class takes its passive with it');
});

test('classes: grantClass throws on an unknown roster id or an unknown class id', () => {
  const run = seedRoster(['cinderKnight']);
  assert.throws(() => grantClass(run, classes, 'nonexistent', 'warden'), ClassError);
  assert.throws(() => grantClass(run, classes, 'cinderKnight', 'nonexistentClass'), ClassError);
});

test('classes: chosenClass resolves a granted classId back to its full data, or null if none chosen', () => {
  const run = seedRoster(['cinderKnight']);
  assert.strictEqual(chosenClass(classes, run.roster[0]), null);
  const withWarden = grantClass(run, classes, 'cinderKnight', 'warden');
  assert.strictEqual(chosenClass(classes, withWarden.roster[0])?.name, 'Warden');
});

test('classes: anyClassAvailable is what the Crucible opens on — false only once every hero holds one', () => {
  let run = seedRoster(['cinderKnight', 'tidecaller']);
  assert.ok(anyClassAvailable(run.roster));
  run = grantClass(run, classes, 'cinderKnight', 'warden');
  assert.ok(anyClassAvailable(run.roster));
  run = grantClass(run, classes, 'tidecaller', 'monk');
  assert.ok(!anyClassAvailable(run.roster));
});

// --- buildCombatState integration ---

test('buildCombatState: a granted passive-Class stands on the combatant as a passive in a real fight', () => {
  let run = seedRoster(['cinderKnight', 'tidecaller']);
  run = grantClass(run, classes, 'cinderKnight', 'berserker');
  const squad = pickSquad(run.roster, ['cinderKnight', 'tidecaller']);
  const aiRun = seedRoster(['ironWarden', 'wildOracle']);
  const aiSquad = pickSquad(aiRun.roster, ['ironWarden', 'wildOracle']);

  const state = buildCombatState(
    1,
    heroes,
    equipment,
    [
      { side: 'A', squad, roster: run.roster },
      { side: 'B', squad: aiSquad, roster: aiRun.roster },
    ],
    passives
  );

  assert.strictEqual(state.combatants['A:cinderKnight'].passives.berserker?.stacks, 1);
  assert.strictEqual(state.combatants['A:tidecaller'].passives.berserker, undefined);
});
