// The Raiders (src/data/enemies.ts): the Storm Coast's faction, and the second roster
// authored against the Cultists' Act 2 band. What is decided here that a balance pass
// could move without noticing is the Conduct engine — the faction's whole reason to be
// a different fight from the Cultists at the same stat total.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { statuses } from '../src/data/statuses';
import { statusApplicationsOf } from '../src/engine/content';
import { enemies, factions, basicEnemiesOf, LEVIATHAN_ID } from '../src/data/enemies';
import { locations } from '../src/data/locations';
import { typeChart } from '../src/data/typechart';
import { actScaling, ACT_STEP_CURVE, ACT_STEP_STAT_TOTAL } from '../src/run/difficulty';
import { generateEncounter, generateLeaderEncounter } from '../src/run/enemyGen';
import type { HeroDefinition, StatKey } from '../src/engine/content';

const RAIDERS = factions.raiders;
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

const EVERY_RAIDER = [...RAIDERS.basicIds, RAIDERS.leaderId] as const;

// --- The roster ---

test('raiders: the faction is 4 basics plus a leader, none of them recruitable', () => {
  assert.deepStrictEqual([...RAIDERS.basicIds], ['raider', 'stormRaider', 'surfRaider', 'mysticRaider']);
  assert.strictEqual(RAIDERS.leaderId, 'championRaider');
  for (const id of [...EVERY_RAIDER, LEVIATHAN_ID]) {
    assert.ok(enemies[id], `${id} is not in the enemy pool`);
    assert.strictEqual(enemies[id].starter, false);
  }
});

test('raiders: every Raider is Iron-primary — one warband, and Fire/Storm/Mech is what it costs', () => {
  for (const id of EVERY_RAIDER) {
    assert.strictEqual(enemies[id].types[0], 'Iron', `${id} does not lead on Iron`);
  }
  // The four basics fan out over four different second types (one of them being none at all).
  assert.deepStrictEqual(
    RAIDERS.basicIds.map((id) => enemies[id].types[1] ?? null),
    [null, 'Storm', 'Water', 'Arcane']
  );
  // The shared spine is a shared answer: these three read 2x off the primary, every time.
  for (const attacker of ['Fire', 'Storm', 'Mech'] as const) {
    assert.strictEqual(typeChart[attacker].Iron, 2, `${attacker} is no longer the price of the Iron spine`);
  }
  // The Leviathan is deliberately outside it — the champion hangs off the Location, not the faction.
  assert.deepStrictEqual([...enemies[LEVIATHAN_ID].types], ['Water', 'Ancient']);
});

test('raiders: every stat but MP Regen is a multiple of 5 — the locked authoring rule, not a coincidence', () => {
  for (const id of [...EVERY_RAIDER, LEVIATHAN_ID]) {
    for (const [stat, value] of Object.entries(enemies[id].baseStats)) {
      if (stat === 'mpRegen') continue;
      assert.strictEqual(value % 5, 0, `${id}.${stat} = ${value} is not a multiple of 5`);
    }
  }
});

// --- The curve ---

test('raiders: the same 400/500/550 band the Cultists set, because they occupy the same acts', () => {
  // Storm Coast and Blighted Shrine are both drawn from the acts 2-5 pool, so the two
  // rosters are interchangeable in the itinerary. Difficulty between them is act-scaling's
  // job (difficulty.ts), not a second stat band.
  for (const id of RAIDERS.basicIds) {
    assert.strictEqual(statTotal(enemies[id]), 400, `${id} is off the faction's flat line`);
  }
  assert.strictEqual(statTotal(enemies[RAIDERS.leaderId]), statTotal(enemies[CULTISTS.leaderId]));
  // 550, the Goblin Lord's figure: every champion shares it, and the act a Guardian is met in
  // is carried by its escorts and the act curve instead (docs/run-loop.md "The Guardian's escorts").
  assert.strictEqual(statTotal(enemies[LEVIATHAN_ID]), 550);
  assert.strictEqual(statTotal(enemies[LEVIATHAN_ID]), statTotal(enemies.goblinLord));
  const gap = meanTotal(RAIDERS.basicIds) - meanTotal(GOBLINS.basicIds);
  assert.ok(gap > ACT_STEP_STAT_TOTAL * 4, `only ${gap} points clear of the Goblins`);
});

test('raiders: mana is still the brake on hero-sized stat lines', () => {
  for (const id of RAIDERS.basicIds) {
    assert.ok(enemies[id].baseStats.manaPool <= 65, `${id} casts like a hero as well as hitting like one`);
  }
});

test('raiders: the faction baselines at Act 2, so it scales across acts 3-5 and never below zero', () => {
  assert.strictEqual(RAIDERS.baselineAct, 2);
  // Indexed off the shared acceleration curve, one act behind the skirmish track.
  for (const [act, index] of [[1, 0], [2, 0], [3, 1], [4, 2], [5, 3]] as const) {
    assert.strictEqual(actScaling('monsters', act, RAIDERS.baselineAct).statSteps, ACT_STEP_CURVE[index], `act ${act}`);
  }
});

