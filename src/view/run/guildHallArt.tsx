import type { CSSProperties, ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { ResourceGlyph } from '../shared/RunGlyph';
import { useArmedTap } from '../shared/useArmedTap';
import shelfArt from '../../../art/guild/shelf.png';
import boardArt from '../../../art/guild/board.png';
import counterArt from '../../../art/guild/counter.png';
import signArt from '../../../art/guild/sign-board.png';
import scrollArt from '../../../art/guild/good-scroll.png';
import hpArt from '../../../art/guild/good-hp.png';
import mpArt from '../../../art/guild/good-mp.png';
import reviveArt from '../../../art/guild/good-revive.png';
import contractArt from '../../../art/guild/good-contract.png';
import bellArt from '../../../art/guild/good-bell.png';
import stewArt from '../../../art/guild/good-stew.png';
import tankardArt from '../../../art/guild/good-tankard.png';
import sackArt from '../../../art/guild/good-sack.png';
import anvilArt from '../../../art/smithy/anvil.png';

// The Guild Hall as a room rather than a form (art/guild): the Shop's goods stand on a shelf, the
// Tavern's recruits are posters on the notice board and its services sit on the bar, and the
// counters are signs hung from a beam. Every piece is 1x pixel art drawn at a clean multiple.

export const HALL_ART = { shelf: shelfArt, board: boardArt, counter: counterArt, sign: signArt };

export const GOOD_ART = {
  scroll: scrollArt,
  hp: hpArt,
  mp: mpArt,
  revive: reviveArt,
  contract: contractArt,
  reroll: bellArt,
  mend: stewArt,
  sack: sackArt,
} as const;

export const COUNTER_SIGN_ART = { shop: sackArt, tavern: tankardArt, smithy: anvilArt } as const;

/**
 * A good on display: the thing itself, a parchment tag under it naming it and its price (or why it
 * cannot be had), and what is already held in its corner. The whole piece is the button.
 */
export function HallGood({
  art,
  name,
  price,
  soldOut,
  held,
  disabled,
  className,
  style,
  confirm,
  onClick,
}: {
  art: string;
  name: string;
  /** A number is gold; a string is the reason there is nothing to buy ("Flask full"). */
  price: number | string;
  soldOut?: boolean;
  held?: ReactNode;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Tap to arm, tap again to buy (useArmedTap) — for a purchase that happens on the tap itself. */
  confirm?: boolean;
  onClick: () => void;
}) {
  const tap = useArmedTap(onClick, !!confirm && !disabled);
  return (
    <button
      ref={tap.ref}
      className={`hall-good${soldOut ? ' is-sold-out' : ''}${tap.armed ? ' is-armed' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      disabled={disabled}
      onClick={tap.onClick}
    >
      <img src={art} className="hall-good-art" alt="" draggable={false} />
      <span className="hall-tag">
        <span className="hall-tag-name">{name}</span>
        {tap.armed ? (
          <span className="hall-tag-price is-confirm">Tap to buy</span>
        ) : typeof price === 'number' ? (
          <span className="hall-tag-price">
            <ResourceGlyph kind="gold" /> {price}
          </span>
        ) : (
          <span className="hall-tag-price is-note">{price}</span>
        )}
      </span>
      {held !== undefined && held !== null && <span className="hall-good-held">{held}</span>}
    </button>
  );
}

/** The three counters as signs hung from a beam; the one you stand at is lit. */
export function HallSigns<Id extends keyof typeof COUNTER_SIGN_ART>({
  tabs,
  active,
  onSelect,
}: {
  tabs: readonly { id: Id; label: string; count?: number }[];
  active: Id;
  onSelect: (id: Id) => void;
}) {
  return (
    <div className="hall-signs" role="tablist">
      <span className="hall-signs-beam" aria-hidden="true" />
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`hall-sign${isActive ? ' is-active' : ''}`}
            style={{ '--sign-art': `url(${HALL_ART.sign})` } as CSSProperties}
            onClick={() => {
              if (isActive) return;
              playSfx('ui.page');
              onSelect(tab.id);
            }}
          >
            <img src={COUNTER_SIGN_ART[tab.id]} className="hall-sign-icon" alt="" draggable={false} />
            <span className="hall-sign-label">{tab.label}</span>
            {tab.count != null && tab.count > 0 && <span className="hall-sign-count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
