import type { ReactNode } from 'react';

// One glyph per type, 24x24 grid, `currentColor` only, nothing finer than ~2 units. Each draws the
// domain the type's power comes from (CLAUDE.md), not a material: Iron is an anvil, Mind a profile.
// FLAME is shared with the Burn status on purpose; the Force chip's up-arrow is what says "boosted".
// Storm carries a cloud so Conduct can keep the bare bolt.

export const FLAME = (
  <path
    fillRule="evenodd"
    d="M12 1.2c.6 3.6 2.6 5.5 4.4 7.7 1.6 2 2.4 3.9 2.4 6A6.8 6.8 0 0 1 12 22.8 6.8 6.8 0 0 1 5.2 14.9c.2-2.2 1.4-3.9 2.4-5.7.3 1.4.9 2.4 1.8 3C9 8.4 10 4.6 12 1.2ZM12 12.4c1.7 1.9 2.6 3.2 2.6 4.7a2.6 2.6 0 0 1-5.2 0c0-1.5 1-2.8 2.6-4.7Z"
  />
);

export const ELEMENT_PATHS: Record<string, ReactNode> = {
  Fire: FLAME,
  // Wave crests, not a droplet (the droplet is Mana Pool's glyph).
  Water: (
    <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
      <path d="M2.4 9c1.9-2.6 3.8-2.6 5.6 0s3.8 2.6 5.6 0 3.8-2.6 5.6 0" />
      <path d="M2.4 16.2c1.9-2.6 3.8-2.6 5.6 0s3.8 2.6 5.6 0 3.8-2.6 5.6 0" />
    </g>
  ),
  // Angular shards, distinct from Freeze's radial snowflake.
  Frost: (
    <>
      <path d="M13.8 1.6 20.4 10.6 13.8 22.4 8.8 13.4Z" />
      <path d="M6.4 7.8 10 12.4 5.2 19.6 2.4 13Z" />
    </>
  ),
  Storm: (
    <>
      <circle cx="9" cy="8.4" r="4.6" />
      <circle cx="15.6" cy="10.2" r="3.9" />
      <rect x="4.6" y="9.4" width="14.8" height="5" rx="2.5" />
      <path d="M13.4 13.6 7.8 20.8h3.4l-.8 3 5.8-7.6h-3.4Z" />
    </>
  ),
  // Boulder; asymmetric so it doesn't read as the Relic Shrine's gem.
  Stone: <path d="M1.8 12.6 8 4.2l7 1.4 7.2 6.4-2.6 8.8H4.6Z" />,
  Nature: (
    <>
      <path d="M20.8 3.2C20.8 13.2 13.6 20.4 3.6 20.4 3.6 10.4 10.8 3.2 20.8 3.2Z" />
      <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M2 22.4 5.6 18.8" />
    </>
  ),
  Light: (
    <>
      <circle cx="12" cy="12" r="5.4" />
      <rect x="10.8" y="0.6" width="2.4" height="22.8" rx="1.2" />
      <rect x="10.8" y="0.6" width="2.4" height="22.8" rx="1.2" transform="rotate(45 12 12)" />
      <rect x="10.8" y="0.6" width="2.4" height="22.8" rx="1.2" transform="rotate(90 12 12)" />
      <rect x="10.8" y="0.6" width="2.4" height="22.8" rx="1.2" transform="rotate(135 12 12)" />
    </>
  ),
  Shadow: <path d="M14.8 2.2A10.2 10.2 0 1 0 21.6 17.4 8.2 8.2 0 0 1 14.8 2.2Z" />,
  // Orb in an orbit; the four-point spark is Intelligence and the five-point star is Passives.
  Arcane: (
    <>
      <circle cx="12" cy="12" r="4.8" />
      <ellipse
        cx="12"
        cy="12"
        rx="10.6"
        ry="4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        transform="rotate(-28 12 12)"
      />
    </>
  ),
  // Head in profile.
  Mind: (
    <path d="M12.6 2.4c5.2 0 9 3.6 9 8.4 0 2.4-1 3.7-2.7 4.1l.8 3.1c.3 1-.4 1.9-1.5 1.9h-2v2c0 1-.7 1.6-1.7 1.6H8.6v-5.3C6.2 16.7 4.2 14 4.2 10.8c0-4.8 3.6-8.4 8.4-8.4Z" />
  ),
  // Wisp: orb over two trailing tails, distinct from the Haunt ghost.
  Spirit: (
    <>
      <circle cx="12" cy="6.4" r="4.6" />
      <path d="M6 11.8h12c0 4.2-.9 7.6-2.6 10.2l-1.5-3.4-1.9 2.8-1.9-2.8-1.5 3.4C6.9 19.4 6 16 6 11.8Z" />
    </>
  ),
  // Anvil; the horn is what keeps it from reading as an hourglass.
  Iron: (
    <>
      <path d="M1.6 6.4c2.4-.9 4.6-1.4 6.6-1.4h13.2v4.6H7.8c-2.4 0-4.4-1-6.2-3.2Z" />
      <path d="M9.2 9.6h6.8c0 3.4 1.3 5.7 3.6 7.3v1.2H5.6v-1.2c2.3-1.6 3.6-3.9 3.6-7.3Z" />
      <rect x="4.4" y="18.1" width="15.2" height="3.4" rx="1.2" />
    </>
  ),
  // Cog with six teeth; eight closes the ring into a disc at badge size.
  Mech: (
    <>
      <circle cx="12" cy="12" r="6.2" fill="none" stroke="currentColor" strokeWidth="4.2" />
      <rect x="10.2" y="0.8" width="3.6" height="4.8" rx="1" />
      <rect x="10.2" y="0.8" width="3.6" height="4.8" rx="1" transform="rotate(60 12 12)" />
      <rect x="10.2" y="0.8" width="3.6" height="4.8" rx="1" transform="rotate(120 12 12)" />
      <rect x="10.2" y="0.8" width="3.6" height="4.8" rx="1" transform="rotate(180 12 12)" />
      <rect x="10.2" y="0.8" width="3.6" height="4.8" rx="1" transform="rotate(240 12 12)" />
      <rect x="10.2" y="0.8" width="3.6" height="4.8" rx="1" transform="rotate(300 12 12)" />
    </>
  ),
  // Paw print (the map's claw is three gashes).
  Beast: (
    <>
      <ellipse cx="12" cy="16.6" rx="5.8" ry="4.8" />
      <ellipse cx="5.4" cy="11" rx="2.7" ry="3.3" transform="rotate(-22 5.4 11)" />
      <ellipse cx="9.6" cy="6.4" rx="2.6" ry="3.3" />
      <ellipse cx="14.4" cy="6.4" rx="2.6" ry="3.3" />
      <ellipse cx="18.6" cy="11" rx="2.7" ry="3.3" transform="rotate(22 18.6 11)" />
    </>
  ),
  // Funerary urn (the Guardian boss node wears the horned skull).
  Ancient: (
    <>
      <rect x="7.4" y="1.4" width="9.2" height="2.8" rx="1.2" />
      <path d="M9.2 4.2h5.6v.6c0 .9.6 1.4 1.5 1.8 2.8 1.5 4.5 4.3 4.5 7.7 0 5-3.7 8.5-8.8 8.5S3.2 19.3 3.2 14.3c0-3.4 1.7-6.2 4.5-7.7.9-.4 1.5-.9 1.5-1.8Z" />
    </>
  ),
};

/** Takes `currentColor`; the caller decides whether it wears the type's color or the surface's. */
export function ElementGlyph({ type, className }: { type: string; className?: string }) {
  const path = ELEMENT_PATHS[type];
  if (!path) return null;
  return (
    <svg
      className={`element-glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  );
}
