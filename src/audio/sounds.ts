/**
 * The sound table. Every effect in the game is a few numbers here — pure
 * data over the shared voice vocabulary in synth.ts, the same way heroes,
 * moves and relics are pure data over the effect vocabulary. Adding a sound
 * means adding a row, never adding code.
 *
 * Tuning notes, so future edits don't undo deliberate choices:
 *
 *  - UI sounds are QUIET and SHORT (under ~120ms). They fire hundreds of
 *    times in a 45-minute run; anything with presence becomes fatiguing by
 *    act 2. They are meant to be felt more than heard.
 *  - Impacts are noise-led. A filtered noise burst is what reads as "weight";
 *    the tuned oscillator under it only supplies pitch, which is how the
 *    same sound can be re-pitched for a big hit vs a chip hit.
 *  - Nothing here encodes *when* it plays. Timing lives in the view layer
 *    (beatSfx.ts), never in the engine.
 */

import type { SoundSpec } from './synth';

export type SfxId =
  // UI
  | 'ui.tap'
  | 'ui.confirm'
  | 'ui.back'
  | 'ui.select'
  | 'ui.denied'
  | 'ui.page'
  // Combat
  | 'cast'
  | 'hit.physical'
  | 'hit.magical'
  | 'hit.crit'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'status'
  | 'detonate'
  | 'faint'
  | 'mana'
  | 'switchIn'
  | 'field';

