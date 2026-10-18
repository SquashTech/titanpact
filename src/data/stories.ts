// Stories as data (docs/stories.md). The prologue's lines are a DRAFT for the user to rewrite.

import type { StoryActor, StoryCommand, StoryDefinition, StoryFight } from '../run/story';
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
              { text: 'Above them, the stars go out, one after another, in a line.' },
              { text: 'Something falls.' },
            ],
            skipped: 'They brought it to its knees. Then the stars began to go out.',
          },
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
    ],
  },
];
