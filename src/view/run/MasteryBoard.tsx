import { useEffect, useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import {
  EVOLUTION_RUNG,
  MAX_MASTERY_RANK,
  MOVE_CAP,
  RANK_THRESHOLDS,
  RUNGS_TO_MAX_RANK,
  applyEvolutionMoves,
  availableEvolution,
  canSpendScroll,
  chooseEvolutionPath,
  grantOfferedMove,
  masteryMovePool,
  masteryRank,
  masteryRung,
  nextScrollCost,
  recordMoveOffer,
  rosterEntryTypes,
  scrollMovePool,
  rungsToNextRank,
  spendMasteryScroll,
  type EvolutionNode,
} from '../../run/progression';
import { ResourceGlyph } from '../shared/RunGlyph';
import { playSfx } from '../../audio/sfx';
import { moveForHero } from '../../engine/state';
import { getTypeColor } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { useLongPress } from '../shared/MoveTile';
import { MoveLearnedOverlay, MoveOfferOverlay } from './MoveOfferOverlay';

/** How long the row drinks the Scrolls before the move is put in front of the player (styles.css mastery-pour). */
const POUR_MS = 760;

/**
 * What a spend has raised. The Scrolls are already gone. Below the cap the move is already
 * LEARNED and the box only says so; at the cap it is still a question — which of the four goes.
 */
interface ScrollOffer {
  rosterId: string;
  moveId: string;
  /** Read off the PRE-spend entry, so the line can say what the spend just did. */
  rankedUp: boolean;
  learned: boolean;
}

/** The Evolution rung, waiting on the player. */
interface Evolving {
  rosterId: string;
  node: EvolutionNode;
}

/** A path's granted move the four-move cap refused, offered as a replace-or-decline. */
interface Overflow {
  rosterId: string;
  queue: string[];
}

/**
 * The state of one pour, owned by the screen rather than the board because the Evolution is a
 * whole screen of its own (docs/growth-overhaul.md §11): the EVOLUTION_RUNG into a hero raises it
 * for that hero, and its move grant's overflow is offered. The Evolution IS that rung's whole
 * payoff (2026-09-11, per user direction) — no move offer rolls behind it.
 */
export interface PourFlow {
  /** The row mid-pour. Nothing else on the board takes a tap until it has finished drinking. */
  pouring: string | null;
  /** The move that landed on the pouring row, so its chip can arrive rather than appear. */
  landing: { rosterId: string; moveId: string } | null;
  offer: ScrollOffer | null;
  evolving: Evolving | null;
  overflow: Overflow | null;
  spend: (entry: RosterEntry) => void;
  resolveOffer: (replaceMoveId: string | null, learn: boolean) => void;
  closeOffer: () => void;
  chooseEvolution: (pathId: string) => void;
  resolveOverflow: (replaceMoveId: string | null, learn: boolean) => void;
}

export function useScrollPour(run: RunState, onRunChange: (next: RunState) => void): PourFlow {
  const [offer, setOffer] = useState<ScrollOffer | null>(null);
  const [pouring, setPouring] = useState<string | null>(null);
  const [landing, setLanding] = useState<{ rosterId: string; moveId: string } | null>(null);
  const [evolving, setEvolving] = useState<Evolving | null>(null);
  const [overflow, setOverflow] = useState<Overflow | null>(null);

  useEffect(() => {
    if (!pouring) return;
    const timer = window.setTimeout(() => setPouring(null), POUR_MS);
    return () => window.clearTimeout(timer);
  }, [pouring]);

  /**
   * The rung's offer, rolled off `next` — the run AFTER the spend. A dry band buys the tick
   * and nothing is put in front of anyone: the row's own pips are the whole of what changed.
   */
  function rollOffer(next: RunState, rosterId: string, rankedUp: boolean, delay: number) {
    const current = next.roster.find((r) => r.rosterId === rosterId)!;
    const pool = masteryMovePool(progressionTable, moves, current);
    if (pool.length === 0) {
      onRunChange(next);
      return;
    }
    const moveId = pool[Math.floor(Math.random() * pool.length)];
    // The offer is spent by being MADE — declining still burns it (docs/leveling-and-ranks.md).
    next = recordMoveOffer(next, rosterId, [moveId]);
    // Room in the kit: the move simply lands (2026-09-10, per user direction). "Learn or decline"
    // was a question with one sane answer, and the chip filling on the row while it pours is the
    // payoff — the box after only names what it was. At the cap the question is real, and it is
    // still asked.
    const learned = current.unlockedMoveIds.length < MOVE_CAP;
    if (learned) {
      next = grantOfferedMove(next, rosterId, moveId);
      setLanding({ rosterId, moveId });
    }
    onRunChange(next);
    window.setTimeout(() => setOffer({ rosterId, moveId, rankedUp, learned }), delay);
  }

  function spend(entry: RosterEntry) {
    if (pouring || !canSpendScroll(progressionTable, moves, run, entry)) return;
    // Tick first, roll after: the rung that reaches a rank is the one that opens it, so the
    // move it offers is already from the band it just unlocked.
    const next = spendMasteryScroll(run, entry.rosterId);
    const ranked = next.roster.find((r) => r.rosterId === entry.rosterId)!;
    const rankedUp = masteryRank(ranked) > masteryRank(entry);
    playSfx('scroll.spend', { pitch: rankedUp ? 1.18 : 1 });
    setPouring(entry.rosterId);

    // The Evolution rung: the pour lands, then the hero's Evolution screen rises in place of an
    // offer — the Evolution is what this rung bought.
    const node = availableEvolution(progressionTable, ranked);
    if (node && node.paths.length > 0) {
      onRunChange(next);
      window.setTimeout(() => setEvolving({ rosterId: entry.rosterId, node }), POUR_MS);
      return;
    }
    rollOffer(next, entry.rosterId, rankedUp, POUR_MS);
  }

  function resolveOffer(replaceMoveId: string | null, learn: boolean) {
    if (!offer) return;
    if (learn) onRunChange(grantOfferedMove(run, offer.rosterId, offer.moveId, replaceMoveId ?? undefined));
    setOffer(null);
  }

  function chooseEvolution(pathId: string) {
    if (!evolving) return;
    const entry = run.roster.find((r) => r.rosterId === evolving.rosterId);
    const path = evolving.node.paths.find((p) => p.id === pathId);
    if (!entry || !path) return;
    // Read BEFORE the choice lands: the path's moves that MOVE_CAP refused become the same
    // replace-or-decline offer a Scroll makes, one at a time.
    const refused = applyEvolutionMoves(entry.unlockedMoveIds, path.unlocksMoveIds).overflow;
    const next = chooseEvolutionPath(run, progressionTable, heroes, entry.rosterId, pathId);
    setEvolving(null);
    onRunChange(next);
    if (refused.length > 0) setOverflow({ rosterId: entry.rosterId, queue: refused });
  }

  function resolveOverflow(replaceMoveId: string | null, learn: boolean) {
    if (!overflow) return;
    const [moveId, ...rest] = overflow.queue;
    const next = learn ? grantOfferedMove(run, overflow.rosterId, moveId, replaceMoveId ?? undefined) : run;
    onRunChange(next);
    setOverflow(rest.length > 0 ? { ...overflow, queue: rest } : null);
  }

  return {
    pouring,
    landing,
    offer,
    evolving,
    overflow,
    spend,
    resolveOffer,
    closeOffer: () => setOffer(null),
    chooseEvolution,
    resolveOverflow,
  };
}

interface Props {
  run: RunState;
  flow: PourFlow;
  onInspect: (entry: RosterEntry, hero: HeroDefinition) => void;
}

/**
 * What the row says instead of its progress line. A dry band below the cap is NOT a block — the
 * rung still buys the tick that opens the next band — so it gets a note, not the inert style.
 */
function poolNote(entry: RosterEntry): string | null {
  if (scrollMovePool(progressionTable, moves, entry).length > 0) return null;
  return masteryRank(entry) >= MAX_MASTERY_RANK ? 'Nothing left to teach' : 'Band is dry — the rung buys the rank only';
}

/** Finished: max rank and no move left. The only state a rung cannot buy anything in. */
function isFinished(entry: RosterEntry): boolean {
  return masteryRank(entry) >= MAX_MASTERY_RANK && scrollMovePool(progressionTable, moves, entry).length === 0;
}

/**
 * One pip per RUNG to the top rank. The bar is the whole readout: rank is what the pips have
 * crossed, the next threshold is where the gap is, and the Evolution's pip is drawn differently
 * because it is the one the player is pouring toward. Drawn rather than written because "Rank 2,
 * 2 to go" is two numbers for one fact. Past the top rung the bar stays full — Rank 3 is open-ended.
 * A pip is a rung, not a Scroll: the rungs get dearer, and the price tag beside the bar says by how much.
 */
function RankPips({ rung }: { rung: number }) {
  return (
    <span className="mastery-pips" aria-hidden="true">
      {Array.from({ length: RUNGS_TO_MAX_RANK }, (_, i) => {
        const at = i + 1;
        const threshold = at < RUNGS_TO_MAX_RANK && RANK_THRESHOLDS.includes(at);
        return (
          <span
            key={i}
            className={`mastery-pip${at <= rung ? ' is-filled' : ''}${threshold ? ' is-threshold' : ''}${at === EVOLUTION_RUNG ? ' is-evolution' : ''}`}
          />
        );
      })}
    </span>
  );
}

/**
 * Where Mastery Scrolls are poured (docs/growth-overhaul.md §4). One row a hero, because the row
 * has to carry the four moves the hero already holds — the whole question a rung asks is "is
 * there room, and for what", and that is unreadable on a half-width card.
 *
 * The list only, with no count and no chrome: how many Scrolls are held is the SCREEN's readout —
 * this is the six answers to it, each with the price of its next rung (§12). The pour itself is
 * the screen's too (`useScrollPour`), because the Evolution rung is a screen of its own.
 *
 * **Six rows have to fit the screen without scrolling.** Six is ROSTER_CAP, so that is the worst
 * case, and it is the budget anything added to a row comes out of.
 */
export function MasteryBoard({ run, flow, onInspect }: Props) {
  const { pouring, landing, offer, overflow } = flow;
  const offerEntry = offer ? (run.roster.find((r) => r.rosterId === offer.rosterId) ?? null) : null;
  const overflowEntry = overflow ? (run.roster.find((r) => r.rosterId === overflow.rosterId) ?? null) : null;

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
              rung={masteryRung(entry)}
              cost={nextScrollCost(entry)}
              short={run.masteryScrolls < nextScrollCost(entry)}
              canSpend={!pouring && canSpendScroll(progressionTable, moves, run, entry)}
              pouring={pouring === entry.rosterId}
              landingMoveId={landing?.rosterId === entry.rosterId ? landing.moveId : null}
              note={poolNote(entry)}
              finished={isFinished(entry)}
              onSpend={() => flow.spend(entry)}
              onInspect={() => onInspect(entry, hero)}
            />
          );
        })}
      </div>

      {overflow && overflowEntry && (
        <MoveOfferOverlay
          run={run}
          entry={overflowEntry}
          moveId={overflow.queue[0]}
          eyebrow="The path grants a move — your kit is full"
          onResolve={flow.resolveOverflow}
        />
      )}

      {offer && offerEntry && (
        <ScrollOfferBox run={run} entry={offerEntry} offer={offer} onResolve={flow.resolveOffer} onClose={flow.closeOffer} />
      )}
    </div>
  );
}

