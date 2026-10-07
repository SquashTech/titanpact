import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { gemAmount, placeGem, GEM_ORDER, type GemPlan } from '../../run/gems';
import { MASTERY_CAP, MASTERY_EVOLUTION, anyMasteryEligible, canTakeMastery, crossesMastery } from '../../run/mastery';
import type { ScrollProgress } from '../../run/resume';
import type { RosterEntry, RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { GemIcon, GEM_STONES } from '../shared/GemIcon';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { MasteryPips } from '../shared/MasteryPips';
import { NodeMotes, NODE_TINT_PARCHMENT } from '../shared/NodeStage';
import { STAT_FULL_LABELS } from '../shared/relicStacks';
import { entryStatTotals } from '../shared/entryStatTotals';
import lapidaryArt from '../../../art/npc/lapidary.png';
import { EvolutionScreen } from './EvolutionScreen';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MoveOfferOverlay } from './MoveOfferOverlay';
import { MasteredInnateOverlay } from './MasteredInnateOverlay';
import { RosterPeek } from './RosterPeek';
import { KeeperVoice, useKeeperLine } from './RoadEncounter';
import { SCRIBE_LINES } from '../../data/roadLines';
import { useMasteryFlow } from './masteryFlow';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  plan: GemPlan;
  /** Every Gem placed and every payoff resolved — or nobody left to take one. The caller walks the node. */
  onDone: () => void;
  /** The Gems still to place, held by App so a reload neither repays nor forgets them. Omitted = none placed yet. */
  progress?: ScrollProgress;
  onProgress: (progress: ScrollProgress) => void;
}

/** A beat between the last Gem landing and the screen leaving, so the last burst is seen. */
const LEAVE_MS = 800;
/** How long a hero's card flares in the Gem's colour after taking it. */
const BURST_MS = 700;

const EYEBROW: Record<GemPlan['source'], string> = { scribe: 'By the Roadside', cache: 'Gem Cache', shelf: 'Off the Shelf' };

/**
 * The who-screen for Gems (docs/gems.md): the Gems come up one at a time in a fixed order, the one
 * in hand shown large, and every hero shows the stat it raises and its ten Mastery pips. A tap
 * places it — the stat and a pip, for good. The only decision that can appear over it is the
 * Evolution or the mastered innate a pip opens (masteryFlow.ts).
 */
