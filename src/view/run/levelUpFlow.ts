import { useState } from 'react';
import { rosterHeroes as heroes } from '../../data/content';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import { applyCompanionTierStep, companionTierStep } from '../../run/companion';
import type { RunState } from '../../run/state';
import {
  MOVE_CAP,
  applyEvolutionMoves,
  availableEvolution,
  chooseEvolutionPath,
  grantOfferedMove,
  levelMovePool,
  pendingScheduleEntry,
  recordMoveOffer,
  takeScheduleEntry,
  type EvolutionNode,
} from '../../run/progression';
import { playSfx } from '../../audio/sfx';

/**
 * What a schedule entry has raised. Below the cap the move is already LEARNED and the box only
 * says so; at the cap it is still a question — which of the four goes.
 */
export interface ScheduleOffer {
  rosterId: string;
  moveId: string;
  learned: boolean;
}

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

/** The companion's tier-step (run/companion.ts): its Evolution level, and the level that opens Late. */
export interface Grown {
  rosterId: string;
  fromHeroId: string;
  toHeroId: string;
}

/**
 * What the level-up report is paying out, one hero at a time (docs/xp-overhaul.md §4): a hero
 * whose level has reached a schedule entry takes it here — an offer rolled from the band the
 * level opened, or the Evolution, which is a screen of its own, or the companion's tier-step.
 * The report gains exactly one decision kind and must not gain a second.
 */
export interface LevelUpFlow {
  offer: ScheduleOffer | null;
  evolving: Evolving | null;
  grown: Grown | null;
  overflow: Overflow | null;
  /** Something is on screen waiting on the player. */
  busy: boolean;
  /** Pay the next owed entry among `rosterIds`, in that order. False when nobody is owed anything. */
  next: (rosterIds: readonly string[]) => boolean;
  closeGrown: () => void;
  resolveOffer: (replaceMoveId: string | null, learn: boolean) => void;
  closeOffer: () => void;
  chooseEvolution: (pathId: string) => void;
  resolveOverflow: (replaceMoveId: string | null, learn: boolean) => void;
}

export function useLevelUpFlow(run: RunState, onRunChange: (next: RunState) => void): LevelUpFlow {
  const [offer, setOffer] = useState<ScheduleOffer | null>(null);
  const [evolving, setEvolving] = useState<Evolving | null>(null);
  const [grown, setGrown] = useState<Grown | null>(null);
  const [overflow, setOverflow] = useState<Overflow | null>(null);

  /**
   * The entry's offer, rolled off the post-level entry. A dry band takes the entry and puts
   * nothing in front of anyone — the level's growth was the whole of what changed.
   */
  function rollOffer(rosterId: string): boolean {
    const current = run.roster.find((r) => r.rosterId === rosterId)!;
    const pool = levelMovePool(progressionTable, moves, heroes[current.heroId], current);
    let next = takeScheduleEntry(run, rosterId);
    if (pool.length === 0) {
      onRunChange(next);
      return false;
    }
    const moveId = pool[Math.floor(Math.random() * pool.length)];
    // The offer is spent by being MADE — declining still burns it (docs/leveling-and-ranks.md).
    next = recordMoveOffer(next, rosterId, [moveId]);
    // Room in the kit: the move simply lands (2026-09-10, per user direction). "Learn or decline"
    // was a question with one sane answer. At the cap the question is real, and it is still asked.
    const learned = current.unlockedMoveIds.length < MOVE_CAP;
    if (learned) next = grantOfferedMove(next, rosterId, moveId);
    onRunChange(next);
    playSfx('scroll.spend');
    setOffer({ rosterId, moveId, learned });
    return true;
  }

  function next(rosterIds: readonly string[]): boolean {
    for (const rosterId of rosterIds) {
      const entry = run.roster.find((r) => r.rosterId === rosterId);
      if (!entry) continue;
      const hero = heroes[entry.heroId];
      const owed = pendingScheduleEntry(hero, entry);
      if (!owed) continue;
      if (owed.kind === 'step') {
        // The companion's tier-step, in place of a branch and in place of an offer (docs/titanspawn-
        // overhaul.md §5): the same creature in its next body is what this level bought. A Late
        // body has nowhere to step to, and the entry is simply taken.
        const stepTo = companionTierStep(hero, entry);
        if (!stepTo) {
          onRunChange(takeScheduleEntry(run, rosterId));
          continue;
        }
        onRunChange(applyCompanionTierStep(run, rosterId, heroes));
        setGrown({ rosterId, fromHeroId: entry.heroId, toHeroId: stepTo });
        return true;
      }
      if (owed.kind === 'evolution') {
        const node = availableEvolution(progressionTable, hero, entry);
        if (!node || node.paths.length === 0) {
          onRunChange(takeScheduleEntry(run, rosterId));
          continue;
        }
        setEvolving({ rosterId, node });
        return true;
      }
      if (rollOffer(rosterId)) return true;
      // A dry band took the entry; the run has changed under us, so let the caller re-enter.
      return true;
    }
    return false;
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
    offer,
    evolving,
    grown,
    overflow,
    busy: !!offer || !!evolving || !!grown || !!overflow,
    next,
    closeGrown: () => setGrown(null),
    resolveOffer,
    closeOffer: () => setOffer(null),
    chooseEvolution,
    resolveOverflow,
  };
}
