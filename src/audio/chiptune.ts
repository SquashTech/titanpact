// The chiptune soundtrack's player: four channels (lead, arp, bass, drums) stepped through a song from
// chipSongs.ts on a 16th-note clock, scheduled a little ahead of the audio clock. Presentation only.

import type { ChipSong } from './chipSongs';
import { compileSong, type LeadWave, type NoteEvent } from './chipScore';

function hz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const waves = new WeakMap<BaseAudioContext, { noise: AudioBuffer; pulse25: PeriodicWave; pulse12: PeriodicWave }>();

function pulse(c: BaseAudioContext, duty: number): PeriodicWave {
  const n = 40;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return c.createPeriodicWave(real, imag);
}

function kitFor(c: BaseAudioContext) {
  let kit = waves.get(c);
  if (!kit) {
    const noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    kit = { noise, pulse25: pulse(c, 0.25), pulse12: pulse(c, 0.125) };
    waves.set(c, kit);
  }
  return kit;
}

const SILENCE = 0.0001;

function envelope(c: BaseAudioContext, out: AudioNode, at: number, peak: number, attack: number, decay: number, sustain: number, end: number): GainNode {
  const g = c.createGain();
  const held = Math.max(at + attack + decay, end);
  const s = Math.max(SILENCE, peak * sustain);
  g.gain.setValueAtTime(SILENCE, at);
  g.gain.linearRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(s, at + attack + decay);
  g.gain.setValueAtTime(s, held);
  g.gain.exponentialRampToValueAtTime(SILENCE, held + 0.04);
  g.connect(out);
  return g;
}

function voice(c: BaseAudioContext, wave: LeadWave, freq: number, at: number, end: number, into: GainNode, vibrato: boolean): void {
  const o = c.createOscillator();
  const kit = kitFor(c);
  if (wave === 'pulse25') o.setPeriodicWave(kit.pulse25);
  else if (wave === 'pulse12') o.setPeriodicWave(kit.pulse12);
  else o.type = wave;
  o.frequency.setValueAtTime(freq, at);
  if (vibrato && end - at > 0.3) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, at);
    depth.gain.setValueAtTime(0, at + 0.18);
    depth.gain.linearRampToValueAtTime(freq * 0.012, at + 0.32);
    lfo.connect(depth).connect(o.frequency);
    lfo.start(at);
    lfo.stop(end + 0.08);
  }
  o.connect(into);
  o.start(at);
  o.stop(end + 0.08);
  o.onended = () => into.disconnect();
}

function noiseHit(c: BaseAudioContext, out: AudioNode, at: number, length: number, peak: number, type: BiquadFilterType, freq: number): void {
  const src = c.createBufferSource();
  src.buffer = kitFor(c).noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(peak, at);
  g.gain.exponentialRampToValueAtTime(SILENCE, at + length);
  src.connect(f).connect(g).connect(out);
  src.start(at, Math.random() * 0.5);
  src.stop(at + length + 0.02);
  src.onended = () => g.disconnect();
}

function kick(c: BaseAudioContext, out: AudioNode, at: number, peak: number): void {
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(170, at);
  o.frequency.exponentialRampToValueAtTime(45, at + 0.11);
  const g = c.createGain();
  g.gain.setValueAtTime(peak, at);
  g.gain.exponentialRampToValueAtTime(SILENCE, at + 0.13);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + 0.15);
  o.onended = () => g.disconnect();
}

export interface ChipPlayer {
  /** Fades out over `seconds` and stops scheduling. */
  stop(seconds: number): void;
  /** Tape-style: tempo and pitch move together. */
  setRate(rate: number): void;
}

const LOOKAHEAD = 0.3;
const TICK_MS = 50;

/** Starts a song on `destination`, fading in over `fadeIn` seconds. Loops until stopped. */
export function startSong(c: AudioContext, destination: AudioNode, song: ChipSong, fadeIn: number, rate = 1): ChipPlayer {
  const compiled = compileSong(song);
  const level = c.createGain();
  level.connect(destination);
  const mix = c.createDynamicsCompressor();
  mix.threshold.value = -16;
  mix.ratio.value = 3;
  mix.connect(level);
  const now = c.currentTime;
  level.gain.setValueAtTime(SILENCE, now);
  level.gain.exponentialRampToValueAtTime(song.gain ?? 0.8, now + Math.max(0.05, fadeIn));

  const byStep = new Map<number, ((at: number, pitch: number, step: number) => void)[]>();
  const add = (step: number, fn: (at: number, pitch: number, step: number) => void) => {
    const list = byStep.get(step);
    if (list) list.push(fn);
    else byStep.set(step, [fn]);
  };
  const lead = song.lead ?? 'square';
  const harmonyWave = song.harmonyWave ?? 'pulse25';
  const swing = song.swing ?? 0;
  let stepDur = 60 / song.bpm / 4 / rate;
  let pitch = rate;

  const length = (e: NoteEvent) => e.steps * stepDur * 0.92;
  for (const e of compiled.lead) add(e.step, (at, p) => voice(c, lead, hz(e.midi) * p, at, at + length(e), envelope(c, mix, at, 0.075, 0.004, 0.09, 0.7, at + length(e)), true));
  for (const e of compiled.harmony) add(e.step, (at, p) => voice(c, harmonyWave, hz(e.midi) * p, at, at + length(e), envelope(c, mix, at, 0.045, 0.004, 0.09, 0.6, at + length(e)), false));
  for (const e of compiled.arp) add(e.step, (at, p) => {
    const end = at + Math.min(length(e), stepDur * 0.8);
    voice(c, 'pulse12', hz(e.midi) * p, at, end, envelope(c, mix, at, 0.04, 0.002, 0.06, 0.4, end), false);
  });
  for (const e of compiled.bass) add(e.step, (at, p) => voice(c, 'triangle', hz(e.midi) * p, at, at + length(e), envelope(c, mix, at, 0.28, 0.003, 0.05, 0.85, at + length(e)), false));
  for (const d of compiled.drums) add(d.step, (at) => {
    if (d.kind === 'kick') kick(c, mix, at, 0.5);
    else if (d.kind === 'snare') noiseHit(c, mix, at, 0.1, 0.2, 'bandpass', 2400);
    else noiseHit(c, mix, at, 0.03, 0.08, 'highpass', 7000);
  });

  let next = 0;
  let nextAt = now + 0.06;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const horizon = c.currentTime + LOOKAHEAD;
    // A suspended or throttled tab falls behind; skip ahead rather than fire a burst of stale notes.
    if (nextAt < c.currentTime - 0.1) nextAt = c.currentTime + 0.05;
    while (nextAt < horizon) {
      const at = nextAt + (next % 2 === 1 ? swing * stepDur : 0);
      for (const fn of byStep.get(next) ?? []) fn(at, pitch, next);
      nextAt += stepDur;
      next = (next + 1) % compiled.length;
    }
  };
  tick();
  const timer = window.setInterval(tick, TICK_MS);

  return {
    stop(seconds) {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      const t = c.currentTime;
      level.gain.cancelScheduledValues(t);
      level.gain.setValueAtTime(Math.max(SILENCE, level.gain.value), t);
      level.gain.exponentialRampToValueAtTime(SILENCE, t + Math.max(0.05, seconds));
      window.setTimeout(() => level.disconnect(), (seconds + LOOKAHEAD + 0.2) * 1000);
    },
    setRate(next) {
      stepDur = 60 / song.bpm / 4 / next;
      pitch = next;
    },
  };
}
