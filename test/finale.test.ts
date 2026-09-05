// Act 6 — the Vigil and the final battle (docs/run-loop.md §4, docs/lore.md). The
// decided shape a later pass could move without noticing: what the finale fields, in
// what order, at what power, and the three windows 6v6 actually opens.

import * as assert from 'assert';
import { test } from './harness';
import {
  enemies,
  finaleEnemies,
  unsealedChampions,
  unsealedIdFor,
  CHAMPION_IDS,
  ENDBRINGER_ID,
} from '../src/data/enemies';
import { FINALE_LOCATION_ID, ITINERARY_POOL_IDS, locations } from '../src/data/locations';
import { typeChart } from '../src/data/typechart';
import { resolveTypeMult } from '../src/engine/damage/typeMult';
import { generateFinaleEncounter } from '../src/run/enemyGen';
import { generateItinerary, unbrokenSealLocationId } from '../src/run/locations';
import { generateMap } from '../src/run/map';
import { recordBrokenSeal } from '../src/run/runProgress';
import { rollGuildHallOffers } from '../src/run/shop';
import { guildHallOffers } from '../src/data/recruitment';
import { equipment } from '../src/data/equipment';
import { requiredSquadSize, STANDARD_SQUAD_SIZE } from '../src/run/squad';
import {
  addRosterEntry,
  createRosterEntry,
  createRunState,
  FINALE_ACT,
  ROSTER_CAP,
  SEAL_ACTS,
  TOTAL_ACTS,
  type BrokenSeal,
} from '../src/run/state';
import type { StatKey } from '../src/engine/content';

const COMBAT_STATS: readonly StatKey[] = ['hp', 'attack', 'defense', 'intelligence', 'wisdom', 'speed'];

function statTotal(id: string): number {
  return COMBAT_STATS.reduce((sum, stat) => sum + enemies[id].baseStats[stat], 0);
}

function seal(actNumber: number, championId: string, level = 1, statGrants: Partial<Record<StatKey, number>> = {}): BrokenSeal {
  return { actNumber, locationId: 'wildsEdge', championId, level, statGrants };
}

// --- The Endbringer ---

test('endbringer: mono-Ancient, and therefore the only thing on the board nothing beats', () => {
  const titan = enemies[ENDBRINGER_ID];
  assert.deepStrictEqual([...titan.types], ['Ancient']);
  for (const attacker of Object.keys(typeChart) as (keyof typeof typeChart)[]) {
    // Ancient itself reads 1x, because its attacker row is empty by design — a seal is not
    // a weapon (docs/lore.md §8). Nothing a player can field is in that row.
    const expected = attacker === 'Ancient' ? 1 : 0.5;
    assert.strictEqual(resolveTypeMult(typeChart, attacker, titan.types), expected, `${attacker} gets through the wall`);
  }
});

test('endbringer: 900 stats — a step above the champions, not a different number class', () => {
  assert.strictEqual(statTotal(ENDBRINGER_ID), 900);
  for (const id of CHAMPION_IDS) {
    assert.ok(statTotal(ENDBRINGER_ID) > statTotal(id), `${id} matches the Titan`);
  }
  // Speed 95 clears the fastest authored hero (90) and nothing more: it is a Speed number,
  // not an exemption, and every priority bracket still beats it.
  assert.strictEqual(enemies[ENDBRINGER_ID].baseStats.speed, 95);
});

test('endbringer: it is the ONE mono-Ancient combatant — a second would read as a second Titan', () => {
  for (const other of Object.values(enemies)) {
    if (other.id === ENDBRINGER_ID) continue;
    assert.ok(!(other.types.length === 1 && other.types[0] === 'Ancient'), `${other.id} is also a wall`);
  }
});

// --- Unsealing ---

test('unsealed: a champion comes back without the Ancient half, and identical in every other way', () => {
  for (const id of CHAMPION_IDS) {
    const sealed = enemies[id];
    const unsealedForm = unsealedChampions[unsealedIdFor(id)];
    assert.ok(unsealedForm, `${id} has no unsealed form`);
    assert.deepStrictEqual([...sealed.types], [sealed.types[0], 'Ancient'], `${id} is not Ancient-second`);
    assert.deepStrictEqual([...unsealedForm.types], [sealed.types[0]]);
    assert.strictEqual(unsealedForm.name, sealed.name);
    assert.deepStrictEqual(unsealedForm.baseStats, sealed.baseStats);
    assert.deepStrictEqual([...unsealedForm.moveIds], [...sealed.moveIds]);
  }
});

