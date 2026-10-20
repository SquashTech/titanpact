// Stories as data (docs/stories.md). The prologue's lines are a DRAFT for the user to rewrite.

import type { StoryAct, StoryActor, StoryCommand, StoryDefinition, StoryFight, StoryVoice } from '../run/story';
import { STORY_CAST_IDS as CAST } from './storyCast';

const VALOR_VOICE: StoryVoice = { timbre: 'bright', pitch: 1 };
/** Valor telling it later: her own voice, a little lower. */
const REMEMBERING: StoryVoice = { timbre: 'bright', pitch: 0.92 };

const valor: StoryActor = { id: 'valor', name: 'Valor', artHeroId: CAST.valor, stands: 'left', voice: VALOR_VOICE, portrait: 'valor' };
const fang: StoryActor = { id: 'fang', name: 'Fang', artHeroId: 'packAlpha', stands: 'left', portrait: 'fang' };
const ren: StoryActor = { id: 'ren', name: 'Ren', artHeroId: CAST.ren, stands: 'right', voice: { timbre: 'deep', pitch: 1 }, portrait: 'ren' };
const will: StoryActor = { id: 'will', name: 'Will', artHeroId: CAST.will, stands: 'right', voice: { timbre: 'bright', pitch: 1.18 }, portrait: 'will' };
const faceless: StoryActor = { id: 'faceless', name: '???', artHeroId: CAST.endbringer, stands: 'right', scale: 1.2, uncanny: true };
const stag: StoryActor = { id: 'stag', name: 'White Stag', artHeroId: CAST.stag, stands: 'right' };
const fox: StoryActor = { id: 'fox', name: 'Fox', artHeroId: CAST.fox, stands: 'right' };
const risen: StoryActor = { id: 'risen', name: '???', artHeroId: 'heraldRisen', stands: 'right', scale: 1.7, uncanny: true };

const foe = (rosterId: string) => ({ side: 'B' as const, rosterId });
const ally = (rosterId: string) => ({ side: 'A' as const, rosterId });

