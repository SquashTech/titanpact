// How to Play as a manual the player fills (docs/the-sky.md §2c): mechanism only. Every word lives
// in src/data/howToPlay.ts. A lesson's pages are learned by winning the lesson, derived from the lit
// star; every other page is FILED the first time a run meets it (`Profile.manualPages`) and waits in
// `Profile.manualUnshown` until the next won fight's Learned row shows it.

import type { CombatEvent } from '../engine/events';
import type { CombatState, Side } from '../engine/state';
import { isLockedIn } from '../engine/state';
import type { Profile } from './profile';
import type { Tip } from './tips';

const PLAYER: Side = 'A';

/** What files a run's page: a status landing, something a fight did, or a screen first reached. */
export type ManualTrigger =
  | { kind: 'status'; statusId: string }
  | { kind: 'fight'; what: 'lockIn' | 'pactClock' | 'field' | 'ancient' | 'stage' | 'heal' }
  | { kind: 'screen'; screen: string };

export type ManualSource = { kind: 'lesson'; scenarioId: string } | { kind: 'run'; met: ManualTrigger };

export interface ManualPage extends Tip {
  source: ManualSource;
  /**
   * What the page's tile wears, one or two marks the view draws: `node:<map node>`, `status:<id>`,
   * `kind:<move kind>`, `stat:<stat>`, `resource:<run resource>`, `arrow:super|resist`,
   * `type:<type>`, `field:<field>`, `glyph:<drawn mark>`.
   */
  emblem: readonly string[];
}

/** Whether this page is in the player's book. An account that played before the manual has every page. */
export function isPageLearned(profile: Profile, page: ManualPage): boolean {
  if (profile.manualComplete) return true;
  return page.source.kind === 'lesson' ? profile.litStars.includes(page.source.scenarioId) : profile.manualPages.includes(page.id);
}

/** A lesson's pages, in book order. */
export function lessonPages(pages: readonly ManualPage[], scenarioId: string): ManualPage[] {
  return pages.filter((p) => p.source.kind === 'lesson' && p.source.scenarioId === scenarioId);
}

/** Files run pages not yet in the book, each waiting for its Learned row. A lesson's page is never filed here. */
export function fileRunPages(profile: Profile, pages: readonly ManualPage[], ids: readonly string[]): Profile {
  const fresh = ids.filter((id, i) => ids.indexOf(id) === i).filter((id) => {
    const page = pages.find((p) => p.id === id);
    return page && page.source.kind === 'run' && !isPageLearned(profile, page);
  });
  if (fresh.length === 0) return profile;
  return { ...profile, manualPages: [...profile.manualPages, ...fresh], manualUnshown: [...profile.manualUnshown, ...fresh] };
}

/** The Learned row has shown these. */
export function markPagesShown(profile: Profile, ids: readonly string[]): Profile {
  if (!ids.some((id) => profile.manualUnshown.includes(id))) return profile;
  return { ...profile, manualUnshown: profile.manualUnshown.filter((id) => !ids.includes(id)) };
}

/** The run pages a screen files when it is first reached. */
export function pagesMetOnScreen(pages: readonly ManualPage[], screen: string): string[] {
  return pages.filter((p) => p.source.kind === 'run' && p.source.met.kind === 'screen' && p.source.met.screen === screen).map((p) => p.id);
}

/**
 * The run pages a stretch of a fight meets: a status landing on anyone, a Field Effect set, a stat raised or lowered a step, a heal. `typesOf`
 * reads a combatant's typing for the Ancient page; the board after the stretch says whether a side
 * is locked in or an Ancient stands in it.
 */
export function pagesMetInFight(
  pages: readonly ManualPage[],
  events: readonly CombatEvent[],
  board: CombatState,
  typesOf: (combatantId: string) => readonly string[]
): string[] {
  const statusIds = new Set(events.flatMap((e) => (e.type === 'StatusApplied' ? [e.statusId] : [])));
  const fieldSet = events.some((e) => e.type === 'FieldEffectSet');
  const staged = events.some((e) => e.type === 'StatChanged' && e.stages && e.delta !== 0);
  const healed = events.some((e) => e.type === 'Healed');
  // Lock-in is the player's to meet: their side can't switch while a hero still waits on its bench.
  const lockedIn = isLockedIn(board, PLAYER) && board.bench[PLAYER].some((id) => !board.combatants[id]?.fainted);
  const clock = events.some((e) => e.type === 'PactTicked');
  const ancient = Object.keys(board.combatants).some((id) => typesOf(id).includes('Ancient'));
  return pages
    .filter((p) => {
      if (p.source.kind !== 'run') return false;
      const trigger = p.source.met;
      if (trigger.kind === 'status') return statusIds.has(trigger.statusId);
      if (trigger.kind !== 'fight') return false;
      if (trigger.what === 'field') return fieldSet;
      if (trigger.what === 'stage') return staged;
      if (trigger.what === 'heal') return healed;
      if (trigger.what === 'lockIn') return lockedIn;
      if (trigger.what === 'pactClock') return clock;
      return ancient;
    })
    .map((p) => p.id);
}
