import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from '../shared/reducedMotion';
import chestSeal from '../../../art/cache/chest-seal.png';
import chestOpen from '../../../art/cache/chest-open.png';

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
  /** Silhouette of what is inside, rising out of the lid. Omitted where the contents are a choice. */
  payload?: ReactNode;
}

/** Renders nothing once `phase` is `open` — the caller owns what replaces it. */
export function CacheOpening({ phase, payload }: CacheOpeningProps) {
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

        {/* Pixel frames (art/cache): the rattle loops while sealed, the lid swing plays once on the burst. */}
        <div
          className="cache-chest"
          style={{ '--chest-seal': `url(${chestSeal})`, '--chest-open': `url(${chestOpen})` } as CSSProperties}
          aria-hidden="true"
        >
          <span className="cache-chest-frames" />
        </div>
      </div>

    </div>
  );
}
