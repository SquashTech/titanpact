import type { ReactNode } from 'react';

// One mark per Class (src/data/classes.ts), keyed by Class id. Same contract as STAT_PATHS: a 24x24
// grid, `currentColor` only, nothing finer than ~2 units, since the smallest place these land is a
// 16px chip on the hero sheet. Each is the OBJECT the name evokes rather than its stats — the stat
// chips beside the card already say what a Class grants, and sixteen pairs of stat glyphs would
// have been sixteen versions of one picture. The colour is still the lead stat's (passiveIcons).

export const CLASS_PATHS: Record<string, ReactNode> = {
  // Two blades crossed.
  warrior: (
    <>
      <g transform="rotate(45 12 12)">
        <path d="M12 .8 13.4 3.2v10.6h-2.8V3.2Z" />
        <path d="M5.8 14.6h12.4v2.3H5.8Z" />
        <path d="M10.9 17.7h2.2v4.6h-2.2Z" />
      </g>
      <g transform="rotate(-45 12 12)">
        <path d="M12 .8 13.4 3.2v10.6h-2.8V3.2Z" />
        <path d="M5.8 14.6h12.4v2.3H5.8Z" />
        <path d="M10.9 17.7h2.2v4.6h-2.2Z" />
      </g>
    </>
  ),
  // A shield bearing a heart.
  guardian: (
    <path
      fillRule="evenodd"
      d="M12 1.8 21 5v6.6c0 5.4-3.7 9.2-9 10.8-5.3-1.6-9-5.4-9-10.8V5Zm0 15.6 3.9-4a2.6 2.6 0 0 0-3.6-3.6l-.3.3-.3-.3a2.6 2.6 0 0 0-3.6 3.6Z"
    />
  ),
  // A double-bitted axe.
  berserker: (
    <>
      <path d="M10.8 2h2.4v20h-2.4Z" />
      <path d="M10.8 5.5C6.2 5.5 3.6 8.6 3.6 12s2.6 6.5 7.2 6.5Z" />
      <path d="M13.2 5.5c4.6 0 7.2 3.1 7.2 6.5s-2.6 6.5-7.2 6.5Z" />
    </>
  ),
  // A rapier: a thin blade behind a cup guard.
  duelist: (
    <g transform="rotate(45 12 12)">
      <path d="M12 .8 13.2 3v10.6h-2.4V3Z" />
      <circle cx="12" cy="15.4" r="3.4" />
      <path d="M10.9 18.4h2.2v4.8h-2.2Z" />
    </g>
  ),
  // A drawn bow with the arrow nocked.
  ranger: (
    <>
      <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M6 2.6c9 4.6 9 14.2 0 18.8" />
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M6 2.6v18.8" />
      <path d="M4 10.8h13v2.4H4Z" />
      <path d="M15.6 7.6 21.4 12l-5.8 4.4Z" />
    </>
  ),
  // An enso: the open brush ring.
  monk: (
    <path fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" d="M14.6 3.4A9 9 0 1 1 5.4 6.2" />
  ),
  // An eye: almond, iris knocked out, pupil filled back in.
  mystic: (
    <path
      fillRule="evenodd"
      d="M1.6 12C5.4 5.2 18.6 5.2 22.4 12 18.6 18.8 5.4 18.8 1.6 12Zm6.6 0a3.8 3.8 0 1 0 7.6 0 3.8 3.8 0 1 0-7.6 0Zm2.1 0a1.7 1.7 0 1 1 3.4 0 1.7 1.7 0 1 1-3.4 0Z"
    />
  ),
  // A wand with a spark on its tip.
  sorcerer: (
    <g transform="rotate(45 12 12)">
      <path d="M10.9 9.6h2.2V23h-2.2Z" />
      <path d="M12 .6c.5 3.8 2.1 5.4 5.9 5.9-3.8.5-5.4 2.1-5.9 5.9-.5-3.8-2.1-5.4-5.9-5.9 3.8-.5 5.4-2.1 5.9-5.9Z" />
    </g>
  ),
  // A bold cross.
  templar: <path d="M9.6 1.6h4.8v7.8h7.8v4.8h-7.8V22H9.6v-7.8H1.8V9.4h7.8Z" />,
  // A key.
  warden: (
    <>
      <path fillRule="evenodd" d="M2 12a5 5 0 1 0 10 0 5 5 0 1 0-10 0Zm3 0a2 2 0 1 1 4 0 2 2 0 1 1-4 0Z" />
      <path d="M11 10.6h11v2.8H11Z" />
      <path d="M16.6 13.2h2.4v4.2h-2.4Z" />
      <path d="M19.8 13.2h2.2v3.2h-2.2Z" />
    </>
  ),
  // An open book.
  sage: (
    <>
      <path d="M1.8 4.2c4.2-.6 7.8.3 10.2 2.6V21c-2.4-2.2-6-3-10.2-2.4Z" />
      <path d="M22.2 4.2c-4.2-.6-7.8.3-10.2 2.6V21c2.4-2.2 6-3 10.2-2.4Z" />
    </>
  ),
  // A crown.
  champion: (
    <>
      <path d="M2.6 17 1.6 5.6l5.6 4.8L12 3.4l4.8 7 5.6-4.8-1 11.4Z" />
      <path d="M2.8 18.6h18.4v3H2.8Z" />
    </>
  ),
  // A lightning bolt.
  battlemage: <path d="M13.8 1.6 3.6 13.4h6.2L8.6 22.4 20.4 9.6h-6.2Z" />,
  // A great helm with its T-slit.
  crusader: (
    <path
      fillRule="evenodd"
      d="M4 10.4a8 8 0 0 1 16 0V22H4Zm2.6 1h10.8v2.4H6.6Zm4.2 2.4h2.4v5.6h-2.4Z"
    />
  ),
  // A mask.
  shaman: (
    <path
      fillRule="evenodd"
      d="M12 1.8c5.6 0 8.4 4 8.4 9.4 0 6-3.8 11-8.4 11S3.6 17.2 3.6 11.2c0-5.4 2.8-9.4 8.4-9.4ZM6.6 10a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0Zm6.4 0a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0ZM9 15.2h6v2.4H9Z"
    />
  ),
  // A horseshoe.
  outrider: (
    <path fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" d="M5.2 21V11.4a6.8 6.8 0 0 1 13.6 0V21" />
  ),
};
