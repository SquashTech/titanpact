import { bracketEffect, REST_PRIORITY_BRACKET, SWITCH_PRIORITY_BRACKET } from '../../engine/combat/priority';

/** One combatant's place in the round's resolve order, laid on the horizon's track (OrderTrack). */
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

/** The one thing a tapped hero's number cannot carry, or nothing: a bracket, a switch, a Rest, a roll. */
function bracketClause(heroName: string, mark: OrderMark): string | null {
  if (mark.priority === SWITCH_PRIORITY_BRACKET) return `${heroName} is switching out, which always goes first.`;
  if (mark.priority === REST_PRIORITY_BRACKET) return `${heroName} is resting, which always goes last.`;
  if (mark.priority === null) return `${heroName}'s priority is rolled when the round plays.`;
  if (mark.effect === 'cut') return `${heroName}'s priority move cuts ahead of faster fighters.`;
  if (mark.effect === 'held') return `${heroName}'s move has low priority, so it waits behind slower fighters.`;
  return null;
}

/**
 * What the game says when a sprite on the order track is tapped: the whole round's order, first to last — the
 * sequence the ribbon of portraits used to show, in words — with a tie said as the coin flip it
 * is, then the one thing about the tapped hero that its number cannot carry, when there is one.
 * `ordered` is the order as the marks were built from, first to last.
 */
export function describeOrder(ordered: readonly { combatantId: string; name: string; mark: OrderMark }[], tappedId: string): string {
  const groups: { rank: number; names: string[] }[] = [];
  for (const { name, mark } of ordered) {
    const last = groups[groups.length - 1];
    if (last && mark.tied && mark.rank === last.rank) last.names.push(name);
    else groups.push({ rank: mark.rank, names: [name] });
  }
  const sequence = groups.map((g) => (g.names.length > 1 ? `${g.names.join(' or ')} (a coin flip)` : g.names[0])).join(', then ') + '.';
  const tapped = ordered.find((o) => o.combatantId === tappedId);
  const clause = tapped ? bracketClause(tapped.name, tapped.mark) : null;
  return clause ? `${sequence} ${clause}` : sequence;
}

/** What a non-zero bracket is shown as over the track's sprite: the sign and size, or the verb that has no number. */
export function bracketPip(priority: number | null): string | null {
  if (priority === null) return '?';
  if (priority === SWITCH_PRIORITY_BRACKET) return '⇄';
  if (priority === REST_PRIORITY_BRACKET) return '☾';
  if (priority === 0) return null;
  return priority > 0 ? `+${priority}` : `${priority}`;
}
