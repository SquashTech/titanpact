import * as assert from 'assert';
import { test } from './harness';
import { FIGHT_TIPS, LORE_LINES, MODES_OPEN_PAGES, SCREEN_TIPS } from '../src/data/tips';
import { HOW_TO_PLAY } from '../src/data/howToPlay';
import {
  firstUnseenTip,
  LORE_TIP_ID,
  matchFightTip,
  MODES_OPEN_TIP_ID,
  modesOpenDue,
  parseTipText,
  SCREEN_TIP_IDS,
  unknownIconTokens,
  type FightTipContext,
  type Tip,
} from '../src/run/tips';
import { createProfile, decodeProfile, recordTipSeen, resetTips } from '../src/run/profile';
import { isHallScene, TIP_SCENES, type TipHallScene, type TipScene } from '../src/data/tipScenes';
import { equipment } from '../src/data/equipment';
import { guildHallOffersFor } from '../src/data/recruitment';
import { heroes } from '../src/data/heroes';
import { itemReceiptFor } from '../src/run/runProgress';
import { createRosterEntry } from '../src/run/state';
import { allCombatants } from '../src/data/content';
import { moves } from '../src/data/moves';
import { typeChart } from '../src/data/typechart';
import { fieldEffects } from '../src/data/fieldEffects';
import { resolveTypeMult } from '../src/engine/damage/typeMult';

const allTips: Tip[] = [...Object.values(SCREEN_TIPS), ...FIGHT_TIPS];
/** Every block of player-facing rules text: the tips, and the How to Play page's sections. */
const allText: Tip[] = [...allTips, ...HOW_TO_PLAY];

/** A quiet round-1 command phase in an opener — the baseline each case moves one field off. */
function ctx(overrides: Partial<FightTipContext> = {}): FightTipContext {
  return { round: 1, nodeType: 'fight', ...overrides };
}

// --- Content ---

test('tips: every id App can ask for has a tip, and every screen tip is one App asks for', () => {
  assert.deepStrictEqual(Object.keys(SCREEN_TIPS).sort(), [...SCREEN_TIP_IDS].sort());
  for (const [key, tip] of Object.entries(SCREEN_TIPS)) assert.strictEqual(tip.id, key, `${key} is keyed under its own id`);
});

test('tips: ids are unique across screen tips, fight tips, How to Play and the lore card', () => {
  const ids = [...allText.map((tip) => tip.id), LORE_TIP_ID, MODES_OPEN_TIP_ID];
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
  for (const tip of allText) {
    for (const page of tip.pages) assert.ok(!/\b(we|us|our)\b/i.test(page), `${tip.id}: "${page}"`);
  }
});

test('tips: every inline icon token is one the view can draw', () => {
  for (const tip of allText) {
    for (const page of tip.pages) assert.deepStrictEqual(unknownIconTokens(page), [], `${tip.id}: "${page}"`);
  }
  assert.deepStrictEqual(parseTipText('a [physical] b [nope]'), [{ text: 'a ' }, { icon: 'physical' }, { text: ' b [nope]' }]);
  assert.deepStrictEqual(parseTipText('[stages]'), [{ block: 'stages' }], 'the stage chart is a block token');
});

test('tips: the lore card tells the fall as a story already over', () => {
  assert.deepStrictEqual(LORE_LINES, [
    'One day, pure calamity fell upon our land.',
    'It spread into everything it touched.',
    'Rivers ran black, and crops turned to rot.',
    'Heroes from every walk of life rose to face it.',
    'Not all of them came home.',
    'This is the story of how they sealed the Titan.',
  ]);
});

// --- Mechanism ---

test('tips: firstUnseenTip walks the candidates in order and skips the seen', () => {
  assert.strictEqual(firstUnseenTip(SCREEN_TIPS, ['bench', 'item'], [])?.id, 'bench');
  assert.strictEqual(firstUnseenTip(SCREEN_TIPS, ['bench', 'item'], ['bench'])?.id, 'item');
  assert.strictEqual(firstUnseenTip(SCREEN_TIPS, ['bench', 'item'], ['bench', 'item']), null);
  assert.strictEqual(firstUnseenTip(SCREEN_TIPS, ['noSuchTip'], []), null, 'an id with no content is skipped, not thrown on');
});

test('tips: the first command phase of the first fight is the basics, and nothing follows it', () => {
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx(), [])?.id, 'fight.basics');
  assert.strictEqual(matchFightTip(FIGHT_TIPS, ctx({ round: 40, nodeType: 'boss' }), ['fight.basics']), null);
});

// --- Scenes ---

const allPictures = Object.entries(TIP_SCENES).flatMap(([id, pages]) => pages.flatMap((scene, page) => (scene ? [{ id, page, scene }] : [])));
const scenePages = allPictures.filter((p) => !isHallScene(p.scene)) as { id: string; page: number; scene: TipScene }[];
const hallPages = allPictures.filter((p) => isHallScene(p.scene)) as { id: string; page: number; scene: TipHallScene }[];