export const sounds: Record<SfxId, SoundSpec> = {
  /**
   * The workhorse. Every tappable surface in the app gets this unless it
   * asks for something else, so it is deliberately the least interesting
   * sound in the table: a soft wooden click, gone in 45ms.
   */
  'ui.tap': {
    gain: 0.34,
    jitter: 0.04,
    voices: [
      { wave: 'triangle', freq: 420, freqEnd: 300, gain: 0.5, attack: 0.001, decay: 0.045 },
      // The noise layer is what makes it read as a physical click rather
      // than a musical note. Band-limited hard so it stays a "tk", not a "ts".
      { wave: 'noise', gain: 0.28, attack: 0.001, decay: 0.02, filter: { type: 'bandpass', freq: 1900, q: 1.2 } },
    ],
  },

  /** Committing to something: locking a move, confirming a choice. Rises. */
  'ui.confirm': {
    gain: 0.36,
    jitter: 0.02,
    voices: [
      { wave: 'triangle', freq: 520, freqEnd: 790, gain: 0.5, attack: 0.004, decay: 0.11 },
      { wave: 'sine', freq: 1040, freqEnd: 1580, gain: 0.16, attack: 0.004, decay: 0.09, delay: 0.01 },
    ],
  },

  /** Leaving/cancelling. The exact inverse contour of confirm, on purpose. */
  'ui.back': {
    gain: 0.3,
    jitter: 0.02,
    voices: [{ wave: 'triangle', freq: 500, freqEnd: 300, gain: 0.5, attack: 0.004, decay: 0.1 }],
  },

  /** Highlighting without committing — a target, a tab, a list row. */
  'ui.select': {
    gain: 0.75,
    jitter: 0.05,
    voices: [
      { wave: 'square', freq: 880, gain: 0.16, attack: 0.001, decay: 0.03, filter: { type: 'lowpass', freq: 2600, q: 0.7 } },
      { wave: 'noise', gain: 0.14, attack: 0.001, decay: 0.014, filter: { type: 'bandpass', freq: 3200, q: 2 } },
    ],
  },

  /**
   * Refusal: an unaffordable move, a locked option. Low and buzzing so it
   * is unmistakably negative without being loud — the player has usually
   * already worked out why, and doesn't need to be scolded.
   */
  'ui.denied': {
    gain: 0.3,
    voices: [
      { wave: 'square', freq: 165, freqEnd: 128, gain: 0.32, attack: 0.003, hold: 0.03, decay: 0.09, filter: { type: 'lowpass', freq: 900, q: 1 } },
    ],
  },

  /** Screen-to-screen movement. A short air whoosh, not a note. */
  'ui.page': {
    gain: 0.6,
    jitter: 0.05,
    voices: [{ wave: 'noise', gain: 0.5, attack: 0.05, decay: 0.2, filter: { type: 'bandpass', freq: 380, freqEnd: 2100, q: 0.9 } }],
  },

  /**
   * The "X uses Y" beat. Deliberately understated: it is immediately
   * followed by the impact, and two full sounds back to back turns every
   * exchange into mush. This is a wind-up, not an event — a short intake
   * of air that makes the hit land harder by contrast.
   */
  cast: {
    gain: 0.42,
    jitter: 0.04,
    voices: [
      { wave: 'noise', gain: 0.34, attack: 0.05, decay: 0.1, filter: { type: 'bandpass', freq: 900, freqEnd: 2000, q: 1.6 } },
      { wave: 'triangle', freq: 330, freqEnd: 420, gain: 0.16, attack: 0.03, decay: 0.1 },
    ],
  },

  /**
   * Attack/Defense damage: a body blow. Noise dropped hard through a
   * closing lowpass gives the "thud", and the sine under it is the weight.
   * Callers re-pitch this by damage (beatSfx.ts) — a chip hit comes in
   * bright and small, a heavy hit low and slow.
   */
  'hit.physical': {
    gain: 0.5,
    jitter: 0.07,
    voices: [
      { wave: 'noise', gain: 0.6, attack: 0.001, decay: 0.15, filter: { type: 'lowpass', freq: 1900, freqEnd: 260, q: 1.1 } },
      { wave: 'sine', freq: 170, freqEnd: 58, gain: 0.55, attack: 0.001, decay: 0.17 },
      // A tiny crack on top so the hit has an edge as well as a body.
      { wave: 'noise', gain: 0.2, attack: 0.001, decay: 0.035, filter: { type: 'highpass', freq: 2600 } },
    ],
  },

  /**
   * Intelligence/Wisdom damage: brighter, longer-tailed, and detuned so it
   * shimmers instead of thumping. The detune is doing most of the work —
   * it is what separates "magic" from "a hit with more treble".
   */
  'hit.magical': {
    gain: 0.44,
    jitter: 0.06,
    voices: [
      { wave: 'sawtooth', freq: 620, freqEnd: 190, detune: 26, gain: 0.32, attack: 0.002, decay: 0.3, filter: { type: 'lowpass', freq: 3200, freqEnd: 620, q: 2.2 } },
      { wave: 'sine', freq: 210, freqEnd: 84, gain: 0.34, attack: 0.002, decay: 0.2 },
      { wave: 'noise', gain: 0.16, attack: 0.004, decay: 0.22, filter: { type: 'bandpass', freq: 2600, freqEnd: 900, q: 1.4 } },
    ],
  },

  /**
   * Layered ON TOP of the base hit rather than replacing it, so a crit
   * sounds like the same attack landing harder — which is what it is.
   * The delayed crack is the important part: a beat of separation is what
   * makes it register as an event instead of a louder thud.
   */
  'hit.crit': {
    gain: 0.5,
    jitter: 0.04,
    voices: [
      { wave: 'square', freq: 1250, freqEnd: 380, gain: 0.2, attack: 0.001, decay: 0.09, filter: { type: 'lowpass', freq: 4200, freqEnd: 1200, q: 1 } },
      { wave: 'noise', gain: 0.42, attack: 0.001, decay: 0.1, delay: 0.035, filter: { type: 'highpass', freq: 1500 } },
      { wave: 'sine', freq: 96, freqEnd: 44, gain: 0.5, attack: 0.002, decay: 0.28, delay: 0.02 },
    ],
  },

  /** A rising major triad, soft-attacked. The only unambiguously kind sound. */
  heal: {
    gain: 0.38,
    jitter: 0.01,
    voices: [
      { wave: 'sine', freq: 523, gain: 0.34, attack: 0.02, decay: 0.42 },
      { wave: 'sine', freq: 659, gain: 0.3, attack: 0.02, decay: 0.4, delay: 0.06 },
      { wave: 'sine', freq: 784, gain: 0.26, attack: 0.02, decay: 0.46, delay: 0.12 },
    ],
  },

  /** Stat up. Same contour as ui.confirm an octave down, with body. */
  buff: {
    gain: 0.32,
    jitter: 0.02,
    voices: [
      { wave: 'triangle', freq: 300, freqEnd: 500, detune: 10, gain: 0.36, attack: 0.01, decay: 0.26 },
      { wave: 'sine', freq: 600, freqEnd: 1000, gain: 0.12, attack: 0.01, decay: 0.2, delay: 0.03 },
    ],
  },

  /** Stat down. The mirror of buff, with a wider detune so it sags. */
  debuff: {
    gain: 0.32,
    jitter: 0.02,
    voices: [
      { wave: 'triangle', freq: 420, freqEnd: 240, detune: 24, gain: 0.36, attack: 0.008, decay: 0.28, filter: { type: 'lowpass', freq: 1800, freqEnd: 700, q: 1 } },
    ],
  },

  /** A condition landing: a short sizzle with a dark note under it. */
  status: {
    gain: 0.55,
    jitter: 0.06,
    voices: [
      { wave: 'noise', gain: 0.34, attack: 0.006, decay: 0.24, filter: { type: 'bandpass', freq: 1500, freqEnd: 700, q: 3.5 } },
      { wave: 'triangle', freq: 260, freqEnd: 190, gain: 0.24, attack: 0.006, decay: 0.2 },
    ],
  },

  /** Conduct going off — a discharge, fast and electric. */
  detonate: {
    gain: 0.44,
    jitter: 0.05,
    voices: [
      { wave: 'sawtooth', freq: 940, freqEnd: 120, gain: 0.3, attack: 0.001, decay: 0.18, filter: { type: 'lowpass', freq: 5000, freqEnd: 800, q: 3 } },
      { wave: 'noise', gain: 0.4, attack: 0.001, decay: 0.11, filter: { type: 'highpass', freq: 1800 } },
      { wave: 'sine', freq: 130, freqEnd: 50, gain: 0.42, attack: 0.002, decay: 0.24 },
    ],
  },

  /**
   * A knockout. Long, falling, and closing — the pitch sweep is the whole
   * idea, and the lowpass shutting alongside it is what makes it read as
   * something going away rather than just going down.
   */
  faint: {
    gain: 0.42,
    jitter: 0.02,
    voices: [
      { wave: 'triangle', freq: 320, freqEnd: 62, detune: 16, gain: 0.42, attack: 0.006, decay: 0.6, filter: { type: 'lowpass', freq: 1600, freqEnd: 210, q: 1.2 } },
      { wave: 'noise', gain: 0.22, attack: 0.01, decay: 0.5, filter: { type: 'lowpass', freq: 900, freqEnd: 180, q: 0.8 } },
    ],
  },

  /** Mana returning: a small bell, high and clean, well out of the way. */
  mana: {
    gain: 0.26,
    jitter: 0.02,
    voices: [
      { wave: 'sine', freq: 880, gain: 0.24, attack: 0.004, decay: 0.44 },
      { wave: 'sine', freq: 1320, detune: 8, gain: 0.14, attack: 0.004, decay: 0.34, delay: 0.02 },
    ],
  },

  /** A hero arriving: an upward rush with a blip on the landing. */
  switchIn: {
    gain: 0.62,
    jitter: 0.04,
    voices: [
      { wave: 'noise', gain: 0.4, attack: 0.03, decay: 0.17, filter: { type: 'bandpass', freq: 420, freqEnd: 2400, q: 1.1 } },
      { wave: 'triangle', freq: 440, freqEnd: 660, gain: 0.24, attack: 0.006, decay: 0.13, delay: 0.11 },
    ],
  },

  /**
   * A Field Effect taking the battlefield. The only sound here allowed to
   * be big and slow — it marks a state change that rewrites every following
   * round, and it fires at most a handful of times a fight.
   */
  field: {
    gain: 0.4,
    jitter: 0.01,
    voices: [
      { wave: 'sawtooth', freq: 110, freqEnd: 232, detune: 22, gain: 0.3, attack: 0.12, decay: 0.8, filter: { type: 'lowpass', freq: 300, freqEnd: 2600, q: 2.4 } },
      { wave: 'noise', gain: 0.24, attack: 0.18, decay: 0.62, filter: { type: 'bandpass', freq: 600, freqEnd: 3000, q: 0.8 } },
      { wave: 'sine', freq: 660, freqEnd: 990, gain: 0.12, attack: 0.2, decay: 0.5, delay: 0.16 },
    ],
  },
};
