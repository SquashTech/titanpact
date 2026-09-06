// The music table, keyed by LOCATION id (data/locations.ts): music belongs to a place, not a
// screen. App.tsx hands the current location to `setTrack`.
//
// One key breaks that rule on purpose — `titleScreen`. The title stands outside every place
// (it is in App.tsx's PLACELESS_SCREENS), so there is no location id to key it from.
//
// FLAC, not MP3: tracks are decoded whole and looped with `loop = true`, and MP3 encoders pad
// the stream start/end, which decodeAudioData keeps — an audible gap at every loop seam.
// Decoded PCM is ~43MB per 2-minute stereo track whatever the file format; MAX_DECODED
// (music.ts) bounds RAM, so a new track adds download, not memory.

import wildsEdgeUrl from '../../music/wilds edge.flac?url';
import forbiddenForestUrl from '../../music/forbidden forest.flac?url';
import blightedShrineUrl from '../../music/blighted shrine.flac?url';
import moltenFoundryUrl from '../../music/molten foundry.flac?url';
import stormCoastUrl from '../../music/stormcoast.flac?url';
import necropolisUrl from '../../music/necropolis.flac?url';
import titleScreenUrl from '../../music/titlescreen.flac?url';

export interface TrackDefinition {
  /** Bundler-resolved, content-hashed. */
  url: string;
  /** Per-track mix trim, 0–1, on top of the player's music fader. */
  gain?: number;
  /** Seconds. Set BOTH to loop a region (e.g. past a one-shot intro); unset loops the whole file. */
  loopStart?: number;
  loopEnd?: number;
}

// Declared then re-exported through the interface: `as const` alone infers away optional
// fields absent from every row, while a bare Record<string, …> loses the key literals.
// 0.85 is the house level for an ambient bed under combat sfx; per-track trims are deferred
// until the tracks have been heard back to back in a run.
const trackTable = {
  wildsEdge: {
    url: wildsEdgeUrl,
    gain: 0.85,
  },
  forbiddenForest: {
    url: forbiddenForestUrl,
    gain: 0.85,
  },
  blightedShrine: {
    url: blightedShrineUrl,
    gain: 0.85,
  },
  moltenFoundry: {
    url: moltenFoundryUrl,
    gain: 0.85,
  },
  stormCoast: {
    url: stormCoastUrl,
    gain: 0.85,
  },
  necropolis: {
    url: necropolisUrl,
    gain: 0.85,
  },
  titleScreen: {
    url: titleScreenUrl,
    gain: 0.85,
  },
} as const;

export type TrackId = keyof typeof trackTable;

export const tracks: Record<TrackId, TrackDefinition> = trackTable;

/** Whether a location has a track authored for it yet — most don't. */
export function hasTrack(locationId: string | null | undefined): locationId is TrackId {
  return !!locationId && locationId in tracks;
}
