import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import type { TypeId } from '../../engine/content';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import { prefersReducedMotion } from '../shared/reducedMotion';
import type { RecruitOffer } from './RecruitNodeScreen';

const TURN_MS = 900;
const DRAW_MS = 650;
const SPIN_MS = 2600;
const HOLD_MS = 700;
const FACE_RADIUS = 146;

type Phase = 'idle' | 'turning' | 'drawing' | 'spinning' | 'landed';

interface Props {
  offers: readonly RecruitOffer[];
  /** A lesson: only this type can be picked. */
  onlyType?: TypeId;
  /** Who answers a pick of `type`; decided before the spin, which only shows it. */
  winnerOf: (type: TypeId) => string | null;
  onPick: (type: TypeId) => void;
  onLanded: (type: TypeId) => void;
}

/**
 * The Recruit's pick (docs/guild-hall-overhaul.md §2.1): the oath's sigil ring split into the types
 * on offer, the heroes who could answer each circling outside it. The picked arc turns to the top,
 * its heroes are drawn into the centre and spin, and the spin slows on the one who answered.
 */
export function RecruitWheel({ offers, onlyType, winnerOf, onPick, onLanded }: Props) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const orbitRefs = useRef<(HTMLElement | null)[]>([]);
  const timers = useRef<number[]>([]);
  const frame = useRef(0);

  useEffect(
    () => () => {
      timers.current.forEach(window.clearTimeout);
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  const span = 360 / offers.length;
  const rotation = chosen === null ? 0 : shortest(-chosen * span);
  const chosenOffer = chosen === null ? null : offers[chosen];
  const winnerId = chosenOffer ? winnerOf(chosenOffer.type) : null;
  const orbitIds = chosenOffer ? (winnerId && !chosenOffer.heroIds.includes(winnerId) ? [...chosenOffer.heroIds, winnerId] : chosenOffer.heroIds) : [];

  function later(ms: number, fn: () => void) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  function pick(index: number) {
    const offer = offers[index];
    if (phase !== 'idle' || (onlyType && onlyType !== offer.type) || !winnerOf(offer.type)) return;
    setChosen(index);
    onPick(offer.type);
    if (prefersReducedMotion()) {
      setPhase('landed');
      later(HOLD_MS, () => onLanded(offers[index].type));
      return;
    }
    playSfx('star.charge');
    setPhase('turning');
    later(TURN_MS, () => setPhase('drawing'));
    later(TURN_MS + DRAW_MS, () => setPhase('spinning'));
  }

  // The spin: every candidate on one circle, easing out so the winner comes to rest at the top.
  useEffect(() => {
    if (phase !== 'spinning' || !chosenOffer) return;
    const count = orbitIds.length;
    const winner = Math.max(0, orbitIds.indexOf(winnerId ?? ''));
    const step = (Math.PI * 2) / count;
    const target = Math.PI * 2 * 4 - winner * step;
    const radius = count > 1 ? 58 : 0;
    const start = performance.now();
    let lastTick = -1;
    const tick = (now: number) => {
      const k = Math.min((now - start) / SPIN_MS, 1);
      const angle = (1 - Math.pow(1 - k, 3)) * target;
      orbitRefs.current.forEach((el, i) => {
        if (!el) return;
        const a = angle + i * step;
        el.style.transform = `translate(${Math.sin(a) * radius}px, ${-Math.cos(a) * radius}px)`;
      });
      const passed = Math.floor(angle / step);
      if (passed !== lastTick) {
        lastTick = passed;
        if (k < 1) playSfx('star.tick');
      }
      if (k < 1) frame.current = requestAnimationFrame(tick);
      else {
        playSfx('star.land');
        setPhase('landed');
        later(30, () => {
          const el = orbitRefs.current[winner];
          if (el) el.style.transform = 'translate(0, 0)';
        });
        later(HOLD_MS, () => onLanded(chosenOffer.type));
      }
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const disc = offers
    .map((o, i) => `rgba(${getTypeColorRgb(o.type)}, 0.55) ${i * span + 1}deg ${(i + 1) * span - 1}deg, transparent ${(i + 1) * span - 1}deg ${(i + 1) * span + 1}deg`)
    .join(', ');

  return (
    <div
      className={`recruit-wheel is-${phase}`}
      style={{ '--wheel-rot': `${rotation}deg`, '--oath-rgb': chosenOffer ? getTypeColorRgb(chosenOffer.type) : '155, 201, 255' } as CSSProperties}
    >
      <span className="recruit-wheel-beam" aria-hidden="true" />
      <div className="recruit-wheel-hub">
        <span className="recruit-wheel-ring" aria-hidden="true" />
        <div className="recruit-wheel-turn">
          <span className="recruit-wheel-disc" style={{ background: `conic-gradient(from ${-span / 2}deg, ${disc})` }} aria-hidden="true" />
          {offers.map((offer, i) => {
            const open = (!onlyType || onlyType === offer.type) && offer.heroIds.length > 0;
            const angle = i * span;
            const faceStep = Math.min(24, (span * 0.7) / Math.max(offer.heroIds.length, 1));
            return (
              <div
                key={offer.type}
                className={`recruit-wheel-seg${chosen === i ? ' is-chosen' : ''}`}
                style={{ '--type-color': getTypeColor(offer.type), '--type-rgb': getTypeColorRgb(offer.type) } as CSSProperties}
              >
                <button
                  type="button"
                  className="recruit-type recruit-wheel-type"
                  style={place(angle, 86)}
                  disabled={!open || phase !== 'idle'}
                  aria-label={`${offer.type}: ${offer.heroIds.map((id) => rosterHeroes[id]?.name).join(', ')}`}
                  onClick={() => pick(i)}
                >
                  <span className="recruit-wheel-upright">
                    <ElementGlyph type={offer.type} className="recruit-wheel-glyph" />
                    <span className="recruit-wheel-name">{offer.type}</span>
                  </span>
                </button>
                {offer.heroIds.map((id, f) => {
                  const offset = (f - (offer.heroIds.length - 1) / 2) * faceStep;
                  return (
                    <span key={id} className="recruit-wheel-face" style={place(angle + offset, FACE_RADIUS)} onClick={() => pick(i)} aria-hidden="true">
                      <span className="recruit-wheel-upright">
                        <HeroPortrait heroId={id} className="recruit-wheel-face-art" />
                      </span>
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
        {(phase === 'spinning' || phase === 'landed') && (
          <div className="recruit-wheel-orbit" aria-hidden="true">
            {orbitIds.map((id, i) => (
              <span
                key={id}
                ref={(el) => {
                  orbitRefs.current[i] = el;
                }}
                className={`recruit-wheel-orbiter${id === winnerId ? ' is-winner' : ''}`}
              >
                <HeroPortrait heroId={id} className="recruit-wheel-orbiter-art" />
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Stands an element on the wheel's circle at `angle` (0 is the top), turned back upright. */
function place(angle: number, radius: number): CSSProperties {
  return { '--at': `${angle}deg`, '--radius': `${radius}px` } as CSSProperties;
}

/** The shortest turn that brings an arc to the top. */
function shortest(deg: number): number {
  const d = ((deg % 360) + 540) % 360 - 180;
  return d;
}
