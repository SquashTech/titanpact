import type { CSSProperties } from 'react';

// Light that moves in a still painting: the stars in a Location's sky, its fireflies, a forge's
// flames, a lighthouse's lamp, a campfire's sparks. Each light is placed in % of the painting it
// sits on and drawn by styles.css ("Scene lights"); the painting itself is never touched.

export type SceneLightKind = 'star' | 'firefly' | 'flame' | 'candle' | 'ember' | 'beacon' | 'moon' | 'glow' | 'eye';

export interface SceneLight {
  kind: SceneLightKind;
  /** Centre, in % of the painting's width and height. */
  x: number;
  y: number;
  /** Diameter in % of the painting's width. Each kind has a default. */
  size?: number;
  /** A glow's or an eye's light, as "r, g, b". */
  rgb?: string;
  /** Seconds into its cycle. Lights sharing one keep time together — two eyes of one creature blink as one. */
  phase?: number;
}

const DEFAULT_SIZE: Record<SceneLightKind, number> = { star: 1.2, firefly: 7, flame: 16, candle: 6, ember: 1.6, beacon: 14, moon: 30, glow: 16, eye: 5 };

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
  blightedShrine: [
    { kind: 'glow', x: 18, y: 34, size: 18, rgb: '170, 110, 240' },
    { kind: 'glow', x: 80, y: 33, size: 20, rgb: '170, 110, 240' },
    { kind: 'glow', x: 80, y: 44, size: 14, rgb: '170, 110, 240' },
    { kind: 'glow', x: 50, y: 35, size: 22, rgb: '200, 170, 255' },
    { kind: 'eye', x: 51, y: 56, size: 7, rgb: '200, 170, 255' },
  ],
  dreamingSpires: [
    { kind: 'moon', x: 63.5, y: 13, size: 56 },
    { kind: 'glow', x: 49.5, y: 32, size: 8, rgb: '255, 150, 190' },
  ],
  forbiddenForest: [
    { kind: 'eye', x: 8.5, y: 27.5, rgb: '140, 255, 150', phase: 0.4 },
    { kind: 'eye', x: 14, y: 27.5, rgb: '140, 255, 150', phase: 0.4 },
    { kind: 'eye', x: 87.5, y: 30, rgb: '140, 255, 150', phase: 3.1 },
    { kind: 'eye', x: 93, y: 30, rgb: '140, 255, 150', phase: 3.1 },
    { kind: 'eye', x: 69.5, y: 31.5, size: 4, rgb: '140, 255, 150', phase: 1.8 },
    { kind: 'glow', x: 15, y: 40, size: 14, rgb: '120, 230, 170' },
    { kind: 'glow', x: 85, y: 35, size: 12, rgb: '120, 230, 170' },
  ],
  frozenReach: [
    { kind: 'star', x: 70, y: 13 },
    { kind: 'star', x: 21, y: 29 },
    { kind: 'star', x: 87.5, y: 36 },
    { kind: 'star', x: 60, y: 22 },
  ],
  holySanctum: [
    { kind: 'glow', x: 50, y: 33, size: 24, rgb: '255, 220, 140' },
    { kind: 'glow', x: 15, y: 19, size: 14, rgb: '255, 220, 140' },
    { kind: 'glow', x: 84, y: 19, size: 14, rgb: '255, 220, 140' },
    { kind: 'glow', x: 50, y: 58, size: 16, rgb: '255, 170, 90' },
    { kind: 'candle', x: 4, y: 95 },
    { kind: 'candle', x: 94.5, y: 95 },
    { kind: 'candle', x: 18, y: 84 },
    { kind: 'candle', x: 82, y: 84 },
    { kind: 'candle', x: 32, y: 75 },
    { kind: 'candle', x: 67, y: 75 },
    { kind: 'candle', x: 9, y: 66 },
    { kind: 'candle', x: 89, y: 66 },
  ],
  theThreshold: [{ kind: 'glow', x: 55, y: 38, size: 12, rgb: '220, 230, 190' }],
  thunderAerie: [{ kind: 'glow', x: 58, y: 15, size: 42, rgb: '200, 150, 255' }],
};

/** The map's props, where a road scene stands one (art/map-nodes/props), by node type. */
export const PROP_LIGHTS: Record<string, readonly SceneLight[]> = {
  restReward: campfire(33, 72, 40),
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
              animationDelay: `${-(light.phase ?? (i * 0.73) % 3.1).toFixed(2)}s`,
              '--light-rate': light.phase != null ? '1' : (0.85 + ((i * 37) % 30) / 100).toFixed(2),
              ...(light.rgb ? { '--light-rgb': light.rgb } : null),
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
