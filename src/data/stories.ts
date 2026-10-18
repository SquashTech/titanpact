// Stories as data (docs/stories.md). DRAFT: the prologue's lines are a first pass for the user to
// rewrite, and Ren, Will and the wildlife stand in on existing heroes until their own art and kits land.

import type { StoryActor, StoryCommand, StoryDefinition, StoryFight } from '../run/story';
import { STORY_UNDYING_ID } from './passives';

const valor: StoryActor = { id: 'valor', name: 'Valor', artHeroId: 'valor', stands: 'left' };
const fang: StoryActor = { id: 'fang', name: 'Fang', artHeroId: 'packAlpha', stands: 'left' };
const ren: StoryActor = { id: 'ren', name: 'Ren', artHeroId: 'gallant', stands: 'right' };
const will: StoryActor = { id: 'will', name: 'Will', artHeroId: 'skyshear', stands: 'right' };
const endbringer: StoryActor = { id: 'endbringer', name: '???', artHeroId: 'endbringer', stands: 'right' };

const foe = (rosterId: string) => ({ side: 'B' as const, rosterId });
const ally = (rosterId: string) => ({ side: 'A' as const, rosterId });

const firstHunt: StoryFight = {
  id: 'valor-1-hunt',
  seed: 1701,
  player: [
    { rosterId: 'valor', heroId: 'valor', level: 2 },
    { rosterId: 'fang', heroId: 'packAlpha', level: 2 },
  ],
  playerLeads: ['valor', 'fang'],
  enemy: [
    { rosterId: 'stag', heroId: 'pixie', level: 1 },
    { rosterId: 'fox', heroId: 'kitsu', level: 1 },
  ],
  enemyLeads: ['stag', 'fox'],
  enemyScript: [
    [{ actor: 'stag', moveId: 'resonantBolt', target: ally('valor') }, { actor: 'fox', moveId: 'wisp', target: ally('fang') }],
    [{ actor: 'stag', moveId: 'resonantBolt', target: ally('fang') }, { actor: 'fox', moveId: 'wisp', target: ally('valor') }],
  ],
  guide: [
    [{ actor: 'valor', moveId: 'ironFist', target: foe('stag') }, { actor: 'fang', moveId: 'claw', target: foe('stag') }],
    [{ actor: 'valor', moveId: 'ironFist', target: foe('fox') }, { actor: 'fang', moveId: 'claw', target: foe('fox') }],
  ],
};

const endbringerHits: StoryCommand[] = [{ actor: 'endbringer', moveId: 'erode' }];

const theClearing: StoryFight = {
  id: 'valor-1-clearing',
  seed: 1702,
  player: [
    { rosterId: 'valor', heroId: 'valor', level: 3 },
    { rosterId: 'fang', heroId: 'packAlpha', level: 3 },
    { rosterId: 'ren', heroId: 'gallant', level: 8 },
    { rosterId: 'will', heroId: 'skyshear', level: 3 },
  ],
  playerLeads: ['valor', 'fang'],
  enemy: [{ rosterId: 'endbringer', heroId: 'endbringer', level: 1, passiveIds: [STORY_UNDYING_ID] }],
  enemyLeads: ['endbringer'],
  enemyScript: [endbringerHits, endbringerHits, endbringerHits],
  guide: [
    [{ actor: 'valor', moveId: 'ironFist', target: foe('endbringer') }, { actor: 'fang', moveId: 'claw', target: foe('endbringer') }],
    [{ actor: 'valor', switchTo: 'ren' }, { actor: 'fang', switchTo: 'will' }],
    [{ actor: 'ren', moveId: 'heavyBlow', target: foe('endbringer') }, { actor: 'will', moveId: 'jolt', target: foe('endbringer') }],
  ],
  endsWhen: [
    { kind: 'hpAtMost', side: 'B', rosterId: 'endbringer', hp: 1, winner: 'A' },
    { kind: 'afterRound', round: 3, winner: 'A' },
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
              { speaker: 'ren', text: 'Tracks split at the ridge. Will, with me. Valor, take Fang along the top.' },
              { speaker: 'valor', text: 'And if we find it first?' },
              { speaker: 'ren', text: "You whistle. You don't fight it." },
              { speaker: 'will', text: "Don't worry. I'll bring you back a claw." },
              { speaker: 'valor', text: "A month with a blade and he's a hunter." },
              { text: 'Fang leans into her hand.' },
            ],
            skipped: 'The family split up to hunt. Valor and Fang took the ridge.',
          },
          {
            kind: 'fight',
            fight: firstHunt,
            cast: [valor, fang],
            cues: [
              { round: 1, speaker: 'Valor', text: "Fang, go wide. I'll take the front." },
              { round: 2, speaker: 'Valor', text: 'The other one. Now!' },
            ],
          },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [ren, will, endbringer],
            lines: [
              { speaker: 'will', text: 'Father. The birds stopped.' },
              { speaker: 'ren', text: 'Stay behind me.' },
              { text: 'Something tall stands in the clearing. It has no face.' },
              { speaker: 'ren', text: 'Will. Walk backwards. Slowly.' },
            ],
            skipped: 'Ren and Will found something with no face in the clearing, and ran.',
          },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valor, fang, ren, will],
            lines: [
              { speaker: 'will', text: "It's following us!" },
              { speaker: 'ren', text: "Valor, take your brother and go. We don't fight that." },
              { speaker: 'valor', text: 'You taught him to fight. Let me.' },
              { speaker: 'ren', text: 'Valor—' },
            ],
            skipped: 'Ren told Valor not to fight it. She did anyway.',
          },
          {
            kind: 'fight',
            fight: theClearing,
            cast: [valor, fang, ren, will],
            cues: [
              { round: 1, speaker: 'Valor', text: 'Hit it together!' },
              { round: 2, speaker: 'Ren', text: 'Fall back. Let us in.' },
              { round: 3, speaker: 'Will', text: 'It isn’t even bleeding.' },
            ],
          },
          {
            kind: 'scene',
            locationId: 'wildsEdge',
            cast: [valor, fang, ren, will, endbringer],
            lines: [
              { text: 'The stars go out, one after another, in a line.' },
              { text: 'Something falls.' },
              { speaker: 'will', text: 'Valor!' },
              { text: 'The faceless thing stands taller than before. It takes Will, and is gone.' },
              { text: 'His sword lies in the grass.' },
              { speaker: 'ren', text: 'Pick it up. We run.' },
            ],
            skipped: 'The Titan fell. The faceless thing took Will. Valor picked up his sword.',
          },
          { kind: 'end', line: 'Valor had wanted a sword her whole life.' },
        ],
      },
    ],
  },
];
