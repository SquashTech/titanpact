import * as assert from 'assert';
import { test } from './harness';
import { MANUAL_PAGES, manualPage } from '../src/data/howToPlay';
import { LESSONS } from '../src/data/lessons';
import { statuses } from '../src/data/statuses';
import { fieldEffects } from '../src/data/fieldEffects';
import { passives } from '../src/data/passives';
import { MAP_NODE_TYPES } from '../src/run/map';
import { TYPES } from '../src/data/typechart';
import { decodeProfile } from '../src/run/profile';
import { lessonPages } from '../src/run/manual';

const EMBLEM_KINDS = ['node', 'status', 'kind', 'stat', 'resource', 'arrow', 'type', 'field', 'passive', 'glyph'];
const DRAWN = ['spread', 'switch', 'leads', 'lock', 'clock', 'banner', 'road', 'cycle', 'paw'];

/** Every cue tip a chapter's fights show, by chapter. */
function cueTipIds(chapterId: string): string[] {
  const chapter = LESSONS.chapters.find((c) => c.id === chapterId)!;
  return chapter.beats.flatMap((beat) => {
    const cues = beat.cues ?? [];
    return cues.flatMap((cue) => (cue.tips ?? []).map((tip) => tip.id));
  });
}

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

test('manual: every lesson has its pages, and every page a lesson shows in a fight is one of its own', () => {
  for (const chapter of LESSONS.chapters) {
    const own = lessonPages(MANUAL_PAGES, chapter.id).map((p) => p.id);
    assert.ok(own.length >= 1 && own.length <= 6, `${chapter.id} files ${own.length} pages`);
    for (const id of cueTipIds(chapter.id).filter((id) => id.startsWith('howto.'))) assert.ok(own.includes(id), `${chapter.id} shows ${id}, another lesson's page`);
  }
  // One concept a lesson, and Mana before Switching.
  const first = (id: string) => lessonPages(MANUAL_PAGES, id).map((p) => p.id);
  assert.deepStrictEqual(first('firstLight.move'), ['howto.combat']);
  assert.deepStrictEqual(first('firstLight.mana'), ['howto.mana', 'howto.rest']);
  assert.deepStrictEqual(first('firstLight.types'), ['howto.types']);
  assert.deepStrictEqual(first('firstLight.spread'), ['howto.targets']);
  assert.deepStrictEqual(first('firstLight.kinds'), ['howto.kinds']);
  assert.deepStrictEqual(first('firstLight.burn'), ['howto.statuses', 'howto.status.Burn']);
  assert.deepStrictEqual(first('firstLight.switch'), ['howto.bench']);
  assert.deepStrictEqual(first('firstLight.open'), ['howto.leads', 'howto.passives']);
  // Only a page naming what its fight showed waits for the win, and it is the open fight's last.
  assert.deepStrictEqual(MANUAL_PAGES.filter((p) => p.afterFight).map((p) => p.id), ['howto.passives']);
});

test('manual: a status has a page, and the book is whole: every page is a lesson\'s or a run\'s', () => {
  for (const status of Object.values(statuses).filter((s) => s.id !== `${s.forceType}Force`)) assert.ok(MANUAL_PAGES.some((p) => p.id === `howto.status.${status.id}`), status.id);
  const lessons = new Set(LESSONS.chapters.map((c) => c.id));
  for (const page of MANUAL_PAGES) assert.ok(page.lesson === undefined || lessons.has(page.lesson), `${page.id} names a lesson that does not exist`);
});

test('manual: a profile from when runs filed pages still decodes', () => {
  const old = decodeProfile({ version: 3, manualPages: ['howto.status.Poison'], manualUnshown: ['howto.status.Poison'], manualComplete: true });
  assert.ok(!('manualPages' in old) && !('manualUnshown' in old) && !('manualComplete' in old));
});
