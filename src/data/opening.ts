// The opening's six cards (docs/worlds.md §3.8): a line each over a storybook picture, played once
// on a fresh account ahead of the tutorial. Told by the trapped heroes.

export type OpeningPicture = 'world' | 'collector' | 'trapped' | 'guard' | 'lastPage' | 'free';

export interface OpeningCard {
  line: string;
  picture: OpeningPicture;
}

export const OPENING_CARDS: readonly OpeningCard[] = [
  { picture: 'world', line: 'We were heroes once, out in the wide world.' },
  { picture: 'collector', line: 'Then came the Inkmaster, who collects heroes.' },
  { picture: 'trapped', line: 'One stroke of his quill, and we were trapped on his pages.' },
  { picture: 'guard', line: 'He set a guard at the end of every chapter.' },
  { picture: 'lastPage', line: 'His story ends on the last page.' },
  { picture: 'free', line: 'Reach the last page, and we walk out of the story.' },
];
