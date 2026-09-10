// What the map's one footer button calls itself, given what is waiting behind it.
//
// A badge alone is a mark the eye learns to skip; a button that has changed its mind about what
// it is called cannot be. Both figures are INBOXES — each empties by being attended to — never
// stock figures, or the label would never go back to saying "Roster".

interface FooterWaiting {
  label: string;
  /** Zero means the button is at rest and wears no mark. */
  total: number;
  /** Which inbox the count is of — the button colours and marks itself differently for each. */
  kind: 'rest' | 'items' | 'merges';
  aria: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * `merges` is the count of mergeable PAIRS in the bag (2026-09-10, per user direction). It ranks
 * under unopened gear rather than beside it: an unopened item may be the best thing in the run and
 * has to be read, while a merge is a free tier that will still be free next node. One label, in
 * that order — a button saying two things at once is a button saying neither.
 */
export function footerWaiting(unopened: number, merges = 0): FooterWaiting {
  if (unopened > 0) {
    return {
      label: plural(unopened, 'New Item', 'New Items'),
      total: unopened,
      kind: 'items',
      aria: `${plural(unopened, 'unopened item', 'unopened items')} in your inventory`,
    };
  }
  if (merges > 0) {
    return {
      // Counted even at one, so the label and the badge beside it never state different figures.
      label: `${plural(merges, 'Merge', 'Merges')} Ready`,
      total: merges,
      kind: 'merges',
      aria: `${plural(merges, 'pair', 'pairs')} in your inventory can merge`,
    };
  }
  return { label: 'Roster', total: 0, kind: 'rest', aria: 'Roster' };
}
