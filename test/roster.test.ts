// The roster baseline: what every authored hero owes, and what every Evolution node owes.
// The move-tier gate and the FLOOR live in moveTiers.test.ts; this file pins the two things
// that pass established as content policy — the 450 stat budget and the Evolution framework's
// "no path is bare stats" (docs/leveling-and-ranks.md "The Evolution framework").

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { passives } from '../src/data/passives';
import { statuses } from '../src/data/statuses';
import { progressionTable } from '../src/data/progression';
import { STAT_POINT_VALUE } from '../src/run/equipment';
import type { StatKey } from '../src/engine/content';

/** HP + Mana + the five battle stats. MP Regen is a flat 10 outside the budget. */
const BUDGET = 450;
const BUDGETED: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed', 'manaPool'];

test('roster: every hero spends the same 450-point stat budget, and MP Regen is flat 10 outside it', () => {
  const offBudget = Object.values(heroes)
    .map((hero) => ({ id: hero.id, total: BUDGETED.reduce((sum, key) => sum + hero.baseStats[key], 0) }))
    .filter((row) => row.total !== BUDGET)
    .map((row) => `${row.id}=${row.total}`);
  assert.deepStrictEqual(offBudget, [], 'these lines do not spend exactly 450');

  const offRegen = Object.values(heroes).filter((hero) => hero.baseStats.mpRegen !== 10).map((hero) => hero.id);
  assert.deepStrictEqual(offRegen, [], 'MP Regen is not a budget axis — every hero carries 10');
});

test('roster: no hero starts with a move it cannot pay for', () => {
  for (const hero of Object.values(heroes)) {
    for (const moveId of hero.moveIds) {
      assert.ok(moves[moveId], `${hero.id} starts with unknown move ${moveId}`);
      assert.ok(
        moves[moveId].manaCost <= hero.baseStats.manaPool,
        `${hero.id} cannot afford its own starting move ${moveId}`
      );
    }
  }
});

test('roster: a dual-typed hero is offered no type-graft path — chooseEvolutionPath would throw', () => {
  for (const hero of Object.values(heroes)) {
    if (hero.types.length < 2) continue;
    for (const node of progressionTable.evolutions[hero.id] ?? []) {
      const grafts = node.paths.filter((path) => path.typeGraft).map((path) => path.id);
      assert.deepStrictEqual(grafts, [], `${hero.id} is already dual-typed`);
    }
  }
});

test('roster: every Evolution node keeps at least one mono path, so mono stays a terminal identity', () => {
  for (const [heroId, nodes] of Object.entries(progressionTable.evolutions)) {
    for (const node of nodes) {
      assert.ok(
        node.paths.some((path) => !path.typeGraft),
        `${heroId} at level ${node.level} offers nothing but grafts`
      );
    }
  }
});

test('roster: no Evolution path is bare stats — each pays a type, a move, or a passive on top', () => {
  // Framework clauses 2, 3 and 5 (docs/leveling-and-ranks.md): a path offering only a stat line
  // cannot compete with one that also buys a second column of the type chart.
  for (const [heroId, nodes] of Object.entries(progressionTable.evolutions)) {
    for (const node of nodes) {
      for (const path of node.paths) {
        const pays =
          path.typeGraft !== undefined ||
          path.unlocksMoveIds.length > 0 ||
          (path.grantsPassiveIds ?? []).length > 0;
        assert.ok(pays, `${path.id} is a stat line and nothing else`);
      }
    }
  }
});

test('roster: an Evolution never hands over a move the hero could already be offered', () => {
  // A grant that duplicates the base pool pays in timing alone. Cortex's Cog Bop is the one
  // documented exemption: it is authored OFF-TYPE coverage in the pool and part of the Mech
  // graft's line, and it has to be both (docs/authoring-moves.md, off-type coverage policy).
  const EXEMPT = new Set(['mindweaver-offensive:cogBop']);
  const found: string[] = [];
  for (const hero of Object.values(heroes)) {
    const known = new Set([...hero.moveIds, ...(progressionTable.moveTiers[hero.id] ?? [])]);
    for (const node of progressionTable.evolutions[hero.id] ?? []) {
      for (const path of node.paths) {
        for (const id of [...path.unlocksMoveIds, ...(path.learnableMoveIds ?? [])]) {
          if (known.has(id) && !EXEMPT.has(`${path.id}:${id}`)) found.push(`${path.id}:${id}`);
        }
      }
    }
  }
  assert.deepStrictEqual(found.sort(), [], 'these grants duplicate the hero\'s own level-up pool');
});

test('roster: every passive an Evolution grants exists, and every status a passive names exists', () => {
  for (const [heroId, nodes] of Object.entries(progressionTable.evolutions)) {
    for (const node of nodes) {
      for (const path of node.paths) {
        for (const id of path.grantsPassiveIds ?? []) {
          assert.ok(passives[id], `${heroId}'s ${path.id} grants unknown passive ${id}`);
        }
      }
    }
  }

  for (const passive of Object.values(passives)) {
    const effect = passive.reactive?.effect;
    if (effect && 'statusId' in effect) {
      assert.ok(statuses[effect.statusId], `${passive.id} applies unknown status ${effect.statusId}`);
    }
    const named = passive.reactive?.condition.eventFieldEquals?.statusId;
    if (named) assert.ok(statuses[named], `${passive.id} reads unknown status ${named}`);
    const required = passive.conditionalStatGrants?.requiresEnemyStatus;
    if (required) assert.ok(statuses[required], `${passive.id} requires unknown status ${required}`);
  }
});

test('roster: an Evolution stat line is Rare-to-Epic in equipment currency, spent or refunded', () => {
  // src/run/equipment.ts RARITY_BUDGET: Rare 20, Epic 30, Legendary 40, Mythic 50. Read GROSS —
  // a refocus path's negative half is spent, not discounted — so Warhowl's -30/+60 reads 105, and
  // that ceiling is what stops a path buying a whole second hero. The floor is 0 because a path
  // may pay entirely in a passive and a graft instead (Riptide's Siren grants no stats at all).
  for (const [heroId, nodes] of Object.entries(progressionTable.evolutions)) {
    for (const node of nodes) {
      for (const path of node.paths) {
        const gross = (Object.entries(path.statGrants) as [StatKey, number | undefined][]).reduce(
          (sum, [stat, amount]) => sum + Math.abs(amount ?? 0) * STAT_POINT_VALUE[stat],
          0
        );
        assert.ok(gross <= 110, `${path.id} spends ${gross} points — past anything authored so far`);
      }
    }
  }
});
