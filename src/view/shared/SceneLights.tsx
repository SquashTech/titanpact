import type { CSSProperties } from 'react';

// Light that moves in a still painting: the stars in a Location's sky, its fireflies, a forge's
// flames, a lighthouse's lamp, a campfire's sparks. Each light is placed in % of the painting it
// sits on and drawn by styles.css ("Scene lights"); the painting itself is never touched.

export type SceneLightKind = 'star' | 'twinkle' | 'glint' | 'sparkle' | 'glimmer' | 'firefly' | 'flame' | 'candle' | 'ember' | 'beacon' | 'moon' | 'glow' | 'eye';

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

// A twinkle, a glint, a sparkle and a glimmer are drawn in the map paintings' own pixels (7 or 3 of
// the 196 across), so their size is fixed: scaling one would put it off the painting's grid.
const MAP_PX = 100 / 196;
const DEFAULT_SIZE: Record<SceneLightKind, number> = { star: 1.2, twinkle: 7 * MAP_PX, glint: 3 * MAP_PX, sparkle: 7 * MAP_PX, glimmer: 3 * MAP_PX, firefly: 7, flame: 16, candle: 6, ember: 1.6, beacon: 14, moon: 30, glow: 16, eye: 5 };

/** The Locations' arrival paintings (art/locations), by Location id. */
export const LOCATION_LIGHTS: Record<string, readonly SceneLight[]> = {
  wildsEdge: [
    { kind: 'glimmer', x: 95.7, y: 46.8, rgb: '223, 222, 227' },
    { kind: 'glimmer', x: 82.9, y: 50.3, rgb: '223, 222, 227' },
    { kind: 'firefly', x: 84.1, y: 91.6 },
    { kind: 'firefly', x: 69.7, y: 78.7 },
    { kind: 'firefly', x: 57.7, y: 86.1 },
    { kind: 'firefly', x: 28.6, y: 80.7 },
    { kind: 'firefly', x: 6.9, y: 71.9 },
    { kind: 'firefly', x: 56, y: 65.3 },
  ],
  necropolis: [
    { kind: 'glimmer', x: 57.3, y: 10.9, rgb: '223, 229, 187' },
    { kind: 'glimmer', x: 27.2, y: 20.3, rgb: '223, 229, 187' },
    { kind: 'glimmer', x: 62.4, y: 30.7, rgb: '223, 229, 187' },
    { kind: 'glimmer', x: 73, y: 20.1, rgb: '223, 229, 187' },
  ],
  moltenFoundry: [
    { kind: 'flame', x: 49.4, y: 25, size: 14 },
    { kind: 'flame', x: 49.2, y: 54.5, size: 14 },
    { kind: 'glow', x: 51.7, y: 62.7, size: 9, rgb: '255, 110, 40', phase: 0.0 },
    { kind: 'glow', x: 55, y: 70, size: 12, rgb: '255, 110, 40', phase: 0.6 },
    { kind: 'glow', x: 55, y: 78, size: 13, rgb: '255, 110, 40', phase: 1.2 },
    { kind: 'glow', x: 57.4, y: 85.9, size: 12, rgb: '255, 110, 40', phase: 1.8 },
  ],
  stormCoast: [{ kind: 'beacon', x: 40.8, y: 55.8, size: 8 }],
  blightedShrine: [
    { kind: 'glow', x: 50.8, y: 75.6, size: 24, rgb: '215, 125, 237' },
    { kind: 'glimmer', x: 19.9, y: 10.6, rgb: '228, 176, 238' },
    { kind: 'glimmer', x: 63.8, y: 17.2, rgb: '228, 176, 238' },
    { kind: 'glimmer', x: 12.2, y: 24.4, rgb: '228, 176, 238' },
    { kind: 'glimmer', x: 69.9, y: 40.4, rgb: '228, 176, 238' },
  ],
  dreamingSpires: [{ kind: 'glow', x: 50, y: 43, size: 40, rgb: '255, 170, 210' }],
  forbiddenForest: [
    { kind: 'glow', x: 52, y: 73, size: 16, rgb: '170, 220, 120' },
    { kind: 'firefly', x: 80.1, y: 22.1 },
    { kind: 'firefly', x: 63.8, y: 88.1 },
    { kind: 'firefly', x: 84.7, y: 91.6 },
  ],
  frozenReach: [
    { kind: 'glimmer', x: 96.7, y: 9.2, rgb: '226, 237, 251' },
    { kind: 'glimmer', x: 15.6, y: 14.1, rgb: '226, 237, 251' },
    { kind: 'glimmer', x: 91.6, y: 18.8, rgb: '226, 237, 251' },
    { kind: 'glimmer', x: 27.8, y: 25.7, rgb: '226, 237, 251' },
    { kind: 'glimmer', x: 49.7, y: 37.6, rgb: '226, 237, 251' },
  ],
  holySanctum: [
    { kind: 'glow', x: 52, y: 28, size: 34, rgb: '255, 220, 140' },
    { kind: 'candle', x: 52.3, y: 33.1, size: 3 },
    { kind: 'candle', x: 55.9, y: 33.1, size: 3 },
    { kind: 'candle', x: 59.4, y: 33.1, size: 3 },
    { kind: 'glow', x: 50, y: 75, size: 14, rgb: '255, 190, 130' },
  ],
  theThreshold: [
    { kind: 'eye', x: 52.3, y: 18.6, size: 4, rgb: '242, 71, 220', phase: 2.2 },
    { kind: 'eye', x: 56.9, y: 18.6, size: 4, rgb: '242, 71, 220', phase: 2.2 },
  ],
  thunderAerie: [{ kind: 'glow', x: 50, y: 34.4, size: 22, rgb: '200, 150, 255' }],
};

/**
 * The Locations' map paintings (art/locations/map), by Location id: the Titan's eyes far off in the
 * Threshold's fog, the Foundry's lava pulsing down its basin, the Sanctum's candles and cathedral.
 */
export const MAP_LIGHTS: Record<string, readonly SceneLight[]> = {
  theThreshold: [
    { kind: 'eye', x: 47.9, y: 17.3, size: 2.5, rgb: '242, 71, 220', phase: 2.2 },
    { kind: 'eye', x: 52.0, y: 17.3, size: 2.5, rgb: '242, 71, 220', phase: 2.2 },
  ],
  moltenFoundry: [
    { kind: 'glow', x: 64, y: 41, size: 9, rgb: '255, 70, 40', phase: 0.0 },
    { kind: 'glow', x: 56, y: 48, size: 10, rgb: '255, 70, 40', phase: 0.6 },
    { kind: 'glow', x: 64, y: 52, size: 11, rgb: '255, 70, 40', phase: 1.2 },
    { kind: 'glow', x: 48, y: 58, size: 12, rgb: '255, 70, 40', phase: 1.8 },
    { kind: 'glow', x: 66, y: 65, size: 13, rgb: '255, 70, 40', phase: 2.4 },
    { kind: 'glow', x: 51, y: 76, size: 15, rgb: '255, 70, 40', phase: 3.0 },
  ],
  holySanctum: [
    { kind: 'glow', x: 62, y: 32, size: 22, rgb: '255, 200, 130' },
    { kind: 'candle', x: 16.9, y: 58.9, size: 4 },
    { kind: 'candle', x: 40.6, y: 53.2, size: 4 },
    { kind: 'candle', x: 50.8, y: 73.8, size: 4 },
    { kind: 'candle', x: 84.4, y: 77.9, size: 4 },
  ],
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
