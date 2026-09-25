import type { ReactNode } from 'react';
import type { MapNodeType } from '../../run/map';
import { STAT_PATHS } from './statIcons';
import { SECTION_PATHS } from './sectionIcons';

// One glyph per map node type, 24x24, `currentColor` only. The grouping is the information:
// encounters say who you fight (the Titan's eye = Titanspawn, helm = recruitable heroes, skull =
// Guardian); stat/gear rewards reuse the exact glyph of what they grant; landmarks get authored
// shapes.

const CLAW_GASH = <path d="M12 5C15.4 9.4 17 14.4 16.4 19.6 12.4 15.2 10.6 10.2 12 5Z" />;

// A stoppered phial about the origin — what leaks from the Titan: stopper, neck, round body. Three
// solid pieces, so it holds as a silhouette at 16px. It was the Ichor node's mark; the node retired
// with Mastery phase 2 (docs/mastery.md §4) and the phial stays as XP's glyph (RunGlyph RESOURCE_PATHS.xp).
const PHIAL = (
  <>
    <rect x="-2.4" y="-10.4" width="4.8" height="2.6" rx="0.9" />
    <rect x="-1.7" y="-8" width="3.4" height="3.6" />
    <circle cx="0" cy="3.6" r="6" />
  </>
);

/** The one phial, centred in the 24-box, as the XP resource. */
export const XP_PHIAL = <g transform="translate(12 12.4) scale(0.95)">{PHIAL}</g>;

// Three gashes fanned about a pivot below the box, leaned right as a group. Off the map since the
// Titanspawn took the Monsters tiles; kept for the dossier's "Enemies" row (HUB_PATHS.foe).
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

// The Titan's eye: the same lens TitanWakeScreen and the title open on, tapering to points at
// both corners, with the slit pupil cut out of it. What the Titanspawn are — a leak from the thing
// that is watching — rather than a claw, which said only "monster". The lens runs nearly edge to
// edge so it holds at 16px on the rail; the slit is a hole, not a stroke, so it stays dark on any
// disc.
const TITAN_EYE = (
  <path
    fillRule="evenodd"
    d="M1.4 12C4.2 6.4 7.9 3.6 12 3.6s7.8 2.8 10.6 8.4C19.8 17.6 16.1 20.4 12 20.4S4.2 17.6 1.4 12Zm10.6-5.2c-1.7 0-2.6 2.1-2.6 5.2s.9 5.2 2.6 5.2 2.6-2.1 2.6-5.2-.9-5.2-2.6-5.2Z"
  />
);

// The Elite's crown, drawn where it sits on the helm below; HUB_PATHS.crown centres it.
const CROWN = <path d="M4.6 2.2 8 5.6l4-3.4 4 3.4 3.4-3.4-1 5.4H5.6Z" />;

// Great-helm, drawn once in sectionIcons: the recruitable tile and the Compendium's Recruitable page.
const HELM = SECTION_PATHS.recruit;

// The Mastery Scroll (the Scribe, the Cache, the shelf) — drawn once, in sectionIcons.
const SCROLL = SECTION_PATHS.mastery;

const OPEN_BOOK = (
  <>
    <path d="M11 6.4C8.8 4.4 5.8 3.4 2.2 3.6v13.2c3.6-.2 6.6.8 8.8 2.8Z" />
    <path d="M13 6.4c2.2-2 5.2-3 8.8-2.8v13.2c-3.6-.2-6.6.8-8.8 2.8Z" />
  </>
);

// Anvil on its stump: the Forge tile and the Guild Hall's Anvil service wear one glyph.
const ANVIL = (
  <>
    <path d="M2 6.6h9.6c1.6 2.6 4 4.2 7.2 4.8l3.2-3.4v4.4c0 2.4-1.6 4-4.4 4.6H8.2C4.8 16.4 2.6 14 2 10.6Z" />
    <path d="M9.4 18h6.2l2.2 4H7.2Z" />
  </>
);

