import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import type { TypeId } from '../../engine/content';
import { getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { prefersReducedMotion } from '../shared/reducedMotion';
import type { RecruitOffer } from './RecruitNodeScreen';

const DEAL_AT = 600;
const DEAL_STEP = 150;
const FLIP_AT = 1300;
const PICK_MS = 1500;

type Phase = 'dealing' | 'idle' | 'picked';

interface Props {
  offers: readonly RecruitOffer[];
  /** A lesson: only this type can be picked. */
  onlyType?: TypeId;
  /** Whether anyone answers a pick of `type`. */
  canAnswer: (type: TypeId) => boolean;
  onPick: (type: TypeId) => void;
  /** The picked card has burst; whoever answered joins. */
  onLanded: (type: TypeId) => void;
}

/**
 * The Recruit's pick (docs/guild-hall-overhaul.md §2.1): one face-down card a type, dealt up and
 * flipped. Who answers stays hidden until the oath.
 */
export function RecruitDeal({ offers, onlyType, canAnswer, onPick, onLanded }: Props) {
  const [phase, setPhase] = useState<Phase>(() => (prefersReducedMotion() ? 'idle' : 'dealing'));
  const [chosen, setChosen] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  useEffect(() => {
    if (phase === 'dealing') {
      offers.forEach((_, i) => {
        later(DEAL_AT + i * DEAL_STEP, () => playSfx('ui.page'));
        later(FLIP_AT + i * DEAL_STEP, () => playSfx(i === offers.length - 1 ? 'star.land' : 'star.tick'));
      });
      later(FLIP_AT + offers.length * DEAL_STEP + 250, () => setPhase('idle'));
    }
    return () => timers.current.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(index: number) {
    const type = offers[index].type;
    if (phase !== 'idle' || (onlyType && onlyType !== type) || !canAnswer(type)) return;
    setChosen(index);
    setPhase('picked');
    onPick(type);
    if (prefersReducedMotion()) return later(300, () => onLanded(type));
    playSfx('star.charge');
    later(1100, () => playSfx('star.reveal'));
    later(PICK_MS, () => onLanded(type));
  }

  return (
    <div className={`recruit-deal is-${phase}`} style={{ '--count': offers.length } as CSSProperties}>
      <div className="recruit-deal-row">
        {offers.map((offer, i) => {
          const open = (!onlyType || onlyType === offer.type) && canAnswer(offer.type);
          return (
            <button
              key={offer.type}
              type="button"
              className={`recruit-card${chosen === i ? ' is-chosen' : ''}`}
              style={{ '--t': getTypeColorRgb(offer.type), '--i': i, '--from-mid': i - (offers.length - 1) / 2 } as CSSProperties}
              disabled={!open}
              aria-label={offer.type}
              onClick={() => pick(i)}
            >
              <span className="recruit-card-inner">
                <span className="recruit-card-back" aria-hidden="true" />
                <span className="recruit-card-face">
                  <span className="recruit-card-disc">
                    <ElementGlyph type={offer.type} className="recruit-card-glyph" />
                  </span>
                  <span className="recruit-card-name">{offer.type}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <span className="recruit-deal-flash" aria-hidden="true" />
    </div>
  );
}

/** The Recruit's head: a notice swung in on its tack. */
export function RecruitPoster({ text }: { text: string }) {
  return (
    <header className="recruit-poster-head">
      <span className="recruit-poster">
        <span className="recruit-poster-tack" aria-hidden="true" />
        <h2 className="recruit-poster-text">{text}</h2>
      </span>
    </header>
  );
}
