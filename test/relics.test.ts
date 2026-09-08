import * as assert from 'assert';
import { test } from './harness';
import { isValidRelicDefinition, relicTeamStatModifiers } from '../src/run/relics';
import { relics, gemRelics, guardianBannerRelics } from '../src/data/relics';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { passives } from '../src/data/passives';
import { classes } from '../src/data/classes';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { pickSquad } from '../src/run/squad';
import { buildCombatState } from '../src/run/buildCombatState';
import { grantClass } from '../src/run/classes';
import { relicTeamPassiveGrants } from '../src/run/passives';
import { entryPassiveCounts, entryStatModifiers, relicStatContribution } from '../src/run/entryStats';

test('relics: fixture relic content is all valid (multiples of 5/10)', () => {
  for (const relic of Object.values(relics)) {
    assert.ok(isValidRelicDefinition(relic), `${relic.id} has an invalid stat grant`);
  }
});

test('relics: isValidRelicDefinition rejects a non-multiple-of-5 grant', () => {
  assert.strictEqual(isValidRelicDefinition({ id: 'bad', name: 'Bad', statGrants: { attack: 7 } }), false);
});

// The catalog is two closed families now (2026-09-07): the random relic pool is gone, because a
// team-wide passive applied to all four heroes at once was either a bigger Gem or unanswerable.
test('relics: the catalog is exactly the Banners plus the Gems', () => {
  assert.strictEqual(Object.values(relics).length, guardianBannerRelics.length + gemRelics.length);
  for (const relic of Object.values(relics)) {
    assert.ok(relic.guardianBanner || relic.gem, `${relic.id} belongs to neither family`);
    assert.ok(!relic.grantsPassiveIds?.length, `${relic.id} grants a team-wide passive`);
    assert.ok(!relic.grantsStatusIds?.length, `${relic.id} grants a team-wide status`);
  }
});

test('relics: relicTeamStatModifiers merges owned relics additively and ignores unknown ids', () => {
  const mods = relicTeamStatModifiers(['bannerOfSwiftness', 'onyxGem', 'unknown-relic'], relics);
  assert.deepStrictEqual(mods, { speed: 20, defense: 5 });
});

test('relics: relicTeamStatModifiers stacks a duplicate relic id', () => {
  const mods = relicTeamStatModifiers(['onyxGem', 'onyxGem'], relics);
  assert.strictEqual(mods.defense, 10);
});

test('relics: no owned relics yields no modifiers', () => {
  assert.deepStrictEqual(relicTeamStatModifiers([], relics), {});
});

// --- The Guardian's Banner (docs/run-loop.md): never randomly offered, designed to stack ---

test('relics: the five Guardian Banners are catalogued, in offer order', () => {
  assert.deepStrictEqual(
    guardianBannerRelics.map((r) => r.id),
    ['bannerOfVitality', 'bannerOfTheWarcry', 'bannerOfTheBulwark', 'bannerOfSwiftness', 'bannerOfTheWellspring']
  );
  for (const banner of guardianBannerRelics) {
    assert.strictEqual(relics[banner.id], banner, `${banner.id} is missing from the relic catalog`);
    assert.strictEqual(banner.guardianBanner, true);
  }
});

test('relics: a Banner taken four times stacks to four times its grant', () => {
  const mods = relicTeamStatModifiers(['bannerOfVitality', 'bannerOfVitality', 'bannerOfVitality', 'bannerOfVitality'], relics);
  assert.deepStrictEqual(mods, { hp: 240 });
});

test('relics: the five Banners cover five different axes, and no axis twice', () => {
  // One Banner per axis is what makes five acts of fixed offers a spread-or-commit decision.
  assert.deepStrictEqual(relics.bannerOfVitality.statGrants, { hp: 60 });
  assert.deepStrictEqual(relics.bannerOfTheWarcry.statGrants, { attack: 20, intelligence: 20 });
  assert.deepStrictEqual(relics.bannerOfTheBulwark.statGrants, { defense: 15, wisdom: 15 });
  assert.deepStrictEqual(relics.bannerOfSwiftness.statGrants, { speed: 20 });
  assert.deepStrictEqual(relics.bannerOfTheWellspring.statGrants, { manaPool: 40, mpRegen: 10 });

  // No stat is carried by two Banners — an axis reachable two ways is one the player cannot price.
  const carried = guardianBannerRelics.flatMap((r) => Object.keys(r.statGrants));
  assert.strictEqual(new Set(carried).size, carried.length, 'two Banners carry the same stat');
});

// --- Out-of-combat sheet parity: the sheet and buildCombatState both go through entryStats.ts ---

test('entryStats: the out-of-combat sheet math equals the combatant a fight actually builds', () => {
  const relicIds = ['bannerOfSwiftness', 'onyxGem', 'onyxGem'];
  let run = createRunState(10);
  run = addRosterEntry(run, createRosterEntry('cinderKnight', 'cinderKnight', heroes.cinderKnight.moveIds));
  run = grantClass(run, classes, 'cinderKnight', 'warrior');

  const teamStatModifiers = relicTeamStatModifiers(relicIds, relics);
  const teamPassiveGrants = relicTeamPassiveGrants(relicIds, relics);
  const entry = run.roster[0];
  const counts = entryPassiveCounts(entry, equipment, teamPassiveGrants);
  const sheetMods = entryStatModifiers(entry, equipment, passives, counts, teamStatModifiers);

  const state = buildCombatState(
    1,
    heroes,
    equipment,
    [{ side: 'A', squad: pickSquad(run.roster, ['cinderKnight']), roster: run.roster, teamStatModifiers, teamPassiveGrants }],
    passives
  );

  assert.deepStrictEqual(sheetMods, state.combatants['A:cinderKnight'].baselineStatModifiers);
  assert.strictEqual(sheetMods.speed, 20);
  assert.strictEqual(sheetMods.defense, 10 + (classes.warrior.statGrants?.defense ?? 0));
});

test('entryStats: relicStatContribution isolates the relic-sourced slice', () => {
  const relicIds = ['bannerOfSwiftness'];
  const contribution = relicStatContribution(
    relicTeamStatModifiers(relicIds, relics),
    relicTeamPassiveGrants(relicIds, relics),
    passives
  );
  assert.deepStrictEqual(contribution, { speed: 20 });
  assert.deepStrictEqual(relicStatContribution({}, {}, passives), {});
});
