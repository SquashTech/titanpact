import type { ReactNode } from 'react';

/**
 * One glyph per type — the fifth family in the vector vocabulary (stats, move
 * kinds, section headers, map nodes, and now the fifteen types), on the same
 * 24x24 grid, under the same `currentColor`-only rule and the same "nothing
 * finer than ~2 units" floor.
 *
 * This family exists because the Elemental Force statuses needed it. A Force
 * chip is "this type, boosted" (docs/conditions.md), and the pixel-art pack
 * spelled that as element x up-arrow out of its Skills & States matrix — which
 * worked for eleven types and simply had no row for Iron, Mech, Beast or
 * Ancient, so four of the fifteen chips fell back to an emoji and the cluster
 * rendered in two art styles at once. Authoring the elements makes all fifteen
 * one set, and StatusGlyph composes the arrow itself (statusIcons.tsx).
 *
 * CLAUDE.md's identity filter governs what each one draws: **type is the
 * domain a hero's power draws from, not what its body is made of.** So Iron is
 * an anvil (the forge) rather than a plate of metal, Mind is a head in profile
 * rather than a brain, Ancient is a funerary urn rather than a ruin. Each
 * glyph names a source of power.
 *
 * Two shapes here are shared rather than duplicated, and both are deliberate:
 *
 * - **FLAME is both Fire and the Burn status.** statusIcons.tsx's old emoji
 *   set had to dodge this (Fire Force got a volcano because Burn had already
 *   claimed the flame), and the dodge is what made the Force chips hard to
 *   read — a volcano does not say "Fire" faster than a flame does. With an
 *   explicit up-arrow modifier the collision resolves the honest way round:
 *   the flame means fire in both places, and the arrow is what says "boosted".
 * - **Storm is a cloud AND a bolt, so Conduct can keep the bare bolt.** The
 *   two genuinely co-occur on one card (a Storm hero holding Storm Force, with
 *   Conduct planted on the enemy across from it), and unlike Fire/Burn they
 *   are not the same idea — one is a domain, the other is a mark waiting to be
 *   detonated. Giving Storm the extra mass keeps them apart at badge size.
 */

/** Fire, and the Burn status — see the note above. Inner tongue knocked out (evenodd) so the flame has a shape rather than being a blob; it is ~5 units across, which survives the 16px badge. */
export const FLAME = (
  <path
    fillRule="evenodd"
    d="M12 1.2c.6 3.6 2.6 5.5 4.4 7.7 1.6 2 2.4 3.9 2.4 6A6.8 6.8 0 0 1 12 22.8 6.8 6.8 0 0 1 5.2 14.9c.2-2.2 1.4-3.9 2.4-5.7.3 1.4.9 2.4 1.8 3C9 8.4 10 4.6 12 1.2ZM12 12.4c1.7 1.9 2.6 3.2 2.6 4.7a2.6 2.6 0 0 1-5.2 0c0-1.5 1-2.8 2.6-4.7Z"
  />
);

