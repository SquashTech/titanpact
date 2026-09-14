import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { StatKey } from '../../engine/content';
import { GROWTH_STATS, MAX_LEVEL, growthUnitFor, levelOf, xpProgress, xpToNextLevel, type HeroLevelUp } from '../../run/growth';
import { availableEvolution, entryBandRank, levelMovePool, pendingScheduleEntry, scheduleFor } from '../../run/progression';
import { companionTierStep } from '../../run/companion';
import type { RosterEntry, RunState } from '../../run/state';
import { getTypeColor } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { NodeSky, NODE_TINT_VITAL } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { STAT_COLORS, STAT_LABELS, StatGlyph } from '../shared/StatBars';
import { RosterPeek } from './RosterPeek';
import { CompanionScreen } from './CompanionScreen';
import { EvolutionScreen } from './EvolutionScreen';
import { MoveLearnedOverlay, MoveOfferOverlay } from './MoveOfferOverlay';
import { playXpBar, xpBarSegments } from '../shared/xpBar';
import { useLevelUpFlow } from './levelUpFlow';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  /** One entry per roster hero, in roster order — including any that were already at the cap. */
  report: readonly HeroLevelUp[];
  onContinue: () => void;
}

/** Beat boundaries, in ms from the screen landing. Six rows finish inside ~1.8s. */
const ROW_LEAD_MS = 420;
const ROW_STAGGER_MS = 230;

/**
 * A gain of this many points or more, on ONE level, is a big one and gets the louder cell. A
 * report can cover several levels at once, so the bar rises by two a level past the first —
 * two ordinary rolls in a row is not the same thing as one that reached the top of its grade.
 */
const BIG_ROLL_POINTS = 3;

function isBigRoll(points: number, levels: number): boolean {
  return points >= BIG_ROLL_POINTS + 2 * Math.max(0, levels - 1);
}

/**
 * What a won encounter did to the roster (docs/growth-overhaul.md §3). Levels are automatic,
 * roster-wide and unallocatable, which removed the screen that used to report them — so the
 * player could see a number climb on the hero sheet and never see the moment it climbed.
 *
 * The whole roster is listed, benched rosterHeroes included, because that IS the rule and one fielded
 * hero levelling would read as participation XP. Every stat gets a cell whether or not it rolled:
 * the misses are what make the hits read as a ROLL against a grade rather than an authored grant,
 * and a row of constant width is what lets six of them be scanned at a glance.
 *
 * The header says two things and nothing else: that it happened, and by how much. The rule it
 * used to spell out ("everyone gains, each stat rolls its grade") is what the rows themselves
 * show, and a sentence restating what the eye is about to see was the one thing here that never
 * changed what anybody did.
 *
 * Since the XP Overhaul's phase 3 (docs/xp-overhaul.md §4) the report is also where a level PAYS:
 * every hero whose level has reached a schedule entry takes it here, in roster order — a move
 * offer over the report, or the Evolution as a screen of its own. It is the one decision kind the
 * report carries, and it was a screen of its own before; it must not gain a second.
 *
 * The payoffs wait for Continue (2026-09-13, per user direction): they used to fire the moment
 * the last row landed, which put an offer over stat cells still popping in. Now the report is
 * read in full, each row owed something wears a tag saying so, and Continue starts the payoffs —
 * one at a time, the report still behind them — and leaves the screen once nobody is owed.
 */
