// The dramatic-entrance table (src/view/shared/entrances.ts) against the champion roster. Pure
// presentation data, but a champion authored without an entrance loses its silhouette AND its
// arrival silently, and the miss only shows up four acts into a playtest.

import * as assert from 'assert';
import { test } from './harness';
import { CHAMPION_IDS, ENDBRINGER_ID, enemies, unsealedIdFor } from '../src/data/enemies';
import { dramaticEntranceFor, hasDramaticEntrance } from '../src/view/shared/entrances';
import { locations } from '../src/data/locations';

test('entrances: every Guardian champion and the Endbringer is a hidden card', () => {
  for (const id of [...CHAMPION_IDS, ENDBRINGER_ID]) {
    const entrance = dramaticEntranceFor(id);
    assert.ok(entrance, `${id} has no authored entrance`);
    assert.ok(entrance!.lead.length > 0 && entrance!.meta.length > 0, `${id}'s entrance copy is empty`);
  }
});

test('entrances: every location\'s final enemy is one, and no other combatant is', () => {
  for (const location of Object.values(locations)) {
    const id = location.guardianFinalEnemyId;
    if (id) assert.ok(hasDramaticEntrance(id), `${location.id} ends on ${id}, which arrives like a bench pivot`);
  }
  const expected = new Set<string>([...CHAMPION_IDS, ENDBRINGER_ID]);
  for (const id of Object.keys(enemies)) {
    if (expected.has(id)) continue;
    assert.ok(!hasDramaticEntrance(id), `${id} is not a champion but conceals itself on the preview screen`);
  }
});

test('entrances: the copy is authored per champion, never shared', () => {
  const leads = [...CHAMPION_IDS, ENDBRINGER_ID].map((id) => dramaticEntranceFor(id)!.lead);
  assert.strictEqual(new Set(leads).size, leads.length, 'two champions walk on under the same sentence');
});

test('entrances: an unsealed champion arrives plainly — the finale has nothing left to conceal', () => {
  // The player has already fought all six by then (docs/lore.md §6), so the act's one hidden
  // card stays the thing at the end of it.
  for (const id of CHAMPION_IDS) {
    assert.ok(!hasDramaticEntrance(unsealedIdFor(id)), `${unsealedIdFor(id)} re-conceals a champion the player beat`);
  }
});
