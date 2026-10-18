// Stories as data (docs/stories.md). The prologue's lines are a DRAFT for the user to rewrite.

import type { StoryAct, StoryActor, StoryCommand, StoryDefinition, StoryFight } from '../run/story';
import { STORY_CAST_IDS as CAST } from './storyCast';

const valor: StoryActor = { id: 'valor', name: 'Valor', artHeroId: CAST.valor, stands: 'left' };
const fang: StoryActor = { id: 'fang', name: 'Fang', artHeroId: 'packAlpha', stands: 'left' };
const ren: StoryActor = { id: 'ren', name: 'Ren', artHeroId: CAST.ren, stands: 'right' };
const will: StoryActor = { id: 'will', name: 'Will', artHeroId: CAST.will, stands: 'right' };
const faceless: StoryActor = { id: 'faceless', name: '???', artHeroId: CAST.endbringer, stands: 'right' };
const risen: StoryActor = { id: 'risen', name: '???', artHeroId: 'heraldRisen', stands: 'right' };

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
    [{ actor: 'stag', moveId: 'ivySpike', target: ally('fang') }, { actor: 'fox', moveId: 'pounce', target: ally('valor') }],
    [{ actor: 'stag', moveId: 'ivySpike', target: ally('valor') }],
  ],
  guide: [
    [{ actor: 'valor', moveId: 'ironFist', target: foe('fox') }, { actor: 'fang', moveId: 'claw', target: foe('fox') }],
    [{ actor: 'valor', moveId: 'ironFist', target: foe('stag') }, { actor: 'fang', moveId: 'claw', target: foe('stag') }],
  ],
};

const reach: StoryCommand[] = [{ actor: 'faceless', moveId: 'erode' }];

// Chapter 2's Valor has the sword: the roster's own Valor, sprite and kit.
const valorArmed: StoryActor = { id: 'valor', name: 'Valor', artHeroId: 'valor', stands: 'left' };

const solace: StoryActor = { id: 'solace', name: 'Solace', artHeroId: 'dawnwarden', stands: 'right' };

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
      { type: 'skirmish', enemy: [{ rosterId: 'volt', heroId: 'voltail', level: 5 }, { rosterId: 'gear', heroId: 'gearhound', level: 5 }], drop: 'plate.rare' },
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
    [{ type: 'fight', enemy: [{ rosterId: 'cub', heroId: 'cubling', level: 6 }, { rosterId: 'sprout', heroId: 'sproutling', level: 6 }], drop: 'dagger.common.feral' }],
    [{ type: 'equipmentReward', items: ['greataxe.common', 'leathers.common.feral', 'shield.common'] }, { type: 'restReward' }, { type: 'passiveReward' }],
    [{ type: 'fight', enemy: [{ rosterId: 'rivet', heroId: 'rivetling', level: 8 }, { rosterId: 'cub', heroId: 'cubling', level: 8 }, { rosterId: 'sprout', heroId: 'sproutling', level: 7 }], drop: 'spear.common.tempered' }],
    [{ type: 'restReward' }, { type: 'equipmentReward', items: ['boots.common', 'plate.common', 'dagger.common.tempered'] }, { type: 'manaWellReward' }],
    [{ type: 'elite', enemy: [{ rosterId: 'ravager', heroId: 'ravager', level: 9 }, { rosterId: 'sprout', heroId: 'sproutling', level: 8 }, { rosterId: 'rivet', heroId: 'rivetling', level: 8 }], drop: 'sword.rare.tempered' }],
  ],
};

