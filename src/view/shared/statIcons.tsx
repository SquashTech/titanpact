import type { CSSProperties, ReactNode } from 'react';
import type { StatKey } from '../../engine/content';

/**
 * The eight stat glyphs, as inline vector art.
 *
 * These were emoji — the last place in the app where a platform-drawn,
 * full-color, drop-shadowed picture sat inside surfaces that are otherwise
 * flat, tinted and lit from one direction. Three problems, all of which
 * vector art fixes and neither a bigger emoji nor a pixel-art icon would:
 *
 * 1. **They weren't ours.** An emoji renders in the host OS's art style, so
 *    the stat row looked different on Windows, Android and iOS and matched
 *    none of them. Every other glyph family in the app (statuses, move kinds,
 *    Field Effects — docs/icon-pack.md) is authored art.
 * 2. **They fought the color system.** STAT_COLORS below already teaches
 *    "purple = Intelligence" through the bar fill; a red heart and a purple
 *    brain sitting next to bars of unrelated colors taught it twice, in
 *    conflict. These glyphs draw in `currentColor`, so the icon IS the stat's
 *    color — icon and bar now say the same thing.
 * 3. **They can't be sized.** docs/icon-pack.md's size constraint (integer
 *    multiples of the source only) rules pixel art out at the ~11px these are
 *    drawn at, and emoji are bitmap fonts with the same problem. Vector has
 *    no dishonest size, so one glyph serves the 11px stat-bar label and the
 *    10px battlefield corner badge without either being a resample.
 *
 * The set is drawn as three rhyming pairs plus the resource pair, so the stat
 * line's *structure* (CLAUDE.md "Stat line") is legible from the icons alone:
 *
 * - **Attack / Defense** — the physical pair, both hard-edged forged metal:
 *   a sword and a heater shield.
 * - **Intelligence / Wisdom** — the magical pair: the same offense/defense
 *   jobs rendered as energy rather than metal, a four-point arcane spark and
 *   a ward of two deflecting arcs. Wisdom deliberately does NOT reuse the
 *   shield silhouette — at 11px a solid shield and an outlined one are the
 *   same picture, and the two defensive stats have to separate at a glance.
 * - **HP / Speed** — the two belonging to no pair: a heart, and the double
 *   chevron every transport control already uses for "fast".
 * - **Mana Pool / MP Regen** — one droplet, and the same droplet with rising
 *   chevrons knocked out of it. The same "the modifier names the family, the
 *   base shape names the member" grammar docs/icon-pack.md found in the
 *   iconset matrix.
 *
 * All eight sit on a 24x24 grid with bold closed silhouettes and no interior
 * detail finer than ~2 units, which is what survives the ~2x downscale to the
 * sizes they are actually drawn at.
 */

/** One color per stat, shared everywhere a stat is drawn — bar fill, glyph, chip — so a player learns "purple = Intelligence" once and reads every hero's block by color from then on. Lives here rather than in StatBars because the glyphs below default to it; StatBars re-exports it for its existing callers. */
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

/**
 * Path data, one entry per stat. Nothing in here names a color — everything
 * fills or strokes with `currentColor`, so a glyph takes whatever the surface
 * it sits on wants: the stat's own color in a stat block, the buff green /
 * debuff red in a battlefield corner badge.
 */
