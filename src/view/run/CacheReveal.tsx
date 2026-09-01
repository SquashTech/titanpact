import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from '../shared/reducedMotion';

/**
 * The beat a cache opens on — a chest that strains against its lid, gives, and
 * throws light — shared by every node in the run that hands over gear:
 * NodeRewardScreen's `equipmentReward` (which then reveals its three offers)
 * and CacheOpenScreen, which stands in front of the Weapon/Armor/Accessory
 * caches on the way to the forced equip gate.
 *
 * Lifted out of NodeRewardScreen, where it was authored inline and was broken
 * in three ways that all had the same root cause — a picture assembled out of
 * parts that were never meant to be animated:
 *
 *  1. **The chest was a sword, 16 pixels wide.** It drew `RunGlyph
 *     kind="equipment"`, whose `ICON_INDEX` maps to cell 97 of the pixel-art
 *     sheet — a sword — under a caption that said the cache was opening. Worse,
 *     `.run-glyph` pins `--iconset-glyph-size: 16px`, so the `font-size: 64px`
 *     on the container did nothing at all: the thing "opening" was a 16px
 *     sprite adrift in a 220px pool of light. There has been a real chest in
 *     the vector vocabulary the whole time (`SECTION_PATHS.equipment`,
 *     sectionIcons.tsx) and the map node already wears it.
 *  2. **The glow was not centred on it.** `.equip-cache-chest-glow` centred
 *     itself with `transform: translate(-50%, -50%)` and then ran
 *     `evolution-glow-pulse`, whose keyframes set `transform: translateX(-50%)
 *     scale(...)` — no Y. An animation's transform *replaces* the base one, so
 *     the light jumped half its own height (110px) down the screen on the first
 *     frame and pulsed there. Nothing here centres with a transform anymore;
 *     the layers are sized to the stage and inset, so a keyframe is free to own
 *     `transform` outright.
 *  3. **The opening was one scale-and-fade, in 350ms.** The whole payoff — the
 *     part the player is waiting through the shake for — was the sprite growing
 *     40% and vanishing. The lid now actually swings, on its own hinge, with
 *     light coming out of the seam it leaves.
 *
 * The chest is authored here rather than in sectionIcons.tsx on purpose: that
 * file's chest is one mass, which is right for a 16px header mark and useless
 * to animate. This is the same object drawn as a *rig* — body, seam and lid as
 * three separately transformable pieces — and a rig has no business in an icon
 * table. Same 24x24 grid and same `currentColor` rule, so it still reads as the
 * same chest.
 */

/** How long the chest strains before the lid gives (ms). */
export const CACHE_SEAL_MS = 820;
/** The lid's flight and the light coming out of it (ms) — the payoff, and the reason this is no longer the 350ms it was. */
export const CACHE_BURST_MS = 520;
/** Mount to "the screen may now show what was inside" (ms). */
export const CACHE_OPEN_MS = CACHE_SEAL_MS + CACHE_BURST_MS;

export type CachePhase = 'sealed' | 'opening' | 'open';

/**
 * Drives the beat and fires its one sound. Every caller gets the same timing
 * and the same latch, which is the point of it being a hook rather than three
 * copies of a `useEffect`.
 *
 * `active` is what lets NodeRewardScreen — one component serving four node
 * types, only one of which has a cache — opt the other three straight to
 * `open` without a conditional hook.
 */
export function useCacheOpening(active: boolean): CachePhase {
  const [phase, setPhase] = useState<CachePhase>(active ? 'sealed' : 'open');

  useEffect(() => {
    if (!active) return;
    // A player who has asked for reduced motion gets the contents, not a
    // second and a third of a screen holding still (see reducedMotion.ts).
    if (prefersReducedMotion()) {
      setPhase('open');
      return;
    }
    const burst = window.setTimeout(() => {
      setPhase('opening');
      // Fired here, not on mount: the sound IS the lid giving way, and this is
      // the frame it gives way on.
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

/**
 * Twelve sparks thrown out of the lid. Angles come off the golden angle, the
 * same stable-without-a-seed scatter NodeSky's motes and the draft's dust use,
 * so the burst is never symmetrical and never re-rolls between renders.
 *
 * Each spark carries its own angle, distance, size and delay as custom
 * properties and is positioned with `left`/`top` plus a negative margin rather
 * than a centring transform — `transform` belongs entirely to the keyframe
 * here, which is the mistake this component exists to stop repeating.
 */
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
  /** The line under the chest. Short — it is on screen for under a second. */
  caption: string;
  /**
   * A silhouette of what is inside, drawn rising out of the lid as it opens.
   * The slot caches pass their gear form; the Equipment Cache passes nothing,
   * because it is about to offer three different things and promising one
   * shape would be a lie.
   */
  payload?: ReactNode;
}

/**
 * The chest itself. Renders nothing once `phase` is `open` — the caller owns
 * what replaces it, and every one of them replaces it with something different.
 */
export function CacheOpening({ phase, caption, payload }: CacheOpeningProps) {
  if (phase === 'open') return null;

  return (
    <div className={`cache-open${phase === 'opening' ? ' is-opening' : ' is-sealed'}`}>
      <div className="cache-open-stage">
        {/* Ambient pool the chest stands in. Inset to the stage rather than
            centred with a transform, so the pulse keyframe can own transform. */}
        <div className="cache-open-glow" aria-hidden="true" />
        {/* One expanding ring, on the frame the lid gives — the shockwave. */}
        <div className="cache-open-burst" aria-hidden="true" />
        {/* The shaft of light standing out of the open lid. */}
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

        <svg className="cache-chest" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          {/* Sat a shade high in the box: the lid swings up and out of it, and
              a chest centred on its closed silhouette clips its own lid. */}
          <g transform="translate(0 1.1)">
            {/* Body, with the lock plate knocked out (evenodd) rather than drawn
                over it — a filled plate on a filled body is one mass. */}
            <path
              className="cache-chest-body"
              fillRule="evenodd"
              d="M3.2 12.4h17.6v6.2a2.2 2.2 0 0 1-2.2 2.2H5.4a2.2 2.2 0 0 1-2.2-2.2Zm7.3 1.3v3.4h3v-3.4Z"
            />
            {/* The seam. Drawn between body and lid so it is covered while the
                chest is shut and stands proud the instant the lid clears it. */}
            <rect className="cache-chest-seam" x="3.6" y="11.5" width="16.8" height="1.2" rx="0.6" />
            {/* Lid: a shallow arch over a lip, hinged at its left end (see
                `.cache-chest-lid`'s transform-origin). */}
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
