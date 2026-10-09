// Quiver (docs/archers.md): a narrowed metamorphic move — one Arrow face a round, of the tiers the
// archer has opened, never an Arrow the kit holds — locked in by its first cast for the fight.

import * as assert from 'assert';
import { test } from './harness';
import { createFightState, withFullPools } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { passives } from '../src/data/passives';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import type { CombatState } from '../src/engine/state';
import type { MoveTier } from '../src/engine/content';
import { kitForRound } from '../src/run/metamorphic';
import { quiverStamp } from '../src/run/buildCombatState';
import { createRosterEntry } from '../src/run/state';
import { xpForLevel } from '../src/run/growth';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

function archer(seed: number, kit: string[], openTiers: MoveTier[]): CombatState {
  const base = createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'stormRanger', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'packAlpha', side: 'B' },
    ]
  );
  const a1 = withFullPools({ ...base.combatants.a1, kitMoveIds: kit, openTiers, statModifiers: { ...base.combatants.a1.statModifiers, manaPool: 999 } });
  return { ...base, combatants: { ...base.combatants, a1 } };
}

const faceOn = (state: CombatState, kit: string[]) => kitForRound(state, 'a1', kit, moves, passives)[0];

test('quiver: a face is always an Arrow of a tier the archer has opened', () => {
  const kit = ['quiver', 'risingStatic'];
  const seen = new Set<string>();
  for (let round = 1; round <= 40; round++) {
    const state = { ...archer(1, kit, ['early']), round };
    const face = faceOn(state, kit);
    assert.ok(moves[face].tags?.includes('arrow'), `${face} is not an Arrow`);
    assert.strictEqual(moves[face].tier ?? 'early', 'early', `${face} is past the archer's bands`);
    seen.add(face);
  }
  assert.ok(seen.size > 1, 'the face changes with the round');
  const late = new Set<string>();
  for (let round = 1; round <= 60; round++) late.add(moves[faceOn({ ...archer(2, kit, ['early', 'mid', 'late']), round }, kit)].tier ?? 'early');
  assert.ok(late.has('late'), 'a Late-band archer can roll a Late Arrow');
});

test('quiver: never shows an Arrow the kit already holds', () => {
  const kit = ['quiver', 'stormArrow'];
  for (let round = 1; round <= 40; round++) {
    assert.notStrictEqual(faceOn({ ...archer(3, kit, ['early']), round }, kit), 'stormArrow');
  }
});

test('quiver: the first face cast is locked in for the rest of the fight', () => {
  const kit = ['quiver', 'risingStatic'];
  const state = archer(4, kit, ['early', 'mid']);
  const face = faceOn(state, kit);
  const cast = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: face, declaredTarget: 'b1' } as Action], config);
  assert.strictEqual(cast.state.combatants.a1.lockedFaces?.quiver, face);
  for (let i = 0; i < 10; i++) {
    const later = { ...cast.state, round: cast.state.round + i };
    assert.strictEqual(faceOn(later, kit), face, 'the slot holds the locked Arrow');
  }
});

test('quiver: casting an Arrow the kit holds does not lock the Quiver', () => {
  const kit = ['quiver', 'stormArrow'];
  const state = archer(5, kit, ['early']);
  const cast = resolveRound(state, [{ kind: 'move', combatantId: 'a1', moveId: 'stormArrow', declaredTarget: 'b1' } as Action], config);
  assert.strictEqual(cast.state.combatants.a1.lockedFaces, undefined);
});

test('quiver: the fight build stamps the kit and the tiers the archer\'s level has opened', () => {
  const schedule = heroes.stormRanger.schedule!;
  const at = (level: number) => quiverStamp({ ...createRosterEntry('r1', 'stormRanger', ['quiver', 'risingStatic']), xp: xpForLevel(level) }, heroes.stormRanger);
  assert.deepStrictEqual(at(1).openTiers, ['early']);
  assert.deepStrictEqual(at(schedule.midLevel).openTiers, ['early', 'mid']);
  assert.deepStrictEqual(at(schedule.lateLevel).openTiers, ['early', 'mid', 'late']);
  assert.deepStrictEqual(at(1).kitMoveIds, ['quiver', 'risingStatic']);
  assert.deepStrictEqual(quiverStamp(createRosterEntry('r2', 'cinderKnight', heroes.cinderKnight.moveIds), heroes.cinderKnight), {}, 'any other kit is left alone');
});
