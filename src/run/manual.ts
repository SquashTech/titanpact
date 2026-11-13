// The Rules (docs/the-sky.md §2c): mechanism only, every word in src/data/howToPlay.ts. The book is
// always whole: every page is readable from the start.

import type { Tip } from './tips';

export interface ManualPage extends Tip {
  /** The chapter it sits in (MANUAL_CHAPTERS); unset, a page about a run. */
  lesson?: string;
  /**
   * What the page's tile wears, one or two marks the view draws: `node:<map node>`, `status:<id>`,
   * `kind:<move kind>`, `stat:<stat>`, `resource:<run resource>`, `arrow:super|resist`,
   * `type:<type>`, `field:<field>`, `passive:<id>`, `glyph:<drawn mark>`.
   */
  emblem: readonly string[];
}

