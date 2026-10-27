// First Light's lessons (docs/first-light.md): one concept a lesson, each a guided fight with one line
// on the top bar, then the Clearing, the Road and the Fork until lessons 5–10 replace them. A lesson
// teaches by its guided taps, and the older three by their control tips and the heroes' calls too.
// Each lesson is a one-beat chapter in its own book, so the Story machinery plays it unchanged.

import type { StoryAct, StoryChapter, StoryDefinition, StoryFight } from '../run/story';
import { STORY_CAST_IDS as CAST } from './storyCast';
import { manualPage } from './howToPlay';

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
    { rosterId: 'cinder', heroId: 'cinderKnight', level: 3, moveIds: ['singe'] },
    { rosterId: 'raiju', heroId: 'raiju', level: 3, moveIds: ['thunderclap'] },
  ],
  playerLeads: ['cinder', 'raiju'],
  enemy: [
    { rosterId: 'sprout', heroId: 'sproutling', level: 6 },
    { rosterId: 'pud', heroId: 'puddling', level: 6 },
  ],
  enemyLeads: ['sprout', 'pud'],
  enemyScript: [[{ actor: 'sprout', moveId: 'vineLash', target: ally('cinder') }, { actor: 'pud', moveId: 'splash', target: ally('cinder') }]],
  guide: [[{ actor: 'cinder', moveId: 'singe', target: foe('sprout') }, { actor: 'raiju', moveId: 'thunderclap', target: foe('pud') }]],
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

/** A guided fight as a lesson: its line on the top bar, the hand on every round. */
function lessonChapter(id: string, title: string, fight: StoryFight, line: string): StoryChapter {
  const cues = fight.guide.map((_, i) => ({ round: i + 1, point: true as const }));
  return { id, title, beats: [{ kind: 'fight', fight, locationId: 'wildsEdge', cues, line }] };
}

/** The bench: switching, the two kinds of attack, Rest, a Shield and a Conduct setup, four heroes against the first spawn out of the fall. */
const clearing: StoryFight = {
  id: 'lesson-clearing',
  seed: 1702,
  player: [
    { rosterId: 'valor', heroId: CAST.valor, level: 3 },
    { rosterId: 'fang', heroId: 'packAlpha', level: 3 },
    { rosterId: 'warden', heroId: 'ironWarden', level: 12, moveIds: ['heavyBlow', 'galeSever'] },
    // Zap is cheap enough to leave Storm Lash's Mana for round 5, and Rime Coat shields the Warden while it Rests.
    { rosterId: 'raiju', heroId: 'raiju', level: 4, moveIds: ['zap', 'rimeCoat', 'stormLash'] },
  ],
  playerLeads: ['valor', 'fang'],
  enemy: [
    { rosterId: 'ravager', heroId: 'ravager', level: 12, moveIds: ['pounce'] },
    { rosterId: 'slabback', heroId: 'slabback', level: 12, moveIds: ['rockToss'] },
  ],
  enemyLeads: ['ravager', 'slabback'],
  enemyScript: [
    [{ actor: 'ravager', moveId: 'pounce', target: ally('valor') }, { actor: 'slabback', moveId: 'rockToss', target: ally('fang') }],
    [{ actor: 'ravager', moveId: 'pounce', target: ally('valor') }, { actor: 'slabback', moveId: 'rockToss', target: ally('valor') }],
    [{ actor: 'ravager', moveId: 'pounce', target: ally('raiju') }, { actor: 'slabback', moveId: 'rockToss', target: ally('warden') }],
    // Pounce goes first, so it leaves the Warden to Rock Toss and Rime Coat's Shield.
    [{ actor: 'ravager', moveId: 'pounce', target: ally('raiju') }, { actor: 'slabback', moveId: 'rockToss', target: ally('warden') }],
    [{ actor: 'ravager', moveId: 'pounce', target: ally('raiju') }, { actor: 'slabback', moveId: 'rockToss', target: ally('warden') }],
  ],
  guide: [
    [{ actor: 'valor', moveId: 'ironFist', target: foe('slabback') }, { actor: 'fang', moveId: 'claw', target: foe('ravager') }],
    [{ actor: 'valor', switchTo: 'warden' }, { actor: 'fang', switchTo: 'raiju' }],
    [{ actor: 'warden', moveId: 'galeSever' }, { actor: 'raiju', moveId: 'zap', target: foe('ravager') }],
    [{ actor: 'warden', rest: true }, { actor: 'raiju', moveId: 'rimeCoat', target: ally('warden') }],
    [{ actor: 'warden', moveId: 'galeSever' }, { actor: 'raiju', moveId: 'stormLash', target: foe('slabback') }],
  ],
};

