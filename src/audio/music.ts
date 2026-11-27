// The music layer: one looping track at a time on the music bus (synth.ts).
//
// Music outlives screens — a track belongs to a place, not a view, a fight aside — so the player lives at
// module scope and `setTrack` is idempotent on the id. Looping uses an AudioBufferSourceNode
// (`loop = true`), not <audio loop>: the element gaps at the seam on several browsers. The
// cost is that the whole file is decoded into memory (see tracks.ts).
// A music id resolves through the Soundtrack setting: the original's FLAC, or a chiptune song
// (chipSongs.ts). The fight themes are chiptune under either, since the original has none.

import { getMusicBus, unlockAudio } from './synth';
import { tracks, type TrackId } from './tracks';
import { chipSongs, FIGHT_SONGS, type SongId } from './chipSongs';
import { startSong, type ChipPlayer } from './chiptune';

export type MusicId = TrackId | SongId;
export type Soundtrack = 'original' | 'chiptune';

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

type Resolved = { kind: 'file'; id: TrackId } | { kind: 'chip'; id: SongId };

type Playing =
  | { key: string; kind: 'file'; source: AudioBufferSourceNode; gain: GainNode }
  | { key: string; kind: 'chip'; player: ChipPlayer };

let current: Playing | null = null;
// What SHOULD be playing; diverges from `current` while decoding. Every async continuation
// re-checks it before committing.
let desired: MusicId | null = null;
let soundtrack: Soundtrack = 'original';
const buffers = new Map<TrackId, AudioBuffer>();
const loading = new Map<TrackId, Promise<AudioBuffer | null>>();
// Ids prefetchTrack has pulled down, and the controllers for the transfers still running.
const prefetched = new Set<TrackId>();
const prefetching = new Map<TrackId, AbortController>();
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
    // A prefetch of this same track is now redundant; hand the connection to the real load
    // rather than pulling the file down twice.
    prefetching.get(id)?.abort();
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

/**
 * Warms a track the player has not reached yet — the next act's, say. Best-effort and
 * fire-and-forget: a failure costs a slow start later and nothing else.
 */
export function prefetchTrack(id: TrackId | null): void {
  if (!id || prefetched.has(id) || buffers.has(id) || loading.has(id)) return;
  prefetched.add(id);
  void (async () => {
    // Never race the track the player is actually waiting on — a prefetch is for a place they
    // have not walked into yet, so it yields the connection to whatever is loading now.
    await Promise.allSettled([...loading.values()]);
    if (buffers.has(id) || loading.has(id)) return;
    const controller = new AbortController();
    prefetching.set(id, controller);
    try {
      const response = await fetch(tracks[id].url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // Drained, then dropped: consuming the body is what commits it to the caches. Decoding it
      // here instead would hold a second ~42MB buffer for a whole act (see MAX_DECODED).
      await response.arrayBuffer();
    } catch (err) {
      prefetched.delete(id);
      // An abort is the real load taking the file over, not a failure.
      if (!controller.signal.aborted) console.warn(`[titanpact] could not prefetch music track "${id}"`, err);
    } finally {
      prefetching.delete(id);
    }
  })();
}

function keyOf(r: Resolved): string {
  return `${r.kind}:${r.id}`;
}

function resolve(id: MusicId | null): Resolved | null {
  if (id === null) return null;
  const isFight = (FIGHT_SONGS as readonly string[]).includes(id);
  if ((soundtrack === 'chiptune' || isFight) && id in chipSongs) return { kind: 'chip', id: id as SongId };
  if (id in tracks) return { kind: 'file', id: id as TrackId };
  return null;
}

function fadeOutAndStop(playing: Playing, context: AudioContext): void {
  if (playing.kind === 'chip') {
    playing.player.stop(FADE_OUT);
    return;
  }
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

  current = { key: keyOf({ kind: 'file', id }), kind: 'file', source, gain };
}

function startChip(context: AudioContext, bus: GainNode, id: SongId): void {
  const song = chipSongs[id];
  current = { key: keyOf({ kind: 'chip', id }), kind: 'chip', player: startSong(context, bus, song, song.fadeIn ?? FADE_IN, rate) };
}

// A fresh AudioContext stays suspended until a gesture; starting a source before that would
// silently burn the track's opening. Retry the desired track once the context is running.
function hookUnlock(context: AudioContext): void {
  if (unlockHooked) return;
  unlockHooked = true;
  context.addEventListener('statechange', () => {
    const want = resolve(desired);
    if (context.state === 'running' && want && keyOf(want) !== current?.key) {
      void applyDesired();
    }
  });
}

async function applyDesired(): Promise<void> {
  const bus = getMusicBus();
  if (!bus) return;
  const { context, bus: node } = bus;
  hookUnlock(context);

  const target = resolve(desired);

  if (target === null) {
    if (current) {
      fadeOutAndStop(current, context);
      current = null;
    }
    return;
  }

  const key = keyOf(target);
  if (current?.key === key) return;
  if (context.state !== 'running') {
    unlockAudio();
    // Pull the bytes down now — the gesture that unlocks the context is often many seconds out,
    // a title screen sits there while the player reads it — but do NOT decode yet. iOS leaves a
    // decodeAudioData issued against a not-yet-running context hanging, and the hung promise sat
    // in `loading` where the post-tap load found it and waited on it forever: the title music
    // never started on a phone. Decoding after the tap costs a beat inside FADE_IN and nothing else.
    if (target.kind === 'file') prefetchTrack(target.id);
    return;
  }

  if (target.kind === 'chip') {
    if (current) fadeOutAndStop(current, context);
    startChip(context, node, target.id);
    return;
  }

  const buffer = await loadBuffer(context, target.id);
  // The player may have crossed several screens, or the soundtrack changed, while the file decoded.
  const now = resolve(desired);
  if (!buffer || !now || keyOf(now) !== key) return;
  if (current?.key === key) return;

  if (current) {
    fadeOutAndStop(current, context);
    current = null;
  }
  startTrack(context, node, target.id, buffer);
}

/** Says what should be playing. Safe to call every render; `null` fades out. */
export function setTrack(id: MusicId | null): void {
  if (desired === id) return;
  desired = id;
  void applyDesired();
}

/** Whether an id has music under either soundtrack. */
export function hasMusic(id: string | null | undefined): id is MusicId {
  return !!id && (id in tracks || id in chipSongs);
}

export function setSoundtrack(next: Soundtrack): void {
  if (soundtrack === next) return;
  soundtrack = next;
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
  if (current?.kind === 'chip') {
    current.player.setRate(next);
    return;
  }
  const bus = getMusicBus();
  if (!current || !bus) return;
  const now = bus.context.currentTime;
  const p = current.source.playbackRate;
  // Same cancel-then-re-assert dance as fadeOutAndStop (no cancelAndHold on Safari).
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(next, now + rampSeconds);
}
