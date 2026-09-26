import * as assert from 'assert';
import { test } from './harness';
import { FIGHT_TIPS, LORE_LINES, SCREEN_TIPS } from '../src/data/tips';
import {
  firstUnseenTip,
  LORE_TIP_ID,
  matchFightTip,
  parseTipText,
  SCREEN_TIP_IDS,
  unknownIconTokens,
  type FightTipContext,
  type Tip,
} from '../src/run/tips';
import { createProfile, decodeProfile, recordTipSeen, resetTips } from '../src/run/profile';

const allTips: Tip[] = [...Object.values(SCREEN_TIPS), ...FIGHT_TIPS];

/** A quiet round-1 command phase in an opener — the baseline each case moves one field off. */
function ctx(overrides: Partial<FightTipContext> = {}): FightTipContext {
  return {
    round: 1,
    nodeType: 'fight',
    anyOutOfMana: false,
    benchSize: 0,
    enemyTypesOnField: [],
    fieldEffectActive: false,
    ...overrides,
  };
}

// --- Content ---

test('tips: every id App can ask for has a tip, and every screen tip is one App asks for', () => {
  assert.deepStrictEqual(Object.keys(SCREEN_TIPS).sort(), [...SCREEN_TIP_IDS].sort());
  for (const [key, tip] of Object.entries(SCREEN_TIPS)) assert.strictEqual(tip.id, key, `${key} is keyed under its own id`);
});

test('tips: ids are unique across screen tips, fight tips and the lore card', () => {
  const ids = [...allTips.map((tip) => tip.id), LORE_TIP_ID];
  assert.strictEqual(new Set(ids).size, ids.length);
});

test('tips: brief — at most three pages, each a couple of sentences', () => {
  for (const tip of allTips) {
    assert.ok(tip.title.length > 0, `${tip.id} has a title`);
    assert.ok(tip.pages.length >= 1 && tip.pages.length <= 3, `${tip.id}: ${tip.pages.length} pages`);
    for (const page of tip.pages) assert.ok(page.length > 0 && page.length <= 180, `${tip.id}: a ${page.length}-character page`);
  }
});

test('tips: informational, not in-universe — no tip speaks as "we"', () => {
  for (const tip of allTips) {
    for (const page of tip.pages) assert.ok(!/\b(we|us|our)\b/i.test(page), `${tip.id}: "${page}"`);
  }
});

test('tips: every inline icon token is one the view can draw', () => {
  for (const tip of allTips) {
    for (const page of tip.pages) assert.deepStrictEqual(unknownIconTokens(page), [], `${tip.id}: "${page}"`);
  }
  assert.deepStrictEqual(parseTipText('a [physical] b [nope]'), [{ text: 'a ' }, { icon: 'physical' }, { text: ' b [nope]' }]);
});

test('tips: the lore card is the four lines, the last the draft\'s verb', () => {
  assert.deepStrictEqual(LORE_LINES, [
    'A Titan cannot be killed.',
    'It can only be put to sleep for 1,000 years.',
    'Our time is up.',
    'We must seal the pact.',
  ]);
});

// --- Mechanism ---

test('tips: firstUnseenTip walks the candidates in order and skips the seen', () => {
  assert.strictEqual(firstUnseenTip(SCREEN_TIPS, ['map', 'wounds', 'fork'], [])?.id, 'map');
  assert.strictEqual(firstUnseenTip(SCREEN_TIPS, ['map', 'wounds', 'fork'], ['map'])?.id, 'wounds');
  assert.strictEqual(firstUnseenTip(SCREEN_TIPS, ['map', 'wounds', 'fork'], ['map', 'wounds', 'fork']), null);
  assert.strictEqual(firstUnseenTip(SCREEN_TIPS, ['noSuchTip'], []), null, 'an id with no content is skipped, not thrown on');
});

test('tips: the first command phase of the first fight is the basics, whatever else holds', () => {
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ anyOutOfMana: true, benchSize: 2 }), [])?.id, 'fight.basics');
});

test('tips: each fight tip waits for its own moment', () => {
  const seenBasics = ['fight.basics'];
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx(), seenBasics), null, 'round 1, nothing new');
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ round: 2 }), seenBasics)?.id, 'fight.types');
  const past = ['fight.basics', 'fight.types', 'fight.bag'];
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ round: 4, anyOutOfMana: true }), past)?.id, 'fight.rest');
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ nodeType: 'boss' }), past)?.id, 'fight.pactClock', 'the first Guardian warns of the clock');
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ nodeType: 'skirmish' }), seenBasics)?.id, 'fight.skirmish');
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ nodeType: 'elite' }), seenBasics)?.id, 'fight.skirmish');
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ enemyTypesOnField: ['Beast', 'Ancient'] }), past)?.id, 'fight.ancient');
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ benchSize: 1 }), past)?.id, 'fight.switching', 'the first fight with a bench');
  assert.strictEqual(
    matchFightTip(FIGHT_TIPS, ctx({ nodeType: 'skirmish', benchSize: 1 }), seenBasics)?.id,
    'fight.skirmish',
    'the Skirmish card first; switching waits a round'
  );
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ fieldEffectActive: true }), past)?.id, 'fight.field');
});

test('tips: a seen fight tip never shows again', () => {
  const seen = FIGHT_TIPS.map((tip) => tip.id);
  const everything = ctx({ round: 40, nodeType: 'boss', anyOutOfMana: true, benchSize: 3, enemyTypesOnField: ['Ancient'], fieldEffectActive: true });
  assert.strictEqual(matchFightTip(FIGHT_TIPS, everything, seen), null);
});

// --- Profile ---

test('tips: seen ids are account-wide, idempotent, resettable, and survive a round trip', () => {
  let profile = createProfile();
  assert.deepStrictEqual(profile.seenTipIds, []);
  profile = recordTipSeen(recordTipSeen(profile, 'map'), 'map');
  profile = recordTipSeen(profile, LORE_TIP_ID);
  assert.deepStrictEqual(profile.seenTipIds, ['map', LORE_TIP_ID]);
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(profile))).seenTipIds, ['map', LORE_TIP_ID]);
  assert.deepStrictEqual(resetTips(profile).seenTipIds, []);
});

test('tips: a profile from before the tips shows every one, whatever its tutorial flag said', () => {
  const legacy = { version: 1, runsStarted: 4, runsCompleted: 1, tutorialDone: true };
  assert.deepStrictEqual(decodeProfile(legacy).seenTipIds, []);
});
