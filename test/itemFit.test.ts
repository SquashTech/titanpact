// The who-screen's fit chips (src/run/itemFit.ts): lit where the kit reads the stat or it is one of
// the hero's top two of Attack, Defense, Intelligence and Wisdom.

import assert from 'assert';
import { test } from './harness';
import { moves } from '../src/data/moves';
import { statuses } from '../src/data/statuses';
import { heroes } from '../src/data/heroes';
import { itemFitChips } from '../src/run/itemFit';
import type { EquipmentDefinition } from '../src/run/equipment';
import type { StatKey } from '../src/engine/content';

const umbralBow: EquipmentDefinition = {
  id: 'umbralBowTest', name: 'Umbral Bow', rarity: 'rare',
  statGrants: { attack: 25, wisdom: 25 }, grantsStatusIds: [{ statusId: 'ShadowForce', magnitude: 10 }],
};

function chipsFor(heroId: string, item: EquipmentDefinition = umbralBow) {
  const hero = heroes[heroId];
  const kit = hero.moveIds.map((id) => moves[id]);
  return itemFitChips(item, hero.baseStats as Record<StatKey, number>, kit, statuses);
}

const lit = (chips: ReturnType<typeof chipsFor>) =>
  chips.flatMap((c) => (c.kind === 'stat' && c.lit ? [c.stat] : c.kind === 'force' && c.lit ? [c.statusId] : []));

test('itemFit: a Shadow caster lights Wisdom and Shadow Force, not Attack', () => {
  assert.deepStrictEqual(lit(chipsFor('marrow')), ['wisdom', 'ShadowForce']);
});

test('itemFit: a physical Iron hero lights Attack only', () => {
  assert.deepStrictEqual(lit(chipsFor('valor')), ['attack']);
});

test('itemFit: a healer lights Wisdom off its heal', () => {
  assert.ok(lit(chipsFor('dawnwarden')).includes('wisdom'));
});

test('itemFit: a Speed grant shows the hero\'s Speed rather than a lit read', () => {
  const chips = chipsFor('valor', { id: 'b', name: 'B', rarity: 'common', statGrants: { speed: 10, hp: 30 } });
  assert.deepStrictEqual(chips, [
    { kind: 'speed', value: heroes.valor.baseStats.speed },
    { kind: 'stat', stat: 'hp', lit: true },
  ]);
});
