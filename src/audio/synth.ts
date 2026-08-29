/**
 * The synthesis layer: a tiny declarative Web Audio voice renderer.
 *
 * Every sound in the game is *generated at runtime* from a handful of
 * numbers — no .wav/.mp3 assets, nothing to download, nothing to re-export
 * when a sound needs tuning. A sound is data (see sounds.ts); this file is
 * the only thing that knows what an oscillator is.
 *
 * Why procedural rather than authored files:
 *  - Zero asset weight, which matters for an installed PWA.
 *  - "The crit needs more punch" is a number change in a data table.
 *  - Every sound can be varied per play (pitch/gain/jitter), so the same
 *    hit fired twenty times in a round never machine-guns.
 *
 * This is presentation-only, per the standing separation in CLAUDE.md: the
 * engine never calls into here. The view subscribes to the event stream and
 * decides what to play (beatSfx.ts).
 */

export type Wave = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'noise';

export interface FilterSpec {
  type: BiquadFilterType;
  /** Cutoff/centre in Hz at the voice's start. */
  freq: number;
  /** Cutoff sweep target — the difference between a dull thud and a "pew". */
  freqEnd?: number;
  q?: number;
}

/**
 * One layer of a sound. A sound is a short list of these, offset in time by
 * `delay` — which is how a crit gets its transient, or a heal its chord.
 */
export interface VoiceSpec {
  wave: Wave;
  /** Starting pitch in Hz. Ignored by `noise`. */
  freq?: number;
  /** Pitch glide target over the voice's full length. Below `freq` = a fall. */
  freqEnd?: number;
  /** Glide shape. Exponential reads as musical, linear as mechanical. */
  sweep?: 'exp' | 'lin';
  /**
   * Cents. Non-zero runs a second oscillator this far off the first, which
   * beats against it — the cheapest way to make a tone sound "wide" and
   * slightly unstable. Magic and Arcane hits lean on this.
   */
  detune?: number;
  /** Peak level before the sound's own gain and the bus gains. */
  gain: number;
  /** Seconds to reach peak. Near-0 = a click transient; 0.02+ = a swell. */
  attack: number;
  /** Seconds held at peak before decaying. */
  hold?: number;
  /** Seconds to fall back to silence. Dominates how "big" a sound reads. */
  decay: number;
  /** Seconds to wait before starting — stacks layers in time. */
  delay?: number;
  filter?: FilterSpec;
}

export interface SoundSpec {
  voices: VoiceSpec[];
  /** Overall level for the sound, on top of each voice's own gain. */
  gain?: number;
  /**
   * Random pitch spread per play, as a fraction (0.06 = ±6%). Keeps
   * repeated plays from sounding like a copy-paste. UI sounds want a
   * little; impacts want more.
   */
  jitter?: number;
}

export interface PlayOptions {
  /** Multiplies every voice's frequency. <1 is darker/heavier. */
  pitch?: number;
  /** Multiplies the sound's level. */
  gain?: number;
  /** Seconds to delay the whole sound. */
  delay?: number;
}

/**
 * Web Audio can't ramp to exactly 0 exponentially, and a linear tail to 0
 * clicks. Everything decays toward this instead, then hard-stops.
 */
const SILENCE = 0.0001;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

/**
 * Voices currently scheduled. Purely a safety valve: a held auto-advance
 * can queue beats faster than they decay, and an unbounded pile of
 * oscillators is how a phone browser starts crackling.
 */
let liveVoices = 0;
const MAX_LIVE_VOICES = 24;

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  // Older Safari/webview builds still only expose the prefixed constructor.
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  // Two buses so the atmospheric music tracks can be mixed against the
  // effects independently — a player turning effects down shouldn't also
  // duck the score, and vice versa.
  sfxGain = ctx.createGain();
  sfxGain.connect(masterGain);
  musicGain = ctx.createGain();
  musicGain.connect(masterGain);

  return ctx;
}

/**
 * Browsers start an AudioContext suspended until a real user gesture. Call
 * this from a pointer/key handler; it is cheap and idempotent, so the app
 * just calls it on every input rather than tracking whether it has run.
 */
