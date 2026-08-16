import * as assert from 'assert';
import { test } from './harness';
import { isValidRelicDefinition, relicTeamStatModifiers } from '../src/run/relics';
import { relics } from '../src/data/relics';

test('relics: fixture relic content is all valid (multiples of 5/10)', () => {
  for (const relic of Object.values(relics)) {
    assert.ok(isValidRelicDefinition(relic), `${relic.id} has an invalid stat grant`);
  }
});

test('relics: isValidRelicDefinition rejects a non-multiple-of-5 grant', () => {
  assert.strictEqual(isValidRelicDefinition({ id: 'bad', name: 'Bad', statGrants: { attack: 7 } }), false);
});

test('relics: relicTeamStatModifiers merges owned relics additively and ignores unknown ids', () => {
  const mods = relicTeamStatModifiers(['ironStandard', 'warHorn', 'unknown-relic'], relics);
  assert.deepStrictEqual(mods, { defense: 10, attack: 10 });
});

test('relics: relicTeamStatModifiers stacks a duplicate relic id', () => {
  const mods = relicTeamStatModifiers(['ironStandard', 'ironStandard'], relics);
  assert.strictEqual(mods.defense, 20);
});

test('relics: no owned relics yields no modifiers', () => {
  assert.deepStrictEqual(relicTeamStatModifiers([], relics), {});
});
