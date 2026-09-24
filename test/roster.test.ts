// The roster baseline: what every authored hero owes, and what every Evolution node owes.
// The move-tier gate and the FLOOR live in moveTiers.test.ts; this file pins the two things
// that pass established as content policy — the 550 stat total and the Evolution framework's
// "no path is bare stats" (docs/leveling-and-ranks.md "The Evolution framework"). The GRADE budget
// is the 550's second half and sits directly beneath it.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { allCombatants } from '../src/data/content';
import { moves } from '../src/data/moves';
import { passives } from '../src/data/passives';
import { statuses } from '../src/data/statuses';
import { progressionTable } from '../src/data/progression';
import { BASE_ITEM_SLOTS, MAX_ITEM_SLOTS, statGrantCost } from '../src/run/equipment';
import type { GrowthStatKey, StatKey } from '../src/engine/content';
import { GRADE_BUDGET, GROWTH_STATS, gradeBudgetOf, gradeExpectedPoints, gradesFor } from '../src/run/growth';
import { BURDEN_SURPLUS, HERO_STAT_TOTAL, heroStatTotal, heroStatTotalFor } from '../src/run/statBudget';
import { itemSlotsFor } from '../src/run/progression';
import { createRosterEntry } from '../src/run/state';
import { heroPool } from '../src/run/recruitment';
import { TYPES } from '../src/data/typechart';

/** HP + Mana + the five battle stats at face value. MP Regen is a flat 10 outside the total. */
test('roster: every seven-stat line sums to 550 — a Burden hero to 550 + the surplus — and MP Regen is flat 10 outside it', () => {
  const { isBurden } = require('../src/data/passives') as typeof import('../src/data/passives');
  const offBudget = Object.values(heroes)
    .map((hero) => ({ id: hero.id, total: heroStatTotal(hero.baseStats), owed: heroStatTotalFor(hero, isBurden) }))
    .filter((row) => row.total !== row.owed)
    .map((row) => `${row.id}=${row.total} (owes ${row.owed})`);
  assert.deepStrictEqual(offBudget, [], 'these lines do not sum to what they owe');
  // The exemption is a printed, fixed figure, and exactly the Burden heroes use it.
  const burdened = Object.values(heroes).filter((hero) => (hero.passiveIds ?? []).some(isBurden)).map((hero) => hero.id);
  assert.deepStrictEqual(burdened, ['steamColossus'], 'the Burden roster is a decision, one hero at a time');
  assert.strictEqual(heroStatTotalFor(heroes.steamColossus, isBurden), HERO_STAT_TOTAL + BURDEN_SURPLUS);

  const offRegen = Object.values(heroes).filter((hero) => hero.baseStats.mpRegen !== 10).map((hero) => hero.id);
  assert.deepStrictEqual(offRegen, [], 'MP Regen is not a stat-total axis — every hero carries 10');
});

/** The second budget. The 550 alone stops saying a hero is fairly costed the moment growth exists. */
test('roster: every growth-grade line sums to 28, and no hero is still on the placeholder', () => {
  const offBudget = Object.values(heroes)
    .map((hero) => ({ id: hero.id, spent: gradeBudgetOf(gradesFor(hero)) }))
    .filter((row) => row.spent !== GRADE_BUDGET)
    .map((row) => `${row.id}=${row.spent}`);
  assert.deepStrictEqual(
    offBudget,
    [],
    `these grade lines do not sum to ${GRADE_BUDGET} — taking one stat to S costs another from B to D`
  );

  const unauthored = Object.values(heroes).filter((hero) => !hero.growthGrades).map((hero) => hero.id);
  assert.deepStrictEqual(unauthored, [], 'every hero authors its own grades; all-B is a placeholder, not a line');

  const allB = Object.values(heroes)
    .filter((hero) => GROWTH_STATS.every((stat) => hero.growthGrades?.[stat] === 'B'))
    .map((hero) => hero.id);
  assert.deepStrictEqual(allB, [], 'an all-B line says nothing about the hero — spike something and pay for it');
});

/**
 * A grade's mean is linear in cost (0.1 + 0.3 x cost), so an on-budget line buys every hero the
 * SAME points a level, however each grade splits them between odds and size. A grade line is a
 * shape, never a size — which is what lets a mismatch be authored without also handing that hero
 * more growth than the roster.
 */
