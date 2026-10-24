// Blip's thoughts (docs/the-sky.md §1): what it thinks, keyed by the moment it thinks it. Content
// is data (src/data/thoughts.ts); this file picks one. A thought marked `once` is a first, kept in
// `Profile.seenThoughtIds` so an account hears it once; the rest are pools, drawn at random.
// Thoughts live outside runs only: nothing in a run reads this file.

import type { Profile } from './profile';
import { constellationState, isStarLit, type SkyContent } from './sky';

export type ThoughtMoment =
  /** The very first time the sky is seen. */
  | { kind: 'firstSky' }
  /** Browsing the sky with nothing else to say. */
  | { kind: 'idle' }
  /** A constellation seen open for the first time. */
  | { kind: 'revealed'; constellationId: string }
  /** A constellation zoomed into. */
  | { kind: 'opened'; constellationId: string }
  /** One star, seen up close once it is lit or the next to light. */
  | { kind: 'star'; starId: string }
  /** A constellation zoomed into whose stars are not authored yet. */
  | { kind: 'uncharted' }
  /** Back in the sky after an Infinite run ended. */
  | { kind: 'returned'; outcome: 'win' | 'loss' }
  | { kind: 'poked' }
  /** Poked again and again. */
  | { kind: 'pokedLots' };

export interface ThoughtDefinition {
  id: string;
  moment: ThoughtMoment;
  /** One bubble each, typed out in turn. */
  lines: readonly string[];
  /** Said once an account; without it, the thought is one of its moment's pool. */
  once?: boolean;
  /** Once said, Blip flies to this constellation and says its first there, charted or not. */
  showsNext?: string;
}

function sameMoment(a: ThoughtMoment, b: ThoughtMoment): boolean {
  if (a.kind !== b.kind) return false;
  if ((a.kind === 'revealed' || a.kind === 'opened') && (b.kind === 'revealed' || b.kind === 'opened')) return a.constellationId === b.constellationId;
  if (a.kind === 'returned' && b.kind === 'returned') return a.outcome === b.outcome;
  if (a.kind === 'star' && b.kind === 'star') return a.starId === b.starId;
  return true;
}

/**
 * The thought for a moment: its first still unheard, else one of its pool at random, else none.
 * `random` is in [0, 1).
 */
export function thoughtFor(profile: Profile, thoughts: readonly ThoughtDefinition[], moment: ThoughtMoment, random: number): ThoughtDefinition | null {
  const here = thoughts.filter((t) => sameMoment(t.moment, moment));
  const first = here.find((t) => t.once && !profile.seenThoughtIds.includes(t.id));
  if (first) return first;
  const pool = here.filter((t) => !t.once);
  return pool.length > 0 ? pool[Math.min(pool.length - 1, Math.floor(random * pool.length))] : null;
}

/** The first constellation, in sky order, that stands open or lit, is charted, and has a first still unheard. */
export function revealedThought(
  profile: Profile,
  sky: SkyContent,
  thoughts: readonly ThoughtDefinition[]
): { constellationId: string; thought: ThoughtDefinition } | null {
  for (const constellation of Object.values(sky.constellations)) {
    if (constellation.uncharted) continue;
    const state = constellationState(profile, sky, constellation.id);
    if (state !== 'open' && state !== 'lit') continue;
    const thought = thoughts.find(
      (t) => t.once && t.moment.kind === 'revealed' && t.moment.constellationId === constellation.id && !profile.seenThoughtIds.includes(t.id)
    );
    if (thought) return { constellationId: constellation.id, thought };
  }
  return null;
}

/** The constellation's first for being revealed, still unheard, whether or not it is charted. */
export function revealedFirst(profile: Profile, thoughts: readonly ThoughtDefinition[], constellationId: string): ThoughtDefinition | null {
  return (
    thoughts.find(
      (t) => t.once && t.moment.kind === 'revealed' && t.moment.constellationId === constellationId && !profile.seenThoughtIds.includes(t.id)
    ) ?? null
  );
}

/**
 * What Blip says on zooming into a constellation: its first for the constellation, else a first for
 * one of its stars that is lit or next to light, else an uncharted line, else nothing.
 */
export function zoomThought(profile: Profile, sky: SkyContent, thoughts: readonly ThoughtDefinition[], constellationId: string, random: number): ThoughtDefinition | null {
  const constellation = sky.constellations[constellationId];
  if (!constellation) return null;
  const opened = thoughts.find((t) => t.once && sameMoment(t.moment, { kind: 'opened', constellationId }) && !profile.seenThoughtIds.includes(t.id));
  if (opened) return opened;
  const lit = constellation.stars.map((star) => isStarLit(profile, constellation, star));
  for (const [i, star] of constellation.stars.entries()) {
    if (!(lit[i] || i === 0 || lit[i - 1])) continue;
    const first = thoughts.find((t) => t.once && sameMoment(t.moment, { kind: 'star', starId: star.id }) && !profile.seenThoughtIds.includes(t.id));
    if (first) return first;
  }
  return constellation.uncharted && !lit.every(Boolean) ? thoughtFor(profile, thoughts, { kind: 'uncharted' }, random) : null;
}

/** A first heard: recorded once; a pool thought is never recorded. */
export function recordThoughtSeen(profile: Profile, thought: ThoughtDefinition): Profile {
  if (!thought.once || profile.seenThoughtIds.includes(thought.id)) return profile;
  return { ...profile, seenThoughtIds: [...profile.seenThoughtIds, thought.id] };
}
