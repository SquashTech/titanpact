// The Fae (src/data/enemies.ts): the Forbidden Forest's faction, and the third roster
// authored against the Cultists' Act 2 band. What is decided here that a balance pass
// could move without noticing is the Renew engine — the faction's whole reason to be a
// different fight from the Cultists and the Raiders at the same stat total.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { fieldEffects } from '../src/data/fieldEffects';
import { statuses } from '../src/data/statuses';
import { statusApplicationsOf } from '../src/engine/content';
import { enemies, factions, basicEnemiesOf, ELDER_BOUGH_ID } from '../src/data/enemies';
import { locations } from '../src/data/locations';
import { typeChart } from '../src/data/typechart';
import { actScaling, ACT_STEP_CURVE, ACT_STEP_STAT_TOTAL } from '../src/run/difficulty';
import { generateEncounter, generateLeaderEncounter } from '../src/run/enemyGen';
import type { HeroDefinition, StatKey } from '../src/engine/content';

const FAE = factions.fae;
const CULTISTS = factions.cultists;
const RAIDERS = factions.raiders;
const GOBLINS = factions.goblins;

/** The game's stat-total convention (docs/run-loop.md "Measured baseline") — six combat stats, not mana or MP Regen. */
const COMBAT_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'];

function statTotal(hero: HeroDefinition): number {
  return COMBAT_STATS.reduce((sum, stat) => sum + hero.baseStats[stat], 0);
}

function meanTotal(ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + statTotal(enemies[id]), 0) / ids.length;
}

const EVERY_FAE = [...FAE.basicIds, FAE.leaderId] as const;

// --- The roster ---

test('fae: the faction is 4 basics plus a leader, none of them recruitable', () => {
  assert.deepStrictEqual([...FAE.basicIds], ['pixie', 'faeWarrior', 'lightFairy', 'mechaFairy']);
  assert.strictEqual(FAE.leaderId, 'pixieQueen');
  for (const id of [...EVERY_FAE, ELDER_BOUGH_ID]) {
    assert.ok(enemies[id], `${id} is not in the enemy pool`);
    assert.strictEqual(enemies[id].starter, false);
  }
});

test('fae: every Fae is Nature-primary — and that spine hands out the widest answer in the game', () => {
  for (const id of [...EVERY_FAE, ELDER_BOUGH_ID]) {
    assert.strictEqual(enemies[id].types[0], 'Nature', `${id} does not lead on Nature`);
  }
  // The four basics fan out over four different second types (one of them being none at all).
  assert.deepStrictEqual(
    FAE.basicIds.map((id) => enemies[id].types[1] ?? null),
    [null, 'Iron', 'Light', 'Mech']
  );
  // Four attacking types read 2x off Nature, against Shadow's two and Iron's three. The Fae
  // are the most counterable faction on purpose; the Renew engine is what they get for it.
  const answersTo = (spine: 'Nature' | 'Shadow' | 'Iron') =>
    Object.keys(typeChart).filter((attacker) => typeChart[attacker as keyof typeof typeChart][spine] === 2);
  assert.deepStrictEqual(answersTo('Nature').sort(), ['Beast', 'Fire', 'Frost', 'Shadow']);
  assert.ok(answersTo('Nature').length > answersTo('Shadow').length);
  assert.ok(answersTo('Nature').length > answersTo('Iron').length);
});

test('fae: the Elder Bough sits INSIDE the spine, the way Yugzulach does and the Leviathan does not', () => {
  assert.deepStrictEqual([...enemies[ELDER_BOUGH_ID].types], ['Nature', 'Ancient']);
  assert.strictEqual(enemies.yugzulach.types[0], enemies[CULTISTS.leaderId].types[0]);
  assert.notStrictEqual(enemies.leviathan.types[0], enemies[RAIDERS.leaderId].types[0]);
});

test('fae: every stat but MP Regen is a multiple of 5 — the locked authoring rule, not a coincidence', () => {
  for (const id of [...EVERY_FAE, ELDER_BOUGH_ID]) {
    for (const [stat, value] of Object.entries(enemies[id].baseStats)) {
      if (stat === 'mpRegen') continue;
      assert.strictEqual(value % 5, 0, `${id}.${stat} = ${value} is not a multiple of 5`);
    }
  }
});

