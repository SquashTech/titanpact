// The Vulcans (src/data/enemies.ts): the Molten Foundry's faction, and the fourth roster
// authored against the Cultists' Act 2 band. Two things are decided here that a balance
// pass could move without noticing — the Scorched Land / Burn engine, and the deliberate
// ABSENCE of a single type spine, which is what the name is for.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { fieldEffects } from '../src/data/fieldEffects';
import { statuses } from '../src/data/statuses';
import { statusApplicationsOf } from '../src/engine/content';
import { enemies, factions, basicEnemiesOf, LAVA_BEAST_ID } from '../src/data/enemies';
import { locations } from '../src/data/locations';
import { typeChart } from '../src/data/typechart';
import { resolveTypeMult } from '../src/engine/damage/typeMult';
import { actScaling, ACT_STEP_CURVE, ACT_STEP_STAT_TOTAL } from '../src/run/difficulty';
import { generateEncounter, generateLeaderEncounter } from '../src/run/enemyGen';
import type { HeroDefinition, StatKey } from '../src/engine/content';

const VULCANS = factions.vulcans;
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

const EVERY_VULCAN = [...VULCANS.basicIds, VULCANS.leaderId] as const;

// --- The roster ---

test('vulcans: the faction is 4 basics plus a leader, none of them recruitable', () => {
  assert.deepStrictEqual([...VULCANS.basicIds], ['flameSprite', 'steamSpirit', 'emberLizard', 'automaton']);
  assert.strictEqual(VULCANS.leaderId, 'vulcadozer');
  for (const id of [...EVERY_VULCAN, LAVA_BEAST_ID]) {
    assert.ok(enemies[id], `${id} is not in the enemy pool`);
    assert.strictEqual(enemies[id].starter, false);
  }
});

test('vulcans: NO single type spine — the first faction since the Goblins without one', () => {
  // Fire runs through four of the six and Mech through the other two. The name is the
  // Foundry's, not either half's, which is the whole reason it is not "Automatons".
  const primaries = [...EVERY_VULCAN, LAVA_BEAST_ID].map((id) => enemies[id].types[0]);
  assert.deepStrictEqual(primaries, ['Fire', 'Fire', 'Fire', 'Mech', 'Mech', 'Fire']);
  assert.strictEqual(new Set(primaries).size, 2);
  // Every other authored faction leads on exactly one type.
  for (const faction of [factions.cultists, factions.raiders, factions.fae]) {
    const spine = new Set([...faction.basicIds, faction.leaderId].map((id) => enemies[id].types[0]));
    assert.strictEqual(spine.size, 1, `${faction.id} lost its spine`);
  }
});

test('vulcans: Water answers the whole roster — and then does not answer the Guardian', () => {
  // A mixed faction is still counterable as a unit here, because both halves share an answer:
  // Water is 2x into Fire and 2x into Mech. What redeems it is where the exception sits — a
  // squad that brought Water cuts through the Foundry and meets the boss with nothing left
  // (docs/locations.md §6).
  const waterAgainst = (id: string) => resolveTypeMult(typeChart, 'Water', enemies[id].types);
  for (const id of EVERY_VULCAN) {
    assert.strictEqual(waterAgainst(id), 2, `Water no longer answers the ${id}`);
  }
  assert.strictEqual(waterAgainst(LAVA_BEAST_ID), 1, "the Guardian is no longer the hole in its faction's counter");
  // And nothing else is even super-effective against it: Ancient is a pure defensive wall.
  for (const attacker of Object.keys(typeChart) as (keyof typeof typeChart)[]) {
    assert.ok(resolveTypeMult(typeChart, attacker, enemies[LAVA_BEAST_ID].types) <= 1, `${attacker} breaks the wall`);
  }
});

test('vulcans: every stat but MP Regen is a multiple of 5 — the locked authoring rule, not a coincidence', () => {
  for (const id of [...EVERY_VULCAN, LAVA_BEAST_ID]) {
    for (const [stat, value] of Object.entries(enemies[id].baseStats)) {
      if (stat === 'mpRegen') continue;
      assert.strictEqual(value % 5, 0, `${id}.${stat} = ${value} is not a multiple of 5`);
    }
  }
});

// --- The curve ---

