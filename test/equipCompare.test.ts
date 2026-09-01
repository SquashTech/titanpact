// The equip-screen diff (src/run/equipCompare.ts). The invariant is SILENCE: an effect both items
// carry equally must produce no entry at all.

import assert from 'assert';
import { test } from './harness';
import { equipment } from '../src/data/equipment';
import { compareEquipment } from '../src/run/equipCompare';
import type { EquipmentDefinition } from '../src/run/equipment';

function item(over: Partial<EquipmentDefinition>): EquipmentDefinition {
  return { id: 'x', name: 'X', slot: 'weapon', rarity: 'common', statGrants: {}, ...over };
}

test('equipCompare: an empty slot makes every effect a pure gain', () => {
  const changes = compareEquipment(null, item({ statGrants: { attack: 10, speed: 5 } }));
  assert.deepStrictEqual(changes, [
    { kind: 'stat', key: 'attack', from: 0, to: 10, delta: 10 },
    { kind: 'stat', key: 'speed', from: 0, to: 5, delta: 5 },
  ]);
});

test('equipCompare: an effect both items carry equally is omitted entirely', () => {
  const current = item({ statGrants: { attack: 10, defense: 5 } });
  const next = item({ statGrants: { attack: 10, speed: 5 } });
  const changes = compareEquipment(current, next);
  assert.ok(!changes.some((c) => c.key === 'attack'), 'unchanged Attack should produce no entry');
  assert.deepStrictEqual(changes, [
    { kind: 'stat', key: 'defense', from: 5, to: 0, delta: -5 },
    { kind: 'stat', key: 'speed', from: 0, to: 5, delta: 5 },
  ]);
});

test('equipCompare: two items with identical grants compare to nothing at all', () => {
  const torch = equipment.torch;
  assert.deepStrictEqual(compareEquipment(torch, torch), []);
});

test('equipCompare: stats are listed in the canonical STAT_ORDER, not authoring order', () => {
  const changes = compareEquipment(null, item({ statGrants: { speed: 5, hp: 20, attack: 10 } }));
  assert.deepStrictEqual(
    changes.map((c) => c.key),
    ['hp', 'attack', 'speed']
  );
});

test('equipCompare: Elemental Force reads as a magnitude change, not a swap of two grants', () => {
  const changes = compareEquipment(
    item({ grantsStatusIds: [{ statusId: 'FireForce', magnitude: 5 }] }),
    item({ grantsStatusIds: [{ statusId: 'FireForce', magnitude: 15 }] })
  );
  assert.deepStrictEqual(changes, [{ kind: 'status', key: 'FireForce', from: 5, to: 15, delta: 10 }]);
});

test('equipCompare: losing one Force and gaining another is two entries, loss first', () => {
  const changes = compareEquipment(
    item({ grantsStatusIds: [{ statusId: 'FireForce', magnitude: 5 }] }),
    item({ grantsStatusIds: [{ statusId: 'FrostForce', magnitude: 5 }] })
  );
  assert.deepStrictEqual(changes, [
    { kind: 'status', key: 'FireForce', from: 5, to: 0, delta: -5 },
    { kind: 'status', key: 'FrostForce', from: 0, to: 5, delta: 5 },
  ]);
});

test('equipCompare: a granted passive is present-or-absent, magnitude 1', () => {
  const changes = compareEquipment(
    item({ grantsPassiveIds: ['bloodthirst'] }),
    item({ grantsPassiveIds: ['frostbrand'] })
  );
  assert.deepStrictEqual(changes, [
    { kind: 'passive', key: 'bloodthirst', from: 1, to: 0, delta: -1 },
    { kind: 'passive', key: 'frostbrand', from: 0, to: 1, delta: 1 },
  ]);
});

test('equipCompare: a passive both items grant is not reported as a change', () => {
  const changes = compareEquipment(
    item({ grantsPassiveIds: ['bloodthirst'], statGrants: { attack: 10 } }),
    item({ grantsPassiveIds: ['bloodthirst'], statGrants: { attack: 20 } })
  );
  assert.deepStrictEqual(changes, [{ kind: 'stat', key: 'attack', from: 10, to: 20, delta: 20 - 10 }]);
});

test('equipCompare: every authored item compares against every other without throwing', () => {
  // Also pins the ordering contract: stats before statuses before passives.
  const catalog = Object.values(equipment);
  for (const current of catalog) {
    for (const next of catalog) {
      const changes = compareEquipment(current, next);
      assert.ok(
        changes.every((c) => c.delta !== 0),
        `${current.id} -> ${next.id} produced a zero-delta entry`
      );
      const kinds = changes.map((c) => c.kind);
      const rank = { stat: 0, status: 1, passive: 2 } as const;
      for (let i = 1; i < kinds.length; i++) {
        assert.ok(rank[kinds[i]] >= rank[kinds[i - 1]], `${current.id} -> ${next.id} listed ${kinds[i]} after ${kinds[i - 1]}`);
      }
    }
  }
});
