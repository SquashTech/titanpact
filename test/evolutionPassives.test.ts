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
import { resolveBattleStartEntries } from '../src/engine/combat/passiveEngine';
import type { Action } from '../src/engine/combat/actions';
import { hasStatus } from '../src/engine/state';
import { applyStatus, selectableTargets } from '../src/engine/combat/statusEngine';
import { getEffectiveStat } from '../src/engine/state';
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

test('evolution passives: Murk clouds both active enemies the moment Nautilus arrives', () => {
  const base = withPassive(threeVThree(701), 'a3', 'murk');
  const { state } = resolveRound(base, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' } as Action], config);
  for (const id of ['b1', 'b2']) {
    assert.strictEqual(state.combatants[id].statStages?.intelligence, -1, id);
    assert.strictEqual(state.combatants[id].statStages?.speed, -1, id);
  }
  assert.strictEqual(state.combatants.b3.statStages?.intelligence, undefined, 'never the bench');
});

test('evolution passives: Ready Stance answers every enemy that steps onto the field', () => {
  const base = withPassive(threeVThree(702), 'a1', 'readyStance');
  const { state } = resolveRound(base, [{ kind: 'switch', combatantId: 'b1', benchedCombatantId: 'b3' } as Action], config);
  assert.strictEqual(state.combatants.a1.statStages?.attack, 1);
});

test('evolution passives: Dead Leaf Haunts the enemies still standing when its hit knocks one out', () => {
  const base = withHp(withPassive(threeVThree(703), 'a1', 'deadLeaf'), 'b1', 1);
  const { state, events } = resolveRound(base, [{ kind: 'move', combatantId: 'a1', moveId: 'singe', declaredTarget: 'b1' } as Action], config);
  const hit = events.find((e) => e.type === 'DamageDealt' && e.sourceCombatantId === 'a1');
  assert.ok(hit && hit.type === 'DamageDealt' && hit.finishing, 'the hit finished b1');
  assert.ok(hasStatus(state.combatants.b2, 'Haunt'), 'the partner is Haunted');
});

// --- Water, second pass (docs/hero-audit.md) ---

test('evolution passives: Scald and Mire hear Drag — a passive-made Speed drop costs the foe Defense and Poisons it', () => {
  let base = withPassive(threeVThree(720), 'a2', 'drag');
  base = withPassive(withPassive(base, 'a2', 'scald'), 'a2', 'mire');
  const { state } = resolveRound(base, [{ kind: 'move', combatantId: 'a2', moveId: 'splash', declaredTarget: 'b1' } as Action], config);
  assert.strictEqual(state.combatants.b1.statStages?.speed, -1);
  assert.strictEqual(state.combatants.b1.statStages?.defense, -1);
  assert.ok(hasStatus(state.combatants.b1, 'Poison'));
  assert.strictEqual(state.combatants.b2.statStages?.defense, undefined, 'only the slowed foe');
});

test('evolution passives: the same card without hearsPassives ignores a passive-made Speed drop', () => {
  const deaf = { ...passives.scald, id: 'deafScald', reactive: { ...passives.scald.reactive!, hearsPassives: undefined } };
  const deafConfig = { ...config, passives: { ...passives, deafScald: deaf } };
  const base = withPassive(withPassive(threeVThree(721), 'a2', 'drag'), 'a2', 'deafScald');
  const { state } = resolveRound(base, [{ kind: 'move', combatantId: 'a2', moveId: 'splash', declaredTarget: 'b1' } as Action], deafConfig);
  assert.strictEqual(state.combatants.b1.statStages?.speed, -1);
  assert.strictEqual(state.combatants.b1.statStages?.defense, undefined);
});

test('evolution passives: Shell Shards answers a broken Shield with Defense off both active enemies', () => {
  let base = withPassive(threeVThree(722), 'a1', 'shellShards');
  base = applyStatus(base, 1, 'a1', statuses.Shield, { magnitude: 1 }).state;
  const { state } = resolveRound(base, [{ kind: 'move', combatantId: 'b1', moveId: 'splash', declaredTarget: 'a1' } as Action], config);
  assert.ok(!hasStatus(state.combatants.a1, 'Shield'), 'the Shield broke');
  assert.strictEqual(state.combatants.b1.statStages?.defense, -1);
  assert.strictEqual(state.combatants.b2.statStages?.defense, -1);
});

test('evolution passives: Coral Growth raises Defense when its holder gains Shield', () => {
  const base = withPassive(threeVThree(723), 'a2', 'coralGrowth');
  const { state } = resolveRound(base, [{ kind: 'move', combatantId: 'a2', moveId: 'tideGuard', declaredTarget: 'a2' } as Action], config);
  assert.strictEqual(state.combatants.a2.statStages?.defense, 1);
  assert.strictEqual(state.combatants.a1.statStages?.defense, undefined, 'the holder alone');
});

test('evolution passives: Mimicry copies the stat an enemy raises, by as many steps', () => {
  const base = withPassive(threeVThree(724), 'a1', 'mimicry');
  const { state } = resolveRound(base, [{ kind: 'move', combatantId: 'b1', moveId: 'kindle', declaredTarget: 'b1' } as Action], config);
  assert.strictEqual(state.combatants.b1.statStages?.attack, 1);
  assert.strictEqual(state.combatants.a1.statStages?.attack, 1);
});

test('evolution passives: Salt Tears lifts Intelligence and Wisdom on whoever its Renew lands on', () => {
  const base = withPassive(threeVThree(725), 'a2', 'saltTears');
  const { state } = resolveRound(base, [{ kind: 'move', combatantId: 'a2', moveId: 'refresh', declaredTarget: 'a1' } as Action], config);
  assert.strictEqual(state.combatants.a1.statStages?.intelligence, 1);
  assert.strictEqual(state.combatants.a1.statStages?.wisdom, 1);
});

test('evolution passives: Salt Tears is unbraked — a two-target Renew lifts both receivers', () => {
  const base = withPassive(threeVThree(726), 'a2', 'saltTears');
  const { state } = resolveRound(base, [{ kind: 'move', combatantId: 'a2', moveId: 'highTide', declaredTarget: 'a1' } as Action], config);
  for (const id of ['a1', 'a2']) {
    assert.strictEqual(state.combatants[id].statStages?.intelligence, 1, id);
    assert.strictEqual(state.combatants[id].statStages?.wisdom, 1, id);
  }
});

test('innate: Slumbering arrives groggy and wakes over two rounds on the field; Slumbering+ arrives awake', () => {
  const lev = createFightState(
    727,
    [
      { combatantId: 'a1', heroId: 'leviathan', side: 'A' },
      { combatantId: 'a2', heroId: 'tidecaller', side: 'A' },
    ],
    [
      { combatantId: 'b1', heroId: 'ironWarden', side: 'B' },
      { combatantId: 'b2', heroId: 'crag', side: 'B' },
    ]
  );
  const slumbering = withPassive(lev, 'a1', 'slumbering');
  // A lead "enters" at the fight's start: the groggy steps land with the opening entries.
  const opened = resolveBattleStartEntries(slumbering, 0, heroes, statuses, passives, fieldEffects).state;
  assert.strictEqual(opened.combatants.a1.statStages?.intelligence, -2);
  assert.strictEqual(opened.combatants.a1.statStages?.speed, -2);
  const r1 = resolveRound(opened, [], config).state;
  assert.strictEqual(r1.combatants.a1.statStages?.intelligence, -1);
  const r2 = resolveRound(r1, [], config).state;
  assert.strictEqual(r2.combatants.a1.statStages?.intelligence ?? 0, 0);
  const r3 = resolveRound(r2, [], config).state;
  assert.strictEqual(r3.combatants.a1.statStages?.intelligence ?? 0, 0, 'awake, and no further');

  const woke = resolveBattleStartEntries(withPassive(lev, 'a1', 'leviathanWakes'), 0, heroes, statuses, passives, fieldEffects).state;
  assert.strictEqual(woke.combatants.a1.statStages?.intelligence, 1);
  assert.strictEqual(woke.combatants.a1.statStages?.speed, undefined);
});

test('evolution passives: Drowned Gift fills the Mana of whoever its Renew lands on', () => {
  let base = withPassive(threeVThree(728), 'a2', 'drownedGift');
  base = { ...base, combatants: { ...base.combatants, a1: { ...base.combatants.a1, currentMana: 0 } } };
  const { state } = resolveRound(base, [{ kind: 'move', combatantId: 'a2', moveId: 'refresh', declaredTarget: 'a1' } as Action], config);
  assert.ok(state.combatants.a1.currentMana >= heroes.cinderKnight.baseStats.manaPool, 'filled, not just regenerated');
});

// --- Frost, second pass (docs/hero-audit.md) ---

function freeze(state: CombatState, id: string): CombatState {
  return applyStatus(state, 1, id, statuses.Freeze, {}).state;
}

function staged(state: CombatState, id: string, stat: string, steps: number): CombatState {
  const c = state.combatants[id];
  return { ...state, combatants: { ...state.combatants, [id]: { ...c, statStages: { ...c.statStages, [stat]: steps } } } };
}

test('evolution passives: Thundersnow and Wraithfrost mark whoever is Frozen — Conduct and Haunt', () => {
  let base = withPassive(withPassive(threeVThree(730), 'a1', 'thundersnow'), 'a1', 'wraithfrost');
  const { state } = resolveRound(base, [{ kind: 'move', combatantId: 'a2', moveId: 'deepChill', declaredTarget: 'b1' } as Action], config);
  assert.ok(hasStatus(state.combatants.b1, 'Freeze'));
  assert.ok(hasStatus(state.combatants.b1, 'Conduct'));
  assert.ok(hasStatus(state.combatants.b1, 'Haunt'));
  assert.ok(!hasStatus(state.combatants.b2, 'Conduct'));
});

test('evolution passives: Cold Iron raises Defense on a hit against a Frozen foe; Black Ice freezes on the first Water hit only', () => {
  const iron = resolveRound(withPassive(freeze(threeVThree(731), 'b1'), 'a1', 'coldIron'), [{ kind: 'move', combatantId: 'a1', moveId: 'iceShard', declaredTarget: 'b1' } as Action], config).state;
  assert.strictEqual(iron.combatants.a1.statStages?.defense, 1);

  const splash = (target: string) => [{ kind: 'move', combatantId: 'a2', moveId: 'splash', declaredTarget: target } as Action];
  const once = resolveRound(withPassive(threeVThree(732), 'a2', 'blackIce'), splash('b1'), config).state;
  assert.ok(hasStatus(once.combatants.b1, 'Freeze'));
  const twice = resolveRound(once, splash('b2'), config).state;
  assert.ok(!hasStatus(twice.combatants.b2, 'Freeze'), 'the first Water hit only');
});

test('evolution passives: Cold Housing Shields the partner when its holder\'s Defense rises', () => {
  const { state } = resolveRound(withPassive(threeVThree(733), 'a1', 'coldHousing'), [{ kind: 'move', combatantId: 'a1', moveId: 'frostArmor', declaredTarget: 'a1' } as Action], config);
  assert.ok(hasStatus(state.combatants.a2, 'Shield'));
  assert.ok(!hasStatus(state.combatants.a1, 'Shield'));
});

test('evolution passives: Warm Hearth and Winter\'s Weight answer an entry — Burn and INT ▲▲, Frost Force', () => {
  let base = withPassive(withPassive(threeVThree(734), 'a3', 'warmHearth'), 'a3', 'wintersWeight');
  const { state } = resolveRound(base, [{ kind: 'switch', combatantId: 'a1', benchedCombatantId: 'a3' } as Action], config);
  assert.ok(hasStatus(state.combatants.a3, 'Burn'));
  assert.strictEqual(state.combatants.a3.statStages?.intelligence, 2);
  assert.ok(hasStatus(state.combatants.a3, 'FrostForce'));
});

test('evolution passives: Head of the Herd adds 10 MP Regen only while its holder outspeeds every active hero', () => {
  const held = withPassive(threeVThree(735), 'a1', 'headOfTheHerd');
  const ctx = (s: CombatState) => ({ active: null, defs: fieldEffects, board: { state: s, passives, heroes } });
  const base = heroes.cinderKnight.baseStats.mpRegen;
  const fastest = staged(held, 'a1', 'speed', 5);
  assert.strictEqual(getEffectiveStat(heroes.cinderKnight, fastest.combatants.a1, 'mpRegen', ctx(fastest)), base + 10);
  const slower = staged(held, 'a1', 'speed', -5);
  assert.strictEqual(getEffectiveStat(heroes.cinderKnight, slower.combatants.a1, 'mpRegen', ctx(slower)), base);
});

test('evolution passives: Still Prey — a Frozen foe cannot aim at its holder, but a spread still lands', () => {
  const held = freeze(withPassive(threeVThree(736), 'a1', 'stillPrey'), 'b1');
  assert.deepStrictEqual(selectableTargets(held, 'singleEnemy', ['a1', 'a2'], statuses, passives, 'b1'), ['a2']);
  assert.deepStrictEqual(selectableTargets(held, 'singleEnemy', ['a1', 'a2'], statuses, passives, 'b2').sort(), ['a1', 'a2'], 'an unfrozen foe still may');
  const aimed = resolveRound(held, [{ kind: 'move', combatantId: 'b1', moveId: 'splash', declaredTarget: 'a1' } as Action], config);
  assert.ok(aimed.events.some((e) => e.type === 'MoveGuarded' && e.combatantId === 'a1'));
  assert.ok(!aimed.events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'a1'));
  const spread = resolveRound(held, [{ kind: 'move', combatantId: 'b1', moveId: 'rimeWind', declaredTarget: 'a1' } as Action], config);
  assert.ok(spread.events.some((e) => e.type === 'DamageDealt' && e.targetCombatantId === 'a1'));
});
