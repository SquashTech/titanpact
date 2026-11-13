// The Elite's affixes (docs/guild-hall-overhaul.md §4.1): what its whole side carries, read on the tile.
// `passiveId` goes on every enemy; `marks` gives each the Titan's Mark of its own primary type.

export interface EliteAffix {
  id: string;
  name: string;
  /** The consequence, on the tap card. */
  words: string;
  passiveId?: string;
  marks?: true;
}

export const ELITE_AFFIXES: readonly EliteAffix[] = [
  { id: 'warded', name: 'Warded', words: 'Each enters behind a Shield', passiveId: 'eliteWarded' },
  { id: 'swift', name: 'Swift', words: 'Each enters faster', passiveId: 'eliteSwift' },
  { id: 'vengeful', name: 'Vengeful', words: 'A knockout makes the rest stronger', passiveId: 'eliteVengeful' },
  { id: 'marked', name: 'Marked', words: 'Stronger every round each stands', marks: true },
];

/** Affixes by act, Act 1 first. */
export const ELITE_AFFIX_COUNT_BY_ACT: readonly number[] = [1, 1, 2, 2];
