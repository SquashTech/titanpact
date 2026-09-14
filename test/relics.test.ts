import * as assert from 'assert';
import { test } from './harness';
import { isValidRelicDefinition, relicTeamStatModifiers } from '../src/run/relics';
import { relics, guardianBannerRelics } from '../src/data/relics';
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

// One closed family (2026-09-09): the random relic pool went in 2026-09-07, because a team-wide
// passive applied to all four heroes at once was either a bigger stat grant or unanswerable.
test('relics: the catalog is exactly the Banners', () => {
  assert.strictEqual(Object.values(relics).length, guardianBannerRelics.length);
  for (const relic of Object.values(relics)) {
    assert.ok(relic.guardianBanner, `${relic.id} is not a Banner`);
    assert.ok(!relic.grantsPassiveIds?.length, `${relic.id} grants a team-wide passive`);
    assert.ok(!relic.grantsStatusIds?.length, `${relic.id} grants a team-wide status`);
  }
});

test('relics: relicTeamStatModifiers merges owned relics additively and ignores unknown ids', () => {
  const mods = relicTeamStatModifiers(['bannerOfTheWarcry', 'bannerOfTheBulwark', 'unknown-relic'], relics);
  assert.deepStrictEqual(mods, { attack: 40, intelligence: 40, defense: 15, wisdom: 15 });
});

test('relics: relicTeamStatModifiers stacks a duplicate relic id', () => {
  const mods = relicTeamStatModifiers(['bannerOfTheBulwark', 'bannerOfTheBulwark'], relics);
  assert.strictEqual(mods.defense, 30);
});

test('relics: no owned relics yields no modifiers', () => {
  assert.deepStrictEqual(relicTeamStatModifiers([], relics), {});
});

// --- The Guardian's Banner (docs/run-loop.md): never randomly offered, designed to stack ---

test('relics: the three Guardian Banners are catalogued, in offer order', () => {
  assert.deepStrictEqual(guardianBannerRelics.map((r) => r.id), ['bannerOfTheWarcry', 'bannerOfTheBulwark', 'bannerOfTheWellspring']);
  for (const banner of guardianBannerRelics) {
    assert.strictEqual(relics[banner.id], banner, `${banner.id} is missing from the relic catalog`);
    assert.strictEqual(banner.guardianBanner, true);
  }
});

test('relics: a Banner taken four times stacks to four times its grant', () => {
  const mods = relicTeamStatModifiers(['bannerOfTheWarcry', 'bannerOfTheWarcry', 'bannerOfTheWarcry', 'bannerOfTheWarcry'], relics);
  assert.deepStrictEqual(mods, { attack: 160, intelligence: 160 });
});

test('relics: the three Banners are offense, defense and staying power, no stat twice, and no Speed', () => {
  // One Banner per concept is what makes five acts of fixed offers read as a team shape
  // (docs/run-loop.md "The Guardian's Banner", 2026-09-14). The figures are MEASURED parity —
  // the sim prices a defensive point at ~6× an offensive one, hence +40 against +15. Speed is
  // left off on purpose: a flat team-wide grant of it measured dead in every batch.
  assert.deepStrictEqual(relics.bannerOfTheWarcry.statGrants, { attack: 40, intelligence: 40 });
  assert.deepStrictEqual(relics.bannerOfTheBulwark.statGrants, { defense: 15, wisdom: 15 });
  assert.deepStrictEqual(relics.bannerOfTheWellspring.statGrants, { hp: 40, manaPool: 30, mpRegen: 10 });
  for (const banner of guardianBannerRelics) assert.ok(!banner.statGrants.speed, `${banner.id} grants Speed`);

  // No stat is carried by two Banners — an axis reachable two ways is one the player cannot price.
  const carried = guardianBannerRelics.flatMap((r) => Object.keys(r.statGrants));
  assert.strictEqual(new Set(carried).size, carried.length, 'two Banners carry the same stat');
});

// --- Out-of-combat sheet parity: the sheet and buildCombatState both go through entryStats.ts ---

test('entryStats: the out-of-combat sheet math equals the combatant a fight actually builds', () => {
  const relicIds = ['bannerOfTheWarcry', 'bannerOfTheBulwark', 'bannerOfTheBulwark'];
  let run = createRunState(0);
  run = addRosterEntry(run, createRosterEntry('cinderKnight', 'cinderKnight', heroes.cinderKnight.moveIds));
  // A passive-Class rides the same pipeline as everything else the sheet counts.
  run = grantClass(run, classes, 'cinderKnight', 'warden');

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
  assert.strictEqual(sheetMods.attack, 40);
  assert.strictEqual(sheetMods.defense, 30);
  assert.strictEqual(state.combatants['A:cinderKnight'].passives.warden?.stacks, 1);
});

test('entryStats: relicStatContribution isolates the relic-sourced slice', () => {
  const relicIds = ['bannerOfTheWarcry'];
  const contribution = relicStatContribution(
    relicTeamStatModifiers(relicIds, relics),
    relicTeamPassiveGrants(relicIds, relics),
    passives
  );
  assert.deepStrictEqual(contribution, { attack: 40, intelligence: 40 });
  assert.deepStrictEqual(relicStatContribution({}, {}, passives), {});
});
