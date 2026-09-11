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
  columns: forced,
  className,
  children,
}: {
  count: number;
  /** Fill the space between header and CTA, scrolling internally. */
  fill?: boolean;
  /**
   * Override the column count. For a screen that passes `fill` but does not actually own the whole
   * stage — the Event node, which prints the move on offer above the roster and leaves the grid
   * about half the height the Crucible gives it. Two columns there squash the card past what its
   * content needs and `overflow: hidden` eats the name, the types and the CTA without a trace.
   */
  columns?: 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  /*
   * `fill` decides the columns, not the count alone.
   *
   * It was `count > 4 ? 3 : 2`, so a six-hero roster always went to three — and on the screens
   * where this grid OWNS the stage that put six 118x124 cards, portraits at 48px, in the middle of
   * a 570-660px box with ~150-200px of nothing above and below them (measured on the Crucible, the
   * Forge and the Tutor). The screen's whole question is "which hero", and it was asking it in
   * thumbnails with most of the frame empty.
   *
   * Two columns at six heroes is three rows of ~190px, which fills those boxes almost exactly and
   * buys the 96px portrait the card was already built for. A grid WITHOUT `fill` is embedded in a
   * panel (the roster peek, the run summary) where the room is genuinely tight, so it keeps the
   * old threshold.
   */
  const columns: 2 | 3 = forced ?? (count > (fill ? 6 : 4) ? 3 : 2);
  const classes = ['pick-grid', `pick-cols-${columns}`, fill ? 'is-filling' : '', className ?? ''].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}