export function unlockAudio(): void {
  const c = ensureContext();
  if (c && c.state === 'suspended') void c.resume();
}

/** The music bus, for the atmospheric tracks to route through later. */
export function getMusicBus(): { context: AudioContext; bus: GainNode } | null {
  const c = ensureContext();
  if (!c || !musicGain) return null;
  return { context: c, bus: musicGain };
}

export function setMasterVolume(v: number): void {
  const c = ensureContext();
  if (c && masterGain) masterGain.gain.setValueAtTime(clamp01(v), c.currentTime);
}

export function setSfxVolume(v: number): void {
  const c = ensureContext();
  if (c && sfxGain) sfxGain.gain.setValueAtTime(clamp01(v), c.currentTime);
}

export function setMusicVolume(v: number): void {
  const c = ensureContext();
  if (c && musicGain) musicGain.gain.setValueAtTime(clamp01(v), c.currentTime);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Two seconds of white noise, generated once and re-triggered as a looping
 * buffer source. Noise is the backbone of every impact sound — filtered
 * hard it becomes a thump, filtered open it becomes a crack.
 */
function getNoiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const frames = Math.floor(c.sampleRate * 2);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

function scheduleVoice(c: AudioContext, destination: GainNode, voice: VoiceSpec, startAt: number, pitch: number, level: number): void {
  const attack = Math.max(0.001, voice.attack);
  const hold = voice.hold ?? 0;
  const decay = Math.max(0.005, voice.decay);
  const t0 = startAt + (voice.delay ?? 0);
  const peakAt = t0 + attack;
  const decayFrom = peakAt + hold;
  const endAt = decayFrom + decay;

  const env = c.createGain();
  env.gain.setValueAtTime(SILENCE, t0);
  env.gain.linearRampToValueAtTime(Math.max(SILENCE, voice.gain * level), peakAt);
  if (hold > 0) env.gain.setValueAtTime(Math.max(SILENCE, voice.gain * level), decayFrom);
  env.gain.exponentialRampToValueAtTime(SILENCE, endAt);

  let tail: AudioNode = env;
  if (voice.filter) {
    const filter = c.createBiquadFilter();
    filter.type = voice.filter.type;
    filter.Q.value = voice.filter.q ?? 1;
    const fFrom = Math.max(20, voice.filter.freq * pitch);
    filter.frequency.setValueAtTime(fFrom, t0);
    if (voice.filter.freqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, voice.filter.freqEnd * pitch), endAt);
    }
    env.connect(filter);
    tail = filter;
  }
  tail.connect(destination);

  const sources: AudioScheduledSourceNode[] = [];

  if (voice.wave === 'noise') {
    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    src.loop = true;
    // Reading from a random offset stops every impact starting on the same
    // handful of samples, which is otherwise faintly audible as a "tick".
    src.connect(env);
    src.start(t0, Math.random() * 1.5);
    src.stop(endAt);
    sources.push(src);
  } else {
    const freq = Math.max(20, (voice.freq ?? 440) * pitch);
    const freqEnd = voice.freqEnd !== undefined ? Math.max(20, voice.freqEnd * pitch) : undefined;
    const detunes = voice.detune ? [-voice.detune / 2, voice.detune / 2] : [0];
    for (const cents of detunes) {
      const osc = c.createOscillator();
      osc.type = voice.wave;
      osc.detune.value = cents;
      osc.frequency.setValueAtTime(freq, t0);
      if (freqEnd !== undefined) {
        if (voice.sweep === 'lin') osc.frequency.linearRampToValueAtTime(freqEnd, endAt);
        else osc.frequency.exponentialRampToValueAtTime(freqEnd, endAt);
      }
      osc.connect(env);
      osc.start(t0);
      osc.stop(endAt);
      sources.push(osc);
    }
  }

  liveVoices += sources.length;
  const last = sources[sources.length - 1];
  last.onended = () => {
    liveVoices -= sources.length;
    env.disconnect();
    tail.disconnect();
  };
}

/**
 * Renders one sound. Returns false when audio is unavailable or the voice
 * budget is spent, so callers can stay silent rather than throwing.
 */
