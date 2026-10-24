// First Light's lessons (docs/the-sky.md §3): the tutorial fights and acts that A Tale of Valor was
// built on, with every scene and every spoken line cut. A lesson teaches by its guided taps, its
// control tips and its numbers; Blip frames it from the sky. Ren and Will are recast with the base
// roster's Iron Warden and Raiju (2026-10-24, per user direction). Each lesson is a one-beat chapter
// in its own book, so the Story machinery plays it unchanged.

import type { StoryAct, StoryCommand, StoryDefinition, StoryFight } from '../run/story';
import { STORY_CAST_IDS as CAST } from './storyCast';

const foe = (rosterId: string) => ({ side: 'B' as const, rosterId });
const ally = (rosterId: string) => ({ side: 'A' as const, rosterId });

/** Picking a move and a target, a round resolving, matchups and turn order: two hunters, both guided. */
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

const reach: StoryCommand[] = [{ actor: 'faceless', moveId: 'erode' }];

/** The bench: switching, Rest, a Shield and a Conduct setup, four heroes against the Faceless. */
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
  enemy: [{ rosterId: 'faceless', heroId: CAST.endbringer, level: 1 }],
  enemyLeads: ['faceless'],
  enemyScript: [
    reach,
    [{ actor: 'faceless', moveId: 'transfix', target: ally('fang') }],
    reach,
    [{ actor: 'faceless', moveId: 'transfix', target: ally('warden') }],
    reach,
  ],
  guide: [
    [{ actor: 'valor', moveId: 'ironFist', target: foe('faceless') }, { actor: 'fang', moveId: 'claw', target: foe('faceless') }],
    [{ actor: 'valor', switchTo: 'warden' }, { actor: 'fang', switchTo: 'raiju' }],
    [{ actor: 'warden', moveId: 'galeSever' }, { actor: 'raiju', moveId: 'zap', target: foe('faceless') }],
    [{ actor: 'warden', rest: true }, { actor: 'raiju', moveId: 'rimeCoat', target: ally('warden') }],
    [{ actor: 'warden', moveId: 'galeSever' }, { actor: 'raiju', moveId: 'stormLash', target: foe('faceless') }],
  ],
  endsWhen: [
    { kind: 'hpAtMost', side: 'B', rosterId: 'faceless', hp: 1, winner: 'A' },
    { kind: 'afterRound', round: 5, winner: 'A' },
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
        enemy: [{ rosterId: 'cub', heroId: 'cubling', level: 6 }, { rosterId: 'sprout', heroId: 'sproutling', level: 6 }],
        drop: 'dagger.common.feral',
        cues: [
          {
            round: 1,
            tips: [
              {
                id: 'story.arrows',
                title: 'Matchups',
                pages: [
                  "The arrows under a move's number show how it hits each enemy: [super] double, [resist] half. Strike where it hurts.",
                  'Hold a move to read everything it does.',
                ],
              },
            ],
          },
        ],
      },
    ],
    [{ type: 'equipmentReward', items: ['greataxe.common', 'leathers.common.feral', 'shield.common'] }, { type: 'restReward' }, { type: 'passiveReward' }],
    [{ type: 'fight', enemy: [{ rosterId: 'rivet', heroId: 'rivetling', level: 8 }, { rosterId: 'cub', heroId: 'cubling', level: 8 }, { rosterId: 'sprout', heroId: 'sproutling', level: 7 }], drop: 'spear.common.tempered' }],
    [{ type: 'restReward' }, { type: 'equipmentReward', items: ['boots.common', 'plate.common', 'dagger.common.tempered'] }, { type: 'manaWellReward' }],
    [
      {
        type: 'elite',
        enemy: [
          { rosterId: 'bear', heroId: 'ursa', level: 15, moveIds: ['claw', 'maul', 'prowl'] },
          { rosterId: 'sprout', heroId: 'sproutling', level: 12 },
          { rosterId: 'cub', heroId: 'cubling', level: 12 },
        ],
        drop: 'sword.rare.tempered',
        cues: [
          {
            round: 2,
            tips: [
              {
                id: 'story.bag',
                title: 'The Bag',
                pages: [
                  'The Bag holds potions for the whole team. Drinking one costs no turn: drink, then choose a move as usual.',
                  "Each potion restores half of a hero's health or Mana. Find more after fights.",
                ],
              },
            ],
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
    [{ type: 'fight', enemy: [{ rosterId: 'sprout', heroId: 'sproutling', level: 9 }, { rosterId: 'whim', heroId: 'whimling', level: 9 }], drop: 'dagger.rare.feral' }],
    [{ type: 'equipmentReward', items: ['greataxe.rare', 'leathers.rare.feral', 'boots.rare'] }, { type: 'restReward' }, { type: 'passiveReward' }],
    [{ type: 'patronSeat', patrons: ['swordsman'] }],
    [
      { type: 'elite', enemy: [{ rosterId: 'hoar', heroId: 'hoarfang', level: 11 }, { rosterId: 'pebble', heroId: 'pebbling', level: 10 }, { rosterId: 'sleet', heroId: 'sleetling', level: 10 }], drop: 'spear.rare.tempered' },
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
          kind: 'fight',
          fight: hunt,
          locationId: 'wildsEdge',
          cues: [
            {
              round: 1,
              point: true,
              tips: [
                {
                  id: 'story.welcome',
                  title: 'Welcome to',
                  pages: ['Battles are *turn-based*. Select *moves* for your heroes, then watch the round play out.'],
                  look: 'welcome',
                },
              ],
            },
            {
              round: 2,
              point: true,
              tips: [
                { id: 'story.reading', title: 'Reading a Move', pages: ['[kinds] *Hold* any move to read all of it.'] },
                {
                  id: 'story.types',
                  title: 'Types',
                  pages: [
                    'There are many *types* in Titanpact, each with its own *weaknesses* and *resistances*.',
                    "Don't worry about learning them all at once. Watch the *arrows* on a move: [super] it hits hard, [resist] it's resisted.",
                  ],
                },
                {
                  id: 'story.combo',
                  title: 'Setting Up',
                  pages: [
                    'Iron deals *Bonus* [super] damage against Frost. Frost and Storm *Resist* [resist] Beast damage.',
                    "The stag's breath *lowered* both heroes' Attack. Fang is *faster*, so his Howl *raises* it again before Valor strikes.",
                  ],
                },
              ],
            },
          ],
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
            { round: 1, tips: [{ id: 'story.inspect', title: 'Reading a Foe', pages: ['*Tap* any hero, yours or theirs, to read its *stats*, *moves* and *passives*.'] }] },
            {
              round: 2,
              point: true,
              tips: [
                {
                  id: 'story.switch',
                  title: 'Switching',
                  pages: [
                    "*Switch* trades a hero on the field for one on the *bench*. The one coming in doesn't act this round.",
                    'Heroes on the bench *regain Mana* every round, so switching keeps the team fresh.',
                  ],
                },
              ],
            },
            {
              round: 4,
              point: true,
              tips: [
                { id: 'story.rest', title: 'Rest', pages: ['Iron Warden has no Mana for any move. *Rest* skips its turn and *refills all Mana*.'] },
                {
                  id: 'story.shield',
                  title: 'Shield',
                  pages: ['*Rime Coat* gives an ally a *Shield*: extra health that takes hits before HP does, until a hit *breaks* it.'],
                },
              ],
            },
            {
              round: 5,
              point: true,
              tips: [
                {
                  id: 'story.conduct',
                  title: 'Conduct',
                  pages: [
                    '*Storm Lash* puts *Conduct* [conduct] on its target.',
                    'The next *Storm*, *Iron* or *Mech* hit on that target deals *Bonus* damage and uses up the mark.',
                    "Raiju is *faster*, so its mark lands first. Then Iron Warden's *Iron* strike sets it off.",
                  ],
                },
              ],
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
