// What the map's one footer button calls itself, given what is waiting behind it.
//
// A badge alone is a mark the eye learns to skip; a button that has changed its mind about what
// it is called cannot be. `unopened` is an INBOX — it empties by being attended to — never a
// stock figure, or the label would never go back to saying "Roster".

interface FooterWaiting {
  label: string;
  /** Zero means the button is at rest and wears no mark. */
  total: number;
  aria: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function footerWaiting(unopened: number): FooterWaiting {
  if (unopened === 0) return { label: 'Roster', total: 0, aria: 'Roster' };
  return {
    label: plural(unopened, 'New Item', 'New Items'),
    total: unopened,
    aria: `${plural(unopened, 'unopened item', 'unopened items')} in your bag`,
  };
}
