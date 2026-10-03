// Werewolf Bite (docs/wild-innates-and-events.md §3.3): the bite MARKS a hero with a curse; at the
// curse's pip it Turns — typing, a 650 body, the innate, a move and the art, all at once.

import * as assert from 'assert';
import { test } from './harness';
import { classes } from '../src/data/classes';
import { CHAMPION_IDS } from '../src/data/enemies';
import { equipment } from '../src/data/equipment';
import { heroes } from '../src/data/heroes';
import { locations } from '../src/data/locations';
import { moves } from '../src/data/moves';
import { progressionTable } from '../src/data/progression';
import { relics } from '../src/data/relics';
import { passives } from '../src/data/passives';
import { TYPES } from '../src/data/typechart';
import { curses } from '../src/data/curses';
import { runEvents } from '../src/data/events';
import { applyCurse, curseTurnsOnBite, turnCurse, RunEventError } from '../src/run/events';
import { curseStatDelta, curseTurnOwed, turnedCurse } from '../src/run/curse';
import { formIdFor, rosterEntryTypes, MOVE_CAP } from '../src/run/progression';
import { innatePassiveIdsFor, masteredInnateFor } from '../src/run/innate';
import { MASTERY_CAP } from '../src/run/mastery';
import { buildCombatState } from '../src/run/buildCombatState';
import { effectiveTypes, getEffectiveStat } from '../src/engine/state';
import { generateMap } from '../src/run/map';
import { buildContentIndex, decodeSave, encodeSave } from '../src/run/save';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';
import { STAT_ORDER } from '../src/engine/content';

const WOLF = curses.werewolf;

function seed(heroId = 'cinderKnight', moveIds: readonly string[] = heroes[heroId].moveIds, mastery = 0): RunState {
  const entry = { ...createRosterEntry(heroId, heroId, moveIds), mastery };
  return addRosterEntry(createRunState(0), entry);
}

test('werewolf: the event marks with the werewolf curse, and the curse is the 650 body the user asked for', () => {
  const outcome = runEvents.werewolfBite.outcome;
  assert.ok(outcome.kind === 'choice' && outcome.options[0].outcome.kind === 'curse' && outcome.options[0].outcome.curseId === 'werewolf');
  assert.strictEqual(Object.values(WOLF.baseStats).reduce((a, b) => a + b, 0), 650);
  assert.strictEqual(WOLF.turnAt, 5);
});

test('werewolf: the bite only MARKS — below the pip the hero is exactly itself', () => {
  const run = applyCurse(seed(), 'cinderKnight', 'werewolf');
  const entry = run.roster[0];
  assert.strictEqual(entry.curseId, 'werewolf');
  assert.strictEqual(entry.curseTurned, false);
  assert.strictEqual(turnedCurse(entry), null);
  assert.deepStrictEqual(rosterEntryTypes(heroes.cinderKnight, entry), heroes.cinderKnight.types);
  assert.ok(!entry.unlockedMoveIds.includes(WOLF.moveId));
  assert.deepStrictEqual(innatePassiveIdsFor(heroes.cinderKnight, entry), heroes.cinderKnight.passiveIds);
  assert.strictEqual(formIdFor(entry), null);
  assert.deepStrictEqual(curseStatDelta(heroes.cinderKnight, entry), {});
  assert.ok(!curseTurnOwed(entry));
  assert.ok(curseTurnOwed({ ...entry, mastery: WOLF.turnAt }), 'the fifth pip owes the Turn');
});

test('werewolf: a hero already at the pip Turns on the bite — pure Beast, Lacerate, Lycanthrope and the form', () => {
  const run = applyCurse(seed('cinderKnight', heroes.cinderKnight.moveIds, 6), 'cinderKnight', 'werewolf');
  const entry = run.roster[0];
  assert.ok(entry.curseTurned);
  assert.deepStrictEqual(rosterEntryTypes(heroes.cinderKnight, entry), ['Beast']);
  assert.deepStrictEqual(rosterEntryTypes(heroes.cinderKnight, { ...entry, evolutionTypeGraft: 'Iron' }), ['Beast'], 'a graft is suppressed');
  assert.ok(entry.unlockedMoveIds.includes('lacerate'));
  assert.deepStrictEqual(innatePassiveIdsFor(heroes.cinderKnight, entry), ['lycanthrope']);
  assert.deepStrictEqual(innatePassiveIdsFor(heroes.cinderKnight, { ...entry, mastery: MASTERY_CAP }), ['lycanthropeMastered']);
  assert.strictEqual(masteredInnateFor(heroes.cinderKnight, entry)?.id, 'lycanthropeMastered');
  assert.strictEqual(formIdFor(entry), 'werewolf');
});

