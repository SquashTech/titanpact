// How each first-time tip sits over its screen (docs/tutorial.md "Staging"). Presentation only, so
// it lives in the view tier beside TipOverlay, keyed by tip id, and never in the tip content
// (src/data/tips.ts), which stays plain words.
//
// A tip that names a thing on screen should POINT at it: the named thing stays lit and outlined
// while everything else dims, and the card moves off it. A page's spotlight is a list of CSS
// selectors; every element each one matches is lit (so `.move-button .mana-gem` lights the Mana
// on every move at once). A selector that matches nothing lights nothing, and the card falls back
// to the middle — a spotlight is emphasis, never a precondition.

/** One page's staging: the selectors to light, or null for none. */
export type PageSpotlight = readonly string[] | null;

export interface TipStaging {
  /** Per page, in page order. A page past the end of the list takes the last entry. */
  pages?: readonly PageSpotlight[];
  /**
   * Where the card sits. Omitted, it goes wherever covers the least of what is lit (the middle
   * when nothing is). `low` pins it to the bottom, for a screen whose subject is its middle.
   */
  placement?: 'low';
}

// The fight screen's own anatomy, named once so the table below reads as prose.
const ALLY_CARDS = '.team-row.ally .combatant-card';
const ENEMY_CARDS = '.team-row.enemy .combatant-card';
const ALLY_MP_BARS = '.team-row.ally .resource + .resource';
const MOVES = '.move-list';
const MOVE_MANA = '.move-button .mana-gem';
const MOVE_MATCHUPS = '.move-button .move-eff-chip';
const MOVE_TYPE = '.move-button .move-type-code';
const MOVE_KIND = '.move-button .move-kind-badge';
const MOVE_NAMES = '.move-button:not(.rest-button):not(.flask-button) .move-name';
const ORDER_TRACK = '.order-track';
const SWITCH = '.bottom-action-switch';
const REST = ['.bottom-action-rest', '.rest-button'];
const BAG = '.bottom-action-bag';
const ANCIENT_ENEMY = `${ENEMY_CARDS}[data-types~="Ancient"]`;

export const TIP_STAGING: Readonly<Record<string, TipStaging>> = {
  // --- Screens ---
  // The four starters along the bottom are the whole of the draft's first verb.
  draft: { pages: [['.draft-rail']] },
  // The act's arrival is the place itself — keep the card off it.
  run: { placement: 'low' },

  // --- Fights ---
  'fight.basics': {
    pages: [[MOVES, ORDER_TRACK], [MOVE_MANA, ALLY_MP_BARS], [ENEMY_CARDS, ALLY_CARDS, MOVE_NAMES]],
  },
  'fight.skirmish': { pages: [[ENEMY_CARDS]] },
  'fight.switching': { pages: [[SWITCH], [ALLY_CARDS, SWITCH], null] },
  'fight.types': { pages: [[MOVE_MATCHUPS], [MOVE_TYPE], [MOVE_KIND]] },
  'fight.rest': { pages: [REST] },
  'fight.ancient': { pages: [[ANCIENT_ENEMY], [MOVE_MATCHUPS], [ANCIENT_ENEMY]] },
  'fight.bag': { pages: [[BAG]] },
  'fight.knockout': { pages: [[`${ALLY_CARDS}.fainted`]] },
  'fight.field': { pages: [['.field-effect-badge']] },
};

/** The selectors page `index` lights, or none. */
export function pageSpotlight(staging: TipStaging | undefined, index: number): PageSpotlight {
  const pages = staging?.pages;
  if (!pages || pages.length === 0) return null;
  return pages[Math.min(index, pages.length - 1)] ?? null;
}
