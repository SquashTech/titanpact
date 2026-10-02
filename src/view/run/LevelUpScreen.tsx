import { useEffect, type CSSProperties } from 'react';
import { rosterHeroes } from '../../data/content';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import { levelOf, type HeroLevelUp } from '../../run/growth';
import { availableEvolution, entryBandRank, levelMovePool, pendingScheduleEntry, pendingSignature, scheduleFor, currentEvolutionPathId } from '../../run/progression';
import { companionTierStep } from '../../run/companion';
import type { RosterEntry, RunState } from '../../run/state';
import { NodeSky, NODE_TINT_VITAL } from '../shared/NodeStage';
import { RosterPeek } from './RosterPeek';
import { CompanionScreen } from './CompanionScreen';
import { EvolutionScreen } from './EvolutionScreen';
import { MoveLearnedOverlay, MoveOfferOverlay, SignatureBox } from './MoveOfferOverlay';
import { useLevelUpFlow } from './levelUpFlow';
import { LevelUpList, SIGNATURE_TAG } from './LevelUpList';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  /** One entry per roster hero, in roster order — including any that were already at the cap. */
  report: readonly HeroLevelUp[];
  onContinue: () => void;
}

/**
 * Where a won encounter's levels PAY (docs/xp-overhaul.md §4): every hero whose level has reached
 * a schedule entry takes it here, in roster order — a move offer, the hero's signature at its own
 * level (dressed louder, the same box), or the Evolution as a screen of its own. It is the one
 * decision kind the level flow carries; it must not gain a second.
 *
 * The report itself lives on the victory screen (2026-09-30, per user direction, to shorten the
 * post-fight chain): levels and bars at a glance, every stat's roll a tap away (LevelUpList with
 * `gains`). So this screen is reached only when somebody is owed a payoff, starts paying on
 * arrival — the roster's levels and tags behind each offer — and leaves once nobody is owed.
 */
export function LevelUpScreen({ run, onRunChange, report, onContinue }: Props) {
  const flow = useLevelUpFlow(run, onRunChange);
  const rosterIds = report.map((hero) => hero.rosterId);

  // One entry at a time: each payoff changes the run, the run comes back, and the next hero owed
  // is asked. Out when nobody is.
  useEffect(() => {
    if (flow.busy) return;
    if (!flow.next(rosterIds)) onContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, flow.busy]);

  const levels = report.reduce((best, hero) => Math.max(best, hero.toLevel - hero.fromLevel), 0);

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
  const signatureEntry = flow.signature ? (run.roster.find((r) => r.rosterId === flow.signature!.rosterId) ?? null) : null;

  return (
    <div className="node-screen level-up-screen" style={{ '--node-rgb': NODE_TINT_VITAL } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      <header className="level-up-banner">
        <h2 className="level-up-title">
          <span className="level-up-title-glow" aria-hidden="true">
            Level Up!
          </span>
          Level Up!
        </h2>
        {levels > 0 && (
          <div className="level-up-figures">
            <span className="level-up-delta">{`+${levels} ${levels === 1 ? 'Level' : 'Levels'}`}</span>
          </div>
        )}
      </header>

      <div className="screen-scroll">
        <LevelUpList report={report} owedFor={(rosterId) => owedLabel(run, rosterId)} formFor={(rosterId) => { const entry = run.roster.find((r) => r.rosterId === rosterId); return entry ? currentEvolutionPathId(entry) : null; }} />
      </div>

      {flow.signature && signatureEntry && (
        <SignatureBox run={run} entry={signatureEntry} offer={flow.signature} onResolve={flow.resolveSignature} onClose={flow.closeSignature} />
      )}

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
  if (pendingSignature(hero, entry)) return SIGNATURE_TAG;
  if (!pendingScheduleEntry(hero, entry)) return null;
  return levelMovePool(progressionTable, moves, hero, entry).length > 0 ? 'New Move!' : null;
}