// --- The kits ---

test('raiders: every kit gets STAB off both of its types and never off a third', () => {
  for (const id of [...EVERY_RAIDER, LEVIATHAN_ID]) {
    const hero = enemies[id];
    const kitTypes = new Set(hero.moveIds.map((moveId) => moves[moveId].type));
    for (const type of hero.types) {
      assert.ok(kitTypes.has(type), `${id} gets no STAB off ${type}`);
    }
  }
});

test('raiders: none of them arrives and immediately has to Rest', () => {
  // Same discipline as the Cultists: one round of regen reaches the cheapest move,
  // and the opening pool covers two casts.
  for (const id of [...EVERY_RAIDER, LEVIATHAN_ID]) {
    const hero = enemies[id];
    const cheapest = Math.min(...hero.moveIds.map((moveId) => moves[moveId].manaCost));
    assert.ok(cheapest <= hero.baseStats.mpRegen * 2, `${id} cannot regen back to its cheapest move`);
    assert.ok(hero.baseStats.manaPool >= cheapest * 2, `${id} cannot open with two moves`);
  }
});

// --- The Conduct engine: the faction's tell ---

test('raiders: Conduct detonates off Storm and Iron, and every Raider who swings can cash a mark', () => {
  // The status is authored to answer exactly the two types this faction is built out of,
  // so a mark the Stormraider plants pays out on the next hit anyone lands. That coupling
  // is the faction, not a coincidence of the movepool — hence a per-hero floor rather than
  // a ban on off-type halves (the Surfraider's Water is its coverage, and is meant to be there).
  assert.deepStrictEqual([...statuses.Conduct.triggerTypes!].sort(), ['Iron', 'Storm']);
  const detonatorsFor = (id: string) =>
    enemies[id].moveIds.filter((moveId) => {
      const move = moves[moveId];
      return move.basePower != null && statuses.Conduct.triggerTypes!.includes(move.type);
    });

  for (const id of EVERY_RAIDER) {
    if (id === 'mysticRaider') continue;
    assert.ok(detonatorsFor(id).length > 0, `${id} cannot cash a Conduct mark the faction planted for it`);
  }

  // The Mysticraider is the deliberate exception, and it is a content gap rather than a
  // choice: the only Iron move that runs off Intelligence is Conjured Sword at 80 mana,
  // well past the faction's mana brake. So the caster plants nothing and cashes nothing —
  // it makes the marks affordable, which is a clean enough division of labour to keep.
  assert.strictEqual(detonatorsFor('mysticRaider').length, 0);
  assert.ok(moves.conjuredSword.manaCost > enemies.mysticRaider.baseStats.manaPool);
});

test('raiders: the Stormraider is the only one who plants the mark, and it plants it on both', () => {
  const planters = EVERY_RAIDER.filter((id) =>
    enemies[id].moveIds.some((moveId) => statusApplicationsOf(moves[moveId]).some((app) => app.statusId === 'Conduct'))
  );
  assert.deepStrictEqual(planters, ['stormRaider', 'championRaider']);
  // Ionize is the setter: both foes, no chance roll, and priority so it lands before the round.
  assert.strictEqual(moves.ionize.target, 'bothEnemies');
  assert.ok(moves.ionize.priority > 0);
  const rider = statusApplicationsOf(moves.ionize).find((app) => app.statusId === 'Conduct');
  assert.ok(rider && rider.chance == null, 'Ionize no longer plants Conduct unconditionally');
});

test('raiders: the mark is what pays for the faction — two moves go free against it', () => {
  // The Raider's blade discounts off ANY mark, the Champion's Overcharge off BOTH. That
  // asymmetry is why Ionize (both enemies) is the setter rather than Storm Lash (one).
  assert.strictEqual(moves.metallicBlade.conditionalManaCost!.requiresAnyEnemyStatus, 'Conduct');
  assert.strictEqual(moves.metallicBlade.conditionalManaCost!.manaCost, 0);
  assert.ok(enemies.raider.moveIds.includes('metallicBlade'));

  assert.strictEqual(moves.overcharge.conditionalManaCost!.requiresAllEnemiesStatus, 'Conduct');
  assert.strictEqual(moves.overcharge.conditionalManaCost!.manaCost, 0);
  assert.ok(enemies.championRaider.moveIds.includes('overcharge'));

  // Both are priced out of reach at full cost on their own pool, so the discount is the point.
  assert.ok(moves.overcharge.manaCost > enemies.championRaider.baseStats.mpRegen * 2);
});

test('raiders: the Stormraider can cast Ionize and still reach Storm Lash the next round', () => {
  // The AI prices moves off the pre-round snapshot (ai.ts), so a mark planted this round
  // pays out next round — the pool has to survive the setup turn.
  const hero = enemies.stormRaider;
  const setup = moves.ionize.manaCost;
  const followUp = moves.stormLash.manaCost;
  assert.ok(hero.baseStats.manaPool - setup + hero.baseStats.mpRegen >= followUp, 'the setup turn empties the pool');
});

