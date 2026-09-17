import { bracketEffect, REST_PRIORITY_BRACKET, SWITCH_PRIORITY_BRACKET } from '../../engine/combat/priority';

/** One combatant's place in the round's resolve order, worn on its card (CombatantCard `order`). */
export interface OrderMark {
  /** 1-based; tied entries share the first of their ranks, so two "1"s IS the tie. */
  rank: number;
  tied: boolean;
  /** The bracket the entry sits in — null for a move whose bracket is rolled at resolution. */
  priority: number | null;
  /** Where the bracket actually moved the entry against Speed (priority.ts bracketEffect). */
  effect: 'cut' | 'held' | null;
  /** Playback only: where the round's playback stands against this entry. Absent while commanding. */
  phase?: 'done' | 'current' | 'pending';
}

export interface OrderSource {
  combatantId: string;
  priority: number | null;
  speed: number;
  tiedWithPrevious: boolean;
  phase?: 'done' | 'current' | 'pending';
}

/** The marks for a whole order, keyed by combatant. */
export function orderMarksFor(entries: readonly OrderSource[], reversedSpeed: boolean): Record<string, OrderMark> {
  const marks: Record<string, OrderMark> = {};
  let rank = 1;
  entries.forEach((entry, i) => {
    if (!entry.tiedWithPrevious) rank = i + 1;
    marks[entry.combatantId] = {
      rank,
      tied: entry.tiedWithPrevious || entries[i + 1]?.tiedWithPrevious === true,
      priority: entry.priority,
      effect: bracketEffect(entries, i, reversedSpeed),
      phase: entry.phase,
    };
  });
  return marks;
}

/** What a non-zero bracket is shown as on the mark: the sign and size, or the verb that has no number. */
export function bracketPip(priority: number | null): string | null {
  if (priority === null) return '?';
  if (priority === SWITCH_PRIORITY_BRACKET) return '⇄';
  if (priority === REST_PRIORITY_BRACKET) return '☾';
  if (priority === 0) return null;
  return priority > 0 ? `+${priority}` : `${priority}`;
}
