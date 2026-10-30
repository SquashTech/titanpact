import * as assert from 'assert';
import { test } from './harness';
import { MANUAL_PAGES, manualPage } from '../src/data/howToPlay';
import { LESSONS } from '../src/data/lessons';
import { statuses } from '../src/data/statuses';
import { fieldEffects } from '../src/data/fieldEffects';
import { passives } from '../src/data/passives';
import { MAP_NODE_TYPES } from '../src/run/map';
import { TYPES } from '../src/data/typechart';
import { createProfile, decodeProfile, recordRunEnded, resetTips, type RunEnd } from '../src/run/profile';
import { fileRunPages, isPageLearned, lessonPages, markPagesShown, pagesMetInFight, pagesMetOnScreen } from '../src/run/manual';
import { recordScenarioLit } from '../src/run/sky';
import { sky } from '../src/data/sky';
import type { CombatEvent } from '../src/engine/events';
import type { CombatState } from '../src/engine/state';

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

test('manual: every lesson files pages, and every page a lesson shows in a fight is one of its own', () => {
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

test('manual: a status has a page, and a page the lessons do not teach is met in a run', () => {
  for (const status of Object.values(statuses).filter((s) => s.id !== `${s.forceType}Force`)) assert.ok(MANUAL_PAGES.some((p) => p.id === `howto.status.${status.id}`), status.id);
  const taught = new Set(LESSONS.chapters.flatMap((c) => lessonPages(MANUAL_PAGES, c.id).map((p) => p.id)));
  for (const page of MANUAL_PAGES) assert.ok(taught.has(page.id) || page.source.kind === 'run', `${page.id} is neither taught nor met`);
});

test('manual: a lesson won learns its pages; a run files the rest once, and the next win shows them once', () => {
  let profile = createProfile();
  const mana = manualPage('howto.mana');
  const poison = manualPage('howto.status.Poison');
  assert.ok(!isPageLearned(profile, mana) && !isPageLearned(profile, poison));
  profile = recordScenarioLit(profile, sky, 'firstLight.mana');
  assert.ok(isPageLearned(profile, mana), 'the Mana lesson won, its pages are in the book');
  assert.strictEqual(fileRunPages(profile, MANUAL_PAGES, [mana.id]), profile, 'a lesson page is never filed by a run');
  profile = fileRunPages(profile, MANUAL_PAGES, [poison.id, poison.id]);
  assert.deepStrictEqual(profile.manualPages, [poison.id]);
  assert.deepStrictEqual(profile.manualUnshown, [poison.id]);
  assert.strictEqual(fileRunPages(profile, MANUAL_PAGES, [poison.id]), profile, 'filed once');
  profile = markPagesShown(profile, [poison.id]);
  assert.deepStrictEqual(profile.manualUnshown, []);
  assert.ok(isPageLearned(profile, poison));
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(profile))).manualPages, [poison.id], 'survives a round trip');
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
    { type: 'StatChanged', combatantId: 'A:y', stat: 'attack', delta: 10, newValue: 70 },
  ] as unknown as CombatEvent[];
  const met = pagesMetInFight(MANUAL_PAGES, events, board, () => []);
  assert.deepStrictEqual(met.sort(), ['howto.field', 'howto.status.Shield'], 'a lesson status (Burn) is never met in a fight, a flat change is no step, and a wiped foe is no lock-in');
  const staged = [{ type: 'StatChanged', combatantId: 'B:x', stat: 'defense', delta: -1, stages: true, newValue: -1 }] as unknown as CombatEvent[];
  assert.deepStrictEqual(pagesMetInFight(MANUAL_PAGES, staged, board, () => []), ['howto.stages'], 'a stat moved a step files Buffs and Debuffs');
});
