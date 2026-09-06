// The Undead (src/data/enemies.ts): the Necropolis's faction, the fifth roster authored
// against the Cultists' Act 2 band, and the one that finishes the faction bill. Two things
// are decided here that a balance pass could move without noticing — the Haunt engine and
// the low-HP payoffs that make it a trap rather than a grind — plus one structural first:
// a LEADER authored outside its own faction's type spine.

import * as assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { statuses } from '../src/data/statuses';
import { statusApplicationsOf } from '../src/engine/content';
import { enemies, factions, basicEnemiesOf, SKELETON_KING_ID } from '../src/data/enemies';
import { locations } from '../src/data/locations';
import { typeChart } from '../src/data/typechart';
import { resolveTypeMult } from '../src/engine/damage/typeMult';
import { actScaling, ACT_STEP_CURVE, ACT_STEP_STAT_TOTAL } from '../src/run/difficulty';
import { generateEncounter, generateLeaderEncounter } from '../src/run/enemyGen';
import type { HeroDefinition, StatKey } from '../src/engine/content';

const UNDEAD = factions.undead;
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

const EVERY_UNDEAD = [...UNDEAD.basicIds, UNDEAD.leaderId] as const;

// --- The roster ---

test('undead: the faction is 4 basics plus a leader, none of them recruitable', () => {
  assert.deepStrictEqual([...UNDEAD.basicIds], ['skullShambler', 'skeletonKnight', 'shamblingHusk', 'boneConjurer']);
  assert.strictEqual(UNDEAD.leaderId, 'dreadRaven');
  for (const id of [...EVERY_UNDEAD, SKELETON_KING_ID]) {
    assert.ok(enemies[id], `${id} is not in the enemy pool`);
    assert.strictEqual(enemies[id].starter, false);
  }
});

test('undead: Spirit-primary on the basics and the Guardian — the tightest spine in the game', () => {
  for (const id of [...UNDEAD.basicIds, SKELETON_KING_ID]) {
    assert.strictEqual(enemies[id].types[0], 'Spirit', `${id} does not lead on Spirit`);
  }
  assert.deepStrictEqual(
    UNDEAD.basicIds.map((id) => enemies[id].types[1] ?? null),
    [null, 'Iron', 'Nature', 'Mind']
  );
  // Only two attacking types read 2x off Spirit, level with the Cultists' Shadow and under
  // the Raiders' three and the Fae's four.
  const answersTo = (spine: 'Spirit' | 'Shadow' | 'Nature') =>
    Object.keys(typeChart).filter((a) => typeChart[a as keyof typeof typeChart][spine] === 2);
  assert.deepStrictEqual(answersTo('Spirit').sort(), ['Arcane', 'Mind']);
  assert.strictEqual(answersTo('Spirit').length, answersTo('Shadow').length);
  assert.ok(answersTo('Spirit').length < answersTo('Nature').length);
});

test('undead: the LEADER is outside the spine — a first, and the point of the fight', () => {
  // Every other faction's leader shares its basics' primary. The Dread Raven does not, and
  // the consequence is mechanical rather than cosmetic: Haunt triggers off Spirit and Mind,
  // so Beast and Shadow moves do not spread.
  assert.deepStrictEqual([...enemies[UNDEAD.leaderId].types], ['Beast', 'Shadow']);
  for (const faction of [factions.cultists, factions.raiders, factions.fae]) {
    assert.strictEqual(
      enemies[faction.leaderId].types[0],
      enemies[faction.basicIds[0]].types[0],
      `${faction.id}'s leader left its spine`
    );
  }
  const spread = statuses.Haunt.spreadTriggerTypes!;
  for (const type of enemies[UNDEAD.leaderId].types) {
    assert.ok(!spread.includes(type), `the Raven's ${type} now carries through Haunt`);
  }
  for (const moveId of enemies[UNDEAD.leaderId].moveIds) {
    assert.ok(!spread.includes(moves[moveId].type), `${moveId} makes the Raven's blows carry after all`);
  }
});

test('undead: every stat but MP Regen is a multiple of 5 — the locked authoring rule, not a coincidence', () => {
  for (const id of [...EVERY_UNDEAD, SKELETON_KING_ID]) {
    for (const [stat, value] of Object.entries(enemies[id].baseStats)) {
      if (stat === 'mpRegen') continue;
      assert.strictEqual(value % 5, 0, `${id}.${stat} = ${value} is not a multiple of 5`);
    }
  }
});

// --- The curve ---

