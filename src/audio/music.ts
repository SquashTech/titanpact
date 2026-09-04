// The music layer: one looping track at a time on the music bus (synth.ts).
//
// Music outlives screens — a track belongs to a place, not a view — so the player lives at
// module scope and `setTrack` is idempotent on the id. Looping uses an AudioBufferSourceNode
// (`loop = true`), not <audio loop>: the element gaps at the seam on several browsers. The
// cost is that the whole file is decoded into memory (see tracks.ts).

import { getMusicBus, unlockAudio } from './synth';
import { tracks, type TrackId } from './tracks';

/** Seconds. Long enough that a track arrives rather than starts. */
const FADE_IN = 2.5;
/** Seconds. Shorter than the fade in: leaving should feel more decisive than arriving. */
const FADE_OUT = 1.4;
/** Exponential ramps can't reach 0; land here, then stop. */
const SILENCE = 0.0001;
// Decoded tracks kept resident. Two, because a place change overlaps the outgoing and
// incoming fades. Not a micro-optimisation: decoded PCM is ~42MB per 2-minute stereo track,
// and an unbounded cache grows with places visited until the phone kills the tab.
const MAX_DECODED = 2;
/** Seconds a `setMusicRate` change takes to arrive — a hard jump reads as a bug. */
const RATE_RAMP = 1.6;

interface Playing {
  id: TrackId;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

let current: Playing | null = null;
// What SHOULD be playing; diverges from `current` while decoding. Every async continuation
// re-checks it before committing.
let desired: TrackId | null = null;
const buffers = new Map<TrackId, AudioBuffer>();
const loading = new Map<TrackId, Promise<AudioBuffer | null>>();
let unlockHooked = false;
// Playback rate, applied to whatever is sounding and to whatever starts next. Experimental.
let rate = 1;

// LRU eviction. Safe even when it evicts the playing track: a live source holds its own
// reference to the buffer, so only the right to skip a future decode is lost.
function evictStaleBuffers(): void {
  while (buffers.size > MAX_DECODED) {
    const oldest = buffers.keys().next();
    if (oldest.done) return;
    buffers.delete(oldest.value);
  }
}

async function loadBuffer(context: AudioContext, id: TrackId): Promise<AudioBuffer | null> {
  const cached = buffers.get(id);
  if (cached) {
    // Re-insert to mark most-recently-used; Map insertion order is the eviction policy.
    buffers.delete(id);
    buffers.set(id, cached);
    return cached;
  }
  const inFlight = loading.get(id);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const response = await fetch(tracks[id].url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(bytes);
      buffers.set(id, buffer);
      evictStaleBuffers();
      return buffer;
    } catch (err) {
      // A missing or undecodable track costs the score, not the game.
      console.warn(`[titanpact] could not load music track "${id}"`, err);
      return null;
    } finally {
      loading.delete(id);
    }
  })();

  loading.set(id, promise);
  return promise;
}

function fadeOutAndStop(playing: Playing, context: AudioContext): void {
  const now = context.currentTime;
  const g = playing.gain.gain;
  // cancelAndHold isn't in Safari: cancel, re-assert the live value, then ramp from there.
  g.cancelScheduledValues(now);
  g.setValueAtTime(Math.max(SILENCE, g.value), now);
  g.exponentialRampToValueAtTime(SILENCE, now + FADE_OUT);
  playing.source.stop(now + FADE_OUT + 0.05);
  playing.source.onended = () => {
    playing.source.disconnect();
    playing.gain.disconnect();
  };
}

function startTrack(context: AudioContext, bus: GainNode, id: TrackId, buffer: AudioBuffer): void {
  const def = tracks[id];
  const gain = context.createGain();
  gain.connect(bus);

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  if (def.loopStart !== undefined) source.loopStart = def.loopStart;
  if (def.loopEnd !== undefined) source.loopEnd = def.loopEnd;
  // Loop points are buffer time, so a slowed track still loops at the authored seam.
  source.playbackRate.value = rate;
  source.connect(gain);

  const now = context.currentTime;
  const level = def.gain ?? 1;
  gain.gain.setValueAtTime(SILENCE, now);
  gain.gain.exponentialRampToValueAtTime(level, now + FADE_IN);
  source.start(now);

  current = { id, source, gain };
}

// A fresh AudioContext stays suspended until a gesture; starting a source before that would
// silently burn the track's opening. Retry the desired track once the context is running.
function hookUnlock(context: AudioContext): void {
  if (unlockHooked) return;
  unlockHooked = true;
  context.addEventListener('statechange', () => {
    if (context.state === 'running' && desired && desired !== current?.id) {
      void applyDesired();
    }
  });
}

async function applyDesired(): Promise<void> {
  const bus = getMusicBus();
  if (!bus) return;
  const { context, bus: node } = bus;
  hookUnlock(context);

  const target = desired;

  if (target === null) {
    if (current) {
      fadeOutAndStop(current, context);
      current = null;
    }
    return;
  }

  if (current?.id === target) return;
  if (context.state !== 'running') {
    unlockAudio();
    // Decode does not need a running context, and the gesture that unlocks one is often many
    // seconds out — a title screen sits there while the player reads it. Warming the buffer now
    // means the track starts ON the tap rather than a download and a decode after it.
    void loadBuffer(context, target);
    return;
  }

  const buffer = await loadBuffer(context, target);
  // The player may have crossed several screens while the file decoded.
  if (!buffer || desired !== target) return;
  if (current?.id === target) return;

  if (current) {
    fadeOutAndStop(current, context);
    current = null;
  }
  startTrack(context, node, target, buffer);
}

/** Says what should be playing. Safe to call every render; `null` fades out. */
export function setTrack(id: TrackId | null): void {
  if (desired === id) return;
  desired = id;
  void applyDesired();
}

/**
 * Bends the score's speed — and, unavoidably, its pitch (there is no time-stretch in Web
 * Audio; that is the effect wanted). Ramped, because a stepped playbackRate is an audible
 * glitch. Sticks until set back; safe to call before any track is playing.
 */
export function setMusicRate(next: number, rampSeconds = RATE_RAMP): void {
  if (rate === next) return;
  rate = next;
  const bus = getMusicBus();
  if (!current || !bus) return;
  const now = bus.context.currentTime;
  const p = current.source.playbackRate;
  // Same cancel-then-re-assert dance as fadeOutAndStop (no cancelAndHold on Safari).
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(next, now + rampSeconds);
}
