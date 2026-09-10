import { useEffect, useState } from 'react';
import { heroes } from '../../data/heroes';
import { progressionTable } from '../../data/progression';
import type { RunState } from '../../run/state';
import { applyEvolutionMoves, availableEvolution, chooseEvolutionPath, grantOfferedMove } from '../../run/progression';
import { EvolutionScreen } from './EvolutionScreen';
import { MoveOfferOverlay } from './MoveOfferOverlay';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onDone: () => void;
}

/** A path's granted move the four-move cap refused, waiting to be offered as a replace-or-decline. */
interface Overflow {
  rosterId: string;
  queue: string[];
}

/**
 * Every hero standing at an unresolved Evolution, one at a time in roster order.
 *
 * No picker: a pending Evolution is not optional, so choosing which to resolve first is a
 * decision with no content in it. Under automatic levelling the whole roster crosses the
 * threshold on the same fight, which is exactly the wall the Crucible exists to remove — this
 * screen is what stands in until phase 4 moves the invocation point
 * (docs/growth-overhaul.md §5). When it does, only the caller changes.
 */
export function EvolutionGateScreen({ run, onRunChange, onDone }: Props) {
  const [overflow, setOverflow] = useState<Overflow | null>(null);

  const entry = run.roster.find((r) => !!availableEvolution(progressionTable, r)) ?? null;
  const node = entry ? availableEvolution(progressionTable, entry) : null;
  const overflowEntry = overflow ? (run.roster.find((r) => r.rosterId === overflow.rosterId) ?? null) : null;

  function choose(rosterId: string, pathId: string) {
    const current = run.roster.find((r) => r.rosterId === rosterId);
    const path = current ? (availableEvolution(progressionTable, current)?.paths.find((p) => p.id === pathId) ?? null) : null;
    // Read BEFORE the choice lands: the path's moves that MOVE_CAP refused become the same
    // replace-or-decline offer a Scroll makes, one at a time.
    const refused = current && path ? applyEvolutionMoves(current.unlockedMoveIds, path.unlocksMoveIds).overflow : [];

    onRunChange(chooseEvolutionPath(run, progressionTable, heroes, rosterId, pathId));
    setOverflow(refused.length > 0 ? { rosterId, queue: refused } : null);
  }

  function resolveOverflow(replaceMoveId: string | null, learn: boolean) {
    if (!overflow) return;
    const [moveId, ...rest] = overflow.queue;
    if (learn) onRunChange(grantOfferedMove(run, overflow.rosterId, moveId, replaceMoveId ?? undefined));
    setOverflow(rest.length > 0 ? { rosterId: overflow.rosterId, queue: rest } : null);
  }

  const finished = !entry || !node;
  // An effect, not a render-time call: onDone lifts a screen change into the parent.
  useEffect(() => {
    if (finished && !overflow) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, overflow]);

  // The overflow outranks the next hero: finish what this Evolution owes before starting another.
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

  if (!entry || !node) return null;

  return (
    <EvolutionScreen
      hero={heroes[entry.heroId]}
      entry={entry}
      node={node}
      run={run}
      onChoose={(pathId) => choose(entry.rosterId, pathId)}
    />
  );
}
