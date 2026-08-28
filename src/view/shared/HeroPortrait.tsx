import type { CSSProperties } from 'react';
import { heroArt } from './heroArt';

interface Props {
  heroId: string;
  className: string;
  /**
   * Distinguishes this portrait from another of the SAME hero on screen when
   * seeding the idle breath (styles.css "Idle breath"). Defaults to `heroId`,
   * which is enough everywhere a hero appears once; combat passes
   * `combatant.combatantId` so a pair of identical goblins don't breathe in
   * lockstep, which is the one thing that makes the effect read as
   * "an animation is playing" rather than as two creatures standing there.
   */
  seed?: string;
}

/** Cheap stable string hash (FNV-1a). Only ever feeds cosmetic jitter, so collisions cost nothing. */
function hashSeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h);
}

/** Renders a hero's pixel-art portrait if one exists in heroArt; renders nothing otherwise, so callers can place it unconditionally and let heroes without art simply take up no space. */
export function HeroPortrait({ heroId, className, seed }: Props) {
  const src = heroArt[heroId];
  if (!src) return null;
  // Per-figure phase (where in the breath it starts) and rate (how fast it
  // breathes), both unitless multipliers the CSS scales by its own period —
  // so each context tunes one number and every figure in it still desyncs.
  const h = hashSeed(seed ?? heroId);
  const idleStyle = {
    '--idle-phase': ((h % 97) / 97).toFixed(3),
    '--idle-rate': (0.85 + ((h >>> 7) % 31) / 100).toFixed(2),
  } as CSSProperties;
  // draggable={false} as well as styles.css's `-webkit-user-drag: none`: the
  // CSS property is WebKit/Blink-only, and a sprite that starts a drag ghost
  // mid-hold eats the long-press it was in the middle of.
  return <img className={className} src={src} alt="" style={idleStyle} draggable={false} />;
}
