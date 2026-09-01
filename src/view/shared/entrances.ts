// Hero ids that are the fight's hidden card: silhouette-only in scouting (SquadSelectScreen) AND a
// staged arrival (buildBeats, FightScreen, `entrance.dread`). One flag for both halves on purpose —
// concealing without a reveal, or revealing something already read, is worse than neither.
// Presentation data only; the engine never reads it. Kept scarce: a routine second user spends it.

export const DRAMATIC_ENTRANCE_HERO_IDS: ReadonlySet<string> = new Set(['goblinLord']);

export function hasDramaticEntrance(heroId: string | undefined): boolean {
  return heroId !== undefined && DRAMATIC_ENTRANCE_HERO_IDS.has(heroId);
}