// --- The curve ---

test('fae: the same 400/500/700 band the Cultists set, because they occupy the same acts', () => {
  for (const id of FAE.basicIds) {
    assert.strictEqual(statTotal(enemies[id]), 400, `${id} is off the faction's flat line`);
  }
  assert.strictEqual(statTotal(enemies[FAE.leaderId]), statTotal(enemies[CULTISTS.leaderId]));
  assert.strictEqual(statTotal(enemies[ELDER_BOUGH_ID]), 700);
  const gap = meanTotal(FAE.basicIds) - meanTotal(GOBLINS.basicIds);
  assert.ok(gap > ACT_STEP_STAT_TOTAL * 4, `only ${gap} points clear of the Goblins`);
});

test('fae: mana is still the brake on hero-sized stat lines', () => {
  for (const id of FAE.basicIds) {
    assert.ok(enemies[id].baseStats.manaPool <= 65, `${id} casts like a hero as well as hitting like one`);
  }
});

test('fae: the faction baselines at Act 2, so it scales across acts 3-5 and never below zero', () => {
  assert.strictEqual(FAE.baselineAct, 2);
  // Indexed off the shared acceleration curve, one act behind the skirmish track.
  for (const [act, index] of [[1, 0], [2, 0], [3, 1], [4, 2], [5, 3]] as const) {
    assert.strictEqual(actScaling('monsters', act, FAE.baselineAct).statSteps, ACT_STEP_CURVE[index], `act ${act}`);
  }
});

// --- The kits ---

test('fae: every kit gets STAB off both of its types and never off a third', () => {
  for (const id of [...EVERY_FAE, ELDER_BOUGH_ID]) {
    const hero = enemies[id];
    const kitTypes = new Set(hero.moveIds.map((moveId) => moves[moveId].type));
    for (const type of hero.types) {
      assert.ok(kitTypes.has(type), `${id} gets no STAB off ${type}`);
    }
    for (const type of kitTypes) {
      assert.ok(hero.types.includes(type), `${id} carries an off-type ${type} move`);
    }
  }
});

test('fae: none of them arrives and immediately has to Rest', () => {
  // Same discipline as the Cultists and the Raiders: one round of regen reaches the
  // cheapest move, and the opening pool covers two casts.
  for (const id of [...EVERY_FAE, ELDER_BOUGH_ID]) {
    const hero = enemies[id];
    const cheapest = Math.min(...hero.moveIds.map((moveId) => moves[moveId].manaCost));
    assert.ok(cheapest <= hero.baseStats.mpRegen * 2, `${id} cannot regen back to its cheapest move`);
    assert.ok(hero.baseStats.manaPool >= cheapest * 2, `${id} cannot open with two moves`);
  }
});

// --- The Renew engine: the faction's tell ---

test('fae: Renew is the tell, and every Fae but the bruiser either plants it or cashes it', () => {
  // The Raiders' Conduct is a mark that pays out on a hit. Renew is a buff that pays out
  // three ways at once, and this is the coupling that makes the roster one faction rather
  // than four green things: planters feed cashers feed the ground itself.
  const plants = (id: string) =>
    enemies[id].moveIds.some((moveId) => statusApplicationsOf(moves[moveId]).some((app) => app.statusId === 'Renew'));
  const cashes = (id: string) =>
    enemies[id].moveIds.some((moveId) => moves[moveId].conditionalPower?.requiresUserStatus === 'Renew');

  assert.deepStrictEqual(EVERY_FAE.filter(plants), ['pixie', 'lightFairy', 'pixieQueen']);
  assert.deepStrictEqual(EVERY_FAE.filter(cashes), ['pixie', 'mechaFairy']);
  // The Fae Warrior is the deliberate exception and it is a design choice, not a gap: under
  // Verdant Earth its Attack carries the line's Renew, so it cashes the engine by existing.
  assert.ok(!plants('faeWarrior') && !cashes('faeWarrior'));
  assert.ok(enemies.faeWarrior.baseStats.attack > enemies.faeWarrior.baseStats.intelligence);
});