test('vulcans: the same 400/500/700 band the Cultists set, because they occupy the same acts', () => {
  for (const id of VULCANS.basicIds) {
    assert.strictEqual(statTotal(enemies[id]), 400, `${id} is off the faction's flat line`);
  }
  assert.strictEqual(statTotal(enemies[VULCANS.leaderId]), statTotal(enemies[CULTISTS.leaderId]));
  assert.strictEqual(statTotal(enemies[LAVA_BEAST_ID]), 700);
  const gap = meanTotal(VULCANS.basicIds) - meanTotal(GOBLINS.basicIds);
  assert.ok(gap > ACT_STEP_STAT_TOTAL * 4, `only ${gap} points clear of the Goblins`);
});

test('vulcans: mana is still the brake on hero-sized stat lines', () => {
  for (const id of VULCANS.basicIds) {
    assert.ok(enemies[id].baseStats.manaPool <= 65, `${id} casts like a hero as well as hitting like one`);
  }
});

test('vulcans: the faction baselines at Act 2, so it scales across acts 3-5 and never below zero', () => {
  assert.strictEqual(VULCANS.baselineAct, 2);
  // Indexed off the shared acceleration curve, one act behind the skirmish track.
  for (const [act, index] of [[1, 0], [2, 0], [3, 1], [4, 2], [5, 3]] as const) {
    assert.strictEqual(actScaling('monsters', act, VULCANS.baselineAct).statSteps, ACT_STEP_CURVE[index], `act ${act}`);
  }
});

// --- The kits ---