test('raiders: the Mysticraider tops the line back up rather than overflowing it', () => {
  // Infuse is the basic-tier answer to the faction's own mana brake. It deliberately does
  // NOT overflow the way the Cult Mystic's Empower does — refilling a 65 pool is a basic's
  // contribution; blowing past it is a leader's.
  const mystic = enemies.mysticRaider;
  assert.ok(mystic.moveIds.includes('infuse'));
  assert.strictEqual(moves.infuse.target, 'singleAlly');
  const granted = moves.infuse.manaGrant!;
  for (const id of RAIDERS.basicIds) {
    assert.ok(granted <= enemies[id].baseStats.manaPool, `Infuse overflows ${id} — that is Empower's job`);
  }
  assert.ok(moves.empower.manaGrant! > granted);
  // No Attack in its line, so its Iron STAB is the one that does not need any.
  assert.ok(mystic.baseStats.attack < mystic.baseStats.intelligence);
  assert.strictEqual(moves.fortify.target, 'self');
  assert.strictEqual(moves.fortify.basePower, undefined);
});

test('raiders: the Champion is a physical line where the Cult Mystic is a caster', () => {
  const champion = enemies[RAIDERS.leaderId];
  assert.deepStrictEqual([...champion.moveIds], ['heavyBlow', 'stormLash', 'reinforce', 'overcharge']);
  for (const moveId of champion.moveIds) assert.strictEqual(moves[moveId].category, 'physical');
  assert.ok(champion.baseStats.attack > champion.baseStats.intelligence);
  assert.ok(enemies[CULTISTS.leaderId].baseStats.intelligence > enemies[CULTISTS.leaderId].baseStats.attack);
  // Reinforce is the leader half of the tell: the warband hits harder while he is up.
  assert.strictEqual(moves.reinforce.target, 'bothAllies');
});

test('raiders: the Leviathan is four moves — the MOVE_CAP — spanning both damage pipelines', () => {
  const guardian = enemies[LEVIATHAN_ID];
  assert.deepStrictEqual([...guardian.moveIds], ['aquaSlice', 'maelstrom', 'archonBlast', 'tsunami']);
  const categories = new Set(guardian.moveIds.map((id) => moves[id].category));
  assert.ok(categories.has('physical') && categories.has('magical'));
  // It ties the other two champions' 20 rather than raising the game's regen ceiling.
  assert.strictEqual(guardian.baseStats.mpRegen, 20);
  assert.strictEqual(guardian.baseStats.mpRegen, enemies.yugzulach.baseStats.mpRegen);
});

// --- The wiring ---

test('raiders: the Storm Coast is the location that fields them', () => {
  const coast = locations.stormCoast;
  assert.strictEqual(coast.factionId, 'raiders');
  assert.strictEqual(coast.faction, 'Raiders');
  assert.strictEqual(coast.guardianFinalEnemyId, LEVIATHAN_ID);
  // Its affinity leans on the two types the Raiders themselves are built out of.
  for (const type of ['Storm', 'Iron', 'Water'] as const) assert.ok(coast.affinity!.includes(type));
});

test('raiders: the fight node draws basics only, and the battle node always fields the Champion', () => {
  const pool = basicEnemiesOf(RAIDERS);
  assert.deepStrictEqual(Object.keys(pool).sort(), [...RAIDERS.basicIds].sort());
  assert.ok(!(RAIDERS.leaderId in pool), 'the leader is drawable at a plain fight node');
  assert.ok(!(LEVIATHAN_ID in pool), 'the champion is drawable at a plain fight node');

  for (let seed = 1; seed <= 20; seed++) {
    const { run: opener } = generateEncounter('fight', seed, pool, { heroCount: 2 });
    assert.strictEqual(opener.roster.length, 2);
    for (const entry of opener.roster) assert.ok(RAIDERS.basicIds.includes(entry.heroId));

    const { run: battle } = generateLeaderEncounter(seed, RAIDERS.basicIds, RAIDERS.leaderId, enemies);
    const ids = battle.roster.map((r) => r.heroId);
    assert.strictEqual(ids[0], RAIDERS.leaderId);
    assert.strictEqual(new Set(ids).size, 4, `seed ${seed} fielded a duplicate`);
    for (const id of ids.slice(1)) assert.ok(RAIDERS.basicIds.includes(id));
  }
});

test('raiders: an Act 5 Storm Coast fields the same roster carrying the full act curve of stats', () => {
  const scaling = actScaling('monsters', 5, RAIDERS.baselineAct);
  const { run } = generateLeaderEncounter(7, RAIDERS.basicIds, RAIDERS.leaderId, enemies, scaling);
  for (const entry of run.roster) {
    const granted = COMBAT_STATS.reduce((sum, stat) => sum + (entry.evolutionStatGrants[stat] ?? 0), 0);
    assert.strictEqual(granted, scaling.statSteps * ACT_STEP_STAT_TOTAL, `${entry.heroId} did not take the full act curve`);
  }
});
