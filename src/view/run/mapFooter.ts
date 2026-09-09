// What the map's one footer button calls itself, given what is waiting behind it.
//
// Its own file because it is the whole of the argument against splitting that button into Gear
// and Gems (2026-09-09, per user direction): the split existed to say which kind is waiting, and
// a label that renames itself says that without a second door — and without either door lying
// about the hero sheets and the terminate that also live back there.

interface FooterWaiting {
  label: string;
  /** Both kinds, summed. Zero means the button is at rest and wears no mark. */
  total: number;
  aria: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * `unopened` is bag items never looked at; `newGems` is stones granted since the Gems board was
 * last opened. Both are INBOXES — they empty by being attended to. Neither is a stock figure: the
 * unspent Gem pool is routinely non-zero (a stat at cap, a stone being banked) and a label wired
 * to it would never go back to saying "Roster", which is the same as never saying anything.
 */
export function footerWaiting(unopened: number, newGems: number): FooterWaiting {
  const total = unopened + newGems;
  if (total === 0) return { label: 'Roster', total: 0, aria: 'Roster' };

  // Both waiting is the crowded case, so each half drops to its noun and the counts carry it.
  const label =
    unopened > 0 && newGems > 0
      ? `${unopened} ${unopened === 1 ? 'Item' : 'Items'} · ${newGems} ${newGems === 1 ? 'Gem' : 'Gems'}`
      : unopened > 0
        ? `${plural(unopened, 'New Item', 'New Items')}`
        : `${plural(newGems, 'New Gem', 'New Gems')}`;

  const parts: string[] = [];
  if (unopened > 0) parts.push(`${plural(unopened, 'unopened item', 'unopened items')} in your bag`);
  if (newGems > 0) parts.push(`${plural(newGems, 'new Gem', 'new Gems')} to set`);
  return { label, total, aria: parts.join(', ') };
}
