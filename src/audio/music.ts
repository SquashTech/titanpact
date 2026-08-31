/**
 * The music layer: one looping track at a time, routed through the music bus
 * so it mixes independently of the effects (audio/synth.ts, audio/sfx.ts).
 *
 * The design constraint that shapes everything here: **music outlives
 * screens.** A track belongs to the place, not to the view — walking from the
 * map into a fight and back out is one continuous piece of music, and any
 * design where a component owns the playback restarts the track every time
 * that component mounts. So the player lives at module scope, `setTrack` is
 * idempotent on the track id, and the only thing the view does is say which
 * place it is currently in. Calling `setTrack('wildsEdge')` sixty times in a
 * row is fifty-nine no-ops.
 *
 * Looping is an AudioBufferSourceNode with `loop = true` rather than an
 * <audio loop> element: the element gaps at the seam on several browsers,
 * which is fatal for ambient music that is supposed to be unnoticeable. The
 * cost is that the whole file is decoded into memory (see tracks.ts on why
 * the source files need to be small).
 */

import { getMusicBus, unlockAudio } from './synth';
import { tracks, type TrackId } from './tracks';

/** Seconds. Long enough that a track arrives rather than starts. */
const FADE_IN = 2.5;
/** Shorter than the fade in: leaving a place should feel more decisive than arriving. */
const FADE_OUT = 1.4;
/** Web Audio can't ramp exponentially to zero; everything lands here and then stops. */
const SILENCE = 0.0001;
/**
 * How many decoded tracks to keep resident. Two, because a change of place
 * overlaps the outgoing fade with the incoming one and both want to be here.
 *
 * This cap is not a micro-optimisation. Web Audio decodes to float32 per
 * channel, so a 2-minute stereo 44.1k track costs ~42MB — the four tracks
 * authored today total 178MB if every one is allowed to stay. An unbounded
 * cache grows with the number of PLACES A RUN VISITS, which is precisely the
 * number that rises as the game gets bigger, and it ends in a killed tab on
 * the portrait-mode phone this is built for.
 *
 * Evicting is cheap to undo: the file is still in the HTTP cache, so
 * returning to a place costs a decode and no download, and FADE_IN is long
 * enough to cover it.
 */
const MAX_DECODED = 2;

interface Playing {
  id: TrackId;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

let current: Playing | null = null;
/**
 * What SHOULD be playing. Diverges from `current` while a track is decoding,
 * and is the value every async continuation re-checks before committing —
 * the player can cross three screens in the time a file takes to decode.
 */
let desired: TrackId | null = null;
const buffers = new Map<TrackId, AudioBuffer>();
const loading = new Map<TrackId, Promise<AudioBuffer | null>>();
let unlockHooked = false;

/**
 * Drops least-recently-used buffers past the cap.
 *
 * Safe to run while a track is playing, even in the case where it evicts
 * that very track: a live AudioBufferSourceNode holds its own reference to
 * the AudioBuffer, so the sound carries on untouched and the only thing
 * discarded is the right to skip a future decode.
 */
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
    // Re-insert to mark it most-recently-used. A Map iterates in insertion
    // order, and that ordering is the whole eviction policy.
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
  // cancelAndHold isn't in Safari; cancel then re-assert the value we can
  // read right now, so a track killed mid-fade-in ramps from where it
  // actually is rather than jumping to full and then falling.
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
  // Authored loop points, for a track with an intro that shouldn't replay.
  // Left at the defaults the whole buffer loops, which is what an ambient
  // bed wants.
  if (def.loopStart !== undefined) source.loopStart = def.loopStart;
  if (def.loopEnd !== undefined) source.loopEnd = def.loopEnd;
  source.connect(gain);

  const now = context.currentTime;
  const level = def.gain ?? 1;
  gain.gain.setValueAtTime(SILENCE, now);
  gain.gain.exponentialRampToValueAtTime(level, now + FADE_IN);
  source.start(now);

  current = { id, source, gain };
}

/**
 * Waits for the first user gesture. Browsers hold a fresh AudioContext
 * suspended, and a run can reach its first map before anything has unlocked
 * it — starting a source then would silently burn the track's opening.
 */
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
    // Not an error — `desired` is remembered and the statechange hook above
    // runs this again the moment a tap unlocks audio.
    unlockAudio();
    return;
  }

  const buffer = await loadBuffer(context, target);
  // Re-check: the act may have ended, or the player quit to title, while
  // 20-odd megabytes were decoding.
  if (!buffer || desired !== target) return;
  if (current?.id === target) return;

  if (current) {
    fadeOutAndStop(current, context);
    current = null;
  }
  startTrack(context, node, target, buffer);
}

/**
 * Says what should be playing. Safe to call every render: passing the id
 * that is already playing does nothing at all, which is what lets the track
 * survive the map → fight → reward → map journey uninterrupted.
 *
 * `null` fades out and plays nothing (the title screen, the sandbox tools).
 */
export function setTrack(id: TrackId | null): void {
  if (desired === id) return;
  desired = id;
  void applyDesired();
}

/** What is actually sounding right now — for debugging and verification. */
export function currentTrack(): TrackId | null {
  return current?.id ?? null;
}

/**
 * The player's whole state in one object. Music fails silently by design
 * (a missing track costs the score, not the game), which makes "nothing is
 * playing" ambiguous between half a dozen causes — this says which.
 */
export function musicDebug(): Record<string, unknown> {
  const bus = getMusicBus();
  return {
    desired,
    current: current?.id ?? null,
    contextState: bus?.context.state ?? 'no context',
    decoded: [...buffers.keys()],
    loading: [...loading.keys()],
  };
}