test('unsealed: taking the seal off puts every champion back on the type chart', () => {
  // The whole balance reason for it (docs/lore.md §6): five Ancient walls plus the Titan
  // is a fight with no answers, and a fight with no answers ends on the Pact Clock.
  for (const id of CHAMPION_IDS) {
    const unsealedForm = unsealedChampions[unsealedIdFor(id)];
    const beatable = (Object.keys(typeChart) as (keyof typeof typeChart)[]).some(
      (attacker) => resolveTypeMult(typeChart, attacker, unsealedForm.types) > 1
    );
    assert.ok(beatable, `${id} is still a wall after unsealing`);
  }
});

test('unsealed: the finale pool holds the six unsealed forms and the Titan, and no sealed champion', () => {
  assert.strictEqual(Object.keys(finaleEnemies).length, CHAMPION_IDS.length + 1);
  assert.ok(finaleEnemies[ENDBRINGER_ID]);
  for (const id of CHAMPION_IDS) assert.ok(!(id in finaleEnemies), `${id} reaches the finale still sealed`);
});

// --- The encounter ---

test('finale: the seals field in the order they were broken, and the Titan is last', () => {
  const seals = [
    seal(3, 'leviathan'),
    seal(1, 'goblinLord'),
    seal(5, 'skeletonKing'),
    seal(2, 'yugzulach'),
    seal(4, 'lavaBeast'),
  ];
  const { squad } = generateFinaleEncounter(seals, ENDBRINGER_ID, finaleEnemies);

  assert.deepStrictEqual([...squad.activeIds], [unsealedIdFor('goblinLord'), unsealedIdFor('yugzulach')]);
  assert.deepStrictEqual(squad.benchIds, [
    unsealedIdFor('leviathan'),
    unsealedIdFor('lavaBeast'),
    unsealedIdFor('skeletonKing'),
    ENDBRINGER_ID,
  ]);
});

test('finale: a champion arrives at the level and act scaling it was beaten at, not a re-roll', () => {
  const grants: Partial<Record<StatKey, number>> = { attack: 30, hp: 20 };
  const { run } = generateFinaleEncounter([seal(4, 'lavaBeast', 7, grants)], ENDBRINGER_ID, finaleEnemies);
  const entry = run.roster.find((r) => r.rosterId === unsealedIdFor('lavaBeast'));
  assert.ok(entry);
  assert.strictEqual(entry!.level, 7);
  assert.deepStrictEqual(entry!.evolutionStatGrants, grants);
  // Which is what makes the fight escalate across itself: an Act 2 seal comes back at Act 2.
  const { run: early } = generateFinaleEncounter([seal(2, 'lavaBeast', 3, {})], ENDBRINGER_ID, finaleEnemies);
  assert.strictEqual(early.roster[0].level, 3);
  assert.deepStrictEqual(early.roster[0].evolutionStatGrants, {});
});

test('finale: it is 6 a side, and every one of them is a distinct combatant', () => {
  const seals = CHAMPION_IDS.slice(0, SEAL_ACTS).map((id, i) => seal(i + 1, id));
  const { run, squad } = generateFinaleEncounter(seals, ENDBRINGER_ID, finaleEnemies);
  assert.strictEqual(run.roster.length, ROSTER_CAP);
  const fielded = [...squad.activeIds.filter((id): id is string => id !== null), ...squad.benchIds];
  assert.strictEqual(new Set(fielded).size, ROSTER_CAP);
});

test('finale: a run that somehow broke nothing still meets the Titan alone rather than crashing', () => {
  const { run, squad } = generateFinaleEncounter([], ENDBRINGER_ID, finaleEnemies);
  assert.strictEqual(run.roster.length, 1);
  assert.deepStrictEqual([...squad.activeIds], [ENDBRINGER_ID, null]);
});

// --- The ledger ---

