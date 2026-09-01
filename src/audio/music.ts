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

/** Seconds a `setMusicRate` change takes to arrive. Long enough that the track SAGS rather than snapping to a new speed — a hard jump reads as a bug, a slow one reads as dread. */
const RATE_RAMP = 1.6;

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
 * The current playback rate, applied to whatever is sounding AND to whatever
 * starts next — module scope for the same reason `desired` is: the rate
 * belongs to the moment, not to the file, and it has to survive a track change
 * or a decode landing late.
 *
 * ⚠️ EXPERIMENTAL (2026-09-01, user's own framing: "we may walk that back").
 * See `setMusicRate` for what it actually does to the sound.
 */
let rate = 1;

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
  // Loop points are BUFFER time and so are unaffected by the rate — a slowed
  // track still loops at the authored seam, just more slowly.
  source.playbackRate.value = rate;
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

/**
 * Bends the score's speed — and, unavoidably, its pitch — for a scripted
 * moment. `0.8` plays the track 20% slow, which is very close to two semitones
 * down (2^(-2/12) ≈ 0.891 would be exactly two; 0.8 is nearer three). The
 * Goblin Lord's entrance is the only caller today (view/combat/FightScreen.tsx).
 *
 * There is NO time-stretch in Web Audio: `playbackRate` moves speed and pitch
 * together, the way slowing a record does. That is the effect being asked for
 * here rather than a limitation to work around — but it does mean the music
 * goes flat against every other pitched thing in the mix (the sfx table is
 * unaffected, since it runs on the separate sfx bus). Anything relying on the
 * track's tuning would notice; nothing does today.
 *
 * Ramped, not set: a step change in playbackRate is audible as a glitch. The
 * value sticks until something sets it back — FightScreen restores 1 when it
 * unmounts, so the effect lasts exactly as long as the fight it belongs to.
 *
 * Safe to call before any track is playing: the rate is remembered and applied
 * to whatever starts next.
 */
export function setMusicRate(next: number, rampSeconds = RATE_RAMP): void {
  if (rate === next) return;
  rate = next;
  const bus = getMusicBus();
  if (!current || !bus) return;
  const now = bus.context.currentTime;
  const p = current.source.playbackRate;
  // Same cancel-then-re-assert dance as fadeOutAndStop: cancelAndHold is
  // missing on Safari, so a rate change landing mid-ramp has to be told where
  // the value actually is before it can ramp on from there.
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(next, now + rampSeconds);
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
    rate,
    contextState: bus?.context.state ?? 'no context',
    decoded: [...buffers.keys()],
    loading: [...loading.keys()],
  };
}
