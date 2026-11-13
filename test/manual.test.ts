import * as assert from 'assert';
import { test } from './harness';
import { MANUAL_CHAPTERS, MANUAL_PAGES, manualPage } from '../src/data/howToPlay';
import { statuses } from '../src/data/statuses';
import { fieldEffects } from '../src/data/fieldEffects';
import { passives } from '../src/data/passives';
import { MAP_NODE_TYPES } from '../src/run/map';
import { TYPES } from '../src/data/typechart';
import { decodeProfile } from '../src/run/profile';

const EMBLEM_KINDS = ['node', 'status', 'kind', 'stat', 'resource', 'arrow', 'type', 'field', 'passive', 'glyph'];
const DRAWN = ['spread', 'switch', 'leads', 'lock', 'clock', 'banner', 'road', 'cycle', 'paw'];

test('manual: ids are unique, and every page has words and an emblem the view can draw', () => {
  const ids = MANUAL_PAGES.map((p) => p.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const page of MANUAL_PAGES) {
    assert.ok(page.title.length > 0 && page.pages.length > 0 && page.pages.every((t) => t.length > 0), `${page.id} has words`);
    assert.ok(page.emblem.length >= 1 && page.emblem.length <= 2, `${page.id} wears one or two marks`);
    for (const mark of page.emblem) {
      const [kind, value] = mark.split(':');
      assert.ok(EMBLEM_KINDS.includes(kind), `${page.id}: ${mark}`);
      if (kind === 'node') assert.ok((MAP_NODE_TYPES as readonly string[]).includes(value), `${page.id}: ${mark}`);
      if (kind === 'status') assert.ok(statuses[value], `${page.id}: ${mark}`);
      if (kind === 'field') assert.ok(fieldEffects[value], `${page.id}: ${mark}`);
      if (kind === 'type') assert.ok((TYPES as readonly string[]).includes(value), `${page.id}: ${mark}`);
      if (kind === 'passive') assert.ok(passives[value], `${page.id}: ${mark}`);
      if (kind === 'glyph') assert.ok(DRAWN.includes(value), `${page.id}: ${mark}`);
    }
  }
  assert.throws(() => manualPage('howto.nope'));
});

test('manual: every chapter has its pages, one concept a chapter', () => {
  const of = (id: string) => MANUAL_PAGES.filter((p) => p.lesson === id).map((p) => p.id);
  for (const chapter of MANUAL_CHAPTERS) assert.ok(of(chapter).length >= 1 && of(chapter).length <= 6, `${chapter} holds ${of(chapter).length} pages`);
  assert.deepStrictEqual(of('chapter.move'), ['howto.combat']);
  assert.deepStrictEqual(of('chapter.mana'), ['howto.mana', 'howto.rest']);
  assert.deepStrictEqual(of('chapter.burn'), ['howto.statuses', 'howto.status.Burn']);
  assert.deepStrictEqual(of('chapter.open'), ['howto.leads', 'howto.passives']);
});

test('manual: a status has a page, and every page sits in a chapter or among the run pages', () => {
  for (const status of Object.values(statuses).filter((s) => s.id !== `${s.forceType}Force`)) assert.ok(MANUAL_PAGES.some((p) => p.id === `howto.status.${status.id}`), status.id);
  for (const page of MANUAL_PAGES) assert.ok(page.lesson === undefined || (MANUAL_CHAPTERS as readonly string[]).includes(page.lesson), `${page.id} names a chapter that does not exist`);
});

test('manual: a profile from when runs filed pages still decodes', () => {
  const old = decodeProfile({ version: 3, manualPages: ['howto.status.Poison'], manualUnshown: ['howto.status.Poison'], manualComplete: true });
  assert.ok(!('manualPages' in old) && !('manualUnshown' in old) && !('manualComplete' in old));
});
