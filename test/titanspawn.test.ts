// The Titanspawn (src/data/titanspawn.ts, docs/titanspawn-overhaul.md §2): fourteen lines, three
// tiers, and the figures the mob layer is authored to — Early round at 200, Mid 400, Late spiked
// at 600; kits from the type's own band; one grade line per type on the hero budget.

import * as assert from 'assert';
import { test } from './harness';
import {
  EARLY_STAT_SPREAD,
  SPAWN_COMBAT_TOTAL,
  SPAWN_KIT_SIZE,
  SPAWN_TIERS,
  SPAWN_TYPES,
  isTitanspawn,
  spawnId,
  spawnPosition,
  titanspawn,
  titanspawnLines,
} from '../src/data/titanspawn';
import { heroes } from '../src/data/heroes';
import { enemies } from '../src/data/enemies';
import { allCombatants } from '../src/data/content';
import { moves } from '../src/data/moves';
import { passives } from '../src/data/passives';
import { statuses } from '../src/data/statuses';
import { equipment } from '../src/data/equipment';
import { relics } from '../src/data/relics';
import { classes } from '../src/data/classes';
import { progressionTable } from '../src/data/progression';
import { TYPES } from '../src/data/typechart';
import { COMBAT_BUDGET_STATS, statBudgetCost, statBudgetTotal } from '../src/run/statBudget';
import { GRADE_BUDGET, gradeBudgetOf, gradesFor } from '../src/run/growth';
import type { HeroDefinition, StatKey } from '../src/engine/content';

const combatTotal = (hero: HeroDefinition) => statBudgetTotal(hero.baseStats, COMBAT_BUDGET_STATS);

/** The type's slate: authored, tiered moves of that type. Class moves carry no tier and wear the holder's type. */
const slateOf = (type: string, tier: string) =>
  Object.values(moves).filter((move) => move.type === type && move.tier === tier && !move.typeFollowsUser).map((m) => m.id);

test('titanspawn: fourteen lines in chart order, one per mortal type, three tiers each', () => {
  assert.deepStrictEqual(
    titanspawnLines.map((line) => line.type),
    TYPES.filter((type) => type !== 'Ancient')
  );
  assert.deepStrictEqual([...SPAWN_TYPES], titanspawnLines.map((line) => line.type));
  assert.strictEqual(Object.keys(titanspawn).length, 14 * 3);
  for (const line of titanspawnLines) {
    for (const tier of SPAWN_TIERS) {
      const spawn = titanspawn[spawnId(line, tier)];
      assert.ok(spawn, `${line.type} has no ${tier}`);
      assert.strictEqual(spawn.tier, tier);
      assert.deepStrictEqual([...spawn.types], [line.type], `${spawn.id} is not mono-${line.type}`);
      assert.strictEqual(spawn.starter, false);
      assert.strictEqual(spawn.name, line.names[tier]);
      assert.deepStrictEqual(spawnPosition(spawn.id), { line, tier });
    }
  }
});

test('titanspawn: every Early ends in -ling, and the suffix drops at Mid', () => {
  for (const line of titanspawnLines) {
    assert.ok(line.names.early.endsWith('ling'), `${line.names.early} is not a -ling`);
    assert.ok(!line.names.mid.endsWith('ling'), `${line.names.mid} kept the suffix`);
    assert.ok(!line.names.late.endsWith('ling'), `${line.names.late} kept the suffix`);
  }
});

test('titanspawn: no spawn shares a name with any other content, and no id with any combatant', () => {
  const taken = new Map<string, string>();
  const claim = (table: Record<string, { name: string }>, label: string) => {
    for (const entry of Object.values(table)) taken.set(entry.name.toLowerCase(), label);
  };
  claim(heroes, 'hero');
  claim(enemies, 'enemy');
  claim(moves, 'move');
  claim(passives, 'passive');
  claim(statuses, 'status');
  claim(equipment, 'equipment');
  claim(relics, 'relic');
  claim(classes, 'class');
  for (const node of Object.values(progressionTable.evolutions).flat()) {
    for (const path of node.paths) taken.set(path.name.toLowerCase(), 'evolution path');
  }
  const seen = new Set<string>();
  for (const spawn of Object.values(titanspawn)) {
    const key = spawn.name.toLowerCase();
    assert.ok(!taken.has(key), `${spawn.name} collides with a ${taken.get(key)}`);
    assert.ok(!seen.has(key), `${spawn.name} is used twice`);
    seen.add(key);
    assert.ok(!(spawn.id in heroes) && !(spawn.id in enemies), `${spawn.id} collides with a combatant id`);
  }
});

