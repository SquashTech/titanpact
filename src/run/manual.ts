// How to Play (docs/the-sky.md §2c): mechanism only, every word in src/data/howToPlay.ts. The book is
// always whole: every page is readable from the start, and a lesson opens on its own.

import type { Tip } from './tips';

export interface ManualPage extends Tip {
  /** The First Light lesson that teaches it, by scenario id; unset, a page about a run. */
  lesson?: string;
  /**
   * What the page's tile wears, one or two marks the view draws: `node:<map node>`, `status:<id>`,
   * `kind:<move kind>`, `stat:<stat>`, `resource:<run resource>`, `arrow:super|resist`,
   * `type:<type>`, `field:<field>`, `passive:<id>`, `glyph:<drawn mark>`.
   */
  emblem: readonly string[];
  /** A lesson page that names what its fight showed: it opens over the Learned screen once the fight is won, not before the first tap. */
  afterFight?: true;
}

/** A lesson's pages, in book order. */
export function lessonPages(pages: readonly ManualPage[], scenarioId: string): ManualPage[] {
  return pages.filter((p) => p.lesson === scenarioId);
}
