// Starter Packs (docs/constellation.md §3): what a pack owes, what holding and equipping mean,
// and the draft reading the equipped pack.

import * as assert from 'assert';
import { test } from './harness';
import { heroes } from '../src/data/heroes';
import { STARTER_PACKS, starterPackById } from '../src/data/starterPacks';
import { starShopCatalog } from '../src/data/starShop';
import { TYPES } from '../src/data/typechart';
import { createProfile, decodeProfile, recordRunEnded } from '../src/run/profile';
import { generateStarterOptions, STARTER_OPTION_COUNT } from '../src/run/draft';
import { BASE_PACK_ID, PACK_MIN_HEROES, PackError, equipPack, equippedPack, packHeld } from '../src/run/starterPacks';

const cleared = recordRunEnded(createProfile(), { outcome: 'win', actReached: 6, locationId: null, encountersWon: 1, roster: [] }, 1);

test('starter packs: pack zero is the fourteen starters, derived, and every pack is legal', () => {
  const base = starterPackById[BASE_PACK_ID];
  assert.ok(base && base.kind === 'base' && !base.unlock, 'pack zero is held by every profile');
  assert.deepStrictEqual(
    [...base.heroIds].sort(),
    Object.values(heroes)
      .filter((h) => h.starter)
      .map((h) => h.id)
      .sort()
  );
  const ids = new Set<string>();
  for (const pack of STARTER_PACKS) {
    assert.ok(!ids.has(pack.id), `${pack.id} is listed twice`);
    ids.add(pack.id);
    assert.ok(pack.heroIds.length >= PACK_MIN_HEROES, `${pack.id} holds ${pack.heroIds.length}, the floor is ${PACK_MIN_HEROES}`);
    assert.strictEqual(new Set(pack.heroIds).size, pack.heroIds.length, `${pack.id} lists a hero twice`);
    for (const id of pack.heroIds) {
      const hero = heroes[id];
      assert.ok(hero, `${pack.id} names unknown hero ${id}`);
      // A re-cut is the base roster re-drafted: recruit-only, nothing bought. A theme brings heroes outside it.
      if (pack.kind === 'recut') assert.ok(!hero.starter && !hero.unlock, `${pack.id} is a recut and lists ${id}`);
      if (pack.kind === 'theme') assert.ok(hero.unlock, `${pack.id} is a theme and lists base hero ${id}`);
    }
    if (pack.unlock?.kind === 'offer') assert.ok(starShopCatalog[pack.unlock.offerId], `${pack.id} is locked behind an offer that is not for sale`);
  }
});

test('starter packs: the Second String is one recruit-only hero a draftable type, opened by a clear and never sold', () => {
  const pack = starterPackById.secondString;
  assert.deepStrictEqual(pack.unlock, { kind: 'clear' });
  assert.ok(!Object.values(starShopCatalog).some((o) => o.grant.kind === 'starterPack'), 'no pack is on the shelf for stars');
  const byType = new Map(pack.heroIds.map((id) => [heroes[id].types[0], id]));
  assert.strictEqual(byType.size, 14);
  for (const type of TYPES) if (type !== 'Ancient') assert.ok(byType.has(type), `${type} has no seat in the pack`);
});

test('starter packs: holding — pack zero always, a clear pack once the profile has a clear', () => {
  const fresh = createProfile();
  assert.ok(packHeld(fresh, starterPackById.base));
  assert.ok(!packHeld(fresh, starterPackById.secondString), 'no clear yet');
  assert.ok(packHeld(cleared, starterPackById.secondString), 'one clear opens it');
  assert.strictEqual(equippedPack(fresh, STARTER_PACKS).id, BASE_PACK_ID);
});

test('starter packs: equipping is free and reversible, refuses a pack not held, and falls back to pack zero on read', () => {
  assert.throws(() => equipPack(createProfile(), STARTER_PACKS, 'secondString'), PackError);
  assert.throws(() => equipPack(cleared, STARTER_PACKS, 'noSuchPack'), PackError);
  const dressed = equipPack(cleared, STARTER_PACKS, 'secondString');
  assert.strictEqual(equippedPack(dressed, STARTER_PACKS).id, 'secondString');
  assert.strictEqual(equippedPack(equipPack(dressed, STARTER_PACKS, BASE_PACK_ID), STARTER_PACKS).id, BASE_PACK_ID, 'and back');
  // A profile whose equipped id names a pack it no longer holds (or this build no longer ships) drafts from pack zero.
  assert.strictEqual(equippedPack({ ...dressed, runsCompleted: 0 }, STARTER_PACKS).id, BASE_PACK_ID);
  assert.strictEqual(equippedPack({ ...dressed, equippedPackId: 'gone' }, STARTER_PACKS).id, BASE_PACK_ID);
});

test('starter packs: the equipped id survives a round trip and an old file reads as pack zero', () => {
  const dressed = equipPack(cleared, STARTER_PACKS, 'secondString');
  assert.strictEqual(decodeProfile(JSON.parse(JSON.stringify(dressed))).equippedPackId, 'secondString');
  assert.strictEqual(decodeProfile({}).equippedPackId, BASE_PACK_ID);
  assert.strictEqual(decodeProfile({ equippedPackId: 7 }).equippedPackId, BASE_PACK_ID);
});

test('starter packs: the draft rolls its four from the equipped pack and nothing outside it', () => {
  const pack = starterPackById.secondString;
  for (let seed = 1; seed <= 20; seed++) {
    const options = generateStarterOptions(seed, pack.heroIds);
    assert.strictEqual(options.length, STARTER_OPTION_COUNT);
    for (const id of options) assert.ok(pack.heroIds.includes(id), `${id} is not in the pack`);
    assert.strictEqual(new Set(options).size, options.length);
  }
});
