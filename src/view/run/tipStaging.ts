// How each first-time tip sits over its screen (docs/tutorial.md "Staging"). Presentation only, so
// it lives in the view tier beside TipOverlay, keyed by tip id, and never in the tip content
// (src/data/tips.ts), which stays plain words.
//
// A tip that names a thing on screen should POINT at it: the named thing stays lit and outlined
// while everything else dims, and the card moves off it. A page's spotlight is a list of CSS
// selectors; every element each one matches is lit (so `.move-button .mana-gem` lights the Mana
// on every move at once). A selector that matches nothing lights nothing, and the card falls back
// to the middle — a spotlight is emphasis, never a precondition.
//
// Fight tips are not staged here: they show a drawn scene instead (src/data/tipScenes.ts), since a
// live board rarely holds the example a page needs — a 2× and a ½× on one move, all four kinds.

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

// Shared screen parts: the map's nodes ahead, and the hero cards every pick-a-hero screen uses.
const MAP_CHOICES = '.map-choice';
const PICK_CARDS = '.pick-card';

export const TIP_STAGING: Readonly<Record<string, TipStaging>> = {
  // The four starters along the bottom are the whole of the draft's first verb.
  draft: { pages: [['.draft-rail']] },
  // The act's arrival is the place itself — keep the card off it.
  run: { placement: 'low' },
  map: { pages: [[MAP_CHOICES], ['.map-rail'], [MAP_CHOICES]] },
  wounds: { pages: [['.map-party-chip .wound-bar']] },
  fork: { pages: [['.map-choice[data-node-type="elite"]']] },
  squad: { pages: [['.lead-pick-grid', '.lead-pick-panel .resolve-button'], ['.lead-pick-grid .squad-slot-matchups', '.team-row.enemy .combatant-card']] },
  item: { pages: [[PICK_CARDS], ['.item-who-sockets'], ['.item-who-sell']] },
  fallen: { pages: [[PICK_CARDS]] },
  scribe: { pages: [['.gem-hand', PICK_CARDS], ['.scroll-screen .mastery-pips']] },
  shop: {
    pages: [['.hall-sign[data-tab="tavern"]', '.hall-good'], ['.hall-sign[data-tab="gems"]'], ['.hall-sign[data-tab="gear"]']],
  },
  recruit: { pages: [['.recruit-sign', '.recruit-contracts'], null] },
  banner: { pages: [['.relic-pick-row']] },
  academy: { pages: [['.academy-class-list'], ['.academy-students']] },
  locationChoice: { pages: [['.location-choice-domains', '.location-choice-domains-all']] },
};

/** The selectors page `index` lights, or none. */
export function pageSpotlight(staging: TipStaging | undefined, index: number): PageSpotlight {
  const pages = staging?.pages;
  if (!pages || pages.length === 0) return null;
  return pages[Math.min(index, pages.length - 1)] ?? null;
}