test('titanspawn: folded into allCombatants and nowhere the run pools draw from', () => {
  for (const id of Object.keys(titanspawn)) {
    assert.strictEqual(allCombatants[id], titanspawn[id]);
    assert.ok(isTitanspawn(id));
    assert.ok(!(id in heroes), `${id} is recruitable`);
  }
  assert.ok(!isTitanspawn('valor'));
  assert.strictEqual(spawnPosition('valor'), undefined);
});

test('titanspawn: combat totals are 200 / 400 / 600 on the enemy convention, MP Regen aside', () => {
  const off: string[] = [];
  for (const spawn of Object.values(titanspawn)) {
    if (combatTotal(spawn) !== SPAWN_COMBAT_TOTAL[spawn.tier]) off.push(`${spawn.id}=${combatTotal(spawn)}`);
  }
  assert.deepStrictEqual(off, [], 'these lines are off their tier total');
});

test('titanspawn: Early is round — every priced combat stat within 1.3x of every other', () => {
  for (const line of titanspawnLines) {
    const early = line.stats.early;
    const priced = COMBAT_BUDGET_STATS.map((stat) => statBudgetCost(stat, early[stat]));
    const spread = Math.max(...priced) / Math.min(...priced);
    assert.ok(spread <= EARLY_STAT_SPREAD + 1e-9, `${line.names.early} spread is ${spread.toFixed(2)}`);
  }
});

test('titanspawn: each tier is an objective upgrade, and the Late spikes the primary past the roster', () => {
  const rosterMax: Partial<Record<StatKey, number>> = {};
  for (const hero of Object.values(heroes)) {
    for (const [stat, value] of Object.entries(hero.baseStats) as [StatKey, number][]) {
      rosterMax[stat] = Math.max(rosterMax[stat] ?? 0, value);
    }
  }
  for (const line of titanspawnLines) {
    for (const stat of Object.keys(line.stats.early) as StatKey[]) {
      assert.ok(line.stats.mid[stat] >= line.stats.early[stat], `${line.type} Mid drops ${stat}`);
      assert.ok(line.stats.late[stat] >= line.stats.mid[stat], `${line.type} Late drops ${stat}`);
    }
    const primary = line.primaryStat;
    assert.ok(
      line.stats.late[primary] > (rosterMax[primary] ?? 0),
      `${line.names.late}'s ${primary} ${line.stats.late[primary]} does not clear the roster's ${rosterMax[primary]}`
    );
    // The spike is legible only if it is the line's own top stat as well.
    const pricedLate = COMBAT_BUDGET_STATS.map((stat) => [stat, statBudgetCost(stat, line.stats.late[stat])] as const);
    const top = Math.max(...pricedLate.map(([, v]) => v));
    if (primary !== 'mpRegen') {
      assert.strictEqual(statBudgetCost(primary, line.stats.late[primary]), top, `${line.names.late} spikes something other than ${primary}`);
    }
  }
});

test('titanspawn: kits are 3 / 4 / 4, from the type\'s own slate at the tier\'s band, no repeats', () => {
  for (const line of titanspawnLines) {
    for (const tier of SPAWN_TIERS) {
      const kit = line.moveIds[tier];
      const slate = slateOf(line.type, tier);
      assert.strictEqual(kit.length, SPAWN_KIT_SIZE[tier], `${line.names[tier]} holds ${kit.length}`);
      assert.strictEqual(new Set(kit).size, kit.length, `${line.names[tier]} repeats a move`);
      for (const id of kit) {
        assert.ok(moves[id], `${line.names[tier]} holds unknown move ${id}`);
        assert.ok(slate.includes(id), `${line.names[tier]} holds ${id}, which is not ${line.type} ${tier}`);
      }
    }
  }
});

test('titanspawn: one grade line per type, on the hero budget, so the companion levels like anyone', () => {
  for (const line of titanspawnLines) {
    assert.strictEqual(gradeBudgetOf(line.growthGrades), GRADE_BUDGET, `${line.type} grades sum to ${gradeBudgetOf(line.growthGrades)}`);
    for (const tier of SPAWN_TIERS) {
      assert.deepStrictEqual(gradesFor(titanspawn[spawnId(line, tier)]), line.growthGrades);
    }
  }
});
