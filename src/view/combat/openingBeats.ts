// The beat a fight opens on. Presentation-only, and deliberately event-less: both leads
// are already on the board at first render, so there is nothing to replay. It exists to
// give the opening a moment of its own before the leads' entry passives land — without it
// the first thing a fight ever shows is a stat line already changed, with the passive that
// changed it never named. FightScreen plays this, then buildBeats' grouping of the real
// resolveBattleStartEntries events.

import { effectiveTypes } from '../../engine/state';
import type { CombatState, Side } from '../../engine/state';
import type { HeroDefinition } from '../../engine/content';
import type { LocationDefinition } from '../../data/locations';
import type { Beat, BeatRosterEntry } from './buildBeats';
import { getTypeTextColor } from './typeColors';

/** "A" / "A and B" — the enemy leads in slot order. For the log line only. */
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
  const roster: BeatRosterEntry[] = state.active[enemySide]
    .filter((id): id is string => id !== null)
    .map((id) => {
      const combatant = state.combatants[id];
      const hero = heroes[combatant?.heroId ?? ''];
      if (!hero) return { name: id, colors: [] };
      // effectiveTypes, not hero.types — a type-graft Evolution retints the card, so it
      // retints the name the fight is called on. Two at most: a third color in one word
      // is a smear, not a read.
      const colors = [...new Set(effectiveTypes(hero, combatant).map(getTypeTextColor))].slice(0, 2);
      return { name: hero.name, colors };
    });

  return {
    events: [],
    banner: `${joinNames(roster.map((r) => r.name))} take the field!`,
    // No floating numbers: nothing has happened to anybody yet. The entry-passive beats behind
    // this one are where the cards get marked up.
    popups: [],
    // A roster, not a sentence. Two names joined by "and" at headline size wrapped inside the
    // console and broke across a name; here the name is the unit, so the name is the line.
    // No lead line above the VS: the Location's name sat there and read as a combatant —
    // "Wild's Edge VS Goblin Warrior". The arena already says where this is.
    bannerRoster: roster.length > 0 ? roster : [{ name: 'The enemy', colors: [] }],
    bannerTag: 'Battle begins',
    // No bannerFocusKind, and no accent when placeless: the beat then lands in the console's
    // own gold, which is already the "nobody is commanding" color of the resolving state.
    ...(location ? { bannerAccent: `rgb(${location.tintRgb})` } : null),
    engagement: true,
  };
}
