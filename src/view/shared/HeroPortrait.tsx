import type { CSSProperties } from 'react';
import { heroArt } from './heroArt';

interface Props {
  heroId: string;
  className: string;
  /** Idle-breath seed; combat passes `combatantId` so two identical goblins don't breathe in lockstep. */
  seed?: string;
}

/** FNV-1a; only feeds cosmetic jitter. */
function hashSeed(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h);
}

/** Renders nothing for heroes without art, so callers can place it unconditionally. */
export function HeroPortrait({ heroId, className, seed }: Props) {
  const src = heroArt[heroId];
  if (!src) return null;
  const h = hashSeed(seed ?? heroId);
  const idleStyle = {
    '--idle-phase': ((h % 97) / 97).toFixed(3),
    '--idle-rate': (0.85 + ((h >>> 7) % 31) / 100).toFixed(2),
  } as CSSProperties;
  // draggable={false} as well as CSS `-webkit-user-drag: none` (WebKit-only): a drag ghost eats the long-press.
  return <img className={className} src={src} alt="" style={idleStyle} draggable={false} />;
}
