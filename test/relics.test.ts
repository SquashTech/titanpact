import * as assert from 'assert';
import { test } from './harness';
import { isValidRelicDefinition, relicTeamStatModifiers } from '../src/run/relics';
import { relics, drawableRelics, guardianBannerRelics } from '../src/data/relics';
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

test('relics: relicTeamStatModifiers merges owned relics additively and ignores unknown ids', () => {
  const mods = relicTeamStatModifiers(['ironStandard', 'warHorn', 'unknown-relic'], relics);
  assert.deepStrictEqual(mods, { defense: 10, attack: 10 });
});

test('relics: relicTeamStatModifiers stacks a duplicate relic id', () => {
  const mods = relicTeamStatModifiers(['ironStandard', 'ironStandard'], relics);
  assert.strictEqual(mods.defense, 20);
});

test('relics: no owned relics yields no modifiers', () => {
  assert.deepStrictEqual(relicTeamStatModifiers([], relics), {});
});

// --- The Guardian's Banner (docs/run-loop.md): never randomly offered, designed to stack ---

test('relics: the three Guardian Banners are catalogued, in offer order', () => {
  assert.deepStrictEqual(
    guardianBannerRelics.map((r) => r.id),
    ['bannerOfVitality', 'bannerOfTheWellspring', 'bannerOfTheEverflow']
  );
  for (const banner of guardianBannerRelics) {
    assert.strictEqual(relics[banner.id], banner, `${banner.id} is missing from the relic catalog`);
    assert.strictEqual(banner.guardianBanner, true);
  }
});

test('relics: no Guardian Banner is drawable by a random offer', () => {
  const drawableIds = new Set(drawableRelics.map((r) => r.id));
  for (const banner of guardianBannerRelics) {
    assert.ok(!drawableIds.has(banner.id), `${banner.id} leaked into the random relic pool`);
  }
  assert.strictEqual(drawableRelics.length, Object.values(relics).length - guardianBannerRelics.length);
});

test('relics: a Banner taken four times stacks to four times its grant', () => {
  const mods = relicTeamStatModifiers(['bannerOfVitality', 'bannerOfVitality', 'bannerOfVitality', 'bannerOfVitality'], relics);
  assert.deepStrictEqual(mods, { hp: 120 });
});

test('relics: the three Banners lead on three different resources', () => {
  // Each Banner still owns one resource, and they are still distinct.
  const leadStats = guardianBannerRelics.map((r) => Object.keys(r.statGrants)[0]);
  assert.deepStrictEqual(leadStats, ['hp', 'manaPool', 'mpRegen']);

  // One documented exception to "one stat each": the Wellspring carries Wisdom alongside its
  // Mana. Batch simulation showed a pure mana-pool grant SATURATES — +50, +150 and +300 all
  // measure identically, because a fight ends long before a deeper reserve is reached — so at
  // +20 it was the worst of the three by a wide margin and no number could fix it. The Wisdom
  // is what makes it a live pick. If a third Banner ever wants a second stat, that is a
  // conversation, not a precedent.
  assert.deepStrictEqual(guardianBannerRelics.map((r) => Object.keys(r.statGrants).length), [1, 2, 1]);
  assert.deepStrictEqual(relics.bannerOfTheWellspring.statGrants, { manaPool: 40, wisdom: 20 });
});

// --- Out-of-combat sheet parity: the sheet and buildCombatState both go through entryStats.ts ---

test('entryStats: the out-of-combat sheet math equals the combatant a fight actually builds', () => {
  const relicIds = ['windcallersBanner', 'ironStandard'];
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
  assert.strictEqual(sheetMods.speed, 10);
  assert.strictEqual(sheetMods.defense, 10 + (classes.warrior.statGrants?.defense ?? 0));
});

test('entryStats: relicStatContribution isolates the relic-sourced slice, including relic-granted passives', () => {
  const relicIds = ['windcallersBanner'];
  const contribution = relicStatContribution(
    relicTeamStatModifiers(relicIds, relics),
    relicTeamPassiveGrants(relicIds, relics),
    passives
  );
  assert.deepStrictEqual(contribution, { speed: 10 });
  assert.deepStrictEqual(relicStatContribution({}, {}, passives), {});
});