const firstHunt: StoryFight = {
  id: 'valor-1-hunt',
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

// Chapter 2's Valor has the sword: the roster's own Valor, sprite and kit.
const valorArmed: StoryActor = { id: 'valor', name: 'Valor', artHeroId: 'valor', stands: 'left', voice: VALOR_VOICE, portrait: 'valor' };

const solace: StoryActor = { id: 'solace', name: 'Solace', artHeroId: 'dawnwarden', stands: 'right', voice: { timbre: 'warm', pitch: 1.12 }, portrait: 'solace' };

/**
 * Chapter 3: matchups (the opener favours Fang, the fork's Elite favours the Iron pair and Solace's
 * Light, its Skirmish hits everyone double), Ren's seat as the Swordsman with Valor his student,
 * and Solace, the roster's own Light caster: magic against Wisdom, a heal, a status, an innate.
 */
const forestRoad: StoryAct = {
  locationId: 'forbiddenForest',
  party: [
    { rosterId: 'valor', heroId: 'valor', level: 8 },
    { rosterId: 'fang', heroId: 'packAlpha', level: 8 },
    { rosterId: 'ren', heroId: CAST.ren, level: 9 },
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

/** Chapter 2: the map, a pick from three, an item, a level, the Rest. The land the Titan touched has started to turn. */
const northRoad: StoryAct = {
  locationId: 'wildsEdge',
  party: [
    { rosterId: 'valor', heroId: 'valor', level: 4 },
    { rosterId: 'fang', heroId: 'packAlpha', level: 4 },
    { rosterId: 'ren', heroId: CAST.ren, level: 6 },
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
            speaker: 'Ren',
            text: 'Turned things. Hit them where it hurts.',
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
          { round: 1, speaker: 'Ren', text: "A bear the turning got to. Don't stand in front of it.", sound: 'wolf.bark' },
          {
            round: 2,
            speaker: 'Valor',
            text: 'Hold on, Fang!',
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

const theClearing: StoryFight = {
  id: 'valor-1-clearing',
  seed: 1702,
  player: [
    { rosterId: 'valor', heroId: CAST.valor, level: 3 },
    { rosterId: 'fang', heroId: 'packAlpha', level: 3 },
    { rosterId: 'ren', heroId: CAST.ren, level: 12 },
    // Storm Lash marks with Conduct, so his first strike in round 3 sets up his father's Iron blade.
    { rosterId: 'will', heroId: CAST.will, level: 4, moveIds: ['stormLash', 'thunderclap'] },
  ],
  playerLeads: ['valor', 'fang'],
  enemy: [{ rosterId: 'faceless', heroId: CAST.endbringer, level: 1 }],
  enemyLeads: ['faceless'],
  enemyScript: [reach, [{ actor: 'faceless', moveId: 'transfix', target: ally('fang') }], reach, reach],
  guide: [
    [{ actor: 'valor', moveId: 'ironFist', target: foe('faceless') }, { actor: 'fang', moveId: 'claw', target: foe('faceless') }],
    [{ actor: 'valor', switchTo: 'ren' }, { actor: 'fang', switchTo: 'will' }],
    [{ actor: 'ren', moveId: 'galeSever' }, { actor: 'will', moveId: 'stormLash', target: foe('faceless') }],
    [{ actor: 'ren', rest: true }, { actor: 'will', moveId: 'thunderclap', target: foe('faceless') }],
  ],
  endsWhen: [
    { kind: 'hpAtMost', side: 'B', rosterId: 'faceless', hp: 1, winner: 'A' },
    { kind: 'afterRound', round: 4, winner: 'A' },
  ],
};

export const storyCatalog: readonly StoryDefinition[] = [
  {
    id: 'valor',
    name: 'A Tale of Valor',
    plannedChapters: { 1: 5 },
    chapters: [
      {
        id: 'valor-1',
        title: 'The Fall',
        cycle: 1,
        beats: [
          {
            kind: 'memory',
            locationId: 'wildsEdge',
            voice: REMEMBERING,
            music: null,
            lines: [
              'When it all started, we were out on a hunt.',
              'It was the first time Father let Will come with us.',
              "He'd had a sword for a month. I'd wanted one my whole life.",
            ],
          },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valor, fang, ren, will],
            stage: { valor: { x: 22, depth: 0.8 }, fang: { x: 34, depth: 0.5 }, ren: { x: 68, depth: 0.75 }, will: { x: 82, depth: 0.5 } },
            lines: [
              { speaker: 'ren', text: 'The tracks split at the ridge. Will, with me.' },
              { speaker: 'ren', text: 'Valor, you and Fang take the high path. If you see it, you whistle.' },
              { speaker: 'valor', text: 'And if it sees me first?' },
              { speaker: 'ren', text: 'Then you whistle louder.' },
              { speaker: 'will', mood: 'happy', text: "I'll bring you back a claw, Val." },
              { speaker: 'fang', mood: 'happy', text: 'Fang barks, impatient to go.', sound: 'wolf.bark', moves: { ren: { x: 106, off: true }, will: { x: 112, off: true }, fang: { x: 46, depth: 0.6 } } },
              { speaker: 'valor', mood: 'happy', text: "One month with a sword and he's a hunter." },
              { text: 'Fang presses into her hand until she laughs.', moves: { fang: { x: 30, depth: 0.85 } } },
            ],
            skipped: 'The family split up to hunt. Valor and Fang took the high path.',
          },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valor, fang, stag, fox],
            stage: { valor: { x: 26, depth: 0.8 }, fang: { x: 14, depth: 0.55 }, stag: { x: 86, depth: 0.2, off: true }, fox: { x: 74, depth: 0.15, off: true } },
            lines: [
              { text: 'The high path climbs above the trees. Valor reads the ground the way Father taught her.' },
              { speaker: 'valor', text: 'Fresh. Hooves, and something smaller following them.', moves: { valor: { x: 32, depth: 0.75 }, fang: { x: 24, depth: 0.6 } } },
              { text: 'Fang goes still, nose to the wind.', moves: { fang: { x: 42, depth: 0.65 } } },
              { text: 'Below the ridge, a white stag lifts its head from the grass, frost on its antlers. A fox lies low in the brush beside it.', moves: { stag: { off: false }, fox: { off: false } } },
              { speaker: 'valor', text: 'Easy, Fang. On my word.', moves: { valor: { x: 36, depth: 0.85 } } },
              { speaker: 'valor', mood: 'happy', text: 'Now!', sound: 'wolf.bark', moves: { stag: { x: 84, depth: 0.45 }, fox: { x: 70, depth: 0.5 } } },
            ],
            skipped: 'On the high path, Valor and Fang found a white stag, and a fox stalking it.',
          },
          {
            kind: 'fight',
            fight: firstHunt,
            cast: [valor, fang],
            cues: [
              {
                round: 1,
                speaker: 'Valor',
                text: 'The fox first. Fang, with me!',
                sound: 'wolf.bark',
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
                speaker: 'Valor',
                text: "Howl, Fang! Your bite won't touch it.",
                sound: 'wolf.bark',
                point: true,
                tips: [
                  { id: 'story.reading', title: 'Reading a Move', pages: ['[kinds] *Hold* any move to read all of it.'] },
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
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [ren, will, faceless],
            music: 'threshold',
            stage: { ren: { x: 34, depth: 0.7 }, will: { x: 48, depth: 0.75 }, faceless: { x: 84, depth: 0.05, off: true } },
            lines: [
              { text: 'On the low path, Ren stops walking.' },
              { text: 'No birds. No wind. Only Will, breathing.' },
              { speaker: 'will', text: 'Father?' },
              { speaker: 'ren', text: "Don't move." },
              { text: 'Across the clearing, something stands among the trees. It was not there a moment ago.', moves: { faceless: { off: false } } },
              { speaker: 'will', mood: 'shocked', text: 'Is that a man?' },
              { text: 'It is turned toward them. Where its face should be, there is nothing.' },
              { text: 'Then it is closer. Neither of them saw it move.', moves: { faceless: { x: 74, depth: 0.25 } } },
              { speaker: 'ren', mood: 'angry', text: 'Behind me, Will. Slowly.', moves: { ren: { x: 44, depth: 0.8 }, will: { x: 30, depth: 0.5 } } },
              { speaker: 'ren', text: "Walk backwards. Don't run until I say.", moves: { ren: { x: 32 }, will: { x: 16 } } },
            ],
            skipped: 'Ren and Will found something with no face in the clearing, and backed away.',
          },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valor, fang, ren, will, faceless],
            stage: {
              valor: { x: 20, depth: 0.75 },
              fang: { x: 10, depth: 0.5 },
              ren: { x: 46, depth: 0.7 },
              will: { x: 36, depth: 0.45 },
              faceless: { x: 88, depth: 0.15 },
            },
            lines: [
              { speaker: 'will', mood: 'shocked', text: "Val! It's following us!", moves: { faceless: { x: 80, depth: 0.3 } } },
              { speaker: 'ren', mood: 'angry', text: 'Take your brother and go. We do not fight that.' },
              { speaker: 'valor', mood: 'angry', text: 'You taught him to fight. Let me.', moves: { valor: { x: 58, depth: 0.9 }, fang: { x: 50, depth: 0.6 } } },
              { speaker: 'ren', mood: 'shocked', text: 'Valor, no—' },
            ],
            skipped: 'Ren told Valor not to fight it. She did anyway.',
            music: 'threshold',
          },
          {
            kind: 'fight',
            fight: theClearing,
            cast: [valor, fang, ren, will],
            cues: [
              {
                round: 1,
                speaker: 'Valor',
                text: 'Hit it together!',
                tips: [{ id: 'story.inspect', title: 'Reading a Foe', pages: ['*Tap* any hero, yours or theirs, to read its *stats*, *moves* and *passives*.'] }],
              },
              {
                round: 2,
                speaker: 'Ren',
                text: 'Fall back! Will, with me.',
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
                round: 3,
                speaker: 'Ren',
                text: 'Mark it, Will. My blade follows.',
                point: true,
                tips: [
                  {
                    id: 'story.conduct',
                    title: 'Conduct',
                    pages: [
                      '*Storm Lash* puts *Conduct* [conduct] on its target.',
                      'The next *Storm*, *Iron* or *Mech* hit on that target deals *Bonus* damage and uses up the mark.',
                      "Will is *faster*, so his mark lands first. Then Ren's *Iron* blade sets it off.",
                    ],
                  },
                ],
              },
              {
                round: 4,
                speaker: 'Ren',
                text: 'Catch your breath. Will, now!',
                tips: [{ id: 'story.rest', title: 'Rest', pages: ['*Rest* skips a turn and *refills all Mana*. A hero with no Mana for any move must Rest.'] }],
              },
            ],
          },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valor, fang, ren, will, faceless],
            stage: {
              valor: { x: 44, depth: 0.85 },
              fang: { x: 32, depth: 0.6 },
              ren: { x: 24, depth: 0.75 },
              will: { x: 14, depth: 0.5 },
              faceless: { x: 72, depth: 0.4 },
            },
            lines: [
              { speaker: 'valor', mood: 'shocked', text: "It's down. Is it down?" },
              { speaker: 'will', mood: 'shocked', text: "It isn't even bleeding." },
              { speaker: 'ren', mood: 'shocked', text: 'Look up.' },
            ],
            skipped: 'They brought it to its knees. Then Ren looked up.',
            music: 'threshold',
          },
          { kind: 'fall', lines: ['Above them, the stars go out, one after another, in a line.', 'Something falls.'] },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valor, fang, ren, will, risen],
            stage: {
              valor: { x: 22, depth: 0.85 },
              fang: { x: 12, depth: 0.6 },
              ren: { x: 38, depth: 0.55 },
              will: { x: 62, depth: 0.7 },
              risen: { x: 84, depth: 0.15, off: true },
            },
            lines: [
              { text: 'For a long moment, nothing. Dust drifts down where the stars were.' },
              { text: 'Then the faceless thing gets up.', sound: 'titan.stir', moves: { risen: { off: false } } },
              { text: 'It is taller now. Much taller. It does not look at Ren, or at Valor.' },
              { text: 'It is turned toward Will.', moves: { risen: { x: 78, depth: 0.3 } } },
              { speaker: 'will', mood: 'shocked', text: 'Father...?', moves: { will: { x: 66, depth: 0.7 } } },
              { speaker: 'ren', mood: 'angry', text: 'Will! To me!', moves: { ren: { x: 44, depth: 0.6 } } },
              { speaker: 'valor', mood: 'shocked', text: 'Will, run!' },
              { text: 'Will runs.', moves: { will: { x: 58, depth: 0.75 } } },
              { text: 'It is already in front of him.', sound: 'titan.gaze', painting: 'willTaken', moves: { risen: { x: 51, depth: 0.72 } } },
              { speaker: 'will', mood: 'shocked', text: 'Val—!' },
              { text: 'And then neither of them is there.', painting: null, moves: { will: { off: true }, risen: { off: true } } },
              { text: 'Where he stood, his sword lies in the grass.' },
              { speaker: 'fang', mood: 'sad', text: 'Fang howls at the empty sky.', sound: 'wolf.howl' },
              { speaker: 'valor', mood: 'sad', text: 'Will...' },
              { speaker: 'ren', mood: 'sad', text: 'Pick it up.', moves: { valor: { x: 56, depth: 0.75 } } },
              { text: 'Valor lifts her brother\'s sword out of the grass.', painting: 'valorTakesTheSword' },
              { speaker: 'ren', mood: 'sad', text: 'We run.' },
            ],
            skipped: 'The Titan fell. The faceless thing rose stronger, took Will, and was gone. Valor picked up his sword.',
            music: 'threshold',
          },
          { kind: 'end', line: 'Valor had wanted a sword her whole life.' },
        ],
      },
      {
        id: 'valor-2',
        title: 'His Sword',
        cycle: 1,
        beats: [
          {
            kind: 'memory',
            locationId: 'wildsEdge',
            voice: REMEMBERING,
            lines: [
              "I didn't sleep that night. Neither did Father.",
              'I could hear him by the fire, sharpening a blade he never drew.',
              'In the morning, we went north.',
            ],
          },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valorArmed, fang, ren],
            lines: [
              { text: 'Morning. The river runs black.' },
              { speaker: 'ren', text: 'It went north. So do we.' },
              { speaker: 'valor', mood: 'angry', text: 'Then teach me on the way. I have his sword now.' },
              { speaker: 'ren', mood: 'sad', text: "You have his sword. That isn't the same thing." },
              { text: 'Ren walks on ahead. Fang waits for her.', moves: { ren: { x: 108, off: true } } },
            ],
            skipped: 'The morning after, Ren set out north after the faceless thing. He would not teach Valor the sword.',
          },
          { kind: 'act', act: northRoad },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valorArmed, fang, ren],
            lines: [
              { speaker: 'ren', text: 'You hold it like an axe.' },
              { speaker: 'valor', mood: 'happy', text: 'It worked.' },
              { speaker: 'ren', mood: 'angry', text: "It won't, against that thing." },
              { text: 'He looks at the sword a long time.' },
              { speaker: 'ren', mood: 'sad', text: "Tomorrow, before the light. If you're carrying his sword, carry it properly." },
            ],
            skipped: 'Ren watched her fight, and agreed to teach her.',
          },
          { kind: 'end', line: 'She had a teacher now. She did not have her brother.' },
        ],
      },
      {
        id: 'valor-3',
        title: 'The Lesson',
        cycle: 1,
        beats: [
          {
            kind: 'memory',
            locationId: 'forbiddenForest',
            voice: REMEMBERING,
            lines: [
              'After that, Father taught me before dawn, every day.',
              'I think it was easier for him than talking about Will.',
              'And in the forest, we found someone else who had lost something.',
            ],
          },
          {
            kind: 'scene',
            locationId: 'forbiddenForest',
            cast: [valorArmed, fang, ren],
            lines: [
              { text: 'Before the light, Ren wakes her.' },
              { speaker: 'ren', text: 'Show me how you stand.' },
              { text: 'She stands. He moves her back foot without a word.' },
              { speaker: 'ren', text: 'The forest ahead is full of turned things. Some a blade cuts through. Some it doesn\'t.' },
              { speaker: 'ren', text: 'Learn which is which, and you live long enough to learn the rest.' },
            ],
            skipped: 'Ren began teaching Valor before dawn: which turned things a blade can cut, and which it can\'t.',
          },
          {
            kind: 'scene',
            locationId: 'forbiddenForest',
            cast: [valorArmed, fang, ren, solace],
            stage: { valor: { x: 18, depth: 0.8 }, fang: { x: 30, depth: 0.55 }, ren: { x: 40, depth: 0.7 }, solace: { x: 82, depth: 0.1, off: true } },
            lines: [
              { text: 'Light, through the trees. Someone is fighting.', moves: { solace: { off: false } } },
              { speaker: 'solace', mood: 'angry', text: 'Either help or get out of my way!' },
              { text: 'The turned things scatter from the glare of her hands.' },
              { speaker: 'solace', mood: 'sad', text: 'Solace. The chapel I kept is under the roots now.', moves: { solace: { x: 66, depth: 0.7 } } },
              { speaker: 'valor', mood: 'sad', text: 'Something took my brother. It went north.' },
              { speaker: 'solace', mood: 'angry', text: 'Then so do I. Whatever did this to my chapel, I want to see its face.' },
              { speaker: 'valor', text: "It doesn't have one." },
            ],
            skipped: 'In the forest they met Solace, a priest of the dawn whose chapel the turning swallowed. She came north with them.',
          },
          { kind: 'act', act: forestRoad },
          {
            kind: 'scene',
            locationId: 'forbiddenForest',
            cast: [valorArmed, fang, ren, solace],
            lines: [
              { speaker: 'valor', mood: 'sad', text: 'Every day we spend learning, Will is further away.' },
              { speaker: 'ren', mood: 'angry', text: 'Every day you don\'t, you\'d die before you reached him.' },
              { speaker: 'solace', mood: 'happy', text: 'There\'s a town east of the forest that hasn\'t fallen. Supplies. People who\'ve seen it.' },
              { text: 'Fang stays close to Valor all that night.' },
              { speaker: 'fang', mood: 'sad', text: 'Once, he lifts his head and howls toward the north.', sound: 'wolf.howl' },
            ],
            skipped: 'Valor wanted to hurry. Solace knew a town to the east that had not fallen yet.',
          },
          { kind: 'end', line: 'Four of them now, and a road east.' },
        ],
      },
    ],
  },
];
