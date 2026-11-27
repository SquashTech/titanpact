// Two restyle directions for the key sounds, in the same SoundSpec vocabulary sounds.ts uses.
// A · Toybox: wood blocks, marimba, felt mallets. B · Bubblegum: pops, glockenspiel, plinks.

import type { SoundSpec, VoiceSpec } from '../../../src/audio/synth';

/** A marimba bar: warm fundamental, the 4th partial gone in a flash, a soft mallet click. */
function marimba(freq: number, delay = 0, gain = 0.3, decay = 0.32): VoiceSpec[] {
  return [
    { wave: 'sine', freq, gain, attack: 0.002, decay, delay },
    { wave: 'sine', freq: freq * 4, gain: gain * 0.28, attack: 0.001, decay: 0.05, delay },
    { wave: 'noise', gain: gain * 0.5, attack: 0.001, decay: 0.012, delay, filter: { type: 'bandpass', freq: freq * 2, q: 3 } },
  ];
}

/** A glockenspiel bar: bright, long, with the inharmonic 2.76 and 5.4 partials that make it a bar. */
function glock(freq: number, delay = 0, gain = 0.2, decay = 0.7): VoiceSpec[] {
  return [
    { wave: 'sine', freq, gain, attack: 0.001, decay, delay },
    { wave: 'sine', freq: freq * 2.76, gain: gain * 0.35, attack: 0.001, decay: decay * 0.35, delay },
    { wave: 'sine', freq: freq * 5.4, gain: gain * 0.15, attack: 0.001, decay: decay * 0.15, delay },
  ];
}

/** A rubbery pop: a sine flicking up an octave and a half in a few ms. */
function pop(from: number, to: number, delay = 0, gain = 0.4, decay = 0.06): VoiceSpec[] {
  return [
    { wave: 'sine', freq: from, freqEnd: to, gain, attack: 0.001, decay, delay },
    { wave: 'noise', gain: gain * 0.3, attack: 0.001, decay: 0.01, delay, filter: { type: 'bandpass', freq: to * 2, q: 2 } },
  ];
}

/** A wood block: a narrow band of noise at the block's mode, a pitch dropping a little under it. */
function woodBlock(freq: number, delay = 0, gain = 0.5): VoiceSpec[] {
  return [
    { wave: 'noise', gain: gain * 2.2, attack: 0.001, decay: 0.035, delay, filter: { type: 'bandpass', freq, q: 9 } },
    { wave: 'sine', freq, freqEnd: freq * 0.86, gain, attack: 0.001, decay: 0.06, delay },
    { wave: 'triangle', freq: freq / 4, freqEnd: freq / 5, gain: gain * 0.5, attack: 0.001, decay: 0.05, delay },
  ];
}

export interface Candidate {
  id: string;
  label: string;
  note: string;
  spec: SoundSpec;
}

export interface KeySound {
  id: 'hit.physical' | 'hit.crit' | 'heal' | 'ui.tap' | 'levelUp' | 'pact.bind' | 'map.boon';
  title: string;
  a: Candidate;
  b: Candidate;
}