// Exported so the run HUD can wear the exact glyph of the node that pays it out (RunGlyph.tsx).
export const NODE_PATHS: Record<MapNodeType, ReactNode> = {
  fight: TITAN_EYE,
  skirmish: HELM,
  // Same spawn pool as `fight`, same glyph.
  battle: TITAN_EYE,
  // Crowned helm; the crown floats clear of the dome or the two merge.
  elite: (
    <>
      {CROWN}
      <g transform="translate(12 23.4) scale(0.82) translate(-12 -20.6)">{HELM}</g>
    </>
  ),
  // Horned skull — the only face on the map. Only ever drawn on the large Guardian plate, where holes hold.
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
  // Guild Hall: roof over an arched doorway.
  shop: (
    <>
      <path d="M12 2.2 22.6 9.4H1.4Z" />
      <path fillRule="evenodd" d="M3.4 11.2h17.2v10.6H3.4Zm8.6 2.8a3.2 3.2 0 0 0-3.2 3.2v4.6h6.4v-4.6a3.2 3.2 0 0 0-3.2-3.2Z" />
    </>
  ),
  equipmentReward: SECTION_PATHS.equipment,
  // The Scroll Cache: a bundle of three, seen end-on — three coils stacked, since the count is
  // the mark once map labels are gone (three pips against the Scribe's two each).
  scrollReward: (
    <path d="M12 1.9a5.9 5.9 0 1 1 0 11.8 5.9 5.9 0 0 1 0-11.8Zm-4.9 8.6a5.9 5.9 0 1 1 0 11.8 5.9 5.9 0 0 1 0-11.8Zm9.8 0a5.9 5.9 0 1 1 0 11.8 5.9 5.9 0 0 1 0-11.8ZM12 5.7a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm-4.9 8.6a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm9.8 0a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Z" />
  ),
  // The Passives section mark, for the node that hands one over — same rule.
  passiveReward: SECTION_PATHS.passives,
  // Money bag.
  currencyReward: (
    <>
      <path d="M8.6 2.6h6.8a1 1 0 0 1 .8 1.6l-1.4 2H9.2l-1.4-2a1 1 0 0 1 .8-1.6Z" />
      <path d="M9 7.8h6c3.6 1.9 5.8 5.2 5.8 8.6 0 3.2-2.4 5.2-6 5.2h-5.6c-3.6 0-6-2-6-5.2 0-3.4 2.2-6.7 5.8-8.6Z" />
    </>
  ),
  // The Mana stat's own drop: a stat reward reuses the exact glyph of what it grants.
  manaWellReward: STAT_PATHS.manaPool,
  // The Smithy's anvil, back on a tile (it was the Forge node's before item slots went): one free lift.
  forgeReward: ANVIL,
  // A ley line: a single bolt of power rising through the ground, the Force chip's arrow said large.
  leyLineReward: (
    <>
      <path d="M13.6 1.6 5.2 13.2h5.2L9.2 22.4l9.6-12.6h-5.4Z" />
      <path d="M2.4 20.2h19.2v2.4H2.4Z" opacity="0.55" />
    </>
  ),
  // A campfire: one flame over two crossed logs. The Rest is the place, not the stat it refills.
  restReward: (
    <>
      <path d="M12 .8c2.8 3.2 6 5.6 6 9.8a6 6 0 0 1-12 0c0-2 .7-3.7 1.8-5.1.2 1.9 1.2 3.1 2.6 3.5-.7-3.5.1-6 1.6-8.2Z" />
      <path d="m3.2 15.4 17.6 5.2-.7 2.2L2.5 17.6Zm17.6 0 .7 2.2L3.9 22.8l-.7-2.2Z" />
    </>
  ),
  // Open tome: the Mentor teaches.
  mentorReward: OPEN_BOOK,
  // A rolled scroll, its two curls the thing that survives 20px: the Scribe hands out Mastery
  // Scrolls, and the Guild Hall shelf sells the same glyph (RunGlyph RESOURCE_PATHS scroll).
  scribeReward: SCROLL,
  // A branching skill tree, not a second book: the Mentor hands over something new, the Tutor
  // opens a door the hero was already standing in front of.
  tutorReward: (
    <>
      <path d="M10.9 12.2h2.2v6.4h-2.2Z" />
      <path d="M5.6 11.2h12.8v2.2H5.6Z" />
      <path d="M5.6 7.4h2.2v5.6H5.6Z" />
      <path d="M16.2 7.4h2.2v5.6h-2.2Z" />
      <circle cx="12" cy="20.4" r="2.9" />
      <circle cx="6.7" cy="5.4" r="2.9" />
      <circle cx="17.3" cy="5.4" r="2.9" />
    </>
  ),
  // Question mark, drawn rather than typed.
  event: (
    <>
      <path d="M12 2.2c-3.7 0-6.4 2.4-6.6 6h4.2c.2-1.4 1.1-2.2 2.4-2.2 1.3 0 2.2.8 2.2 2 0 .9-.4 1.5-1.7 2.5-2 1.5-2.8 2.8-2.6 5.3h4.1c0-1.2.3-1.7 1.6-2.7 2-1.5 3-2.9 3-5 0-3.4-2.8-5.9-6.6-5.9Z" />
      <circle cx="12" cy="19.6" r="2.4" />
    </>
  ),
  // The Vigil: a brazier kept lit through the last night before the Threshold.
  muster: (
    <>
      <path d="M12 1.8c2.2 2.7 3.3 4.7 3.3 6.2a3.3 3.3 0 0 1-6.6 0c0-1.5 1.1-3.5 3.3-6.2Z" />
      <path d="M4.4 11.4h15.2l-2.2 7.2H6.6Z" />
      <path d="M11 18.6h2v2.2h-2Z" />
      <path d="M7 20.6h10v1.6H7Z" />
    </>
  ),
  // A broken ring, split top and bottom by what came through it. The only glyph on the
  // map that is not a thing you fight or take — it is the seal itself, failing.
  finale: (
    <path
      fillRule="evenodd"
      d="M12 2.2a9.8 9.8 0 1 1 0 19.6 9.8 9.8 0 0 1 0-19.6Zm0 3.6a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4ZM14.6 1.2 8.2 11.4h3.4L9.4 22.8l6.4-11.2h-3.4Z"
    />
  ),
};