test('undead: the same 400/500/550 band the Cultists set, because they occupy the same acts', () => {
  for (const id of UNDEAD.basicIds) {
    assert.strictEqual(statTotal(enemies[id]), 400, `${id} is off the faction's flat line`);
  }
  assert.strictEqual(statTotal(enemies[UNDEAD.leaderId]), statTotal(enemies[CULTISTS.leaderId]));
  // 550, the Goblin Lord's figure: every champion shares it, and the act a Guardian is met in
  // is carried by its escorts and the act curve instead (docs/run-loop.md "The Guardian's escorts").
  assert.strictEqual(statTotal(enemies[SKELETON_KING_ID]), 550);
  assert.strictEqual(statTotal(enemies[SKELETON_KING_ID]), statTotal(enemies.goblinLord));
  const gap = meanTotal(UNDEAD.basicIds) - meanTotal(GOBLINS.basicIds);
  assert.ok(gap > ACT_STEP_STAT_TOTAL * 4, `only ${gap} points clear of the Goblins`);
});

test('undead: mana is still the brake on hero-sized stat lines', () => {
  for (const id of UNDEAD.basicIds) {
    assert.ok(enemies[id].baseStats.manaPool <= 65, `${id} casts like a hero as well as hitting like one`);
  }
});

test('undead: the faction baselines at Act 2, so it scales across acts 3-5 and never below zero', () => {
  assert.strictEqual(UNDEAD.baselineAct, 2);
  // Indexed off the shared acceleration curve, one act behind the skirmish track.
  for (const [act, index] of [[1, 0], [2, 0], [3, 1], [4, 2], [5, 3]] as const) {
    assert.strictEqual(actScaling('monsters', act, UNDEAD.baselineAct).statSteps, ACT_STEP_CURVE[index], `act ${act}`);
  }
});

// --- The kits ---

