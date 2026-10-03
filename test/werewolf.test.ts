// Werewolf Bite (docs/wild-innates-and-events.md §3.3): the `transform` outcome — a curse that
// replaces a hero's typing, teaches it a move, and rewrites what its tenth Mastery pip pays.

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
import { runEvents, type RunEventOutcome } from '../src/data/events';
import { applyTransform, RunEventError } from '../src/run/events';
import { formIdFor, rosterEntryTypes, MOVE_CAP } from '../src/run/progression';
import { innatePassiveIdsFor, masteredInnateFor } from '../src/run/innate';
import { MASTERY_CAP } from '../src/run/mastery';
import { buildCombatState } from '../src/run/buildCombatState';
import { effectiveTypes } from '../src/engine/state';
import { generateMap } from '../src/run/map';
import { buildContentIndex, decodeSave, encodeSave } from '../src/run/save';
import { addRosterEntry, createRosterEntry, createRunState, type RunState } from '../src/run/state';

type Transform = Extract<RunEventOutcome, { kind: 'transform' }>;

function bite(): Transform {
  const outcome = runEvents.werewolfBite.outcome;
  assert.strictEqual(outcome.kind, 'choice');
  const option = outcome.kind === 'choice' ? outcome.options[0].outcome : undefined;
  assert.ok(option && option.kind === 'transform');
  return option as Transform;
}

function seed(heroId = 'cinderKnight', moveIds: readonly string[] = heroes[heroId].moveIds): RunState {
  return addRosterEntry(createRunState(0), createRosterEntry(heroId, heroId, moveIds));
}

test('werewolf bite: the hero becomes mono-Beast in both slots, learns its Beast move, and its typing reads Beast everywhere', () => {
  const run = applyTransform(seed(), 'cinderKnight', bite());
  const entry = run.roster[0];
  assert.deepStrictEqual(entry.typeOverride, ['Beast']);
  assert.deepStrictEqual(rosterEntryTypes(heroes.cinderKnight, entry), ['Beast']);
  assert.ok(entry.unlockedMoveIds.includes('lacerate'));
  assert.strictEqual(moves.lacerate.type, 'Beast', 'the taught move is STAB on the day');
  // A graft taken later is suppressed: the curse is the whole typing.
  const grafted = { ...entry, evolutionTypeGraft: 'Iron' as const };
  assert.deepStrictEqual(rosterEntryTypes(heroes.cinderKnight, grafted), ['Beast']);
});

test('werewolf bite: the fight build carries the curse — STAB, the chart and every type reader see Beast', () => {
  const run = applyTransform(seed(), 'cinderKnight', bite());
  const state = buildCombatState(1, heroes, equipment, [{ side: 'A', squad: { activeIds: ['cinderKnight', null], benchIds: [] }, roster: run.roster }], passives);
  const combatant = Object.values(state.combatants)[0];
  assert.deepStrictEqual(effectiveTypes(heroes.cinderKnight, combatant), ['Beast']);
});

test('werewolf bite: below the tenth pip the hero keeps its own innate; at it, the Turn — Lycanthrope and the werewolf form', () => {
  const run = applyTransform(seed(), 'cinderKnight', bite());
  const nine = { ...run.roster[0], mastery: MASTERY_CAP - 1 };
  const ten = { ...run.roster[0], mastery: MASTERY_CAP };
  assert.deepStrictEqual(innatePassiveIdsFor(heroes.cinderKnight, nine), heroes.cinderKnight.passiveIds);
  assert.deepStrictEqual(innatePassiveIdsFor(heroes.cinderKnight, ten), ['lycanthrope']);
  assert.strictEqual(masteredInnateFor(heroes.cinderKnight, ten)?.id, 'lycanthrope');
  assert.strictEqual(formIdFor(nine), null);
  assert.strictEqual(formIdFor(ten), 'werewolf');
});

test('werewolf bite: a hero at the move cap must name a move to give up, and a held move is not taught twice', () => {
  const full = seed('cinderKnight', ['claw', 'lull', 'psiBolt', 'gore'].slice(0, MOVE_CAP));
  assert.throws(() => applyTransform(full, 'cinderKnight', bite()), RunEventError);
  const swapped = applyTransform(full, 'cinderKnight', bite(), 'lull');
  assert.ok(swapped.roster[0].unlockedMoveIds.includes('lacerate') && !swapped.roster[0].unlockedMoveIds.includes('lull'));
  const holding = seed('cinderKnight', ['lacerate']);
  assert.deepStrictEqual(applyTransform(holding, 'cinderKnight', bite()).roster[0].unlockedMoveIds, ['lacerate']);
});

test('werewolf bite: the curse survives a save round trip, and a save from before curses reads uncursed', () => {
  const index = buildContentIndex({ heroes, moves, equipment, relics, passives, classes, locations, championIds: CHAMPION_IDS, types: TYPES, progression: progressionTable });
  let run = applyTransform(seed(), 'cinderKnight', bite());
  run = { ...run, map: generateMap(1, 1), locationIds: Object.keys(locations).slice(0, 1) };
  const raw = JSON.parse(JSON.stringify(encodeSave(run, 'map')));
  const result = decodeSave(raw, index);
  assert.ok(result.ok, result.ok ? '' : result.reason);
  assert.deepStrictEqual(result.save.run.roster[0].typeOverride, ['Beast']);
  assert.deepStrictEqual(result.save.run.roster[0].masteryOverride, { passiveIds: ['lycanthrope'], formId: 'werewolf' });

  delete raw.run.roster[0].typeOverride;
  delete raw.run.roster[0].masteryOverride;
  const old = decodeSave(raw, index);
  assert.ok(old.ok, old.ok ? '' : old.reason);
  assert.strictEqual(old.save.run.roster[0].typeOverride, null);
  assert.strictEqual(old.save.run.roster[0].masteryOverride, null);
});
