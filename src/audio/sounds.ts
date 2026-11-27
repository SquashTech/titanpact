// The sound table — pure data over the voice vocabulary in synth.ts; adding a sound is adding a row.
// Timing lives in the view layer (beatSfx.ts), never here. The instruments are a toybox (instruments.ts): wood, felt, paper,
// marimba and xylophone bars, a slide whistle. UI sounds stay short and quiet: they fire hundreds of times a run.

import type { SoundSpec } from './synth';
import { bar, felt, marimba, paper, shaker, slide, swish, woodBlock, xylo } from './instruments';

export type SfxId =
  // UI
  | 'ui.tap'
  | 'ui.confirm'
  | 'ui.back'
  | 'ui.select'
  | 'ui.move'
  | 'ui.target'
  | 'ui.denied'
  | 'ui.page'
  | 'ui.commit'
  | 'ui.launch'
  | 'ui.tab'
  | 'ui.pick'
  | 'ui.trade'
  // Run
  | 'victory'
  | 'defeat'
  | 'levelUp'
  | 'pact.bind'
  | 'equip'
  | 'contract.sign'
  | 'quill.scratch'
  | 'wax.stamp'
  | 'evolve.charge'
  | 'evolve.fanfare'
  | 'shrine'
  | 'scroll.spend'
  | 'gem.set'
  | 'loot.twinkle'
  | 'blessing'
  | 'class.learn'
  | 'cache.open'
  | 'anvil.strike'
  | 'anvil.ring'
  | 'enchant.bind'
  | 'forge.quench'
  | 'forge.roar'
  | 'gold.coin'
  | 'gold.purse'
  | 'xp.orb'
  | 'discovery'
  | 'seal.strike'
  | 'seal.shatter'
  | 'titan.stir'
  | 'titan.gaze'
  | 'map.path'
  | 'map.select'
  | 'map.gate'
  | 'map.boon'
  | 'map.threat'
  | 'patron.huntress'
  | 'patron.forgemistress'
  | 'patron.swordsman'
  | 'patron.archmage'
  | 'patron.priest'
  | 'patron.hexwright'
  | 'patron.headmaster'
  // Blip (docs/the-sky.md §1): a babble a syllable at a time, and its reactions
  | 'blip.chirp'
  | 'blip.giggle'
  | 'blip.win'
  | 'blip.lose'
  | 'trust.rise'
  | 'trust.capstone'
  | 'star.rise'
  | 'star.fall'
  | 'star.land'
  | 'star.tick'
  | 'star.lock'
  | 'star.charge'
  | 'star.reveal'
  | 'star.earn'
  // Combat
  | 'cast'
  | 'cast.Fire'
  | 'cast.Water'
  | 'cast.Frost'
  | 'cast.Storm'
  | 'cast.Stone'
  | 'cast.Nature'
  | 'cast.Light'
  | 'cast.Shadow'
  | 'cast.Arcane'
  | 'cast.Mind'
  | 'cast.Spirit'
  | 'cast.Iron'
  | 'cast.Mech'
  | 'cast.Beast'
  | 'cast.Ancient'
  | 'hit.physical'
  | 'hit.magical'
  | 'hit.crit'
  | 'hit.quake'
  | 'shield.absorb'
  | 'shield.break'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'status'
  | 'detonate'
  | 'faint'
  | 'mana'
  | 'switchIn'
  | 'field'
  | 'battle.join'
  | 'entrance.dread';

