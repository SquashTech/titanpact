// Blip's firsts (docs/the-sky.md §1): wordless beats keyed by the moment they play. Content is data
// (src/data/thoughts.ts); this file picks one. Each is kept in `Profile.seenThoughtIds` so an account
// sees it once. They live outside runs only: nothing in a run reads this file.

import type { Profile } from './profile';
import { constellationState, type SkyContent } from './sky';

export type ThoughtMoment =
  /** The very first time the sky is seen. */
  | { kind: 'firstSky' }
  /** A constellation seen open for the first time. */
  | { kind: 'revealed'; constellationId: string };

export interface ThoughtDefinition {
  id: string;
  moment: ThoughtMoment;
  /** Once it plays, Blip flies to this constellation and points it out, charted or not. */
  showsNext?: string;
  /** Once it ends, this lesson (a scenario id) starts, unless its star is already lit. */
  plays?: string;
  /** A cinematic that holds the sky while it plays. */
  scene?: 'fall';
}

function sameMoment(a: ThoughtMoment, b: ThoughtMoment): boolean {
  if (a.kind === 'revealed' && b.kind === 'revealed') return a.constellationId === b.constellationId;
  return a.kind === b.kind;
}

const unseen = (profile: Profile, thought: ThoughtDefinition) => !profile.seenThoughtIds.includes(thought.id);

/** The moment's first still unseen, else none. */
export function thoughtFor(profile: Profile, thoughts: readonly ThoughtDefinition[], moment: ThoughtMoment): ThoughtDefinition | null {
  return thoughts.find((t) => sameMoment(t.moment, moment) && unseen(profile, t)) ?? null;
}

/** The first constellation, in sky order, that stands open or lit, is charted, and has a first still unseen. */
export function revealedThought(
  profile: Profile,
  sky: SkyContent,
  thoughts: readonly ThoughtDefinition[]
): { constellationId: string; thought: ThoughtDefinition } | null {
  for (const constellation of Object.values(sky.constellations)) {
    if (constellation.uncharted) continue;
    const state = constellationState(profile, sky, constellation.id);
    if (state !== 'open' && state !== 'lit') continue;
    const thought = revealedFirst(profile, thoughts, constellation.id);
    if (thought) return { constellationId: constellation.id, thought };
  }
  return null;
}

/** The constellation's first for being revealed, still unseen, whether or not it is charted. */
export function revealedFirst(profile: Profile, thoughts: readonly ThoughtDefinition[], constellationId: string): ThoughtDefinition | null {
  return thoughtFor(profile, thoughts, { kind: 'revealed', constellationId });
}

/** A first seen: recorded once. */
export function recordThoughtSeen(profile: Profile, thought: ThoughtDefinition): Profile {
  if (profile.seenThoughtIds.includes(thought.id)) return profile;
  return { ...profile, seenThoughtIds: [...profile.seenThoughtIds, thought.id] };
}
