import { useState } from 'react';
import { rosterHeroes as heroes } from '../../data/content';
import { progressionTable } from '../../data/progression';
import { applyCompanionTierStep, companionTierStep } from '../../run/companion';
import type { RunState } from '../../run/state';
import { applyEvolutionMoves, availableEvolution, chooseEvolutionPath, grantOfferedMove, type EvolutionNode } from '../../run/progression';

/** The Evolution, waiting on the player. */
export interface Evolving {
  rosterId: string;
  node: EvolutionNode;
}

/** A path's granted move the four-move cap refused, offered as a replace-or-decline. */
export interface Overflow {
  rosterId: string;
  queue: string[];
}

/** The companion's tier-step (run/companion.ts): the pip a hero would evolve at, and the pip it would take its signature at. */
export interface Grown {
  rosterId: string;
  fromHeroId: string;
  toHeroId: string;
}

/**
 * What a hero's Mastery pips owe it, paid one screen at a time (docs/mastery.md §2): the
 * Evolution as a screen of its own, the companion's tier-step as its plate, and the granted
 * move's overflow as the replace-or-decline a level makes. Raised on the node that landed the
 * pip, and — for a hire that arrived past the pip unevolved — on its next level-up report.
 */
export interface MasteryFlow {
  evolving: Evolving | null;
  grown: Grown | null;
  overflow: Overflow | null;
  /** Something is on screen waiting on the player. */
  busy: boolean;
  /**
   * Raise whatever this hero's pips now owe. False when nothing is. `on` is the run to read —
   * the caller that has just landed a pip and not yet re-rendered passes the landed state.
   */
  raise: (rosterId: string, on?: RunState) => boolean;
  closeGrown: () => void;
  chooseEvolution: (pathId: string) => void;
  resolveOverflow: (replaceMoveId: string | null, learn: boolean) => void;
}

export function useMasteryFlow(run: RunState, onRunChange: (next: RunState) => void): MasteryFlow {
  const [evolving, setEvolving] = useState<Evolving | null>(null);
  const [grown, setGrown] = useState<Grown | null>(null);
  const [overflow, setOverflow] = useState<Overflow | null>(null);

  function raise(rosterId: string, on: RunState = run): boolean {
    const entry = on.roster.find((r) => r.rosterId === rosterId);
    if (!entry) return false;
    const stepTo = companionTierStep(entry);
    if (stepTo) {
      onRunChange(applyCompanionTierStep(on, rosterId));
      setGrown({ rosterId, fromHeroId: entry.heroId, toHeroId: stepTo });
      return true;
    }
    const node = availableEvolution(progressionTable, entry);
    if (node && node.paths.length > 0) {
      setEvolving({ rosterId, node });
      return true;
    }
    return false;
  }

  function chooseEvolution(pathId: string) {
    if (!evolving) return;
    const entry = run.roster.find((r) => r.rosterId === evolving.rosterId);
    const path = evolving.node.paths.find((p) => p.id === pathId);
    if (!entry || !path) return;
    // Read BEFORE the choice lands: the path's moves that MOVE_CAP refused become the same
    // replace-or-decline offer a level makes, one at a time.
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
    evolving,
    grown,
    overflow,
    busy: !!evolving || !!grown || !!overflow,
    raise,
    closeGrown: () => setGrown(null),
    chooseEvolution,
    resolveOverflow,
  };
}