test('roster: the grade budget buys every hero the same expected growth', () => {
  const perLevel = Object.values(heroes).map((hero) => {
    const grades = gradesFor(hero);
    const stats: readonly GrowthStatKey[] = GROWTH_STATS;
    const total = stats.reduce((sum, stat) => sum + gradeExpectedPoints(grades[stat]), 0);
    return Math.round(total * 100) / 100;
  });
  assert.deepStrictEqual([...new Set(perLevel)], [9.1], 'an on-budget line must not out-grow another on-budget line');
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
        `${heroId} offers nothing but grafts`
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
  const EXEMPT = new Set(['mindweaver-construct:cogBop']);
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
  const { boonPassives, fieldHeraldPassiveFor, typeDamagePassiveFor } = require('../src/data/passives') as typeof import('../src/data/passives');

  const granted = new Set<string>(Object.keys(classes));
  // The Boon node (src/run/boons.ts) hands out both halves of its pool.
  for (const id of Object.keys(boonPassives)) granted.add(id);
  for (const id of Object.values(typeDamagePassiveFor)) granted.add(id);
  for (const id of Object.values(fieldHeraldPassiveFor)) granted.add(id);
  for (const nodes of Object.values(progressionTable.evolutions)) {
    for (const node of nodes) for (const path of node.paths) for (const id of path.grantsPassiveIds ?? []) granted.add(id);
  }
  for (const item of Object.values(equipment)) for (const id of item.grantsPassiveIds ?? []) granted.add(id);
  for (const relic of Object.values(relics)) for (const id of relic.grantsPassiveIds ?? []) granted.add(id);
  for (const event of Object.values(runEvents)) {
    if (event.outcome.kind === 'grantPassive') granted.add(event.outcome.passiveId);
  }
  // Innate to a definition (HeroDefinition.passiveIds): every hero's one, the spawn's Marks, the Titan's pieces.
  for (const definition of Object.values(allCombatants)) for (const id of definition.passiveIds ?? []) granted.add(id);
  // The tenth Mastery pip's upgrade (HeroDefinition.masteredPassiveIds, docs/mastery.md §5b).
  for (const definition of Object.values(allCombatants)) for (const id of definition.masteredPassiveIds ?? []) granted.add(id);

  // Static Tide was RESERVED for a year and then used (Pincer). A new orphan should be a decision.
  const orphans = Object.keys(passives).filter((id) => !granted.has(id)).sort();
  assert.deepStrictEqual(orphans, [], 'these passives exist but nothing hands them out');
});
test('roster: an Evolution stat line is Rare-to-Epic in equipment currency, spent or refunded', () => {
  // Read GROSS — a refocus path's negative half is spent, not discounted — so Warhowl's -30/+60
  // reads 105, and that ceiling is what stops a path buying a whole second hero. The floor is 0
  // because a path may pay entirely in a passive and a graft instead (Riptide's Siren grants no
  // stats at all).
  //
  // The CEILING is absolute, not a tier name: the 2026-09-06 budget pass rebased item currency
  // (Mythic 50 -> 110) without touching a single Evolution path, so the same numbers that used to
  // read "about two Mythics" now read "about one". That is a real shift in how items and
  // Evolutions trade against each other, and it is deliberate — see docs/progression.md.
  for (const [heroId, nodes] of Object.entries(progressionTable.evolutions)) {
    for (const node of nodes) {
      for (const path of node.paths) {
        const gross = (Object.entries(path.statGrants) as [StatKey, number | undefined][]).reduce(
          (sum, [stat, amount]) => sum + Math.abs(statGrantCost(stat, amount ?? 0)),
          0
        );
        assert.ok(gross <= 120, `${path.id} spends ${gross} points — past anything authored so far`);
      }
    }
  }
});

test('roster: every hero starts on the same one item slot, whatever its Speed', () => {
  // Nine heroes used to author `itemSlots: 2` for being at Speed <= 40. Speed and HP are
  // anti-correlated here, so that rule read as a Speed rule and landed as an HP rule, handing the
  // bulkiest nine a second item measured at 79.3% in a mirror match (docs/progression.md
  // "Pricing HP"). The dial is gone; the Forge is the only way to a second slot.
  const entry = createRosterEntry('probe', 'valor', []);
  for (const hero of Object.values(heroes)) {
    assert.strictEqual(
      itemSlotsFor(hero, entry),
      BASE_ITEM_SLOTS,
      hero.id + ' (' + hero.baseStats.speed + ' Speed) does not start on the base slot'
    );
  }

  // The Forge still walks anyone to the cap, and never past it.
  const forged = { ...entry, bonusItemSlots: MAX_ITEM_SLOTS + 5 };
  assert.strictEqual(itemSlotsFor(heroes.valor, forged), MAX_ITEM_SLOTS);
});

