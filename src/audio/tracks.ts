/**
 * The music table: which file plays where, as pure data.
 *
 * Keyed by LOCATION id (data/locations.ts), because in this game a piece of
 * music belongs to a place and not to a screen — Wild's Edge sounds like
 * Wild's Edge whether you are reading the map, picking a reward, or halfway
 * through a fight there. App.tsx hands the current location straight to
 * `setTrack`, and that is the whole integration.
 *
 * ── Why FLAC, and not something smaller ────────────────────────────────────
 * Tracks are DECODED INTO MEMORY to loop seamlessly (music.ts explains why),
 * and downloaded in full before a note plays, so format is a real decision
 * and not a detail. These are FLAC: lossless, and about 60% of the WAV
 * master (11-16MB each, down from ~18-26MB).
 *
 * A lossy export would be far smaller again, and MP3 in particular is the
 * trap. MP3 encoders pad the start and end of the stream, `decodeAudioData`
 * returns that padding as part of the buffer, and `loop = true` therefore
 * plays it — an audible gap every time the track comes around, which is the
 * exact artifact the AudioBufferSourceNode approach exists to avoid. FLAC is
 * sample-exact, so the seam is clean. (Ogg/Opus handles gapless properly too
 * and would be smaller still; Ableton does not export it.)
 *
 * What no format changes: the decoded PCM is identical whatever the file was,
 * so a 2-minute stereo 44.1k track costs ~43MB of RAM regardless. If that
 * ever bites on a phone, the levers are a mono bed or a shorter loop — both
 * musical decisions, not encoding ones.
 */

import wildsEdgeUrl from '../../music/wilds edge.flac?url';
import forbiddenForestUrl from '../../music/forbidden forest.flac?url';
import blightedShrineUrl from '../../music/blighted shrine.flac?url';

export interface TrackDefinition {
  /** Resolved by the bundler, so it is content-hashed and cache-safe. */
  url: string;
  /**
   * Per-track level, 0-1, on top of the player's music fader. The lever for
   * "this one track sits too loud against the others" — a mix note, not a
   * user setting.
   */
  gain?: number;
  /**
   * Seconds. Set BOTH to loop a region rather than the whole file — for a
   * track with a one-shot intro that shouldn't come back around. Left unset,
   * the entire buffer loops, which is what an ambient bed wants.
   */
  loopStart?: number;
  loopEnd?: number;
}

/* Declared, then re-exported through the interface: `as const` alone infers
   away the optional fields (a table with no loopStart anywhere types as
   having no loopStart at all), while a bare Record<string, …> would lose the
   key literals that make TrackId meaningful. This keeps both. */
const trackTable = {
  wildsEdge: {
    url: wildsEdgeUrl,
    // Ambient bed under combat sound: it has to hold the place without
    // competing with the hits, which are the thing carrying information.
    gain: 0.85,
  },
  forbiddenForest: {
    url: forbiddenForestUrl,
    // Same reasoning, same number, and deliberately not tuned by ear yet —
    // 0.85 is the house level for a bed, and a per-track trim is worth
    // spending only once they have been heard back to back in a run.
    gain: 0.85,
  },
  blightedShrine: {
    url: blightedShrineUrl,
    // House level again, unheard against the other two so far.
    gain: 0.85,
  },
} as const;

export type TrackId = keyof typeof trackTable;

export const tracks: Record<TrackId, TrackDefinition> = trackTable;

/** Whether a location has a track authored for it yet — most don't. */
export function hasTrack(locationId: string | null | undefined): locationId is TrackId {
  return !!locationId && locationId in tracks;
}
