import type { CSSProperties } from 'react';
import anvilArt from '../../../art/smithy/anvil.png';
import hammerArt from '../../../art/smithy/hammer.png';
import circleArt from '../../../art/smithy/circle.png';

// The Smithy's own hardware (ItemServicesSection, SmithyWorkSheet, SmithyBeat): an anvil in side
// view, the hammer that works it, and the Enchanter's circle, in the same pixel art as the pieces
// they work (art/smithy). The circle is a mask, so it burns in whatever colour its caller sets.

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

/** The Enchanter's circle: its runes cut from `currentColor`, turning slowly. */
export function RuneRing({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={className} style={style} aria-hidden="true">
      <span className="smithy-circle-art" style={{ '--circle-art': `url(${circleArt})` } as CSSProperties} />
    </span>
  );
}

/** Embers off the forge, laid out once so the sign does not re-scatter on every render. */
const EMBERS = Array.from({ length: 9 }, (_, i) => {
  const seed = i * 137.51;
  return { x: 18 + ((seed * 0.37) % 64), delay: (seed * 0.9) % 3200, dur: 2600 + ((seed * 0.5) % 1800), size: 2 + ((seed * 0.11) % 2) };
});

/** The forge as a sign: the anvil lit from below, embers rising off it. The Smithy tab's and the Forge node's. */
export function ForgeSign({ className }: { className?: string }) {
  return (
    <div className={`smithy-forge${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span className="smithy-forge-glow" />
      <span className="smithy-forge-embers">
        {EMBERS.map((e, i) => (
          <i
            key={i}
            style={
              {
                left: `${e.x}%`,
                width: `${e.size}px`,
                height: `${e.size}px`,
                animationDelay: `${e.delay}ms`,
                animationDuration: `${e.dur}ms`,
              } as CSSProperties
            }
          />
        ))}
      </span>
      <AnvilFigure className="smithy-forge-anvil" />
    </div>
  );
}
