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
  // Two figures — the map's Roster button and the Guild Hall's people tab.
  heroes: (
    <>
      <circle cx="16.6" cy="8.2" r="3.2" />
      <path d="M16.6 12.8c3.2 0 5.2 2 5.2 5v3.4h-4.4v-2.8c0-2.2-.9-4.2-2.4-5.5a5 5 0 0 1 1.6-.1Z" />
      <circle cx="9.2" cy="7.4" r="4" />
      <path d="M9.2 13c4.2 0 6.8 2.6 6.8 6.2v2H2.4v-2c0-3.6 2.6-6.2 6.8-6.2Z" />
    </>
  ),
  // Great-helm — the map's recruitable-encounter tile and the Compendium's Recruitable page wear
  // one glyph. The eye slit is two pieces so a nose bridge keeps the dome attached.
  recruit: (
    <path
      fillRule="evenodd"
      d="M12 2.4c-4.9 0-8 3.4-8 8.4v4.4c0 3.4 1.2 6.2 2.6 6.2h10.8c1.4 0 2.6-2.8 2.6-6.2v-4.4c0-5-3.1-8.4-8-8.4ZM6 10.6h4.6V14H6Zm7.4 0H18V14h-4.6Z"
    />
  ),
  // Records — the title hub's tile and the Records sheet's page. The handles are open stroke
  // rather than fill: at 16px a filled handle closes up against the bowl and the whole thing
  // becomes a goblet.
  records: (
    <>
      <path d="M6.4 2.2h11.2v6.2a5.6 5.6 0 0 1-11.2 0Z" />
      <g fill="none" stroke="currentColor" strokeWidth="2.1">
        <path d="M6.4 4.4H3.7v1.9a3.3 3.3 0 0 0 3.3 3.3" />
        <path d="M17.6 4.4h2.7v1.9a3.3 3.3 0 0 1-3.3 3.3" />
      </g>
      <path d="M10.8 14h2.4v3.8h-2.4Z" />
      <path d="M6.8 18.2h10.4v3.6H6.8Z" />
    </>
  ),
  // Run history: an hourglass, the sand run through. Caps and a pinched body, three solid pieces.
  history: (
    <>
      <path d="M5.2 2h13.6v2.4H5.2Z" />
      <path d="M5.2 19.6h13.6v2.4H5.2Z" />
      <path d="M6.8 4.4h10.4c0 3.2-1.7 5.7-4.1 7.6 2.4 1.9 4.1 4.4 4.1 7.6H6.8c0-3.2 1.7-5.7 4.1-7.6-2.4-1.9-4.1-4.4-4.1-7.6Z" />
    </>
  ),
  // Chest.
  equipment: (
    <>
      <path d="M4 11.1a4.6 4.6 0 0 1 4.6-4.6h6.8a4.6 4.6 0 0 1 4.6 4.6v0.6H4Z" />
      <path d="M4 13.5h16v5.4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <rect x="10.4" y="9.6" width="3.2" height="6.2" rx="0.9" />
    </>
  ),
  /**
   * The Mastery Scroll: a sheet hanging off its top roll, its foot curling into a second — the
   * coil on each roll is the tell. Deliberately not the Reference scroll in nodeIcons, which is a
   * page between two bars. The map node, the Cache and the run resource wear it too — one picture
   * per concept.
   */
  mastery: (
    <path d="M2 5.8a3.4 3.4 0 0 1 3.4-3.4h12.4a3.6 3.6 0 0 1 3.6 3.6v1.2h-4v9.6h2.2a2.4 2.4 0 0 1 0 4.8H2Zm3.4-1.8a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm14.2 13.9a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6ZM11.2 8.2v2.2h4.6V8.2Zm0 4v2.2h3.2v-2.2Z" />
  ),
  // A coin purse, drawn shut — the Guild Hall's Shop counter.
  shop: (
    <>
      <path d="M7.6 2.4h8.8l-2.4 3.8h-4Z" />
      <path d="M9.2 7.6h5.6c3.7 2.1 6.1 5.5 6.1 8.7 0 3.4-2.9 5.3-8.9 5.3s-8.9-1.9-8.9-5.3c0-3.2 2.4-6.6 6.1-8.7Z" />
    </>
  ),
  // Two arrows chasing each other round — the Tavern's reroll.
  reroll: (
    <>
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M19.2 10A7.6 7.6 0 0 0 6.4 7" />
        <path d="M4.8 14a7.6 7.6 0 0 0 12.8 3" />
      </g>
      <path d="M2.4 4.2 3.2 11 9.2 8.2Z" />
      <path d="M21.6 19.8 20.8 13 14.8 15.8Z" />
    </>
  ),
  // A sealed pack: a box with its lid lifted a crack — the Constellation's Starter Packs page.
  packs: (
    <>
      <path d="M3 9.4 12 5.2l9 4.2v1.6l-9 4.2-9-4.2Z" />
      <path d="M3.4 12.8 11 16.4v5.2L3.4 18Z" />
      <path d="M20.6 12.8 13 16.4v5.2l7.6-3.6Z" />
    </>
  ),
  // A place on the horizon: a dome between two towers, the Locations page.
  places: (
    <>
      <path d="M2.4 21v-8.6h3.4V21Z" />
      <path d="M18.2 21v-8.6h3.4V21Z" />
      <path d="M4.1 9.2 3 12.4h5.8L7.7 9.2Z" />
      <path d="M16.3 9.2l-1.1 3.2H21l-1.1-3.2Z" />
      <path d="M7 21v-8a5 5 0 0 1 10 0v8Z" />
      <path d="M11.2 2.6h1.6v5.2h-1.6Z" />
      <path d="M9.6 4.4h4.8V6H9.6Z" />
    </>
  ),
  // One open eye, the Titan's — the Compendium's Titanspawn page.
  spawn: (
    <path
      fillRule="evenodd"
      d="M12 5.2c5 0 8.6 3.6 10.4 6.8-1.8 3.2-5.4 6.8-10.4 6.8S3.4 15.2 1.6 12C3.4 8.8 7 5.2 12 5.2Zm0 2.6a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Zm0 2.4a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z"
    />
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
