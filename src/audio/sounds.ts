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
   * The big commitment — sealing the starter draft, taking a Mentor's
   * class, choosing an Evolution. Deliberately breaks the "UI sounds are
   * quiet and under 120ms" rule above, and that is the whole point: it
   * fires perhaps a dozen times in a run, so it is allowed to be a moment.
   * Contour is `ui.confirm` written large — the same rise, but as a spelled
   * out C-major arpeggio over a fifth in the bass, so it reads as an
   * *arrival* rather than an acknowledgement.
   */
  'ui.commit': {
    gain: 0.42,
    jitter: 0.01,
    voices: [
      // The floor. Lands with the first note and opens a fifth under the
      // rise, which is what stops the arpeggio sounding thin and chimey.
      { wave: 'triangle', freq: 196, freqEnd: 262, detune: 8, gain: 0.34, attack: 0.006, hold: 0.06, decay: 0.5 },
      { wave: 'sine', freq: 523, gain: 0.3, attack: 0.004, decay: 0.22 },
      { wave: 'sine', freq: 784, gain: 0.26, attack: 0.004, decay: 0.24, delay: 0.075 },
      { wave: 'sine', freq: 1046, gain: 0.22, attack: 0.004, decay: 0.5, delay: 0.15 },
      // A detuned octave above the landing note, held long. This is the
      // "special" — a shimmer that keeps ringing after the gesture is over.
      { wave: 'triangle', freq: 1568, detune: 14, gain: 0.1, attack: 0.02, decay: 0.55, delay: 0.16 },
      // Air opening underneath, slow-attacked so it swells into the landing
      // instead of announcing itself.
      { wave: 'noise', gain: 0.16, attack: 0.09, decay: 0.34, filter: { type: 'bandpass', freq: 700, freqEnd: 3600, q: 0.9 } },
    ],
  },

  /**
   * "Start a Run" — and nothing else. The single loudest, longest sound in
   * the UI table, because it fires at most a handful of times a *session*
   * and marks the one boundary the player crosses from menu into game.
   *
   * Built as a gate opening rather than a chime: a hard slam transient
   * (noise through a closing lowpass, the same construction as
   * `hit.physical` but slower and heavier), a sub drop under it for the
   * chunk, and only then a struck bronze fifth ringing out over a long
   * upward rush of air. The 90ms gap before the bell is deliberate — the
   * slam has to be over before the ring starts, or the two blur into one
   * mid-sized noise and the weight goes with it.
   *
   * Timed against TitleScreen's LAUNCH_ANIM_MS: the slam lands with the
   * shockwave, the bell with the screen going white.
   */
  'ui.launch': {
    gain: 0.5,
    jitter: 0.006,
    voices: [
      // The slam. Wide-open noise shut down hard is what reads as mass.
      { wave: 'noise', gain: 0.5, attack: 0.001, decay: 0.26, filter: { type: 'lowpass', freq: 2600, freqEnd: 180, q: 1.2 } },
      // The chunk under it — an octave drop into the sub, held a moment.
      { wave: 'sine', freq: 132, freqEnd: 42, gain: 0.6, attack: 0.002, hold: 0.03, decay: 0.42 },
      { wave: 'triangle', freq: 88, freqEnd: 58, detune: 12, gain: 0.34, attack: 0.004, hold: 0.05, decay: 0.6 },
      // Bronze. A struck fifth, not a triad: two notes ring as a bell, three
      // ring as music, and this is a door, not a fanfare.
      { wave: 'triangle', freq: 294, detune: 10, gain: 0.24, attack: 0.004, hold: 0.04, decay: 0.9, delay: 0.09 },
      { wave: 'sine', freq: 441, gain: 0.2, attack: 0.006, decay: 0.85, delay: 0.1 },
      { wave: 'sine', freq: 882, detune: 16, gain: 0.09, attack: 0.01, decay: 0.8, delay: 0.11 },
      // The rush: slow-attacked air opening upward, swelling into the bell
      // rather than announcing it.
      { wave: 'noise', gain: 0.2, attack: 0.16, decay: 0.55, filter: { type: 'bandpass', freq: 400, freqEnd: 4200, q: 0.8 } },
    ],
  },

  /**
   * A hero gaining a level: a four-note fanfare in D, landing on the octave
   * with a bell over it and the root arriving underneath.
   *
   * Timed to the card's charge animation (LevelUpScreen's LEVEL_UP_ANIM_MS)
   * — it is fired when the level actually lands, so the run reads as the
   * payoff of the charge rather than a second, competing gesture. Kept
   * under a second: it plays once per Training Point, and there can be four
   * of those in a row.
   *
   * `jitter` is near-zero on purpose. Every voice is scaled by the same
   * pitch factor so a jitter only transposes the tune, never detunes it —
   * but a fanfare that lands on a different key each time reads as sloppy,
   * not alive.
   */
  levelUp: {
    gain: 0.4,
    jitter: 0.004,
    voices: [
      { wave: 'triangle', freq: 587, gain: 0.26, attack: 0.003, hold: 0.02, decay: 0.1 },
      { wave: 'triangle', freq: 740, gain: 0.26, attack: 0.003, hold: 0.02, decay: 0.1, delay: 0.085 },
      { wave: 'triangle', freq: 880, gain: 0.26, attack: 0.003, hold: 0.02, decay: 0.1, delay: 0.17 },
      { wave: 'triangle', freq: 1175, detune: 10, gain: 0.3, attack: 0.004, hold: 0.07, decay: 0.55, delay: 0.255 },
      // Bell two octaves over the landing note — the sparkle that says
      // "something was gained" rather than "something happened".
      { wave: 'sine', freq: 2349, gain: 0.1, attack: 0.004, decay: 0.6, delay: 0.26 },
      // The root, arriving only on the last note. Held back so the first
      // three notes stay light and the fourth has somewhere to land.
      { wave: 'sine', freq: 293, gain: 0.34, attack: 0.006, decay: 0.6, delay: 0.25 },
      { wave: 'noise', gain: 0.1, attack: 0.12, decay: 0.3, filter: { type: 'bandpass', freq: 1800, freqEnd: 5200, q: 1.4 } },
    ],
  },

  /**
   * A starter being bound in the draft (DraftScreen's Choose button). Half
   * a hero's pact, so half a `ui.commit`: the same rising fifth, but two
   * notes instead of an arpeggio and a fraction of the tail — the seal on
   * the whole pact still has to be able to outsize it.
   *
   * The snap is what makes it a *binding* rather than a selection. A very
   * short highpassed noise crack, delayed just past the note's attack, so
   * the ear hears a clasp closing on something rather than a chord.
   */
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

  /**
   * A piece of equipment going onto a hero (ForceEquipScreen). Entirely
   * mechanical — no tuned chord at all beyond the dull body of the strap
   * pulling tight, because gear is the one thing the player gains that is
   * an *object* rather than a promotion.
   *
   * Two noise layers doing two jobs: a bright short crack (the buckle) and
   * a duller ring-off behind it (the metal). The tiny second crack at 60ms
   * is the difference between "a click" and "a latch that seated".
   */
  equip: {
    gain: 0.46,
    jitter: 0.05,
    voices: [
      { wave: 'noise', gain: 0.4, attack: 0.001, decay: 0.055, filter: { type: 'bandpass', freq: 2700, q: 1.6 } },
      { wave: 'noise', gain: 0.22, attack: 0.001, decay: 0.04, delay: 0.06, filter: { type: 'highpass', freq: 3400 } },
      { wave: 'triangle', freq: 196, freqEnd: 147, gain: 0.34, attack: 0.002, decay: 0.19 },
      // Metal ringing off the strike, quiet and detuned so it colours the
      // hit rather than becoming a note of its own.
      { wave: 'sine', freq: 1568, detune: 22, gain: 0.08, attack: 0.003, decay: 0.34, delay: 0.02 },
    ],
  },

  /**
   * Signing a Recruit Contract (RecruitScreen). A wax seal, in three
   * strokes: paper drawn across paper, the stamp coming down, and one
   * clear tone as the sigil takes.
   *
   * The stamp is the loudest thing here and lands at 70ms, after the
   * rustle — the order is the whole gesture, and playing them together
   * would just be a thud with hiss on it.
   */
  'contract.sign': {
    gain: 0.44,
    jitter: 0.02,
    voices: [
      // Parchment.
      { wave: 'noise', gain: 0.16, attack: 0.02, decay: 0.13, filter: { type: 'bandpass', freq: 3400, freqEnd: 1800, q: 0.9 } },
      // The stamp coming down: a soft-edged thud, lowpassed so it reads as
      // pressed rather than struck.
      { wave: 'noise', gain: 0.36, attack: 0.002, decay: 0.16, delay: 0.07, filter: { type: 'lowpass', freq: 1400, freqEnd: 240, q: 1 } },
      { wave: 'sine', freq: 146, freqEnd: 73, gain: 0.44, attack: 0.003, hold: 0.02, decay: 0.3, delay: 0.07 },
      // The sigil taking — one note, held, with an octave shimmer over it.
      { wave: 'triangle', freq: 392, detune: 9, gain: 0.24, attack: 0.008, hold: 0.04, decay: 0.55, delay: 0.16 },
      { wave: 'sine', freq: 1176, gain: 0.08, attack: 0.01, decay: 0.5, delay: 0.18 },
    ],
  },

  /**
   * Arriving at one of the three blessing shrines — Vitality, the Mana Well,
   * the Regen Spring (StatBoostScreen). The only sound in the game that
   * fires on a screen *opening* rather than on a press, which is the whole
   * reason it is built the way it is: nothing here has a transient. There is
   * no click, no strike, no attack under 0.15s anywhere in it, so it cannot
   * be mistaken for feedback on the tap that got the player here — it swells
   * up underneath that tap and becomes the room.
   *
   * A consecrated space, in three layers: a fifth opening in the low end, a
   * struck bowl ringing over it, and air. The bowl is delayed past the pad's
   * attack so the space exists before anything sounds in it.
   *
   * Played with a per-shrine `pitch` (StatBoostScreen's STAT_BOOST_CONFIG),
   * not as three separate sounds. The three shrines are one kind of place —
   * they should be as obviously related in the ear as they already are in the
   * eye, where they differ only by `--node-rgb`.
   */
  shrine: {
    gain: 0.34,
    jitter: 0.004,
    voices: [
      // The space opening. A fifth, arriving slowly enough that there is no
      // moment you could point at as its start.
      { wave: 'triangle', freq: 131, freqEnd: 196, detune: 10, gain: 0.34, attack: 0.3, hold: 0.1, decay: 0.9 },
      { wave: 'sine', freq: 65, gain: 0.28, attack: 0.35, decay: 1.1 },
      // The bowl. Two partials a fifth apart, the upper one detuned so it
      // beats — struck metal is never quite in tune with itself.
      { wave: 'sine', freq: 523, gain: 0.2, attack: 0.16, decay: 1.3, delay: 0.22 },
      { wave: 'sine', freq: 784, detune: 12, gain: 0.13, attack: 0.18, decay: 1.2, delay: 0.26 },
      { wave: 'sine', freq: 1568, detune: 18, gain: 0.05, attack: 0.2, decay: 1.0, delay: 0.3 },
      // Air, opening upward under all of it.
      { wave: 'noise', gain: 0.12, attack: 0.4, decay: 0.9, filter: { type: 'bandpass', freq: 500, freqEnd: 3000, q: 0.7 } },
    ],
  },

  /**
   * The blessing landing on the chosen hero (StatBoostScreen's grant). The
   * shrine's own bowl struck properly this time — same intervals, but with an
   * attack, so the ambience the player has been standing in for a few seconds
   * suddenly *speaks*. Carries the same per-shrine pitch as `shrine` above,
   * so a Vitality blessing and a Mana one are the same gesture in two keys.
   *
   * Deliberately not `heal`, which is the closest thing already in the table:
   * that is a flat sine triad and reads as medical. This one has a low root
   * arriving under it and a two-octave shimmer over it, which is what makes
   * it read as something being *given* rather than something being restored.
   */
  blessing: {
    gain: 0.42,
    jitter: 0.006,
    voices: [
      // The root, arriving with the strike rather than after it — this is a
      // gift, not a fanfare, so there is nothing to build toward.
      { wave: 'triangle', freq: 196, detune: 8, gain: 0.3, attack: 0.01, hold: 0.05, decay: 0.6 },
      { wave: 'sine', freq: 392, gain: 0.26, attack: 0.012, decay: 0.55 },
      { wave: 'sine', freq: 587, gain: 0.22, attack: 0.014, decay: 0.6, delay: 0.07 },
      { wave: 'sine', freq: 784, gain: 0.18, attack: 0.014, decay: 0.7, delay: 0.14 },
      // Two octaves up, held longest of anything here: the part still ringing
      // after the card has finished lighting up.
      { wave: 'sine', freq: 1568, detune: 14, gain: 0.09, attack: 0.02, decay: 0.9, delay: 0.15 },
      { wave: 'noise', gain: 0.1, attack: 0.1, decay: 0.5, filter: { type: 'bandpass', freq: 1400, freqEnd: 4600, q: 1.2 } },
    ],
  },

  /**
   * A Class being conferred on a hero (ClassNodeScreen phase 2, the moment
   * the learn-reveal replaces the grid). Distinct from `ui.commit`, which
   * this screen already plays one press earlier when the *discipline* is
   * confirmed — that is choosing what to teach, this is the teaching.
   *
   * The difference is written into the shape: `ui.commit` is an arpeggio, one
   * note at a time arriving at something. This is a chord, struck whole, with
   * only a bell over it — a discipline is handed over complete or not at all,
   * and nothing about it is assembled in front of the player.
   *
   * Timed against the reveal (styles.css @keyframes class-learn-flash-burst
   * 0.6s, class-learn-pop 0.5s): the chord lands with the flash, and the bell
   * is still going when the stat chips finish cascading in.
   */
  'class.learn': {
    gain: 0.44,
    jitter: 0.004,
    voices: [
      // The chord: root, fourth, octave. A suspended fourth rather than a
      // major third — it reads as knowledge conferred rather than as victory.
      { wave: 'triangle', freq: 147, detune: 10, gain: 0.32, attack: 0.008, hold: 0.05, decay: 0.7 },
      { wave: 'triangle', freq: 294, gain: 0.24, attack: 0.008, hold: 0.04, decay: 0.65 },
      { wave: 'sine', freq: 392, gain: 0.22, attack: 0.01, decay: 0.7 },
      { wave: 'sine', freq: 588, detune: 8, gain: 0.16, attack: 0.012, decay: 0.75 },
      // The bell, arriving a beat late and outlasting everything — the one
      // part that is allowed to sound like a lesson landing.
      { wave: 'sine', freq: 1176, gain: 0.1, attack: 0.006, decay: 1.0, delay: 0.12 },
      // A short breath of air on the strike, so the chord has an edge.
      { wave: 'noise', gain: 0.14, attack: 0.02, decay: 0.36, filter: { type: 'bandpass', freq: 1200, freqEnd: 3800, q: 1.1 } },
    ],
  },

  /**
   * A cache giving up its lid (CacheReveal.tsx, on the frame the lid swings).
   * The one sound in the table that is a *mechanism* first and a reward
   * second, in that order and audibly: latch, lid, then light.
   *
   * Deliberately not `equip`, which is the nearest thing already here. That
   * one is metal seating — bright, tight, closed. This is wood letting go, so
   * the crack is lower and drier and there is nothing tight about what follows
   * it. A player should be able to tell a chest opening from a buckle closing
   * without looking at the screen, because for the first 200ms of this beat
   * they are looking at a chest and not at what came out of it.
   *
   * The swell is the only voice with a slow attack, which is what makes the
   * back half read as light *spilling* rather than as a second strike.
   */
  'cache.open': {
    gain: 0.44,
    jitter: 0.02,
    voices: [
      // The latch giving.
      { wave: 'noise', gain: 0.3, attack: 0.001, decay: 0.05, filter: { type: 'bandpass', freq: 1500, q: 1.4 } },
      // The lid going over, and the body of the chest rocking under it.
      { wave: 'triangle', freq: 165, freqEnd: 110, gain: 0.3, attack: 0.003, decay: 0.22, delay: 0.01 },
      // Light coming out: a noise swell opening upward through the filter.
      { wave: 'noise', gain: 0.16, attack: 0.09, decay: 0.5, delay: 0.05, filter: { type: 'bandpass', freq: 900, freqEnd: 6000, q: 0.8 } },
      // What is inside. Root and major third two octaves up, arriving after
      // the lid — the chest opens, and *then* there is something in it.
      { wave: 'triangle', freq: 262, gain: 0.22, attack: 0.01, decay: 0.55, delay: 0.13 },
      { wave: 'sine', freq: 1047, gain: 0.16, attack: 0.008, decay: 0.6, delay: 0.13 },
      { wave: 'sine', freq: 1319, detune: 9, gain: 0.13, attack: 0.01, decay: 0.7, delay: 0.19 },
    ],
  },

  /**
   * One XP orb landing on the level-up screen's track (LevelUpScreen's arrival
   * beat). Fires once per orb, ~130ms apart, and the caller raises `pitch` a
   * step or so each time — so two points and five points are audibly different
   * *runs* rather than the same blip repeated.
   *
   * Sized like a UI sound rather than a reward one, and for the same reason
   * those are kept under 120ms: this can fire five times in three quarters of
   * a second, and five copies of anything with a tail is a chord nobody
   * composed. The fanfare is still `levelUp`, which plays when a point is
   * *spent*; this is only the counting-in.
   */
  'xp.orb': {
    gain: 0.3,
    jitter: 0.006,
    voices: [
      { wave: 'triangle', freq: 784, gain: 0.24, attack: 0.002, hold: 0.015, decay: 0.13 },
      { wave: 'sine', freq: 1568, gain: 0.1, attack: 0.003, decay: 0.2, delay: 0.005 },
      { wave: 'noise', gain: 0.05, attack: 0.004, decay: 0.07, filter: { type: 'highpass', freq: 4000 } },
    ],
  },

  /**
   * Arriving at an event node (EventNodeScreen, on mount). Built to the same
   * rule as `shrine` — no transient anywhere in it, nothing with an attack
   * under 0.15s — so it cannot be mistaken for feedback on the map tap that
   * got the player here. It swells up under that tap and becomes the room,
   * which is exactly what the screen's first beat is for: the flavor line is
   * on screen alone for a moment, and this is what that moment sounds like.
   *
   * Where `shrine` is a consecrated space (a fifth, a struck bowl), this is an
   * *unresolved* one: a suspended fourth that never gets its third, with the
   * upper partial drifting in late and detuned. An event has not told you yet
   * whether it is good.
   *
   * Played with a per-tone `pitch` (EventNodeScreen's TONE_PITCH) rather than
   * as five sounds, the same way the three shrines share one — the events are
   * one kind of place, and they already differ only by `--node-rgb`.
   */
  discovery: {
    gain: 0.34,
    jitter: 0.006,
    voices: [
      { wave: 'triangle', freq: 175, freqEnd: 233, detune: 9, gain: 0.3, attack: 0.32, hold: 0.12, decay: 0.9 },
      { wave: 'sine', freq: 87, gain: 0.24, attack: 0.38, decay: 1.0 },
      // The fourth, arriving late enough to read as a question rather than a
      // chord, and detuned so it never quite settles.
      { wave: 'sine', freq: 466, detune: 14, gain: 0.15, attack: 0.24, decay: 1.1, delay: 0.24 },
      { wave: 'sine', freq: 932, detune: 20, gain: 0.06, attack: 0.28, decay: 0.9, delay: 0.34 },
      // Air moving somewhere ahead of the player.
      { wave: 'noise', gain: 0.1, attack: 0.45, decay: 0.85, filter: { type: 'bandpass', freq: 420, freqEnd: 2400, q: 0.7 } },
    ],
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

  /**
   * A named enemy walking onto the field (view/combat/entrances.ts). The
   * biggest and longest sound in the table, and the only one that fires at
   * most ONCE in a run — the Goblin Lord's arrival at Wild's Edge — which is
   * the entire licence for its size. If a second thing ever plays it, it is
   * too big.
   *
   * Built downward where `field` (the other slow sound above) is built upward:
   * every sweep here falls, because this marks something arriving rather than
   * a state turning on. Three layers, in the order the ear reads them — the
   * step that lands, the sub that drops out from under it, and a detuned horn
   * that comes in late and holds, so the sound is still going when the veil
   * clears and the card is on screen.
   */
  'entrance.dread': {
    gain: 0.52,
    // No jitter at all: this is a scripted moment, not a repeated impact, and
    // a randomised pitch would only make it sound like a mis-fired hit.
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
