import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import {
  MASTERY_CAP,
  MASTERY_EVOLUTION,
  SCRIBE_PICKS,
  SCRIBE_PIPS_EACH,
  anyMasteryEligible,
  canTakeMastery,
  crossesMastery,
  grantMastery,
  masteryRoom,
} from '../../run/mastery';
import type { RosterEntry, RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { isCompanion } from '../../run/companion';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { MasteryPips } from '../shared/MasteryPips';
import { NodeHeader, NodeSky, NODE_TINT_PARCHMENT } from '../shared/NodeStage';
import { ResourceGlyph } from '../shared/RunGlyph';
import { CompanionScreen } from './CompanionScreen';
import { EvolutionScreen } from './EvolutionScreen';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MoveOfferOverlay, SignatureBox } from './MoveOfferOverlay';
import { RosterPeek } from './RosterPeek';
import { useMasteryFlow } from './masteryFlow';

/**
 * What the node hands out. The Scribe picks two heroes and pays each the same; a Scroll count
 * is tapped out one pip at a time, in any split (docs/mastery.md §3).
 */
export type ScrollPlan = { kind: 'scribe' } | { kind: 'scrolls'; count: number };

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  plan: ScrollPlan;
  /** The Guild Hall's shelf, rather than a map node: the header says what was paid. */
  bought?: boolean;
  /** Every pip landed and every payoff resolved — or nothing to land. The caller walks the node. */
  onDone: () => void;
}

/** A beat between the last pip lighting and the screen leaving, so the row is seen lit. */
const LEAVE_MS = 700;

/**
 * The who-screen for Mastery Scrolls (docs/mastery.md §2): every roster hero as a card with its
 * ten pips, a tap a pip. The screen collects one thing, who; the only decision that can appear
 * over it is the one worth having — the Evolution the fifth pip raises (masteryFlow.ts). No
 * purse: what the node holds is assigned here, and the screen leaves on its own when it is.
 */
export function ScrollNodeScreen({ run, onRunChange, plan, bought = false, onDone }: Props) {
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [remaining, setRemaining] = useState(plan.kind === 'scribe' ? SCRIBE_PICKS : plan.count);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const flow = useMasteryFlow(run, onRunChange);

  const pipsPerTap = plan.kind === 'scribe' ? SCRIBE_PIPS_EACH : 1;
  const eligible = run.roster.filter((entry) => canTakeMastery(entry) && !pickedIds.includes(entry.rosterId));
  const anyEligible = anyMasteryEligible(run.roster);
  // The Scribe can run out of heroes before it runs out of picks — a roster of one, or every
  // other hero at the cap — and the tapped-out count is then the count there was anyone for.
  const finished = remaining <= 0 || eligible.length === 0;

  useEffect(() => {
    playSfx('shrine', { pitch: 1.1, delay: 0.12 });
  }, []);

  useEffect(() => {
    if (!finished || flow.busy || !anyEligible) return;
    const timer = window.setTimeout(onDone, LEAVE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, flow.busy]);

  function handleTap(entry: RosterEntry) {
    if (finished || flow.busy || !canTakeMastery(entry) || pickedIds.includes(entry.rosterId)) return;
    const next = grantMastery(run, entry.rosterId, pipsPerTap);
    onRunChange(next);
    playSfx('scroll.spend');
    setRemaining((n) => n - 1);
    if (plan.kind === 'scribe') setPickedIds((ids) => [...ids, entry.rosterId]);
    // What the pip opened is raised over the LANDED run, not the one this render closed over.
    flow.raise(entry.rosterId, next);
  }

  const grownEntry = flow.grown ? (run.roster.find((r) => r.rosterId === flow.grown!.rosterId) ?? null) : null;
  if (flow.grown && grownEntry) {
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

  const overflowEntry = flow.overflow ? (run.roster.find((r) => r.rosterId === flow.overflow!.rosterId) ?? null) : null;
  const signatureEntry = flow.signature ? (run.roster.find((r) => r.rosterId === flow.signature!.rosterId) ?? null) : null;

  const title = 'Mastery Scrolls';
  const eyebrow = plan.kind === 'scribe' ? 'The Scribe' : bought ? 'Off the shelf' : 'Scroll Cache';
  const readout = !anyEligible
    ? `Every hero is already at ${MASTERY_CAP} Mastery — there is nobody left to teach.`
    : plan.kind === 'scribe'
      ? `${SCRIBE_PIPS_EACH} Mastery each for ${remaining === 1 ? 'one more' : `${remaining}`} of you. ${MASTERY_EVOLUTION} Evolves a hero; ${MASTERY_CAP} masters a signature. Hold to review a sheet.`
      : `${remaining} ${remaining === 1 ? 'Scroll' : 'Scrolls'} left — one Mastery each, to whoever you tap. ${MASTERY_EVOLUTION} Evolves a hero; ${MASTERY_CAP} masters a signature.`;

  return (
    <div className="node-screen shrine-screen scroll-screen" style={{ '--node-rgb': NODE_TINT_PARCHMENT } as CSSProperties}>
      <NodeSky />

      <span className="shrine-descent" aria-hidden="true" />

      <RosterPeek run={run} />

      <NodeHeader eyebrow={eyebrow} title={title} glyph={<ResourceGlyph kind="scroll" className="node-header-resource" />} readout={readout} />

      <HeroPickGrid count={run.roster.length} fill>
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const picked = pickedIds.includes(entry.rosterId);
          const open = !finished && canTakeMastery(entry) && !picked;
          const room = masteryRoom(entry, pipsPerTap);
          // The fifth pip is a hero's Evolution and the companion's first step; the tenth is a
          // hero's signature (when one is authored) and the companion's second step.
          const evolves = crossesMastery(entry, pipsPerTap, MASTERY_EVOLUTION);
          const masters = crossesMastery(entry, pipsPerTap, MASTERY_CAP) && (isCompanion(entry) || !!hero.signatureMoveId);
          // The count is what the hero HOLDS — the pips draw the gain in the node's colour, and
          // printing the post-tap total here read as if the hero already had it.
          const held = `${entry.mastery}/${MASTERY_CAP}`;
          const cta = !canTakeMastery(entry)
            ? 'Mastered'
            : picked
              ? `${held} ✓`
              : evolves || masters
                ? `${held} · ${isCompanion(entry) ? 'Grows!' : evolves ? 'Evolves!' : 'Signature!'}`
                : `${held} · +${room}`;
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              disabled={!open}
              selected={picked}
              onActivate={() => open && handleTap(entry)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, Mastery ${entry.mastery} of ${MASTERY_CAP} — ${cta}`}
              ctaClassName={picked ? 'is-done' : evolves || masters ? 'is-accent' : undefined}
              detail={<MasteryPips mastery={entry.mastery} gain={open ? room : 0} />}
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

      {flow.signature && signatureEntry && (
        <SignatureBox run={run} entry={signatureEntry} offer={flow.signature} onResolve={flow.resolveSignature} onClose={flow.closeSignature} />
      )}

      {flow.overflow && overflowEntry && (
        <MoveOfferOverlay
          run={run}
          entry={overflowEntry}
          moveId={flow.overflow.queue[0]}
          eyebrow="The Evolution grants a move, and the kit is full"
          onResolve={flow.resolveOverflow}
        />
      )}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
