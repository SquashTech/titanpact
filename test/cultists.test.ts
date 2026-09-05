// The Cultists (src/data/enemies.ts): the Blighted Shrine's faction, and the first mob
// roster authored for an act other than Act 1. The decided numbers a balance pass could
// move without noticing, plus the wiring that makes the Shrine field them at all.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { statusApplicationsOf } from '../src/engine/content';
import { enemies, factions, basicEnemiesOf, YUGZULACH_ID } from '../src/data/enemies';
import { locations } from '../src/data/locations';
import { actScaling, ACT_STEP_STAT_TOTAL } from '../src/run/difficulty';
import { generateEncounter, generateLeaderEncounter } from '../src/run/enemyGen';
import type { HeroDefinition, StatKey } from '../src/engine/content';

const CULTISTS = factions.cultists;
const GOBLINS = factions.goblins;

/** The game's stat-total convention (docs/run-loop.md "Measured baseline") — six combat stats, not mana or MP Regen. */
const COMBAT_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'];

function statTotal(hero: HeroDefinition): number {
  return COMBAT_STATS.reduce((sum, stat) => sum + hero.baseStats[stat], 0);
}

function meanTotal(ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + statTotal(enemies[id]), 0) / ids.length;
}

// --- The roster ---

test('cultists: the faction is 4 basics plus a leader, none of them recruitable', () => {
  assert.deepStrictEqual(
    [...CULTISTS.basicIds],
    ['cultBlade', 'dreadCultist', 'blightedCultist', 'frozenCultist']
  );
  assert.strictEqual(CULTISTS.leaderId, 'cultMystic');
  for (const id of [...CULTISTS.basicIds, CULTISTS.leaderId, YUGZULACH_ID]) {
    assert.ok(enemies[id], `${id} is not in the enemy pool`);
    assert.strictEqual(enemies[id].starter, false);
  }
});

test('cultists: every one of them is Shadow-primary — the faction is one cult, not five', () => {
  for (const id of [...CULTISTS.basicIds, CULTISTS.leaderId, YUGZULACH_ID]) {
    assert.strictEqual(enemies[id].types[0], 'Shadow', `${id} does not lead on Shadow`);
  }
  // The four basics fan out over four different second types (one of them being none at all).
  const seconds = CULTISTS.basicIds.map((id) => enemies[id].types[1] ?? null);
  assert.deepStrictEqual(seconds, ['Iron', null, 'Nature', 'Frost']);
});

test('cultists: every stat but MP Regen is a multiple of 5 — the locked authoring rule, not a coincidence', () => {
  // MP Regen is off the grid on purpose: it is the smallest-range stat in the game
  // (the Goblin Chief is already on 14), so 5-point steps there are a whole tempo tier.
  for (const id of [...CULTISTS.basicIds, CULTISTS.leaderId, YUGZULACH_ID]) {
    for (const [stat, value] of Object.entries(enemies[id].baseStats)) {
      if (stat === 'mpRegen') continue;
      assert.strictEqual(value % 5, 0, `${id}.${stat} = ${value} is not a multiple of 5`);
    }
  }
});

// --- The curve ---

test('cultists: a basic is a flat 400 — the top of the hero band, not a Goblin with a raise', () => {
  // Revised 2026-09-02: the first pass put them at ~280 and a played Act 2 squad simply
  // deleted them. A Cultist is not fodder, so it does not sit under the weakest hero (325)
  // — it sits level with the strongest (400). Fodder is what the Goblins are for.
  for (const id of CULTISTS.basicIds) {
    assert.strictEqual(statTotal(enemies[id]), 400, `${id} is off the faction's flat line`);
  }
  const gap = meanTotal(CULTISTS.basicIds) - meanTotal(GOBLINS.basicIds);
  assert.ok(gap > ACT_STEP_STAT_TOTAL * 4, `only ${gap} points clear of the Goblins`);
});

