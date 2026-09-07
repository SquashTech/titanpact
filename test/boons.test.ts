import * as assert from 'assert';
import { test } from './harness';
import { TYPES } from '../src/data/typechart';
import { heroes } from '../src/data/heroes';
import { moves } from '../src/data/moves';
import { passives, boonPassives, typeDamagePassiveFor, TYPE_DAMAGE_BONUS, TYPE_DAMAGE_PASSIVE_TYPES } from '../src/data/passives';
import { classes } from '../src/data/classes';
import { progressionTable } from '../src/data/progression';
import { BOON_OFFER_COUNT, boonMoveCount, boonMoveType, boonPool, pickBoonOffers, rosterTypes } from '../src/run/boons';
import { createRunState, createRosterEntry, addRosterEntry } from '../src/run/state';
import { MAP_NODE_TYPES } from '../src/run/map';

const entry = (heroId: string) => createRosterEntry(heroId, heroId, heroes[heroId].moveIds);

/** A hero of each named type, for the roster-filter tests. */
function heroOfType(type: string): string {
  const hero = Object.values(heroes).find((h) => h.types.includes(type as never));
  assert.ok(hero, `no hero is ${type}-typed`);
  return hero!.id;
}

// --- The catalog ---

test('boons: one type-locked Boon per type, Ancient excluded, each a TYPE_DAMAGE_BONUS on its own type', () => {
  // Ancient has none for the same reason the Ancient Force relic had none: no hero is
  // Ancient-typed and no hero can reach an Ancient move, so it would be a grant nobody can use.
  assert.deepStrictEqual([...TYPE_DAMAGE_PASSIVE_TYPES], TYPES.filter((t) => t !== 'Ancient'));
  assert.strictEqual(typeDamagePassiveFor.Ancient, undefined);

  for (const type of TYPE_DAMAGE_PASSIVE_TYPES) {
    const def = passives[typeDamagePassiveFor[type]!];
    assert.ok(def, `${type} has no Boon definition`);
    assert.deepStrictEqual(def.damageModifier, { eventFieldEquals: { moveType: type }, amount: TYPE_DAMAGE_BONUS });
  }
});

test('boons: every type-locked Boon names a type some hero actually fields', () => {
  const rosterable = new Set(Object.values(heroes).flatMap((hero) => hero.types as readonly string[]));
  // A graft-only type still counts: an Evolution can put a hero into it mid-run.
  for (const nodes of Object.values(progressionTable.evolutions)) {
    for (const node of nodes) for (const path of node.paths) if (path.typeGraft) rosterable.add(path.typeGraft);
  }
  for (const type of TYPE_DAMAGE_PASSIVE_TYPES) {
    assert.ok(rosterable.has(type), `${type} has a Boon but no hero can ever be ${type}-typed`);
  }
});

test('boons: the generic pool is roster-agnostic — no Evolution passive and no Class in it', () => {
  const evolutionGranted = new Set<string>();
  for (const nodes of Object.values(progressionTable.evolutions)) {
    for (const node of nodes) for (const path of node.paths) for (const id of path.grantsPassiveIds ?? []) evolutionGranted.add(id);
  }
  for (const id of Object.keys(boonPassives)) {
    assert.ok(!evolutionGranted.has(id), `${id} is an Evolution path's identity and must not be a Boon`);
    assert.ok(!classes[id], `${id} is a Class and has its own node`);
    assert.ok(passives[id], `${id} is missing from the passive catalog`);
  }
});

// --- The roster filter (src/run/boons.ts) ---

test('boons: the pool is every generic Boon plus one per type the roster fields', () => {
  const fireHero = heroOfType('Fire');
  let run = createRunState();
  run = addRosterEntry(run, entry(fireHero));

  const pool = new Set(boonPool(run.roster, heroes));
  for (const id of Object.keys(boonPassives)) assert.ok(pool.has(id), `generic Boon ${id} is missing from the pool`);
  assert.ok(pool.has(typeDamagePassiveFor.Fire!), 'a Fire hero was not offered the Fire Boon');

  // Every type the roster does NOT field is withheld — that filter is what keeps a type Boon
  // from ever being a dead option on the card.
  const owned = rosterTypes(run.roster, heroes);
  for (const type of TYPE_DAMAGE_PASSIVE_TYPES) {
    if (owned.has(type)) continue;
    assert.ok(!pool.has(typeDamagePassiveFor[type]!), `${type} Boon offered to a roster with no ${type} hero`);
  }
});

test('boons: an empty roster is offered the generic pool and nothing else', () => {
  assert.deepStrictEqual(boonPool([], heroes).sort(), Object.keys(boonPassives).sort());
});

test('boons: rosterTypes reads an Evolution type-graft, not just the authored types', () => {
  const fireHero = heroOfType('Fire');
  const base = entry(fireHero);
  const grafted = { ...base, evolutionTypeGraft: 'Storm' as never };
  const types = rosterTypes([grafted], heroes);
  assert.ok(types.has('Storm'), 'a grafted type is not reachable by a Boon');
  assert.ok(types.has(heroes[fireHero].types[0]), 'the innate primary survived the graft');
});

test('boons: an offer is BOON_OFFER_COUNT distinct passives from the pool', () => {
  let run = createRunState();
  run = addRosterEntry(run, entry(heroOfType('Fire')));
  const pool = new Set(boonPool(run.roster, heroes));

  for (let i = 0; i < 50; i++) {
    const offer = pickBoonOffers(run.roster, heroes);
    assert.strictEqual(offer.length, BOON_OFFER_COUNT);
    assert.strictEqual(new Set(offer).size, BOON_OFFER_COUNT, `offer repeated a Boon: ${offer}`);
    for (const id of offer) assert.ok(pool.has(id), `${id} is not in this roster's pool`);
  }
});

// --- The hero-fit readout (BoonNodeScreen's second phase) ---

test('boons: boonMoveType reads the lock off the definition, and is null for a generic Boon', () => {
  assert.strictEqual(boonMoveType(passives[typeDamagePassiveFor.Fire!]), 'Fire');
  assert.strictEqual(boonMoveType(passives.bloodthirst), null);
  assert.strictEqual(boonMoveType(undefined), null);
});

test('boons: boonMoveCount counts the moves a type Boon would actually fire on', () => {
  const fireHero = heroOfType('Fire');
  const e = entry(fireHero);
  const expected = e.unlockedMoveIds.filter((id) => moves[id]?.type === 'Fire').length;

  assert.strictEqual(boonMoveCount(passives[typeDamagePassiveFor.Fire!], e, moves), expected);
  // The pool filter guarantees SOMEBODY fields the type; it cannot stop the player putting the
  // Boon on a hero who has no moves of it, which is what this readout is for.
  assert.strictEqual(boonMoveCount(passives[typeDamagePassiveFor.Mech!], entry(heroOfType('Nature')), moves), 0);
  // A generic Boon fires for anybody, so there is no count to show.
  assert.strictEqual(boonMoveCount(passives.bloodthirst, e, moves), null);
});

test('boons: the map carries the Boon node', () => {
  assert.ok((MAP_NODE_TYPES as readonly string[]).includes('passiveReward'));
});