interface OfferBoxProps {
  run: RunState;
  entry: RosterEntry;
  offer: ScrollOffer;
  onResolve: (replaceMoveId: string | null, learn: boolean) => void;
  onClose: () => void;
}

/** The box a pour ends in: a receipt below the cap, the replace question at it. */
function ScrollOfferBox({ run, entry, offer, onResolve, onClose }: OfferBoxProps) {
  const rank = masteryRank(entry);
  const toNext = rungsToNextRank(entry);
  const eyebrow = offer.rankedUp
    ? `Rank ${rank} — a deeper band opens`
    : `Rank ${rank}${toNext > 0 ? ` — ${toNext} rung${toNext === 1 ? '' : 's'} to the next` : ''}`;
  return offer.learned ? (
    <MoveLearnedOverlay run={run} entry={entry} moveId={offer.moveId} eyebrow={eyebrow} onClose={onClose} />
  ) : (
    <MoveOfferOverlay run={run} entry={entry} moveId={offer.moveId} eyebrow={eyebrow} onResolve={onResolve} />
  );
}

interface RowProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  rank: number;
  /** Rungs climbed — the pips. */
  rung: number;
  /** What the next rung costs (progression.ts nextScrollCost): the tag beside the pips. */
  cost: number;
  /** The purse cannot cover the tag. Not inert — the row is still the thing being saved toward. */
  short: boolean;
  canSpend: boolean;
  /** Drinking a Scroll right now (styles.css `.is-pouring`). */
  pouring: boolean;
  /** The chip that just filled, if one did — it lands with the pour instead of simply being there. */
  landingMoveId: string | null;
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