test('cultists: mana is the brake on hero-sized stat lines', () => {
  // The one place a Cultist is still a mob: every hero pool starts at 30-90 with 10 MP
  // Regen, and a Cultist matches the bottom of that band, not the top. A 400-stat enemy
  // that could also cast all fight would be a hero the player does not get to keep.
  for (const id of CULTISTS.basicIds) {
    assert.ok(enemies[id].baseStats.manaPool <= 65, `${id} casts like a hero as well as hitting like one`);
  }
});

test('cultists: the Mystic leads on its kit, and Yugzulach out-stats them both', () => {
  const mystic = statTotal(enemies[CULTISTS.leaderId]);
  assert.strictEqual(mystic, 500);
  // Deliberately flatter than the Goblin Chief's 1.8x over his own support: the leader's
  // edge here is Enfeeble and Empower, and the support is already worth buffing.
  const overSupport = mystic / meanTotal(CULTISTS.basicIds);
  assert.ok(overSupport > 1, 'the leader does not out-stat its own support');
  assert.ok(overSupport < statTotal(enemies[GOBLINS.leaderId]) / meanTotal(GOBLINS.basicIds));

  assert.strictEqual(statTotal(enemies[YUGZULACH_ID]), 700);
  assert.ok(statTotal(enemies[YUGZULACH_ID]) > mystic);
  // One act later than the Goblin Lord's 600, and authored for it.
  assert.ok(statTotal(enemies[YUGZULACH_ID]) > statTotal(enemies.goblinLord));
});

test('cultists: the faction baselines at Act 2, so it scales across acts 3-5 and never below zero', () => {
  assert.strictEqual(CULTISTS.baselineAct, 2);
  for (const [act, steps] of [[1, 0], [2, 0], [3, 1], [4, 2], [5, 3]] as const) {
    assert.strictEqual(actScaling('monsters', act, CULTISTS.baselineAct).statSteps, steps, `act ${act}`);
  }
});

// --- The kits ---

test('cultists: every kit gets STAB off both of its types and never off a third', () => {
  for (const id of [...CULTISTS.basicIds, CULTISTS.leaderId, YUGZULACH_ID]) {
    const hero = enemies[id];
    const kitTypes = new Set(hero.moveIds.map((moveId) => moves[moveId].type));
    for (const type of hero.types) {
      assert.ok(kitTypes.has(type), `${id} gets no STAB off ${type}`);
    }
  }
});

test('cultists: none of them arrives and immediately has to Rest', () => {
  // Same discipline as the Goblin Lord: one round of regen reaches the cheapest move,
  // and the opening pool covers two casts.
  for (const id of [...CULTISTS.basicIds, CULTISTS.leaderId, YUGZULACH_ID]) {
    const hero = enemies[id];
    const costs = hero.moveIds.map((moveId) => moves[moveId].manaCost);
    const cheapest = Math.min(...costs);
    assert.ok(cheapest <= hero.baseStats.mpRegen * 2, `${id} cannot regen back to its cheapest move`);
    assert.ok(hero.baseStats.manaPool >= cheapest * 2, `${id} cannot open with two moves`);
  }
});

test('cultists: the Frozen Cultist can fund its own Deep Chill into Glaciate', () => {
  // Glaciate is the one kit move the AI will refuse to declare without setup
  // (ai.ts hasLegalTarget on requiresTargetStatus), so the combo has to be affordable back to back.
  const hero = enemies.frozenCultist;
  const setup = moves.deepChill.manaCost;
  const payoff = moves.glaciate.manaCost;
  assert.strictEqual(moves.glaciate.requiresTargetStatus, 'Freeze');
  assert.ok(statusApplicationsOf(moves.deepChill).some((app) => app.statusId === 'Freeze'));
  assert.ok(hero.baseStats.manaPool >= setup + payoff, 'the pool cannot fund the combo in consecutive rounds');
});

