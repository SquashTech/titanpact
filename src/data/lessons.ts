// First Light's lessons (docs/first-light.md): one concept a lesson, each a fight with one line on the
// top bar. The first nine are guided, the hand on every tap; the tenth is the first open fight, a full
// team the player commands alone. Each casts heroes the others don't, so the roster shows itself.
// Each lesson is a one-beat chapter in its own book, so the Story machinery plays it unchanged.

import type { StoryChapter, StoryDefinition, StoryFight, StoryHandOver } from '../run/story';

const foe = (rosterId: string) => ({ side: 'B' as const, rosterId });
const ally = (rosterId: string) => ({ side: 'A' as const, rosterId });

/** A move, then who it hits: each hero takes down its own foe. */
const moveAndTarget: StoryFight = {
  id: 'lesson-move',
  seed: 1801,
  player: [
    { rosterId: 'crag', heroId: 'crag', level: 3, moveIds: ['rockToss'] },
    { rosterId: 'ursa', heroId: 'ursa', level: 3, moveIds: ['claw'] },
  ],
  playerLeads: ['crag', 'ursa'],
  enemy: [
    { rosterId: 'arc', heroId: 'arcling', level: 2 },
    { rosterId: 'cub', heroId: 'cubling', level: 2 },
  ],
  enemyLeads: ['arc', 'cub'],
  enemyScript: [[{ actor: 'arc', moveId: 'zap', target: ally('crag') }, { actor: 'cub', moveId: 'claw', target: ally('ursa') }]],
  guide: [[{ actor: 'crag', moveId: 'rockToss', target: foe('arc') }, { actor: 'ursa', moveId: 'claw', target: foe('cub') }]],
};

/** One cast empties Riptide's Mana, the Rest refills it, and the second cast finishes the foe. */
const mana: StoryFight = {
  id: 'lesson-mana',
  seed: 1802,
  player: [{ rosterId: 'riptide', heroId: 'tidecaller', level: 3, moveIds: ['torrent'] }],
  playerLeads: ['riptide'],
  enemy: [{ rosterId: 'cub', heroId: 'cubling', level: 14 }],
  enemyLeads: ['cub'],
  enemyScript: [1, 2, 3].map(() => [{ actor: 'cub', moveId: 'claw', target: ally('riptide') }]),
  guide: [
    [{ actor: 'riptide', moveId: 'torrent', target: foe('cub') }],
    [{ actor: 'riptide', rest: true }],
    [{ actor: 'riptide', moveId: 'torrent', target: foe('cub') }],
  ],
};

/** Fire on Nature and Storm on Water: each hero aims at the foe its type hits hardest. */
const types: StoryFight = {
  id: 'lesson-types',
  seed: 1803,
  player: [
    { rosterId: 'crimson', heroId: 'crimson', level: 3, moveIds: ['ember'] },
    { rosterId: 'raiju', heroId: 'raiju', level: 3, moveIds: ['thunderclap'] },
  ],
  playerLeads: ['crimson', 'raiju'],
  enemy: [
    { rosterId: 'sprout', heroId: 'sproutling', level: 6 },
    { rosterId: 'pud', heroId: 'puddling', level: 6 },
  ],
  enemyLeads: ['sprout', 'pud'],
  enemyScript: [[{ actor: 'sprout', moveId: 'vineLash', target: ally('crimson') }, { actor: 'pud', moveId: 'splash', target: ally('crimson') }]],
  guide: [[{ actor: 'crimson', moveId: 'ember', target: foe('sprout') }, { actor: 'raiju', moveId: 'thunderclap', target: foe('pud') }]],
};

