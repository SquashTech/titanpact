// The soundtrack, one chiptune song a place plus the fight themes. Pure data for chiptune.ts.
// One token a 16th-note step: a note or chord-tone digit starts, '-' holds, '.' rests. Bass tokens off
// the bar's chord: R root, r root an octave up, 3 third, 5 fifth, L the fifth an octave down.

import type { LeadWave } from './chipScore';

type Pattern = string | readonly string[];

export interface ChipSong {
  bpm: number;
  /** Fraction of a step the off-16ths land late. */
  swing?: number;
  gain?: number;
  /** Seconds; a fight theme arrives hard, a place drifts in. */
  fadeIn?: number;
  lead?: LeadWave;
  harmonyWave?: LeadWave;
  chords: readonly string[];
  melody: readonly string[];
  harmony?: readonly string[];
  arp?: Pattern;
  arpOctave?: number;
  bass: Pattern;
  bassOctave?: number;
  drums?: { kick: Pattern; snare: Pattern; hat: Pattern; fill?: { kick?: string; snare?: string; hat?: string }; fillEvery?: number };
}

const REST = '................';

const threshold: ChipSong = {
  bpm: 72,
  lead: 'triangle',
  chords: ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Eb', 'Ab', 'G'],
  melody: [
    'C5 - - - - - - - Eb5 - - - D5 - - -',
    'C5 - - - - - - - Ab4 - - - - - - -',
    'F5 - - - - - Ab5 - G5 - - - F5 - - -',
    'G5 - - - - - - - B4 - - - D5 - - -',
    'Eb5 - - - G5 - - - C6 - - - B5 - - -',
    'Bb5 - - - - - G5 - Eb5 - - - - - - -',
    'Ab5 - - - G5 - - - F5 - - - Eb5 - - -',
    'D5 - - - - - - - B4 - - - - - - -',
  ],
  arp: '0 . . . . . . . 1 . . . 2 . . .',
  arpOctave: 4,
  bass: 'R - - - - - - - - - - - - - - -',
  bassOctave: 1,
  drums: { kick: 'x...............', snare: REST, hat: REST },
};

