import { HeroPortrait } from '../shared/HeroPortrait';
import { bracketPip, type OrderMark } from './orderMarks';

export interface OrderTrackEntry {
  combatantId: string;
  heroId: string;
  /** Which zone the fighter stands in — the tick under its sprite takes that zone's tint. */
  side: 'enemy' | 'ally';
  mark: OrderMark;
}

interface Props {
  /** First to last. Empty, the track draws nothing and the horizon's "VS" stands. */
  entries: readonly OrderTrackEntry[];
  /** Tapping a sprite — the game says the order in words (FightScreen's field note). Absent, the track is inert. */
  onInspect?: (combatantId: string) => void;
}

/**
 * The round's resolve order, laid on the horizon (2026-09-24, per user direction): the four
 * fighters as half-size sprites, first to last, left to right. It replaced a numbered coin on
 * each figure, which asked the eye to find four numbers in four corners and sort them; a line of
 * faces is read in one pass. It is not a plaque — no box, no fill — so it sits ON the horizon the
 * way the skyline does: each sprite stands on a short tick in its side's zone tint, a tie is a
 * gold "=" between the two it joins, and a bracket hangs its pip over the sprite it moved.
 */
export function OrderTrack({ entries, onInspect }: Props) {
  if (entries.length === 0) return null;
  return (
    <div className="order-track" role="list" aria-label="Turn order">
      {entries.map((entry, i) => {
        const { mark } = entry;
        const pip = bracketPip(mark.priority);
        const tiedToPrevious = i > 0 && mark.tied && entries[i - 1].mark.tied && entries[i - 1].mark.rank === mark.rank;
        return (
          <span key={entry.combatantId} className="order-track-step" role="listitem">
            {tiedToPrevious && (
              <span className="order-track-tie" aria-hidden="true">
                =
              </span>
            )}
            <span
              className={[
                'order-track-slot',
                `is-${entry.side}`,
                mark.effect ? `is-${mark.effect}` : '',
                mark.phase ? `is-${mark.phase}` : '',
                onInspect ? 'is-tappable' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role={onInspect ? 'button' : undefined}
              aria-label={`${mark.rank}${['st', 'nd', 'rd'][mark.rank - 1] ?? 'th'}${mark.tied ? ', tied' : ''}`}
              onClick={onInspect ? () => onInspect(entry.combatantId) : undefined}
            >
              <HeroPortrait heroId={entry.heroId} seed={entry.combatantId} className="order-track-sprite" />
              {pip !== null && <span className="order-track-pip">{pip}</span>}
            </span>
          </span>
        );
      })}
    </div>
  );
}