/** The map, a pick from three, an item, a level, the Rest: one short act at Wild's Edge. */
const road: StoryAct = {
  locationId: 'wildsEdge',
  party: [
    { rosterId: 'valor', heroId: 'valor', level: 4 },
    { rosterId: 'fang', heroId: 'packAlpha', level: 4 },
    { rosterId: 'warden', heroId: 'ironWarden', level: 6 },
  ],
  rows: [
    [
      {
        type: 'fight',
        enemy: [{ rosterId: 'ravager', heroId: 'cubling', level: 6 }, { rosterId: 'sprout', heroId: 'sproutling', level: 6 }],
        // The lead pick's own first-time tip teaches the leads, at the moment they are picked.
        drop: 'dagger.common.feral',
      },
    ],
    [{ type: 'equipmentReward', items: ['greataxe.common', 'leathers.common.feral', 'shield.common'] }, { type: 'restReward' }, { type: 'passiveReward' }],
    [{ type: 'fight', enemy: [{ rosterId: 'rivet', heroId: 'rivetling', level: 8 }, { rosterId: 'ravager', heroId: 'cubling', level: 8 }, { rosterId: 'sprout', heroId: 'sproutling', level: 7 }], drop: 'spear.common.tempered' }],
    [{ type: 'restReward' }, { type: 'equipmentReward', items: ['boots.common', 'plate.common', 'dagger.common.tempered'] }, { type: 'manaWellReward' }],
    [
      {
        type: 'elite',
        enemy: [
          { rosterId: 'bear', heroId: 'ursa', level: 15, moveIds: ['claw', 'maul', 'prowl'] },
          { rosterId: 'sprout', heroId: 'sproutling', level: 12 },
          { rosterId: 'ravager', heroId: 'cubling', level: 12 },
        ],
        drop: 'sword.rare.tempered',
        cues: [
          {
            round: 2,
            tips: [manualPage('howto.bag')],
          },
        ],
      },
    ],
  ],
};

/**
 * Matchups (the opener favours Fang, the fork's Elite the Iron pair and Solace's Light, its
 * Skirmish hits everyone double), the Swordsman's seat with Valor his student, and Solace, the
 * roster's own Light caster: magic against Wisdom, a heal, a status, an innate.
 */
