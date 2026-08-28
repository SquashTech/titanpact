import type { CSSProperties, ReactNode } from 'react';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import { rosterEntryTypes } from '../../run/progression';
import { getTypeAbbr, getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { ElementGlyph } from './elementIcons';
import { HeroPortrait } from './HeroPortrait';
import { useLongPress } from './MoveTile';

/**
 * The shared "pick a hero" card — one hero, drawn as a figure standing on
 * type-tinted ground, with a single line at the bottom saying what tapping it
 * buys.
 *
 * Generalised out of LevelUpScreen's `.growth-card` (docs/visual-language.md,
 * fourth pass) so the rest of the run loop stops using `.hero-grid`, whose
 * 30px portrait was the last surviving instance of the fractional-downscale
 * defect that doc opens with — 48px sources drawn at 0.625×. Here the
 * portrait is 48px (1×) in a three-column grid and 96px (2×) in a two-column
 * one, and the whole figure derives from that one number, so the two layouts
 * are the same composition at two scales rather than two hand-tuned ones.
 *
 * The card is boxed because it genuinely is a button. Everything inside it is
 * not: figure, ground, name, type codes, detail row and CTA line are all drawn
 * without a container of their own, and the hero's type is carried as the
 * card's own material — a wash entering top-left plus a rim tinted to match.
 *
 * Tap acts; hold opens whatever sheet the screen passes as `onPreview` — the
 * "hold to inspect" language moves and equipment use everywhere else. The `i`
 * button is the discoverable, no-hold alternative to the same sheet.
 */
interface HeroPickCardProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  /** The bottom line: what this tap buys ("+20 Max HP", "Equip", "Teach"). */
  cta: ReactNode;
  /** Extra class on the CTA line — screens colour it by payoff (see `.pick-cta.is-accent`). */
  ctaClassName?: string;
  /** An extra row between the type codes and the CTA (ForceEquipScreen's equip-slot box, LevelUpScreen's rank track). */
  detail?: ReactNode;
  /** Absolutely-positioned decoration painted under the card's content (LevelUpScreen's rising charge). */
  overlay?: ReactNode;
  /** Extra classes on the card itself — a screen's own states (`is-evolving`, `is-leveling`). */
  className?: string;
  /** Dims the card and drops its elevation; the tap is ignored. */
  disabled?: boolean;
  /** Gold rim, for the screens that select-then-confirm rather than acting on the tap. */
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

      {/* Type as chromeless coloured text, the `.move-type-code` idiom — the
          card's wash already carries the primary type, and two filled chips
          inside a type-washed button is the sub-box clutter the move grid was
          rebuilt to get rid of. */}
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

/**
 * The grid the cards sit in. Two columns up to four heroes, three at five or
 * six — not a cosmetic breakpoint: it is what keeps the portrait on a clean
 * multiple of its 48px source at either width. An early-run pair of heroes
 * gets figures worth looking at; a full roster gets a grid that fits without
 * scrolling.
 */
export function HeroPickGrid({
  count,
  fill,
  className,
  children,
}: {
  count: number;
  /** Take the space between the header and the CTA, scrolling internally rather than pushing the CTA off screen. */
  fill?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const columns: 2 | 3 = count > 4 ? 3 : 2;
  const classes = ['pick-grid', `pick-cols-${columns}`, fill ? 'is-filling' : '', className ?? ''].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}
