import { type CSSProperties, useState } from 'react';
import { equipment } from '../../data/equipment';
import { heroes } from '../../data/heroes';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { applyEvolutionMoves, availableEvolution, chooseEvolutionPath, grantOfferedMove } from '../../run/progression';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { EvolutionScreen } from './EvolutionScreen';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { MoveOfferOverlay } from './MoveOfferOverlay';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/** A path's granted move the four-move cap refused, waiting to be offered as a replace-or-decline. */
interface Overflow {
  rosterId: string;
  queue: string[];
}

/**
 * The Crucible (docs/growth-overhaul.md §5): pick ONE hero, and that hero evolves.
 *
 * A beat in the act-boundary chain — Guardian falls, Banner, **Crucible**, Pact Seal, act intro —
 * rather than a map row, because acts 1-4 already run nine rows and a tenth is not affordable.
 * Team, hero, run: three scales ascending. Every player learns after Act 1 that a Guardian's
 * death is where a hero changes.
 *
 * **Non-bankable.** It is a turning point, so the choice is made now, which is also why it is a
 * beat rather than an item: a grant that cannot be held is a screen anyway, so it should be one
 * the player can see coming.
 *
 * It replaced a level trigger. Under automatic roster-wide levelling every hero crosses any
 * threshold on the same fight, so \`EVOLUTION_LEVEL\` was a six-decision wall by construction —
 * the move was forced, not preferred.
 */
export function CrucibleScreen({ run, onRunChange, onContinue }: Props) {
  const [chosenRosterId, setChosenRosterId] = useState<string | null>(null);
  const [overflow, setOverflow] = useState<Overflow | null>(null);
  const [previewing, setPreviewing] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  const chosen = chosenRosterId ? (run.roster.find((r) => r.rosterId === chosenRosterId) ?? null) : null;
  const node = chosen ? availableEvolution(progressionTable, chosen) : null;
  const overflowEntry = overflow ? (run.roster.find((r) => r.rosterId === overflow.rosterId) ?? null) : null;
  const eligible = run.roster.filter((entry) => !!availableEvolution(progressionTable, entry));

  function choose(rosterId: string, pathId: string) {
    const entry = run.roster.find((r) => r.rosterId === rosterId);
    const path = entry ? (availableEvolution(progressionTable, entry)?.paths.find((p) => p.id === pathId) ?? null) : null;
    // Read BEFORE the choice lands: the path's moves that MOVE_CAP refused become the same
    // replace-or-decline offer a Scroll makes, one at a time.
    const refused = entry && path ? applyEvolutionMoves(entry.unlockedMoveIds, path.unlocksMoveIds).overflow : [];

    onRunChange(chooseEvolutionPath(run, progressionTable, heroes, rosterId, pathId));
    setChosenRosterId(null);
    if (refused.length > 0) setOverflow({ rosterId, queue: refused });
    else onContinue();
  }

  function resolveOverflow(replaceMoveId: string | null, learn: boolean) {
    if (!overflow) return;
    const [moveId, ...rest] = overflow.queue;
    if (learn) onRunChange(grantOfferedMove(run, overflow.rosterId, moveId, replaceMoveId ?? undefined));
    if (rest.length > 0) {
      setOverflow({ rosterId: overflow.rosterId, queue: rest });
    } else {
      setOverflow(null);
      onContinue();
    }
  }

  // The overflow outranks everything: finish what this Evolution owes before the screen closes.
  if (overflow && overflowEntry) {
    return (
      <MoveOfferOverlay
        run={run}
        entry={overflowEntry}
        moveId={overflow.queue[0]}
        eyebrow="The path grants a move — your kit is full"
        onResolve={resolveOverflow}
      />
    );
  }

  if (chosen && node) {
    return (
      <EvolutionScreen
        hero={heroes[chosen.heroId]}
        entry={chosen}
        node={node}
        run={run}
        onChoose={(pathId) => choose(chosen.rosterId, pathId)}
      />
    );
  }

  return (
    <div className="node-screen crucible-screen" style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />
      <NodeHeader
        eyebrow="The Crucible"
        title="One of you changes"
        readout={
          eligible.length > 0
            ? 'Choose the hero. The path they take is permanent for the rest of the run.'
            : 'Every hero has already walked it. Nothing left to burn.'
        }
      />

      {/* Every hero, not just the eligible ones: an already-evolved hero is the reason the
          choice is narrowing, and showing only what is left hides that.
          ┄
          A DIRECT child of the screen, not wrapped in `.screen-scroll` — `.pick-grid.is-filling`
          claims its height with `flex: 1 1 auto`, which does nothing inside a block, so the grid
          was content-sized at the top of the scroller and left 416px of nothing under it. Every
          other pick-a-hero screen (Forge, Tutor, the Mentor, the Boon's second phase) already
          mounts it this way. */}
      <HeroPickGrid count={run.roster.length} fill>
          {run.roster.map((entry) => {
            const hero = heroes[entry.heroId];
            const pending = availableEvolution(progressionTable, entry);
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                disabled={!pending}
                cta={pending ? 'Enter' : 'Evolved'}
                ctaClassName={pending ? 'is-accent' : undefined}
                ariaLabel={`${hero.name}, level ${entry.level} — ${pending ? 'enter the Crucible' : 'already evolved'}`}
                onActivate={pending ? () => setChosenRosterId(entry.rosterId) : undefined}
                onPreview={() => setPreviewing({ hero, entry })}
              />
            );
          })}
      </HeroPickGrid>

      {/* Only when nobody can take it. An unspent Crucible is never walked past otherwise — it
          does not bank, so leaving is the same as burning it. */}
      {eligible.length === 0 && (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      )}

      {previewing && (
        <HeroPreviewOverlay
          hero={previewing.hero}
          entry={previewing.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}
