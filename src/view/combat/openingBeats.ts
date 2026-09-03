// The beat a fight opens on. Presentation-only, and deliberately event-less: both leads
// are already on the board at first render, so there is nothing to replay. It exists to
// give the opening a moment of its own before the leads' entry passives land — without it
// the first thing a fight ever shows is a stat line already changed, with the passive that
// changed it never named. FightScreen plays this, then buildBeats' grouping of the real
// resolveBattleStartEntries events.

import type { CombatState, Side } from '../../engine/state';
import type { HeroDefinition } from '../../engine/content';
import type { LocationDefinition } from '../../data/locations';
import type { Beat } from './buildBeats';

/** "A" / "A and B" — the enemy leads in slot order. */
function joinNames(names: readonly string[]): string {
  if (names.length === 0) return 'The enemy';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function openingBeat(
  state: CombatState,
  heroes: Record<string, HeroDefinition>,
  enemySide: Side,
  location: LocationDefinition | null
): Beat {
  const names = state.active[enemySide]
    .filter((id): id is string => id !== null)
    .map((id) => heroes[state.combatants[id]?.heroId ?? '']?.name ?? id);
  const focus = joinNames(names);

  return {
    events: [],
    banner: `${focus} take the field!`,
    // No floating numbers: nothing has happened to anybody yet. The entry-passive beats behind
    // this one are where the cards get marked up.
    popups: [],
    // The place, not a name for the fight: the lead line is where the player already reads
    // context, and the arena behind it is this same Location's.
    bannerLead: location?.name ?? 'Battle',
    bannerFocus: focus,
    bannerTag: 'Battle begins',
    // No bannerFocusKind, and no accent when placeless: the beat then lands in the console's
    // own gold, which is already the "nobody is commanding" color of the resolving state.
    ...(location ? { bannerAccent: `rgb(${location.tintRgb})` } : null),
    engagement: true,
  };
}
