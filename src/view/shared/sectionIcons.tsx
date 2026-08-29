import type { ReactNode } from 'react';

/**
 * The seven section-header glyphs on the hero sheets (HeroDetailOverlay,
 * HeroPreviewOverlay, CompendiumScreen).
 *
 * These were the last emoji left on those screens, and once the stat blocks
 * below them became vector the seam was obvious: a platform-drawn picture
 * sitting four pixels above eight authored ones. Same conventions as
 * statIcons.tsx — 24x24 grid, one idea per glyph, `currentColor` throughout,
 * nothing finer than ~2 units — so this is a third family in one vocabulary,
 * not a second vocabulary.
 *
 * Kept out of statIcons.tsx because these are not stats and do not want that
 * file's per-stat color map: a section header is always its panel's gold
 * (`--accent`), and inheriting is the whole behaviour.
 *
 * Three of the seven depict what sits underneath them rather than symbolising
 * it — the Stats bars ARE the bar block, the Buffs arrows ARE the ▲/▼ the
 * chips carry, the Equipment chest holds the three slots. That is the cheapest
 * way for a header to be legible without having to be taught.
 */

/**
 * One sword for the crossed pair below, standing point-up so the caller owns
 * the angle. Deliberately NOT the Attack stat glyph from statIcons.tsx, which
 * was tried first and does not survive being doubled: that sword is drawn
 * thick and fully dressed so it reads ALONE at 11px, and two of them crossed
 * put both blades into one blob at the centre and both hilts into one bar at
 * the bottom — the pair rendered as a moth. This one is slimmer, tapers to a
 * point, carries a short guard and a pommel and no grip, and is pivoted high
 * on the blade so the two hilts swing out to opposite bottom corners. Both are
 * swords; only one of them is a sword you can cross.
 */
const SWORD_SLIM = (
  <>
    <path d="M12 2.2 14.1 14.2h-4.2Z" />
    <path d="M9.2 14.2h5.6v2H9.2Z" />
    <circle cx="12" cy="18" r="1.6" />
  </>
);

export const SECTION_PATHS = {
  /** Ascending bar chart — the same vertical-bar idiom the draft screen's stat silhouette uses, and a direct picture of the StatBars block below. */
  stats: (
    <>
      <rect x="2.6" y="13.2" width="5" height="8.2" rx="1.2" />
      <rect x="9.5" y="8.4" width="5" height="13" rx="1.2" />
      <rect x="16.4" y="3.6" width="5" height="17.8" rx="1.2" />
    </>
  ),
  /** One arrow up, one down — the ▲/▼ this section's chips carry, said once. Covers buffs and debuffs without picking a side, which a single arrow could not. */
  buffs: (
    <>
      <path d="M6.8 2.8 12 9.6H9.2v11.6H4.4V9.6H1.6Z" />
      <path d="M17.2 21.2 12 14.4h2.8V2.8h4.8v11.6H22.4Z" />
    </>
  ),
  /**
   * Flask. The RPG shorthand for "an effect is on you", and unlike the bandage
   * it replaces it covers the good ones (Renew) as readily as the bad. Sits a
   * unit higher than its own geometry wants: it is the tallest shape in the
   * set, and at 2.6 it bottomed out at y≈23 while the other five land near
   * 21.5, which reads as one header's mark hanging low rather than as a taller
   * icon.
   */
  statuses: (
    <>
      <rect x="8.9" y="1.6" width="6.2" height="2.1" rx="0.9" />
      <path d="M10.3 3.7h3.4v5.6l5.5 8.5a2.7 2.7 0 0 1-2.3 4.2H7.1a2.7 2.7 0 0 1-2.3-4.2l5.5-8.5Z" />
    </>
  ),
  /**
   * A shield with a lightning bolt punched clean through it — the two halves
   * of the Matchups block said in one shape: something is getting through, and
   * something is holding. Drawn as a single evenodd path so the bolt is a hole
   * in the shield rather than a second mass sitting on top of it; a filled bolt
   * on a filled shield is one blob at 16px.
   */
  matchups: (
    <path
      fillRule="evenodd"
      d="M12 1.8 20.6 4.9v7.2c0 4.9-3.5 8.4-8.6 10.1-5.1-1.7-8.6-5.2-8.6-10.1V4.9ZM12.9 6.4 8.6 12.9h2.6l-0.8 5 4.3-6.6h-2.6Z"
    />
  ),
  /** Five-point star. Convex and asymmetric where the Intelligence spark is concave and four-pointed, and the two never share a surface. */
  passives: <path d="M12 1.6 14.7 8.9 22.5 9.2 16.4 14 18.5 21.5 12 17.2 5.5 21.5 7.6 14 1.5 9.2 9.3 8.9Z" />,
  /**
   * Crossed swords. The outer transform re-centres and scales the pair back up
   * to fill the box: pivoting each blade high enough to separate the hilts
   * leaves the finished shape short and sitting low, and the 1.16 is what buys
   * that height back — which also thickens the blades, the part of this glyph
   * with the least to spare at display size.
   */
  moves: (
    <g transform="translate(12 12) scale(1.16) translate(-12 -11.2)">
      <g transform="translate(12 9.2) rotate(45) translate(-12 -8)">{SWORD_SLIM}</g>
      <g transform="translate(12 9.2) rotate(-45) translate(-12 -8)">{SWORD_SLIM}</g>
    </g>
  ),
  /** A chest — lid, clasp, body. A container rather than any one of the three slots, since a sword would collide with Attack's glyph and a shield with Defense's. */
  equipment: (
    <>
      <path d="M4 11.1a4.6 4.6 0 0 1 4.6-4.6h6.8a4.6 4.6 0 0 1 4.6 4.6v0.6H4Z" />
      <path d="M4 13.5h16v5.4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <rect x="10.4" y="9.6" width="3.2" height="6.2" rx="0.9" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type SectionGlyphName = keyof typeof SECTION_PATHS;

/**
 * `aria-hidden` for the same reason StatGlyph is: the header's own text
 * ("Stats", "Equipment") is right beside it, and announcing both would say the
 * section twice.
 */
export function SectionGlyph({ name }: { name: SectionGlyphName }) {
  return (
    <svg className="section-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {SECTION_PATHS[name]}
    </svg>
  );
}