test('roster: the BASE roster is three a type — one starter, two recruit-only — for the fourteen draftable types, and a bundle hero is outside it', () => {
  // The count CLAUDE.md pins is the base game's (docs/constellation.md §9): heroPool with nothing
  // bought. A hero with `unlock` sits beside it, never in it, and never in the draft.
  const base = Object.values(heroPool(heroes));
  assert.strictEqual(base.length, 42);
  for (const type of TYPES) {
    if (type === 'Ancient') continue;
    const ofType = base.filter((hero) => hero.types[0] === type);
    assert.strictEqual(ofType.length, 3, `${type} holds ${ofType.length} base heroes, not 3`);
    assert.strictEqual(ofType.filter((hero) => hero.starter).length, 1, `${type} has ${ofType.filter((h) => h.starter).length} starters, not 1`);
  }
  assert.strictEqual(base.filter((hero) => hero.types[0] === 'Ancient').length, 0, 'Ancient is near-undraftable and holds no hero');
  for (const hero of Object.values(heroes)) {
    if (hero.unlock) assert.strictEqual(hero.starter, false, `${hero.id} is a bundle hero and a starter`);
  }
});

test('roster: every hero holds exactly ONE innate — a verb, never a bare stat line, in no pool — and every spawn and Guardian its type Mark', () => {
  // docs/innate-passives.md §1-3. The innate is what two heroes of one type do differently before
  // either has evolved; a statGrants-only card would be a 560 total through the side door.
  const { titansMarkFor, typeDamagePassiveFor, isTitansMark, isBurden } = require('../src/data/passives') as typeof import('../src/data/passives');
  const { titanspawn } = require('../src/data/titanspawn') as typeof import('../src/data/titanspawn');
  const { enemies, CHAMPION_IDS, unsealedChampions } = require('../src/data/enemies') as typeof import('../src/data/enemies');
  const { innatePassiveOf } = require('../src/run/innate') as typeof import('../src/run/innate');

  for (const hero of Object.values(heroes)) {
    const ids = hero.passiveIds ?? [];
    // ONE innate — a card that needs a second reaction (Broadside's load and its firing) is two ids
    // under one name, and the name is what the player reads.
    const names = new Set(ids.map((id) => passives[id]?.name));
    assert.strictEqual(names.size, 1, `${hero.id} holds ${names.size} innate passives, not one`);
    const passive = passives[ids[0]];
    assert.ok(passive, `${hero.id}'s innate ${ids[0]} does not exist`);
    assert.strictEqual(innatePassiveOf(hero)?.id, passive.id);
    const bareNumber = passive.statGrants !== undefined && !passive.reactive && !passive.damageModifier && !passive.conditionalStatGrants;
    assert.ok(!bareNumber, `${hero.id}'s innate ${passive.id} is a bare stat grant`);
    assert.ok(!isTitansMark(passive.id), `${hero.id} carries the Titan's Mark — that is a spawn's`);
    // A NEW innate card is in no pool (innatePassives is not folded into boonPassives). A reused
    // equipment card (Impale, Sunder) stays in the Boon pool as the equipment card it is, and stacks.
    assert.ok(!Object.values(typeDamagePassiveFor).includes(passive.id), `${hero.id}'s innate ${passive.id} is its own type's +20% Boon (§11 q6: never)`);
  }
  // A Burden is one of them, priced elsewhere; the Mark is on every spawn and on NO Guardian — the
  // seal keeps it off, and a Marked champion measured as the whole Act 1 loss (docs/innate-passives.md §8).
  assert.ok(Object.values(heroes).some((hero) => (hero.passiveIds ?? []).some(isBurden)));
  for (const spawn of Object.values(titanspawn)) {
    assert.deepStrictEqual(spawn.passiveIds, [titansMarkFor[spawn.types[0] as keyof typeof titansMarkFor]], `${spawn.id} does not carry its type's Mark`);
  }
  for (const id of CHAMPION_IDS) {
    assert.ok(!(enemies[id].passiveIds ?? []).some(isTitansMark), `${id} carries the Titan's Mark`);
    assert.ok(!Object.values(unsealedChampions).some((c) => (c.passiveIds ?? []).some(isTitansMark)), `${id} unsealed carries the Mark`);
  }
  assert.strictEqual(titansMarkFor.Ancient, undefined, 'the Titan does not mark itself');
});
