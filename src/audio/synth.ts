// Declarative Web Audio voice renderer. Every sound is generated at runtime from a
// SoundSpec (sounds.ts) — no audio assets. Presentation-only: the engine never calls in.

export type Wave = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'noise';

export interface FilterSpec {
  type: BiquadFilterType;
  /** Cutoff/centre in Hz at the voice's start. */
  freq: number;
  /** Cutoff sweep target over the voice's length. */
  freqEnd?: number;
  q?: number;
}

/** One layer of a sound; layers stack in time via `delay`. */
export interface VoiceSpec {
  wave: Wave;
  /** Hz. Ignored by `noise`. */
  freq?: number;
  /** Pitch glide target over the voice's full length. */
  freqEnd?: number;
  /** Glide shape; default exponential. */
  sweep?: 'exp' | 'lin';
  /** Cents. Non-zero runs a second oscillator this far off the first so the pair beats. */
  detune?: number;
  /** Peak level before the sound's own gain and the bus gains. */
  gain: number;
  /** Seconds to peak. Near-0 = click transient. */
  attack: number;
  /** Seconds held at peak before decaying. */
  hold?: number;
  /** Seconds to fall back to silence. */
  decay: number;
  /** Seconds before this voice starts. */
  delay?: number;
  filter?: FilterSpec;
}

export interface SoundSpec {
  voices: VoiceSpec[];
  /** Overall level, on top of each voice's own gain. */
  gain?: number;
  /** Random pitch spread per play, as a fraction (0.06 = ±6%). */
  jitter?: number;
}

export interface PlayOptions {
  /** Multiplies every voice's frequency. */
  pitch?: number;
  /** Multiplies the sound's level. */
  gain?: number;
  /** Seconds to delay the whole sound. */
  delay?: number;
}

// Exponential ramps can't reach 0 and a linear tail to 0 clicks; decay to this, then stop.
const SILENCE = 0.0001;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

// Safety valve: a held auto-advance can queue beats faster than they decay.
let liveVoices = 0;
const MAX_LIVE_VOICES = 24;

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  // Older Safari/webview builds only expose the prefixed constructor.
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  // Separate sfx and music buses so the two faders are independent.
  sfxGain = ctx.createGain();
  sfxGain.connect(masterGain);
  musicGain = ctx.createGain();
  musicGain.connect(masterGain);

  return ctx;
}

/** Resumes the suspended context. Cheap and idempotent — call from any input handler. */
export function unlockAudio(): void {
  const c = ensureContext();
  if (c && c.state === 'suspended') void c.resume();
}

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

function fillNoise(buffer: AudioBuffer): AudioBuffer {
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Two seconds of white noise, generated once and re-triggered as a looping source. */
function getNoiseBuffer(c: BaseAudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  noiseBuffer = fillNoise(c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate));
  return noiseBuffer;
}

type NoiseSource = (c: BaseAudioContext, t0: number, endAt: number) => AudioBufferSourceNode;

const liveNoise: NoiseSource = (c, t0) => {
  const src = c.createBufferSource();
  src.buffer = getNoiseBuffer(c);
  src.loop = true;
  // Random offset so impacts don't all start on the same samples (audible as a "tick").
  src.start(t0, Math.random() * 1.5);
  return src;
};

const offlineNoise: NoiseSource = (c, t0, endAt) => {
  const frames = Math.max(1, Math.ceil(c.sampleRate * (endAt - t0 + 0.05)));
  const src = c.createBufferSource();
  src.buffer = fillNoise(c.createBuffer(1, frames, c.sampleRate));
  src.start(t0);
  return src;
};

function scheduleVoiceOn(
  c: BaseAudioContext,
  destination: GainNode,
  voice: VoiceSpec,
  startAt: number,
  pitch: number,
  level: number,
  noise: NoiseSource
): { sources: AudioScheduledSourceNode[]; env: GainNode; tail: AudioNode } {
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

  const sources: AudioScheduledSourceNode[] = [];

  if (voice.wave === 'noise') {
    const src = noise(c, t0, endAt);
    src.connect(env);
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

  return { sources, env, tail };
}

function scheduleVoice(c: AudioContext, destination: GainNode, voice: VoiceSpec, startAt: number, pitch: number, level: number): void {
  const { sources, env, tail } = scheduleVoiceOn(c, destination, voice, startAt, pitch, level, liveNoise);
  liveVoices += sources.length;
  sources[sources.length - 1].onended = () => {
    liveVoices -= sources.length;
    env.disconnect();
    tail.disconnect();
  };
}

/** Renders one sound. False when audio is unavailable or the voice budget is spent. */
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

/** Offline-renders a sound to raw samples (un-jittered) for the audition page's waveform. */
export async function renderSpec(spec: SoundSpec, seconds = 1.5): Promise<Float32Array | null> {
  const Ctor: typeof OfflineAudioContext | undefined =
    window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctor) return null;

  const sampleRate = 44100;
  const offline = new Ctor(1, Math.ceil(sampleRate * seconds), sampleRate);
  const bus = offline.createGain();
  bus.connect(offline.destination);
  const level = spec.gain ?? 1;
  for (const voice of spec.voices) scheduleVoiceOn(offline, bus, voice, 0, 1, level, offlineNoise);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}