test('cultists: the Mystic carries Empower — the mana it hands out is what the basics cannot afford', () => {
  const mystic = enemies[CULTISTS.leaderId];
  assert.ok(mystic.moveIds.includes('empower'));
  assert.strictEqual(moves.empower.target, 'singleAlly');
  const granted = moves.empower.manaGrant!;
  for (const id of CULTISTS.basicIds) {
    assert.ok(granted > enemies[id].baseStats.manaPool, `Empower does not overflow ${id}`);
  }
});

test('cultists: Yugzulach is four moves — the MOVE_CAP — spanning both damage pipelines', () => {
  const guardian = enemies[YUGZULACH_ID];
  assert.deepStrictEqual([...guardian.moveIds], ['runicBlast', 'forgottenCurse', 'duskBlade', 'eclipse']);
  const categories = new Set(guardian.moveIds.map((id) => moves[id].category));
  assert.ok(categories.has('physical') && categories.has('magical'));
  // He ties the Goblin Lord's 20 rather than raising the game's regen ceiling.
  assert.strictEqual(guardian.baseStats.mpRegen, 20);
});

// --- The wiring ---

test('cultists: the Blighted Shrine is the location that fields them', () => {
  const shrine = locations.blightedShrine;
  assert.strictEqual(shrine.factionId, 'cultists');
  assert.strictEqual(shrine.faction, 'Cultists');
  assert.strictEqual(shrine.guardianFinalEnemyId, YUGZULACH_ID);
  // Every Location has an authored roster as of 2026-09-05, so nothing falls back to the
  // Goblin default any more — Wild's Edge names it because Act 1 IS the Goblins.
  for (const location of Object.values(locations)) {
    assert.ok(factions[location.factionId], `${location.id} points at unknown faction ${location.factionId}`);
  }
  assert.strictEqual(locations.wildsEdge.factionId, 'goblins');
  assert.strictEqual(new Set(Object.values(locations).map((l) => l.factionId)).size, Object.keys(locations).length);
});

test('cultists: the fight node draws basics only, and the battle node always fields the Mystic', () => {
  const pool = basicEnemiesOf(CULTISTS);
  assert.deepStrictEqual(Object.keys(pool).sort(), [...CULTISTS.basicIds].sort());
  assert.ok(!(CULTISTS.leaderId in pool), 'the leader is drawable at a plain fight node');
  assert.ok(!(YUGZULACH_ID in pool), 'the champion is drawable at a plain fight node');

  for (let seed = 1; seed <= 20; seed++) {
    const { run: opener } = generateEncounter('fight', seed, pool, { heroCount: 2 });
    assert.strictEqual(opener.roster.length, 2);
    for (const entry of opener.roster) assert.ok(CULTISTS.basicIds.includes(entry.heroId));

    const { run: battle } = generateLeaderEncounter(seed, CULTISTS.basicIds, CULTISTS.leaderId, enemies);
    const ids = battle.roster.map((r) => r.heroId);
    assert.strictEqual(ids[0], CULTISTS.leaderId);
    assert.strictEqual(new Set(ids).size, 4, `seed ${seed} fielded a duplicate`);
    for (const id of ids.slice(1)) assert.ok(CULTISTS.basicIds.includes(id));
  }
});

test('cultists: an Act 5 Shrine fields the same roster carrying three act-steps of stats', () => {
  const scaling = actScaling('monsters', 5, CULTISTS.baselineAct);
  const { run } = generateLeaderEncounter(11, CULTISTS.basicIds, CULTISTS.leaderId, enemies, scaling);
  for (const entry of run.roster) {
    const granted = COMBAT_STATS.reduce((sum, stat) => sum + (entry.evolutionStatGrants[stat] ?? 0), 0);
    assert.strictEqual(granted, 3 * ACT_STEP_STAT_TOTAL, `${entry.heroId} did not take the full act curve`);
  }
});
