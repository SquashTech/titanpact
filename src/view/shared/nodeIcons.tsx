import type { ReactNode } from 'react';
import type { MapNodeType } from '../../run/map';
import { STAT_PATHS } from './statIcons';
import { SECTION_PATHS } from './sectionIcons';
import { EQUIP_FORM_PATHS } from './equipmentIcons';

/**
 * One glyph per map node type — the fourth family in the vector vocabulary
 * (stats, move kinds, section headers, and now the run map), on the same 24x24
 * grid, under the same `currentColor`-only rule and the same "nothing finer
 * than ~2 units" floor.
 *
 * The map HAS had icons before and lost them (commit 9688834, "Cut the
 * hand-drawn map node sprites"): 16x16 pixel art rendered at 22px — a 1.375x
 * resample of a source whose only honest sizes are 16 and 32
 * (docs/icon-pack.md "The size constraint") — with a `grayscale(0.6)` filter
 * on every locked node on top of it. They read as smudges, and cutting them
 * was right. Nothing in that verdict argues against an icon here; it argues
 * against *that* icon at *that* size. Vector has no dishonest size, so one
 * path set serves the 14px reward pill and the 26px Ancient plate without
 * either being a resample, and it takes `--node-color` for free — which is
 * what lets the locked/visited states stay a lighting change (opacity) instead
 * of the desaturating filter that made the sprites worst exactly where the map
 * needs to stay readable.
 *
 * Three groups, and the grouping is the information:
 *
 * - **Encounters say who you are fighting** — the one thing about a fight that
 *   an 11px label cannot carry. Monsters wear a claw, recruitable hero squads
 *   wear a helm, the Guardian wears a horned skull. `fight` and `battle`
 *   deliberately share the claw: they draw from the same monster pool
 *   (src/run/map.ts, the 2026-08-22 Monsters/Skirmish split), so two glyphs
 *   would invent a distinction the game does not have. `elite` is the Skirmish
 *   helm under a crown — the same "the modifier names the family, the base
 *   shape names the member" grammar as Mana Pool / MP Regen, and true: an
 *   Elite IS a Skirmish squad with stat boosts. The 2026-08-29 label rename
 *   caught the words up to this grouping: both claw nodes now SAY "Monsters"
 *   and both helm nodes say "Skirmish", so glyph and label finally agree on
 *   which fights you can recruit from.
 * - **Stat and gear rewards reuse the exact glyph of the thing they grant.** A
 *   Vitality shrine wears the HP heart, a Mana shrine the droplet, a Regen
 *   shrine the droplet-with-chevron, a Weapon cache the Attack sword, an Armor
 *   cache the Defense shield, an Equipment cache the section header's chest.
 *   Same reasoning as MoveKindBadge (docs/icon-pack.md "Where this pack does
 *   NOT apply"): the pairing is literal rather than symbolic, so a player who
 *   has read one hero stat block has already learned half of this map.
 * - **Landmarks and the remaining rewards** get authored shapes with no
 *   counterpart elsewhere — hall, tome, money bag, gem, ring, level-up arrow,
 *   and the unknown.
 */

/**
 * One claw gash: a crescent, pointed at both ends and ~3 units at its widest.
 * Drawn vertically so the fan below owns the angle — exactly as SWORD_SLIM in
 * sectionIcons.tsx stands upright so its crossed pair owns the rotation.
 */
const CLAW_GASH = <path d="M12 5C15.4 9.4 17 14.4 16.4 19.6 12.4 15.2 10.6 10.2 12 5Z" />;

/**
 * Three gashes fanned about a pivot well below the box (12, 32), so they splay
 * without any of them leaving the frame, then leaned right as a group: a gash
 * reads as a strike only when it runs across the square rather than straight
 * down it.
 *
 * A shared constant rather than two copies because `fight` and `battle` are
 * the same encounter — see the group note above.
 */
const CLAW = (
  <g transform="translate(12 12) translate(-13.8 -11.3)">
    <g transform="translate(-5.2 3)">
      <g transform="rotate(-30 12 12)">{CLAW_GASH}</g>
    </g>
    <g transform="rotate(-30 12 12)">{CLAW_GASH}</g>
    <g transform="translate(5.2 -3)">
      <g transform="rotate(-30 12 12)">{CLAW_GASH}</g>
    </g>
  </g>
);

/**
 * The helm the two recruitable-squad nodes share: a closed great-helm, dome
 * over a flat jaw, with the eye slit knocked out in two pieces so a nose
 * bridge survives in the middle. The bridge is what stops it reading as a
 * bucket with a stripe — one uninterrupted slot cuts the silhouette clean in
 * half at 20px and the dome drifts off as a separate object.
 */
const HELM = (
  <path
    fillRule="evenodd"
    d="M12 2.4c-4.9 0-8 3.4-8 8.4v4.4c0 3.4 1.2 6.2 2.6 6.2h10.8c1.4 0 2.6-2.8 2.6-6.2v-4.4c0-5-3.1-8.4-8-8.4ZM6 10.6h4.6V14H6Zm7.4 0H18V14h-4.6Z"
  />
);

