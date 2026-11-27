// The toybox the sound table is played on: each builder returns the voices of one struck or blown thing.
// Wood, felt and paper, pitched bars, and a slide whistle — nothing rings like metal and nothing growls.

import type { VoiceSpec } from './synth';

/** A marimba bar: a warm fundamental, its 4th partial gone in a flash, a soft mallet click. */
export function marimba(freq: number, delay = 0, gain = 0.3, decay = 0.32): VoiceSpec[] {
  return [
    { wave: 'sine', freq, gain, attack: 0.002, decay, delay },
    { wave: 'sine', freq: freq * 4, gain: gain * 0.28, attack: 0.001, decay: 0.05, delay },
    { wave: 'noise', gain: gain * 0.5, attack: 0.001, decay: 0.012, delay, filter: { type: 'bandpass', freq: Math.min(freq * 2, 9000), q: 3 } },
  ];
}

/** A marimba bar with no click: for chord tones struck with another bar, and for soft rolls. */
export function bar(freq: number, delay = 0, gain = 0.3, decay = 0.32, attack = 0.002): VoiceSpec[] {
  return [
    { wave: 'sine', freq, gain, attack, decay, delay },
    { wave: 'sine', freq: freq * 4, gain: gain * 0.22, attack, decay: 0.05, delay },
  ];
}

/** A xylophone bar: brighter and drier than the marimba, tuned to its 3rd partial. */
export function xylo(freq: number, delay = 0, gain = 0.2, decay = 0.22): VoiceSpec[] {
  return [
    { wave: 'sine', freq, gain, attack: 0.001, decay, delay },
    { wave: 'sine', freq: freq * 3, gain: gain * 0.3, attack: 0.001, decay: decay * 0.3, delay },
    { wave: 'noise', gain: gain * 0.6, attack: 0.001, decay: 0.008, delay, filter: { type: 'bandpass', freq: Math.min(freq * 3, 9000), q: 3 } },
  ];
}

/** A wood block: a narrow band of noise at the block's mode, a pitch dropping a little under it. */
export function woodBlock(freq: number, delay = 0, gain = 0.5): VoiceSpec[] {
  return [
    { wave: 'noise', gain: gain * 2.2, attack: 0.001, decay: 0.035, delay, filter: { type: 'bandpass', freq, q: 9 } },
    { wave: 'sine', freq, freqEnd: freq * 0.86, gain, attack: 0.001, decay: 0.06, delay },
    { wave: 'triangle', freq: freq / 4, freqEnd: freq / 5, gain: gain * 0.5, attack: 0.001, decay: 0.05, delay },
  ];
}

/** A felt mallet on a drum: a sine dropping in pitch, the skin's noise under a closing lowpass. */
export function felt(freq: number, delay = 0, gain = 0.5, decay = 0.16): VoiceSpec[] {
  return [
    { wave: 'sine', freq, freqEnd: freq * 0.45, gain, attack: 0.001, decay, delay },
    { wave: 'noise', gain: gain * 0.8, attack: 0.001, decay: decay * 0.45, delay, filter: { type: 'lowpass', freq: freq * 7, freqEnd: freq * 1.5, q: 1 } },
  ];
}

/** A slide whistle: a pure tone gliding from one pitch to another. */
export function slide(from: number, to: number, delay = 0, gain = 0.2, length = 0.3, attack = 0.02): VoiceSpec[] {
  return [{ wave: 'sine', freq: from, freqEnd: to, sweep: 'lin', gain, attack, decay: length, delay }];
}

/** Air moving past: a band of noise swept from one centre to another. */
export function swish(from: number, to: number, delay = 0, gain = 0.3, length = 0.18, attack = 0.03): VoiceSpec[] {
  return [{ wave: 'noise', gain, attack, decay: length, delay, filter: { type: 'bandpass', freq: from, freqEnd: to, q: 1.1 } }];
}

/** A page turned: a hush across the leaf, then the soft tick of it settling. */
export function paper(delay = 0, gain = 0.3): VoiceSpec[] {
  return [
    { wave: 'noise', gain, attack: 0.02, decay: 0.09, delay, filter: { type: 'bandpass', freq: 3800, freqEnd: 1400, q: 0.7 } },
    { wave: 'noise', gain: gain * 2.4, attack: 0.001, decay: 0.02, delay: delay + 0.07, filter: { type: 'bandpass', freq: 1500, q: 5 } },
  ];
}

/** A shaker: seeds in a gourd, swelling and gone. */
export function shaker(delay = 0, gain = 0.12, length = 0.2, attack = 0.04): VoiceSpec[] {
  return [{ wave: 'noise', gain, attack, decay: length, delay, filter: { type: 'bandpass', freq: 6500, q: 1.6 } }];
}
