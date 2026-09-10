import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import {
  MAX_MASTERY_RANK,
  MOVE_CAP,
  SCROLLS_PER_RANK,
  canSpendScroll,
  grantOfferedMove,
  masteryRank,
  recordMoveOffer,
  rosterEntryTypes,
  scrollMovePool,
  scrollsToNextRank,
  spendMasteryScroll,
} from '../../run/progression';
import { playSfx } from '../../audio/sfx';
import { getTypeColor } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { ResourceGlyph } from '../shared/RunGlyph';
import { TypeBadge } from '../shared/TypeBadge';
import { useLongPress } from '../shared/MoveTile';
import { MoveOfferOverlay } from './MoveOfferOverlay';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onInspect: (entry: RosterEntry, hero: HeroDefinition) => void;
}

/** The offer a spend has raised. The Scroll is already gone; only the move is still a question. */
interface ScrollOffer {
  rosterId: string;
  moveId: string;
  /** Read off the PRE-spend entry, so the line can say what the spend just did. */
  rankedUp: boolean;
}

/**
 * What the row says instead of its progress line. A dry band below the cap is NOT a block — the
 * Scroll still buys the tick that opens the next band — so it gets a note, not the inert style.
 */
function poolNote(entry: RosterEntry): string | null {
  if (scrollMovePool(progressionTable, moves, entry).length > 0) return null;
  return masteryRank(entry) >= MAX_MASTERY_RANK ? 'Nothing left to teach' : 'Band is dry — a Scroll buys the rank only';
}

/** Finished: max rank and no move left. The only state a Scroll cannot buy anything in. */
function isFinished(entry: RosterEntry): boolean {
  return masteryRank(entry) >= MAX_MASTERY_RANK && scrollMovePool(progressionTable, moves, entry).length === 0;
}

/**
 * Six pips, one per Scroll it takes to max a hero. The bar is the whole readout: rank is what the
 * pips have crossed, and the next threshold is where the gap is. Drawn rather than written because
 * "Rank 2, 1 to go" is two numbers for one fact.
 */
function RankPips({ spent }: { spent: number }) {
  const total = (MAX_MASTERY_RANK - 1) * SCROLLS_PER_RANK;
  return (
    <span className="mastery-pips" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`mastery-pip${i < spent ? ' is-filled' : ''}${(i + 1) % SCROLLS_PER_RANK === 0 && i + 1 < total ? ' is-threshold' : ''}`}
        />
      ))}
    </span>
  );
}

/**
 * Where Mastery Scrolls are poured (docs/growth-overhaul.md §4). One row a hero, because the row
 * has to carry the four moves the hero already holds — the whole question a Scroll asks is "is
 * there room, and for what", and that is unreadable on a half-width card.
 *
 * The purse is at the foot, in thumb reach, like the Gear board's bag. **Six rows plus the purse
 * have to fit the panel without scrolling** — six is ROSTER_CAP, so that is the board's worst
 * case, and it is the budget anything added to a row comes out of.
 */