export const sounds: Record<SfxId, SoundSpec> = {
  /** Every tappable surface: a small wood block. */
  'ui.tap': { gain: 0.29, jitter: 0.04, voices: woodBlock(1180, 0, 0.42) },

  /** Committing: a block knocked, then two marimba bars answering up a fourth. */
  'ui.confirm': {
    gain: 0.76,
    jitter: 0.02,
    voices: [...woodBlock(1320, 0, 0.36), ...marimba(523, 0.02, 0.26, 0.16), ...bar(698, 0.07, 0.26, 0.24)],
  },

  /** Cancel: a felt knock and a low block, falling — nothing rings. */
  'ui.back': {
    gain: 0.39,
    jitter: 0.02,
    voices: [...felt(240, 0, 0.36, 0.08), ...woodBlock(640, 0.03, 0.3)],
  },

  /** Highlighting without committing; can fire every frame of a drag, so the smallest knock in the box. */
  'ui.select': { gain: 0.7, jitter: 0.05, voices: woodBlock(2100, 0, 0.26) },

  /** A move taken off the combat grid: a block and one bar, the press that opens targeting. */
  'ui.move': {
    gain: 0.44,
    jitter: 0.03,
    voices: [...woodBlock(980, 0, 0.36), ...bar(784, 0.015, 0.2, 0.16)],
  },

  /** A target locked: two clicks of a wooden latch, then a fifth rising so it reads as caught, not hit. */
  'ui.target': {
    gain: 0.58,
    jitter: 0.02,
    voices: [...woodBlock(1500, 0, 0.3), ...woodBlock(1100, 0.045, 0.34), ...marimba(392, 0.05, 0.22, 0.14), ...bar(587, 0.1, 0.24, 0.24)],
  },

  /** Refusal: a hollow low bonk-bonk, falling. */
  'ui.denied': {
    gain: 0.45,
    voices: [...woodBlock(420, 0, 0.36), ...woodBlock(330, 0.09, 0.34)],
  },

  /** Screen to screen: a soft swish, not a note. */
  'ui.page': { gain: 0.45, jitter: 0.05, voices: swish(500, 2400, 0, 0.5, 0.2, 0.05) },

  /** The big commitment (draft sealed, Class taken, Evolution chosen): a marimba run up C major over a felt bass. */
  'ui.commit': {
    gain: 0.64,
    jitter: 0.01,
    voices: [
      ...felt(131, 0, 0.4, 0.3),
      ...marimba(523, 0, 0.26, 0.16),
      ...marimba(659, 0.07, 0.26, 0.16),
      ...marimba(784, 0.14, 0.26, 0.16),
      ...marimba(1047, 0.21, 0.3, 0.5),
      ...bar(523, 0.21, 0.16, 0.5),
      ...shaker(0.17, 0.08, 0.2, 0.03),
    ],
  },

  /** "Start a Run": the loudest UI sound — a drum, then a marimba fanfare landing on an open fifth. Timed to LAUNCH_ANIM_MS. */
  'ui.launch': {
    gain: 0.85,
    jitter: 0.006,
    voices: [
      ...felt(110, 0, 0.6, 0.4),
      ...woodBlock(880, 0, 0.3),
      ...marimba(392, 0.09, 0.26, 0.14),
      ...marimba(523, 0.15, 0.26, 0.14),
      ...marimba(784, 0.21, 0.3, 0.8),
      ...bar(1175, 0.21, 0.18, 0.8),
      ...bar(196, 0.21, 0.3, 0.8),
      ...shaker(0.12, 0.1, 0.4, 0.1),
    ],
  },

  /** A tab switched: a page turned. */
  'ui.tab': { gain: 0.57, jitter: 0.04, voices: paper(0, 0.3) },

  /** A card chosen: a wooden tile set down, lower and fuller than the tap. */
  'ui.pick': {
    gain: 0.33,
    jitter: 0.03,
    voices: [...woodBlock(760, 0, 0.4), ...felt(180, 0, 0.34, 0.1)],
  },

  /** Something changing hands: two toy coins plinked, then the wooden box they drop into. */
  'ui.trade': {
    gain: 0.33,
    jitter: 0.02,
    voices: [...xylo(1568, 0, 0.18, 0.12), ...xylo(2093, 0.055, 0.16, 0.14), ...woodBlock(520, 0.1, 0.34), ...felt(160, 0.1, 0.26, 0.12)],
  },

  /** The fight won: a drum, then a marimba run up G landing a fifth above where `levelUp` lands. */
  victory: {
    gain: 0.55,
    jitter: 0.003,
    voices: [
      ...felt(98, 0, 0.5, 0.36),
      ...marimba(392, 0.06, 0.26, 0.16),
      ...marimba(494, 0.15, 0.26, 0.16),
      ...marimba(587, 0.24, 0.28, 0.16),
      ...marimba(784, 0.34, 0.32, 0.8),
      ...bar(1175, 0.34, 0.16, 0.8),
      ...bar(196, 0.34, 0.3, 0.8),
      ...shaker(0.3, 0.1, 0.4, 0.06),
    ],
  },

  /** The fight lost: a soft drum and a low marimba sinking a minor third, a slide whistle sighing down after. */
  defeat: {
    gain: 0.64,
    jitter: 0.003,
    voices: [
      ...felt(82, 0, 0.44, 0.4),
      ...marimba(220, 0.06, 0.3, 0.4),
      ...marimba(185, 0.32, 0.3, 0.7),
      ...slide(440, 220, 0.5, 0.12, 0.7, 0.06),
    ],
  },

  /** Level gained: a marimba run in D up to a held chord, under 1s. Near-zero jitter: a fanfare in a new key each time reads as sloppy. */
  levelUp: {
    gain: 0.48,
    jitter: 0.004,
    voices: [
      ...marimba(587, 0, 0.28, 0.16),
      ...marimba(740, 0.08, 0.28, 0.16),
      ...marimba(880, 0.16, 0.28, 0.16),
      ...marimba(1175, 0.24, 0.32, 0.6),
      ...bar(880, 0.24, 0.18, 0.6),
      ...bar(294, 0.24, 0.3, 0.6),
    ],
  },

  /** A hero bound in the draft: a wooden clasp snapping shut, two bars answering. */
  'pact.bind': {
    gain: 0.63,
    jitter: 0.008,
    voices: [...woodBlock(980, 0, 0.4), ...woodBlock(1320, 0.05, 0.3), ...marimba(659, 0.08, 0.26, 0.3), ...bar(988, 0.14, 0.26, 0.42)],
  },

  /** Gear going onto a hero: a buckle in two clicks and one bar. */
  equip: {
    gain: 0.39,
    jitter: 0.05,
    voices: [...woodBlock(1700, 0, 0.3), ...woodBlock(1250, 0.06, 0.34), ...bar(784, 0.07, 0.18, 0.24)],
  },

  /** A Recruit Contract signed: paper, a wooden stamp, then one held bar. */
  'contract.sign': {
    gain: 0.38,
    jitter: 0.02,
    voices: [...paper(0, 0.18), ...felt(150, 0.07, 0.42, 0.18), ...woodBlock(600, 0.07, 0.3), ...marimba(392, 0.16, 0.24, 0.5), ...bar(1175, 0.18, 0.08, 0.4)],
  },

  /** A name written across a contract: five strokes of nib and the lift off the flourish. Paper never rings. */
  'quill.scratch': {
    gain: 0.3,
    jitter: 0.04,
    voices: [
      { wave: 'noise', gain: 0.3, attack: 0.01, hold: 0.06, decay: 0.05, filter: { type: 'bandpass', freq: 3800, freqEnd: 5200, q: 3 } },
      { wave: 'noise', gain: 0.26, attack: 0.01, hold: 0.05, decay: 0.05, delay: 0.15, filter: { type: 'bandpass', freq: 4600, freqEnd: 3200, q: 3 } },
      { wave: 'noise', gain: 0.3, attack: 0.01, hold: 0.08, decay: 0.06, delay: 0.3, filter: { type: 'bandpass', freq: 3400, freqEnd: 5600, q: 3 } },
      { wave: 'noise', gain: 0.22, attack: 0.008, hold: 0.04, decay: 0.05, delay: 0.48, filter: { type: 'bandpass', freq: 5000, freqEnd: 3600, q: 3 } },
      { wave: 'noise', gain: 0.28, attack: 0.01, hold: 0.12, decay: 0.08, delay: 0.6, filter: { type: 'bandpass', freq: 3600, freqEnd: 6000, q: 2.5 } },
      ...xylo(2637, 0.82, 0.06, 0.1),
    ],
  },

  /** The seal pressed on: a rubber stamp's soft thunk and a little wooden rock as it lifts. */
  'wax.stamp': {
    gain: 0.5,
    jitter: 0.02,
    voices: [...felt(130, 0, 0.5, 0.2), ...woodBlock(540, 0.01, 0.26), ...woodBlock(720, 0.09, 0.14)],
  },

  /** An Evolution charging: a slide whistle climbing three octaves over a swelling shaker, a marimba roll speeding up under it. */
  'evolve.charge': {
    gain: 0.85,
    jitter: 0,
    voices: [
      ...slide(131, 1047, 0, 0.16, 0.4, 2.7),
      ...shaker(0, 0.16, 0.4, 2.8),
      ...bar(262, 0.4, 0.12, 0.2),
      ...bar(330, 1.0, 0.13, 0.2),
      ...bar(392, 1.5, 0.14, 0.2),
      ...bar(523, 1.9, 0.15, 0.2),
      ...bar(659, 2.2, 0.16, 0.2),
      ...bar(784, 2.45, 0.17, 0.2),
      ...bar(1047, 2.65, 0.18, 0.2),
      ...bar(1319, 2.8, 0.19, 0.2),
    ],
  },

  /** The new form revealed: a xylophone run up to a held marimba chord with a drum under it. */
  'evolve.fanfare': {
    gain: 0.38,
    jitter: 0,
    voices: [
      ...xylo(784, 0, 0.2, 0.14),
      ...xylo(1047, 0.11, 0.2, 0.14),
      ...xylo(1319, 0.22, 0.2, 0.14),
      ...xylo(1568, 0.33, 0.22, 0.14),
      ...felt(131, 0.48, 0.44, 0.4),
      ...marimba(1047, 0.48, 0.3, 1.2),
      ...bar(659, 0.48, 0.2, 1.1),
      ...bar(784, 0.48, 0.18, 1.1),
      ...bar(262, 0.48, 0.28, 1.1),
      ...xylo(2093, 0.56, 0.1, 0.5),
      ...shaker(0.44, 0.1, 0.6, 0.06),
    ],
  },

  /** Arriving at a blessing shrine. Fires on a mount, not a press, so a soft roll that starts quiet; pitched per shrine. */
  shrine: {
    gain: 0.66,
    jitter: 0.004,
    voices: [
      ...bar(262, 0.16, 0.12, 0.5, 0.04),
      ...bar(392, 0.28, 0.16, 0.5, 0.03),
      ...bar(523, 0.4, 0.22, 0.7, 0.02),
      ...bar(784, 0.52, 0.2, 0.9, 0.02),
      ...bar(131, 0.16, 0.24, 1.1, 0.2),
    ],
  },

  /** A scroll unrolled onto a hero: the paper, then two bars a fifth apart. Re-pitched up on the spend that ranks. */
  'scroll.spend': {
    gain: 0.32,
    jitter: 0.005,
    voices: [...swish(900, 4200, 0, 0.16, 0.26, 0.006), ...marimba(523, 0, 0.2, 0.26), ...bar(784, 0.1, 0.18, 0.34)],
  },

  /** A Gem set into a hero: a click into the socket, then two xylophone bars. Re-pitched by stat. */
  'gem.set': {
    gain: 0.45,
    jitter: 0.008,
    voices: [...woodBlock(2400, 0, 0.18), ...xylo(1047, 0.01, 0.2, 0.3), ...xylo(1568, 0.05, 0.16, 0.4)],
  },

  /** One piece of loot popping up: a pop, then three xylophone bars climbing. The caller raises pitch piece by piece. */
  'loot.twinkle': {
    gain: 0.23,
    jitter: 0.01,
    voices: [
      { wave: 'sine', freq: 520, freqEnd: 1240, gain: 0.2, attack: 0.001, decay: 0.05 },
      ...xylo(2093, 0.03, 0.12, 0.2),
      ...xylo(2637, 0.07, 0.1, 0.24),
      ...xylo(3136, 0.11, 0.09, 0.3),
    ],
  },

  /** A shrine's grant landing: a marimba chord rolled up, same per-shrine pitch. */
  blessing: {
    gain: 0.56,
    jitter: 0.006,
    voices: [...marimba(392, 0, 0.26, 0.5), ...bar(587, 0.07, 0.22, 0.55), ...bar(784, 0.14, 0.2, 0.7), ...bar(196, 0, 0.26, 0.6), ...xylo(1568, 0.16, 0.08, 0.5)],
  },

  /** A Class conferred: a sus4 chord struck whole, a late xylophone bar. Timed to rite-reveal-flash. */
  'class.learn': {
    gain: 0.54,
    jitter: 0.004,
    voices: [...felt(147, 0, 0.36, 0.3), ...marimba(294, 0, 0.26, 0.7), ...bar(392, 0, 0.22, 0.7), ...bar(588, 0, 0.18, 0.75), ...xylo(1176, 0.12, 0.12, 0.6)],
  },

  /** A cache lid: a wooden latch, the lid knocking open, then a chord spilling out. */
  'cache.open': {
    gain: 0.47,
    jitter: 0.02,
    voices: [...woodBlock(1400, 0, 0.3), ...woodBlock(460, 0.04, 0.36), ...marimba(523, 0.13, 0.22, 0.5), ...bar(659, 0.17, 0.2, 0.55), ...bar(784, 0.21, 0.2, 0.7)],
  },

  /** A toy hammer on a wooden peg. The beat plays it three times with a rising pitch. */
  'anvil.strike': {
    gain: 0.39,
    jitter: 0.015,
    voices: [...woodBlock(900, 0, 0.44), ...felt(160, 0, 0.36, 0.12)],
  },

  /** The last strike's ring: two xylophone bars left to sing. */
  'anvil.ring': {
    gain: 0.44,
    jitter: 0.01,
    voices: [...woodBlock(1100, 0, 0.3), ...xylo(1244, 0, 0.22, 0.8), ...xylo(1865, 0.02, 0.16, 0.9), ...xylo(2489, 0.12, 0.1, 0.9)],
  },

  /** Hot metal into the trough: a bloop, then a short soft hiss. */
  'forge.quench': {
    gain: 0.82,
    jitter: 0.03,
    voices: [
      { wave: 'sine', freq: 300, freqEnd: 760, gain: 0.3, attack: 0.002, decay: 0.08 },
      { wave: 'noise', gain: 0.2, attack: 0.03, hold: 0.12, decay: 0.4, filter: { type: 'highpass', freq: 4200, freqEnd: 7000, q: 0.7 } },
    ],
  },

  /** The forge breathing up: a soft whoosh rising. */
  'forge.roar': {
    gain: 0.88,
    jitter: 0.02,
    voices: [...swish(300, 1600, 0, 0.3, 0.5, 0.35), ...shaker(0.2, 0.06, 0.4, 0.2)],
  },

  /** An enchantment drawing in: a slide whistle rising under three xylophone bars climbing with it. */
  'enchant.bind': {
    gain: 0.68,
    jitter: 0.02,
    voices: [...slide(392, 1175, 0, 0.12, 0.4, 0.5), ...xylo(784, 0.3, 0.14, 0.3), ...xylo(1175, 0.55, 0.14, 0.34), ...xylo(1568, 0.8, 0.14, 0.45)],
  },

  /** One coin onto a pile, ~70ms apart with a rising pitch: a xylophone plink. Heavy jitter so a run of them reads as coins, not a machine. */
  'gold.coin': { gain: 0.4, jitter: 0.05, voices: xylo(1760, 0, 0.18, 0.09) },

  /** The pile settling: a wooden box thunk and one bar. */
  'gold.purse': {
    gain: 0.34,
    jitter: 0.01,
    voices: [...woodBlock(520, 0, 0.36), ...felt(150, 0, 0.3, 0.14), ...bar(880, 0.02, 0.2, 0.36)],
  },

  /** One hero's row landing on the level-up report, re-pitched up the roster. Short: six can fire in 1.4s. */
  'xp.orb': { gain: 0.35, jitter: 0.006, voices: marimba(784, 0, 0.26, 0.14) },

  /** An event on mount: a soft roll on a suspended fourth, left unresolved. Pitched per tone. */
  discovery: {
    gain: 0.43,
    jitter: 0.006,
    voices: [
      ...bar(233, 0.16, 0.12, 0.5, 0.04),
      ...bar(349, 0.3, 0.16, 0.6, 0.03),
      ...bar(466, 0.44, 0.2, 0.9, 0.02),
      ...bar(117, 0.16, 0.22, 1.0, 0.2),
    ],
  },

  /** A warden's socket struck through: a wooden crack, a drum, and a fifth rising, so a lock gives rather than a hit lands. */
  'seal.strike': {
    gain: 0.56,
    jitter: 0.01,
    voices: [...woodBlock(1300, 0, 0.36), ...felt(140, 0.055, 0.44, 0.24), ...marimba(330, 0.09, 0.24, 0.3), ...bar(494, 0.15, 0.22, 0.5)],
  },

  /** A spent star lifting: two xylophone bars a fifth apart, sliding up the way the token climbs. Re-pitched per star. */
  'star.rise': {
    gain: 0.34,
    jitter: 0.01,
    voices: [...xylo(1319, 0, 0.18, 0.3), ...xylo(1976, 0.06, 0.14, 0.36), ...slide(1319, 2637, 0, 0.06, 0.4, 0.06)],
  },

  /** The star letting go of the sky: a slide whistle falling through a swish — the one sound here that travels down. */
  'star.fall': {
    gain: 0.6,
    jitter: 0.01,
    voices: [...slide(1568, 392, 0, 0.18, 0.55, 0.04), ...swish(5200, 600, 0, 0.2, 0.55, 0.1)],
  },

  /** The star landing and a hero standing up out of it: a drum, then a bar ringing up a beat later. */
  'star.land': {
    gain: 0.3,
    jitter: 0.006,
    voices: [...felt(110, 0, 0.56, 0.5), ...woodBlock(640, 0, 0.3), ...marimba(392, 0.16, 0.24, 0.5), ...bar(587, 0.22, 0.24, 0.8), ...xylo(1175, 0.24, 0.1, 0.7)],
  },

  /** The summoning wheel passing a sigil: one tiny tick, re-pitched as it slows. */
  'star.tick': { gain: 0.15, jitter: 0.02, voices: woodBlock(2600, 0, 0.18) },

  /** The wheel stopping on the hero's type: a block and a bar chord, so the answer lands before the star. */
  'star.lock': {
    gain: 0.5,
    jitter: 0.004,
    voices: [...woodBlock(1000, 0, 0.34), ...felt(131, 0, 0.3, 0.3), ...marimba(523, 0, 0.24, 1.0), ...bar(784, 0.02, 0.18, 1.1), ...xylo(1568, 0.05, 0.1, 0.9)],
  },

  /** The answering star swelling: a slide whistle climbing two octaves over a shaker swelling. */
  'star.charge': {
    gain: 0.5,
    jitter: 0,
    voices: [...slide(196, 784, 0, 0.18, 0.2, 0.75), ...shaker(0, 0.14, 0.2, 0.8)],
  },

  /** The hero coloured in: the Starfall's one fanfare, a marimba arpeggio left ringing. */
  'star.reveal': {
    gain: 0.51,
    jitter: 0,
    voices: [
      ...marimba(392, 0, 0.22, 1.0),
      ...marimba(494, 0.09, 0.2, 1.0),
      ...marimba(587, 0.18, 0.2, 1.1),
      ...marimba(784, 0.27, 0.22, 1.4),
      ...xylo(1568, 0.3, 0.1, 1.0),
    ],
  },

  /** A champion's star lighting: a xylophone arpeggio climbing off a soft drum. */
  'star.earn': {
    gain: 0.57,
    jitter: 0.004,
    voices: [...felt(196, 0, 0.3, 0.4), ...xylo(784, 0, 0.2, 0.8), ...xylo(1175, 0.06, 0.16, 0.8), ...xylo(1568, 0.12, 0.14, 0.9), ...xylo(2349, 0.18, 0.1, 0.9)],
  },

  /** The fifth socket — the ring letting go: a drum and a clatter of blocks, a marimba falling away. Ends lower than it starts. */
  'seal.shatter': {
    gain: 0.49,
    jitter: 0.008,
    voices: [
      ...felt(110, 0, 0.56, 0.5),
      ...woodBlock(1400, 0, 0.3),
      ...woodBlock(1050, 0.07, 0.26),
      ...woodBlock(1250, 0.13, 0.22),
      ...woodBlock(880, 0.19, 0.2),
      ...marimba(330, 0.06, 0.24, 0.3),
      ...bar(220, 0.24, 0.24, 0.8),
    ],
  },

  /** The run's cold open, under the black: a slow low marimba roll in a minor key. Not loud — the lowest thing in the box. */
  'titan.stir': {
    gain: 0.88,
    jitter: 0,
    voices: [
      ...bar(110, 0.2, 0.2, 0.8, 0.06),
      ...bar(131, 0.7, 0.22, 0.8, 0.06),
      ...bar(165, 1.2, 0.24, 0.9, 0.06),
      ...bar(156, 1.8, 0.26, 1.6, 0.06),
      ...felt(55, 0, 0.36, 1.6),
      ...felt(55, 1.8, 0.3, 1.4),
    ],
  },

  /** The eyes reaching open: a low wooden knock and a slide whistle sinking. */
  'titan.gaze': {
    gain: 0.32,
    jitter: 0,
    voices: [...woodBlock(300, 0, 0.42), ...felt(78, 0, 0.4, 0.5), ...slide(330, 165, 0.04, 0.16, 0.7, 0.05)],
  },

  /** The route drawing forward: one swish climbing with a soft slide whistle under it. */
  'map.path': {
    gain: 0.8,
    jitter: 0.03,
    voices: [...swish(420, 2400, 0, 0.24, 0.42, 0.06), ...slide(294, 587, 0, 0.14, 0.38, 0.05)],
  },

  /** Setting off down a path: the game piece knocked down, then a marimba fifth climbing — the map's one commit. */
  'map.select': {
    gain: 0.53,
    jitter: 0.015,
    voices: [...woodBlock(700, 0, 0.44), ...felt(130, 0, 0.36, 0.14), ...marimba(392, 0.02, 0.28, 0.16), ...bar(587, 0.08, 0.28, 0.3), ...xylo(1175, 0.1, 0.1, 0.3)],
  },

  /** The Guardian's gate opening: a latch, the doors creaking in, and a drum as they meet the walls. */
  'map.gate': {
    gain: 0.4,
    jitter: 0.008,
    voices: [
      ...woodBlock(1300, 0, 0.34),
      { wave: 'noise', gain: 0.3, attack: 0.18, hold: 0.25, decay: 0.3, delay: 0.2, filter: { type: 'bandpass', freq: 500, freqEnd: 1100, q: 6 } },
      ...slide(196, 247, 0.22, 0.12, 0.4, 0.2),
      ...felt(98, 0.72, 0.56, 0.6),
      ...marimba(196, 0.72, 0.26, 0.7),
      ...bar(294, 0.78, 0.22, 0.7),
    ],
  },

  /** A path reaching something worth having (pitched down for a landmark): a game piece set down and a bar ringing a fifth. */
  'map.boon': {
    gain: 0.35,
    jitter: 0.015,
    voices: [...woodBlock(620, 0, 0.4), ...marimba(784, 0.03, 0.28, 0.3), ...bar(1175, 0.08, 0.2, 0.36)],
  },

  /** A path reaching something that fights back: low blocks falling a semitone. The Guardian is this at 0.66 pitch, so it is authored with room to drop. */
  'map.threat': {
    gain: 0.35,
    jitter: 0.02,
    voices: [...felt(130, 0, 0.44, 0.3), ...woodBlock(400, 0, 0.32), ...marimba(220, 0.02, 0.26, 0.2), ...bar(208, 0.14, 0.26, 0.36)],
  },

  /** The Huntress arriving: the bow's twang, the arrow's swish, the thunk of it landing, the swoop, and her boots. */
  'patron.huntress': {
    gain: 0.3,
    jitter: 0.02,
    voices: [
      { wave: 'triangle', freq: 233, freqEnd: 208, gain: 0.2, attack: 0.002, decay: 0.2 },
      ...swish(5200, 1800, 0.02, 0.2, 0.15, 0.02),
      ...woodBlock(700, 0.298, 0.38),
      ...swish(800, 3200, 0.42, 0.18, 0.24, 0.09),
      ...felt(110, 0.98, 0.34, 0.1),
    ],
  },

  /** The Forgemistress arriving: heat rising, one toy hammer blow, sparks plinking out. */
  'patron.forgemistress': {
    gain: 0.5,
    jitter: 0.015,
    voices: [
      ...swish(380, 1500, 0, 0.12, 0.06, 0.2),
      ...woodBlock(900, 0.42, 0.44),
      ...felt(120, 0.42, 0.38, 0.14),
      ...xylo(1244, 0.427, 0.16, 0.5),
      ...xylo(2489, 0.507, 0.08, 0.1),
      ...xylo(2960, 0.595, 0.07, 0.1),
      ...xylo(2217, 0.717, 0.06, 0.1),
      ...xylo(2793, 0.875, 0.05, 0.1),
    ],
  },

  /** The Swordsman arriving: the rush of his fall, a toy blade's shing, his boots. */
  'patron.swordsman': {
    gain: 0.52,
    jitter: 0.02,
    voices: [
      ...swish(2600, 600, 0, 0.2, 0.2, 0.06),
      ...swish(7200, 3000, 0.438, 0.16, 0.1, 0.002),
      ...xylo(1760, 0.455, 0.14, 0.5),
      ...xylo(2637, 0.455, 0.08, 0.4),
      ...felt(120, 0.507, 0.4, 0.12),
    ],
  },

  /** Blip setting off: three syllables climbing. */
  'blip.chirp': {
    gain: 0.22,
    jitter: 0.05,
    voices: [
      { wave: 'sawtooth', freq: 360, freqEnd: 375, gain: 0.5, attack: 0.012, decay: 0.07, filter: { type: 'bandpass', freq: 1000, q: 5 } },
      { wave: 'sawtooth', freq: 400, freqEnd: 416, gain: 0.5, attack: 0.012, decay: 0.07, delay: 0.08, filter: { type: 'bandpass', freq: 1300, q: 5 } },
      { wave: 'sawtooth', freq: 520, freqEnd: 640, gain: 0.5, attack: 0.012, decay: 0.12, delay: 0.16, filter: { type: 'bandpass', freq: 1100, q: 5 } },
    ],
  },

  /** Blip poked: a quick rising giggle, four syllables tumbling up. */
  'blip.giggle': {
    gain: 0.22,
    jitter: 0.06,
    voices: [
      { wave: 'sawtooth', freq: 520, freqEnd: 600, gain: 0.5, attack: 0.008, decay: 0.05, filter: { type: 'bandpass', freq: 1400, q: 5 } },
      { wave: 'sawtooth', freq: 560, freqEnd: 650, gain: 0.45, attack: 0.008, decay: 0.05, delay: 0.07, filter: { type: 'bandpass', freq: 1500, q: 5 } },
      { wave: 'sawtooth', freq: 610, freqEnd: 700, gain: 0.4, attack: 0.008, decay: 0.05, delay: 0.14, filter: { type: 'bandpass', freq: 1600, q: 5 } },
      { wave: 'sawtooth', freq: 660, freqEnd: 820, gain: 0.35, attack: 0.008, decay: 0.08, delay: 0.21, filter: { type: 'bandpass', freq: 1700, q: 5 } },
    ],
  },

  /** Blip delighted: a little three-note rise, the last one sung. */
  'blip.win': {
    gain: 0.24,
    jitter: 0.02,
    voices: [
      { wave: 'sawtooth', freq: 440, freqEnd: 458, gain: 0.5, attack: 0.012, decay: 0.08, filter: { type: 'bandpass', freq: 1200, q: 5 } },
      { wave: 'sawtooth', freq: 554, freqEnd: 576, gain: 0.5, attack: 0.012, decay: 0.08, delay: 0.09, filter: { type: 'bandpass', freq: 1200, q: 5 } },
      { wave: 'sawtooth', freq: 660, freqEnd: 800, gain: 0.5, attack: 0.012, decay: 0.2, delay: 0.18, filter: { type: 'bandpass', freq: 1400, q: 5 } },
    ],
  },

  /** Blip let down: two sighing syllables, falling. */
  'blip.lose': {
    gain: 0.22,
    jitter: 0.02,
    voices: [
      { wave: 'sawtooth', freq: 420, freqEnd: 340, gain: 0.5, attack: 0.02, decay: 0.18, filter: { type: 'bandpass', freq: 900, q: 5 } },
      { wave: 'sawtooth', freq: 330, freqEnd: 250, gain: 0.5, attack: 0.02, decay: 0.32, delay: 0.2, filter: { type: 'bandpass', freq: 800, q: 5 } },
    ],
  },

  /** The Archmage arriving: a slide whistle rising as the circle draws, three bars climbing with it, and the pop that puts him there. */
  'patron.archmage': {
    gain: 0.37,
    jitter: 0.02,
    voices: [
      ...slide(220, 880, 0, 0.1, 0.12, 0.25),
      ...xylo(1047, 0.14, 0.12, 0.26),
      ...xylo(1319, 0.315, 0.12, 0.26),
      ...xylo(1568, 0.49, 0.12, 0.3),
      { wave: 'sine', freq: 440, freqEnd: 1320, gain: 0.22, attack: 0.001, decay: 0.06, delay: 0.595 },
    ],
  },

  /** The Priest arriving: a soft chord swelling as the light comes down, one bar struck as he stands in it. */
  'patron.priest': {
    gain: 0.71,
    jitter: 0.01,
    voices: [
      ...bar(392, 0, 0.07, 0.6, 0.25),
      ...bar(494, 0, 0.06, 0.6, 0.25),
      ...bar(587, 0, 0.06, 0.6, 0.25),
      ...marimba(523, 0.385, 0.24, 1.0),
      ...xylo(1047, 0.385, 0.1, 0.8),
    ],
  },

  /** The Hexwright arriving: a low wobble rising out of the ground with the smoke, two whispers through it, one plink. */
  'patron.hexwright': {
    gain: 0.37,
    jitter: 0.02,
    voices: [
      { wave: 'sine', freq: 147, freqEnd: 165, detune: 30, gain: 0.22, attack: 0.18, hold: 0.35, decay: 0.4 },
      { wave: 'noise', gain: 0.12, attack: 0.12, decay: 0.24, delay: 0.07, filter: { type: 'bandpass', freq: 2600, freqEnd: 1200, q: 6 } },
      { wave: 'noise', gain: 0.1, attack: 0.1, decay: 0.24, delay: 0.49, filter: { type: 'bandpass', freq: 3300, freqEnd: 1800, q: 6 } },
      ...xylo(988, 0.77, 0.1, 0.3),
    ],
  },

  /** The Headmaster arriving: pages fluttering in, then a book clapped shut. */
  'patron.headmaster': {
    gain: 0.28,
    jitter: 0.02,
    voices: [
      ...paper(0, 0.12),
      ...paper(0.123, 0.11),
      ...paper(0.245, 0.12),
      ...paper(0.367, 0.11),
      ...paper(0.507, 0.1),
      ...felt(140, 0.735, 0.4, 0.12),
      ...woodBlock(560, 0.735, 0.3),
    ],
  },

  /** A patron's Trust rising: three bars climbing a fifth over a soft bass. TrustRise lifts the pitch a step each rung. */
  'trust.rise': {
    gain: 0.54,
    jitter: 0.01,
    voices: [...bar(196, 0, 0.18, 0.6, 0.02), ...marimba(659, 0, 0.2, 0.5), ...marimba(988, 0.09, 0.18, 0.6), ...marimba(1319, 0.18, 0.18, 0.8)],
  },

  /** The fifth Trust pip igniting: a shaker swell breaking into a drum and a held major chord. */
  'trust.capstone': {
    gain: 0.58,
    jitter: 0,
    voices: [
      ...shaker(0, 0.12, 0.08, 0.9),
      ...slide(196, 392, 0, 0.1, 0.06, 0.9),
      ...felt(98, 0.92, 0.5, 0.6),
      ...marimba(262, 0.92, 0.2, 1.2),
      ...bar(330, 0.95, 0.18, 1.2),
      ...bar(392, 0.98, 0.18, 1.2),
      ...xylo(1047, 1.02, 0.12, 1.0),
      ...xylo(1568, 1.1, 0.08, 1.0),
    ],
  },

  /** "X uses Y": a wind-up, not an event — a quick swish and a tick. The impact follows at once. */
  cast: {
    gain: 0.52,
    jitter: 0.04,
    voices: [...swish(900, 2200, 0, 0.3, 0.1, 0.04), ...woodBlock(1800, 0.08, 0.12)],
  },

  /* The element itself, layered under the beat its payload lands on. Under 0.5s, and the low end left to the hit
     except where the element is itself a weight (Stone, Ancient, Storm's thunder). */

  /** Fire: a whoosh, and pops crackling on it. */
  'cast.Fire': {
    gain: 0.95,
    jitter: 0.05,
    voices: [
      ...swish(380, 1900, 0, 0.4, 0.3, 0.04),
      { wave: 'sine', freq: 600, freqEnd: 1400, gain: 0.16, attack: 0.001, decay: 0.03, delay: 0.09 },
      { wave: 'sine', freq: 700, freqEnd: 1600, gain: 0.14, attack: 0.001, decay: 0.03, delay: 0.17 },
      { wave: 'sine', freq: 520, freqEnd: 1300, gain: 0.15, attack: 0.001, decay: 0.03, delay: 0.26 },
    ],
  },

  /** Water: a splash settling, two bubbles blooping up. */
  'cast.Water': {
    gain: 0.93,
    jitter: 0.05,
    voices: [
      { wave: 'noise', gain: 0.3, attack: 0.012, decay: 0.28, filter: { type: 'lowpass', freq: 3000, freqEnd: 420, q: 0.9 } },
      { wave: 'sine', freq: 260, freqEnd: 700, gain: 0.26, attack: 0.002, decay: 0.07 },
      { wave: 'sine', freq: 320, freqEnd: 900, gain: 0.2, attack: 0.002, decay: 0.06, delay: 0.13 },
      { wave: 'sine', freq: 380, freqEnd: 1000, gain: 0.16, attack: 0.002, decay: 0.05, delay: 0.22 },
    ],
  },

  /** Frost: three high xylophone bars tinkling down, a brittle tick on top. */
  'cast.Frost': {
    gain: 0.85,
    jitter: 0.03,
    voices: [...woodBlock(4200, 0, 0.1), ...xylo(3136, 0, 0.14, 0.2), ...xylo(2637, 0.05, 0.14, 0.22), ...xylo(2093, 0.1, 0.14, 0.3), ...shaker(0, 0.08, 0.3, 0.06)],
  },

  /** Storm: a cartoon zap, then a drum roll of toy thunder behind it. */
  'cast.Storm': {
    gain: 0.96,
    jitter: 0.04,
    voices: [
      { wave: 'square', freq: 1800, freqEnd: 300, gain: 0.12, attack: 0.001, decay: 0.08, filter: { type: 'lowpass', freq: 4000, q: 1 } },
      ...shaker(0, 0.2, 0.06, 0.002),
      ...felt(90, 0.04, 0.4, 0.2),
      ...felt(80, 0.12, 0.32, 0.2),
      ...felt(70, 0.2, 0.26, 0.26),
    ],
  },

  /** Stone: wooden blocks tumbling, one heavy and two smaller after it. */
  'cast.Stone': {
    gain: 0.34,
    jitter: 0.05,
    voices: [...felt(110, 0, 0.44, 0.2), ...woodBlock(360, 0, 0.36), ...woodBlock(460, 0.15, 0.26), ...woodBlock(540, 0.27, 0.2)],
  },

  /** Nature: leaves rustling, and two soft bars lifting off. */
  'cast.Nature': {
    gain: 0.7,
    jitter: 0.04,
    voices: [...shaker(0, 0.12, 0.3, 0.06), ...swish(1300, 2800, 0, 0.24, 0.3, 0.06), ...marimba(659, 0.04, 0.16, 0.24), ...marimba(988, 0.12, 0.14, 0.28)],
  },

  /** Light: a quick xylophone run up, no low end at all. */
  'cast.Light': {
    gain: 0.97,
    jitter: 0.02,
    voices: [...xylo(1047, 0, 0.14, 0.18), ...xylo(1319, 0.04, 0.14, 0.18), ...xylo(1568, 0.08, 0.14, 0.2), ...xylo(2093, 0.12, 0.16, 0.36)],
  },

  /** Shadow: a hush, and a slide whistle sinking through it — spooky, not menacing. */
  'cast.Shadow': {
    gain: 0.74,
    jitter: 0.04,
    voices: [...swish(900, 300, 0, 0.24, 0.4, 0.08), ...slide(523, 196, 0.02, 0.18, 0.44, 0.06), ...bar(147, 0, 0.16, 0.4, 0.04)],
  },

  /** Arcane: a little boing, then sparkling xylophone bars. */
  'cast.Arcane': {
    gain: 0.49,
    jitter: 0.03,
    voices: [
      { wave: 'sine', freq: 330, freqEnd: 990, detune: 40, gain: 0.16, attack: 0.002, decay: 0.12 },
      ...xylo(1568, 0.06, 0.12, 0.2),
      ...xylo(2093, 0.11, 0.12, 0.24),
      ...xylo(2637, 0.16, 0.1, 0.3),
    ],
  },

  /** Mind: a wobbling wah-wah, two pairs beating against each other. */
  'cast.Mind': {
    gain: 0.31,
    jitter: 0.03,
    voices: [
      { wave: 'sine', freq: 523, detune: 60, gain: 0.24, attack: 0.03, hold: 0.1, decay: 0.3 },
      { wave: 'sine', freq: 784, freqEnd: 587, detune: 40, gain: 0.14, attack: 0.02, decay: 0.36 },
      ...bar(262, 0, 0.14, 0.3, 0.02),
    ],
  },

  /** Spirit: soft bars a fifth apart, slow to speak, nothing struck. */
  'cast.Spirit': {
    gain: 0.59,
    jitter: 0.02,
    voices: [...bar(659, 0, 0.2, 0.5, 0.1), ...bar(988, 0.06, 0.14, 0.5, 0.12), ...shaker(0, 0.06, 0.4, 0.15)],
  },

  /** Iron: a toy blade's swipe and a bright clean shing. */
  'cast.Iron': {
    gain: 0.71,
    jitter: 0.04,
    voices: [...swish(700, 3600, 0, 0.22, 0.12, 0.03), ...woodBlock(2200, 0.06, 0.2), ...xylo(2349, 0.06, 0.16, 0.3), ...xylo(3520, 0.06, 0.08, 0.24)],
  },

  /** Mech: a wind-up ratchet clicking, then a clack as it locks. */
  'cast.Mech': {
    gain: 0.49,
    jitter: 0.03,
    voices: [
      ...woodBlock(1900, 0, 0.16),
      ...woodBlock(2000, 0.04, 0.16),
      ...woodBlock(2100, 0.08, 0.17),
      ...woodBlock(2200, 0.12, 0.18),
      ...woodBlock(2300, 0.16, 0.18),
      ...woodBlock(800, 0.21, 0.4),
    ],
  },

  /** Beast: a little cartoon growl and a hop. */
  'cast.Beast': {
    gain: 0.52,
    jitter: 0.05,
    voices: [
      { wave: 'triangle', freq: 150, freqEnd: 110, detune: 50, gain: 0.3, attack: 0.02, hold: 0.08, decay: 0.2, filter: { type: 'lowpass', freq: 900, q: 1.2 } },
      ...swish(1200, 500, 0, 0.2, 0.2, 0.02),
      ...woodBlock(500, 0.22, 0.28),
    ],
  },

  /** Ancient: a low marimba bar under a temple block, the one cast allowed to outlast its beat. */
  'cast.Ancient': {
    gain: 0.5,
    jitter: 0.015,
    voices: [...woodBlock(330, 0, 0.36), ...felt(98, 0, 0.4, 0.5), ...marimba(98, 0.01, 0.36, 1.0), ...bar(147, 0.02, 0.2, 0.9)],
  },

  /** Physical hit: a felt mallet on a drum, then a wooden clack. beatSfx re-pitches it by damage. */
  'hit.physical': {
    gain: 0.66,
    jitter: 0.07,
    voices: [
      { wave: 'sine', freq: 210, freqEnd: 95, gain: 0.6, attack: 0.001, decay: 0.14 },
      { wave: 'noise', gain: 0.5, attack: 0.001, decay: 0.06, filter: { type: 'lowpass', freq: 1400, freqEnd: 300, q: 1 } },
      ...woodBlock(760, 0.004, 0.32),
    ],
  },

  /** Magical hit: the drum with a springy marimba plonk bending up through it in place of the clack. */
  'hit.magical': {
    gain: 0.73,
    jitter: 0.06,
    voices: [
      { wave: 'sine', freq: 240, freqEnd: 110, gain: 0.5, attack: 0.001, decay: 0.14 },
      { wave: 'noise', gain: 0.3, attack: 0.001, decay: 0.05, filter: { type: 'lowpass', freq: 1800, freqEnd: 400, q: 1 } },
      { wave: 'sine', freq: 520, freqEnd: 780, gain: 0.3, attack: 0.002, decay: 0.16, delay: 0.01 },
      { wave: 'sine', freq: 2080, freqEnd: 3120, gain: 0.06, attack: 0.001, decay: 0.04, delay: 0.01 },
    ],
  },

  /** Layered on top of the base hit: a slapstick crack and two marimba bars bouncing up. */
  'hit.crit': {
    gain: 0.93,
    jitter: 0.03,
    voices: [
      { wave: 'noise', gain: 0.7, attack: 0.001, decay: 0.04, delay: 0.03, filter: { type: 'bandpass', freq: 2200, q: 4 } },
      ...marimba(784, 0.05, 0.28, 0.18),
      ...marimba(1175, 0.11, 0.3, 0.3),
    ],
  },

  /** Under a blow that shakes the arena: a big bass drum and the toy box rattling as it settles. */
  'hit.quake': {
    gain: 0.47,
    jitter: 0.03,
    voices: [...felt(70, 0, 0.66, 0.55), ...shaker(0.03, 0.14, 0.3, 0.02), ...woodBlock(420, 0.08, 0.14), ...woodBlock(480, 0.16, 0.1)],
  },

  /** A hit landing on a Shield: a hollow coconut tok where the drum would thud. */
  'shield.absorb': {
    gain: 0.31,
    jitter: 0.03,
    voices: [...woodBlock(880, 0, 0.36), ...bar(659, 0.005, 0.16, 0.14)],
  },

  /** The Shield going: a wooden crack and the pieces clattering away. */
  'shield.break': {
    gain: 0.8,
    jitter: 0.03,
    voices: [
      { wave: 'noise', gain: 0.6, attack: 0.001, decay: 0.05, filter: { type: 'bandpass', freq: 2000, q: 4 } },
      ...felt(200, 0, 0.3, 0.14),
      ...woodBlock(1500, 0.05, 0.22),
      ...woodBlock(1100, 0.1, 0.2),
      ...woodBlock(1300, 0.16, 0.16),
    ],
  },

  /** Healed: a marimba roll up a major triad. */
  heal: {
    gain: 0.38,
    jitter: 0.01,
    voices: [...marimba(523, 0, 0.3), ...marimba(659, 0.07, 0.28), ...marimba(784, 0.14, 0.28), ...marimba(1047, 0.21, 0.26, 0.5)],
  },

  /** Stat up: two bars hopping up a fifth. */
  buff: {
    gain: 0.59,
    jitter: 0.02,
    voices: [...marimba(392, 0, 0.3, 0.14), ...marimba(587, 0.06, 0.3, 0.24)],
  },

  /** Stat down: two bars sagging down, a little slide between them. */
  debuff: {
    gain: 0.59,
    jitter: 0.02,
    voices: [...marimba(494, 0, 0.3, 0.14), ...slide(494, 330, 0.03, 0.1, 0.1, 0.01), ...marimba(330, 0.08, 0.3, 0.24)],
  },

  /** A condition landing, and DoT ticks: a low cartoon bwomp and a rattle. */
  status: {
    gain: 0.27,
    jitter: 0.06,
    voices: [
      { wave: 'sine', freq: 260, freqEnd: 150, detune: 40, gain: 0.26, attack: 0.006, decay: 0.18 },
      ...shaker(0, 0.12, 0.16, 0.01),
    ],
  },

  /** Conduct going off: a pop and a quick flurry of blocks. */
  detonate: {
    gain: 0.64,
    jitter: 0.05,
    voices: [
      { wave: 'sine', freq: 300, freqEnd: 1200, gain: 0.3, attack: 0.001, decay: 0.05 },
      { wave: 'noise', gain: 0.5, attack: 0.001, decay: 0.06, filter: { type: 'bandpass', freq: 1800, q: 3 } },
      ...felt(130, 0, 0.42, 0.2),
      ...woodBlock(1600, 0.05, 0.18),
      ...woodBlock(1900, 0.09, 0.16),
    ],
  },

  /** Knockout: a slide whistle falling all the way down and a soft bump at the bottom. */
  faint: {
    gain: 0.94,
    jitter: 0.02,
    voices: [...slide(880, 196, 0, 0.3, 0.5, 0.01), ...felt(110, 0.48, 0.4, 0.2)],
  },

  /** Mana returning: two small high bars, out of the way. */
  mana: {
    gain: 0.44,
    jitter: 0.02,
    voices: [...marimba(880, 0, 0.22, 0.3), ...bar(1320, 0.03, 0.14, 0.3)],
  },

  /** A hero arriving: a swish up, then a pop as they land. */
  switchIn: {
    gain: 0.44,
    jitter: 0.04,
    voices: [...swish(420, 2400, 0, 0.36, 0.15, 0.03), { wave: 'sine', freq: 330, freqEnd: 880, gain: 0.24, attack: 0.001, decay: 0.06, delay: 0.11 }, ...woodBlock(1100, 0.11, 0.16)],
  },

  /** A Field Effect taking the battlefield: the one combat sound allowed to be big and slow — a marimba roll climbing the arena. */
  field: {
    gain: 0.35,
    jitter: 0.01,
    voices: [
      ...shaker(0, 0.12, 0.6, 0.18),
      ...bar(262, 0, 0.18, 0.2),
      ...bar(330, 0.08, 0.18, 0.2),
      ...bar(392, 0.16, 0.2, 0.2),
      ...bar(523, 0.24, 0.2, 0.2),
      ...marimba(659, 0.32, 0.22, 0.6),
      ...bar(196, 0.32, 0.2, 0.6),
    ],
  },

  /** The beat a fight opens on: a drum and a marimba call rising. Capped under `entrance.dread` — the frame never outsizes the event. */
  'battle.join': {
    gain: 0.4,
    jitter: 0,
    voices: [...felt(98, 0, 0.56, 0.4), ...woodBlock(600, 0, 0.3), ...marimba(294, 0.12, 0.24, 0.2), ...marimba(440, 0.24, 0.26, 0.5)],
  },

  /** A named enemy's entrance, at most once a run: the biggest sound in the box, a low "dun-dun-duuun" on bass marimba over drums. */
  'entrance.dread': {
    gain: 0.46,
    jitter: 0,
    voices: [
      ...felt(73, 0, 0.5, 0.3),
      ...marimba(147, 0, 0.32, 0.22),
      ...felt(73, 0.26, 0.5, 0.3),
      ...marimba(147, 0.26, 0.32, 0.22),
      ...felt(62, 0.52, 0.6, 0.9),
      ...marimba(131, 0.52, 0.34, 1.1),
      ...bar(156, 0.52, 0.22, 1.1),
      ...slide(330, 196, 0.6, 0.08, 0.8, 0.1),
    ],
  },
};
