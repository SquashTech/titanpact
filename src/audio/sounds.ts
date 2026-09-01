// The sound table — pure data over the voice vocabulary in synth.ts; adding a sound is adding a row.
// Timing lives in the view layer (beatSfx.ts), never here.
// UI sounds stay quiet and under ~120ms: they fire hundreds of times a run and anything with presence fatigues.
// Impacts are noise-led: the filtered noise burst is the weight; the oscillator under it only supplies pitch, which is what lets beatSfx.ts re-pitch one hit for chip vs heavy.

import type { SoundSpec } from './synth';

export type SfxId =
  // UI
  | 'ui.tap'
  | 'ui.confirm'
  | 'ui.back'
  | 'ui.select'
  | 'ui.denied'
  | 'ui.page'
  | 'ui.commit'
  | 'ui.launch'
  // Run
  | 'levelUp'
  | 'pact.bind'
  | 'equip'
  | 'contract.sign'
  | 'shrine'
  | 'blessing'
  | 'class.learn'
  | 'cache.open'
  | 'xp.orb'
  | 'discovery'
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
  | 'field'
  | 'entrance.dread';

export const sounds: Record<SfxId, SoundSpec> = {
  /** The default for every tappable surface: a soft wooden click, gone in 45ms. */
  'ui.tap': {
    gain: 0.34,
    jitter: 0.04,
    voices: [
      { wave: 'triangle', freq: 420, freqEnd: 300, gain: 0.5, attack: 0.001, decay: 0.045 },
      // Noise band-limited hard so it reads as a click ("tk"), not a hiss.
      { wave: 'noise', gain: 0.28, attack: 0.001, decay: 0.02, filter: { type: 'bandpass', freq: 1900, q: 1.2 } },
    ],
  },

  /** Committing (lock a move, confirm a choice). Rises. */
  'ui.confirm': {
    gain: 0.36,
    jitter: 0.02,
    voices: [
      { wave: 'triangle', freq: 520, freqEnd: 790, gain: 0.5, attack: 0.004, decay: 0.11 },
      { wave: 'sine', freq: 1040, freqEnd: 1580, gain: 0.16, attack: 0.004, decay: 0.09, delay: 0.01 },
    ],
  },

  /** Cancel — the inverse contour of confirm. */
  'ui.back': {
    gain: 0.3,
    jitter: 0.02,
    voices: [{ wave: 'triangle', freq: 500, freqEnd: 300, gain: 0.5, attack: 0.004, decay: 0.1 }],
  },

  /** Highlighting without committing. */
  'ui.select': {
    gain: 0.75,
    jitter: 0.05,
    voices: [
      { wave: 'square', freq: 880, gain: 0.16, attack: 0.001, decay: 0.03, filter: { type: 'lowpass', freq: 2600, q: 0.7 } },
      { wave: 'noise', gain: 0.14, attack: 0.001, decay: 0.014, filter: { type: 'bandpass', freq: 3200, q: 2 } },
    ],
  },

  /** Refusal — low and buzzing, deliberately not loud. */
  'ui.denied': {
    gain: 0.3,
    voices: [
      { wave: 'square', freq: 165, freqEnd: 128, gain: 0.32, attack: 0.003, hold: 0.03, decay: 0.09, filter: { type: 'lowpass', freq: 900, q: 1 } },
    ],
  },

  /** Screen-to-screen whoosh, not a note. */
  'ui.page': {
    gain: 0.6,
    jitter: 0.05,
    voices: [{ wave: 'noise', gain: 0.5, attack: 0.05, decay: 0.2, filter: { type: 'bandpass', freq: 380, freqEnd: 2100, q: 0.9 } }],
  },

  /** The big commitment (draft seal, Mentor class, Evolution). Breaks the quiet-UI rule on purpose — fires ~a dozen times a run. ui.confirm's rise as a C-major arpeggio over a bass fifth. */
  'ui.commit': {
    gain: 0.42,
    jitter: 0.01,
    voices: [
      // Bass fifth under the rise — without it the arpeggio sounds thin and chimey.
      { wave: 'triangle', freq: 196, freqEnd: 262, detune: 8, gain: 0.34, attack: 0.006, hold: 0.06, decay: 0.5 },
      { wave: 'sine', freq: 523, gain: 0.3, attack: 0.004, decay: 0.22 },
      { wave: 'sine', freq: 784, gain: 0.26, attack: 0.004, decay: 0.24, delay: 0.075 },
      { wave: 'sine', freq: 1046, gain: 0.22, attack: 0.004, decay: 0.5, delay: 0.15 },
      // Detuned octave shimmer, held past the gesture.
      { wave: 'triangle', freq: 1568, detune: 14, gain: 0.1, attack: 0.02, decay: 0.55, delay: 0.16 },
      // Slow-attacked air swelling into the landing.
      { wave: 'noise', gain: 0.16, attack: 0.09, decay: 0.34, filter: { type: 'bandpass', freq: 700, freqEnd: 3600, q: 0.9 } },
    ],
  },

  /**
   * "Start a Run" only — the loudest, longest UI sound. A gate opening: slam, sub drop, then a struck bronze fifth.
   * The 90ms gap before the bell is deliberate — slam and ring blur into one mid-sized noise otherwise.
   * Timed against TitleScreen's LAUNCH_ANIM_MS (slam = shockwave, bell = white-out).
   */
  'ui.launch': {
    gain: 0.5,
    jitter: 0.006,
    voices: [
      { wave: 'noise', gain: 0.5, attack: 0.001, decay: 0.26, filter: { type: 'lowpass', freq: 2600, freqEnd: 180, q: 1.2 } },
      { wave: 'sine', freq: 132, freqEnd: 42, gain: 0.6, attack: 0.002, hold: 0.03, decay: 0.42 },
      { wave: 'triangle', freq: 88, freqEnd: 58, detune: 12, gain: 0.34, attack: 0.004, hold: 0.05, decay: 0.6 },
      // A fifth, not a triad: two notes ring as a bell, three as music.
      { wave: 'triangle', freq: 294, detune: 10, gain: 0.24, attack: 0.004, hold: 0.04, decay: 0.9, delay: 0.09 },
      { wave: 'sine', freq: 441, gain: 0.2, attack: 0.006, decay: 0.85, delay: 0.1 },
      { wave: 'sine', freq: 882, detune: 16, gain: 0.09, attack: 0.01, decay: 0.8, delay: 0.11 },
      { wave: 'noise', gain: 0.2, attack: 0.16, decay: 0.55, filter: { type: 'bandpass', freq: 400, freqEnd: 4200, q: 0.8 } },
    ],
  },

  /**
   * Level gained: four-note fanfare in D. Fired when the level lands (LevelUpScreen's LEVEL_UP_ANIM_MS); kept under 1s because four can play in a row.
   * `jitter` near-zero on purpose: it transposes the whole tune, and a fanfare in a different key each time reads as sloppy.
   */
  levelUp: {
    gain: 0.4,
    jitter: 0.004,
    voices: [
      { wave: 'triangle', freq: 587, gain: 0.26, attack: 0.003, hold: 0.02, decay: 0.1 },
      { wave: 'triangle', freq: 740, gain: 0.26, attack: 0.003, hold: 0.02, decay: 0.1, delay: 0.085 },
      { wave: 'triangle', freq: 880, gain: 0.26, attack: 0.003, hold: 0.02, decay: 0.1, delay: 0.17 },
      { wave: 'triangle', freq: 1175, detune: 10, gain: 0.3, attack: 0.004, hold: 0.07, decay: 0.55, delay: 0.255 },
      // Bell two octaves over the landing note.
      { wave: 'sine', freq: 2349, gain: 0.1, attack: 0.004, decay: 0.6, delay: 0.26 },
      // Root held back to the last note so the first three stay light.
      { wave: 'sine', freq: 293, gain: 0.34, attack: 0.006, decay: 0.6, delay: 0.25 },
      { wave: 'noise', gain: 0.1, attack: 0.12, decay: 0.3, filter: { type: 'bandpass', freq: 1800, freqEnd: 5200, q: 1.4 } },
    ],
  },

  /** Starter bound in the draft: half a ui.commit (two notes, short tail — the pact seal must outsize it) plus a highpassed "clasp" crack just past the attack. */
  'pact.bind': {
    gain: 0.42,
    jitter: 0.008,
    voices: [
      { wave: 'triangle', freq: 330, freqEnd: 494, detune: 8, gain: 0.32, attack: 0.005, hold: 0.03, decay: 0.34 },
      { wave: 'sine', freq: 988, gain: 0.16, attack: 0.006, decay: 0.42, delay: 0.05 },
      // The clasp.
      { wave: 'noise', gain: 0.26, attack: 0.001, decay: 0.05, delay: 0.03, filter: { type: 'highpass', freq: 2400 } },
      { wave: 'sine', freq: 165, gain: 0.28, attack: 0.004, decay: 0.3 },
    ],
  },

  /** Equipment seating (ForceEquipScreen): purely mechanical — buckle crack, a second crack at 60ms (the latch seating), metal ring-off. */
  equip: {
    gain: 0.46,
    jitter: 0.05,
    voices: [
      { wave: 'noise', gain: 0.4, attack: 0.001, decay: 0.055, filter: { type: 'bandpass', freq: 2700, q: 1.6 } },
      { wave: 'noise', gain: 0.22, attack: 0.001, decay: 0.04, delay: 0.06, filter: { type: 'highpass', freq: 3400 } },
      { wave: 'triangle', freq: 196, freqEnd: 147, gain: 0.34, attack: 0.002, decay: 0.19 },
      { wave: 'sine', freq: 1568, detune: 22, gain: 0.08, attack: 0.003, decay: 0.34, delay: 0.02 },
    ],
  },

  /** Recruit Contract signing: parchment, stamp at 70ms, then one held tone. The order is the gesture. */
  'contract.sign': {
    gain: 0.44,
    jitter: 0.02,
    voices: [
      { wave: 'noise', gain: 0.16, attack: 0.02, decay: 0.13, filter: { type: 'bandpass', freq: 3400, freqEnd: 1800, q: 0.9 } },
      // Stamp: lowpassed so it reads as pressed, not struck.
      { wave: 'noise', gain: 0.36, attack: 0.002, decay: 0.16, delay: 0.07, filter: { type: 'lowpass', freq: 1400, freqEnd: 240, q: 1 } },
      { wave: 'sine', freq: 146, freqEnd: 73, gain: 0.44, attack: 0.003, hold: 0.02, decay: 0.3, delay: 0.07 },
      { wave: 'triangle', freq: 392, detune: 9, gain: 0.24, attack: 0.008, hold: 0.04, decay: 0.55, delay: 0.16 },
      { wave: 'sine', freq: 1176, gain: 0.08, attack: 0.01, decay: 0.5, delay: 0.18 },
    ],
  },

  /**
   * Blessing shrine on screen OPEN (StatBoostScreen). Fires on a mount, not a press, so nothing here has a transient (no attack under 0.15s) —
   * it must not read as feedback on the tap that got the player here. Per-shrine `pitch` from STAT_BOOST_CONFIG, not three sounds.
   */
  shrine: {
    gain: 0.34,
    jitter: 0.004,
    voices: [
      { wave: 'triangle', freq: 131, freqEnd: 196, detune: 10, gain: 0.34, attack: 0.3, hold: 0.1, decay: 0.9 },
      { wave: 'sine', freq: 65, gain: 0.28, attack: 0.35, decay: 1.1 },
      // The bowl: partials a fifth apart, upper ones detuned so they beat.
      { wave: 'sine', freq: 523, gain: 0.2, attack: 0.16, decay: 1.3, delay: 0.22 },
      { wave: 'sine', freq: 784, detune: 12, gain: 0.13, attack: 0.18, decay: 1.2, delay: 0.26 },
      { wave: 'sine', freq: 1568, detune: 18, gain: 0.05, attack: 0.2, decay: 1.0, delay: 0.3 },
      { wave: 'noise', gain: 0.12, attack: 0.4, decay: 0.9, filter: { type: 'bandpass', freq: 500, freqEnd: 3000, q: 0.7 } },
    ],
  },

  /** The blessing landing: `shrine`'s bowl struck with an attack, same per-shrine pitch. Not `heal` — a flat sine triad reads as medical, not given. */
  blessing: {
    gain: 0.42,
    jitter: 0.006,
    voices: [
      { wave: 'triangle', freq: 196, detune: 8, gain: 0.3, attack: 0.01, hold: 0.05, decay: 0.6 },
      { wave: 'sine', freq: 392, gain: 0.26, attack: 0.012, decay: 0.55 },
      { wave: 'sine', freq: 587, gain: 0.22, attack: 0.014, decay: 0.6, delay: 0.07 },
      { wave: 'sine', freq: 784, gain: 0.18, attack: 0.014, decay: 0.7, delay: 0.14 },
      { wave: 'sine', freq: 1568, detune: 14, gain: 0.09, attack: 0.02, decay: 0.9, delay: 0.15 },
      { wave: 'noise', gain: 0.1, attack: 0.1, decay: 0.5, filter: { type: 'bandpass', freq: 1400, freqEnd: 4600, q: 1.2 } },
    ],
  },

  /**
   * Class conferred (ClassNodeScreen phase 2; ui.commit already played on the discipline pick). A chord struck whole — sus4, not major — with a late bell.
   * Timed to styles.css class-learn-flash-burst 0.6s / class-learn-pop 0.5s.
   */
  'class.learn': {
    gain: 0.44,
    jitter: 0.004,
    voices: [
      { wave: 'triangle', freq: 147, detune: 10, gain: 0.32, attack: 0.008, hold: 0.05, decay: 0.7 },
      { wave: 'triangle', freq: 294, gain: 0.24, attack: 0.008, hold: 0.04, decay: 0.65 },
      { wave: 'sine', freq: 392, gain: 0.22, attack: 0.01, decay: 0.7 },
      { wave: 'sine', freq: 588, detune: 8, gain: 0.16, attack: 0.012, decay: 0.75 },
      { wave: 'sine', freq: 1176, gain: 0.1, attack: 0.006, decay: 1.0, delay: 0.12 },
      { wave: 'noise', gain: 0.14, attack: 0.02, decay: 0.36, filter: { type: 'bandpass', freq: 1200, freqEnd: 3800, q: 1.1 } },
    ],
  },

  /** Cache lid (CacheReveal.tsx, on the lid-swing frame): latch, lid, then light. Lower and drier than `equip` — wood letting go, not metal seating. */
  'cache.open': {
    gain: 0.44,
    jitter: 0.02,
    voices: [
      { wave: 'noise', gain: 0.3, attack: 0.001, decay: 0.05, filter: { type: 'bandpass', freq: 1500, q: 1.4 } },
      { wave: 'triangle', freq: 165, freqEnd: 110, gain: 0.3, attack: 0.003, decay: 0.22, delay: 0.01 },
      // The only slow attack — light spilling, not a second strike.
      { wave: 'noise', gain: 0.16, attack: 0.09, decay: 0.5, delay: 0.05, filter: { type: 'bandpass', freq: 900, freqEnd: 6000, q: 0.8 } },
      { wave: 'triangle', freq: 262, gain: 0.22, attack: 0.01, decay: 0.55, delay: 0.13 },
      { wave: 'sine', freq: 1047, gain: 0.16, attack: 0.008, decay: 0.6, delay: 0.13 },
      { wave: 'sine', freq: 1319, detune: 9, gain: 0.13, attack: 0.01, decay: 0.7, delay: 0.19 },
    ],
  },

  /** One XP orb landing (LevelUpScreen), ~130ms apart with the caller raising `pitch` each time. UI-sized: five can fire in 0.75s and tails would stack into a chord. */
  'xp.orb': {
    gain: 0.3,
    jitter: 0.006,
    voices: [
      { wave: 'triangle', freq: 784, gain: 0.24, attack: 0.002, hold: 0.015, decay: 0.13 },
      { wave: 'sine', freq: 1568, gain: 0.1, attack: 0.003, decay: 0.2, delay: 0.005 },
      { wave: 'noise', gain: 0.05, attack: 0.004, decay: 0.07, filter: { type: 'highpass', freq: 4000 } },
    ],
  },

  /** Event node on mount (EventNodeScreen): same no-transient rule as `shrine`, but a suspended fourth left unresolved. Per-tone `pitch` from TONE_PITCH. */
  discovery: {
    gain: 0.34,
    jitter: 0.006,
    voices: [
      { wave: 'triangle', freq: 175, freqEnd: 233, detune: 9, gain: 0.3, attack: 0.32, hold: 0.12, decay: 0.9 },
      { wave: 'sine', freq: 87, gain: 0.24, attack: 0.38, decay: 1.0 },
      { wave: 'sine', freq: 466, detune: 14, gain: 0.15, attack: 0.24, decay: 1.1, delay: 0.24 },
      { wave: 'sine', freq: 932, detune: 20, gain: 0.06, attack: 0.28, decay: 0.9, delay: 0.34 },
      { wave: 'noise', gain: 0.1, attack: 0.45, decay: 0.85, filter: { type: 'bandpass', freq: 420, freqEnd: 2400, q: 0.7 } },
    ],
  },

  /** "X uses Y": a wind-up, not an event — the impact follows immediately and two full sounds back to back is mush. */
  cast: {
    gain: 0.42,
    jitter: 0.04,
    voices: [
      { wave: 'noise', gain: 0.34, attack: 0.05, decay: 0.1, filter: { type: 'bandpass', freq: 900, freqEnd: 2000, q: 1.6 } },
      { wave: 'triangle', freq: 330, freqEnd: 420, gain: 0.16, attack: 0.03, decay: 0.1 },
    ],
  },

  /** Physical hit: noise through a closing lowpass is the thud, the sine is the weight. beatSfx.ts re-pitches by damage. */
  'hit.physical': {
    gain: 0.5,
    jitter: 0.07,
    voices: [
      { wave: 'noise', gain: 0.6, attack: 0.001, decay: 0.15, filter: { type: 'lowpass', freq: 1900, freqEnd: 260, q: 1.1 } },
      { wave: 'sine', freq: 170, freqEnd: 58, gain: 0.55, attack: 0.001, decay: 0.17 },
      { wave: 'noise', gain: 0.2, attack: 0.001, decay: 0.035, filter: { type: 'highpass', freq: 2600 } },
    ],
  },

  /** Magical hit: brighter, longer-tailed, detuned — the detune is what separates "magic" from "a hit with more treble". */
  'hit.magical': {
    gain: 0.44,
    jitter: 0.06,
    voices: [
      { wave: 'sawtooth', freq: 620, freqEnd: 190, detune: 26, gain: 0.32, attack: 0.002, decay: 0.3, filter: { type: 'lowpass', freq: 3200, freqEnd: 620, q: 2.2 } },
      { wave: 'sine', freq: 210, freqEnd: 84, gain: 0.34, attack: 0.002, decay: 0.2 },
      { wave: 'noise', gain: 0.16, attack: 0.004, decay: 0.22, filter: { type: 'bandpass', freq: 2600, freqEnd: 900, q: 1.4 } },
    ],
  },

  /** Layered ON TOP of the base hit, not replacing it. The 35ms-delayed crack is what makes it register as an event rather than a louder thud. */
  'hit.crit': {
    gain: 0.5,
    jitter: 0.04,
    voices: [
      { wave: 'square', freq: 1250, freqEnd: 380, gain: 0.2, attack: 0.001, decay: 0.09, filter: { type: 'lowpass', freq: 4200, freqEnd: 1200, q: 1 } },
      { wave: 'noise', gain: 0.42, attack: 0.001, decay: 0.1, delay: 0.035, filter: { type: 'highpass', freq: 1500 } },
      { wave: 'sine', freq: 96, freqEnd: 44, gain: 0.5, attack: 0.002, decay: 0.28, delay: 0.02 },
    ],
  },

  /** A rising major triad, soft-attacked. */
  heal: {
    gain: 0.38,
    jitter: 0.01,
    voices: [
      { wave: 'sine', freq: 523, gain: 0.34, attack: 0.02, decay: 0.42 },
      { wave: 'sine', freq: 659, gain: 0.3, attack: 0.02, decay: 0.4, delay: 0.06 },
      { wave: 'sine', freq: 784, gain: 0.26, attack: 0.02, decay: 0.46, delay: 0.12 },
    ],
  },

  /** Stat up: ui.confirm's contour an octave down, with body. */
  buff: {
    gain: 0.32,
    jitter: 0.02,
    voices: [
      { wave: 'triangle', freq: 300, freqEnd: 500, detune: 10, gain: 0.36, attack: 0.01, decay: 0.26 },
      { wave: 'sine', freq: 600, freqEnd: 1000, gain: 0.12, attack: 0.01, decay: 0.2, delay: 0.03 },
    ],
  },

  /** Stat down: buff mirrored, wider detune so it sags. */
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

  /** Conduct going off — a fast electric discharge. */
  detonate: {
    gain: 0.44,
    jitter: 0.05,
    voices: [
      { wave: 'sawtooth', freq: 940, freqEnd: 120, gain: 0.3, attack: 0.001, decay: 0.18, filter: { type: 'lowpass', freq: 5000, freqEnd: 800, q: 3 } },
      { wave: 'noise', gain: 0.4, attack: 0.001, decay: 0.11, filter: { type: 'highpass', freq: 1800 } },
      { wave: 'sine', freq: 130, freqEnd: 50, gain: 0.42, attack: 0.002, decay: 0.24 },
    ],
  },

  /** Knockout: a long falling sweep with the lowpass closing alongside it — going away, not just down. */
  faint: {
    gain: 0.42,
    jitter: 0.02,
    voices: [
      { wave: 'triangle', freq: 320, freqEnd: 62, detune: 16, gain: 0.42, attack: 0.006, decay: 0.6, filter: { type: 'lowpass', freq: 1600, freqEnd: 210, q: 1.2 } },
      { wave: 'noise', gain: 0.22, attack: 0.01, decay: 0.5, filter: { type: 'lowpass', freq: 900, freqEnd: 180, q: 0.8 } },
    ],
  },

  /** Mana returning: a small high bell, out of the way. */
  mana: {
    gain: 0.26,
    jitter: 0.02,
    voices: [
      { wave: 'sine', freq: 880, gain: 0.24, attack: 0.004, decay: 0.44 },
      { wave: 'sine', freq: 1320, detune: 8, gain: 0.14, attack: 0.004, decay: 0.34, delay: 0.02 },
    ],
  },

  /** A hero arriving: upward rush with a blip on the landing. */
  switchIn: {
    gain: 0.62,
    jitter: 0.04,
    voices: [
      { wave: 'noise', gain: 0.4, attack: 0.03, decay: 0.17, filter: { type: 'bandpass', freq: 420, freqEnd: 2400, q: 1.1 } },
      { wave: 'triangle', freq: 440, freqEnd: 660, gain: 0.24, attack: 0.006, decay: 0.13, delay: 0.11 },
    ],
  },

  /** A Field Effect taking the battlefield: the one combat sound allowed to be big and slow — it fires a handful of times a fight. */
  field: {
    gain: 0.4,
    jitter: 0.01,
    voices: [
      { wave: 'sawtooth', freq: 110, freqEnd: 232, detune: 22, gain: 0.3, attack: 0.12, decay: 0.8, filter: { type: 'lowpass', freq: 300, freqEnd: 2600, q: 2.4 } },
      { wave: 'noise', gain: 0.24, attack: 0.18, decay: 0.62, filter: { type: 'bandpass', freq: 600, freqEnd: 3000, q: 0.8 } },
      { wave: 'sine', freq: 660, freqEnd: 990, gain: 0.12, attack: 0.2, decay: 0.5, delay: 0.16 },
    ],
  },

  /**
   * Named-enemy entrance (view/shared/entrances.ts). The biggest sound in the table, licensed only because it fires at most ONCE a run
   * (the Goblin Lord at Wild's Edge) — if a second thing ever plays it, it is too big. Every sweep falls where `field`'s rise: an arrival, not a state.
   */
  'entrance.dread': {
    gain: 0.52,
    // No jitter: a scripted moment, and a randomised pitch would read as a mis-fired hit.
    jitter: 0,
    voices: [
      { wave: 'noise', gain: 0.38, attack: 0.004, decay: 0.5, filter: { type: 'lowpass', freq: 800, freqEnd: 140, q: 0.9 } },
      { wave: 'sine', freq: 62, freqEnd: 36, gain: 0.5, attack: 0.02, hold: 0.35, decay: 1.1 },
      {
        wave: 'sawtooth',
        freq: 96,
        freqEnd: 87,
        detune: 18,
        gain: 0.28,
        attack: 0.22,
        hold: 0.5,
        decay: 1.0,
        delay: 0.16,
        filter: { type: 'lowpass', freq: 300, freqEnd: 760, q: 2.6 },
      },
    ],
  },
};