const STAT_PATHS: Record<StatKey, ReactNode> = {
  // Heart. The only shape in the set with no straight edge, which is what
  // separates "life" from the six combat stats at a glance.
  hp: <path d="M12 21.6 3.7 13.1a5.3 5.3 0 0 1 7.5-7.5l.8.8.8-.8a5.3 5.3 0 0 1 7.5 7.5Z" />,
  // Sword, drawn upright and rotated 45 degrees so the blade runs corner to
  // corner: the diagonal is what fills a square glyph box, and it is the
  // silhouette docs/icon-pack.md measured as the strongest at small size.
  attack: (
    <g transform="rotate(45 12 12)">
      <path d="M12 1.4 14.5 6v8.4h-5V6Z" />
      <path d="M5.6 15.6h12.8v2.3H5.6Z" />
      <path d="M10.6 19.1h2.8v2.2h-2.8Z" />
      <circle cx="12" cy="22" r="1.5" />
    </g>
  ),
  // Heater shield: flat shoulders, tapered point. Solid, because Defense is
  // the plate-armor stat and mass is the idea.
  defense: <path d="M12 1.8 21 5v6.6c0 5.4-3.7 9.2-9 10.8-5.3-1.6-9-5.4-9-10.8V5Z" />,
  // Four-point spark: the magical counterpart to the sword. Same job
  // (offense), no edge, all energy.
  intelligence: (
    <path d="M12 1c.8 6.6 4.4 10.2 11 11-6.6.8-10.2 4.4-11 11-.8-6.6-4.4-10.2-11-11 6.6-.8 10.2-4.4 11-11Z" />
  ),
  // Ward: a dome of force over the thing it is protecting. The magical
  // counterpart to the shield — a field that turns something aside, not a
  // plate that stops it. Two concentric arcs were the first attempt and read
  // as a rainbow; an arc plus what it covers reads as a ward.
  wisdom: (
    <>
      <path fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" d="M3 18.6a9 9 0 0 1 18 0" />
      <circle cx="12" cy="16.4" r="2.6" />
    </>
  ),
  // Double chevron, borrowed from transport controls on purpose: it is the
  // one "faster" glyph nobody has to be taught.
  speed: (
    <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.8 5 10.8 12l-7 7" />
      <path d="M13.2 5l7 7-7 7" />
    </g>
  ),
  // Droplet — the base shape of the resource pair.
  manaPool: <path d="M12 1.6c4.8 5.7 7.3 9.6 7.3 12.7a7.3 7.3 0 0 1-14.6 0c0-3.1 2.5-7 7.3-12.7Z" />,
  // The same droplet with a rising chevron knocked out of it (evenodd), so
  // "mana" and "gained each round" are one shape rather than two objects
  // crowded into one 11px box. One chevron, not a stack of them: two read as
  // a pine tree at the sizes this is actually drawn at.
  mpRegen: (
    <path
      fillRule="evenodd"
      d="M12 1.6c4.8 5.7 7.3 9.6 7.3 12.7a7.3 7.3 0 0 1-14.6 0c0-3.1 2.5-7 7.3-12.7ZM12 11.4 7.8 15.6l1.6 1.6L12 14.6l2.6 2.6 1.6-1.6Z"
    />
  ),
};

interface StatGlyphProps {
  stat: StatKey;
  /**
   * `'stat'` (default) draws the glyph in that stat's own STAT_COLORS entry —
   * the stat-block case, where icon and bar fill should agree. `'inherit'`
   * takes the surrounding text color instead, for surfaces already saying
   * something with color that must not be contradicted: a buff/debuff chip is
   * green or red because of its *sign*, not because of which stat moved.
   */
  tone?: 'stat' | 'inherit';
  className?: string;
}

/**
 * The one place a stat glyph is drawn. Everything showing a stat — StatBars'
 * bar labels, CombatantCard's corner badges, every "+10 ATK" grant chip on an
 * item / Evolution / Class card — renders this rather than interpolating a
 * character, so the icon vocabulary is decided once and cannot drift between
 * screens.
 *
 * `aria-hidden` in every case: each of these sits directly beside its own
 * STAT_LABELS text ("ATK", "SPD"), so an accessible name here would make a
 * screen reader announce the stat twice.
 */
export function StatGlyph({ stat, tone = 'stat', className }: StatGlyphProps) {
  return (
    <svg
      className={`stat-glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={tone === 'stat' ? ({ color: STAT_COLORS[stat] } as CSSProperties) : undefined}
    >
      {STAT_PATHS[stat]}
    </svg>
  );
}

/** The four things a move can be, as MoveKindBadge switches on them: a damage move keys off `move.category` (the stat pipeline it draws from), a non-damage one off `move.kind`. */
export type MoveKindGlyphKind = 'physical' | 'magical' | 'heal' | 'buff';

/**
 * Move kinds borrow the stat glyphs rather than getting a set of their own,
 * and two of the four pairings are exact rather than decorative:
 *
 * - **physical → the Attack sword** and **magical → the Intelligence spark**.
 *   These are not "a sword means fighting"; they are literally the stat each
 *   pipeline draws from (CLAUDE.md "Two-pipeline separation" — physical reads
 *   Attack/Defense, magical reads Intelligence/Wisdom). The badge on a move
 *   button now points at the bar in that hero's stat block that decides how
 *   hard it hits.
 * - **heal → the HP heart**, for the same reason: a heal move's number is HP,
 *   and the heart is already what HP looks like everywhere else.
 * - **buff → the Defense shield**, the one pairing that is a symbol rather
 *   than a reference — it kept the shield the emoji and the pixel-art badge
 *   before it both used, since 'buff' covers stat changes and statuses in
 *   both directions and no single stat owns it.
 *
 * Colour comes from the badge (`.category-physical` and friends), never from
 * STAT_COLORS: on a move button the question is which *kind* of move this is,
 * and a red sword that meant "Attack stat" in one place and "physical damage"
 * in another would be two claims in one glyph.
 */
const MOVE_KIND_STAT: Record<MoveKindGlyphKind, StatKey> = {
  physical: 'attack',
  magical: 'intelligence',
  heal: 'hp',
  buff: 'defense',
};

export function MoveKindGlyph({ kind, className }: { kind: MoveKindGlyphKind; className?: string }) {
  return <StatGlyph stat={MOVE_KIND_STAT[kind]} tone="inherit" className={className} />;
}
