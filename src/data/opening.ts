// The opening's six cards (docs/the-sky.md §1): a line each over an ambient picture, played once
// on the first sky ahead of the tutorial.

export type OpeningPicture = 'fall' | 'sealed' | 'failing' | 'guardians' | 'eyes' | 'pact';

export interface OpeningCard {
  line: string;
  picture: OpeningPicture;
}

export const OPENING_CARDS: readonly OpeningCard[] = [
  { picture: 'fall', line: 'Long ago, something wicked fell from the stars.' },
  { picture: 'sealed', line: 'It could not be killed, only sealed away.' },
  { picture: 'failing', line: 'Now the seal is failing.' },
  { picture: 'guardians', line: 'Four Guardians must be felled to bind it again.' },
  { picture: 'eyes', line: 'If we fail, the Titan will destroy us all.' },
  { picture: 'pact', line: 'We must seal the Pact.' },
];