/** Two facing pages hinged at a spine. */
const OPEN_BOOK = (
  <>
    <path d="M11 6.4C8.8 4.4 5.8 3.4 2.2 3.6v13.2c3.6-.2 6.6.8 8.8 2.8Z" />
    <path d="M13 6.4c2.2-2 5.2-3 8.8-2.8v13.2c-3.6-.2-6.6.8-8.8 2.8Z" />
  </>
);

const NODE_PATHS: Record<MapNodeType, ReactNode> = {
  /** Monsters. The act's opener. */
  fight: CLAW,
  /** Helm — the squad across a Skirmish is heroes, and heroes are what a Recruit Contract is claimed from. */
  skirmish: HELM,
  /** The same claw as `fight`: identical monster pool, identical glyph. */
  battle: CLAW,
  /**
   * Crowned helm. The crown floats clear of the dome instead of resting on it
   * — touching, the two merge into one lumpy mass and the Elite stops reading
   * as "the Skirmish helm, promoted", which is the entire point of the pair.
   */
  elite: (
    <>
      <path d="M4.6 2.2 8 5.6l4-3.4 4 3.4 3.4-3.4-1 5.4H5.6Z" />
      <g transform="translate(12 23.4) scale(0.82) translate(-12 -20.6)">{HELM}</g>
    </>
  ),
  /**
   * Horned skull. The act's terminus wears the only face on the map — sockets
   * and a jaw are what make a shape read as something that is looking back at
   * you, and nothing else on the route should. The sockets and nose are
   * knocked out (evenodd) rather than drawn: this glyph only ever renders on
   * the Guardian plate, the largest tile on the screen, where holes hold.
   */
  boss: (
    <>
      <path
        fillRule="evenodd"
        d="M12 2.4c5.2 0 9 3.6 9 8.8 0 3.2-1.4 5.8-3.6 7.2H6.6C4.4 17 3 14.4 3 11.2c0-5.2 3.8-8.8 9-8.8Zm-3.7 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm7.4 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM12 14.2l-1.7 3h3.4Z"
      />
      <rect x="6.7" y="18.2" width="2.6" height="3.4" rx="0.9" />
      <rect x="10.7" y="18.2" width="2.6" height="3.4" rx="0.9" />
      <rect x="14.7" y="18.2" width="2.6" height="3.4" rx="0.9" />
    </>
  ),
  /**
   * The Guild Hall, as a hall: a wide roof over a body with an arched doorway
   * knocked out. The doorway is the whole glyph — a roof over a solid block is
   * a shed, a roof over an opening is somewhere you go in.
   */
  shop: (
    <>
      <path d="M12 2.2 22.6 9.4H1.4Z" />
      <path fillRule="evenodd" d="M3.4 11.2h17.2v10.6H3.4Zm8.6 2.8a3.2 3.2 0 0 0-3.2 3.2v4.6h6.4v-4.6a3.2 3.2 0 0 0-3.2-3.2Z" />
    </>
  ),
  /** The section header's chest, unchanged: an Equipment Cache and the Equipment section of a hero sheet are the same subject. */
  equipmentReward: SECTION_PATHS.equipment,
  /** Cut gem. Relics are the one team-wide permanent, so they get the only shape on the map that looks like treasure rather than like a tool. */
  relicReward: <path d="M7.4 3.2h9.2l4.8 5.8L12 21.2 2.6 9Z" />,
  /**
   * Money bag: cinched neck over a heavy round body. Chosen over a coin or a
   * stack of coins because both need an interior ring or a set of 1-unit gaps
   * to read as coinage, and neither survives the 14px of a reward pill.
   */
  currencyReward: (
    <>
      <path d="M8.6 2.6h6.8a1 1 0 0 1 .8 1.6l-1.4 2H9.2l-1.4-2a1 1 0 0 1 .8-1.6Z" />
      <path d="M9 7.8h6c3.6 1.9 5.8 5.2 5.8 8.6 0 3.2-2.4 5.2-6 5.2h-5.6c-3.6 0-6-2-6-5.2 0-3.4 2.2-6.7 5.8-8.6Z" />
    </>
  ),
  /** One arrow off a plinth: this goes up, permanently. Deliberately not the section header's Buffs pair (one up, one down), which covers both directions — an XP grant only ever goes one way. */
  upgradeReward: (
    <>
      <path d="M12 2 20.6 12h-5v5.4H8.4V12h-5Z" />
      <path d="M6.4 19.4h11.2v2.6H6.4Z" />
    </>
  ),
  /** The Attack sword — a Weapon Cache grants a weapon, and a weapon's stat is Attack. */
  weaponReward: STAT_PATHS.attack,
  /** The Defense shield, for the same reason. */
  armorReward: STAT_PATHS.defense,
  /** A banded ring under a set stone. The third slot has no stat of its own to borrow, so it gets the object itself — and now that gear draws its own silhouette (equipmentIcons.tsx), the object is that file's `ring`, so an Accessory Cache wears the shape of the ring it is about to hand over. */
  accessoryReward: EQUIP_FORM_PATHS.ring,
  /** The HP heart — the Vitality shrine grants max HP. */
  hpBoostReward: STAT_PATHS.hp,
  /** The Mana droplet. */
  manaBoostReward: STAT_PATHS.manaPool,
  /** The droplet with the rising chevron: MP Regen's own glyph, and this node grants MP Regen. */
  manaRegenBoostReward: STAT_PATHS.mpRegen,
  /** Open tome. The Mentor teaches a Class, and a book is the one object here that means "something is taught" without needing a human figure drawn at 20px. */
  classReward: OPEN_BOOK,
  /** A question mark, drawn rather than typed: the node is explicitly unknown, and every roguelike map has already taught the player this shape. */
  event: (
    <>
      <path d="M12 2.2c-3.7 0-6.4 2.4-6.6 6h4.2c.2-1.4 1.1-2.2 2.4-2.2 1.3 0 2.2.8 2.2 2 0 .9-.4 1.5-1.7 2.5-2 1.5-2.8 2.8-2.6 5.3h4.1c0-1.2.3-1.7 1.6-2.7 2-1.5 3-2.9 3-5 0-3.4-2.8-5.9-6.6-5.9Z" />
      <circle cx="12" cy="19.6" r="2.4" />
    </>
  ),
};

