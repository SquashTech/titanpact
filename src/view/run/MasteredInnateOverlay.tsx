import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { currentInnateOf, innatePassiveOf, masteredInnateFor } from '../../run/innate';
import { curseOf } from '../../run/curse';
import { MASTERY_INNATE } from '../../run/mastery';
import type { RosterEntry } from '../../run/state';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { formIdFor } from '../../run/progression';
import { PassiveDetailCard } from '../shared/PassiveDossier';
import { PassiveGlyph } from '../shared/passiveIcons';
import { overlayHost } from '../shared/overlayHost';

interface Props {
  entry: RosterEntry;
  /** A curse's Turn (run/curse.ts): the innate the curse replaces, and the body that came with it. */
  turn?: boolean;
  onClose: () => void;
}

/**
 * The tenth Mastery pip's reveal (docs/mastery.md §5b; masteryFlow.ts): the hero's innate, as it
 * was, crossing out into what it is now. Nothing to decide — the upgrade is held from the moment
 * the pip landed — so this is one card, one button and the signature's crest in the pip's gold.
 * The born card is drawn small above the new one so the step reads as a step, not a swap.
 */
export function MasteredInnateOverlay({ entry, turn = false, onClose }: Props) {
  const hero = rosterHeroes[entry.heroId];
  const curse = turn ? curseOf(entry) : null;
  // Before the Turn the hero held its own innate, mastered or not; after it, the curse's.
  const before = curse ? currentInnateOf(hero, { mastery: entry.mastery }) : innatePassiveOf(hero);
  const after = curse ? currentInnateOf(hero, entry) : masteredInnateFor(hero, entry);

  useEffect(() => {
    playSfx('seal.strike');
    playSfx('blessing', { delay: 0.3 });
  }, []);

  if (!after) return null;
  const type = curse ? curse.types[0] : hero.types[0];
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
            {curse ? 'The Turn' : 'Innate Mastered'}
            <span className="signature-crest-star">✦</span>
          </span>
        </div>
        <div className="offer-hero-head">
          <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="offer-hero-portrait" />
          <h3>{hero.name}</h3>
        </div>
        <p className="offer-hero-eyebrow">
          {curse
            ? `Mastery ${curse.turnAt} — the curse takes hold: pure ${curse.types.join(' / ')}, a ${Object.values(curse.baseStats).reduce((a, b) => a + b, 0)} body`
            : `Mastery ${MASTERY_INNATE} — the innate, perfected`}
        </p>

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
