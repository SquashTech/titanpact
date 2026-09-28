import type { CSSProperties } from 'react';

// Light that moves in a still painting: the stars in a Location's sky, its fireflies, a forge's
// flames, a lighthouse's lamp, a campfire's sparks. Each light is placed in % of the painting it
// sits on and drawn by styles.css ("Scene lights"); the painting itself is never touched.

export type SceneLightKind = 'star' | 'firefly' | 'flame' | 'ember' | 'beacon' | 'moon';

export interface SceneLight {
  kind: SceneLightKind;
  /** Centre, in % of the painting's width and height. */
  x: number;
  y: number;
  /** Diameter in % of the painting's width. Each kind has a default. */
  size?: number;
}

const DEFAULT_SIZE: Record<SceneLightKind, number> = { star: 1.2, firefly: 7, flame: 16, ember: 1.6, beacon: 14, moon: 30 };

/** A campfire: the glow, and three sparks lifting off it. */
function campfire(x: number, y: number, size: number): SceneLight[] {
  return [
    { kind: 'flame', x, y, size },
    { kind: 'ember', x: x - size * 0.12, y: y - size * 0.1 },
    { kind: 'ember', x: x + size * 0.08, y: y - size * 0.15 },
    { kind: 'ember', x, y: y - size * 0.05 },
  ];
}

/** The Locations' arrival paintings (art/locations), by Location id. */
export const LOCATION_LIGHTS: Record<string, readonly SceneLight[]> = {
  wildsEdge: [
    { kind: 'star', x: 88, y: 3 },
    { kind: 'star', x: 95, y: 8 },
    { kind: 'star', x: 83, y: 12 },
    { kind: 'star', x: 91, y: 17 },
    { kind: 'star', x: 97, y: 23 },
    { kind: 'star', x: 79, y: 5 },
    { kind: 'firefly', x: 10, y: 89 },
    { kind: 'firefly', x: 38, y: 91 },
    { kind: 'firefly', x: 90, y: 87 },
    { kind: 'firefly', x: 28, y: 77 },
    { kind: 'firefly', x: 40, y: 78 },
    { kind: 'firefly', x: 87, y: 75 },
  ],
  necropolis: [
    { kind: 'moon', x: 67.5, y: 15, size: 32 },
    { kind: 'star', x: 4, y: 7 },
    { kind: 'star', x: 13, y: 3 },
    { kind: 'star', x: 30, y: 9 },
    { kind: 'star', x: 94, y: 6 },
    { kind: 'star', x: 53.5, y: 31 },
    { kind: 'star', x: 72, y: 29 },
    { kind: 'star', x: 20, y: 20 },
  ],
  moltenFoundry: [
    { kind: 'flame', x: 55, y: 6, size: 18 },
    { kind: 'flame', x: 22, y: 12, size: 12 },
    { kind: 'flame', x: 87, y: 13, size: 14 },
    { kind: 'flame', x: 53.5, y: 35, size: 26 },
    { kind: 'flame', x: 51, y: 54, size: 22 },
    { kind: 'flame', x: 76.5, y: 55, size: 12 },
  ],
  stormCoast: [{ kind: 'beacon', x: 62.5, y: 17.5 }],
};

/** The map's props, where a road scene stands one (art/map-nodes/props), by node type. */
export const PROP_LIGHTS: Record<string, readonly SceneLight[]> = {
  restReward: campfire(33, 72, 40),
};

/** The places' header vignettes (art/places), by file name. */
export const PLACE_LIGHTS: Record<string, readonly SceneLight[]> = {
  rest: campfire(43, 70, 22),
};

export function SceneLights({ lights, className }: { lights: readonly SceneLight[] | undefined; className?: string }) {
  if (!lights || lights.length === 0) return null;
  return (
    <span className={`scene-lights${className ? ` ${className}` : ''}`} aria-hidden="true">
      {lights.map((light, i) => (
        <span
          key={i}
          className={`scene-light is-${light.kind}`}
          style={
            {
              left: `${light.x}%`,
              top: `${light.y}%`,
              width: `${light.size ?? DEFAULT_SIZE[light.kind]}%`,
              // Staggered off the index so no two lights in a scene breathe in step.
              animationDelay: `${-((i * 0.73) % 3.1).toFixed(2)}s`,
              '--light-rate': (0.85 + ((i * 37) % 30) / 100).toFixed(2),
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
