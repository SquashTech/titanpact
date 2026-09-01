import type { CSSProperties, ReactNode } from 'react';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import { rosterEntryTypes } from '../../run/progression';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from './elementIcons';
import { HeroPortrait } from './HeroPortrait';
import { useLongPress } from './MoveTile';

// The shared "pick a hero" card: figure on type-tinted ground, one CTA line. Tap acts; hold (or
// the `i` button) opens `onPreview`. Portrait is 48px in a 3-column grid, 96px in a 2-column one.
interface HeroPickCardProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  /** The bottom line: what this tap buys ("+20 Max HP", "Equip", "Teach"). */
  cta: ReactNode;
  ctaClassName?: string;
  /** Extra row between the type codes and the CTA. */
  detail?: ReactNode;
  /** Absolutely-positioned decoration painted under the card's content. */
  overlay?: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Gold rim, for screens that select-then-confirm. */
  selected?: boolean;
  onActivate?: () => void;
  onPreview?: () => void;
  ariaLabel?: string;
}

export function HeroPickCard({
  hero,
  entry,
  cta,
  ctaClassName,
  detail,
  overlay,
  className,
  disabled,
  selected,
  onActivate,
  onPreview,
  ariaLabel,
}: HeroPickCardProps) {
  const longPress = useLongPress(onPreview, disabled ? undefined : onActivate);
  return (
    <div
      className={['pick-card', disabled ? 'is-locked' : '', selected ? 'is-selected' : '', className ?? ''].filter(Boolean).join(' ')}
      style={{ '--type-rgb': getTypeColorRgb(hero.types[0]) } as CSSProperties}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={ariaLabel ?? `${hero.name}, level ${entry.level}`}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          onActivate?.();
        }
      }}
      {...longPress}
    >
      {onPreview && (
        <button
          type="button"
          className="pick-info"
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          aria-label={`View ${hero.name} details`}
        >
          i
        </button>
      )}

      {overlay}

      <div className="pick-figure">
        <span className="pick-ground" aria-hidden="true" />
        <HeroPortrait heroId={hero.id} className="pick-portrait" />
        <span className="pick-level" aria-hidden="true">
          {entry.level}
        </span>
      </div>

      <span className="pick-name">{hero.name}</span>

      <span className="pick-types">
        {rosterEntryTypes(hero, entry).map((t) => (
          <span key={t} className="pick-type-code" style={{ color: getTypeColor(t) }} title={t}>
            <ElementGlyph type={t} />
            {getTypeAbbr(t)}
          </span>
        ))}
      </span>

      {detail}

      <span className={`pick-cta${ctaClassName ? ` ${ctaClassName}` : ''}`}>{cta}</span>
    </div>
  );
}

/** Two columns up to four heroes, three past that — keeps the portrait on an integer multiple of its 48px source. */
export function HeroPickGrid({
  count,
  fill,
  className,
  children,
}: {
  count: number;
  /** Fill the space between header and CTA, scrolling internally. */
  fill?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const columns: 2 | 3 = count > 4 ? 3 : 2;
  const classes = ['pick-grid', `pick-cols-${columns}`, fill ? 'is-filling' : '', className ?? ''].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}
