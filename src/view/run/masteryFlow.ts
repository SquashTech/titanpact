import { useState } from 'react';
import { rosterHeroes as heroes } from '../../data/content';
import { progressionTable } from '../../data/progression';
import { applyCompanionTierStep, companionTierStep } from '../../run/companion';
import { MASTERY_INNATE } from '../../run/mastery';
import { masteredInnateFor } from '../../run/innate';
import type { RunState } from '../../run/state';
import { MOVE_CAP, applyEvolutionMoves, availableEvolution, chooseEvolutionPath, grantOfferedMove, type EvolutionNode } from '../../run/progression';
import { curseOf, curseTurnOwed } from '../../run/curse';
import { turnCurse } from '../../run/events';

/** The Evolution, waiting on the player. */
export interface Evolving {
  rosterId: string;
  node: EvolutionNode;
}

/** A path's granted move the four-move cap refused, offered as a replace-or-decline. */
export interface Overflow {
  rosterId: string;
  queue: string[];
  /** What granted it, for the offer's eyebrow; omitted reads as the Evolution. */
  eyebrow?: string;
}

/**
 * The innate the tenth pip has mastered (docs/mastery.md §5b). Nothing to decide — the upgrade
 * is the hero's the moment the pip lands — so this is a reveal, raised once, on the node that
 * paid the pip.
 */
export interface Mastered {
  rosterId: string;
  /** A curse's Turn (run/curse.ts) rather than the tenth pip — the same reveal, louder. */
  turn?: boolean;
  /** The Turn's move, when the kit was full: offered as a replace-or-decline once the reveal closes. */
  pendingMoveId?: string;
}

/** The companion's tier-step (run/companion.ts): the pip a hero would evolve at, and the pip it would master its innate at. */
export interface Grown {
  rosterId: string;
  fromHeroId: string;
  toHeroId: string;
}

/**
 * What a hero's Mastery pips owe it, paid one screen at a time (docs/mastery.md §2): the
 * Evolution as a screen of its own, the companion's tier-step as its plate, the granted move's
 * overflow as the replace-or-decline a level makes, and the mastered innate at ten as a reveal.
 * Raised on the node that landed the pip, and — for a hire that arrived past a pip unpaid — on
 * its next level-up report (the Evolution only: the innate needs no beat to be held).
 */
export interface MasteryFlow {
  evolving: Evolving | null;
  grown: Grown | null;
  overflow: Overflow | null;
  mastered: Mastered | null;
  /** Something is on screen waiting on the player. */
  busy: boolean;
  /**
   * Raise whatever this hero's pips now owe. False when nothing is. `on` is the run to read —
   * the caller that has just landed a pip and not yet re-rendered passes the landed state — and
   * `fromMastery` the pips it held before, which is how the tenth pip's reveal is raised once.
   */
  raise: (rosterId: string, on?: RunState, fromMastery?: number) => boolean;
  closeGrown: () => void;
  chooseEvolution: (pathId: string) => void;
  resolveOverflow: (replaceMoveId: string | null, learn: boolean) => void;
  closeMastered: () => void;
}

export function useMasteryFlow(run: RunState, onRunChange: (next: RunState) => void): MasteryFlow {
  const [evolving, setEvolving] = useState<Evolving | null>(null);
  const [grown, setGrown] = useState<Grown | null>(null);
  const [overflow, setOverflow] = useState<Overflow | null>(null);
  const [mastered, setMastered] = useState<Mastered | null>(null);

  function raise(rosterId: string, on: RunState = run, fromMastery?: number): boolean {
    const entry = on.roster.find((r) => r.rosterId === rosterId);
    if (!entry) return false;
    const stepTo = companionTierStep(entry);
    if (stepTo) {
      onRunChange(applyCompanionTierStep(on, rosterId));
      setGrown({ rosterId, fromHeroId: entry.heroId, toHeroId: stepTo });
      return true;
    }
    // A curse's Turn lands ahead of the Evolution its pip also opens: the body first, then the path.
    if (curseTurnOwed(entry)) {
      const curse = curseOf(entry)!;
      const needsRoom = !entry.unlockedMoveIds.includes(curse.moveId) && entry.unlockedMoveIds.length >= MOVE_CAP;
      onRunChange(turnCurse(on, rosterId));
      setMastered({ rosterId, turn: true, ...(needsRoom ? { pendingMoveId: curse.moveId } : {}) });
      return true;
    }
    const node = availableEvolution(progressionTable, entry);
    if (node && node.paths.length > 0) {
      setEvolving({ rosterId, node });
      return true;
    }
    // The tenth pip: the innate, mastered. Held from the moment the pip landed; this only says so.
    if (fromMastery !== undefined && fromMastery < MASTERY_INNATE && entry.mastery >= MASTERY_INNATE && masteredInnateFor(heroes[entry.heroId], entry)) {
      setMastered({ rosterId });
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
    // A Turn's move was the first thing its pip owed; the Evolution the same pip opened comes next.
    if (rest.length === 0 && overflow.eyebrow) raise(overflow.rosterId, next);
  }

  function closeMastered() {
    if (!mastered) return;
    setMastered(null);
    if (mastered.pendingMoveId) setOverflow({ rosterId: mastered.rosterId, queue: [mastered.pendingMoveId], eyebrow: 'The Turn teaches a move — your kit is full' });
    else if (mastered.turn) raise(mastered.rosterId);
  }

  return {
    evolving,
    grown,
    overflow,
    mastered,
    busy: !!evolving || !!grown || !!overflow || !!mastered,
    raise,
    closeGrown: () => setGrown(null),
    chooseEvolution,
    resolveOverflow,
    closeMastered,
  };
}
