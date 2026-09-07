// Enemy ids that are their fight's hidden card: silhouette-only in scouting (SquadSelectScreen) AND a
// staged arrival (buildBeats, FightScreen, `entrance.dread`). One entry for both halves on purpose —
// concealing without a reveal, or revealing something already read, is worse than neither.
// Presentation data only; the engine never reads it. Kept scarce: the six Guardian champions and the
// Endbringer, so a run sees exactly one an act and a routine bench pivot never spends it.

import { ELDER_BOUGH_ID, ENDBRINGER_ID, GOBLIN_LORD_ID, LAVA_BEAST_ID, LEVIATHAN_ID, SKELETON_KING_ID, YUGZULACH_ID } from '../../data/enemies';

/** Arrival copy for the reveal beat: the lead is the room noticing, the meta is what follows it. */
export interface DramaticEntrance {
  lead: string;
  meta: string;
}

/**
 * Per champion rather than one shared line: the Goblin Lord's treeline is Wild's Edge, and the same
 * sentence under the Molten Foundry reads as a bug in the copy. Coverage is guarded by
 * `test/entrances.test.ts` — a champion authored without an entrance is a silent miss otherwise.
 */
const DRAMATIC_ENTRANCES: Readonly<Record<string, DramaticEntrance>> = {
  [GOBLIN_LORD_ID]: { lead: 'Something comes out of the treeline', meta: 'The ground goes quiet.' },
  [YUGZULACH_ID]: { lead: 'The altars answer', meta: 'The chanting stops all at once.' },
  [ELDER_BOUGH_ID]: { lead: 'The forest stands up', meta: 'Every path closes behind it.' },
  [LAVA_BEAST_ID]: { lead: 'Something climbs out of the furnace', meta: 'The heat turns to face you.' },
  [LEVIATHAN_ID]: { lead: 'The shallows go out', meta: 'Whatever took the water is still coming.' },
  [SKELETON_KING_ID]: { lead: 'The city gets to its feet', meta: 'Its citizens are watching.' },
  [ENDBRINGER_ID]: { lead: 'The last seal gives', meta: 'It was never in a hurry.' },
};

export function hasDramaticEntrance(heroId: string | undefined): boolean {
  return heroId !== undefined && heroId in DRAMATIC_ENTRANCES;
}

export function dramaticEntranceFor(heroId: string | undefined): DramaticEntrance | null {
  return heroId === undefined ? null : DRAMATIC_ENTRANCES[heroId] ?? null;
}
