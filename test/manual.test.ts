import * as assert from 'assert';
import { test } from './harness';
import { MANUAL_PAGES, manualPage } from '../src/data/howToPlay';
import { LESSONS } from '../src/data/lessons';
import { statuses } from '../src/data/statuses';
import { fieldEffects } from '../src/data/fieldEffects';
import { MAP_NODE_TYPES } from '../src/run/map';
import { TYPES } from '../src/data/typechart';
import { createProfile, decodeProfile, recordRunEnded, resetTips, type RunEnd } from '../src/run/profile';
import { fileRunPages, isPageLearned, lessonPages, markPagesShown, pagesMetInFight, pagesMetOnScreen } from '../src/run/manual';
import { recordScenarioLit } from '../src/run/sky';
import { sky } from '../src/data/sky';
import type { CombatEvent } from '../src/engine/events';
import type { CombatState } from '../src/engine/state';

const EMBLEM_KINDS = ['node', 'status', 'kind', 'stat', 'resource', 'arrow', 'type', 'field', 'glyph'];
const DRAWN = ['spread', 'switch', 'leads', 'lock', 'clock', 'banner', 'road', 'cycle', 'paw'];

/** Every cue tip a chapter's fights show, by chapter. */
function cueTipIds(chapterId: string): string[] {
  const chapter = LESSONS.chapters.find((c) => c.id === chapterId)!;
  return chapter.beats.flatMap((beat) => {
    const cues = beat.kind === 'fight' ? beat.cues ?? [] : beat.act.rows.flat().flatMap((node) => node.cues ?? []);
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
      if (kind === 'glyph') assert.ok(DRAWN.includes(value), `${page.id}: ${mark}`);
    }
  }
  assert.throws(() => manualPage('howto.nope'));
});

test('manual: every lesson files pages, and every page a lesson shows in a fight is one of its own', () => {
  for (const chapter of LESSONS.chapters) {
    const own = lessonPages(MANUAL_PAGES, chapter.id).map((p) => p.id);
    assert.ok(own.length >= 4 && own.length <= 6, `${chapter.id} files ${own.length} pages`);
    for (const id of cueTipIds(chapter.id).filter((id) => id.startsWith('howto.'))) assert.ok(own.includes(id), `${chapter.id} shows ${id}, another lesson's page`);
  }
  // Mana is taught before Switching, and one target or both in the very first fight.
  const hunt = lessonPages(MANUAL_PAGES, 'firstLight.hunt').map((p) => p.id);
  for (const id of ['howto.combat', 'howto.mana', 'howto.targets', 'howto.stages', 'howto.types']) assert.ok(hunt.includes(id), `the Hunt teaches ${id}`);
});

test('manual: a status has a page, and a page the lessons do not teach is met in a run', () => {
  for (const status of Object.values(statuses).filter((s) => s.id !== `${s.forceType}Force`)) assert.ok(MANUAL_PAGES.some((p) => p.id === `howto.status.${status.id}`), status.id);
  const taught = new Set(LESSONS.chapters.flatMap((c) => lessonPages(MANUAL_PAGES, c.id).map((p) => p.id)));
  for (const page of MANUAL_PAGES) assert.ok(taught.has(page.id) || page.source.kind === 'run', `${page.id} is neither taught nor met`);
});

test('manual: a lesson won learns its pages; a run files the rest once, and the next win shows them once', () => {
  let profile = createProfile();
  const mana = manualPage('howto.mana');
  const burn = manualPage('howto.status.Burn');
  assert.ok(!isPageLearned(profile, mana) && !isPageLearned(profile, burn));
  profile = recordScenarioLit(profile, sky, 'firstLight.hunt');
  assert.ok(isPageLearned(profile, mana), 'the Hunt won, its pages are in the book');
  assert.strictEqual(fileRunPages(profile, MANUAL_PAGES, [mana.id]), profile, 'a lesson page is never filed by a run');
  profile = fileRunPages(profile, MANUAL_PAGES, [burn.id, burn.id]);
  assert.deepStrictEqual(profile.manualPages, [burn.id]);
  assert.deepStrictEqual(profile.manualUnshown, [burn.id]);
  assert.strictEqual(fileRunPages(profile, MANUAL_PAGES, [burn.id]), profile, 'filed once');
  profile = markPagesShown(profile, [burn.id]);
  assert.deepStrictEqual(profile.manualUnshown, []);
  assert.ok(isPageLearned(profile, burn));
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(profile))).manualPages, [burn.id], 'survives a round trip');
  assert.deepStrictEqual(resetTips(profile).manualPages, [], 'Reset Tips empties the book of what runs filed');
});

test('manual: an account that played before the manual has every page; a new one played since does not', () => {
  const end: RunEnd = { outcome: 'loss', actReached: 1, locationId: null, encountersWon: 0, cycle: 1, roster: [] };
  const legacy = decodeProfile({ version: 3, runsCompleted: 0, runsFailed: 2 });
  assert.ok(legacy.manualComplete);
  assert.ok(MANUAL_PAGES.every((p) => isPageLearned(legacy, p)));
  const fresh = decodeProfile(JSON.parse(JSON.stringify(recordRunEnded(createProfile(), end, 1))));
  assert.ok(!fresh.manualComplete, 'a run lost after the manual teaches nothing by itself');
});

test('manual: a screen files its page, and a fight its statuses, fields and lock-in', () => {
  assert.deepStrictEqual(pagesMetOnScreen(MANUAL_PAGES, 'shop'), ['howto.guildHall']);
  assert.deepStrictEqual(pagesMetOnScreen(MANUAL_PAGES, 'actIntro:first').sort(), ['howto.blessing', 'howto.journey']);
  const board = { round: 3, combatants: {}, bench: { A: [], B: [] }, koCount: { A: 0, B: 2 } } as unknown as CombatState;
  const events = [
    { type: 'StatusApplied', combatantId: 'B:x', statusId: 'Burn' },
    { type: 'StatusApplied', combatantId: 'A:y', statusId: 'Shield' },
    { type: 'FieldEffectSet', fieldEffectId: 'scorchedLand', previousFieldEffectId: null },
  ] as unknown as CombatEvent[];
  const met = pagesMetInFight(MANUAL_PAGES, events, board, () => []);
  assert.deepStrictEqual(met.sort(), ['howto.field', 'howto.status.Burn'], 'a lesson status (Shield) is never met in a fight, and a wiped foe is no lock-in');
});
