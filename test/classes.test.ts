// The Class system (src/data/classes.ts, src/run/classes.ts): a Class is a statGrants-only Passive; one per hero per run.

import * as assert from 'assert';
import { test } from './harness';
import { isValidPassiveDefinition } from '../src/engine/content';
import { classes } from '../src/data/classes';
import { heroes } from '../src/data/heroes';
import { equipment } from '../src/data/equipment';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { pickSquad } from '../src/run/squad';
import { buildCombatState } from '../src/run/buildCombatState';
import { getEffectiveStat } from '../src/engine/state';
import { grantClass, chosenClass, ClassError } from '../src/run/classes';
import { passiveStatModifiers } from '../src/run/passives';

// --- Catalog validity ---

test('classes: every fixture class is valid content (multiples of 5/10, does something)', () => {
  for (const cls of Object.values(classes)) {
    assert.ok(isValidPassiveDefinition(cls), `${cls.id} is not a valid PassiveDefinition`);
  }
});

test('classes: exactly the 15 two-stat pairs plus Champion — every non-Champion class grants exactly two stats, Champion grants all six', () => {
  const entries = Object.values(classes);
  assert.strictEqual(entries.length, 16);
  for (const cls of entries) {
    const grantedStats = Object.keys(cls.statGrants ?? {});
    if (cls.id === 'champion') {
      assert.strictEqual(grantedStats.length, 6, 'Champion should touch all six core stats');
    } else {
      assert.strictEqual(grantedStats.length, 2, `${cls.id} should grant exactly two stats`);
    }
  }
});

test('classes: no class touches manaPool/mpRegen (open question, not yet decided per CLAUDE.md conversation)', () => {
  for (const cls of Object.values(classes)) {
    assert.strictEqual(cls.statGrants?.manaPool, undefined, `${cls.id} unexpectedly grants manaPool`);
    assert.strictEqual(cls.statGrants?.mpRegen, undefined, `${cls.id} unexpectedly grants mpRegen`);
  }
});

// --- grantClass / chosenClass ---

function seedRoster(heroIds: string[]) {
  let run = createRunState(10);
  for (const heroId of heroIds) {
    run = addRosterEntry(run, createRosterEntry(heroId, heroId, heroes[heroId].moveIds));
  }
  return run;
}

test('classes: grantClass sets classId on the targeted roster entry only', () => {
  const run = seedRoster(['cinderKnight', 'tidecaller']);
  const next = grantClass(run, classes, 'cinderKnight', 'warrior');
  assert.strictEqual(next.roster.find((r) => r.rosterId === 'cinderKnight')?.classId, 'warrior');
  assert.strictEqual(next.roster.find((r) => r.rosterId === 'tidecaller')?.classId, null);
});

test('classes: a hero can only hold one Class per run — granting a second REPLACES the first', () => {
  const run = seedRoster(['cinderKnight']);
  const withWarrior = grantClass(run, classes, 'cinderKnight', 'warrior');
  const withSage = grantClass(withWarrior, classes, 'cinderKnight', 'sage');
  assert.strictEqual(withSage.roster[0].classId, 'sage');
});

test('classes: grantClass throws on an unknown roster id or an unknown class id', () => {
  const run = seedRoster(['cinderKnight']);
  assert.throws(() => grantClass(run, classes, 'nonexistent', 'warrior'), ClassError);
  assert.throws(() => grantClass(run, classes, 'cinderKnight', 'nonexistentClass'), ClassError);
});

test('classes: chosenClass resolves a granted classId back to its full data, or null if none chosen', () => {
  const run = seedRoster(['cinderKnight']);
  assert.strictEqual(chosenClass(classes, run.roster[0]), null);
  const withWarrior = grantClass(run, classes, 'cinderKnight', 'warrior');
  assert.strictEqual(chosenClass(classes, withWarrior.roster[0])?.name, 'Class - Warrior');
});

// --- passiveStatModifiers (src/run/passives.ts) ---

test('classes: passiveStatModifiers reads a held Class passive\'s statGrants back into StatModifiers', () => {
  const mods = passiveStatModifiers({ warrior: 1 }, classes);
  assert.deepStrictEqual(mods, { attack: 10, defense: 10 });
});

test('classes: passiveStatModifiers scales by stack count, same "N stacks resolves N times" discipline as reactive/damage-modifier passives', () => {
  const mods = passiveStatModifiers({ warrior: 2 }, classes);
  assert.deepStrictEqual(mods, { attack: 20, defense: 20 });
});

test('classes: passiveStatModifiers ignores passives with no statGrants (e.g. purely reactive ones)', () => {
  const mods = passiveStatModifiers({ sanguine: 1 }, { sanguine: { id: 'sanguine', name: 'Sanguine', description: '' } });
  assert.deepStrictEqual(mods, {});
});

// --- buildCombatState integration ---

test('buildCombatState: a granted Class raises the combatant\'s effective stats in a real fight', () => {
  let run = seedRoster(['cinderKnight', 'tidecaller']);
  run = grantClass(run, classes, 'cinderKnight', 'warrior');
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
    classes
  );

  const combatant = state.combatants['A:cinderKnight'];
  assert.strictEqual(combatant.passives.warrior?.stacks, 1);
  assert.strictEqual(getEffectiveStat(heroes.cinderKnight, combatant, 'attack'), heroes.cinderKnight.baseStats.attack + 10);
  assert.strictEqual(getEffectiveStat(heroes.cinderKnight, combatant, 'defense'), heroes.cinderKnight.baseStats.defense + 10);
});

test('buildCombatState: omitting the passiveDefs argument (existing call sites) leaves a granted Class inert rather than throwing', () => {
  let run = seedRoster(['cinderKnight']);
  run = grantClass(run, classes, 'cinderKnight', 'warrior');
  const squad = pickSquad(run.roster, ['cinderKnight']);

  const state = buildCombatState(1, heroes, equipment, [{ side: 'A', squad, roster: run.roster }]);
  const combatant = state.combatants['A:cinderKnight'];
  assert.strictEqual(getEffectiveStat(heroes.cinderKnight, combatant, 'attack'), heroes.cinderKnight.baseStats.attack);
});