function MasteryRow({ hero, entry, rank, rung, cost, short, canSpend, pouring, landingMoveId, note, finished, onSpend, onInspect }: RowProps) {
  const press = useLongPress(onInspect, canSpend ? onSpend : undefined);

  return (
    <div
      className={`mastery-hero-row${canSpend ? ' can-take' : ''}${finished ? ' is-inert' : ''}${short && !finished ? ' is-short' : ''}${pouring ? ' is-pouring' : ''}`}
      style={{ '--plate-color': getTypeColor(hero.types[0]) } as CSSProperties}
      {...press}
    >
      {pouring && <span className="mastery-pour" aria-hidden="true" />}
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
          <RankPips rung={rung} />
          {/* The price of the next rung. It rises (1, 2, 3, 4, 5 ...), so it is the one number the
              pips cannot carry — and dimmed when the purse falls short, which is what makes
              "bank toward it" a thing the board shows rather than a rule held in the head. */}
          {!finished && (
            <span className={`mastery-hero-price${short ? ' is-short' : ''}`} aria-label={`Next rung costs ${cost} Scrolls`}>
              <ResourceGlyph kind="scroll" tone="inherit" />
              {cost}
            </span>
          )}
        </span>
      </div>

      {/* The four slots, filled or not: the Scroll's second question is whether there is room. */}
      <div className="mastery-move-row">
        {Array.from({ length: MOVE_CAP }, (_, i) => {
          const moveId = entry.unlockedMoveIds[i];
          const move = moveId ? moveForHero(moves[moveId], hero) : null;
          return (
            <span
              key={i}
              className={`mastery-move-chip${move ? '' : ' is-empty'}${move && moveId === landingMoveId ? ' is-landing' : ''}`}
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
