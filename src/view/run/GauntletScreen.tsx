// The Gauntlet (docs/gauntlet.md): the entry, six offers of three, the six drafted, the record
// between fights, and what a finished run paid. The rules are run/gauntlet.ts's; this only renders.

import { useMemo, useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { constructedContent } from '../../data/trials';
import type { MoveDefinition } from '../../engine/content';
import { constructedPath, slotEntry, slotTypes, TEAM_SIZE, type TeamSlot } from '../../run/constructed';
import {
  GAUNTLET_CLEAR_BONUS,
  GAUNTLET_ENTRY_PRICE,
  LOSSES_TO_END,
  WINS_TO_CLEAR,
  type GauntletResult,
  type GauntletRun,
} from '../../run/gauntlet';
import { innatePassiveOf, masteredInnateOf } from '../../run/innate';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { MoveButtonReplica } from '../shared/MoveTile';
import { PassiveReadout } from '../shared/passiveIcons';
import { pathTint } from '../shared/pathTint';
import { StageMovePopup } from '../shared/HeroStage';
import { STAT_ORDER, StatGlyph } from '../shared/StatBars';
import { entryStatTotals } from '../shared/entryStatTotals';
import { healCasterForEntry } from '../shared/healCaster';
import { PlateButton } from '../shared/PlateButton';

interface Props {
  run: GauntletRun | null;
  /** heroId → starred path ids (Profile.evolutionStars): the board marks what a clear would star. */
  stars: Record<string, readonly string[]>;
  freeEntry: boolean;
  balance: number;
  entered: number;
  clears: number;
  /** The run that just ended, or a forfeited fight — said once on landing. */
  result: GauntletResult | null;
  notice: string | null;
  opponent: TeamSlot[] | null;
  onEnter: () => void;
  onDraft: (offerIndex: number) => void;
  onFight: () => void;
  onRetire: () => void;
  onDismissResult: () => void;
  onClose: () => void;
}

/** Seated in the footer beside the primary press, where the thumb already is. */
function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="secondary-button gx-footer-back" aria-label={label} onClick={onClick}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

function Header({ title, side }: { title: string; side?: React.ReactNode }) {
  return (
    <div className="cx-header">
      <span aria-hidden="true" />
      <h2 className="cx-title">{title}</h2>
      <div className="cx-header-side">{side}</div>
    </div>
  );
}

function StarGlyph({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z" />
    </svg>
  );
}

const starred = (stars: Props['stars'], slot: TeamSlot) => !!slot.pathId && (stars[slot.heroId]?.includes(slot.pathId) ?? false);

/** Five win pips and two loss pips — the record is the run's whole state. */
function Record({ wins, losses }: { wins: number; losses: number }) {
  return (
    <div className="gx-record" aria-label={`${wins} wins, ${losses} losses`}>
      <span className="gx-pips">
        {Array.from({ length: WINS_TO_CLEAR }, (_, i) => (
          <span key={i} className={`gx-pip is-win${i < wins ? ' is-lit' : ''}`} />
        ))}
      </span>
      <span className="gx-pips">
        {Array.from({ length: LOSSES_TO_END }, (_, i) => (
          <span key={i} className={`gx-pip is-loss${i < losses ? ' is-lit' : ''}`} />
        ))}
      </span>
    </div>
  );
}

// --- One hero, read whole ---

function HeroSheet({ slot, stars, action, onBack }: { slot: TeamSlot; stars: Props['stars']; action?: React.ReactNode; onBack: () => void }) {
  const [inspect, setInspect] = useState<MoveDefinition | null>(null);
  const hero = heroes[slot.heroId];
  const entry = useMemo(() => slotEntry(constructedContent, slot), [slot]);
  const totals = useMemo(() => entryStatTotals(hero, entry), [hero, entry]);
  const caster = useMemo(() => healCasterForEntry(hero, entry), [hero, entry]);
  const path = constructedPath(constructedContent.table, slot.heroId, slot.pathId);
  const innate = masteredInnateOf(hero) ?? innatePassiveOf(hero);
  const held = starred(stars, slot);

  return (
    <>
      <Header title={hero.name} />
      <div className="screen-scroll gx-sheet">
        <div className="cx-showcase">
          <HeroPortrait heroId={hero.id} pathId={slot.pathId ?? undefined} className="cx-showcase-portrait" />
          <div className="cx-showcase-text">
            {path && (
              <span className="gx-sheet-path" style={{ color: pathTint(hero, path).lead }}>
                {path.name}
              </span>
            )}
            <div className="cx-showcase-meta">
              <span>Lv 30 · Mastery 10</span>
              {slotTypes(constructedContent, slot).map((t) => (
                <TypeBadge key={t} type={t} />
              ))}
            </div>
            {innate && <PassiveReadout passive={innate} />}
          </div>
        </div>
        <div className={`gx-star-line${held ? ' is-held' : ''}`}>
          <StarGlyph filled={held} />
          {held ? 'Already starred' : 'Clear the Gauntlet with this hero to star this path'}
        </div>
        <div className="cx-stats">
          {STAT_ORDER.filter((s) => s !== 'mpRegen').map((stat) => (
            <span key={stat} className="cx-stat">
              <StatGlyph stat={stat} />
              <span className="cx-stat-value">{Math.round(totals[stat])}</span>
            </span>
          ))}
        </div>
        <div className="move-list gx-moves">
          {slot.moveIds
            .filter((id) => moves[id])
            .map((id) => (
              <MoveButtonReplica key={id} move={moves[id]} caster={caster} onClick={() => setInspect(moves[id])} onLongPress={() => setInspect(moves[id])} />
            ))}
        </div>
      </div>
      <div className="gx-footer">
        <Back label="Back" onClick={onBack} />
        {action}
      </div>
      {inspect && <StageMovePopup move={inspect} caster={caster} onClose={() => setInspect(null)} />}
    </>
  );
}

// --- The draft ---

function OfferCard({ slot, stars, onOpen }: { slot: TeamSlot; stars: Props['stars']; onOpen: () => void }) {
  const hero = heroes[slot.heroId];
  const path = constructedPath(constructedContent.table, slot.heroId, slot.pathId);
  const held = starred(stars, slot);
  return (
    <button type="button" className="gx-offer-card" onClick={onOpen}>
      {!held && (
        <span className="gx-unstarred" aria-label="Not yet starred">
          <StarGlyph filled={false} />
        </span>
      )}
      <HeroPortrait heroId={slot.heroId} pathId={slot.pathId ?? undefined} className="gx-offer-portrait" />
      <span className="gx-offer-text">
        <span className="gx-card-name">{hero.name}</span>
        {path && (
          <span className="gx-card-path" style={{ color: pathTint(hero, path).lead }}>
            {path.name}
          </span>
        )}
        <span className="gx-offer-types">
          {slotTypes(constructedContent, slot).map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </span>
        <span className="gx-offer-moves">{slot.moveIds.map((id) => moves[id]?.name ?? id).join(' · ')}</span>
      </span>
    </button>
  );
}

/** The six seats: the picks so far, then the empties still to fill. */
function Seats({ team, onOpen }: { team: readonly TeamSlot[]; onOpen: (i: number) => void }) {
  return (
    <div className="gx-seats">
      {Array.from({ length: TEAM_SIZE }, (_, i) =>
        team[i] ? (
          <button key={i} type="button" className="gx-seat is-filled" onClick={() => onOpen(i)} aria-label={heroes[team[i].heroId]?.name ?? team[i].heroId}>
            <HeroPortrait heroId={team[i].heroId} pathId={team[i].pathId ?? undefined} className="gx-seat-portrait" />
          </button>
        ) : (
          <span key={i} className={`gx-seat${i === team.length ? ' is-next' : ''}`} aria-hidden="true" />
        )
      )}
    </div>
  );
}

function DraftView({ run, stars, onDraft, onClose }: { run: GauntletRun; stars: Props['stars']; onDraft: (offerIndex: number) => void; onClose: () => void }) {
  const [reading, setReading] = useState<{ from: 'offer' | 'team'; index: number } | null>(null);

  if (reading) {
    const slot = reading.from === 'offer' ? run.offer[reading.index] : run.team[reading.index];
    if (slot) {
      return (
        <HeroSheet
          slot={slot}
          stars={stars}
          onBack={() => setReading(null)}
          action={
            reading.from === 'offer' ? (
              <PlateButton
                onClick={() => {
                  onDraft(reading.index);
                  setReading(null);
                }}
              >
                Draft
              </PlateButton>
            ) : undefined
          }
        />
      );
    }
  }

  return (
    <>
      <Header title="Draft" side={<span className="cx-team-state">{`${run.team.length + 1} / ${TEAM_SIZE}`}</span>} />
      <div className="screen-scroll gx-draft">
        <Seats team={run.team} onOpen={(i) => setReading({ from: 'team', index: i })} />
        <div className="gx-offer">
          {run.offer.map((slot, i) => (
            <OfferCard key={slot.heroId} slot={slot} stars={stars} onOpen={() => setReading({ from: 'offer', index: i })} />
          ))}
        </div>
      </div>
      <div className="gx-footer is-back-only">
        <Back label="Back to the title" onClick={onClose} />
      </div>
    </>
  );
}

// --- Between fights ---

function Strip({ slots, onOpen }: { slots: readonly TeamSlot[]; onOpen: (i: number) => void }) {
  return (
    <span className="cx-team-strip">
      {slots.map((s, i) => (
        <button key={s.heroId} type="button" className="gx-strip-cell" onClick={() => onOpen(i)} aria-label={heroes[s.heroId]?.name ?? s.heroId}>
          <HeroPortrait heroId={s.heroId} pathId={s.pathId ?? undefined} className="cx-strip-portrait" />
        </button>
      ))}
    </span>
  );
}

function BetweenView({ run, stars, opponent, notice, onFight, onRetire, onClose }: { run: GauntletRun; stars: Props['stars']; opponent: TeamSlot[]; notice: string | null; onFight: () => void; onRetire: () => void; onClose: () => void }) {
  const [reading, setReading] = useState<TeamSlot | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [shownNotice, setShownNotice] = useState(notice);

  if (reading) return <HeroSheet slot={reading} stars={stars} onBack={() => setReading(null)} />;

  return (
    <>
      <Header title="The Gauntlet" />
      <div className="screen-scroll gx-between">
        {shownNotice && (
          <button type="button" className="cx-notice" onClick={() => setShownNotice(null)}>
            {shownNotice}
          </button>
        )}
        <Record wins={run.wins} losses={run.losses} />
        <div className="cx-team-row gx-side">
          <span className="cx-label">Your six</span>
          <Strip slots={run.team} onOpen={(i) => setReading(run.team[i])} />
        </div>
        <div className="cx-team-row gx-side">
          <span className="cx-label">{`Fight ${run.wins + run.losses + 1}`}</span>
          <Strip slots={opponent} onOpen={(i) => setReading(opponent[i])} />
        </div>
      </div>
      <div className="gx-footer is-three">
        <Back label="Back to the title" onClick={onClose} />
        <button type="button" className={`secondary-button cx-delete${confirmRetire ? ' is-armed' : ''}`} onClick={() => (confirmRetire ? onRetire() : setConfirmRetire(true))}>
          {confirmRetire ? (run.wins >= WINS_TO_CLEAR ? 'Retire' : 'Retire for nothing') : 'Retire'}
        </button>
        <PlateButton onClick={onFight}>Fight</PlateButton>
      </div>
    </>
  );
}

// --- The entry, and what a run paid ---

function ResultView({ result, onDone }: { result: GauntletResult; onDone: () => void }) {
  const earned = result.starsEarned
    .map((pathId) => Object.values(constructedContent.table.evolutions).flat().flatMap((n) => n.paths).find((p) => p.id === pathId))
    .filter((p): p is NonNullable<typeof p> => !!p);
  return (
    <>
      <Header title={result.cleared ? 'Gauntlet cleared' : 'Gauntlet over'} />
      <div className="screen-scroll gx-result">
        <Record wins={result.wins} losses={result.losses} />
        <div className="gx-result-score">{`${result.wins}–${result.losses}`}</div>
        {result.cleared ? (
          <>
            {earned.length > 0 && (
              <div className="gx-earned">
                {earned.map((path) => (
                  <div key={path.id} className="gx-earned-row">
                    <HeroPortrait heroId={path.heroId} pathId={path.id} className="gx-earned-portrait" />
                    <span className="gx-earned-name">
                      {heroes[path.heroId]?.name}
                      <span className="gx-earned-path" style={{ color: pathTint(heroes[path.heroId], path).lead }}>
                        {path.name}
                      </span>
                    </span>
                    <span className="gx-earned-star">
                      <StarGlyph filled />
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="gx-result-bonus">{`+${result.bonus + earned.length} ★`}</div>
          </>
        ) : (
          <p className="gx-result-copy">{`A Gauntlet pays at ${WINS_TO_CLEAR} wins.`}</p>
        )}
      </div>
      <div className="gx-board-footer">
        <button type="button" className="resolve-button" onClick={onDone}>
          Done
        </button>
      </div>
    </>
  );
}

function EntryView({ freeEntry, balance, entered, clears, onEnter, onClose }: Pick<Props, 'freeEntry' | 'balance' | 'entered' | 'clears' | 'onEnter' | 'onClose'>) {
  const affordable = freeEntry || balance >= GAUNTLET_ENTRY_PRICE;
  return (
    <>
      <Header title="The Gauntlet" />
      <div className="screen-scroll gx-entry">
        <p className="gx-entry-copy">
          {`Draft six, one at a time, each from three of your heroes rolled into random forms. Win ${WINS_TO_CLEAR} fights before you lose ${LOSSES_TO_END}, and every path on your team is starred, plus ${GAUNTLET_CLEAR_BONUS} ★.`}
        </p>
        {entered > 0 && (
          <div className="gx-entry-record">
            <span>{`Entered ${entered}`}</span>
            <span>{`Cleared ${clears}`}</span>
          </div>
        )}
      </div>
      <div className="gx-footer">
        <Back label="Back to the title" onClick={onClose} />
        <PlateButton disabled={!affordable} onClick={onEnter}>
          {freeEntry ? 'Enter — free today' : `Enter — ${GAUNTLET_ENTRY_PRICE} ★`}
        </PlateButton>
      </div>
    </>
  );
}

export function GauntletScreen(props: Props) {
  const { run, stars, result, notice, opponent, onDraft, onFight, onRetire, onDismissResult, onClose } = props;
  return (
    <div className="node-screen cx-screen gx-screen">
      {result ? (
        <ResultView result={result} onDone={onDismissResult} />
      ) : !run ? (
        <EntryView {...props} />
      ) : run.team.length < TEAM_SIZE ? (
        <DraftView run={run} stars={stars} onDraft={onDraft} onClose={onClose} />
      ) : (
        opponent && <BetweenView run={run} stars={stars} opponent={opponent} notice={notice} onFight={onFight} onRetire={onRetire} onClose={onClose} />
      )}
    </div>
  );
}