export function LevelUpScreen({ run, onRunChange, report, onContinue }: Props) {
  const [revealed, setRevealed] = useState(() => (prefersReducedMotion() ? report.length : 0));
  const flow = useLevelUpFlow(run, onRunChange);
  const [paying, setPaying] = useState(false);
  const rosterIds = report.map((hero) => hero.rosterId);
  const landed = revealed >= report.length;

  // Once Continue is pressed the schedule pays out one entry at a time: each payoff changes the
  // run, the run comes back, and the next hero owed is asked. Out when nobody is.
  useEffect(() => {
    if (!paying || flow.busy) return;
    if (!flow.next(rosterIds)) onContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, paying, flow.busy]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    playSfx('levelUp');
    const timers = report.map((_, i) =>
      window.setTimeout(() => {
        setRevealed((n) => Math.max(n, i + 1));
        // A ladder up the roster. The fanfare plays once, over the top of all of them — six
        // fanfares in a row is the reason this pip exists.
        playSfx('xp.orb', { pitch: 1 + i * 0.07 });
      }, ROW_LEAD_MS + i * ROW_STAGGER_MS)
    );
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The biggest climb names the beat, not the first row: a hero parked at the cap must not, and
  // under the XP curve a hero behind par climbs further than the rest on the same grant. The XP
  // figure is the same for everybody not at the cap, so the largest is the grant.
  const levels = report.reduce((best, hero) => Math.max(best, hero.toLevel - hero.fromLevel), 0);
  const xpGained = report.reduce((best, hero) => Math.max(best, hero.toXp - hero.fromXp), 0);
  const allAtCap = report.every((hero) => hero.toLevel >= MAX_LEVEL);

  if (flow.grown) {
    return <CompanionScreen run={run} beat={{ kind: 'grown', fromHeroId: flow.grown.fromHeroId, toHeroId: flow.grown.toHeroId }} onContinue={flow.closeGrown} />;
  }

  const evolvingEntry = flow.evolving ? (run.roster.find((r) => r.rosterId === flow.evolving!.rosterId) ?? null) : null;
  if (flow.evolving && evolvingEntry) {
    return (
      <EvolutionScreen
        hero={rosterHeroes[evolvingEntry.heroId]}
        entry={evolvingEntry}
        node={flow.evolving.node}
        run={run}
        onChoose={flow.chooseEvolution}
      />
    );
  }

  const offerEntry = flow.offer ? (run.roster.find((r) => r.rosterId === flow.offer!.rosterId) ?? null) : null;
  const overflowEntry = flow.overflow ? (run.roster.find((r) => r.rosterId === flow.overflow!.rosterId) ?? null) : null;

  return (
    <div className="node-screen level-up-screen" style={{ '--node-rgb': NODE_TINT_VITAL } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      <header className="level-up-banner">
        <span className="level-up-flash" aria-hidden="true" />
        <span className="level-up-rays" aria-hidden="true" />
        <h2 className="level-up-title">
          <span className="level-up-title-glow" aria-hidden="true">
            Level Up!
          </span>
          Level Up!
        </h2>
        <div className="level-up-figures">
          {xpGained > 0 && <span className="level-up-xp-gain">+{xpGained} XP</span>}
          <span className={`level-up-delta${levels <= 0 ? ' is-max' : ''}`}>
            {levels > 0 ? `+${levels} ${levels === 1 ? 'Level' : 'Levels'}` : allAtCap ? 'Max Level' : 'No level yet'}
          </span>
        </div>
      </header>

      {/* Tap the list to land every row at once: this plays after every won fight, so waiting
          out the stagger must never be the only way through it. */}
      <div className="screen-scroll" onClick={() => setRevealed(report.length)}>
        <div className="level-up-list">
          {report.map((hero, i) => (
            <LevelUpRow key={hero.rosterId} hero={hero} index={i} shown={i < revealed} owed={owedLabel(run, hero.rosterId)} />
          ))}
        </div>
      </div>

      <button className="resolve-button" disabled={!landed || paying} onClick={() => setPaying(true)}>
        Continue
      </button>

      {flow.overflow && overflowEntry && (
        <MoveOfferOverlay
          run={run}
          entry={overflowEntry}
          moveId={flow.overflow.queue[0]}
          eyebrow="The path grants a move — your kit is full"
          onResolve={flow.resolveOverflow}
        />
      )}

      {flow.offer && offerEntry && (
        <OfferBox run={run} entry={offerEntry} offer={flow.offer} onResolve={flow.resolveOffer} onClose={flow.closeOffer} />
      )}
    </div>
  );
}

interface OfferBoxProps {
  run: RunState;
  entry: RosterEntry;
  offer: { moveId: string; learned: boolean };
  onResolve: (replaceMoveId: string | null, learn: boolean) => void;
  onClose: () => void;
}

/** The box a level's offer ends in: a receipt below the cap, the replace question at it. */
function OfferBox({ run, entry, offer, onResolve, onClose }: OfferBoxProps) {
  const hero = rosterHeroes[entry.heroId];
  const level = levelOf(entry);
  const band = ['Early', 'Mid', 'Late'][entryBandRank(hero, entry) - 1];
  const schedule = scheduleFor(hero);
  const opened = level >= schedule.lateLevel ? schedule.lateLevel : level >= schedule.midLevel ? schedule.midLevel : null;
  const eyebrow = `Level ${level} — ${band} band${opened === level ? ', just opened' : ''}`;
  return offer.learned ? (
    <MoveLearnedOverlay run={run} entry={entry} moveId={offer.moveId} eyebrow={eyebrow} onClose={onClose} />
  ) : (
    <MoveOfferOverlay run={run} entry={entry} moveId={offer.moveId} eyebrow={eyebrow} onResolve={onResolve} />
  );
}

/**
 * What a hero's row is still owed — its pips' catch-all first (a hire that arrived past the pip
 * unevolved), then its schedule — as the tag the row wears. Read off the LIVE run, so a tag comes
 * off the moment its payoff is taken. Null when the entry would pay nothing (a dry band), which
 * the flow takes silently.
 */
function owedLabel(run: RunState, rosterId: string): string | null {
  const entry = run.roster.find((r) => r.rosterId === rosterId);
  if (!entry) return null;
  if (companionTierStep(entry)) return 'Grows!';
  const node = availableEvolution(progressionTable, entry);
  if (node && node.paths.length > 0) return 'Evolution!';
  const hero = rosterHeroes[entry.heroId];
  if (!pendingScheduleEntry(hero, entry)) return null;
  return levelMovePool(progressionTable, moves, hero, entry).length > 0 ? 'New Move!' : null;
}

interface RowProps {
  hero: HeroLevelUp;
  index: number;
  shown: boolean;
  /** The tag for what this level still owes the hero, or null for nothing. */
  owed: string | null;
}

function LevelUpRow({ hero, shown, owed }: RowProps) {
  const definition = rosterHeroes[hero.heroId];
  const fillRef = useRef<HTMLElement>(null);
  const segments = useMemo(() => xpBarSegments(hero.fromXp, hero.toXp), [hero.fromXp, hero.toXp]);

  // The bar sweeps as the row lands — the same sweep the fight result ran, here beside the cells
  // it paid for.
  useEffect(() => {
    const fill = fillRef.current;
    if (!shown || !fill || segments.length === 0 || prefersReducedMotion()) return;
    return playXpBar(fill, segments, 0, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  if (!definition) return null;
  const levels = hero.toLevel - hero.fromLevel;
  const atCap = hero.toLevel >= MAX_LEVEL;
  // Dimmed only at the cap. A row the grant left part-way to its next level is not a miss: the
  // bar moved, and the bar is the point.
  const capped = atCap && levels <= 0;
  const restingWidth = shown && !prefersReducedMotion() && segments.length > 0 ? xpProgress(hero.fromXp) : xpProgress(hero.toXp);
  const toNext = xpToNextLevel(hero.toXp);

  return (
    <div
      className={`level-up-row${shown ? ' is-shown' : ''}${capped ? ' is-capped' : ''}`}
      style={{ '--plate-color': getTypeColor(definition.types[0]) } as CSSProperties}
    >
      <span className="level-up-sweep" aria-hidden="true" />
      <HeroPortrait heroId={definition.id} className="level-up-portrait" />

      <div className="level-up-body">
        <div className="level-up-ident">
          <span className="level-up-name">{definition.name}</span>
          {owed && shown && <span className="level-up-owed">{owed}</span>}
          <span className="level-up-level">
            {capped ? (
              <span className="level-up-max">Max</span>
            ) : levels <= 0 ? (
              <span className="level-up-from">Lv {hero.toLevel}</span>
            ) : (
              <>
                <span className="level-up-from">{hero.fromLevel}</span>
                <span className="level-up-arrow" aria-hidden="true">
                  →
                </span>
                <span className="level-up-to">{hero.toLevel}</span>
              </>
            )}
          </span>
        </div>

        <div className="level-up-xp" title={atCap ? `${definition.name} is at the cap` : `${toNext} XP to level ${hero.toLevel + 1}`}>
          <span className="level-up-xp-track" aria-hidden="true">
            <i ref={fillRef} className="level-up-xp-fill" style={{ width: `${restingWidth * 100}%` }} />
          </span>
          <span className="level-up-xp-next">{atCap ? 'Max' : `${toNext} to Lv ${hero.toLevel + 1}`}</span>
        </div>

        <div className="level-up-gains">
          {GROWTH_STATS.map((stat, i) => (
            <StatGainCell key={stat} stat={stat} amount={hero.gained[stat] ?? 0} index={i} levels={levels} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * One growth stat's outcome. The delay runs the cells left to right under the tail of the row's
 * own 320ms land, so a row reads as one gesture rather than as seven things arriving at once.
 * A big roll (isBigRoll) lands harder — the roll has a top now, and reaching it is the thing
 * worth a louder cell.
 */
function StatGainCell({ stat, amount, index, levels }: { stat: StatKey; amount: number; index: number; levels: number }) {
  const points = amount / growthUnitFor(stat);
  const tone = amount <= 0 ? '' : isBigRoll(points, levels) ? ' is-hit is-big' : ' is-hit';
  return (
    <span
      className={`level-up-cell${tone}`}
      style={{ '--stat-color': STAT_COLORS[stat], animationDelay: `${140 + index * 45}ms` } as CSSProperties}
      title={`${STAT_LABELS[stat]} ${amount > 0 ? `+${amount}` : 'did not roll'}`}
    >
      <StatGlyph stat={stat} tone="inherit" />
      <span className="level-up-cell-amount">{amount > 0 ? `+${amount}` : '·'}</span>
    </span>
  );
}
