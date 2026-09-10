import type { ReactNode } from 'react';

// Section-header glyphs for the hero sheets. 24x24 grid, `currentColor`, nothing finer than ~2 units.
// Kept out of statIcons.tsx: a header is always its panel's gold and inherits it.

// Slimmer than the Attack stat sword, and pivoted high, so two can be crossed without merging.
const SWORD_SLIM = (
  <>
    <path d="M12 2.2 14.1 14.2h-4.2Z" />
    <path d="M9.2 14.2h5.6v2H9.2Z" />
    <circle cx="12" cy="18" r="1.6" />
  </>
);

export const SECTION_PATHS = {
  stats: (
    <>
      <rect x="2.6" y="13.2" width="5" height="8.2" rx="1.2" />
      <rect x="9.5" y="8.4" width="5" height="13" rx="1.2" />
      <rect x="16.4" y="3.6" width="5" height="17.8" rx="1.2" />
    </>
  ),
  buffs: (
    <>
      <path d="M6.8 2.8 12 9.6H9.2v11.6H4.4V9.6H1.6Z" />
      <path d="M17.2 21.2 12 14.4h2.8V2.8h4.8v11.6H22.4Z" />
    </>
  ),
  // Flask.
  statuses: (
    <>
      <rect x="8.9" y="1.6" width="6.2" height="2.1" rx="0.9" />
      <path d="M10.3 3.7h3.4v5.6l5.5 8.5a2.7 2.7 0 0 1-2.3 4.2H7.1a2.7 2.7 0 0 1-2.3-4.2l5.5-8.5Z" />
    </>
  ),
  // Shield with a bolt punched through it (evenodd so the bolt is a hole).
  matchups: (
    <path
      fillRule="evenodd"
      d="M12 1.8 20.6 4.9v7.2c0 4.9-3.5 8.4-8.6 10.1-5.1-1.7-8.6-5.2-8.6-10.1V4.9ZM12.9 6.4 8.6 12.9h2.6l-0.8 5 4.3-6.6h-2.6Z"
    />
  ),
  passives: <path d="M12 1.6 14.7 8.9 22.5 9.2 16.4 14 18.5 21.5 12 17.2 5.5 21.5 7.6 14 1.5 9.2 9.3 8.9Z" />,
  // Crossed swords; the outer transform re-centres and scales the pair to fill the box.
  moves: (
    <g transform="translate(12 12) scale(1.16) translate(-12 -11.2)">
      <g transform="translate(12 9.2) rotate(45) translate(-12 -8)">{SWORD_SLIM}</g>
      <g transform="translate(12 9.2) rotate(-45) translate(-12 -8)">{SWORD_SLIM}</g>
    </g>
  ),
  // Chest.
  equipment: (
    <>
      <path d="M4 11.1a4.6 4.6 0 0 1 4.6-4.6h6.8a4.6 4.6 0 0 1 4.6 4.6v0.6H4Z" />
      <path d="M4 13.5h16v5.4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <rect x="10.4" y="9.6" width="3.2" height="6.2" rx="0.9" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type SectionGlyphName = keyof typeof SECTION_PATHS;

export function SectionGlyph({ name }: { name: SectionGlyphName }) {
  return (
    <svg className="section-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {SECTION_PATHS[name]}
    </svg>
  );
}
