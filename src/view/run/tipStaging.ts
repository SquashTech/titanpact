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
// live board rarely holds the example a page needs — a 2× and a ½× on one move.

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

export const TIP_STAGING: Readonly<Record<string, TipStaging>> = {
  // The third page is about the Switch key, which the lead pick does not show: its scene draws it.
  bench: { pages: [['.lead-pick-grid', '.lead-pick-panel .resolve-button'], ['.lead-pick-grid .squad-slot-matchups', '.team-row.enemy .combatant-card'], null] },
  item: { pages: [['.pick-card'], ['.item-who-sockets'], ['.item-who-sell']] },
  // The Story prologue's control tips (data/stories.ts cues): each lights the control it names on the live
  // board, or draws it (data/tipScenes.ts). The welcome lights nothing: it is the fight's title card.
  'story.welcome': {},
  'story.reading': {},
  'story.combo': { pages: [null, ['.order-track']] },
  'story.inspect': { pages: [['.team-row.enemy .combatant-card']] },
  'story.switch': { pages: [['.bottom-action-switch'], ['.team-row.ally .resource-row']] },
  'story.rest': { pages: [['.rest-move']] },
  'story.arrows': { pages: [['.move-list .move-seats'], ['.move-list .move-button']] },
  'story.bag': { pages: [['.bottom-action-bag'], null] },
};

/** The selectors page `index` lights, or none. */
export function pageSpotlight(staging: TipStaging | undefined, index: number): PageSpotlight {
  const pages = staging?.pages;
  if (!pages || pages.length === 0) return null;
  return pages[Math.min(index, pages.length - 1)] ?? null;
}