test("werewolf: the Turned body replaces the hero's base line with the 650, levels still on top — any hero, rewired or not", () => {
  for (const heroId of ['cinderKnight', 'motley', 'runescribe']) {
    let run = applyCurse(seed(heroId, heroes[heroId].moveIds, WOLF.turnAt), heroId, 'werewolf');
    run = { ...run, roster: [{ ...run.roster[0], growthStatGrants: { attack: 7 } }] };
    const state = buildCombatState(1, heroes, equipment, [{ side: 'A', squad: { activeIds: [heroId, null], benchIds: [] }, roster: run.roster }], passives);
    const combatant = Object.values(state.combatants)[0];
    assert.deepStrictEqual(effectiveTypes(heroes[heroId], combatant), ['Beast']);
    assert.strictEqual(getEffectiveStat(heroes[heroId], combatant, 'attack'), WOLF.baseStats.attack + 7, `${heroId}: the growth it rolled stays`);
    assert.strictEqual(getEffectiveStat(heroes[heroId], combatant, 'speed'), WOLF.baseStats.speed);
  }
  // A rewire traded the hero's own Attack and Intelligence; the Werewolf's line lands as written anyway.
  const hero = heroes.cinderKnight;
  const swap = { attack: hero.baseStats.intelligence - hero.baseStats.attack, intelligence: hero.baseStats.attack - hero.baseStats.intelligence };
  const rewired = { ...applyCurse(seed('cinderKnight', hero.moveIds, WOLF.turnAt), 'cinderKnight', 'werewolf').roster[0], offenseSwapped: true };
  const delta = curseStatDelta(hero, rewired);
  for (const stat of STAT_ORDER.filter((s) => s !== 'mpRegen')) {
    const landed = hero.baseStats[stat] + ((swap as Record<string, number>)[stat] ?? 0) + (delta[stat] ?? 0);
    assert.strictEqual(landed, WOLF.baseStats[stat as keyof typeof WOLF.baseStats], `${stat} after a rewire`);
  }
});

test('werewolf: the Turn at a full kit needs a move named or declined; a held Lacerate is not taught twice', () => {
  const full = ['claw', 'lull', 'psiBolt', 'gore'].slice(0, MOVE_CAP);
  const marked = applyCurse(seed('cinderKnight', full, WOLF.turnAt - 1), 'cinderKnight', 'werewolf');
  assert.ok(curseTurnsOnBite({ ...marked.roster[0], mastery: WOLF.turnAt }, 'werewolf'));
  const atPip = { ...marked, roster: [{ ...marked.roster[0], mastery: WOLF.turnAt }] };
  const declined = turnCurse(atPip, 'cinderKnight');
  assert.ok(declined.roster[0].curseTurned && !declined.roster[0].unlockedMoveIds.includes('lacerate'), 'declining keeps the kit and Turns anyway');
  const swapped = turnCurse(atPip, 'cinderKnight', 'lull');
  assert.ok(swapped.roster[0].unlockedMoveIds.includes('lacerate') && !swapped.roster[0].unlockedMoveIds.includes('lull'));
  const holding = applyCurse(seed('cinderKnight', ['lacerate'], WOLF.turnAt), 'cinderKnight', 'werewolf');
  assert.deepStrictEqual(holding.roster[0].unlockedMoveIds, ['lacerate']);
  assert.throws(() => turnCurse(seed(), 'cinderKnight'), RunEventError, 'an uncursed hero has nothing to Turn');
  assert.throws(() => applyCurse(seed(), 'cinderKnight', 'vampire'), RunEventError);
});

test('werewolf: the mark and the Turn survive a save round trip, and a save from before curses reads uncursed', () => {
  const index = buildContentIndex({ heroes, moves, equipment, relics, passives, classes, locations, championIds: CHAMPION_IDS, types: TYPES, progression: progressionTable });
  let run = applyCurse(seed('cinderKnight', heroes.cinderKnight.moveIds, WOLF.turnAt), 'cinderKnight', 'werewolf');
  run = { ...run, map: generateMap(1, 1), locationIds: Object.keys(locations).slice(0, 1) };
  const raw = JSON.parse(JSON.stringify(encodeSave(run, 'map')));
  const result = decodeSave(raw, index);
  assert.ok(result.ok, result.ok ? '' : result.reason);
  assert.strictEqual(result.save.run.roster[0].curseId, 'werewolf');
  assert.strictEqual(result.save.run.roster[0].curseTurned, true);

  delete raw.run.roster[0].curseId;
  delete raw.run.roster[0].curseTurned;
  const old = decodeSave(raw, index);
  assert.ok(old.ok, old.ok ? '' : old.reason);
  assert.strictEqual(old.save.run.roster[0].curseId, null);
  assert.strictEqual(old.save.run.roster[0].curseTurned, false);

  raw.run.roster[0].curseId = 'vampire';
  assert.ok(!decodeSave(raw, index).ok, 'an unknown curse is refused');
});
