import type { CSSProperties, ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { ResourceGlyph } from '../shared/RunGlyph';
import { useArmedTap } from '../shared/useArmedTap';
import boardArt from '../../../art/guild/board.png';
import counterArt from '../../../art/guild/counter.png';
import signArt from '../../../art/guild/sign-board.png';
import hpArt from '../../../art/guild/good-hp.png';
import mpArt from '../../../art/guild/good-mp.png';
import reviveArt from '../../../art/guild/good-revive.png';
import contractArt from '../../../art/guild/good-contract.png';
import bellArt from '../../../art/guild/good-bell.png';
import stewArt from '../../../art/guild/good-stew.png';
import tankardArt from '../../../art/guild/good-tankard.png';
import swordArt from '../../../art/equipment/sword.png';
import anvilArt from '../../../art/smithy/anvil.png';
import { GemIcon } from '../shared/GemIcon';

// The Guild Hall as a room rather than a form (art/guild): the Tavern's recruits are posters on the
// notice board and its services and flasks sit on the bar, and the
// counters are signs hung from a beam. Every piece is 1x pixel art drawn at a clean multiple.

export const HALL_ART = { board: boardArt, counter: counterArt, sign: signArt };

export const GOOD_ART = {
  hp: hpArt,
  mp: mpArt,
  revive: reviveArt,
  contract: contractArt,
  reroll: bellArt,
  mend: stewArt,
} as const;

export const COUNTER_SIGN_ART: Record<'tavern' | 'gems' | 'gear' | 'smithy', string | ReactNode> = {
  tavern: tankardArt,
  gems: <GemIcon stat="attack" size={26} />,
  gear: swordArt,
  smithy: anvilArt,
};

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
  /** An image, or a drawn piece (a Gem). */
  art: string | ReactNode;
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
      {typeof art === 'string' ? <img src={art} className="hall-good-art" alt="" draggable={false} /> : <span className="hall-good-art is-drawn">{art}</span>}
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
            data-tab={tab.id}
            className={`hall-sign${isActive ? ' is-active' : ''}`}
            style={{ '--sign-art': `url(${HALL_ART.sign})` } as CSSProperties}
            onClick={() => {
              if (isActive) return;
              playSfx('ui.page');
              onSelect(tab.id);
            }}
          >
            {typeof COUNTER_SIGN_ART[tab.id] === 'string' ? (
              <img src={COUNTER_SIGN_ART[tab.id] as string} className="hall-sign-icon" alt="" draggable={false} />
            ) : (
              <span className="hall-sign-icon is-drawn">{COUNTER_SIGN_ART[tab.id]}</span>
            )}
            <span className="hall-sign-label">{tab.label}</span>
            {tab.count != null && tab.count > 0 && <span className="hall-sign-count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