export function GemNodeScreen({ run, onRunChange, plan, onDone, progress, onProgress }: Props) {
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [burst, setBurst] = useState<{ rosterId: string; key: number } | null>(null);
  const flow = useMasteryFlow(run, onRunChange);
  const voice = useKeeperLine(SCRIBE_LINES);

  const total = plan.gems.length;
  const remaining = progress?.remaining ?? total;
  const index = total - remaining;
  const gem = remaining > 0 ? plan.gems[index] : null;
  const anyEligible = anyMasteryEligible(run.roster);
  const finished = !gem || !anyEligible;

  useEffect(() => {
    playSfx('shrine', { pitch: 1.25, delay: 0.12 });
  }, []);

  useEffect(() => {
    if (!finished || flow.busy || !anyEligible) return;
    const timer = window.setTimeout(onDone, LEAVE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, flow.busy]);

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(null), BURST_MS);
    return () => window.clearTimeout(timer);
  }, [burst]);

  function handleTap(entry: RosterEntry) {
    if (!gem || flow.busy || !canTakeMastery(entry)) return;
    const next = placeGem(run, entry.rosterId, gem);
    onRunChange(next);
    const milestone = crossesMastery(entry, 1, MASTERY_EVOLUTION) || crossesMastery(entry, 1, MASTERY_CAP);
    playSfx('gem.set', { pitch: (milestone ? 1.26 : 1) * (0.9 + GEM_ORDER.indexOf(gem.stat) * 0.035) });
    setBurst({ rosterId: entry.rosterId, key: Date.now() });
    onProgress({ remaining: remaining - 1, pickedIds: [] });
    // What the pip opened is raised over the LANDED run, not the one this render closed over.
    flow.raise(entry.rosterId, next, entry.mastery);
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

  const overflowEntry = flow.overflow ? (run.roster.find((r) => r.rosterId === flow.overflow!.rosterId) ?? null) : null;
  const masteredEntry = flow.mastered ? (run.roster.find((r) => r.rosterId === flow.mastered!.rosterId) ?? null) : null;
  const shown = gem ?? plan.gems[total - 1];
  const stone = GEM_STONES[shown.stat];
  const statName = shown.stat === 'manaPool' ? 'Mana' : STAT_FULL_LABELS[shown.stat];
  const amount = gemAmount(shown);

  return (
    <div
      className="node-screen rite-screen is-scribe scroll-screen gem-screen"
      style={{ '--node-rgb': NODE_TINT_PARCHMENT, '--rite-color': `rgb(${NODE_TINT_PARCHMENT})`, '--gem-color': stone.tones[1] } as CSSProperties}
    >
      <span className="node-sky scribe-ground" aria-hidden="true" />
      <NodeMotes count={12} />
      <RosterPeek run={run} />

      {plan.source === 'scribe' ? (
        <header className="keeper-head">
          <span className="keeper-figure">
            <span className="rite-pool" aria-hidden="true" />
            <img src={lapidaryArt} className="keeper-art" alt="" draggable={false} />
          </span>
          <span className="keeper-words">
            <span className="rite-eyebrow">{EYEBROW.scribe}</span>
            <h2 className="rite-name">The Lapidary</h2>
            <KeeperVoice line={voice} />
          </span>
        </header>
      ) : (
        <header className="rite-head">
          <span className="rite-eyebrow">{EYEBROW[plan.source]}</span>
          <h2 className="rite-name">Gems</h2>
        </header>
      )}

      {anyEligible ? (
        <section className="gem-hand" aria-live="polite">
          <span className="gem-hand-stone" key={index}>
            <GemIcon stat={shown.stat} size={60} live={!!gem} large={shown.points >= 10} />
          </span>
          <span className="gem-hand-words">
            <span className="gem-hand-name">
              {stone.name} <span className="gem-hand-pip">· +1 Mastery</span>
            </span>
            <span className="gem-hand-grant">
              +{amount} {statName}
            </span>
          </span>
          <ol className="gem-tray" aria-label={`${remaining} of ${total} Gems left`}>
            {plan.gems.map((g, i) => (
              <li key={i} className={`gem-tray-slot${i < index ? ' is-set' : i === index ? ' is-current' : ''}`}>
                <GemIcon stat={g.stat} size={22} large={g.points >= 10} />
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="gem-hand-none">Every hero is already at {MASTERY_CAP} Mastery — there is nobody left to take a Gem.</p>
      )}

      <HeroPickGrid count={run.roster.length} fill>
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const open = !finished && canTakeMastery(entry);
          const evolves = crossesMastery(entry, 1, MASTERY_EVOLUTION);
          const masters = crossesMastery(entry, 1, MASTERY_CAP) && !!hero.masteredPassiveIds?.length;
          const now = entryStatTotals(hero, entry, run.relics, run.gold)[shown.stat];
          const cta = !canTakeMastery(entry) ? 'Mastered' : evolves ? 'Evolves!' : masters ? 'Masters!' : `${entry.mastery}/${MASTERY_CAP}`;
          const flaring = burst?.rosterId === entry.rosterId;
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              disabled={!open}
              className={flaring ? 'is-gem-burst' : undefined}
              overlay={flaring ? <span key={burst!.key} className="gem-burst" aria-hidden="true" /> : undefined}
              onActivate={() => open && handleTap(entry)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, ${statName} ${now}, Mastery ${entry.mastery} of ${MASTERY_CAP} — ${cta}`}
              ctaClassName={evolves || masters ? 'is-accent' : undefined}
              detail={
                <span className="gem-card-detail">
                  <span className="gem-card-stat">
                    <span className="gem-card-label">{statName}</span>
                    <span className="gem-card-value">{now}</span>
                    {open && <span className="gem-card-gain">+{amount}</span>}
                  </span>
                  <MasteryPips mastery={entry.mastery} gain={open ? 1 : 0} />
                </span>
              }
              cta={cta}
            />
          );
        })}
      </HeroPickGrid>

      {!anyEligible && (
        <button className="resolve-button" onClick={onDone}>
          Continue
        </button>
      )}

      {flow.mastered && masteredEntry && <MasteredInnateOverlay entry={masteredEntry} turn={flow.mastered.turn} onClose={flow.closeMastered} />}

      {flow.overflow && overflowEntry && (
        <MoveOfferOverlay
          run={run}
          entry={overflowEntry}
          moveId={flow.overflow.queue[0]}
          eyebrow={flow.overflow.eyebrow ?? 'The Evolution grants a move, and the kit is full'}
          onResolve={flow.resolveOverflow}
        />
      )}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          gold={run.gold}
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