test('vulcans: every kit gets STAB off both of its types and never off a third', () => {
  for (const id of [...EVERY_VULCAN, LAVA_BEAST_ID]) {
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

test('vulcans: none of them arrives and immediately has to Rest', () => {
  for (const id of [...EVERY_VULCAN, LAVA_BEAST_ID]) {
    const hero = enemies[id];
    const cheapest = Math.min(...hero.moveIds.map((moveId) => moves[moveId].manaCost));
    assert.ok(cheapest <= hero.baseStats.mpRegen * 2, `${id} cannot regen back to its cheapest move`);
    assert.ok(hero.baseStats.manaPool >= cheapest * 2, `${id} cannot open with two moves`);
  }
});

// --- The Burn engine: the faction's tell ---

test('vulcans: Scorched Land is the tell — Burn stacks additively and then barely decays', () => {
  // Burn halves every round on its own. Scorched Land slows exactly that to a quarter, and
  // because the status stacks ADDITIVELY the stack climbs fast once the ground is lit. That
  // pairing is the faction; neither half is interesting alone.
  assert.strictEqual(statuses.Burn.decay, 'halve');
  assert.strictEqual(statuses.Burn.stacking, 'additive');
  assert.deepStrictEqual([...fieldEffects.scorchedLand.slowsStatusDecay!.statusIds], ['Burn']);
  assert.strictEqual(fieldEffects.scorchedLand.slowsStatusDecay!.retain, 0.75);
  assert.strictEqual(moves.spreadingBlaze.fieldEffectApplication, 'scorchedLand');
  // The setter also plants, on BOTH foes, so the turn spent on the ground is never a blank.
  assert.strictEqual(moves.spreadingBlaze.target, 'bothEnemies');
  const rider = statusApplicationsOf(moves.spreadingBlaze).find((app) => app.statusId === 'Burn');
  assert.ok(rider && rider.chance == null, 'Spreading Blaze no longer plants Burn unconditionally');
});

test('vulcans: the counterplay is authored into the status, not into the kits', () => {
  // A switch wipes the whole stack. Which means the engine sharpens exactly as the fight
  // grinds down, because the lock-in rule takes voluntary switching away at 2 KO'd heroes
  // (CLAUDE.md "Mana & tempo"). That coupling is the reason this roster is a different
  // fight from the Fae's Renew rather than the same fight in another colour.
  assert.strictEqual(statuses.Burn.clearsOnSwitch, true);
  assert.notStrictEqual(statuses.Renew.clearsOnSwitch, statuses.Burn.clearsOnSwitch);
});

test('vulcans: Immolate is the cash-in, and the setter is on a BASIC so a plain fight node sees it', () => {
  // The Stormraider / Light Fairy precedent: a field setter behind the leader means a `fight`
  // node never sees the faction's mechanic at all.
  assert.strictEqual(moves.immolate.conditionalPower!.requiresTargetStatus, 'Burn');
  assert.strictEqual(moves.immolate.conditionalPower!.multiplier, 3);
  assert.ok(VULCANS.basicIds.includes('flameSprite'));
  assert.ok(enemies.flameSprite.moveIds.includes('spreadingBlaze') && enemies.flameSprite.moveIds.includes('immolate'));
  // And the Sprite's pool is sized to light the ground and cash it in one opening.
  assert.ok(enemies.flameSprite.baseStats.manaPool >= moves.spreadingBlaze.manaCost + moves.immolate.manaCost);
  // Fastest thing in the enemy pool: a field planted after the round it was meant to pay for
  // is a wasted turn.
  const fastest = Math.max(...Object.values(enemies).map((e) => e.baseStats.speed));
  assert.strictEqual(enemies.flameSprite.baseStats.speed, fastest);
});

test('vulcans: three of the four basics plant Burn, and the Lizard is the one that does it physically', () => {
  const plants = (id: string) =>
    enemies[id].moveIds.some((moveId) =>
      statusApplicationsOf(moves[moveId]).some((app) => app.statusId === 'Burn' && app.target === 'moveTarget')
    );
  assert.deepStrictEqual(VULCANS.basicIds.filter(plants), ['flameSprite', 'steamSpirit', 'emberLizard', 'automaton']);
  // Molten Lash is the only Burn in the faction that runs off Attack, which is what lets the
  // one non-caster basic feed the engine at all.
  assert.strictEqual(moves.moltenLash.category, 'physical');
  assert.ok(enemies.emberLizard.moveIds.includes('moltenLash'));
  assert.ok(enemies.emberLizard.baseStats.attack > enemies.emberLizard.baseStats.intelligence);
});

test('vulcans: the Mech half pays the same fire it deals — the Foundry in one line', () => {
  // Overheat Burns the target for 20 and the USER for 20, and under the faction's own
  // Scorched Land that self-Burn never decays either.
  const selfBurn = statusApplicationsOf(moves.overheat).filter((app) => app.target === 'self');
  assert.deepStrictEqual(selfBurn.map((app) => app.statusId), ['Burn']);
  assert.ok(enemies.automaton.moveIds.includes('overheat'));
  // 50 mana on a 60 pool: it vents once and then clanks.
  assert.ok(moves.overheat.manaCost > enemies.automaton.baseStats.manaPool - moves.overheat.manaCost);
  // Malfunction's rider is rolled from three statuses, one of which this faction cannot cash.
  const rolled = moves.malfunction.randomStatusApplication!.map((app) => app.statusId);
  assert.ok(rolled.includes('Burn') && rolled.includes('Conduct'));
  const cashesConduct = [...EVERY_VULCAN, LAVA_BEAST_ID].some((id) =>
    enemies[id].moveIds.some((moveId) => moves[moveId].conditionalManaCost?.requiresAnyEnemyStatus === 'Conduct')
  );
  assert.ok(!cashesConduct, 'a Vulcan can now cash a Conduct mark — the Malfunction roll is no longer a cost');
});

test('vulcans: the Vulcadozer is a physical line that deliberately touches no Burn at all', () => {
  const leader = enemies[VULCANS.leaderId];
  assert.deepStrictEqual([...leader.moveIds], ['cogBop', 'cogSlam', 'whirlingBlades', 'juryRig']);
  for (const moveId of leader.moveIds) assert.strictEqual(moves[moveId].category, 'physical');
  assert.ok(leader.baseStats.attack > leader.baseStats.intelligence);
  const touchesBurn = leader.moveIds.some((moveId) =>
    statusApplicationsOf(moves[moveId]).some((app) => app.statusId === 'Burn')
  );
  assert.ok(!touchesBurn, 'the Foundry leader is the MACHINE answer to a fire faction');
  // What it contributes instead: a rolled team buff, and two moves that roll their own bracket.
  assert.strictEqual(moves.juryRig.target, 'bothAllies');
  assert.ok(moves.juryRig.randomStatDeltas);
  const rollsPriority = leader.moveIds.filter((moveId) => moves[moveId].randomPriority);
  assert.deepStrictEqual(rollsPriority, ['cogBop', 'cogSlam']);
});

test('vulcans: the Lava Beast lights its own ground and grinds on it', () => {
  const guardian = enemies[LAVA_BEAST_ID];
  assert.deepStrictEqual([...guardian.moveIds], ['runicBlast', 'spreadingBlaze', 'immolate', 'firebrand']);
  // Four moves — the MOVE_CAP — spanning both damage pipelines, like the other three champions.
  const categories = new Set(guardian.moveIds.map((id) => moves[id].category));
  assert.ok(categories.has('physical') && categories.has('magical'));
  assert.strictEqual(guardian.baseStats.mpRegen, 20);
  assert.strictEqual(guardian.baseStats.mpRegen, enemies.elderBough.baseStats.mpRegen);

  assert.ok(guardian.moveIds.includes('spreadingBlaze'), 'the boss no longer lights the ground it burns on');
  // NOTHING it carries burns itself. Measured before this was fixed: Volcanic Surge's self
  // Burn 30 does not decay on the boss's own Scorched Land either, so two casts put 60 a
  // round on a 265 HP body and the fight became "outlast its suicide". Guarded, not assumed.
  for (const moveId of guardian.moveIds) {
    for (const app of statusApplicationsOf(moves[moveId])) {
      assert.notStrictEqual(app.target, 'self', `${moveId} puts ${app.statusId} back on the Guardian`);
    }
  }
  // Every move is cheap enough that it acts every round on its pool rather than banking turns.
  const perRound = Math.max(...guardian.moveIds.map((id) => moves[id].manaCost));
  assert.ok(guardian.baseStats.manaPool >= perRound * 3, 'the Guardian has to Rest inside a normal fight');
});

// --- The wiring ---

test('vulcans: the Molten Foundry is the location that fields them, under the new name', () => {
  const foundry = locations.moltenFoundry;
  assert.strictEqual(foundry.factionId, 'vulcans');
  // Renamed off "Automatons" (2026-09-05): four of the six are not Mechs at all.
  assert.strictEqual(foundry.faction, 'Vulcans');
  assert.strictEqual(foundry.guardianFinalEnemyId, LAVA_BEAST_ID);
  for (const type of ['Fire', 'Mech'] as const) assert.ok(foundry.affinity!.includes(type));
});

test('vulcans: the fight node draws basics only, and the battle node always fields the Vulcadozer', () => {
  const pool = basicEnemiesOf(VULCANS);
  assert.deepStrictEqual(Object.keys(pool).sort(), [...VULCANS.basicIds].sort());
  assert.ok(!(VULCANS.leaderId in pool), 'the leader is drawable at a plain fight node');
  assert.ok(!(LAVA_BEAST_ID in pool), 'the champion is drawable at a plain fight node');

  for (let seed = 1; seed <= 20; seed++) {
    const { run: opener } = generateEncounter('fight', seed, pool, { heroCount: 2 });
    assert.strictEqual(opener.roster.length, 2);
    for (const entry of opener.roster) assert.ok(VULCANS.basicIds.includes(entry.heroId));

    const { run: battle } = generateLeaderEncounter(seed, VULCANS.basicIds, VULCANS.leaderId, enemies);
    const ids = battle.roster.map((r) => r.heroId);
    assert.strictEqual(ids[0], VULCANS.leaderId);
    assert.strictEqual(new Set(ids).size, 4, `seed ${seed} fielded a duplicate`);
    for (const id of ids.slice(1)) assert.ok(VULCANS.basicIds.includes(id));
  }
});

test('vulcans: an Act 5 Molten Foundry fields the same roster carrying the full act curve of stats', () => {
  const scaling = actScaling('monsters', 5, VULCANS.baselineAct);
  const { run } = generateLeaderEncounter(7, VULCANS.basicIds, VULCANS.leaderId, enemies, scaling);
  for (const entry of run.roster) {
    const granted = COMBAT_STATS.reduce((sum, stat) => sum + (entry.evolutionStatGrants[stat] ?? 0), 0);
    assert.strictEqual(granted, scaling.statSteps * ACT_STEP_STAT_TOTAL, `${entry.heroId} did not take the full act curve`);
  }
});