export const KEY_SOUNDS: KeySound[] = [
  {
    id: 'ui.tap',
    title: 'Button tap',
    a: {
      id: 'a',
      label: 'A · Toybox',
      note: 'a small wood block, knuckle-soft',
      spec: { gain: 0.4, jitter: 0.04, voices: woodBlock(1180, 0, 0.42) },
    },
    b: {
      id: 'b',
      label: 'B · Bubblegum',
      note: 'a bubble pop',
      spec: { gain: 0.58, jitter: 0.05, voices: pop(520, 1250, 0, 0.42, 0.045) },
    },
  },
  {
    id: 'hit.physical',
    title: 'Hit',
    a: {
      id: 'a',
      label: 'A · Toybox',
      note: 'a felt mallet on a drum, then a wooden clack',
      spec: {
        gain: 0.68,
        jitter: 0.07,
        voices: [
          { wave: 'sine', freq: 210, freqEnd: 95, gain: 0.6, attack: 0.001, decay: 0.14 },
          { wave: 'noise', gain: 0.5, attack: 0.001, decay: 0.06, filter: { type: 'lowpass', freq: 1400, freqEnd: 300, q: 1 } },
          ...woodBlock(760, 0.004, 0.32),
        ],
      },
    },
    b: {
      id: 'b',
      label: 'B · Bubblegum',
      note: 'a cartoon bonk: a thump that springs back up',
      spec: {
        gain: 0.76,
        jitter: 0.07,
        voices: [
          { wave: 'sine', freq: 260, freqEnd: 90, gain: 0.58, attack: 0.001, decay: 0.09 },
          { wave: 'triangle', freq: 180, freqEnd: 420, gain: 0.3, attack: 0.002, decay: 0.12, delay: 0.035 },
          { wave: 'noise', gain: 0.35, attack: 0.001, decay: 0.03, filter: { type: 'bandpass', freq: 1600, q: 2.5 } },
        ],
      },
    },
  },
  {
    id: 'hit.crit',
    title: 'Crit (on top of the hit)',
    a: {
      id: 'a',
      label: 'A · Toybox',
      note: 'a slapstick crack and two marimba bars bouncing up',
      spec: {
        gain: 0.85,
        jitter: 0.03,
        voices: [
          { wave: 'noise', gain: 0.7, attack: 0.001, decay: 0.04, delay: 0.03, filter: { type: 'bandpass', freq: 2200, q: 4 } },
          ...marimba(784, 0.05, 0.28, 0.18),
          ...marimba(1175, 0.11, 0.3, 0.3),
        ],
      },
    },
    b: {
      id: 'b',
      label: 'B · Bubblegum',
      note: 'a bright pow and a glockenspiel sparkle',
      spec: {
        gain: 0.82,
        jitter: 0.03,
        voices: [
          ...pop(400, 1600, 0.03, 0.42, 0.07),
          ...glock(2093, 0.07, 0.16, 0.4),
          ...glock(2637, 0.11, 0.13, 0.45),
        ],
      },
    },
  },
  {
    id: 'heal',
    title: 'Heal',
    a: {
      id: 'a',
      label: 'A · Toybox',
      note: 'a marimba roll up a major triad',
      spec: {
        gain: 0.38,
        jitter: 0.01,
        voices: [...marimba(523, 0, 0.3), ...marimba(659, 0.07, 0.28), ...marimba(784, 0.14, 0.28), ...marimba(1047, 0.21, 0.26, 0.5)],
      },
    },
    b: {
      id: 'b',
      label: 'B · Bubblegum',
      note: 'glockenspiel twinkles over a soft swell',
      spec: {
        gain: 0.45,
        jitter: 0.01,
        voices: [
          { wave: 'sine', freq: 523, gain: 0.2, attack: 0.06, decay: 0.4 },
          ...glock(1568, 0.02, 0.17),
          ...glock(2093, 0.09, 0.15),
          ...glock(2637, 0.16, 0.13),
        ],
      },
    },
  },
  {
    id: 'levelUp',
    title: 'Level up',
    a: {
      id: 'a',
      label: 'A · Toybox',
      note: 'a marimba run, landing on a held chord',
      spec: {
        gain: 0.47,
        jitter: 0.004,
        voices: [
          ...marimba(587, 0, 0.28, 0.16),
          ...marimba(740, 0.08, 0.28, 0.16),
          ...marimba(880, 0.16, 0.28, 0.16),
          ...marimba(1175, 0.24, 0.32, 0.6),
          ...marimba(880, 0.24, 0.18, 0.6),
          ...marimba(294, 0.24, 0.3, 0.6),
        ],
      },
    },
    b: {
      id: 'b',
      label: 'B · Bubblegum',
      note: 'pops climbing to a glockenspiel chord',
      spec: {
        gain: 0.58,
        jitter: 0.004,
        voices: [
          ...pop(440, 880, 0, 0.3),
          ...pop(554, 1109, 0.08, 0.3),
          ...pop(659, 1319, 0.16, 0.3),
          ...glock(1760, 0.25, 0.2, 0.9),
          ...glock(2217, 0.25, 0.14, 0.9),
          { wave: 'sine', freq: 440, gain: 0.26, attack: 0.004, decay: 0.6, delay: 0.25 },
        ],
      },
    },
  },
  {
    id: 'pact.bind',
    title: 'Pact bind (a hero drafted)',
    a: {
      id: 'a',
      label: 'A · Toybox',
      note: 'a wooden clasp snapping shut, two bars answering',
      spec: {
        gain: 0.63,
        jitter: 0.008,
        voices: [...woodBlock(980, 0, 0.4), ...woodBlock(1320, 0.05, 0.3), ...marimba(659, 0.08, 0.26, 0.3), ...marimba(988, 0.14, 0.26, 0.42)],
      },
    },
    b: {
      id: 'b',
      label: 'B · Bubblegum',
      note: 'a sticker pressed on: a pop and a plink',
      spec: {
        gain: 0.94,
        jitter: 0.008,
        voices: [...pop(300, 760, 0, 0.42, 0.06), ...glock(1319, 0.06, 0.18, 0.5), ...glock(1976, 0.12, 0.14, 0.55)],
      },
    },
  },
  {
    id: 'map.boon',
    title: 'Map node land',
    a: {
      id: 'a',
      label: 'A · Toybox',
      note: 'a wooden game piece set down, a bar ringing a fifth',
      spec: {
        gain: 0.3,
        jitter: 0.015,
        voices: [...woodBlock(620, 0, 0.4), ...marimba(784, 0.03, 0.28, 0.3), ...marimba(1175, 0.08, 0.2, 0.36)],
      },
    },
    b: {
      id: 'b',
      label: 'B · Bubblegum',
      note: 'a bounce onto the tile and a two-note plink',
      spec: {
        gain: 0.39,
        jitter: 0.015,
        voices: [...pop(220, 560, 0, 0.36, 0.07), ...glock(1568, 0.04, 0.15, 0.45), ...glock(2349, 0.09, 0.11, 0.5)],
      },
    },
  },
];
