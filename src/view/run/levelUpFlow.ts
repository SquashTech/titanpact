import { useState } from 'react';
import { rosterHeroes as heroes } from '../../data/content';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { RunState } from '../../run/state';
import { MOVE_CAP, grantOfferedMove, levelMovePool, pendingScheduleEntry, pendingSignature, recordMoveOffer, takeScheduleEntry } from '../../run/progression';
import { playSfx } from '../../audio/sfx';
import { useMasteryFlow, type MasteryFlow } from './masteryFlow';

export type { Evolving, Grown, Mastered, Overflow } from './masteryFlow';

/**
 * What a schedule entry has raised. Below the cap the move is already LEARNED and the box only
 * says so; at the cap it is still a question — which of the four goes.
 */
export interface ScheduleOffer {
  rosterId: string;
  moveId: string;
  learned: boolean;
}

/**
 * The signature a level has reached (docs/mastery.md §5): the hero's own move, guaranteed. Below
 * the cap it is already LEARNED and the box celebrates it; at the cap it is still a question.
 */
export interface SignatureOffer {
  rosterId: string;
  moveId: string;
  learned: boolean;
}

/**
 * What the level-up report is paying out, one hero at a time (docs/xp-overhaul.md §4): a hero
 * whose level has reached a schedule entry takes it here — an offer rolled from the band the
 * level opened, or the hero's signature at its `signatureLevel` — the same decision kind, a move
 * offer, only never rolled. The report carries exactly one decision kind and must not gain a second. What
 * Mastery owes a hero (masteryFlow.ts) is raised on the Scroll node that paid the pip; the
 * report raises it only as the catch-all — a hire that arrived past the pip unevolved.
 */
export interface LevelUpFlow extends MasteryFlow {
  offer: ScheduleOffer | null;
  signature: SignatureOffer | null;
  /** Pay the next owed entry among `rosterIds`, in that order. False when nobody is owed anything. */
  next: (rosterIds: readonly string[]) => boolean;
  resolveOffer: (replaceMoveId: string | null, learn: boolean) => void;
  closeOffer: () => void;
  resolveSignature: (replaceMoveId: string | null, learn: boolean) => void;
  closeSignature: () => void;
}

export function useLevelUpFlow(run: RunState, onRunChange: (next: RunState) => void): LevelUpFlow {
  const [offer, setOffer] = useState<ScheduleOffer | null>(null);
  const [signature, setSignature] = useState<SignatureOffer | null>(null);
  const mastery = useMasteryFlow(run, onRunChange);

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

  /** The signature, taught: spent by being made, as any offer is; below the cap it simply lands. */
  function raiseSignature(rosterId: string, moveId: string) {
    const current = run.roster.find((r) => r.rosterId === rosterId)!;
    let next = recordMoveOffer(run, rosterId, [moveId]);
    const learned = current.unlockedMoveIds.length < MOVE_CAP;
    if (learned) next = grantOfferedMove(next, rosterId, moveId);
    onRunChange(next);
    // No sound here: SignatureBox plays its own fanfare as it mounts.
    setSignature({ rosterId, moveId, learned });
  }

  function next(rosterIds: readonly string[]): boolean {
    for (const rosterId of rosterIds) {
      const entry = run.roster.find((r) => r.rosterId === rosterId);
      if (!entry) continue;
      if (mastery.raise(rosterId)) return true;
      // The signature before the schedule's roll: it is the level's headline when both land.
      const signatureId = pendingSignature(heroes[entry.heroId], entry);
      if (signatureId) {
        raiseSignature(rosterId, signatureId);
        return true;
      }
      const owed = pendingScheduleEntry(heroes[entry.heroId], entry);
      if (!owed) continue;
      // A dry band took the entry; the run has changed under us either way, so let the caller re-enter.
      rollOffer(rosterId);
      return true;
    }
    return false;
  }

  function resolveOffer(replaceMoveId: string | null, learn: boolean) {
    if (!offer) return;
    if (learn) onRunChange(grantOfferedMove(run, offer.rosterId, offer.moveId, replaceMoveId ?? undefined));
    setOffer(null);
  }

  function resolveSignature(replaceMoveId: string | null, learn: boolean) {
    if (!signature) return;
    if (learn) onRunChange(grantOfferedMove(run, signature.rosterId, signature.moveId, replaceMoveId ?? undefined));
    setSignature(null);
  }

  return {
    ...mastery,
    offer,
    signature,
    busy: !!offer || !!signature || mastery.busy,
    next,
    resolveOffer,
    closeOffer: () => setOffer(null),
    resolveSignature,
    closeSignature: () => setSignature(null),
  };
}
