// Path passives (src/data/evolutionPassives, docs/evolution-simplification.md §8): the catalog is
// spread together from fifteen files, so an id reused across them overwrites silently — Carillon's
// and Keen's Death Knell did. And a few verbs are dead on arrival; these tests pin both.

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { test } from './harness';
import { createFightState } from './fixtures';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { statuses } from '../src/data/statuses';
import { passives } from '../src/data/passives';
import { fieldEffects } from '../src/data/fieldEffects';
import { progressionTable } from '../src/data/progression';
import { resolveRound } from '../src/engine/combat/resolveRound';
import type { Action } from '../src/engine/combat/actions';
import { hasStatus } from '../src/engine/state';
import type { CombatState, PassiveInstance } from '../src/engine/state';

const config = { typeChart, heroes, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

// Tests run from dist/test, so the sources are two levels up.
const dataDir = path.resolve(__dirname, '../../src/data');

function withPassive(state: CombatState, combatantId: string, passiveId: string): CombatState {
  const combatant = state.combatants[combatantId];
  const instance: PassiveInstance = { passiveId, stacks: 1 };
  return { ...state, combatants: { ...state.combatants, [combatantId]: { ...combatant, passives: { ...combatant.passives, [passiveId]: instance } } } };
}

function withHp(state: CombatState, combatantId: string, currentHp: number): CombatState {
  return { ...state, combatants: { ...state.combatants, [combatantId]: { ...state.combatants[combatantId], currentHp } } };
}

function threeVThree(seed: number) {
  return createFightState(
    seed,
    [
      { combatantId: 'a1', heroId: 'cinderKnight', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
      { combatantId: 'a3', heroId: 'nautilus', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'wildOracle', side: 'B' },
      { combatantId: 'b3', heroId: 'crag', side: 'B' },
    ]
  );
}

test('evolution passives: every passive id is defined exactly once across the catalog files', () => {
  const files = [path.join(dataDir, 'passives.ts'), ...fs.readdirSync(path.join(dataDir, 'evolutionPassives')).map((f) => path.join(dataDir, 'evolutionPassives', f))];
  const seen = new Map<string, number>();
  for (const file of files) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/^ {4}id: '([A-Za-z0-9]+)',\s*$/gm)) {
      seen.set(match[1], (seen.get(match[1]) ?? 0) + 1);
    }
  }
  assert.ok(seen.size > 300, `read ${seen.size} ids; the pattern has stopped matching the catalog`);
  const twice = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  assert.deepStrictEqual(twice, [], 'a spread keeps the last of these and drops the rest');
});

test('evolution passives: no path passive loads Ambush or Poised on its own hit — the move that landed it spends it', () => {
  const dead: string[] = [];
  for (const nodes of Object.values(progressionTable.evolutions)) {
    for (const p of nodes.flatMap((node) => node.paths)) {
      for (const id of p.grantsPassiveIds ?? []) {
        const reactive = passives[id].reactive;
        const effect = reactive?.effect;
        if (
          reactive?.hook === 'DamageDealt' &&
          reactive.condition.relativeTo === 'self' &&
          reactive.condition.subjectRole === 'source' &&
          effect?.kind === 'applyStatus' &&
          effect.target === 'self' &&
          statuses[effect.statusId]?.consumedOnDamage
        ) {
          dead.push(`${p.id}:${id}`);
        }
      }
    }
  }
  assert.deepStrictEqual(dead, []);
});

test('evolution passives: Ink Cloud clouds both active enemies the moment Nautilus arrives', () => {
  const base = withPassive(threeVThree(701), 'a3', 'inkCloud');
  const { state } = resolveRound(base, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' } as Action], config);
  for (const id of ['b1', 'b2']) {
    assert.strictEqual(state.combatants[id].statModifiers.intelligence, -10, id);
    assert.strictEqual(state.combatants[id].statModifiers.speed, -10, id);
  }
  assert.strictEqual(state.combatants.b3.statModifiers.intelligence, undefined, 'never the bench');
});

test('evolution passives: Ready Stance answers every enemy that steps onto the field', () => {
  const base = withPassive(threeVThree(702), 'a1', 'readyStance');
  const { state } = resolveRound(base, [{ kind: 'switch', combatantId: 'b1', benchedCombatantId: 'b3' } as Action], config);
  assert.strictEqual(state.combatants.a1.statModifiers.attack, 15);
});

test('evolution passives: Dead Leaf Haunts the enemies still standing when its hit knocks one out', () => {
  const base = withHp(withPassive(threeVThree(703), 'a1', 'deadLeaf'), 'b1', 1);
  const { state, events } = resolveRound(base, [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' } as Action], config);
  const hit = events.find((e) => e.type === 'DamageDealt' && e.sourceCombatantId === 'a1');
  assert.ok(hit && hit.type === 'DamageDealt' && hit.finishing, 'the hit finished b1');
  assert.ok(hasStatus(state.combatants.b2, 'Haunt'), 'the partner is Haunted');
});