const songTable = {
  titleScreen: {
    bpm: 100,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
    melody: [
      'G5 - - - C6 - - - E6 - - - D6 - C6 -',
      'B5 - - - - - - - G5 - - - D5 - - -',
      'A5 - - - C6 - - - E6 - - - D6 - C6 -',
      'C6 - - - - - - - A5 - - - F5 - - -',
      'E6 - - - D6 - C6 - G6 - - - E6 - - -',
      'D6 - - - B5 - - - G5 - - - B5 - D6 -',
      'C6 - - - A5 - - - F5 - A5 - C6 - F6 -',
      'E6 - - - D6 - - - - - - - . . . .',
    ],
    harmony: [
      'E5 - - - G5 - - - C6 - - - B5 - G5 -',
      'G5 - - - - - - - D5 - - - B4 - - -',
      'E5 - - - A5 - - - C6 - - - B5 - A5 -',
      'A5 - - - - - - - F5 - - - C5 - - -',
      'C6 - - - B5 - G5 - E6 - - - C6 - - -',
      'B5 - - - G5 - - - D5 - - - G5 - B5 -',
      'A5 - - - F5 - - - C5 - F5 - A5 - C6 -',
      'C6 - - - B5 - - - - - - - . . . .',
    ],
    bass: 'R - - - 5 - - - r - - - 5 - - -',
    drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x...x...x...x...' },
  },

  starterScreen: {
    bpm: 110,
    swing: 0.25,
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D'],
    melody: [
      'D5 - G5 - B5 - - - A5 - G5 - - - D5 -',
      'E5 - - - G5 - - - B5 - - - - - - -',
      'C6 - - - B5 - A5 - G5 - - - E5 - - -',
      'F#5 - - - - - - - A5 - - - D5 - - -',
      'G5 - B5 - D6 - - - C6 - B5 - - - G5 -',
      'B5 - - - - - G5 - E5 - - - G5 - - -',
      'A5 - C6 - E6 - - - D6 - C6 - B5 - A5 -',
      'F#5 - - - - - - - D5 - - - . . . .',
    ],
    arp: '. . 0 . . . 1 . . . 2 . . . 1 .',
    bass: 'R . . . 5 . . . R . . . 5 . . .',
    drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.' },
  },

  wildsEdge: {
    bpm: 118,
    chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'],
    melody: [
      'E5 - - - G5 - - - C6 - - - G5 - E5 -',
      'A5 - - - G5 - E5 - C5 - - - E5 - - -',
      'F5 - - - A5 - - - C6 - - - A5 - F5 -',
      'G5 - - - - - - - D5 - E5 - F5 - G5 -',
      'E5 - - - G5 - - - C6 - - - D6 - E6 -',
      'C6 - - - A5 - - - E5 - G5 - A5 - - -',
      'F5 - A5 - C6 - A5 - G5 - - - F5 - E5 -',
      'D5 - - - - - - - G5 - - - . . . .',
    ],
    arp: '. . 0 . . . 1 . . . 2 . . . 1 .',
    bass: 'R . r . R . r . R . r . 5 . r .',
    drums: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  },

  blightedShrine: {
    bpm: 84,
    lead: 'pulse25',
    chords: ['Em', 'C', 'Am', 'B', 'Em', 'C', 'B', 'Em'],
    melody: [
      'E5 - - - - - G5 - F#5 - - - E5 - - -',
      'G5 - - - - - E5 - C5 - - - - - - -',
      'A4 - - - C5 - E5 - A5 - - - G5 - E5 -',
      'F#5 - - - - - - - D#5 - - - B4 - - -',
      'E5 - - - B5 - - - A5 - G5 - F#5 - E5 -',
      'G5 - - - - - - - E5 - - - G5 - C6 -',
      'B5 - - - A5 - - - F#5 - - - D#5 - - -',
      'E5 - - - - - - - - - - - . . . .',
    ],
    arp: '0 . . . 1 . . . 2 . . . 1 . . .',
    bass: 'R - - - - - - - R - - - 5 - - -',
    drums: { kick: 'x.......x.......', snare: REST, hat: '....x.......x...' },
  },

  forbiddenForest: {
    bpm: 104,
    swing: 0.2,
    chords: ['Am', 'D', 'Am', 'D', 'C', 'G', 'F', 'E'],
    melody: [
      'A4 - C5 - E5 - - - F#5 - E5 - - - C5 -',
      'D5 - - - F#5 - - - A5 - - - F#5 - D5 -',
      'E5 - - - A5 - - - G5 - E5 - D5 - C5 -',
      'D5 - - - - - - - . . A4 - B4 - C5 -',
      'E5 - - - G5 - - - C6 - - - B5 - A5 -',
      'B5 - - - D6 - - - B5 - - - G5 - - -',
      'A5 - - - C6 - A5 - F5 - - - A5 - C6 -',
      'B5 - - - - - - - G#5 - - - E5 - - -',
    ],
    arp: '0 . 1 . 2 . 1 . 0 . 1 . 2 . 1 .',
    bass: 'R . . R . . 5 . R . . R . . 5 .',
    drums: { kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x...x...x...x...' },
  },

  moltenFoundry: {
    bpm: 132,
    chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A'],
    melody: [
      'D5 - . D5 F5 - . D5 A5 - G5 - F5 - E5 -',
      'D5 - . D5 F5 - . D5 C6 - A5 - - - - -',
      'D6 - . D6 C6 - Bb5 - A5 - - - F5 - - -',
      'G5 - - - E5 - - - C5 - D5 - E5 - G5 -',
      'D5 - . D5 F5 - . D5 A5 - G5 - F5 - E5 -',
      'F5 - . F5 A5 - . F5 D6 - C6 - A5 - - -',
      'Bb5 - A5 - G5 - F5 - G5 - - - F5 - - -',
      'E5 - - - C#5 - - - A4 - - - . . . .',
    ],
    bass: 'R . R . r . R . R . R . r . 5 .',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' },
  },

  stormCoast: {
    bpm: 112,
    chords: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'F#'],
    melody: [
      'B4 - - - D5 - - - F#5 - - - - - E5 -',
      'D5 - - - B4 - - - G4 - - - B4 - D5 -',
      'F#5 - - - A5 - - - D6 - - - C#6 - A5 -',
      'E5 - - - - - - - . . C#5 - D5 - E5 -',
      'F#5 - - - B5 - - - A5 - F#5 - D5 - F#5 -',
      'G5 - - - B5 - - - D6 - - - B5 - G5 -',
      'E5 - - - G5 - - - B5 - A5 - G5 - E5 -',
      'F#5 - - - - - - - A#4 - - - C#5 - - -',
    ],
    arp: '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1',
    bass: 'R - - . R - 5 - R - - . r - 5 -',
    drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  },

  necropolis: {
    bpm: 92,
    swing: 0.28,
    chords: ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'E', 'Am'],
    melody: [
      'A4 - - - C5 - E5 - . . E5 - D5 - C5 -',
      'C5 - - - A4 - - - . . F4 - A4 - - -',
      'D5 - - - F5 - A5 - . . G5 - F5 - E5 -',
      'E5 - - - - - - - G#4 - B4 - D5 - - -',
      'A5 - - - E5 - C5 - . . E5 - A5 - - -',
      'C6 - - - A5 - F5 - . . A5 - C6 - - -',
      'B5 - - - G#5 - E5 - D5 - C5 - B4 - - -',
      'A4 - - - - - - - . . . . . . . .',
    ],
    arp: '0 . 1 . 2 . 1 . 0 . 1 . 2 . 1 .',
    bass: 'R - . . 5 . . . R - . . 5 . . .',
    drums: { kick: 'x.......x.......', snare: '........x.......', hat: '....x.......x.x.' },
  },

  holySanctum: {
    bpm: 80,
    lead: 'pulse25',
    harmonyWave: 'triangle',
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'Am', 'Bb', 'C'],
    melody: [
      'A5 - - - - - - - C6 - - - A5 - - -',
      'G5 - - - - - - - E5 - - - C5 - - -',
      'F5 - - - A5 - - - D6 - - - C6 - - -',
      'Bb5 - - - - - - - A5 - - - G5 - - -',
      'A5 - - - C6 - - - F6 - - - E6 - - -',
      'E6 - - - - - - - C6 - - - A5 - - -',
      'D6 - - - C6 - - - Bb5 - - - A5 - - -',
      'G5 - - - - - - - - - - - . . . .',
    ],
    harmony: [
      'F5 - - - - - - - A5 - - - F5 - - -',
      'E5 - - - - - - - C5 - - - G4 - - -',
      'D5 - - - F5 - - - A5 - - - A5 - - -',
      'F5 - - - - - - - F5 - - - E5 - - -',
      'F5 - - - A5 - - - C6 - - - C6 - - -',
      'C6 - - - - - - - A5 - - - E5 - - -',
      'Bb5 - - - A5 - - - F5 - - - F5 - - -',
      'E5 - - - - - - - - - - - . . . .',
    ],
    arp: '0 . . . 1 . . . 2 . . . 3 . . .',
    arpOctave: 5,
    bass: 'R - - - - - - - 5 - - - - - - -',
  },

  dreamingSpires: {
    bpm: 96,
    swing: 0.15,
    lead: 'pulse12',
    chords: ['Eb', 'F', 'Eb', 'F', 'Cm', 'Ab', 'Bb', 'Bb'],
    melody: [
      'G5 - - - Bb5 - - - D6 - - - - - C6 -',
      'A5 - - - - - - - F5 - - - C5 - - -',
      'Eb5 - G5 - Bb5 - - - G6 - - - F6 - Eb6 -',
      'F6 - - - - - - - C6 - - - A5 - - -',
      'G5 - - - C6 - - - Eb6 - - - D6 - C6 -',
      'C6 - - - - - - - Ab5 - - - Eb5 - - -',
      'D6 - - - C6 - - - Bb5 - - - F5 - - -',
      'Bb5 - - - - - - - - - - - . . . .',
    ],
    arp: '0 1 2 3 2 1 0 1 2 3 2 1 0 1 2 1',
    arpOctave: 5,
    bass: 'R - - - - - 5 - - - - - R - - -',
    drums: { kick: 'x...............', snare: REST, hat: '....x.......x...' },
  },

  thunderAerie: {
    bpm: 140,
    chords: ['Gm', 'Eb', 'F', 'D', 'Gm', 'Eb', 'Cm', 'D'],
    melody: [
      'G5 - - - D5 - G5 - A5 - Bb5 - - - A5 -',
      'G5 - - - Eb5 - - - Bb4 - - - Eb5 - G5 -',
      'F5 - - - A5 - - - C6 - - - A5 - F5 -',
      'D5 - - - - - - - F#5 - - - A5 - - -',
      'Bb5 - - - A5 - G5 - D6 - - - C6 - Bb5 -',
      'G5 - - - Bb5 - - - Eb6 - - - D6 - C6 -',
      'C6 - - - Bb5 - A5 - G5 - - - Eb5 - - -',
      'D5 - - - F#5 - - - A5 - - - D6 - - -',
    ],
    bass: 'R . R R R . R R R . R R r . 5 .',
    drums: {
      kick: 'x.....x.x.......',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      fill: { snare: '....x.......xxxx' },
      fillEvery: 4,
    },
  },

  frozenReach: {
    bpm: 104,
    lead: 'pulse25',
    chords: ['D', 'Bm', 'G', 'A', 'D', 'F#m', 'G', 'A'],
    melody: [
      'F#5 - - - - - A5 - - - D6 - - - - -',
      'C#6 - - - B5 - - - F#5 - - - - - - -',
      'G5 - - - B5 - - - D6 - - - E6 - - -',
      'C#6 - - - - - - - . . . . A5 - - -',
      'F#6 - - - E6 - - - D6 - - - A5 - - -',
      'C#6 - - - A5 - - - F#5 - - - A5 - - -',
      'B5 - - - D6 - - - G6 - - - F#6 - E6 -',
      'E6 - - - - - - - - - - - . . . .',
    ],
    arp: '0 1 2 3 4 5 4 3 2 1 0 1 2 3 4 3',
    arpOctave: 5,
    bass: 'R - - - - - - - 5 - - - - - - -',
    drums: { kick: 'x...............', snare: REST, hat: '..x...x...x...x.' },
  },

  theThreshold: threshold,

  /** Every ordinary fight. */
  battle: {
    bpm: 150,
    fadeIn: 0.25,
    chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E', 'Dm', 'G', 'C', 'Am', 'Dm', 'E', 'Am', 'E'],
    melody: [
      'A4 - . A4 C5 - E5 - A5 - - - G5 - E5 -',
      'C5 - . C5 E5 - A5 - B5 - - - A5 - G5 -',
      'A5 - - - G5 - F5 - C5 - - - F5 - A5 -',
      'B5 - - - A5 - G5 - D5 - - - G5 - B5 -',
      'C6 - - - B5 - A5 - E5 - - - A5 - C6 -',
      'E6 - - - D6 - C6 - B5 - A5 - G5 - A5 -',
      'F5 - - - A5 - C6 - F6 - - - E6 - C6 -',
      'B5 - - - G#5 - - - E5 - - - . . . .',
      'D6 - - - - - - - A5 - - - F5 - A5 -',
      'B5 - - - - - - - G5 - - - D5 - G5 -',
      'C6 - - - E6 - - - G6 - - - E6 - C6 -',
      'A5 - - - - - - - E5 - - - A5 - C6 -',
      'F6 - - - E6 - D6 - A5 - - - D6 - F6 -',
      'E6 - - - D6 - B5 - G#5 - - - B5 - D6 -',
      'C6 - B5 - A5 - E5 - A5 - C6 - E6 - A5 -',
      'G#5 - - - - - - - E5 - - - . . . .',
    ],
    arp: '0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1',
    bass: 'R . r . R . r . R . r . R . r .',
    drums: {
      kick: 'x.....x.x.......',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      fill: { snare: '....x.......xxxx' },
      fillEvery: 8,
    },
  },

  /** The act's Guardian. */
  boss: {
    bpm: 138,
    fadeIn: 0.25,
    chords: ['Em', 'F', 'Em', 'F', 'Em', 'F', 'G', 'F', 'Am', 'Em', 'Am', 'B', 'C', 'B', 'Am', 'B'],
    melody: [
      'E5 - - - - - - - G5 - F5 - E5 - - -',
      'F5 - - - - - - - A5 - G5 - F5 - - -',
      'E5 - G5 - B5 - - - E6 - - - D6 - B5 -',
      'C6 - - - - - - - A5 - - - F5 - - -',
      'B5 - - - - - G5 - E5 - - - G5 - B5 -',
      'C6 - - - - - A5 - F5 - - - A5 - C6 -',
      'D6 - - - B5 - - - G5 - - - D6 - - -',
      'C6 - - - - - - - - - - - . . . .',
      'A5 - - - C6 - - - E6 - - - D6 - C6 -',
      'B5 - - - - - - - G5 - - - E5 - - -',
      'C6 - - - E6 - - - A6 - - - G6 - E6 -',
      'F#6 - - - - - - - D#6 - - - B5 - - -',
      'E6 - - - G6 - - - E6 - - - C6 - - -',
      'D#6 - - - F#6 - - - D#6 - - - B5 - - -',
      'C6 - - - B5 - A5 - G5 - F#5 - E5 - D#5 -',
      'E5 - - - - - - - . . . . . . . .',
    ],
    arp: '0 . . 0 . . 1 . . 1 . . 2 . 1 .',
    arpOctave: 3,
    bass: 'R . R . R R . R R . R . r . R .',
    drums: {
      kick: 'x.x...x.x.x...x.',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      fill: { snare: '....x...x.x.xxxx' },
      fillEvery: 8,
    },
  },

  /** The Herald and the Eyes. */
  finale: {
    bpm: 144,
    fadeIn: 0.25,
    harmonyWave: 'pulse25',
    chords: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Bb', 'G', 'Fm', 'Cm', 'Ab', 'Eb', 'Fm', 'Cm', 'G', 'G'],
    melody: [
      'C5 - - - G5 - - - C6 - - - Bb5 - G5 -',
      'Ab5 - - - - - - - Eb5 - - - C5 - Eb5 -',
      'D5 - - - F5 - - - Bb5 - - - Ab5 - F5 -',
      'G5 - - - - - - - B4 - - - D5 - G5 -',
      'Eb6 - - - D6 - C6 - G5 - - - C6 - Eb6 -',
      'C6 - - - Ab5 - - - Eb5 - - - Ab5 - C6 -',
      'D6 - - - Bb5 - - - F5 - - - Bb5 - D6 -',
      'B5 - - - - - - - G5 - - - . . . .',
      'F5 - - - Ab5 - - - C6 - - - F6 - - -',
      'Eb6 - - - - - - - C6 - - - G5 - - -',
      'Ab5 - - - C6 - - - Eb6 - - - Ab6 - - -',
      'G6 - - - - - - - Eb6 - - - Bb5 - - -',
      'Ab6 - - - G6 - F6 - C6 - - - F6 - Ab6 -',
      'G6 - - - Eb6 - C6 - G5 - - - C6 - Eb6 -',
      'D6 - - - B5 - - - G5 - - - B5 - D6 -',
      'G6 - - - F6 - Eb6 - D6 - - - B5 - - -',
    ],
    harmony: [
      REST.split('').join(' '),
      REST.split('').join(' '),
      REST.split('').join(' '),
      REST.split('').join(' '),
      'C6 - - - Bb5 - Ab5 - Eb5 - - - Ab5 - C6 -',
      'Ab5 - - - Eb5 - - - C5 - - - Eb5 - Ab5 -',
      'Bb5 - - - F5 - - - D5 - - - F5 - Bb5 -',
      'G5 - - - - - - - D5 - - - . . . .',
      'C5 - - - F5 - - - Ab5 - - - C6 - - -',
      'C6 - - - - - - - G5 - - - Eb5 - - -',
      'Eb5 - - - Ab5 - - - C6 - - - Eb6 - - -',
      'Eb6 - - - - - - - Bb5 - - - G5 - - -',
      'F6 - - - Eb6 - C6 - Ab5 - - - C6 - F6 -',
      'Eb6 - - - C6 - G5 - Eb5 - - - G5 - C6 -',
      'B5 - - - G5 - - - D5 - - - G5 - B5 -',
      'D6 - - - C6 - B5 - G5 - - - D5 - - -',
    ],
    bass: 'R . R . r . R . R . R . r . R .',
    drums: {
      kick: 'x...x...x...x...',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      fill: { snare: '....x...xxxxxxxx' },
      fillEvery: 8,
    },
  },
} satisfies Record<string, ChipSong>;

export type SongId = keyof typeof songTable;

export const chipSongs: Record<SongId, ChipSong> = songTable;

export const FIGHT_SONGS = ['battle', 'boss', 'finale'] as const satisfies readonly SongId[];
