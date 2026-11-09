import type { CSSProperties } from 'react';
import anvilArt from '../../../art/smithy/anvil.png';
import hammerArt from '../../../art/smithy/hammer.png';
import circleArt from '../../../art/smithy/circle.png';

// The Forge's hardware (ForgeNodeScreen, SmithyBeat): an anvil in side view, the hammer that works
// it, and the binding circle, in the same pixel art as the pieces they work (art/smithy). The
// circle is a mask, so it burns in whatever colour its caller sets.

/** The anvil on its stump, horn left: 64px art, sized by the caller. */
export function AnvilFigure({ className, style }: { className?: string; style?: CSSProperties }) {
  return <img src={anvilArt} className={`smithy-pixel${className ? ` ${className}` : ''}`} style={style} alt="" aria-hidden="true" draggable={false} />;
}

/** The forging hammer stood upright on its handle's end — the art is drawn on the diagonal, so it is turned in its box. */
export function HammerFigure({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={className} style={style} aria-hidden="true">
      <img src={hammerArt} className="smithy-pixel smithy-hammer-art" alt="" draggable={false} />
    </span>
  );
}

/** The binding circle: its runes cut from `currentColor`, turning slowly. */
export function RuneRing({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={className} style={style} aria-hidden="true">
      <span className="smithy-circle-art" style={{ '--circle-art': `url(${circleArt})` } as CSSProperties} />
    </span>
  );
}