const theClearing: StoryFight = {
  id: 'valor-1-clearing',
  seed: 1702,
  player: [
    { rosterId: 'valor', heroId: CAST.valor, level: 3 },
    { rosterId: 'fang', heroId: 'packAlpha', level: 3 },
    { rosterId: 'ren', heroId: CAST.ren, level: 12 },
    { rosterId: 'will', heroId: CAST.will, level: 4 },
  ],
  playerLeads: ['valor', 'fang'],
  enemy: [{ rosterId: 'faceless', heroId: CAST.endbringer, level: 1 }],
  enemyLeads: ['faceless'],
  enemyScript: [reach, [{ actor: 'faceless', moveId: 'transfix', target: ally('fang') }], reach, reach],
  guide: [
    [{ actor: 'valor', moveId: 'ironFist', target: foe('faceless') }, { actor: 'fang', moveId: 'claw', target: foe('faceless') }],
    [{ actor: 'valor', switchTo: 'ren' }, { actor: 'fang', switchTo: 'will' }],
    [{ actor: 'ren', moveId: 'crescentCut', target: foe('faceless') }, { actor: 'will', moveId: 'thunderclap', target: foe('faceless') }],
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
    chapters: [
      {
        id: 'valor-1',
        title: 'The Fall',
        cycle: 1,
        beats: [
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valor, fang, ren, will],
            lines: [
              { speaker: 'ren', text: 'The tracks split at the ridge. Will, with me.' },
              { speaker: 'ren', text: 'Valor, you and Fang take the high path. If you see it, you whistle.' },
              { speaker: 'valor', text: 'And if it sees me first?' },
              { speaker: 'ren', text: 'Then you whistle louder.' },
              { speaker: 'will', text: "I'll bring you back a claw, Val." },
              { speaker: 'valor', text: "One month with a sword and he's a hunter." },
              { text: 'Fang presses into her hand until she laughs.' },
            ],
            skipped: 'The family split up to hunt. Valor and Fang took the high path.',
          },
          {
            kind: 'fight',
            fight: firstHunt,
            cast: [valor, fang],
            cues: [
              { round: 1, speaker: 'Valor', text: 'The fox first. Fang, with me!' },
              { round: 2, speaker: 'Valor', text: 'Now the stag.' },
            ],
          },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [ren, will, faceless],
            lines: [
              { speaker: 'will', text: 'Father. The birds have stopped.' },
              { speaker: 'ren', text: 'Behind me. Now.' },
              { text: 'Something stands in the clearing, taller than a man. Where its face should be, there is nothing.' },
              { speaker: 'will', text: 'What is that?' },
              { speaker: 'ren', text: "Walk backwards. Don't run until I say." },
            ],
            skipped: 'Ren and Will found something with no face in the clearing, and backed away.',
          },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valor, fang, ren, will, faceless],
            lines: [
              { speaker: 'will', text: "Val! It's following us!" },
              { speaker: 'ren', text: 'Take your brother and go. We do not fight that.' },
              { speaker: 'valor', text: 'You taught him to fight. Let me.' },
              { speaker: 'ren', text: 'Valor, no—' },
            ],
            skipped: 'Ren told Valor not to fight it. She did anyway.',
          },
          {
            kind: 'fight',
            fight: theClearing,
            cast: [valor, fang, ren, will],
            cues: [
              { round: 1, speaker: 'Valor', text: 'Hit it together!' },
              { round: 2, speaker: 'Ren', text: 'Fall back! Will, with me.' },
              { round: 3, speaker: 'Ren', text: 'Strike where I strike.' },
              { round: 4, speaker: 'Ren', text: 'Catch your breath. Will, now!' },
            ],
          },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valor, fang, ren, will, faceless],
            lines: [
              { speaker: 'valor', text: "It's down. Is it down?" },
              { speaker: 'will', text: "It isn't even bleeding." },
              { speaker: 'ren', text: 'Look up.' },
            ],
            skipped: 'They brought it to its knees. Then Ren looked up.',
          },
          { kind: 'fall', lines: ['Above them, the stars go out, one after another, in a line.', 'Something falls.'] },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valor, fang, ren, will, risen],
            lines: [
              { text: 'The ground shakes. The faceless thing stands, and it is taller now.' },
              { speaker: 'will', text: 'Val—!' },
              { text: 'It takes Will, and it is gone.' },
              { text: 'His sword lies in the grass.' },
              { speaker: 'ren', text: 'Pick it up.' },
              { speaker: 'ren', text: 'We run.' },
            ],
            skipped: 'The Titan fell. The faceless thing rose stronger, took Will, and was gone. Valor picked up his sword.',
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
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valorArmed, fang, ren],
            lines: [
              { text: 'Morning. The river runs black.' },
              { speaker: 'ren', text: 'It went north. So do we.' },
              { speaker: 'valor', text: 'Then teach me on the way. I have his sword now.' },
              { speaker: 'ren', text: "You have his sword. That isn't the same thing." },
              { text: 'Ren walks on ahead. Fang waits for her.' },
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
              { speaker: 'valor', text: 'It worked.' },
              { speaker: 'ren', text: "It won't, against that thing." },
              { text: 'He looks at the sword a long time.' },
              { speaker: 'ren', text: "Tomorrow, before the light. If you're carrying his sword, carry it properly." },
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
            lines: [
              { text: 'Light, through the trees. Someone is fighting.' },
              { speaker: 'solace', text: 'Either help or get out of my way!' },
              { text: 'The turned things scatter from the glare of her hands.' },
              { speaker: 'solace', text: 'Solace. The chapel I kept is under the roots now.' },
              { speaker: 'valor', text: 'Something took my brother. It went north.' },
              { speaker: 'solace', text: 'Then so do I. Whatever did this to my chapel, I want to see its face.' },
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
              { speaker: 'valor', text: 'Every day we spend learning, Will is further away.' },
              { speaker: 'ren', text: 'Every day you don\'t, you\'d die before you reached him.' },
              { speaker: 'solace', text: 'There\'s a town east of the forest that hasn\'t fallen. Supplies. People who\'ve seen it.' },
              { text: 'Fang stays close to Valor all that night.' },
            ],
            skipped: 'Valor wanted to hurry. Solace knew a town to the east that had not fallen yet.',
          },
          { kind: 'end', line: 'Four of them now, and a road east.' },
        ],
      },
    ],
  },
];
