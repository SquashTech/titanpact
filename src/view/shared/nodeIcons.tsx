import type { ReactNode } from 'react';
import type { MapNodeType } from '../../run/map';
import { STAT_PATHS } from './statIcons';
import { SECTION_PATHS } from './sectionIcons';
import { EQUIP_FORM_PATHS } from './equipmentIcons';
import { GEM } from './relicIcons';

// One glyph per map node type, 24x24, `currentColor` only. The grouping is the information:
// encounters say who you fight (claw = monsters, helm = recruitable heroes, skull = Guardian);
// stat/gear rewards reuse the exact glyph of what they grant; landmarks get authored shapes.

const CLAW_GASH = <path d="M12 5C15.4 9.4 17 14.4 16.4 19.6 12.4 15.2 10.6 10.2 12 5Z" />;

// Three gashes fanned about a pivot below the box, leaned right as a group.
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

// Great-helm; the eye slit is two pieces so a nose bridge keeps the dome attached.
const HELM = (
  <path
    fillRule="evenodd"
    d="M12 2.4c-4.9 0-8 3.4-8 8.4v4.4c0 3.4 1.2 6.2 2.6 6.2h10.8c1.4 0 2.6-2.8 2.6-6.2v-4.4c0-5-3.1-8.4-8-8.4ZM6 10.6h4.6V14H6Zm7.4 0H18V14h-4.6Z"
  />
);

const OPEN_BOOK = (
  <>
    <path d="M11 6.4C8.8 4.4 5.8 3.4 2.2 3.6v13.2c3.6-.2 6.6.8 8.8 2.8Z" />
    <path d="M13 6.4c2.2-2 5.2-3 8.8-2.8v13.2c-3.6-.2-6.6.8-8.8 2.8Z" />
  </>
);

// Exported so the run HUD can wear the exact glyph of the node that pays it out (RunGlyph.tsx).
export const NODE_PATHS: Record<MapNodeType, ReactNode> = {
  fight: CLAW,
  skirmish: HELM,
  // Same monster pool as `fight`, same glyph.
  battle: CLAW,
  // Crowned helm; the crown floats clear of the dome or the two merge.
  elite: (
    <>
      <path d="M4.6 2.2 8 5.6l4-3.4 4 3.4 3.4-3.4-1 5.4H5.6Z" />
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
  // Cut gem.
  relicReward: <path d="M7.4 3.2h9.2l4.8 5.8L12 21.2 2.6 9Z" />,
  // The Gem's own cut (relicIcons.tsx) — one picture per concept, the same rule gold and XP follow.
  gemReward: GEM,
  // Money bag.
  currencyReward: (
    <>
      <path d="M8.6 2.6h6.8a1 1 0 0 1 .8 1.6l-1.4 2H9.2l-1.4-2a1 1 0 0 1 .8-1.6Z" />
      <path d="M9 7.8h6c3.6 1.9 5.8 5.2 5.8 8.6 0 3.2-2.4 5.2-6 5.2h-5.6c-3.6 0-6-2-6-5.2 0-3.4 2.2-6.7 5.8-8.6Z" />
    </>
  ),
  // One arrow off a plinth (not the Buffs pair — XP only goes up).
  upgradeReward: (
    <>
      <path d="M12 2 20.6 12h-5v5.4H8.4V12h-5Z" />
      <path d="M6.4 19.4h11.2v2.6H6.4Z" />
    </>
  ),
  weaponReward: STAT_PATHS.attack,
  armorReward: STAT_PATHS.defense,
  accessoryReward: EQUIP_FORM_PATHS.ring,
  hpBoostReward: STAT_PATHS.hp,
  manaBoostReward: STAT_PATHS.manaPool,
  manaRegenBoostReward: STAT_PATHS.mpRegen,
  // Open tome: the Mentor teaches.
  classReward: OPEN_BOOK,
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

// The map footer signpost (Relics / Roster / Reference / Menu).
const HUB_PATHS = {
  relics: NODE_PATHS.relicReward,
  // Two figures. Not the Skirmish helm: that means "a squad you fight" on the same screen.
  roster: (
    <>
      <circle cx="16.6" cy="8.2" r="3.2" />
      <path d="M16.6 12.8c3.2 0 5.2 2 5.2 5v3.4h-4.4v-2.8c0-2.2-.9-4.2-2.4-5.5a5 5 0 0 1 1.6-.1Z" />
      <circle cx="9.2" cy="7.4" r="4" />
      <path d="M9.2 13c4.2 0 6.8 2.6 6.8 6.2v2H2.4v-2c0-3.6 2.6-6.2 6.8-6.2Z" />
    </>
  ),
  // Scroll (the Mentor node already owns the book).
  reference: (
    <>
      <rect x="3.4" y="2.4" width="17.2" height="3.4" rx="1.7" />
      <path fillRule="evenodd" d="M4.8 7.2h14.4v9.6H4.8Zm2.8 2.4v2h8.8v-2Zm0 4v2h6v-2Z" />
      <rect x="3.4" y="18.2" width="17.2" height="3.4" rx="1.7" />
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
