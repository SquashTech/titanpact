import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from '../shared/reducedMotion';

// The cache-opening beat, shared by NodeRewardScreen's equipmentReward and
// CacheOpenScreen. Nothing in here centres with a transform: every keyframe
// owns `transform` outright, so layers are sized to the stage and inset instead.

/** Strain before the lid gives (ms). */
const CACHE_SEAL_MS = 820;
/** The lid's flight and the light out of it (ms). */
const CACHE_BURST_MS = 520;
const CACHE_OPEN_MS = CACHE_SEAL_MS + CACHE_BURST_MS;

type CachePhase = 'sealed' | 'opening' | 'open';

/** `active: false` opts a caller straight to `open` without a conditional hook. */
export function useCacheOpening(active: boolean): CachePhase {
  const [phase, setPhase] = useState<CachePhase>(active ? 'sealed' : 'open');

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) {
      setPhase('open');
      return;
    }
    const burst = window.setTimeout(() => {
      setPhase('opening');
      // The sound IS the lid giving way — fired on this frame, not on mount.
      playSfx('cache.open');
    }, CACHE_SEAL_MS);
    const open = window.setTimeout(() => setPhase('open'), CACHE_OPEN_MS);
    return () => {
      window.clearTimeout(burst);
      window.clearTimeout(open);
    };
  }, [active]);

  return phase;
}

// Golden-angle scatter: stable across renders, never symmetrical, no seed.
const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const seed = i * 137.51;
  return {
    angle: seed % 360,
    distance: 46 + ((seed * 0.31) % 34),
    size: 2.5 + ((seed * 0.13) % 2.5),
    delay: (seed * 0.7) % 110,
  };
});

interface CacheOpeningProps {
  phase: CachePhase;
  caption: string;
  /** Silhouette of what is inside, rising out of the lid. Omitted where the contents are a choice. */
  payload?: ReactNode;
}

/** Renders nothing once `phase` is `open` — the caller owns what replaces it. */
export function CacheOpening({ phase, caption, payload }: CacheOpeningProps) {
  if (phase === 'open') return null;

  return (
    <div className={`cache-open${phase === 'opening' ? ' is-opening' : ' is-sealed'}`}>
      <div className="cache-open-stage">
        <div className="cache-open-glow" aria-hidden="true" />
        <div className="cache-open-burst" aria-hidden="true" />
        <div className="cache-open-shaft" aria-hidden="true" />

        <div className="cache-open-sparks" aria-hidden="true">
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="cache-spark"
              style={
                {
                  '--spark-angle': `${s.angle}deg`,
                  '--spark-distance': `${s.distance}px`,
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                  marginLeft: `${-s.size / 2}px`,
                  marginTop: `${-s.size / 2}px`,
                  animationDelay: `${s.delay}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>

        {payload && <div className="cache-open-payload">{payload}</div>}

        {/* A rig — body, seam, lid as separate pieces — not sectionIcons' one-mass chest. */}
        <svg className="cache-chest" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          {/* Sat a shade high so the swinging lid doesn't clip. */}
          <g transform="translate(0 1.1)">
            <path
              className="cache-chest-body"
              fillRule="evenodd"
              d="M3.2 12.4h17.6v6.2a2.2 2.2 0 0 1-2.2 2.2H5.4a2.2 2.2 0 0 1-2.2-2.2Zm7.3 1.3v3.4h3v-3.4Z"
            />
            <rect className="cache-chest-seam" x="3.6" y="11.5" width="16.8" height="1.2" rx="0.6" />
            <g className="cache-chest-lid">
              <path d="M3.2 11.4a12 12 0 0 1 17.6 0Z" />
              <rect x="3.2" y="10" width="17.6" height="1.8" rx="0.7" />
            </g>
          </g>
        </svg>
      </div>

      <p className="cache-open-caption">{caption}</p>
    </div>
  );
}
