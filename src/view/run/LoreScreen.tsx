import { useState } from 'react';
import { playSfx } from '../../audio/sfx';
import type { OpeningCard } from '../../data/opening';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { OpeningPictureFrame } from './OpeningCards';
import './openingCards.css';

interface Props {
  title: string;
  cards: readonly OpeningCard[];
  onDone: () => void;
}

/**
 * A later Cycle's lore cards (docs/cycles.md §7), ahead of its first draft on an account: the
 * opening's storybook pages, a picture and a line each, turned a tap at a time.
 */
export function LoreScreen({ title, cards, onDone }: Props) {
  const [at, setAt] = useState(0);
  const last = cards.length - 1;

  function advance() {
    if (at >= last) {
      playSfx('ui.confirm');
      onDone();
      return;
    }
    playSfx('ui.page', { gain: 0.7 });
    setAt(at + 1);
  }

  return (
    <div className={`opening-cards lore-cards${prefersReducedMotion() ? ' is-still' : ''}`} onClick={advance} role="dialog" aria-live="polite">
      <div className="lore-cards-title">{title}</div>
      {cards.map((card, i) => (
        <div
          key={i}
          className={`opening-card is-${card.picture}${i === at ? ' is-on' : ''}${i < at ? ' is-past' : ''}`}
          style={{ ['--card-ms' as string]: '8000ms' }}
          aria-hidden={i !== at}
        >
          <OpeningPictureFrame picture={card.picture} />
          <p className="opening-card-line">{card.line}</p>
        </div>
      ))}
      <span className="lore-cards-tap">Tap to continue</span>
    </div>
  );
}
