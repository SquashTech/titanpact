import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { TypeId } from '../../engine/content';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeWheel } from '../shared/TypeWheel';
import { TypeBadge } from '../shared/TypeBadge';
import { ElementGlyph } from '../shared/elementIcons';
import { overlayHost } from '../shared/overlayHost';
import { prefersReducedMotion } from '../shared/reducedMotion';

interface Props {
  heroId: string;
  /** How the hero was got — only the kicker differs; every way in is a contract signed. */
  source: 'contract' | 'guild' | 'event';
  /** The typing the hero actually arrives with — a contract veteran may already be grafted. */
  types?: readonly TypeId[];
  /** The form a contract veteran arrives in, if it evolved before it was beaten. */
  pathId?: string | null;
  onDone: () => void;
}

/** Beat boundaries, in ms from the moment the hero lands on the roster. */
const BEATS = { sign: 650, stamp: 1650, bind: 2500, sworn: 3100, done: 5600 } as const;
/** The wax meeting the page, inside the stamp beat (ms) — `recruit-rite-wax-drop`'s 70%. */
const STAMP_LAND_MS = 230;

type Beat = 'unfurl' | 'sign' | 'stamp' | 'bind' | 'sworn';

const SOURCE_KICKER: Record<Props['source'], string> = {
  contract: 'Contract Sealed',
  guild: 'Hired at the Guild Hall',
  event: 'Joined on the Road',
};

// Golden-angle scatter: the embers the page burns into, stable with no seed.
const EMBERS = Array.from({ length: 18 }, (_, i) => {
  const seed = i * 137.51;
  return { left: 6 + (seed % 88), delay: (seed * 0.013) % 0.35, drift: ((seed * 0.7) % 60) - 30, rise: 120 + ((seed * 0.41) % 120) };
});

/**
 * A hero joining the pact, as a contract signed (2026-10-07, per user direction — every recruit
 * spends a Recruit Contract, so the moment is that document). The page UNFURLS with the hero's
 * cameo on it, the name is SIGNED across the line, the wax STAMPS down in the hero's colour, and
 * the page BURNS into the seal — the chart locking behind — and the hero steps out of the light,
 * SWORN. Tap skips: four hires in one Guild Hall visit must not be four times this.
 */
export function RecruitFanfare({ heroId, source, types, pathId, onDone }: Props) {
  const [beat, setBeat] = useState<Beat>('unfurl');
  const hero = rosterHeroes[heroId];

  useEffect(() => {
    if (prefersReducedMotion()) {
      onDone();
      return;
    }
    playSfx('scroll.spend', { pitch: 0.8 });
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
    const timers = [
      at(BEATS.sign, () => {
        setBeat('sign');
        playSfx('quill.scratch');
      }),
      at(BEATS.stamp, () => setBeat('stamp')),
      at(BEATS.stamp + STAMP_LAND_MS, () => playSfx('wax.stamp')),
      at(BEATS.bind, () => {
        setBeat('bind');
        playSfx('pact.bind', { pitch: 0.92, gain: 1.2 });
      }),
      at(BEATS.sworn, () => {
        setBeat('sworn');
        playSfx('star.reveal');
      }),
      at(BEATS.done, onDone),
    ];
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hero) return null;
  const typing = types ?? hero.types;

  // Portalled into overlayHost(), never body (overlayHost.ts). A host screen is a flex column
  // whose children the stage rules pin to `position: relative`, which flattened this into the
  // bottom of the page instead of covering it.
  return createPortal(
    <div
      className={`recruit-rite is-${beat}`}
      style={{ '--pact-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
      onClick={onDone}
    >
      <span className="recruit-rite-veil" aria-hidden="true" />
      <span className="recruit-rite-rays" aria-hidden="true" />

      <div className="recruit-rite-stage">
        {/* The chart spins up and LOCKS with the hero's innate type dead-top as the page burns. */}
        <TypeWheel className="recruit-rite-wheel" size={280} focus={typing} topType={hero.types[0]} />
        <span className="recruit-rite-ring is-outer" aria-hidden="true" />
        <span className="recruit-rite-ring is-inner" aria-hidden="true" />
        <HeroPortrait heroId={hero.id} pathId={pathId} className="recruit-rite-figure" />

        <div className="recruit-scroll" aria-hidden="true">
          <span className="recruit-scroll-rod is-top" />
          <div className="recruit-scroll-sheet">
            <span className="recruit-scroll-title">Recruit Contract</span>
            <span className="recruit-scroll-cameo">
              <HeroPortrait heroId={hero.id} pathId={pathId} className="recruit-scroll-portrait" />
            </span>
            <span className="recruit-scroll-terms">
              Let it be known that the one who signs below binds its strength to the Pact, until the Titan sleeps.
            </span>
            <span className="recruit-scroll-sign">
              {/* The ink is clipped as it is written; the quill rides the clip's edge, outside it. */}
              <span className="recruit-scroll-signature">
                <span className="recruit-scroll-ink">{hero.name}</span>
                <span className="recruit-scroll-quill" />
              </span>
            </span>
            <span className="recruit-scroll-wax">
              <ElementGlyph type={hero.types[0]} className="recruit-scroll-wax-glyph" />
            </span>
          </div>
          <span className="recruit-scroll-rod is-bottom" />
        </div>

        {/* Outside the page, which fades as it burns: the embers outlive it. */}
        {EMBERS.map((e, i) => (
          <span
            key={i}
            className="recruit-rite-ember"
            style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, '--drift': `${e.drift}px`, '--rise': `${-e.rise}px` } as CSSProperties}
            aria-hidden="true"
          />
        ))}

        <span className="recruit-rite-flash" aria-hidden="true" />
      </div>

      <div className="recruit-rite-plate">
        <div className="recruit-rite-kicker">{SOURCE_KICKER[source]}</div>
        <h2 className="recruit-rite-name">{hero.name}</h2>
        <div className="recruit-rite-oath">joins your pact</div>
        <div className="recruit-rite-types">
          {typing.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
      </div>
    </div>,
    overlayHost()
  );
}
