// The Camp's doors (docs/guild-hall-overhaul.md §10): each a bundle of rewards the game already has.
// One door is always a Mend bundle; the other two are drawn, distinct, from CAMP_BUNDLES.

import type { CampBundle } from '../run/camp';

/** The Mend door: a whole roster and a small rider, so healing is the light door. */
export const MEND_BUNDLES: readonly CampBundle[] = [
  { id: 'mendGem', pieces: [{ kind: 'mend' }, { kind: 'gems', take: 1, of: 3 }] },
  { id: 'mendBlessing', pieces: [{ kind: 'mend' }, { kind: 'blessing' }] },
];

/** The fallback Mend door, when neither rider has anyone to take it. */
export const PLAIN_MEND: CampBundle = { id: 'mend', pieces: [{ kind: 'mend' }] };

/** The other two doors, each about one full reward. */
export const CAMP_BUNDLES: readonly CampBundle[] = [
  { id: 'gems', pieces: [{ kind: 'gems', take: 3, of: 5 }] },
  { id: 'gear', pieces: [{ kind: 'gear', take: 2, of: 4 }] },
  { id: 'itemGems', pieces: [{ kind: 'gear', take: 1, of: 3 }, { kind: 'gems', take: 2, of: 4 }] },
  { id: 'itemBlessing', pieces: [{ kind: 'gear', take: 1, of: 3 }, { kind: 'blessing' }] },
  { id: 'gemsBoon', pieces: [{ kind: 'gems', take: 2, of: 4 }, { kind: 'boon' }] },
];