/** One spread move takes both foes at once. */
const spread: StoryFight = {
  id: 'lesson-spread',
  seed: 1804,
  player: [{ rosterId: 'cairn', heroId: 'cairn', level: 3, moveIds: ['tremor'] }],
  playerLeads: ['cairn'],
  enemy: [
    { rosterId: 'arc', heroId: 'arcling', level: 2 },
    { rosterId: 'cog', heroId: 'cogling', level: 2 },
  ],
  enemyLeads: ['arc', 'cog'],
  enemyScript: [[{ actor: 'arc', moveId: 'zap', target: ally('cairn') }, { actor: 'cog', moveId: 'cogBop', target: ally('cairn') }]],
  guide: [[{ actor: 'cairn', moveId: 'tremor' }]],
};

/** The same move in each hand: Nightshade's physical Nightfall goes through Rillfin's thin hide, Glyph's magical one past Ingot's low Wisdom. */
const kinds: StoryFight = {
  id: 'lesson-kinds',
  seed: 1806,
  player: [
    { rosterId: 'nightshade', heroId: 'nightshade', level: 4, moveIds: ['nightfall'] },
    { rosterId: 'glyph', heroId: 'runescribe', level: 4, moveIds: ['nightfallRewired'] },
  ],
  playerLeads: ['nightshade', 'glyph'],
  enemy: [
    { rosterId: 'ingot', heroId: 'ingot', level: 4 },
    { rosterId: 'rillfin', heroId: 'rillfin', level: 4 },
  ],
  enemyLeads: ['ingot', 'rillfin'],
  enemyScript: [[{ actor: 'rillfin', moveId: 'crest', target: ally('glyph') }]],
  guide: [[{ actor: 'nightshade', moveId: 'nightfall', target: foe('rillfin') }, { actor: 'glyph', moveId: 'nightfallRewired', target: foe('ingot') }]],
};

/** Set Alight, then Singe: the hit leaves the Rivetling standing, and the Burn at the round's end puts it down. */
const burn: StoryFight = {
  id: 'lesson-burn',
  seed: 1807,
  player: [{ rosterId: 'cinder', heroId: 'cinderKnight', level: 3, moveIds: ['setAlight', 'singe'] }],
  playerLeads: ['cinder'],
  enemy: [{ rosterId: 'rivet', heroId: 'rivetling', level: 13 }],
  enemyLeads: ['rivet'],
  enemyScript: [1, 2].map(() => [{ actor: 'rivet', moveId: 'ironFist', target: ally('cinder') }]),
  guide: [[{ actor: 'cinder', moveId: 'setAlight', target: foe('rivet') }], [{ actor: 'cinder', moveId: 'singe', target: foe('rivet') }]],
};

/** Cinder faces a Puddling's water: it steps back for Raiju off the bench, who takes the splash lightly and answers with Storm. */
const switching: StoryFight = {
  id: 'lesson-switch',
  seed: 1808,
  player: [
    { rosterId: 'cinder', heroId: 'cinderKnight', level: 3, moveIds: ['singe'] },
    { rosterId: 'clockwork', heroId: 'forgewright', level: 3, moveIds: ['pistonPunch'] },
    { rosterId: 'raiju', heroId: 'raiju', level: 3, moveIds: ['thunderclap'] },
  ],
  playerLeads: ['cinder', 'clockwork'],
  enemy: [
    { rosterId: 'pud', heroId: 'puddling', level: 10 },
    { rosterId: 'cub', heroId: 'cubling', level: 4 },
  ],
  enemyLeads: ['pud', 'cub'],
  enemyScript: [1, 2].map(() => [{ actor: 'pud', moveId: 'splash', target: ally('cinder') }, { actor: 'cub', moveId: 'claw', target: ally('clockwork') }]),
  guide: [
    [{ actor: 'cinder', switchTo: 'raiju' }, { actor: 'clockwork', moveId: 'pistonPunch', target: foe('cub') }],
    [{ actor: 'raiju', moveId: 'thunderclap', target: foe('pud') }, { actor: 'clockwork', moveId: 'pistonPunch', target: foe('pud') }],
  ],
};

