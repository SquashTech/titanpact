import { useMemo, type CSSProperties } from 'react';
import type { AmbienceKind, LocationDefinition } from '../../data/locations';
import { LocationHorizon } from './locationArt';

/**
 * The arrival screen's place (docs/locations.md §4). Same full-bleed,
 * z-index-0, "a place, not a container" contract as `NodeSky`
 * (NodeStage.tsx) — it deliberately keeps the `.node-sky` class so
 * `.node-screen`'s existing stacking rule and negative-inset already apply to
 * it — but with two things NodeSky has no business knowing about:
 *
 * 1. a **horizon silhouette** along the bottom edge (locationArt.tsx), and
 * 2. an **ambience** that is not the one rising-ember keyframe every other
 *    screen shares.
 *
 * Point 2 is the one worth defending. Reusing `title-ember-rise` for all six
 * locations was the first attempt, and it made the Necropolis look like a
 * cold-tinted foundry: everything still drifted *upward*, so snow rose. What
 * separates a forest from a foundry at a glance is as much motion as colour,
 * so each kind gets its own keyframe (styles.css, "Location sky" block) and
 * its own particle proportions below.
 *
 * The scatter is a golden-angle sequence, not `Math.random` — the same trick
 * the title, draft and node skies use, so positions are stable across
 * re-renders with no seed to store.
 */

interface AmbienceSpec {
  count: number;
  /** CSS animation-name; authored in styles.css alongside the rest of this system. */
  animation: string;
  /** px, min and span. */
  size: [number, number];
  /** seconds, min and span. */
  duration: [number, number];
  /** px of horizontal travel, min and span. Negative values are produced by centring the range. */
  drift: [number, number];
  /** Multiplier on height — >1 elongates a particle into a streak (rain). */
  stretch?: number;
}

const AMBIENCE: Record<AmbienceKind, AmbienceSpec> = {
  /** Warm, lazy, wandering wide — the only ambience that should read as alive. */
  fireflies: { count: 16, animation: 'loc-rise-wander', size: [2, 3], duration: [7, 5], drift: [-30, 60] },
  /** Fast, hot, tight — updraft off a furnace, not a breeze. */
  embers: { count: 24, animation: 'loc-rise-fast', size: [2, 3], duration: [3.5, 3], drift: [-14, 28] },
  /** Falls and sways. Big, soft, slow. */
  snow: { count: 26, animation: 'loc-fall-sway', size: [2, 4], duration: [8, 5], drift: [-26, 52] },
  /** Falls hard on a slant, and is drawn as a streak rather than a dot (see `stretch`). */
  rain: { count: 34, animation: 'loc-fall-streak', size: [1, 1], duration: [0.9, 0.7], drift: [-40, 20], stretch: 12 },
  /** Barely moves. Drifts up and very wide — the air itself is doing something. */
  spores: { count: 14, animation: 'loc-drift-up', size: [3, 4], duration: [12, 7], drift: [-48, 96] },
  /** Falls slowly while pulsing, so the field reads as script rather than weather. */
  sigils: { count: 18, animation: 'loc-fall-pulse', size: [3, 3], duration: [9, 6], drift: [-18, 36] },
};

function useField(kind: AmbienceKind, density: number) {
  return useMemo(() => {
    const spec = AMBIENCE[kind];
    // Floored at one: a location whose weather rounds away to nothing has lost
    // its identity, it has not become quiet.
    const count = Math.max(1, Math.round(spec.count * density));
    return Array.from({ length: count }, (_, i) => {
      const seed = i * 137.51;
      const size = spec.size[0] + ((seed * 0.13) % spec.size[1]);
      return {
        left: seed % 100,
        // NEGATIVE: a positive delay leaves the sky empty for as long as the
        // longest delay (13s for snow), so the screen you actually arrive on
        // has no weather in it. Offsetting backwards starts every particle
        // mid-flight, so the field is full on the first frame.
        delay: -((seed * 1.7) % (spec.duration[0] + spec.duration[1])),
        duration: spec.duration[0] + ((seed * 0.37) % spec.duration[1]),
        width: size,
        height: size * (spec.stretch ?? 1),
        drift: spec.drift[0] + ((seed * 0.53) % spec.drift[1]),
      };
    });
  }, [kind, density]);
}

/**
 * The particle field on its own, so a screen that wants a location's weather
 * without inheriting its whole sky can have it — which is exactly what the map
 * well needs (MapScreen's `MapAtmosphere`).
 *
 * `data-ambience` now lives on THIS element rather than on `.location-sky`,
 * because it is the only ancestor both call sites share and the per-kind mote
 * shapes in styles.css key off it.
 *
 * `density` scales the authored count. The arrival screen runs at a full 1;
 * the map runs thinner, because the map is a screen you *plan* on and its
 * weather has to stay behind the route rather than compete with it.
 */
export function LocationMotes({ kind, density = 1 }: { kind: AmbienceKind; density?: number }) {
  const field = useField(kind, density);
  const spec = AMBIENCE[kind];

  return (
    <div className="location-motes" data-ambience={kind} aria-hidden="true">
      {field.map((p, i) => (
        <span
          key={i}
          className="location-mote"
          style={
            {
              left: `${p.left}%`,
              width: `${p.width}px`,
              height: `${p.height}px`,
              animationName: spec.animation,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--drift': `${p.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function LocationSky({ location }: { location: LocationDefinition }) {
  return (
    <div className="node-sky location-sky" aria-hidden="true">
      <span className="node-sky-wash location-sky-wash" />
      <LocationMotes kind={location.ambience} />
      <LocationHorizon locationId={location.id} />
    </div>
  );
}