export const ELEMENT_PATHS: Record<string, ReactNode> = {
  Fire: FLAME,
  /** Two wave crests. Deliberately NOT a droplet: the droplet is Mana Pool's glyph (statIcons.tsx) and a Water hero's mana bar sits four pixels from this chip. */
  Water: (
    <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
      <path d="M2.4 9c1.9-2.6 3.8-2.6 5.6 0s3.8 2.6 5.6 0 3.8-2.6 5.6 0" />
      <path d="M2.4 16.2c1.9-2.6 3.8-2.6 5.6 0s3.8 2.6 5.6 0 3.8-2.6 5.6 0" />
    </g>
  ),
  /** Two ice shards — all straight edges and acute points, where the Freeze status is a radially symmetric snowflake. The pair never has to be told apart from a distance; it has to be told apart from Freeze, and "angular" vs "radial" does that at 16px where "six barbs" vs "eight barbs" would not. */
  Frost: (
    <>
      <path d="M13.8 1.6 20.4 10.6 13.8 22.4 8.8 13.4Z" />
      <path d="M6.4 7.8 10 12.4 5.2 19.6 2.4 13Z" />
    </>
  ),
  /** Cloud over a bolt. The mass is what keeps this off Conduct's bare bolt — see the file note. */
  Storm: (
    <>
      <circle cx="9" cy="8.4" r="4.6" />
      <circle cx="15.6" cy="10.2" r="3.9" />
      <rect x="4.6" y="9.4" width="14.8" height="5" rx="2.5" />
      <path d="M13.4 13.6 7.8 20.8h3.4l-.8 3 5.8-7.6h-3.4Z" />
    </>
  ),
  /** A boulder: an irregular lump with a flat base. Asymmetric on purpose, and it takes more asymmetry than it looks like it should — an eight-sided lump drawn with even-ish spacing renders as a plain hexagon at badge size, which reads as a cut gem (the map's Relic Shrine) rather than as a rock. Long facets on two sides and short ones on the others is what separates them. */
  Stone: <path d="M1.8 12.6 8 4.2l7 1.4 7.2 6.4-2.6 8.8H4.6Z" />,
  /** A leaf, tip to tip across the diagonal — the one direction that fills a square box, same reasoning as the Attack sword's 45 degrees. */
  Nature: (
    <>
      <path d="M20.8 3.2C20.8 13.2 13.6 20.4 3.6 20.4 3.6 10.4 10.8 3.2 20.8 3.2Z" />
      <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M2 22.4 5.6 18.8" />
    </>
  ),
  /** Sun: disc plus eight rays, drawn as four bars crossing under the disc. */
  Light: (
    <>
      <circle cx="12" cy="12" r="5.4" />
      <rect x="10.8" y="0.6" width="2.4" height="22.8" rx="1.2" />
      <rect x="10.8" y="0.6" width="2.4" height="22.8" rx="1.2" transform="rotate(45 12 12)" />
      <rect x="10.8" y="0.6" width="2.4" height="22.8" rx="1.2" transform="rotate(90 12 12)" />
      <rect x="10.8" y="0.6" width="2.4" height="22.8" rx="1.2" transform="rotate(135 12 12)" />
    </>
  ),
  /** Crescent moon — the one glyph in the set defined by what has been taken out of it, which is the right shape for the type whose domain is the absence of light. */
  Shadow: <path d="M14.8 2.2A10.2 10.2 0 1 0 21.6 17.4 8.2 8.2 0 0 1 14.8 2.2Z" />,
  /** An orb inside an orbit. Deliberately not a spark or a star: the four-point spark is the Intelligence stat and the five-point star is the Passives header, and Arcane sits beside both on a hero sheet. */
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
  /** A head in profile. A brain is the obvious pick and is all interior detail — folds are exactly the ~1-unit line work that dies at badge size — where a profile is pure silhouette, which is what survives. */
  Mind: (
    <path d="M12.6 2.4c5.2 0 9 3.6 9 8.4 0 2.4-1 3.7-2.7 4.1l.8 3.1c.3 1-.4 1.9-1.5 1.9h-2v2c0 1-.7 1.6-1.7 1.6H8.6v-5.3C6.2 16.7 4.2 14 4.2 10.8c0-4.8 3.6-8.4 8.4-8.4Z" />
  ),
  /**
   * A wisp: an orb trailing two tails of cloth. Explicitly NOT the Haunt ghost
   * minus its eyes — a faceless ghost and a ghost are the same picture at
   * 16px, and both are on the battlefield at once.
   *
   * The tails are what earn it. The first attempt hung the orb over a single
   * closed bowl of a veil and read as a lightbulb; splitting the hem into two
   * tapered tongues is the difference between something resting in a cup and
   * something streaming away from you.
   */
  Spirit: (
    <>
      <circle cx="12" cy="6.4" r="4.6" />
      <path d="M6 11.8h12c0 4.2-.9 7.6-2.6 10.2l-1.5-3.4-1.9 2.8-1.9-2.8-1.5 3.4C6.9 19.4 6 16 6 11.8Z" />
    </>
  ),
  /**
   * An anvil, not an ingot: CLAUDE.md's identity filter says a type is the
   * domain a hero's power draws from, and Iron's domain is the forge.
   *
   * The horn is not decoration. A rectangular face over a waisted body over a
   * base is also a diagram of an hourglass or a small table, and the tapered
   * beak on the left is the one feature that makes the silhouette read as an
   * anvil and nothing else.
   */
  Iron: (
    <>
      <path d="M1.6 6.4c2.4-.9 4.6-1.4 6.6-1.4h13.2v4.6H7.8c-2.4 0-4.4-1-6.2-3.2Z" />
      <path d="M9.2 9.6h6.8c0 3.4 1.3 5.7 3.6 7.3v1.2H5.6v-1.2c2.3-1.6 3.6-3.9 3.6-7.3Z" />
      <rect x="4.4" y="18.1" width="15.2" height="3.4" rx="1.2" />
    </>
  ),
  /** A cog: an annulus (a 4.2-wide ring stroke, so the hole stays a hole) under six chunky teeth. Six, not the conventional eight — eight teeth leave ~2.6 units of gap between them, and the ring closes up into a plain disc at badge size. */
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
  /** A paw print: pad plus four toes. Distinct from the map's claw, which is three gashes torn ACROSS the box — a track is what an animal leaves, a gash is what it does. */
  Beast: (
    <>
      <ellipse cx="12" cy="16.6" rx="5.8" ry="4.8" />
      <ellipse cx="5.4" cy="11" rx="2.7" ry="3.3" transform="rotate(-22 5.4 11)" />
      <ellipse cx="9.6" cy="6.4" rx="2.6" ry="3.3" />
      <ellipse cx="14.4" cy="6.4" rx="2.6" ry="3.3" />
      <ellipse cx="18.6" cy="11" rx="2.7" ry="3.3" transform="rotate(22 18.6 11)" />
    </>
  ),
  /** A funerary urn — round body, flared lip. The Ancient boss already wears the horned skull (nodeIcons.tsx) and the two must not be one shape: the skull is the thing you fight, this is the power it draws on. */
  Ancient: (
    <>
      <rect x="7.4" y="1.4" width="9.2" height="2.8" rx="1.2" />
      <path d="M9.2 4.2h5.6v.6c0 .9.6 1.4 1.5 1.8 2.8 1.5 4.5 4.3 4.5 7.7 0 5-3.7 8.5-8.8 8.5S3.2 19.3 3.2 14.3c0-3.4 1.7-6.2 4.5-7.7.9-.4 1.5-.9 1.5-1.8Z" />
    </>
  ),
};

/** The one place a type's glyph is drawn. Takes `currentColor` like every other family, so the caller decides whether it wears the type's own color (typeColors.ts) or the surface's. */
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
