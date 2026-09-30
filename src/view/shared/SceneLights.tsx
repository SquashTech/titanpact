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

/**
 * The Locations' map paintings (art/locations/map), by Location id. Wild's Edge has its stars taken
 * out of the painting and drawn here whole (twinkle, glint); elsewhere the painted stars stay and a
 * sparkle or glimmer, in the star's own colour, flares over one now and then. The Foundry's furnace
 * windows flicker and its lava pulses down the canyon; the Sanctum's windows are candlelit.
 */
export const MAP_LIGHTS: Record<string, readonly SceneLight[]> = {
  blightedShrine: [
    { kind: 'glimmer', x: 90.05, y: 12.79, rgb: '237, 223, 244' },
    { kind: 'sparkle', x: 43.11, y: 13.02, rgb: '237, 223, 244' },
    { kind: 'sparkle', x: 61.73, y: 18.90, rgb: '237, 223, 244' },
    { kind: 'sparkle', x: 27.30, y: 20.29, rgb: '237, 223, 244' },
    { kind: 'sparkle', x: 7.14, y: 25.58, rgb: '237, 223, 244' },
    { kind: 'sparkle', x: 77.96, y: 27.56, rgb: '237, 223, 244' },
    { kind: 'glimmer', x: 62.76, y: 30.96, rgb: '237, 223, 244' },
    { kind: 'glimmer', x: 40.56, y: 32.27, rgb: '237, 223, 244' },
    { kind: 'sparkle', x: 94.80, y: 36.86, rgb: '237, 223, 244' },
    { kind: 'sparkle', x: 84.29, y: 42.21, rgb: '237, 223, 244' },
  ],
  dreamingSpires: [
    { kind: 'sparkle', x: 14.44, y: 12.50, rgb: '243, 216, 211' },
    { kind: 'glimmer', x: 6.38, y: 18.17, rgb: '243, 216, 211' },
    { kind: 'sparkle', x: 92.55, y: 18.49, rgb: '243, 216, 211' },
    { kind: 'glimmer', x: 71.17, y: 22.24, rgb: '243, 216, 211' },
  ],
  frozenReach: [
    { kind: 'glimmer', x: 19.13, y: 12.06, rgb: '220, 243, 248' },
    { kind: 'glimmer', x: 14.03, y: 12.35, rgb: '98, 192, 236' },
    { kind: 'sparkle', x: 89.80, y: 12.79, rgb: '220, 243, 248' },
    { kind: 'sparkle', x: 27.50, y: 20.55, rgb: '220, 243, 248' },
    { kind: 'sparkle', x: 95.41, y: 23.55, rgb: '220, 243, 248' },
    { kind: 'sparkle', x: 59.18, y: 39.24, rgb: '220, 243, 248' },
    { kind: 'sparkle', x: 81.99, y: 39.27, rgb: '220, 243, 248' },
    { kind: 'sparkle', x: 37.76, y: 42.44, rgb: '220, 243, 248' },
    { kind: 'sparkle', x: 3.06, y: 45.93, rgb: '220, 243, 248' },
  ],
  necropolis: [
    { kind: 'glimmer', x: 41.58, y: 13.66, rgb: '208, 239, 237' },
    { kind: 'glimmer', x: 72.45, y: 15.84, rgb: '208, 239, 237' },
    { kind: 'glimmer', x: 66.58, y: 31.25, rgb: '208, 239, 237' },
    { kind: 'glimmer', x: 13.52, y: 48.69, rgb: '208, 239, 237' },
  ],
  theThreshold: [
    { kind: 'glimmer', x: 43.11, y: 12.65, rgb: '237, 229, 178' },
    { kind: 'glimmer', x: 61.48, y: 14.68, rgb: '237, 229, 178' },
    { kind: 'glimmer', x: 27.30, y: 20.49, rgb: '245, 242, 192' },
    { kind: 'glimmer', x: 71.17, y: 22.24, rgb: '245, 242, 192' },
    { kind: 'glimmer', x: 39.54, y: 23.69, rgb: '237, 229, 178' },
    { kind: 'glimmer', x: 57.91, y: 26.89, rgb: '245, 242, 192' },
    { kind: 'glimmer', x: 22.19, y: 27.47, rgb: '237, 229, 178' },
    { kind: 'glimmer', x: 63.01, y: 30.96, rgb: '245, 242, 192' },
    { kind: 'glimmer', x: 26.28, y: 33.58, rgb: '237, 229, 178' },
    { kind: 'glimmer', x: 69.13, y: 35.61, rgb: '237, 229, 178' },
  ],
  thunderAerie: [
    { kind: 'sparkle', x: 43.06, y: 13.05, rgb: '235, 236, 171' },
    { kind: 'sparkle', x: 27.19, y: 20.26, rgb: '235, 236, 171' },
    { kind: 'sparkle', x: 62.50, y: 30.81, rgb: '235, 236, 171' },
    { kind: 'glimmer', x: 76.28, y: 35.61, rgb: '235, 236, 171' },
  ],
  forbiddenForest: [
    { kind: 'glimmer', x: 25.77, y: 15.84, rgb: '199, 234, 160' },
    { kind: 'glimmer', x: 56.38, y: 17.59, rgb: '199, 234, 160' },
    { kind: 'glimmer', x: 39.03, y: 23.69, rgb: '199, 234, 160' },
    { kind: 'glimmer', x: 57.91, y: 26.89, rgb: '199, 234, 160' },
  ],
  moltenFoundry: [
    { kind: 'flame', x: 28.1, y: 25.5, size: 7 },
    { kind: 'flame', x: 76.3, y: 28.8, size: 7 },
    { kind: 'flame', x: 23.6, y: 55.3, size: 6 },
    { kind: 'flame', x: 22.9, y: 59.2, size: 9 },
    { kind: 'flame', x: 79.5, y: 66.5, size: 11 },
    { kind: 'glow', x: 52.8, y: 72.1, size: 9, rgb: '255, 110, 40', phase: 0.0 },
    { kind: 'glow', x: 55.1, y: 77.8, size: 11, rgb: '255, 110, 40', phase: 0.6 },
    { kind: 'glow', x: 55.4, y: 82.5, size: 13, rgb: '255, 110, 40', phase: 1.2 },
    { kind: 'glow', x: 50.6, y: 86.9, size: 14, rgb: '255, 110, 40', phase: 1.8 },
    { kind: 'glow', x: 52.1, y: 92.8, size: 14, rgb: '255, 110, 40', phase: 2.4 },
    { kind: 'glow', x: 46.9, y: 98.3, size: 15, rgb: '255, 110, 40', phase: 3.0 },
  ],
  holySanctum: [
    { kind: 'candle', x: 93.4, y: 43.9, size: 4 },
    { kind: 'candle', x: 87.8, y: 49.0, size: 4 },
    { kind: 'candle', x: 13.9, y: 57.3, size: 4 },
    { kind: 'candle', x: 80.0, y: 59.2, size: 4 },
    { kind: 'candle', x: 69.4, y: 59.4, size: 4 },
    { kind: 'candle', x: 80.0, y: 67.0, size: 4 },
    { kind: 'candle', x: 87.0, y: 67.6, size: 4 },
    { kind: 'candle', x: 59.1, y: 72.8, size: 4 },
    { kind: 'candle', x: 47.4, y: 74.4, size: 4 },
    { kind: 'candle', x: 52.4, y: 74.5, size: 4 },
    { kind: 'candle', x: 51.0, y: 76.9, size: 4 },
    { kind: 'candle', x: 69.8, y: 78.8, size: 4 },
    { kind: 'candle', x: 57.6, y: 79.5, size: 4 },
    { kind: 'candle', x: 63.7, y: 79.9, size: 4 },
  ],
  wildsEdge: [
    { kind: 'twinkle', x: 65.05, y: 5.96 },
    { kind: 'twinkle', x: 19.13, y: 6.4 },
    { kind: 'twinkle', x: 42.86, y: 12.8 },
    { kind: 'twinkle', x: 85.46, y: 20.49 },
    { kind: 'twinkle', x: 38.52, y: 23.69 },
    { kind: 'twinkle', x: 62.24, y: 30.96 },
    { kind: 'twinkle', x: 9.44, y: 14.1 },
    { kind: 'twinkle', x: 89.8, y: 43.9 },
    { kind: 'glint', x: 78.57, y: 11.77 },
    { kind: 'glint', x: 8.4, y: 38.2 },
    { kind: 'glint', x: 75.3, y: 40.1 },
    { kind: 'glint', x: 6.38, y: 26.31 },
    { kind: 'glint', x: 94.13, y: 31.54 },
    { kind: 'glint', x: 71.68, y: 37.94 },
    { kind: 'glint', x: 14.54, y: 35.03 },
    { kind: 'glint', x: 24.23, y: 17.3 },
  ],
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
