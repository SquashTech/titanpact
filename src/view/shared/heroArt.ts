import cinderKnightArt from '../../../art/cinderknight.png';

/** Hero portraits (art/<file>.png), keyed by hero id. Most heroes have none yet — CombatantCard falls back to the text-only card when a hero's id isn't here. */
export const heroArt: Partial<Record<string, string>> = {
  cinderKnight: cinderKnightArt,
};