export function MasteryBoard({ run, onRunChange, onInspect }: Props) {
  const [offer, setOffer] = useState<ScrollOffer | null>(null);

  const offerEntry = offer ? (run.roster.find((r) => r.rosterId === offer.rosterId) ?? null) : null;

  function spend(entry: RosterEntry) {
    if (!canSpendScroll(progressionTable, moves, run, entry)) return;
    // Tick first, roll after: the third Scroll into a hero is the one that opens Mid, so the
    // move it offers is already from the band it just unlocked.
    const spent = spendMasteryScroll(run, entry.rosterId);
    const ranked = spent.roster.find((r) => r.rosterId === entry.rosterId)!;
    const rankedUp = masteryRank(ranked) > masteryRank(entry);
    playSfx('scroll.spend', { pitch: rankedUp ? 1.18 : 1 });

    // A dry band below the cap: the Scroll buys the tick and there is no move to put in front of
    // anyone. No overlay — the row's own pips are the whole of what changed.
    const pool = scrollMovePool(progressionTable, moves, entry);
    if (pool.length === 0) {
      onRunChange(spent);
      return;
    }

    const moveId = pool[Math.floor(Math.random() * pool.length)];
    // The offer is spent by being MADE — declining still burns it (docs/leveling-and-ranks.md).
    onRunChange(recordMoveOffer(spent, entry.rosterId, [moveId]));
    setOffer({ rosterId: entry.rosterId, moveId, rankedUp });
  }

  function resolve(replaceMoveId: string | null, learn: boolean) {
    if (!offer) return;
    if (learn) onRunChange(grantOfferedMove(run, offer.rosterId, offer.moveId, replaceMoveId ?? undefined));
    setOffer(null);
  }

  return (
    <div className="mastery-board">
      <div className="mastery-hero-list">
        {run.roster.map((entry) => {
          const hero = heroes[entry.heroId];
          return (
            <MasteryRow
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              rank={masteryRank(entry)}
              canSpend={canSpendScroll(progressionTable, moves, run, entry)}
              note={poolNote(entry)}
              finished={isFinished(entry)}
              onSpend={() => spend(entry)}
              onInspect={() => onInspect(entry, hero)}
            />
          );
        })}
      </div>

      {/* At the foot, like the Gear board's bag, and for the same reason it moved here
          (2026-09-10, per user direction): a full roster of six is the cap, and with the tray at
          the top the board could not show all six without scrolling. A count and a word — the
          instruction it used to carry was costing a hero row to say what a tap says. */}
      <div className="mastery-purse">
        <span className="mastery-purse-glyph">
          <ResourceGlyph kind="scroll" />
        </span>
        <span className="mastery-purse-label">
          {run.masteryScrolls === 1 ? 'Mastery Scroll' : 'Mastery Scrolls'}
        </span>
        <span className="mastery-purse-count">{run.masteryScrolls}</span>
      </div>

      {offer && offerEntry && (
        <MoveOfferOverlay
          run={run}
          entry={offerEntry}
          moveId={offer.moveId}
          eyebrow={
            offer.rankedUp
              ? `Rank ${masteryRank(offerEntry)} — a deeper band opens`
              : `Rank ${masteryRank(offerEntry)}${scrollsToNextRank(offerEntry) > 0 ? ` — ${scrollsToNextRank(offerEntry)} to the next` : ''}`
          }
          onResolve={resolve}
        />
      )}
    </div>
  );
}

interface RowProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  rank: number;
  canSpend: boolean;
  /**
   * The ONLY line a row still carries, and only when the band has nothing left in it. Everything
   * else it used to say — how many Scrolls to the next rank, that the kit is full, that the hero
   * is maxed — was already drawn: the pips are the rank bar, and four filled chips are a full kit.
   * A dry band is the one state nothing on the row can show, so it is the one that gets words.
   */
  note: string | null;
  finished: boolean;
  onSpend: () => void;
  onInspect: () => void;
}

function MasteryRow({ hero, entry, rank, canSpend, note, finished, onSpend, onInspect }: RowProps) {
  const press = useLongPress(onInspect, canSpend ? onSpend : undefined);

  return (
    <div
      className={`mastery-hero-row${canSpend ? ' can-take' : ''}${finished ? ' is-inert' : ''}`}
      style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
      {...press}
    >
      <div className="mastery-hero-head">
        <HeroPortrait heroId={hero.id} className="mastery-hero-portrait" />
        <span className="mastery-hero-ident">
          <span className="mastery-hero-name">{hero.name}</span>
          <span className="roster-card-types">
            {rosterEntryTypes(hero, entry).map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </span>
        </span>
        <span className={`mastery-hero-rank${rank >= MAX_MASTERY_RANK ? ' is-max' : ''}`}>
          <span className="mastery-rank-num">Rank {rank}</span>
          <RankPips spent={Math.min(entry.masteryScrollsSpent, (MAX_MASTERY_RANK - 1) * SCROLLS_PER_RANK)} />
        </span>
      </div>

      {/* The four slots, filled or not: the Scroll's second question is whether there is room. */}
      <div className="mastery-move-row">
        {Array.from({ length: MOVE_CAP }, (_, i) => {
          const moveId = entry.unlockedMoveIds[i];
          const move = moveId ? moves[moveId] : null;
          return (
            <span
              key={i}
              className={`mastery-move-chip${move ? '' : ' is-empty'}`}
              style={move ? { '--chip-color': getTypeColor(move.type) } as React.CSSProperties : undefined}
            >
              {move ? move.name : ''}
            </span>
          );
        })}
      </div>

      {note && <span className="mastery-hero-note">{note}</span>}
    </div>
  );
}