test('fae: Renew decays on its own clock — the brake on an engine with no other ceiling', () => {
  assert.strictEqual(statuses.Renew.decay, 'halve');
  assert.strictEqual(statuses.Renew.ticksAtEndOfRound, true);
  assert.strictEqual(statuses.Renew.positive, true);
  // Positive, so Cleanse never answers it. Outdamaging the heal is the counterplay.
  assert.strictEqual(statuses.Renew.clearsOnSwitch, false);
});

test('fae: Verdant Earth is what turns a heal into a stat line, and it is symmetric', () => {
  const ground = fieldEffects.verdantEarth;
  assert.strictEqual(ground.statBonusEqualToStatusMagnitude!.statusId, 'Renew');
  assert.deepStrictEqual([...ground.statBonusEqualToStatusMagnitude!.stats], ['attack', 'intelligence']);
  // Nothing in the definition scopes it to a side — a player squad carrying its own Renew
  // gets the same stats out of the Fae's ground. That is the counterplay, not an oversight.
  assert.ok(!('side' in ground));
});

test('fae: Magic Growth is this faction Ionize — on a BASIC, so the tell shows up at a plain fight node', () => {
  // The Stormraider precedent: put the field setter on the leader and a `fight` node never
  // sees the faction's mechanic at all.
  assert.strictEqual(moves.magicGrowth.fieldEffectApplication, 'verdantEarth');
  assert.ok(FAE.basicIds.includes('lightFairy'));
  assert.ok(enemies.lightFairy.moveIds.includes('magicGrowth'));
  // And it pays for its own setup turn: the Renew rider is what the ground then reads.
  const rider = statusApplicationsOf(moves.magicGrowth).find((app) => app.statusId === 'Renew');
  assert.ok(rider && rider.chance == null, 'Magic Growth no longer plants Renew unconditionally');
  // The Light Fairy can set the ground and still reach Mend the next round.
  const hero = enemies.lightFairy;
  assert.ok(hero.baseStats.manaPool - moves.magicGrowth.manaCost + hero.baseStats.mpRegen >= moves.mend.manaCost);
});

test('fae: the Pixie is the cheap planter and the payoff on one body', () => {
  // Regrowth hits bothAllies, which includes itself — so it arms its own Seed Shot.
  assert.strictEqual(moves.regrowth.target, 'bothAllies');
  assert.strictEqual(moves.seedShot.conditionalPower!.multiplier, 2);
  const hero = enemies.pixie;
  assert.ok(hero.moveIds.includes('regrowth') && hero.moveIds.includes('seedShot'));
  assert.ok(hero.baseStats.manaPool >= moves.regrowth.manaCost + moves.seedShot.manaCost, 'cannot plant and cash in one pool');
  // Fastest of the basics: the plant wants to land before the round it pays for.
  assert.strictEqual(Math.max(...FAE.basicIds.map((id) => enemies[id].baseStats.speed)), hero.baseStats.speed);
});

test('fae: the Queen escalates the engine rather than out-swinging it', () => {
  const queen = enemies[FAE.leaderId];
  assert.deepStrictEqual([...queen.moveIds], ['magicGrowth', 'wildBloom', 'arcaneBlast', 'magicBolt']);
  assert.ok(queen.baseStats.intelligence > queen.baseStats.attack, 'the Queen is a caster, like the Cult Mystic');
  // Wild Bloom is the escalation no basic can afford: Renew 50 on both, which under her own
  // Magic Growth is +50 Attack and +50 Intelligence to the whole side.
  assert.strictEqual(moves.wildBloom.target, 'bothAllies');
  const queenPlant = statusApplicationsOf(moves.wildBloom).find((app) => app.statusId === 'Renew')!.magnitude!;
  const basicPlant = statusApplicationsOf(moves.regrowth).find((app) => app.statusId === 'Renew')!.magnitude!;
  assert.ok(queenPlant > basicPlant);
  assert.ok(!FAE.basicIds.some((id) => enemies[id].moveIds.includes('wildBloom')), 'a basic carries the escalation');
  // A basic that did carry it would spend its whole pool on one plant; the Queen's 100 does not.
  for (const id of FAE.basicIds) {
    assert.ok(moves.wildBloom.manaCost > enemies[id].baseStats.manaPool / 2, `${id} could cast it twice over`);
  }
  assert.ok(enemies[FAE.leaderId].baseStats.manaPool >= moves.wildBloom.manaCost + moves.magicGrowth.manaCost);
});

