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

test('roster: a dual-typed hero gets exactly one RETYPE path — its secondary is traded, never added to', () => {
  // A graft owns the secondary slot, so on an innately dual hero it SPENDS the type it was born
  // with. One path per node does it: three would make the innate pairing a starting state rather
  // than an identity, and none leaves the node with no way to move on the type chart at all.
  for (const hero of Object.values(heroes)) {
    if (hero.types.length < 2) continue;
    for (const node of progressionTable.evolutions[hero.id] ?? []) {
      const retypes = node.paths.filter((path) => path.typeGraft);
      assert.strictEqual(retypes.length, 1, `${hero.id} offers ${retypes.length} retype paths, not 1`);
      for (const path of retypes) {
        assert.ok(
          !hero.types.includes(path.typeGraft!),
          `${path.id} trades ${path.typeGraft} for itself — a no-op chooseEvolutionPath refuses`
        );
      }
    }
  }
});

test('roster: a retype pays for the STAB it costs — it carries a line of the type it bought', () => {
  // The hero keeps moves that just stopped being same-type. Clause 5's fix for a stat refocus is
  // the fix here too: hand over the move that makes the new typing land, plus the line behind it.
  for (const hero of Object.values(heroes)) {
    if (hero.types.length < 2) continue;
    for (const node of progressionTable.evolutions[hero.id] ?? []) {
      for (const path of node.paths.filter((p) => p.typeGraft)) {
        assert.ok(path.unlocksMoveIds.length > 0, `${path.id} retypes and grants no move`);
        assert.ok((path.learnableMoveIds ?? []).length >= 4, `${path.id} retypes and opens no line`);
      }
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

test('roster: every passive in the catalog has a granter — a passive nobody grants is dead content', () => {
  // The mirror of the per-type "every move has a holder" tests. Forge Heat was the first casualty:
  // it was filler on Cinder's Thunderblaze, and the Storm retype replaced the reason it existed.
  const { equipment } = require('../src/data/equipment') as typeof import('../src/data/equipment');
  const { relics } = require('../src/data/relics') as typeof import('../src/data/relics');
  const { runEvents } = require('../src/data/events') as typeof import('../src/data/events');
  const { classes } = require('../src/data/classes') as typeof import('../src/data/classes');

  const granted = new Set<string>(Object.keys(classes));
  for (const nodes of Object.values(progressionTable.evolutions)) {
    for (const node of nodes) for (const path of node.paths) for (const id of path.grantsPassiveIds ?? []) granted.add(id);
  }
  for (const item of Object.values(equipment)) for (const id of item.grantsPassiveIds ?? []) granted.add(id);
  for (const relic of Object.values(relics)) for (const id of relic.grantsPassiveIds ?? []) granted.add(id);
  for (const event of Object.values(runEvents)) {
    if (event.outcome.kind === 'grantPassive') granted.add(event.outcome.passiveId);
  }

  // Static Tide was RESERVED for a year and then used (Pincer). A new orphan should be a decision.
  const orphans = Object.keys(passives).filter((id) => !granted.has(id)).sort();
  assert.deepStrictEqual(orphans, [], 'these passives exist but nothing hands them out');
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
