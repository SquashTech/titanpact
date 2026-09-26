import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { innatePassiveOf, masteredInnateOf } from '../../run/innate';
import { MASTERY_INNATE } from '../../run/mastery';
import type { RosterEntry } from '../../run/state';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { PassiveDetailCard } from '../shared/PassiveDossier';
import { PassiveGlyph } from '../shared/passiveIcons';
import { overlayHost } from '../shared/overlayHost';

interface Props {
  entry: RosterEntry;
  onClose: () => void;
}

/**
 * The tenth Mastery pip's reveal (docs/mastery.md §5b; masteryFlow.ts): the hero's innate, as it
 * was, crossing out into what it is now. Nothing to decide — the upgrade is held from the moment
 * the pip landed — so this is one card, one button and the signature's crest in the pip's gold.
 * The born card is drawn small above the new one so the step reads as a step, not a swap.
 */
export function MasteredInnateOverlay({ entry, onClose }: Props) {
  const hero = rosterHeroes[entry.heroId];
  const before = innatePassiveOf(hero);
  const after = masteredInnateOf(hero);

  useEffect(() => {
    playSfx('seal.strike');
    playSfx('blessing', { delay: 0.3 });
  }, []);

  if (!after) return null;
  const type = hero.types[0];
  return createPortal(
    <div
      className="log-overlay moveoffer-overlay is-signature is-mastered"
      style={{ '--sig-color': getTypeColor(type), '--sig-rgb': getTypeColorRgb(type) } as CSSProperties}
    >
      <div className="reward-panel moveoffer-panel is-learned is-signature is-mastered">
        <div className="signature-crest" aria-hidden="true">
          <span className="signature-crest-flash" />
          <span className="signature-crest-rays" />
          <span className="signature-crest-title">
            <span className="signature-crest-star">✦</span>
            Innate Mastered
            <span className="signature-crest-star">✦</span>
          </span>
        </div>
        <div className="offer-hero-head">
          <HeroPortrait heroId={hero.id} className="offer-hero-portrait" />
          <h3>{hero.name}</h3>
        </div>
        <p className="offer-hero-eyebrow">Mastery {MASTERY_INNATE} — the innate, perfected</p>

        {before && (
          <div className="mastered-from">
            <span className="mastered-from-glyph">
              <PassiveGlyph passiveId={before.id} />
            </span>
            <span className="mastered-from-body">
              <span className="mastered-from-name">{before.name}</span>
              <span className="mastered-from-desc">{before.description}</span>
            </span>
          </div>
        )}
        <div className="mastered-arrow" aria-hidden="true">
          ▼ becomes
        </div>

        <div className="signature-frame">
          <span className="signature-frame-sheen" aria-hidden="true" />
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="signature-mote" style={{ '--mote': i } as CSSProperties} aria-hidden="true" />
          ))}
          <div className="offer-move-highlight is-signature">
            <PassiveDetailCard passive={after} />
          </div>
        </div>

        <div className="reward-panel-actions moveoffer-actions">
          <button className="moveoffer-button moveoffer-confirm" onClick={onClose}>
            <span className="moveoffer-icon" aria-hidden="true">
              ✓
            </span>
            <span className="moveoffer-label">Continue</span>
            <span className="moveoffer-sub">{after.name} held</span>
          </button>
        </div>
      </div>
    </div>,
    overlayHost()
  );
}