test('brokenSeals: a re-resolved Guardian node never records the same act twice', () => {
  let run = createRunState();
  run = recordBrokenSeal(run, seal(1, 'goblinLord', 1));
  run = recordBrokenSeal(run, seal(1, 'goblinLord', 99));
  assert.strictEqual(run.brokenSeals.length, 1);
  assert.strictEqual(run.brokenSeals[0].level, 1);
});

// --- The itinerary ---

test('finale: an itinerary is six long, ends at the Threshold, and leaves exactly one seal unbroken', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const itinerary = generateItinerary(seed);
    assert.strictEqual(itinerary.length, TOTAL_ACTS);
    assert.strictEqual(itinerary[FINALE_ACT - 1], FINALE_LOCATION_ID);
    const visitedPool = ITINERARY_POOL_IDS.filter((id) => itinerary.includes(id));
    assert.strictEqual(visitedPool.length, SEAL_ACTS - 1, `seed ${seed}`);
    const unbroken = unbrokenSealLocationId(itinerary);
    assert.ok(unbroken && !itinerary.includes(unbroken), `seed ${seed} has no sixth seal`);
  }
});

test('finale: the Threshold is a real location the draw can never produce', () => {
  assert.ok(locations[FINALE_LOCATION_ID]);
  assert.strictEqual(locations[FINALE_LOCATION_ID].guardianFinalEnemyId, ENDBRINGER_ID);
  assert.ok(!ITINERARY_POOL_IDS.includes(FINALE_LOCATION_ID));
});

// --- The map ---

test('finale: act 6 is a corridor — the Vigil, then the Endbringer, no branch', () => {
  const map = generateMap(1234, FINALE_ACT);
  assert.deepStrictEqual(
    map.rows.map((row) => row.map((id) => map.nodes[id].type)),
    [['muster'], ['finale']]
  );
  assert.strictEqual(map.nodes[map.startNodeIds[0]].nextIds.length, 1);
  assert.strictEqual(map.nodes[map.bossNodeId].type, 'finale');
  // Seedless in effect: the corridor is the same map whatever the run rolled.
  assert.deepStrictEqual(generateMap(9, FINALE_ACT).nodes, generateMap(1234, FINALE_ACT).nodes);
});

test('finale: the seal acts still get the branching map — act 6 is the only corridor', () => {
  for (let act = 1; act <= SEAL_ACTS; act++) {
    const map = generateMap(5, act);
    assert.ok(map.rows.length > 2, `act ${act} collapsed to a corridor`);
    assert.strictEqual(map.nodes[map.bossNodeId].type, 'boss');
  }
});

// --- The Vigil ---

test('vigil: it offers enough recruits to fill the roster, plus one so it stays a choice', () => {
  for (const rosterSize of [2, 3, 4, 5]) {
    let run = { ...createRunState(), actNumber: FINALE_ACT };
    for (let i = 0; i < rosterSize; i++) {
      run = addRosterEntry(run, createRosterEntry(`r${i}`, 'cinderKnight', []));
    }
    const offers = rollGuildHallOffers(run, guildHallOffers, Object.values(equipment), true);
    assert.ok(
      offers.heroOfferIds.length >= ROSTER_CAP - rosterSize,
      `roster ${rosterSize} cannot be filled from ${offers.heroOfferIds.length} offers`
    );
  }
});

test('vigil: a plain Guild Hall still offers 2-3, so the fill is the Vigil doing it', () => {
  const run = { ...createRunState(), actNumber: 3 };
  for (let i = 0; i < 20; i++) {
    const offers = rollGuildHallOffers(run, guildHallOffers, Object.values(equipment));
    assert.ok(offers.heroOfferIds.length === 2 || offers.heroOfferIds.length === 3);
  }
});

// --- The 6v6 windows ---

test('finale: the whole roster fields, where every other fight is bring-6-pick-4', () => {
  assert.strictEqual(requiredSquadSize(6), STANDARD_SQUAD_SIZE);
  assert.strictEqual(requiredSquadSize(6, ROSTER_CAP), ROSTER_CAP);
  // Below the cap it is still "everyone", never a hero benched by omission.
  assert.strictEqual(requiredSquadSize(3, ROSTER_CAP), 3);
});