/** Ursa takes the Feral Dagger, and its Attack and Beast Force turn her Claw into a knockout the bare Claw is not. */
const gear: StoryFight = {
  id: 'lesson-gear',
  seed: 1809,
  player: [
    { rosterId: 'ursa', heroId: 'ursa', level: 3, moveIds: ['claw'] },
    { rosterId: 'drift', heroId: 'drift', level: 3, moveIds: ['psiBolt'] },
  ],
  playerLeads: ['ursa', 'drift'],
  enemy: [
    { rosterId: 'cub', heroId: 'cubling', level: 13 },
    { rosterId: 'arc', heroId: 'arcling', level: 2 },
  ],
  enemyLeads: ['cub', 'arc'],
  enemyScript: [[{ actor: 'cub', moveId: 'claw', target: ally('ursa') }]],
  guide: [[{ actor: 'ursa', moveId: 'claw', target: foe('cub') }, { actor: 'drift', moveId: 'psiBolt', target: foe('arc') }]],
};
const GEAR_HAND_OVER: StoryHandOver = { itemId: 'dagger.common.feral', to: 'ursa' };

/** The first open fight: six heroes of six types, the leads the player's to pick, and nothing guided. */
const open: StoryFight = {
  id: 'lesson-open',
  seed: 1810,
  player: [
    { rosterId: 'rime', heroId: 'rime', level: 6 },
    { rosterId: 'raiju', heroId: 'raiju', level: 6 },
    { rosterId: 'revenant', heroId: 'revenant', level: 6 },
    { rosterId: 'sylva', heroId: 'wildOracle', level: 6 },
    { rosterId: 'glyph', heroId: 'runescribe', level: 6 },
    { rosterId: 'cairn', heroId: 'cairn', level: 6 },
  ],
  playerLeads: [],
  enemy: [
    { rosterId: 'ravager', heroId: 'ravager', level: 4 },
    { rosterId: 'bramble', heroId: 'bramblehide', level: 4 },
    { rosterId: 'rillfin', heroId: 'rillfin', level: 4 },
    { rosterId: 'kindle', heroId: 'kindlehide', level: 4 },
  ],
  enemyLeads: ['ravager', 'bramble'],
  enemyScript: [],
  guide: [],
};

/** A fight as a lesson: its line on the top bar, the hand on every guided round. */
function lessonChapter(id: string, title: string, fight: StoryFight, line: string, handOver?: StoryHandOver): StoryChapter {
  const cues = fight.guide.map((_, i) => ({ round: i + 1, point: true as const }));
  return { id, title, beats: [{ kind: 'fight', fight, locationId: 'wildsEdge', cues, line, handOver }] };
}

/** The lessons as a book of one-beat chapters; a chapter's id is its scenario's (data/sky.ts). */
export const LESSONS: StoryDefinition = {
  id: 'firstLight',
  name: 'First Light',
  chapters: [
    lessonChapter('firstLight.move', 'Move and Target', moveAndTarget, 'Pick a move, then pick who it hits.'),
    lessonChapter('firstLight.mana', 'Mana', mana, 'Moves cost Mana. Rest fills it back up.'),
    lessonChapter('firstLight.types', 'Types', types, 'Some types hit harder than others.'),
    lessonChapter('firstLight.spread', 'Spread', spread, 'Some moves hit both foes at once.'),
    lessonChapter('firstLight.kinds', 'Physical and Magical', kinds, 'Defense stops physical hits. Wisdom stops magic.'),
    lessonChapter('firstLight.burn', 'Status Effects', burn, 'A Burn keeps hurting after the hit.'),
    lessonChapter('firstLight.switch', 'Switching', switching, 'Switch in a hero from the bench.'),
    lessonChapter('firstLight.gear', 'Equipment', gear, 'A piece of gear makes its hero stronger.', GEAR_HAND_OVER),
    lessonChapter('firstLight.open', 'The First Fight', open, 'Six heroes now. Win it your way.'),
  ],
};

/** The books the Story machinery looks a chapter up in (run/story.ts chapterById). */
export const STORY_BOOKS: readonly StoryDefinition[] = [LESSONS];