/**
 * The map's other three destinations: the footer signpost (Relics / Roster /
 * Reference). Same file as the node glyphs because they sit on the same
 * screen, three inches below them, and a second art style down there is
 * exactly the seam this pass exists to close — the Roster button was a
 * `ResourceMark` reading the literal characters "II", and the other two were
 * 18px cells of the pixel-art iconset.
 *
 * `relics` is the node table's own gem, unchanged: a Relic Shrine grants a
 * relic and this button lists the relics you hold, so it is one subject and
 * gets one shape.
 */
const HUB_PATHS = {
  relics: NODE_PATHS.relicReward,
  /**
   * Two figures, the second half-hidden behind the first — the roster is a
   * group, and a group needs a second head to say so. Deliberately NOT the
   * Skirmish helm, even though "a squad of heroes" is exactly what a roster
   * is: that helm is on screen at the same moment meaning "a squad you have
   * to fight", and one shape cannot be both sides of the battlefield.
   */
  roster: (
    <>
      <circle cx="16.6" cy="8.2" r="3.2" />
      <path d="M16.6 12.8c3.2 0 5.2 2 5.2 5v3.4h-4.4v-2.8c0-2.2-.9-4.2-2.4-5.5a5 5 0 0 1 1.6-.1Z" />
      <circle cx="9.2" cy="7.4" r="4" />
      <path d="M9.2 13c4.2 0 6.8 2.6 6.8 6.2v2H2.4v-2c0-3.6 2.6-6.2 6.8-6.2Z" />
    </>
  ),
  /**
   * A scroll: a body with two ruled lines, capped by a rolled rod at each end.
   * A book was the first choice and had to give way — the Mentor node is a
   * book, and the two would have sat on one screen meaning different things.
   * A scroll is the right one to lose the book to anyway: this button opens a
   * table you consult mid-run, not something you are taught once.
   */
  reference: (
    <>
      <rect x="3.4" y="2.4" width="17.2" height="3.4" rx="1.7" />
      <path fillRule="evenodd" d="M4.8 7.2h14.4v9.6H4.8Zm2.8 2.4v2h8.8v-2Zm0 4v2h6v-2Z" />
      <rect x="3.4" y="18.2" width="17.2" height="3.4" rx="1.7" />
    </>
  ),
  /**
   * Three bars — the same hamburger the fight screen's own Menu key wears as
   * a text glyph (`☰`, FightScreen.tsx). Deliberately identical in meaning
   * across the two screens: the pause menu is one idea, and a player who
   * learns it in a fight should recognise it on the map without reading the
   * label. Shares the scroll's x/width above so the two sit on one grid.
   */
  menu: (
    <>
      <rect x="3.4" y="4.6" width="17.2" height="3.2" rx="1.6" />
      <rect x="3.4" y="10.4" width="17.2" height="3.2" rx="1.6" />
      <rect x="3.4" y="16.2" width="17.2" height="3.2" rx="1.6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type HubGlyphName = keyof typeof HUB_PATHS;

/**
 * `aria-hidden` for the same reason StatGlyph and SectionGlyph are: the node's
 * own NODE_NAMES label sits directly under it, so naming the glyph too would
 * make a screen reader say "Fight" twice.
 */
export function NodeGlyph({ type, className }: { type: MapNodeType; className?: string }) {
  return (
    <svg
      className={`node-glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {NODE_PATHS[type]}
    </svg>
  );
}

/** Same contract as NodeGlyph, for the footer signpost — its label sits under it too. */
export function HubGlyph({ name, className }: { name: HubGlyphName; className?: string }) {
  return (
    <svg
      className={`node-glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {HUB_PATHS[name]}
    </svg>
  );
}
