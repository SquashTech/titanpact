import { useEffect, useState, type CSSProperties } from 'react';
import { getTypeColorRgb } from './typeColors';

/**
 * The element manifesting on a move's target — one effect per type, played
 * over the target's stage on the beat the move is declared (buildBeats'
 * `fx`), whatever the move. Pure CSS: the container carries the type's
 * colour and its class picks the keyframes (styles.css "Type FX"); the
 * particles are bare <i>s numbered by `--i` so one rule fans them out.
 */

/** How many particles each type's effect is built from. Unlisted types get the fallback burst. */
const PARTICLES: Record<string, number> = {
  Fire: 6,
  Water: 6,
  Frost: 6,
  Storm: 5,
  Stone: 5,
  Nature: 6,
  Light: 6,
  Shadow: 5,
  Arcane: 6,
  Mind: 3,
  Spirit: 4,
  Iron: 2,
  Mech: 4,
  Beast: 3,
  Ancient: 4,
};

/** Longest of the type animations, so the element is gone before it is unmounted. */
export const TYPE_FX_MS = 1100;

export function TypeFx({ type }: { type: string }) {
  const [live, setLive] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setLive(false), TYPE_FX_MS);
    return () => window.clearTimeout(timer);
  }, []);
  if (!live) return null;
  const count = PARTICLES[type] ?? 5;
  const kind = PARTICLES[type] ? type.toLowerCase() : 'burst';
  return (
    <div className={`type-fx type-fx-${kind}`} style={{ '--fx-rgb': getTypeColorRgb(type) } as CSSProperties} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={{ '--i': i, '--n': count } as CSSProperties} />
      ))}
    </div>
  );
}
