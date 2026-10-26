// First Light's lessons (docs/the-sky.md §3): the tutorial fights and acts that A Tale of Valor was
// built on, with its scenes cut. A lesson teaches by its guided taps, its control tips (How to Play's
// own pages) and its numbers, and the heroes on the field call each round's plan. Ren and Will are recast with the base roster's Iron Warden and Raiju (2026-10-24, per
// user direction). Each lesson is a one-beat chapter in its own book, so the Story machinery plays it unchanged.

import type { StoryAct, StoryDefinition, StoryFight } from '../run/story';
import { STORY_CAST_IDS as CAST } from './storyCast';
import { manualPage } from './howToPlay';

const foe = (rosterId: string) => ({ side: 'B' as const, rosterId });
const ally = (rosterId: string) => ({ side: 'A' as const, rosterId });

/** Picking a move and a target, Mana, one target or both, a debuff answered by a buff, matchups: two hunters, both guided. */
const hunt: StoryFight = {
  id: 'lesson-hunt',
  seed: 1701,
  player: [
    { rosterId: 'valor', heroId: CAST.valor, level: 2 },
    { rosterId: 'fang', heroId: 'packAlpha', level: 2 },
  ],
  playerLeads: ['valor', 'fang'],
  enemy: [
    { rosterId: 'stag', heroId: CAST.stag, level: 1 },
    { rosterId: 'fox', heroId: CAST.fox, level: 1 },
  ],
  enemyLeads: ['stag', 'fox'],
  enemyScript: [
    [{ actor: 'stag', moveId: 'wintersBreath' }, { actor: 'fox', moveId: 'pounce', target: ally('valor') }],
    [{ actor: 'stag', moveId: 'wintersBreath' }],
  ],
  guide: [
    [{ actor: 'valor', moveId: 'ironFist', target: foe('fox') }, { actor: 'fang', moveId: 'claw', target: foe('fox') }],
    [{ actor: 'valor', moveId: 'ironFist', target: foe('stag') }, { actor: 'fang', moveId: 'howl' }],
  ],
};

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
    {
      id: 'firstLight.hunt',
      title: 'The Hunt',
      beats: [
        {
          kind: 'act',
          act: {
            locationId: 'wildsEdge',
            party: hunt.player,
            rows: [
              [
                {
                  type: 'fight',
                  enemy: hunt.enemy,
                  enemyLeads: hunt.enemyLeads,
                  script: hunt,
                  cues: [
                    {
                      round: 1,
                      point: true,
                      lines: [
                        { by: 'valor', text: "That fox is quicker than us. It'll strike first, whatever we do." },
                        { by: 'valor', text: "Both of us on it, Fang. It won't strike twice." },
                      ],
                      tips: [
                        {
                          id: 'story.welcome',
                          title: 'Welcome to',
                          pages: ['Battles are *turn-based*. Select *moves* for your heroes, then watch the round play out.'],
                          look: 'welcome',
                        },
                        manualPage('howto.combat'),
                        manualPage('howto.mana'),
                      ],
                    },
                    {
                      round: 2,
                      point: true,
                      lines: [
                        { by: 'valor', text: "Its breath sapped us both. Fang, you're faster: howl us back up before I swing." },
                        { by: 'valor', text: 'Iron splits ice. One clean hit, and that stag never breathes again.' },
                      ],
                      tips: [manualPage('howto.targets'), manualPage('howto.stages'), manualPage('howto.types')],
                    },
                  ],
                },
              ],
            ],
          },
        },
      ],
    },
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
              tips: [manualPage('howto.rest'), manualPage('howto.statuses'), manualPage('howto.status.Shield')],
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