// The map's own controls: the footer's one Roster button, plus Reference and Menu in the header corners.
const HUB_PATHS = {
  // Two figures. Not the Skirmish helm: that means "a squad you fight" on the same screen.
  roster: SECTION_PATHS.heroes,
  // Scroll (the Mentor node already owns the book).
  reference: (
    <>
      <rect x="3.4" y="2.4" width="17.2" height="3.4" rx="1.7" />
      <path fillRule="evenodd" d="M4.8 7.2h14.4v9.6H4.8Zm2.8 2.4v2h8.8v-2Zm0 4v2h6v-2Z" />
      <rect x="3.4" y="18.2" width="17.2" height="3.4" rx="1.7" />
    </>
  ),
  // The bag, on the Roster sheet's tray (2026-09-10, per user direction — it was a 🎒 emoji, the
  // last one left on the screen and the only mark on it drawn in a different hand from everything
  // else). A bevelled PIECE sitting on a tray, not a satchel: three satchels were drawn first and
  // every one of them read as an anvil or a padlock at 16px, where a 24-unit grid gives 0.67px a
  // unit and a flap seam is under a pixel. This says what the panel holds rather than what it is,
  // in the exact silhouette the pieces below it are cut to (styles.css .item-piece).
  bag: (
    <>
      <path
        fillRule="evenodd"
        d="M8.4 1.8h7.6l3 3v7.6l-3 3H8.4l-3-3V4.8Zm1 2.4-1.6 1.6v5.6l1.6 1.6h5.6l1.6-1.6V5.8l-1.6-1.6Z"
      />
      <path d="M4.6 16.4h14.8l2.6 5.8H2Z" />
    </>
  ),
  // Same hamburger as FightScreen's `☰` Menu key.
  menu: (
    <>
      <rect x="3.4" y="4.6" width="17.2" height="3.2" rx="1.6" />
      <rect x="3.4" y="10.4" width="17.2" height="3.2" rx="1.6" />
      <rect x="3.4" y="16.2" width="17.2" height="3.2" rx="1.6" />
    </>
  ),
  // The Compendium. Same open tome as the Mentor node above, deliberately: both are the book
  // you read to learn what a hero is. They never share a screen — the Mentor is a map tile, the
  // Compendium a title-screen and squad-select corner — so one picture is the rule, not a clash.
  codex: OPEN_BOOK,
// Leaving the run: an archway, drawn as the opening rather than as the slab that fills it.
  // A door-and-jamb was drawn first and is a bar beside a box below 22px — the 3-unit jamb and
  // its gap both land under a pixel there. This survives because it is ONE object whose hole is
  // a third of its own width.
  door: (
    <path fillRule="evenodd" d="M3.4 21.8V10.2a8.6 8.6 0 0 1 17.2 0v11.6Zm4.4-3.4h8.4v-8.2a4.2 4.2 0 0 0-8.4 0Z" />
  ),
  // Abandoning a run, erasing a profile. The two slots are what separate a bin from a cup.
  discard: (
    <>
      <path d="M9 1.8h6a1.1 1.1 0 0 1 1.1 1.1v1.3H7.9V2.9A1.1 1.1 0 0 1 9 1.8Z" />
      <rect x="3" y="5.4" width="18" height="3.1" rx="1.55" />
      <path
        fillRule="evenodd"
        d="M5.4 10.1h13.2l-1.1 10.4a1.9 1.9 0 0 1-1.9 1.7H8.4a1.9 1.9 0 0 1-1.9-1.7Zm3.7 2.5v7.4h2.1v-7.4Zm3.7 0v7.4h2.1v-7.4Z"
      />
    </>
  ),
  // The confirming state of the two above — the same button, one press from doing it.
  warn: (
    <path fillRule="evenodd" d="M12 2 22.9 21.6H1.1Zm-1.2 6.8v6.6h2.4V8.8Zm0 8.4v2.5h2.4v-2.5Z" />
  ),
  sound: (
    <>
      <path d="M11.6 3 6.3 7.9H2.6v8.2h3.7l5.3 4.9Z" />
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M15.4 8.7a4.7 4.7 0 0 1 0 6.6" />
        <path d="M18.6 5.7a9.1 9.1 0 0 1 0 12.6" />
      </g>
    </>
  ),
  mute: (
    <>
      <path d="M11.6 3 6.3 7.9H2.6v8.2h3.7l5.3 4.9Z" />
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="m15.6 9.4 5.8 5.2" />
        <path d="m21.4 9.4-5.8 5.2" />
      </g>
    </>
  ),
  // Records, drawn once in sectionIcons: the title hub's tile and the Records sheet's page.
  trophy: SECTION_PATHS.records,
  // A slot a hero has not unlocked. Shackle in open stroke, body filled, keyway cut out.
  lock: (
    <>
      <path fill="none" stroke="currentColor" strokeWidth="2.6" d="M7.6 10.2V7.4a4.4 4.4 0 0 1 8.8 0v2.8" />
      <path
        fillRule="evenodd"
        d="M4.6 10.6h14.8v11.2H4.6Zm7.4 3a1.9 1.9 0 0 0-1.1 3.5v2.1h2.2v-2.1A1.9 1.9 0 0 0 12 13.6Z"
      />
    </>
  ),
/**
   * Item slots — an open hand, which is what the Forge node has always called them ("Another
   * Hand Free"). Two `.item-piece` silhouettes side by side were drawn first, one filled and one
   * hollow, and they are two dots below 22px: a 24-unit box cannot hold two objects and still
   * give either one a readable chamfer. Capacity is not gear, so the glyph is the hand rather
   * than the chest the Guild Hall's shelf wears.
   */
  hand: (
    <path d="M5 13.4V7.2a1.9 1.9 0 0 1 3.8 0v2.2h.6V3.8a1.9 1.9 0 0 1 3.8 0v5.6h.6V4.6a1.9 1.9 0 0 1 3.8 0v4.8h.6V7.4a1.9 1.9 0 0 1 3.8 0v6.6c0 4.6-3.2 7.8-7.6 7.8-2.5 0-4.4-1-6-3.1l-4-5.2a1.9 1.9 0 0 1 2.9-2.4Z" />
  ),
  // The enemy side of a ledger row, whatever it fields — the claw the Monsters tile used to wear.
  foe: CLAW,
  // The Elite's crown on its own, for the badge over a tile whose face is its enemy typing.
  crown: <g transform="translate(12 12) scale(1.4) translate(-12 -4.9)">{CROWN}</g>,
  // A hero's Class. A fluted column — the discipline they were taught in, not a thing they carry.
  // The Guild Hall's Anvil service, the Forge tile's own glyph.
  anvil: ANVIL,
  hall: (
    <>
      <path d="M3.4 2.2h17.2v3.2H3.4Z" />
      <path fillRule="evenodd" d="M6.6 6.6h10.8v11.2H6.6Zm2.3 2.1v7h1.8v-7Zm4.2 0v7h1.8v-7Z" />
      <path d="M2.6 19h18.8v2.8H2.6Z" />
    </>
  ),
  // A five-point star, the Evolution star's shape: the title's shop tile, where stars are spent.
  star: (
    <path d="M12 1.8l3.1 6.5 7.1 1-5.2 5 1.3 7.1L12 18l-6.3 3.4 1.3-7.1-5.2-5 7.1-1Z" />
  ),
} satisfies Record<string, ReactNode>;

export type HubGlyphName = keyof typeof HUB_PATHS;

/** `aria-hidden`: the node's NODE_NAMES label sits directly under it. */
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
