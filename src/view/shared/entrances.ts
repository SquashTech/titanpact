// Enemy ids that are their fight's hidden card: silhouette-only in scouting (SquadSelectScreen) AND a
// staged arrival (buildBeats, FightScreen, `entrance.dread`). One entry for both halves on purpose —
// concealing without a reveal, or revealing something already read, is worse than neither.
// Presentation data only; the engine never reads it. Kept scarce: the six Guardian champions and the
// Endbringer, so a run sees exactly one an act and a routine bench pivot never spends it.

import { ELDER_BOUGH_ID, ENDBRINGER_ID, MANTICORE_ID, DRAGON_ID, KRAKEN_ID, ROC_ID, SERAPH_ID, SKELETON_KING_ID, SPHINX_ID, WENDIGO_ID, YUGZULACH_ID, LEFT_EYE_ID, RIGHT_EYE_ID } from '../../data/enemies';

/** Arrival copy for the reveal beat: the lead is the room noticing, the meta is what follows it. */
export interface DramaticEntrance {
  lead: string;
  meta: string;
}

/**
 * Per champion rather than one shared line: the Manticore's treeline is Wild's Edge, and the same
 * sentence under the Molten Foundry reads as a bug in the copy. Coverage is guarded by
 * `test/entrances.test.ts` — a champion authored without an entrance is a silent miss otherwise.
 */
const DRAMATIC_ENTRANCES: Readonly<Record<string, DramaticEntrance>> = {
  [MANTICORE_ID]: { lead: 'Something comes out of the treeline', meta: 'The ground goes quiet.' },
  [YUGZULACH_ID]: { lead: 'The altars answer', meta: 'The chanting stops all at once.' },
  [ELDER_BOUGH_ID]: { lead: 'The forest stands up', meta: 'Every path closes behind it.' },
  [DRAGON_ID]: { lead: 'Something climbs out of the furnace', meta: 'The heat turns to face you.' },
  [KRAKEN_ID]: { lead: 'The shallows go out', meta: 'Whatever took the water is still coming.' },
  [SKELETON_KING_ID]: { lead: 'The city gets to its feet', meta: 'Its citizens are watching.' },
  [SERAPH_ID]: { lead: 'The light comes down', meta: 'Nothing in the sanctum casts a shadow now.' },
  [SPHINX_ID]: { lead: 'The riddle stands up', meta: 'It has been waiting for you to get it wrong.' },
  [ROC_ID]: { lead: 'The sky folds its wings', meta: 'The thunder was never the storm.' },
  [WENDIGO_ID]: { lead: 'Something comes over the ice', meta: 'It is thinner than the cold should allow.' },
  [ENDBRINGER_ID]: { lead: 'The last seal gives', meta: 'It was never in a hurry.' },
  // The Titan's Eyes (docs/titan-eyes.md §2, §10): the pair open, wide, as the Herald falls.
  [LEFT_EYE_ID]: { lead: 'The Titan looks down', meta: 'One eye fixes on the field.' },
  [RIGHT_EYE_ID]: { lead: 'The other eye opens', meta: 'Nowhere to look but away.' },
};

/**
 * The one arrival that stops the fight for a scene (docs/titan-eyes.md §10): the Titan rising as
 * the Herald falls, played over the field before the first Eye's own reveal beat. Keyed on the Left
 * Eye alone — it is the first body of its phase to enter, and the Right Eye's reveal follows it.
 */
export type CinematicEntrance = 'titanRise';

const CINEMATIC_ENTRANCES: Readonly<Record<string, CinematicEntrance>> = {
  [LEFT_EYE_ID]: 'titanRise',
};

export function cinematicEntranceFor(heroId: string | undefined): CinematicEntrance | null {
  return heroId === undefined ? null : CINEMATIC_ENTRANCES[heroId] ?? null;
}

export function hasDramaticEntrance(heroId: string | undefined): boolean {
  return heroId !== undefined && heroId in DRAMATIC_ENTRANCES;
}

export function dramaticEntranceFor(heroId: string | undefined): DramaticEntrance | null {
  return heroId === undefined ? null : DRAMATIC_ENTRANCES[heroId] ?? null;
}
