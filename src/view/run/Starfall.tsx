import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { heroes } from '../../data/heroes';
import { playSfx } from '../../audio/sfx';
import { STARFALL_PRICE } from '../../run/starShop';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { HeroDossierOverlay } from './HeroDossierOverlay';
import { HubGlyph } from '../shared/nodeIcons';
import { TypeBadge } from '../shared/TypeBadge';
import { overlayHost } from '../shared/overlayHost';
import { prefersReducedMotion } from '../shared/reducedMotion';

// The Starfall (docs/collection.md §4): a blind draw of a hero the account does not own. The
// shelf card, and the screen a draw plays out on — the spent stars rising into the Constellation,
// one star answering, and falling to the ground with the hero in it.

/** The draw's name, in one place: the card, the screen, the Collection's note. */
export const STARFALL_NAME = 'Starfall';

/** A fixed night: the same sky every draw, so the Constellation reads as a place and not as noise. */
function skyStars(count: number): { x: number; y: number; r: number; delay: number }[] {
  let seed = 7;
  const next = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: count }, () => ({ x: next() * 100, y: next() * 66, r: 0.35 + next() * 0.9, delay: next() * 4 }));
}
const SKY = skyStars(64);

/** Where the answering star hangs, and where it lands — percent of the stage. */
const TARGET = { x: 64, y: 21 };
const GROUND = { x: 50, y: 74 };
/** The constellation it belongs to, drawn up to it as it wakes. */
const FIGURE: readonly { x: number; y: number }[] = [
  { x: 22, y: 30 },
  { x: 33, y: 16 },
  { x: 47, y: 25 },
  TARGET,
  { x: 79, y: 12 },
  { x: 86, y: 33 },
];

/** Beat boundaries in ms from the tap. */
const BEATS = { firstStar: 450, starGap: 330, kindle: 1350, fall: 2250, land: 2900, reveal: 3350, settled: 4250 } as const;

type Phase = 'rise' | 'kindle' | 'fall' | 'land' | 'reveal';

interface ScreenProps {
  heroId: string;
  /** The balance the stars were spent from, before the draw. */
  balanceBefore: number;
  onClose: () => void;
}

/**
 * The draw, as a scene. The stars leave the balance one at a time and fly up into the sky; one
 * star of a constellation answers, swells and takes the hero's colour — the first hint of what
 * is coming — then lets go, streaks to the ground and lands; the hero stands up out of the light
 * as a silhouette and colours in. A tap before the end skips to the hero.
 */
