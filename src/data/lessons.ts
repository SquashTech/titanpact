// First Light's lessons (docs/first-light.md): one concept a lesson, each a fight with one line on the
// top bar. The first eight are guided, the hand on every tap; the last is the first open fight, a team
// the player commands alone. Each lesson is a chapter in its own book, so the Story machinery plays it
// unchanged: one fight beat, or Equipment's two, bare and then armed.

import { STORY_ENEMY_SIDE, STORY_PLAYER_SIDE, type StoryBeat, type StoryChapter, type StoryDefinition, type StoryFight, type StoryHandOver } from '../run/story';

const foe = (rosterId: string) => ({ side: 'B' as const, rosterId });
const ally = (rosterId: string) => ({ side: 'A' as const, rosterId });
// No innate fires in a guided lesson, and no foe wears the Titan's Mark; the open fight lets the heroes' own fire, for the Passives page after it.
const QUIET = [STORY_PLAYER_SIDE, STORY_ENEMY_SIDE] as const;

/** A move, then who it hits: each hero takes down its own foe. */
const moveAndTarget: StoryFight = {
  id: 'lesson-move',
  quietSides: QUIET,
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

/** One Arcane Blast empties Pixie's Mana, the Rest refills it, and the second cast finishes the foe. Pixie's innate is quiet alone. */
const mana: StoryFight = {
  id: 'lesson-mana',
  quietSides: QUIET,
  seed: 1802,
  player: [{ rosterId: 'pixie', heroId: 'pixie', level: 3, moveIds: ['arcaneBlast'] }],
  playerLeads: ['pixie'],
  enemy: [{ rosterId: 'peb', heroId: 'pebbling', level: 15 }],
  enemyLeads: ['peb'],
  enemyScript: [1, 2, 3].map(() => [{ actor: 'peb', moveId: 'rockToss', target: ally('pixie') }]),
  guide: [
    [{ actor: 'pixie', moveId: 'arcaneBlast', target: foe('peb') }],
    [{ actor: 'pixie', rest: true }],
    [{ actor: 'pixie', moveId: 'arcaneBlast', target: foe('peb') }],
  ],
};

/** Fire on Nature and Storm on Water: each hero aims at the foe its type hits hardest. */
const types: StoryFight = {
  id: 'lesson-types',
  quietSides: QUIET,
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
  quietSides: QUIET,
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
  quietSides: QUIET,
  seed: 1806,
  player: [
    { rosterId: 'nightshade', heroId: 'nightshade', level: 4, moveIds: ['nightfall'] },
    { rosterId: 'glyph', heroId: 'runescribe', level: 4, moveIds: ['nightfallRewired'] },
  ],
  playerLeads: ['nightshade', 'glyph'],
  enemy: [
    { rosterId: 'ingot', heroId: 'ingot', level: 4 },
    { rosterId: 'rillfin', heroId: 'rillfin', level: 4, moveIds: ['splash'] },
  ],
  enemyLeads: ['ingot', 'rillfin'],
  enemyScript: [[{ actor: 'rillfin', moveId: 'splash', target: ally('glyph') }]],
  guide: [[{ actor: 'nightshade', moveId: 'nightfall', target: foe('rillfin') }, { actor: 'glyph', moveId: 'nightfallRewired', target: foe('ingot') }]],
};

/** Set Alight, then Singe: the hit leaves the Rivetling standing, and the Burn at the round's end puts it down. */
const burn: StoryFight = {
  id: 'lesson-burn',
  quietSides: QUIET,
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
  quietSides: QUIET,
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

const URSA: StoryFight['player'] = [{ rosterId: 'ursa', heroId: 'ursa', level: 3, moveIds: ['claw'] }];
const GEAR_CUB: StoryFight['enemy'] = [{ rosterId: 'cub', heroId: 'cubling', level: 13 }];
const cubClaws = (rounds: number) => Array.from({ length: rounds }, () => [{ actor: 'cub', moveId: 'claw', target: ally('ursa') }]);
const ursaClaws = (rounds: number) => Array.from({ length: rounds }, () => [{ actor: 'ursa', moveId: 'claw', target: foe('cub') }]);

/** Bare, Ursa's Claw takes two hits to drop the Cubling. */
const gearBare: StoryFight = {
  id: 'lesson-gear-bare',
  quietSides: QUIET,
  seed: 1826,
  player: URSA,
  playerLeads: ['ursa'],
  enemy: GEAR_CUB,
  enemyLeads: ['cub'],
  enemyScript: cubClaws(2),
  guide: ursaClaws(2),
};

/** The same Cubling, and the Feral Dagger's Attack and Beast Force turn one Claw into a knockout. */
const gearArmed: StoryFight = { ...gearBare, id: 'lesson-gear', enemyScript: cubClaws(1), guide: ursaClaws(1) };
const GEAR_HAND_OVER: StoryHandOver = { itemId: 'dagger.common.feral', to: 'ursa' };

/** The open fight's party: heroes the lessons cast, each holding the one move it was taught with. */
export const OPEN_FIGHT_PARTY = ['crimson', 'raiju', 'cairn', 'ursa'] as const;
const OPEN_MOVES: Readonly<Record<(typeof OPEN_FIGHT_PARTY)[number], string>> = { crimson: 'ember', raiju: 'thunderclap', cairn: 'tremor', ursa: 'claw' };

/** The first open fight: four heroes, the leads the player's to pick, and nothing guided. */
const open: StoryFight = {
  id: 'lesson-open',
  quietSides: [STORY_ENEMY_SIDE],
  seed: 1810,
  player: OPEN_FIGHT_PARTY.map((heroId) => ({ rosterId: heroId, heroId, level: 6, moveIds: [OPEN_MOVES[heroId]] })),
  playerLeads: [],
  // Plain hits only, so the fight holds nothing a lesson has not shown: no status, field or stat step.
  enemy: [
    { rosterId: 'ravager', heroId: 'ravager', level: 4, moveIds: ['pounce'] },
    { rosterId: 'bramble', heroId: 'bramblehide', level: 4, moveIds: ['rockToss'] },
    { rosterId: 'rillfin', heroId: 'rillfin', level: 4, moveIds: ['splash'] },
  ],
  enemyLeads: ['ravager', 'bramble'],
  enemyScript: [],
  guide: [],
};

/** A fight as a lesson beat: its line on the top bar, the hand on every guided round. */
function lessonBeat(fight: StoryFight, line: string, handOver?: StoryHandOver): StoryBeat {
  const cues = fight.guide.map((_, i) => ({ round: i + 1, point: true as const }));
  return { kind: 'fight', fight, locationId: 'wildsEdge', cues, line, handOver };
}

function lessonChapter(id: string, title: string, fight: StoryFight, line: string): StoryChapter {
  return { id, title, beats: [lessonBeat(fight, line)] };
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
    {
      id: 'firstLight.gear',
      title: 'Equipment',
      beats: [lessonBeat(gearBare, 'Without gear, it takes two hits.'), lessonBeat(gearArmed, 'A piece of gear makes its hero stronger.', GEAR_HAND_OVER)],
    },
    lessonChapter('firstLight.open', 'The First Fight', open, 'Four heroes now. Win it your way.'),
  ],
};

/** The books the Story machinery looks a chapter up in (run/story.ts chapterById). */
export const STORY_BOOKS: readonly StoryDefinition[] = [LESSONS];