test('tips: every scene belongs to a tip page that exists', () => {
  for (const [id, pages] of Object.entries(TIP_SCENES)) {
    const tip = allText.find((t) => t.id === id);
    assert.ok(tip, `${id} is a tip`);
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

test('tips: every hero, hire, Gem and item a Guild Hall scene draws exists', () => {
  const hires = new Set(guildHallOffersFor(heroes).map((o) => o.heroId));
  for (const { id, page, scene } of hallPages) {
    const where = `${id} page ${page + 1}`;
    for (const h of scene.roster) {
      assert.ok(allCombatants[h.heroId], `${where}: hero ${h.heroId}`);
      for (const itemId of h.items ?? []) assert.ok(equipment[itemId], `${where}: item ${itemId}`);
    }
    for (const heroId of scene.hires ?? []) assert.ok(hires.has(heroId), `${where}: hire ${heroId}`);
    for (const itemId of scene.items ?? []) assert.ok(equipment[itemId], `${where}: item ${itemId}`);
    const stock = scene.hall === 'gems' ? scene.gems : scene.items;
    if (scene.pick !== undefined) assert.ok(stock && scene.pick < stock.length, `${where}: pick in stock`);
  }
});

test('tips: the Gear counter scene shows a merge, a take and a full hero replacing', () => {
  const gear = hallPages.find((p) => p.scene.hall === 'gear')!.scene;
  const item = equipment[gear.items![gear.pick!]];
  const kinds = gear.roster.map((h, i) => {
    const entry = createRosterEntry(`t${i}`, h.heroId, []);
    entry.equipment = [...(h.items ?? [])];
    return itemReceiptFor(entry, item, allCombatants[h.heroId], equipment).kind;
  });
  assert.deepStrictEqual(kinds, ['merge', 'take', 'replace']);
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
  const kinds = TIP_SCENES['howto.kinds'][0] as TipScene;
  const kit = (kinds.moves ?? []).map((id) => moves[id]);
  assert.ok(kit.some((m) => m.kind === 'damage' && m.category === 'physical'), 'a physical move');
  assert.ok(kit.some((m) => m.kind === 'damage' && m.category === 'magical'), 'a magical move');
  const deltas = kit.filter((m) => m.kind === 'buff').flatMap((m) => (m.statDeltas ?? []).map((d) => ({ d, m })));
  assert.ok(deltas.some(({ d, m }) => d.stages > 0 && m.target === 'self'), 'a buff');
  assert.ok(deltas.some(({ d, m }) => d.stages < 0 && m.target === 'singleEnemy'), 'a debuff');
  const stab = TIP_SCENES['howto.types'][1] as TipScene;
  const types = allCombatants[stab.hero.heroId].types as readonly string[];
  const onType = (stab.moves ?? []).map((id) => types.includes(moves[id].type));
  assert.deepStrictEqual(onType, [true, false]);
});

// --- Profile ---

test('tips: seen ids are account-wide, idempotent, resettable, and survive a round trip', () => {
  let profile = createProfile();
  assert.deepStrictEqual(profile.seenTipIds, []);
  profile = recordTipSeen(recordTipSeen(profile, 'bench'), 'bench');
  profile = recordTipSeen(profile, LORE_TIP_ID);
  assert.deepStrictEqual(profile.seenTipIds, ['bench', LORE_TIP_ID]);
  assert.deepStrictEqual(decodeProfile(JSON.parse(JSON.stringify(profile))).seenTipIds, ['bench', LORE_TIP_ID]);
  assert.deepStrictEqual(resetTips(profile).seenTipIds, []);
});

test('tips: a profile from before the tips shows every one, whatever its tutorial flag said', () => {
  const legacy = { version: 1, runsStarted: 4, runsCompleted: 1, tutorialDone: true };
  assert.deepStrictEqual(decodeProfile(legacy).seenTipIds, []);
});

test('tips: the modes-open beat is owed from the win that opens both modes until it plays, a window a mode', () => {
  const fresh = createProfile();
  assert.strictEqual(modesOpenDue(fresh), false);
  const won = { ...fresh, runsCompleted: 1, cyclesCleared: 1 };
  assert.strictEqual(modesOpenDue(won), true);
  assert.strictEqual(modesOpenDue(recordTipSeen(won, MODES_OPEN_TIP_ID)), false);
  assert.deepStrictEqual(MODES_OPEN_PAGES.map((p) => p.mode), ['trials', 'gauntlet']);
  for (const page of MODES_OPEN_PAGES) assert.ok(page.line.split(/(?<=\.)\s/).length <= 2, `${page.mode} is two sentences at most`);
});