export function StarfallScreen({ heroId, balanceBefore, onClose }: ScreenProps) {
  const hero = heroes[heroId];
  const [phase, setPhase] = useState<Phase>('rise');
  const [launched, setLaunched] = useState(0);
  const [settled, setSettled] = useState(false);
  const [fallAngle, setFallAngle] = useState(0);
  const [showDossier, setShowDossier] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  // The streak's tail points back along the path, so it needs the stage's real aspect.
  useLayoutEffect(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = ((GROUND.x - TARGET.x) / 100) * rect.width;
    const dy = ((GROUND.y - TARGET.y) / 100) * rect.height;
    setFallAngle((Math.atan2(dy, dx) * 180) / Math.PI);
  }, []);

  function skipToReveal() {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setLaunched(STARFALL_PRICE);
    setPhase('reveal');
    setSettled(true);
  }

  useEffect(() => {
    if (prefersReducedMotion()) {
      skipToReveal();
      return;
    }
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    for (let i = 0; i < STARFALL_PRICE; i++) {
      at(BEATS.firstStar + i * BEATS.starGap, () => {
        setLaunched(i + 1);
        playSfx('star.rise', { pitch: 1 + i * 0.12 });
      });
    }
    at(BEATS.kindle, () => setPhase('kindle'));
    at(BEATS.fall, () => {
      setPhase('fall');
      playSfx('star.fall');
    });
    at(BEATS.land, () => {
      setPhase('land');
      playSfx('star.land');
    });
    at(BEATS.reveal, () => setPhase('reveal'));
    at(BEATS.settled, () => setSettled(true));
    return () => timers.current.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hero) return null;
  const typeRgb = getTypeColorRgb(hero.types[0]);
  const past = (p: Phase) => ['rise', 'kindle', 'fall', 'land', 'reveal'].indexOf(phase) >= ['rise', 'kindle', 'fall', 'land', 'reveal'].indexOf(p);

  // Portalled into overlayHost(), never body (overlayHost.ts).
  return createPortal(
    <div
      className={`starfall is-${phase}${settled ? ' is-settled' : ''}`}
      style={
        {
          '--star-rgb': typeRgb,
          '--target-x': `${TARGET.x}%`,
          '--target-y': `${TARGET.y}%`,
          '--ground-x': `${GROUND.x}%`,
          '--ground-y': `${GROUND.y}%`,
          '--fall-angle': `${fallAngle}deg`,
        } as CSSProperties
      }
      // A portal still bubbles through React to the Constellation, whose backdrop closes it.
      onClick={(e) => {
        e.stopPropagation();
        if (!settled) skipToReveal();
      }}
    >
      <div ref={stageRef} className="starfall-stage">
        <div className="starfall-sky" aria-hidden="true">
          {SKY.map((star, i) => (
            <span
              key={i}
              className="starfall-sky-star"
              style={{ left: `${star.x}%`, top: `${star.y}%`, '--r': star.r, animationDelay: `${star.delay}s` } as CSSProperties}
            />
          ))}
          <svg className="starfall-figure" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline pathLength={1} points={FIGURE.map((p) => `${p.x},${p.y}`).join(' ')} vectorEffect="non-scaling-stroke" />
          </svg>
          {FIGURE.filter((p) => p !== TARGET).map((p, i) => (
            <span key={i} className="starfall-figure-star" style={{ left: `${p.x}%`, top: `${p.y}%` }} />
          ))}
        </div>

        {/* The balance, counting the spend down as each star leaves it. */}
        <div className="starfall-balance" aria-label={`${balanceBefore - launched} stars`}>
          <HubGlyph name="star" />
          <span key={launched} className="starfall-balance-count">
            {balanceBefore - launched}
          </span>
        </div>

        {Array.from({ length: STARFALL_PRICE }, (_, i) => (
          <span key={i} className={`starfall-token${i < launched ? ' is-launched' : ''}`} style={{ '--i': i } as CSSProperties} aria-hidden="true">
            <span className="starfall-token-body">
              <HubGlyph name="star" />
            </span>
          </span>
        ))}

        {/* The answering star: hangs, swells into the hero's colour, lets go. */}
        <span className={`starfall-star${past('kindle') ? ' is-kindled' : ''}`} aria-hidden="true">
          <span className="starfall-star-tail" />
          <span className="starfall-star-core" />
        </span>

        <div className="starfall-ground" aria-hidden="true" />
        <span className="starfall-flash" aria-hidden="true" />
        <span className="starfall-ring" aria-hidden="true" />
        <span className="starfall-embers" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ '--e': i } as CSSProperties} />
          ))}
        </span>
        <span className="starfall-rays" aria-hidden="true" />

        <div className="starfall-hero">
          <HeroPortrait heroId={hero.id} className="starfall-hero-figure" />
        </div>
      </div>

      <div className="starfall-plate">
        <div className="starfall-kicker">
          <ElementGlyph type={hero.types[0]} />
          {STARFALL_NAME}
        </div>
        <h2 className="starfall-name" style={{ color: getTypeColor(hero.types[0]) }}>
          {hero.name}
        </h2>
        <div className="starfall-types">
          {hero.types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
        <div className="starfall-oath">falls into your Collection</div>
        <div className="starfall-actions">
          <button type="button" className="resolve-button is-secondary" disabled={!settled} onClick={() => setShowDossier(true)}>
            Info
          </button>
          <button type="button" className="resolve-button" disabled={!settled} onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      {!settled && <span className="starfall-skip">Tap to skip</span>}
      {/* Inside the portal, so the dossier stands over the scene rather than under it. */}
      {showDossier && <HeroDossierOverlay hero={hero} onClose={() => setShowDossier(false)} />}
    </div>,
    overlayHost()
  );
}

interface CardProps {
  /** Every hero a Starfall can still draw (run/starShop.ts starfallPool). */
  pool: readonly string[];
  enabled: boolean;
  onCall: () => void;
  onPeekHero: (heroId: string) => void;
}

/**
 * The Starfall on the Constellation's Heroes page: a strip of night over the price and the one
 * button, and — folded away until asked for — every hero it could still bring down.
 */
export function StarfallCard({ pool, enabled, onCall, onPeekHero }: CardProps) {
  const [open, setOpen] = useState(false);
  const empty = pool.length === 0;
  return (
    <section className="starfall-card">
      <div className="starfall-card-sky" aria-hidden="true">
        {SKY.slice(0, 26).map((star, i) => (
          <span key={i} className="starfall-sky-star" style={{ left: `${star.x}%`, top: `${star.y * 1.4}%`, '--r': star.r, animationDelay: `${star.delay}s` } as CSSProperties} />
        ))}
        <span className="starfall-card-streak" />
      </div>
      <div className="starfall-card-body">
        <div className="starfall-card-head">
          <span className="starfall-card-title">{STARFALL_NAME}</span>
          <span className="starfall-card-price">
            <HubGlyph name="star" />
            {STARFALL_PRICE}
          </span>
        </div>
        <p className="starfall-card-text">{empty ? 'Every hero is yours. The sky is quiet.' : 'Call a star down, and a hero you don’t own falls with it.'}</p>
        <button type="button" className="resolve-button starfall-card-call" disabled={!enabled} data-sfx={enabled ? 'ui.commit' : 'none'} onClick={onCall}>
          {empty ? 'Nothing left to fall' : 'Call a Star'}
        </button>
        {!empty && (
          <button type="button" className="starfall-card-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide who is left' : `Who is left · ${pool.length}`}
            <span className={`starfall-card-chevron${open ? ' is-open' : ''}`} aria-hidden="true">
              ▾
            </span>
          </button>
        )}
        {open && (
          <div className="starfall-card-pool">
            {pool.map((id) => {
              const hero = heroes[id];
              if (!hero) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className="starfall-card-face"
                  style={{ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
                  onClick={() => onPeekHero(id)}
                  aria-label={`${hero.name} — view details`}
                >
                  <HeroPortrait heroId={id} className="starfall-card-portrait" />
                  <span className="starfall-card-face-name">{hero.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