test('undead: every kit gets STAB off both of its types and never off a third', () => {
  for (const id of [...EVERY_UNDEAD, SKELETON_KING_ID]) {
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

test('undead: none of them arrives and immediately has to Rest', () => {
  for (const id of [...EVERY_UNDEAD, SKELETON_KING_ID]) {
    const hero = enemies[id];
    const cheapest = Math.min(...hero.moveIds.map((moveId) => moves[moveId].manaCost));
    assert.ok(cheapest <= hero.baseStats.mpRegen * 2, `${id} cannot regen back to its cheapest move`);
    assert.ok(hero.baseStats.manaPool >= cheapest * 2, `${id} cannot open with two moves`);
  }
});

// --- The Haunt engine: the faction's tell ---

test('undead: Haunt is the tell, and it is the first engine that changes WHO gets hit', () => {
  // Conduct pays out on a hit, Renew buys stats, Scorched Land stops a decay. Haunt takes a
  // single-target cast aimed at one hero and lands it on both — and CLAUDE.md's locked
  // invariants include "no spread damage reduction", so nothing scales the second hit down.
  assert.strictEqual(statuses.Haunt.pipeline, 'target');
  assert.deepStrictEqual([...statuses.Haunt.spreadTriggerTypes!].sort(), ['Mind', 'Spirit']);
  // It triggers off exactly the two types this faction's basics are built out of.
  const basicMoveTypes = new Set(UNDEAD.basicIds.flatMap((id) => enemies[id].moveIds.map((m) => moves[m].type)));
  for (const type of statuses.Haunt.spreadTriggerTypes!) {
    assert.ok(basicMoveTypes.has(type), `no basic swings ${type}, so the mark pays out on nothing`);
  }
  // Boolean and non-stacking: one mark is the whole effect, so re-applying it is a wasted
  // turn the AI already declines (ai.ts riderIsRedundant).
  assert.strictEqual(statuses.Haunt.shape, 'boolean');
  assert.strictEqual(statuses.Haunt.stacking, 'none');
  assert.strictEqual(statuses.Haunt.clearsOnSwitch, true);
});

test('undead: two of the four basics plant the mark, and Torment is the reliable one', () => {
  const plants = (id: string) =>
    enemies[id].moveIds.filter((moveId) =>
      statusApplicationsOf(moves[moveId]).some((app) => app.statusId === 'Haunt')
    );
  assert.deepStrictEqual(UNDEAD.basicIds.filter((id) => plants(id).length > 0), [
    'skullShambler',
    'boneConjurer',
  ]);
  // Torment is unconditional and cheap — the setter, on a BASIC, so a plain `fight` node sees
  // the faction's mechanic and not only a `battle` (the Stormraider / Light Fairy precedent).
  const rider = statusApplicationsOf(moves.torment).find((app) => app.statusId === 'Haunt');
  assert.ok(rider && rider.chance == null, 'Torment no longer plants Haunt unconditionally');
  assert.ok(enemies.skullShambler.moveIds.includes('torment'));
  assert.ok(moves.torment.manaCost <= enemies.skullShambler.baseStats.mpRegen * 3);
  // The Conjurer is the one that must die if the player wants the spread to stop: two
  // sources, and the only member swinging Haunt's second trigger type.
  assert.strictEqual(plants('boneConjurer').length, 2);
  assert.ok(enemies.boneConjurer.moveIds.some((m) => moves[m].type === 'Mind'));
  const otherMindSwingers = [...EVERY_UNDEAD, SKELETON_KING_ID].filter(
    (id) => id !== 'boneConjurer' && enemies[id].moveIds.some((m) => moves[m].type === 'Mind')
  );
  assert.deepStrictEqual(otherMindSwingers, []);
});

test('undead: the second half — they get stronger the closer they are to dead', () => {
  // Spite doubles below 50% of the USER's HP, Vengeance triples below 25%. Which interlocks
  // with Haunt: spreading the player's damage across both enemies walks BOTH into Spite range
  // together instead of letting either be removed cleanly. Chipping the Necropolis arms it.
  assert.strictEqual(moves.spite.conditionalPower!.requiresUserHpBelow, 0.5);
  assert.strictEqual(moves.spite.conditionalPower!.multiplier, 2);
  assert.strictEqual(moves.vengeance.conditionalPower!.requiresUserHpBelow, 0.25);
  assert.strictEqual(moves.vengeance.conditionalPower!.multiplier, 3);

  // The Shambler is the lowest-HP thing at the 400 band, so it reaches Spite's window on the
  // player's first hit — the engine's second half shows up before the fight is decided. The
  // comparison is against that band and not the whole pool: an Act 1 Goblin is lower still,
  // and is fodder rather than content this measures against.
  const basicsBand = Object.values(enemies).filter((e) => statTotal(e) === 400);
  assert.strictEqual(enemies.skullShambler.baseStats.hp, Math.min(...basicsBand.map((e) => e.baseStats.hp)));
  assert.ok(enemies.skullShambler.moveIds.includes('spite'));
  // The Husk is its mirror: bulkiest basic in the game, slowest thing anywhere, built to
  // still be standing when its own payoff arms.
  assert.strictEqual(enemies.shamblingHusk.baseStats.hp, Math.max(...basicsBand.map((e) => e.baseStats.hp)));
  assert.strictEqual(enemies.shamblingHusk.baseStats.speed, Math.min(...Object.values(enemies).map((e) => e.baseStats.speed)));
  assert.ok(enemies.shamblingHusk.moveIds.includes('vengeance'));
});

test('undead: Rend is how the off-spine leader joins the engine without a Spirit move', () => {
  const leader = enemies[UNDEAD.leaderId];
  assert.deepStrictEqual([...leader.moveIds], ['claw', 'rend', 'lacerate', 'shadowSlice']);
  for (const moveId of leader.moveIds) assert.strictEqual(moves[moveId].category, 'physical');
  assert.ok(leader.baseStats.attack > leader.baseStats.intelligence);
  // Double damage against a target under half HP — on a board where Haunt has just put BOTH
  // heroes there at once.
  assert.strictEqual(moves.rend.conditionalPower!.requiresTargetHpBelow, 0.5);
  assert.strictEqual(moves.rend.conditionalPower!.multiplier, 2);
  // Fastest leader in the game, and the softest: 75 Defense is what makes "kill the Raven"
  // a real option against "kill the Conjurer".
  const leaders = [factions.cultists, factions.raiders, factions.fae, factions.vulcans].map((f) => enemies[f.leaderId]);
  assert.ok(leaders.every((l) => l.baseStats.speed < leader.baseStats.speed));
  assert.ok(leaders.every((l) => l.baseStats.defense > leader.baseStats.defense));
});

test('undead: the Skeleton King is the lowest-HP champion, and that IS the fight', () => {
  const guardian = enemies[SKELETON_KING_ID];
  assert.deepStrictEqual([...guardian.moveIds], ['runicBlast', 'poltergeist', 'wailingFlight', 'vengeance']);
  // Four moves — the MOVE_CAP — spanning both damage pipelines, like the other four champions.
  const categories = new Set(guardian.moveIds.map((id) => moves[id].category));
  assert.ok(categories.has('physical') && categories.has('magical'));
  assert.strictEqual(guardian.baseStats.mpRegen, 20);

  // It plants its own mark and then triples under 25%. The window is ~54 HP wide — roughly
  // one player turn — and the whole fight is whether that turn kills it or feeds it.
  assert.ok(guardian.moveIds.some((m) => statusApplicationsOf(moves[m]).some((a) => a.statusId === 'Haunt')));
  assert.ok(guardian.moveIds.includes('vengeance'));
  for (const id of ['goblinLord', 'yugzulach', 'leviathan', 'elderBough', 'lavaBeast']) {
    assert.ok(guardian.baseStats.hp < enemies[id].baseStats.hp, `the ${id} is squishier than the King`);
  }

  // No self-destruct: Last Rites is bp120 that drops the user to 1 HP, the same class of
  // move the Lava Beast lost Volcanic Surge over. A boss that ends itself makes turtling the
  // answer; Vengeance punishes a sloppy finish instead of performing one.
  assert.ok(!guardian.moveIds.includes('lastRites'));
  for (const moveId of guardian.moveIds) {
    for (const app of statusApplicationsOf(moves[moveId])) {
      assert.notStrictEqual(app.target, 'self', `${moveId} puts ${app.statusId} back on the Guardian`);
    }
  }
  // Ancient makes the champion the wall the other four are: nothing is super-effective on it.
  for (const attacker of Object.keys(typeChart) as (keyof typeof typeChart)[]) {
    assert.ok(resolveTypeMult(typeChart, attacker, guardian.types) <= 1, `${attacker} breaks the wall`);
  }
});

// --- The wiring ---

test('undead: the Necropolis is the location that fields them, and the faction bill is paid', () => {
  const necropolis = locations.necropolis;
  assert.strictEqual(necropolis.factionId, 'undead');
  assert.strictEqual(necropolis.faction, 'Undead');
  assert.strictEqual(necropolis.guardianFinalEnemyId, SKELETON_KING_ID);
  for (const type of ['Spirit', 'Shadow'] as const) assert.ok(necropolis.affinity!.includes(type));
  // The last one. Every Location now has an authored roster AND an authored champion.
  for (const location of Object.values(locations)) {
    assert.ok(factions[location.factionId], `${location.id} points at unknown faction ${location.factionId}`);
    assert.ok(location.guardianFinalEnemyId, `${location.id} still has no Guardian champion`);
    assert.ok(enemies[location.guardianFinalEnemyId], `${location.id} points at a champion that does not exist`);
  }
  // One faction per SEAL location; the finale's Threshold has none of its own (docs/run-loop.md §4).
  assert.strictEqual(Object.keys(factions).length, Object.keys(locations).length - 1);
});

test('undead: the fight node draws basics only, and the battle node always fields the Raven', () => {
  const pool = basicEnemiesOf(UNDEAD);
  assert.deepStrictEqual(Object.keys(pool).sort(), [...UNDEAD.basicIds].sort());
  assert.ok(!(UNDEAD.leaderId in pool), 'the leader is drawable at a plain fight node');
  assert.ok(!(SKELETON_KING_ID in pool), 'the champion is drawable at a plain fight node');

  for (let seed = 1; seed <= 20; seed++) {
    const { run: opener } = generateEncounter('fight', seed, pool, { heroCount: 2 });
    assert.strictEqual(opener.roster.length, 2);
    for (const entry of opener.roster) assert.ok(UNDEAD.basicIds.includes(entry.heroId));

    const { run: battle } = generateLeaderEncounter(seed, UNDEAD.basicIds, UNDEAD.leaderId, enemies);
    const ids = battle.roster.map((r) => r.heroId);
    assert.strictEqual(ids[0], UNDEAD.leaderId);
    assert.strictEqual(new Set(ids).size, 4, `seed ${seed} fielded a duplicate`);
    for (const id of ids.slice(1)) assert.ok(UNDEAD.basicIds.includes(id));
  }
});

test('undead: an Act 5 Necropolis fields the same roster carrying the full act curve of stats', () => {
  const scaling = actScaling('monsters', 5, UNDEAD.baselineAct);
  const { run } = generateLeaderEncounter(7, UNDEAD.basicIds, UNDEAD.leaderId, enemies, scaling);
  for (const entry of run.roster) {
    const granted = COMBAT_STATS.reduce((sum, stat) => sum + (entry.evolutionStatGrants[stat] ?? 0), 0);
    assert.strictEqual(granted, scaling.statSteps * ACT_STEP_STAT_TOTAL, `${entry.heroId} did not take the full act curve`);
  }
});
