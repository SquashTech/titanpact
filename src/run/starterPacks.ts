// Deck presets (docs/collection.md §2), the Starter Packs they grew out of: a list of heroes a
// preset stands in their rows' starter slots in one tap (run/deck.ts `applyPreset`). A preset
// equips nothing and gates nothing — the deck it produces is one the player could build by hand.
// Presets are content (src/data/starterPacks.ts); this file is the shape.

export const BASE_PACK_ID = 'base';

export interface StarterPack {
  id: string;
  name: string;
  /** At most one hero a draftable type: each goes into its row's starter slot. */
  heroIds: readonly string[];
  /** `base` is the default deck's starters; `recut` stands other base heroes in their place. */
  kind: 'base' | 'recut';
}
