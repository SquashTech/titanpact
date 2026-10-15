import type { ReactNode, Ref } from 'react';
import { ResourceGlyph } from './RunGlyph';

interface Props {
  /** What the sale pays; undefined while there is nothing to sell. */
  gold?: number;
  purse: number;
  armed: boolean;
  buttonRef: Ref<HTMLButtonElement>;
  onClick: () => void;
  /** The verb while there is nothing to sell. */
  emptyLabel?: string;
  className?: string;
}

function Gold({ n }: { n: number }) {
  return (
    <span className="sell-press-gold">
      <ResourceGlyph kind="gold" tone="inherit" className="sell-press-glyph" />
      {n}
    </span>
  );
}

/** The one decline on a gear screen, struck in gold: the purse as it stands, and as the sale leaves it. */
export function SellPress({ gold, purse, armed, buttonRef, onClick, emptyLabel = 'Sell', className }: Props) {
  const empty = gold === undefined;
  let verb: ReactNode = 'Sell';
  if (empty) verb = emptyLabel;
  else if (armed) verb = 'Tap again to sell';
  return (
    <button
      ref={buttonRef}
      className={`sell-press${armed ? ' is-armed' : ''}${className ? ` ${className}` : ''}`}
      disabled={empty}
      onClick={onClick}
    >
      <span className="sell-press-verb">{verb}</span>
      {!empty && (
        <span className="sell-press-purse" aria-label={`Gold ${purse} to ${purse + gold}`}>
          <span className="sell-press-before">
            <Gold n={purse} />
          </span>
          <span className="sell-press-arrow" aria-hidden="true">
            →
          </span>
          <span className="sell-press-after">
            <Gold n={purse + gold} />
          </span>
        </span>
      )}
    </button>
  );
}
