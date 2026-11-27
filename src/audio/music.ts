// The music layer: one chiptune song at a time on the music bus (synth.ts), from chipSongs.ts.
//
// Music outlives screens — a song belongs to a place, not a view, a fight aside — so the player lives
// at module scope and `setTrack` is idempotent on the id.

import { getMusicBus, unlockAudio } from './synth';
import { chipSongs, type SongId } from './chipSongs';
import { startSong, type ChipPlayer } from './chiptune';

export type MusicId = SongId;

/** Seconds. Long enough that a place's song arrives rather than starts; a fight theme sets its own. */
const FADE_IN = 2.5;
/** Seconds. Shorter than the fade in: leaving should feel more decisive than arriving. */
const FADE_OUT = 1.4;

let current: { id: MusicId; player: ChipPlayer } | null = null;
// What SHOULD be playing; diverges from `current` until the context is running.
let desired: MusicId | null = null;
let unlockHooked = false;
// Playback rate, applied to whatever is sounding and to whatever starts next. Experimental.
let rate = 1;

// A fresh AudioContext stays suspended until a gesture; starting a song before that would
// silently burn its opening. Retry the desired song once the context is running.
function hookUnlock(context: AudioContext): void {
  if (unlockHooked) return;
  unlockHooked = true;
  context.addEventListener('statechange', () => {
    if (context.state === 'running' && desired !== current?.id) applyDesired();
  });
}

function applyDesired(): void {
  const bus = getMusicBus();
  if (!bus) return;
  const { context, bus: node } = bus;
  hookUnlock(context);

  if (current?.id === desired) return;
  if (desired !== null && context.state !== 'running') {
    unlockAudio();
    return;
  }
  current?.player.stop(FADE_OUT);
  current = null;
  if (desired === null) return;
  const song = chipSongs[desired];
  current = { id: desired, player: startSong(context, node, song, song.fadeIn ?? FADE_IN, rate) };
}

/** Says what should be playing. Safe to call every render; `null` fades out. */
export function setTrack(id: MusicId | null): void {
  if (desired === id) return;
  desired = id;
  applyDesired();
}

/** Whether an id has a song. */
export function hasMusic(id: string | null | undefined): id is MusicId {
  return !!id && id in chipSongs;
}

/** Bends the song's speed and pitch together, like tape. Sticks until set back; safe to call before anything plays. */
export function setMusicRate(next: number): void {
  if (rate === next) return;
  rate = next;
  current?.player.setRate(next);
}
