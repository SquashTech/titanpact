// Which combatants get a DRAMATIC ENTRANCE — the veil, the shake, the horn
// and the music dropping a tone (styles.css `.dramatic-entrance-veil`,
// audio/sounds.ts `entrance.dread`, audio/music.ts `setMusicRate`).
//
// Presentation data, in the presentation layer, keyed by hero id — exactly the
// shape view/shared/heroArt.ts already uses for portraits, and for the same
// reason. The engine emits one `SwitchedIn` event for every arrival and has no
// opinion about which of them is a moment; deciding that is the view's job, and
// CLAUDE.md is explicit that timing, animation and sound never go near
// engine/content.ts. Nothing here is readable by combat resolution, which is
// the property worth keeping: a hero could be given or lose an entrance without
// a single number in a fight changing.
//
// One entry today: the Goblin Lord, held on the bench of Wild's Edge's Guardian
// fight so the first enemy KO is what brings him out (src/run/enemyGen.ts
// `appendFinalEnemy`). The treatment is deliberately scarce — it is the signal
// "this is not the fight you thought you were winning", and a second routine
// user would spend it.

/** Hero ids whose arrival on the battlefield is an event in its own right. */
export const DRAMATIC_ENTRANCE_HERO_IDS: ReadonlySet<string> = new Set(['goblinLord']);

/** Whether this hero id's arrival gets the treatment. Tolerates undefined so callers can pass a lookup straight through. */
export function hasDramaticEntrance(heroId: string | undefined): boolean {
  return heroId !== undefined && DRAMATIC_ENTRANCE_HERO_IDS.has(heroId);
}