const fork: StoryAct = {
  locationId: 'forbiddenForest',
  party: [
    { rosterId: 'valor', heroId: 'valor', level: 8 },
    { rosterId: 'fang', heroId: 'packAlpha', level: 8 },
    { rosterId: 'warden', heroId: 'ironWarden', level: 9 },
    { rosterId: 'solace', heroId: 'dawnwarden', level: 8, moveIds: ['glimmer', 'mend', 'blind'] },
  ],
  students: { swordsman: 'valor' },
  rows: [
    [
      {
        type: 'fight',
        enemy: [{ rosterId: 'sprout', heroId: 'sproutling', level: 9 }, { rosterId: 'whim', heroId: 'whimling', level: 9 }],
        drop: 'dagger.rare.feral',
        cues: [
          { round: 1, tips: [manualPage('howto.heals')] },
          { round: 2, tips: [manualPage('howto.status.Daze')] },
        ],
      },
    ],
    [{ type: 'equipmentReward', items: ['greataxe.rare', 'leathers.rare.feral', 'boots.rare'] }, { type: 'restReward' }, { type: 'passiveReward' }],
    [{ type: 'patronSeat', patrons: ['swordsman'] }],
    [
      { type: 'elite', enemy: [{ rosterId: 'hoar', heroId: 'hoarfang', level: 11 }, { rosterId: 'slabback', heroId: 'pebbling', level: 10 }, { rosterId: 'sleet', heroId: 'sleetling', level: 10 }], drop: 'spear.rare.tempered' },
      { type: 'skirmish', enemy: [{ rosterId: 'volt', heroId: 'voltail', level: 7 }, { rosterId: 'gear', heroId: 'gearhound', level: 7 }], drop: 'plate.rare' },
    ],
    [{ type: 'restReward' }, { type: 'equipmentReward', items: ['shield.rare', 'plate.rare', 'greataxe.rare.tempered'] }, { type: 'manaWellReward' }],
    [{ type: 'elite', enemy: [{ rosterId: 'bramble', heroId: 'bramblehide', level: 11 }, { rosterId: 'gear', heroId: 'gearhound', level: 11 }, { rosterId: 'whim', heroId: 'whimling', level: 10 }], drop: 'greataxe.rare.tempered' }],
  ],
};

/** The lessons as a book of one-beat chapters; a chapter's id is its scenario's (data/sky.ts). */
export const LESSONS: StoryDefinition = {
  id: 'firstLight',
  name: 'First Light',
  chapters: [
    lessonChapter('firstLight.move', 'Move and Target', moveAndTarget, 'Pick a move, then pick who it hits.'),
    lessonChapter('firstLight.mana', 'Mana', mana, 'Moves cost Mana. Rest fills it back up.'),
    lessonChapter('firstLight.types', 'Types', types, 'Some types hit harder than others.'),
    lessonChapter('firstLight.spread', 'Spread', spread, 'Some moves hit both foes at once.'),
    {
      id: 'firstLight.clearing',
      title: 'The Clearing',
      beats: [
        {
          kind: 'fight',
          fight: clearing,
          locationId: 'wildsEdge',
          cues: [
            {
              round: 1,
              point: true,
              lines: [{ by: 'valor', text: "The Ravager's eyeing me, and that Slabback has a rock for Fang. Hit them first!" }],
            },
            {
              round: 2,
              point: true,
              lines: [{ by: 'valor', text: "They're both coming for me now. Warden, Raiju: take our places!" }],
              tips: [manualPage('howto.bench')],
            },
            {
              round: 3,
              point: true,
              lines: [
                { by: 'warden', text: "My blade has to cut through that Slabback's hide. Good thing Iron splits stone, and I'll catch them both." },
                { by: 'raiju', text: "My Zap is magic: it goes around the Ravager's hide, at its mind. And it's cheap. I'll need the Mana." },
              ],
              tips: [manualPage('howto.kinds')],
            },
            {
              round: 4,
              point: true,
              lines: [
                { by: 'warden', text: "I'm out of Mana, and that Slabback's winding up a throw at me." },
                { by: 'raiju', text: "Then I'll coat you in ice, and you Rest behind it." },
              ],
              tips: [manualPage('howto.statuses'), manualPage('howto.status.Shield')],
            },
            {
              round: 5,
              point: true,
              lines: [
                { by: 'raiju', text: "I'm faster. I'll mark the Slabback, Warden, and you set it off!" },
                { by: 'warden', text: 'Iron on a storm mark. Stand back.' },
              ],
              tips: [manualPage('howto.status.Conduct')],
            },
          ],
        },
      ],
    },
    { id: 'firstLight.road', title: 'The Road', beats: [{ kind: 'act', act: road }] },
    { id: 'firstLight.fork', title: 'The Fork', beats: [{ kind: 'act', act: fork }] },
  ],
};

/** The books the Story machinery looks a chapter up in (run/story.ts chapterById). */
export const STORY_BOOKS: readonly StoryDefinition[] = [LESSONS];
