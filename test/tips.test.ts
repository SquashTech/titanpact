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
import { TIP_SCENES, type TipScene } from '../src/data/tipScenes';
import { allCombatants } from '../src/data/content';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveTypeMult } from '../src/engine/damage/typeMult';

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
    callReady: false,
    statStaged: false,
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
  assert.deepStrictEqual(parseTipText('[stages]'), [{ block: 'stages' }], 'the stage chart is a block token');
});

test('tips: the lore card is the four lines, the last the draft\'s verb', () => {
  assert.deepStrictEqual(LORE_LINES, [
    'A Titan cannot be killed.',
    'Sealed, it sleeps for one year.',
    'The year is up.',
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
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ statStaged: true }), seenBasics)?.id, 'fight.stages', 'the first raised or lowered stat');
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx(), seenBasics), null, 'round 1, nothing new');
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ round: 2 }), seenBasics)?.id, 'fight.types');
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ round: 2 }), [...seenBasics, 'fight.types'])?.id, 'fight.attacks', 'physical vs magical, the phase after types');
  const past = ['fight.basics', 'fight.types', 'fight.attacks', 'fight.bag'];
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
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ callReady: true }), seenBasics)?.id, 'fight.call', 'the first fight with a companion');
});

test('tips: a seen fight tip never shows again', () => {
  const seen = FIGHT_TIPS.map((tip) => tip.id);
  const everything = ctx({ round: 40, nodeType: 'boss', anyOutOfMana: true, benchSize: 3, enemyTypesOnField: ['Ancient'], fieldEffectActive: true, callReady: true, statStaged: true });
  assert.strictEqual(matchFightTip(FIGHT_TIPS, everything, seen), null);
});

// --- Scenes ---

const scenePages = Object.entries(TIP_SCENES).flatMap(([id, pages]) =>
  pages.flatMap((scene, page) => (scene ? [{ id, page, scene }] : []))
) as { id: string; page: number; scene: TipScene }[];

test('tips: every scene belongs to a fight tip page that exists', () => {
  for (const [id, pages] of Object.entries(TIP_SCENES)) {
    const tip = FIGHT_TIPS.find((t) => t.id === id);
    assert.ok(tip, `${id} is a fight tip`);
    assert.ok(pages.length <= tip.pages.length, `${id}: ${pages.length} scenes for ${tip.pages.length} pages`);
  }
});

test('tips: every hero, move and field a scene draws exists', () => {
  for (const { id, page, scene } of scenePages) {
    const where = `${id} page ${page + 1}`;
    for (const fighter of [scene.hero, ...(scene.foes ?? [])]) assert.ok(allCombatants[fighter.heroId], `${where}: hero ${fighter.heroId}`);
    for (const moveId of scene.moves ?? []) assert.ok(moves[moveId], `${where}: move ${moveId}`);
    for (const moveId of [...(scene.focusMoves ?? []), ...Object.keys(scene.tags ?? {}), ...Object.keys(scene.expect ?? {})]) {
      assert.ok(scene.moves?.includes(moveId), `${where}: ${moveId} is one of the scene's moves`);
    }
    if (scene.field) assert.ok(fieldEffects[scene.field], `${where}: field ${scene.field}`);
  }
});

test('tips: a scene shows the matchups its words promise', () => {
  for (const { id, page, scene } of scenePages) {
    for (const [moveId, expected] of Object.entries(scene.expect ?? {})) {
      const shown = (scene.foes ?? []).map((foe) => resolveTypeMult(typeChart, moves[moveId].type, allCombatants[foe.heroId].types));
      assert.deepStrictEqual(shown, [...expected], `${id} page ${page + 1}: ${moveId}`);
    }
  }
});

test('tips: the Kinds of Move scene holds one of each kind, and the STAB scene one move on-type and one off', () => {
  const kinds = TIP_SCENES['fight.attacks'][0]!;
  const kit = (kinds.moves ?? []).map((id) => moves[id]);
  assert.ok(kit.some((m) => m.kind === 'damage' && m.category === 'physical'), 'a physical move');
  assert.ok(kit.some((m) => m.kind === 'damage' && m.category === 'magical'), 'a magical move');
  const deltas = kit.filter((m) => m.kind === 'buff').flatMap((m) => (m.statDeltas ?? []).map((d) => ({ d, m })));
  assert.ok(deltas.some(({ d, m }) => d.stages > 0 && m.target === 'self'), 'a buff');
  assert.ok(deltas.some(({ d, m }) => d.stages < 0 && m.target === 'singleEnemy'), 'a debuff');
  const stab = TIP_SCENES['fight.types'][1]!;
  const types = allCombatants[stab.hero.heroId].types as readonly string[];
  const onType = (stab.moves ?? []).map((id) => types.includes(moves[id].type));
  assert.deepStrictEqual(onType, [true, false]);
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
