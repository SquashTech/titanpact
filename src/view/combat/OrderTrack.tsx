import { HeroPortrait } from '../shared/HeroPortrait';
import { bracketPip, type OrderMark } from './orderMarks';

export interface OrderTrackEntry {
  combatantId: string;
  heroId: string;
  /** Which zone the fighter stands in — its frame takes that zone's tint. */
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
 * The round's resolve order, across the top of the arena (2026-09-24, per user direction): the
 * four fighters first to last, left to right, each framed in a small portrait of its side's colour
 * (the enemy's red, the ally's blue) and joined by chevrons, so the track says it is a SEQUENCE
 * before a single face is read. It replaced a numbered coin on each figure, which asked the eye
 * to find four numbers in four corners and sort them. A tie takes a gold "=" where the chevron
 * would be — the RNG decides, and the track says so rather than picking one — and a bracket sits ON
 * the rail as a small tag just before the frame it moved. Nothing on the
 * track rises above its frames: it sits against the arena's top edge, and a pip hung over a frame
 * or a frame scaled up for its turn was clipped there on a phone (2026-09-25).
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
            {i > 0 &&
              (tiedToPrevious ? (
                <span className="order-track-tie" aria-hidden="true">
                  =
                </span>
              ) : (
                <svg className="order-track-arrow" viewBox="0 0 6 10" aria-hidden="true" focusable="false">
                  <path d="M1 1l4 4-4 4" />
                </svg>
              ))}
            {pip !== null && <span className={`order-track-pip${mark.effect ? ` is-${mark.effect}` : ''}`}>{pip}</span>}
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
              <span className="order-track-frame">
                <HeroPortrait heroId={entry.heroId} seed={entry.combatantId} className="order-track-sprite" />
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
