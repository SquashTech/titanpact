import type { Ref } from 'react';
import type { ConsumableKind } from '../../run/consumables';
import { ResourceGlyph } from './RunGlyph';

interface Props {
  /** The flask leaving the piece pays. */
  flask: ConsumableKind;
  /** How many of that flask the purse holds now. */
  held: number;
  /** The purse can hold no more of it: the piece is left for nothing. */
  full: boolean;
  armed: boolean;
  buttonRef: Ref<HTMLButtonElement>;
  onClick: () => void;
  className?: string;
}

function Flask({ kind, n }: { kind: ConsumableKind; n: number }) {
  return (
    <span className="sell-press-gold">
      <ResourceGlyph kind={kind} className="sell-press-glyph" />
      {n}
    </span>
  );
}

/** The one decline on a gear screen: the piece left behind, and the flask taken in its place. */
export function LeavePress({ flask, held, full, armed, buttonRef, onClick, className }: Props) {
  return (
    <button ref={buttonRef} className={`sell-press${armed ? ' is-armed' : ''}${className ? ` ${className}` : ''}`} onClick={onClick}>
      <span className="sell-press-verb">{armed ? 'Tap again to leave it' : 'Leave it'}</span>
      {full ? (
        <span className="sell-press-purse">
          <Flask kind={flask} n={held} />
        </span>
      ) : (
        <span className="sell-press-purse" aria-label={`${held} to ${held + 1}`}>
          <span className="sell-press-before">
            <Flask kind={flask} n={held} />
          </span>
          <span className="sell-press-arrow" aria-hidden="true">
            →
          </span>
          <span className="sell-press-after">
            <Flask kind={flask} n={held + 1} />
          </span>
        </span>
      )}
    </button>
  );
}