test('fae: the Elder Bough is one turn paying out three times, and Speed 30 is the price', () => {
  const guardian = enemies[ELDER_BOUGH_ID];
  assert.deepStrictEqual([...guardian.moveIds], ['runicBlast', 'overgrowth', 'branchSlam', 'forceOfNature']);
  // Four moves — the MOVE_CAP — spanning both damage pipelines, like the other two champions.
  const categories = new Set(guardian.moveIds.map((id) => moves[id].category));
  assert.ok(categories.has('physical') && categories.has('magical'));
  assert.strictEqual(guardian.baseStats.mpRegen, 20);
  assert.strictEqual(guardian.baseStats.mpRegen, enemies.leviathan.baseStats.mpRegen);

  // Overgrowth is the three-payout turn: ~200 HP healed over the following rounds, +100
  // Attack under Verdant Earth, and the switch that doubles Branch Slam's 80 base power.
  const selfPlant = statusApplicationsOf(moves.overgrowth).find((app) => app.statusId === 'Renew')!.magnitude!;
  assert.strictEqual(selfPlant, 100);
  assert.strictEqual(moves.branchSlam.conditionalPower!.requiresUserStatus, 'Renew');
  assert.strictEqual(moves.forceOfNature.fieldEffectApplication, 'verdantEarth');
  // It can afford the setup turn and the payoff back to back.
  assert.ok(guardian.baseStats.manaPool >= moves.overgrowth.manaCost + moves.branchSlam.manaCost);
  // The slowest champion by a clear margin — it sets up in the open, in front of you.
  for (const id of ['goblinLord', 'yugzulach', 'leviathan']) {
    assert.ok(guardian.baseStats.speed < enemies[id].baseStats.speed, `the Elder Bough outruns the ${id}`);
  }
});

// --- The wiring ---

test('fae: the Forbidden Forest is the location that fields them', () => {
  const forest = locations.forbiddenForest;
  assert.strictEqual(forest.factionId, 'fae');
  assert.strictEqual(forest.faction, 'Fae');
  assert.strictEqual(forest.guardianFinalEnemyId, ELDER_BOUGH_ID);
  // Its affinity leans on two of the types the Fae themselves are built out of.
  for (const type of ['Nature', 'Light'] as const) assert.ok(forest.affinity!.includes(type));
});

test('fae: the fight node draws basics only, and the battle node always fields the Queen', () => {
  const pool = basicEnemiesOf(FAE);
  assert.deepStrictEqual(Object.keys(pool).sort(), [...FAE.basicIds].sort());
  assert.ok(!(FAE.leaderId in pool), 'the leader is drawable at a plain fight node');
  assert.ok(!(ELDER_BOUGH_ID in pool), 'the champion is drawable at a plain fight node');

  for (let seed = 1; seed <= 20; seed++) {
    const { run: opener } = generateEncounter('fight', seed, pool, { heroCount: 2 });
    assert.strictEqual(opener.roster.length, 2);
    for (const entry of opener.roster) assert.ok(FAE.basicIds.includes(entry.heroId));

    const { run: battle } = generateLeaderEncounter(seed, FAE.basicIds, FAE.leaderId, enemies);
    const ids = battle.roster.map((r) => r.heroId);
    assert.strictEqual(ids[0], FAE.leaderId);
    assert.strictEqual(new Set(ids).size, 4, `seed ${seed} fielded a duplicate`);
    for (const id of ids.slice(1)) assert.ok(FAE.basicIds.includes(id));
  }
});

test('fae: an Act 5 Forbidden Forest fields the same roster carrying the full act curve of stats', () => {
  const scaling = actScaling('monsters', 5, FAE.baselineAct);
  const { run } = generateLeaderEncounter(7, FAE.basicIds, FAE.leaderId, enemies, scaling);
  for (const entry of run.roster) {
    const granted = COMBAT_STATS.reduce((sum, stat) => sum + (entry.evolutionStatGrants[stat] ?? 0), 0);
    assert.strictEqual(granted, scaling.statSteps * ACT_STEP_STAT_TOTAL, `${entry.heroId} did not take the full act curve`);
  }
});
