import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { STAT_ORDER } from '../src/engine/content';
import { MAX_LEVEL, xpForLevel } from '../src/run/growth';
import { BASE_STAT_SCALE, STAT_SCALE_LOADOUT_MARGIN, rosterPar, statScaleAt, statScaleFor } from '../src/run/statScale';
import { addRosterEntry, createRosterEntry, createRunState } from '../src/run/state';

test('statScale: at level 1 every authored base sits under the ceiling, with the margin to spare', () => {
  for (const hero of Object.values(heroes)) {
    for (const stat of STAT_ORDER) {
      assert.ok(hero.baseStats[stat] * STAT_SCALE_LOADOUT_MARGIN <= BASE_STAT_SCALE.ceiling[stat] + 1, `${hero.id} ${stat}`);
    }
  }
});

test('statScale: the ceiling and the par tick both rise with level, and par stays under the ceiling', () => {
  let previous = statScaleAt(1);
  for (let level = 2; level <= MAX_LEVEL; level++) {
    const scale = statScaleAt(level);
    for (const stat of STAT_ORDER) {
      assert.ok(scale.ceiling[stat] >= previous.ceiling[stat], `ceiling ${stat} at ${level}`);
      assert.ok(scale.par[stat] >= previous.par[stat], `par ${stat} at ${level}`);
      assert.ok(scale.par[stat] < scale.ceiling[stat], `par under ceiling ${stat} at ${level}`);
    }
    previous = scale;
  }
});

test('statScale: a team grant is added to the ceiling outright, never to the par tick', () => {
  const bare = statScaleAt(10);
  const armed = statScaleAt(10, { attack: 80, defense: 30 });
  assert.strictEqual(armed.ceiling.attack, bare.ceiling.attack + 80);
  assert.strictEqual(armed.ceiling.defense, bare.ceiling.defense + 30);
  assert.strictEqual(armed.ceiling.hp, bare.ceiling.hp);
  assert.deepStrictEqual(armed.par, bare.par);
});

test('statScale: the run reads its par off the roster, falling back to the curve', () => {
  let run = createRunState(1);
  assert.strictEqual(rosterPar(run), 1);
  run = addRosterEntry(run, { ...createRosterEntry('a', 'ironWarden', heroes.ironWarden.moveIds), xp: xpForLevel(12) });
  run = addRosterEntry(run, { ...createRosterEntry('b', 'crimson', heroes.crimson.moveIds), xp: xpForLevel(4) });
  assert.strictEqual(rosterPar(run), 12);
  assert.strictEqual(statScaleFor(run).level, 12);
});
