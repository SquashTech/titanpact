import type { CSSProperties } from 'react';
import type { PotionKind } from '../../engine/combat/consumables';
import { CONSUMABLE_BLURBS, CONSUMABLE_KINDS, CONSUMABLE_NAMES } from '../../run/consumables';

const LIQUID: Record<PotionKind, { rgb: string; deep: string }> = {
  hpPotion: { rgb: '255, 106, 106', deep: '#a3222e' },
  mpPotion: { rgb: '108, 160, 255', deep: '#2340a3' },
};

/** A stoppered round flask, its liquid in the gauge colour it refills. */
export function PotionFlask({ kind, className }: { kind: PotionKind; className?: string }) {
  const { rgb, deep } = LIQUID[kind];
  const id = `flask-${kind}`;
  return (
    <svg className={className} viewBox="0 0 48 60" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-liquid`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor={`rgb(${rgb})`} stopOpacity="1" />
          <stop offset="1" stopColor={deep} />
        </radialGradient>
        <clipPath id={`${id}-body`}>
          <circle cx="24" cy="35.8" r="18" />
        </clipPath>
      </defs>
      <rect x="18" y="2" width="12" height="9" rx="2.5" fill="#8a5a34" />
      <rect x="18" y="2" width="12" height="3" rx="1.5" fill="#b07a4c" />
      <path d="M19 10h10v8.5a18 18 0 1 1-10 0Z" fill="rgba(200, 225, 255, 0.16)" />
      <g clipPath={`url(#${id}-body)`}>
        <path d="M2 32q6-3 11 0t11 0 11 0 11 0V60H2Z" fill={`url(#${id}-liquid)`} />
        <path d="M2 32q6-3 11 0t11 0 11 0 11 0" fill="none" stroke={`rgb(${rgb})`} strokeWidth="1.4" opacity="0.9" />
        <circle cx="17" cy="45" r="1.6" fill="#fff" opacity="0.5" />
        <circle cx="29" cy="49" r="1.1" fill="#fff" opacity="0.4" />
      </g>
      <path d="M19 10h10v8.5a18 18 0 1 1-10 0Z" fill="none" stroke="rgba(230, 240, 255, 0.75)" strokeWidth="1.6" />
      <path d="M12.5 31a13 13 0 0 1 7-8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/**
 * The Bag, opened in the move area: looked down into, the potions standing in its mouth. Picking
 * one hands off to the console's target row; presentation only, the drink is FightScreen's.
 */
export function BagPouch({ purse, onPick }: { purse: Record<PotionKind, number>; onPick: (kind: PotionKind) => void }) {
  return (
    <div className="bag-pouch">
      <span className="bag-pouch-mouth" aria-hidden="true" />
      <span className="bag-pouch-lip" aria-hidden="true" />
      {CONSUMABLE_KINDS.map((kind, i) => {
        const empty = purse[kind] <= 0;
        return (
          <button
            key={kind}
            type="button"
            className={`bag-potion is-${kind}${empty ? ' is-empty' : ''}`}
            style={{ '--potion-rgb': LIQUID[kind].rgb, '--rise-delay': `${0.05 + i * 0.07}s` } as CSSProperties}
            aria-disabled={empty}
            onClick={() => {
              if (!empty) onPick(kind);
            }}
          >
            <span className="bag-potion-glow" aria-hidden="true" />
            <PotionFlask kind={kind} className="bag-potion-flask" />
            <span className="bag-potion-label">
              <span className="bag-potion-name">
                {CONSUMABLE_NAMES[kind]}
                <span className="bag-potion-count">×{purse[kind]}</span>
              </span>
              <span className="bag-potion-blurb">{CONSUMABLE_BLURBS[kind]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
