import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useAmbientLocation } from './LocationContext';
import { LocationAmbience } from './LocationSky';

// The shared stage every map-node screen is set on: a full-bleed sky and an unboxed header.
// Everything is tinted from `--node-rgb`, which THE SCREEN sets once on its own `.node-screen`
// root; neither component takes a tint of its own (a sibling of the header would fall back to
// the default while the header beside it was tinted).

/** var(--accent) — the run loop's default reward hue. */
export const NODE_TINT_GOLD = '224, 166, 60';
/** var(--magical) — relics and pacts. */
export const NODE_TINT_ARCANE = '139, 127, 224';
/** var(--buff) — the Mentor. */
export const NODE_TINT_TEAL = '63, 184, 175';
/** var(--hp-high) — vitality grants. */
export const NODE_TINT_VITAL = '76, 175, 106';
/** var(--mana) — mana pool and regen grants. */
export const NODE_TINT_MANA = '74, 144, 217';

const MOTE_COUNT = 12;

// Golden-angle scatter: a pure function of the index, stable across re-renders with no seed.
function useMotes(count: number) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const seed = i * 137.51;
        return {
          left: seed % 100,
          delay: (seed * 1.3) % 7,
          duration: 6 + ((seed * 0.29) % 4),
          size: 2 + ((seed * 0.17) % 2),
        };
      }),
    [count]
  );
}

interface NodeSkyProps {
  motes?: number;
}

/** How much of a location's authored weather a node screen carries. */
const NODE_MOTE_DENSITY = 0.5;

/**
 * Full-bleed sky. Must be the first child of a `position: relative` screen root; everything after
 * it needs `position: relative; z-index: 1` (`.node-screen > *` does this) or it paints under the
 * wash. Inside an act the Location replaces the generic motes (two fields is noise, not atmosphere):
 * the node's `--node-rgb` keeps the wash and header, the location owns ground, horizon and weather.
 */
export function NodeSky({ motes = MOTE_COUNT }: NodeSkyProps) {
  const field = useMotes(motes);
  const location = useAmbientLocation();

  return (
    <div className="node-sky" aria-hidden="true">
      <span className="node-sky-wash" />
      {location ? (
        <LocationAmbience location={location} density={NODE_MOTE_DENSITY} className="node-location" />
      ) : (
        <div className="node-motes">
          {field.map((m, i) => (
            <span
              key={i}
              className="node-mote"
              style={
                {
                  left: `${m.left}%`,
                  width: `${m.size}px`,
                  height: `${m.size}px`,
                  animationDelay: `${m.delay}s`,
                  animationDuration: `${m.duration}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface NodeHeaderProps {
  /** Letterspaced kicker above the title — what *kind* of moment this is ("Spoils", "A Pact Awaits"). */
  eyebrow?: string;
  /** A string, not a node: it is duplicated blurred behind itself to make the bloom. */
  title: string;
  /** Drawn inline before the title; not part of the bloom (a blurred icon is a smudge). */
  glyph?: ReactNode;
  /** Line under the title. Height is reserved either way so nothing below shifts. */
  readout?: ReactNode;
  /** True once `readout` reports an outcome rather than an instruction — brightens it. */
  readoutLive?: boolean;
  /** Remounts the readout (replaying its fade) when it changes; keying the whole header would replay the title. */
  readoutKey?: string;
  /** Art standing above the eyebrow (the Mentor). */
  art?: ReactNode;
  /** Rotating dashed ring around the art. Ignored without art. */
  ring?: boolean;
  /** Smaller type for a screen whose body is already tall. */
  compact?: boolean;
  /** Lifts the header out of the column so what follows centres on the whole screen, not on what is left under it. */
  floating?: boolean;
  children?: ReactNode;
}

export function NodeHeader({
  eyebrow,
  title,
  glyph,
  readout,
  readoutKey,
  readoutLive,
  art,
  ring,
  compact,
  floating,
  children,
}: NodeHeaderProps) {
  return (
    <header
      className={`node-header${compact ? ' is-compact' : ''}${art ? ' has-art' : ''}${floating ? ' is-floating' : ''}`}
    >
      {ring && art && <span className="node-ring" aria-hidden="true" />}
      {art}
      {eyebrow && <div className="node-eyebrow">{eyebrow}</div>}
      <h2 className="node-title">
        <span className="node-title-glow" aria-hidden="true">
          {title}
        </span>
        {glyph && <span className="node-title-glyph">{glyph}</span>}
        {title}
      </h2>
      {/* Between the title and the readout: whatever this node counts out first (the orb track). */}
      {children}
      {readout !== undefined && (
        <p className={`node-readout${readoutLive ? ' is-live' : ''}`} key={readoutKey}>
          {readout}
        </p>
      )}
    </header>
  );
}
