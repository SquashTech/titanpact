import { useEffect, useState, type CSSProperties } from 'react';
import { getTypeColorRgb } from './typeColors';
import { ElementGlyph } from '../shared/elementIcons';

/**
 * A move's payload landing on a figure (buildBeats' BeatFx), played over the
 * target's stage on the beat it takes the payload. Two shapes:
 *   `element`    — the move's type manifesting on a foe, one effect per type;
 *   `buff`       — the one universal grant animation for a target on the caster's
 *                  own side, tinted by the type and lifting its glyph, so what is
 *                  said is "something was granted" and the colour says of what.
 *   `cannonball` — Broadside's volley (buildBeats' PASSIVE_FX): iron shot arcing in
 *                  from off the near edge and bursting, one <i> per ball ACTUALLY fired
 *                  (`count`, the magazine the beat spent), so the picture is the number.
 * Pure CSS: the container carries the type's colour and its class picks the
 * keyframes (styles.css "Type FX"); the particles are bare <i>s numbered by
 * `--i` so one rule fans them out.
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

const BUFF_PARTICLES = 6;

/** A broadside with no count to read (a fixture, an old save's event): one ball rather than none. */
const CANNONBALL_FALLBACK = 1;
/** However full the magazine gets, the fan has to stay inside the figure's stage. */
const CANNONBALL_MAX = 6;

/** Past the longest animation including its stagger (Spirit's last wisp, 1300ms), so nothing is unmounted mid-fade. */
export const TYPE_FX_MS = 1400;

export function TypeFx({ type, kind, count }: { type: string; kind: 'element' | 'buff' | 'cannonball'; count?: number }) {
  const [live, setLive] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setLive(false), TYPE_FX_MS);
    return () => window.clearTimeout(timer);
  }, []);
  if (!live) return null;
  const buff = kind === 'buff';
  const shots = Math.max(1, Math.min(CANNONBALL_MAX, count ?? CANNONBALL_FALLBACK));
  const particles = kind === 'cannonball' ? shots : buff ? BUFF_PARTICLES : (PARTICLES[type] ?? 5);
  const shape = kind === 'cannonball' ? 'cannonball' : buff ? 'buff' : PARTICLES[type] ? type.toLowerCase() : 'burst';
  return (
    <div
      className={`type-fx type-fx-${shape}`}
      /* --n on the container too: the impact ring waits for the LAST ball, whatever the count. */
      style={{ '--fx-rgb': getTypeColorRgb(type), '--n': particles } as CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: particles }, (_, i) => (
        <i key={i} style={{ '--i': i, '--n': particles } as CSSProperties} />
      ))}
      {buff && (
        <span className="type-fx-glyph">
          <ElementGlyph type={type} />
        </span>
      )}
    </div>
  );
}
