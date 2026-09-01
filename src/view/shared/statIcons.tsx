import type { CSSProperties, ReactNode } from 'react';
import type { StatKey } from '../../engine/content';

// The eight stat glyphs as inline vector art: 24x24 grid, `currentColor` only, nothing finer than
// ~2 units. Drawn as rhyming pairs — Attack/Defense are forged metal, Intelligence/Wisdom the same
// jobs as energy, Mana Pool/MP Regen one droplet with and without a rising chevron.

/** One color per stat, shared everywhere a stat is drawn (bar fill, glyph, chip). */
export const STAT_COLORS: Record<StatKey, string> = {
  hp: '#4caf6a',
  attack: '#d9534f',
  defense: '#8a94a8',
  intelligence: '#c356d0',
  wisdom: '#7fd6e0',
  speed: '#e8d16a',
  manaPool: '#4a90d9',
  mpRegen: '#4cd9a0',
};

export const STAT_PATHS: Record<StatKey, ReactNode> = {
  hp: <path d="M12 21.6 3.7 13.1a5.3 5.3 0 0 1 7.5-7.5l.8.8.8-.8a5.3 5.3 0 0 1 7.5 7.5Z" />,
  // Sword on the diagonal — the direction that fills a square box.
  attack: (
    <g transform="rotate(45 12 12)">
      <path d="M12 1.4 14.5 6v8.4h-5V6Z" />
      <path d="M5.6 15.6h12.8v2.3H5.6Z" />
      <path d="M10.6 19.1h2.8v2.2h-2.8Z" />
      <circle cx="12" cy="22" r="1.5" />
    </g>
  ),
  // Heater shield.
  defense: <path d="M12 1.8 21 5v6.6c0 5.4-3.7 9.2-9 10.8-5.3-1.6-9-5.4-9-10.8V5Z" />,
  // Four-point spark.
  intelligence: (
    <path d="M12 1c.8 6.6 4.4 10.2 11 11-6.6.8-10.2 4.4-11 11-.8-6.6-4.4-10.2-11-11 6.6-.8 10.2-4.4 11-11Z" />
  ),
  // Ward: an arc over the thing it protects. Not a second shield — at 11px they'd be the same picture.
  wisdom: (
    <>
      <path fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" d="M3 18.6a9 9 0 0 1 18 0" />
      <circle cx="12" cy="16.4" r="2.6" />
    </>
  ),
  speed: (
    <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.8 5 10.8 12l-7 7" />
      <path d="M13.2 5l7 7-7 7" />
    </g>
  ),
  manaPool: <path d="M12 1.6c4.8 5.7 7.3 9.6 7.3 12.7a7.3 7.3 0 0 1-14.6 0c0-3.1 2.5-7 7.3-12.7Z" />,
  // Droplet with one rising chevron knocked out (evenodd); two chevrons read as a pine tree.
  mpRegen: (
    <path
      fillRule="evenodd"
      d="M12 1.6c4.8 5.7 7.3 9.6 7.3 12.7a7.3 7.3 0 0 1-14.6 0c0-3.1 2.5-7 7.3-12.7ZM12 11.4 7.8 15.6l1.6 1.6L12 14.6l2.6 2.6 1.6-1.6Z"
    />
  ),
};

// `.stat-glyph` is the layout hook styles.css sizes against; every glyph here must land in it.
function GlyphSvg({ paths, className, style }: { paths: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={`stat-glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {paths}
    </svg>
  );
}

interface StatGlyphProps {
  stat: StatKey;
  /** `'stat'` draws in the stat's own color; `'inherit'` takes the surrounding text color (a buff/debuff chip is colored by sign). */
  tone?: 'stat' | 'inherit';
  className?: string;
}

/** The one place a stat glyph is drawn. `aria-hidden`: it always sits beside its own STAT_LABELS text. */
export function StatGlyph({ stat, tone = 'stat', className }: StatGlyphProps) {
  return (
    <GlyphSvg
      paths={STAT_PATHS[stat]}
      className={className}
      style={tone === 'stat' ? ({ color: STAT_COLORS[stat] } as CSSProperties) : undefined}
    />
  );
}

/** `moveKindGlyph` (MoveTile.tsx) is the one place a MoveDefinition is mapped onto this. */
export type MoveKindGlyphKind = 'physical' | 'magical' | 'heal' | 'buff' | 'debuff';

// Move kinds borrow the stat glyphs: physical/magical wear the stat each pipeline reads (two-pipeline
// separation), heal wears HP, buff the shield. Colour comes from the badge class, never STAT_COLORS.
const MOVE_KIND_STAT: Record<Exclude<MoveKindGlyphKind, 'debuff'>, StatKey> = {
  physical: 'attack',
  magical: 'intelligence',
  heal: 'hp',
  buff: 'defense',
};

// The Defense shield split down a jagged line, halves pulled 3 units apart. A gap in the silhouette,
// not a hairline crack — a crack is under a pixel at 15px. Geometry copied from STAT_PATHS.defense;
// redraw both together.
const BROKEN_SHIELD = (
  <>
    <path d="M10.6 1.8 2.5 5v6.6C2.5 17 5.8 20.8 10.6 22.4L9.2 16.6 11.7 11.6 8.6 7Z" />
    <path d="M13.4 1.8 11.4 7 14.5 11.6 12 16.6 13.4 22.4C18.2 20.8 21.5 17 21.5 11.6V5Z" />
  </>
);

export function MoveKindGlyph({ kind, className }: { kind: MoveKindGlyphKind; className?: string }) {
  if (kind === 'debuff') return <GlyphSvg paths={BROKEN_SHIELD} className={className} />;
  return <StatGlyph stat={MOVE_KIND_STAT[kind]} tone="inherit" className={className} />;
}