export function playSpec(spec: SoundSpec, opts: PlayOptions = {}): boolean {
  const c = ensureContext();
  if (!c || !sfxGain) return false;
  if (c.state === 'suspended') return false;
  if (liveVoices >= MAX_LIVE_VOICES) return false;

  const jitter = spec.jitter ?? 0;
  const pitch = (opts.pitch ?? 1) * (jitter ? 1 + (Math.random() * 2 - 1) * jitter : 1);
  const level = (opts.gain ?? 1) * (spec.gain ?? 1);
  const startAt = c.currentTime + (opts.delay ?? 0);

  for (const voice of spec.voices) scheduleVoice(c, sfxGain, voice, startAt, pitch, level);
  return true;
}

/**
 * Offline-renders a sound to raw samples. Used by the audition page to draw
 * a waveform — a sound you can *see* is a sound you can diagnose without
 * guessing at why it feels thin.
 */
export async function renderSpec(spec: SoundSpec, seconds = 1.5): Promise<Float32Array | null> {
  const Ctor: typeof OfflineAudioContext | undefined =
    window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctor) return null;

  const sampleRate = 44100;
  const offline = new Ctor(1, Math.ceil(sampleRate * seconds), sampleRate);
  const bus = offline.createGain();
  bus.connect(offline.destination);
  const level = spec.gain ?? 1;
  // Deliberately un-jittered: the drawn waveform should be the sound's
  // nominal shape, not one random instance of it.
  for (const voice of spec.voices) {
    scheduleOfflineVoice(offline, bus, voice, 0, 1, level);
  }
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/**
 * scheduleVoice's twin for OfflineAudioContext. Kept separate rather than
 * generalised because the live path tracks the voice budget and cleans up
 * on `onended`, neither of which applies (or fires usefully) offline.
 */
function scheduleOfflineVoice(
  c: OfflineAudioContext,
  destination: GainNode,
  voice: VoiceSpec,
  startAt: number,
  pitch: number,
  level: number
): void {
  const attack = Math.max(0.001, voice.attack);
  const hold = voice.hold ?? 0;
  const decay = Math.max(0.005, voice.decay);
  const t0 = startAt + (voice.delay ?? 0);
  const peakAt = t0 + attack;
  const decayFrom = peakAt + hold;
  const endAt = decayFrom + decay;

  const env = c.createGain();
  env.gain.setValueAtTime(SILENCE, t0);
  env.gain.linearRampToValueAtTime(Math.max(SILENCE, voice.gain * level), peakAt);
  if (hold > 0) env.gain.setValueAtTime(Math.max(SILENCE, voice.gain * level), decayFrom);
  env.gain.exponentialRampToValueAtTime(SILENCE, endAt);

  let tail: AudioNode = env;
  if (voice.filter) {
    const filter = c.createBiquadFilter();
    filter.type = voice.filter.type;
    filter.Q.value = voice.filter.q ?? 1;
    filter.frequency.setValueAtTime(Math.max(20, voice.filter.freq * pitch), t0);
    if (voice.filter.freqEnd !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, voice.filter.freqEnd * pitch), endAt);
    }
    env.connect(filter);
    tail = filter;
  }
  tail.connect(destination);

  if (voice.wave === 'noise') {
    const frames = Math.max(1, Math.ceil(c.sampleRate * (endAt - t0 + 0.05)));
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(env);
    src.start(t0);
    src.stop(endAt);
  } else {
    const freq = Math.max(20, (voice.freq ?? 440) * pitch);
    const freqEnd = voice.freqEnd !== undefined ? Math.max(20, voice.freqEnd * pitch) : undefined;
    const detunes = voice.detune ? [-voice.detune / 2, voice.detune / 2] : [0];
    for (const cents of detunes) {
      const osc = c.createOscillator();
      osc.type = voice.wave;
      osc.detune.value = cents;
      osc.frequency.setValueAtTime(freq, t0);
      if (freqEnd !== undefined) {
        if (voice.sweep === 'lin') osc.frequency.linearRampToValueAtTime(freqEnd, endAt);
        else osc.frequency.exponentialRampToValueAtTime(freqEnd, endAt);
      }
      osc.connect(env);
      osc.start(t0);
      osc.stop(endAt);
    }
  }
}
