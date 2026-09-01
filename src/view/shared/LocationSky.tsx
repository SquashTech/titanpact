import { useMemo, type CSSProperties } from 'react';
import type { AmbienceKind, LocationDefinition } from '../../data/locations';
import { LocationHorizon } from './locationArt';

// The arrival screen's place (docs/locations.md §4): NodeSky's contract (keeps `.node-sky` so
// `.node-screen`'s stacking rule applies) plus a horizon band and a per-kind ambience. Each kind
// has its own keyframe — one shared rising-ember animation made snow rise. Scatter is a
// golden-angle sequence so positions are stable across re-renders with no seed.

interface AmbienceSpec {
  count: number;
  /** CSS animation-name, authored in styles.css "Location sky". */
  animation: string;
  /** px, min and span. */
  size: [number, number];
  /** seconds, min and span. */
  duration: [number, number];
  /** px of horizontal travel, min and span. */
  drift: [number, number];
  /** Multiplier on height — >1 elongates a particle into a streak (rain). */
  stretch?: number;
}

const AMBIENCE: Record<AmbienceKind, AmbienceSpec> = {
  fireflies: { count: 16, animation: 'loc-rise-wander', size: [2, 3], duration: [7, 5], drift: [-30, 60] },
  embers: { count: 24, animation: 'loc-rise-fast', size: [2, 3], duration: [3.5, 3], drift: [-14, 28] },
  snow: { count: 26, animation: 'loc-fall-sway', size: [2, 4], duration: [8, 5], drift: [-26, 52] },
  rain: { count: 34, animation: 'loc-fall-streak', size: [1, 1], duration: [0.9, 0.7], drift: [-40, 20], stretch: 12 },
  spores: { count: 14, animation: 'loc-drift-up', size: [3, 4], duration: [12, 7], drift: [-48, 96] },
  sigils: { count: 18, animation: 'loc-fall-pulse', size: [3, 3], duration: [9, 6], drift: [-18, 36] },
};

function useField(kind: AmbienceKind, density: number) {
  return useMemo(() => {
    const spec = AMBIENCE[kind];
    // Floored at one: a location whose weather rounds away has lost its identity, not gone quiet.
    const count = Math.max(1, Math.round(spec.count * density));
    return Array.from({ length: count }, (_, i) => {
      const seed = i * 137.51;
      const size = spec.size[0] + ((seed * 0.13) % spec.size[1]);
      return {
        left: seed % 100,
        // Negative delay starts every particle mid-flight so the field is full on the first frame.
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
 * The particle field alone (the map well uses it without the sky). `data-ambience` lives here
 * because styles.css keys per-kind mote shapes off it. `density` scales the authored count.
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

/**
 * Weather + horizon as one layer for the map well and node screens. Sets `--node-rgb` to the
 * location tint on its own root so a node screen's semantic tint (gold cache, violet relic) keeps
 * the wash and header while the location gets the ground.
 */
export function LocationAmbience({
  location,
  density,
  className,
}: {
  location: LocationDefinition;
  density?: number;
  className: string;
}) {
  return (
    <div className={className} style={{ '--node-rgb': location.tintRgb } as CSSProperties} aria-hidden="true">
      <LocationMotes kind={location.ambience} density={density} />
      <LocationHorizon locationId={location.id} />
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
