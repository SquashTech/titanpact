import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { RunState } from '../../run/state';
import {
  levelUpHero,
  levelUpMovePool,
  grantLevelUpMove,
  availableRankUp,
  chooseRankUpBranch,
  MOVE_CAP,
  ProgressionError,
} from '../../run/progression';
import { getTypeColor } from '../combat/typeColors';
import { MoveTile, MoveInfoPanel } from '../shared/MoveTile';
import { TypeBadge } from '../shared/TypeBadge';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onDone: () => void;
}

interface MoveOffer {
  rosterId: string;
  moveId: string;
}

/**
 * Forced immediately-after-battle spend screen (CLAUDE.md "After winning a
 * fight, you are given training points that must be instantly allocated
 * before the run continues"). Every Training Point earned must be put into a
 * hero here before Continue unlocks — replaces the old "spend whenever, via
 * Manage Roster" flow. Manage Roster (RosterManagementScreen) is now
 * inspection/equipment-only and never spends the pool.
 *
 * Each hero card is itself the level-up button (tap the card to spend a
 * point on that hero) — there's no separate "Level Up" button to hunt for.
 * Move details live in a single fixed info panel near the top of the screen
 * rather than a cursor-anchored tooltip, so they read the same regardless of
 * where on the (portrait, narrow) screen the hero card sits.
 */
export function LevelUpScreen({ run, onRunChange, onDone }: Props) {
  const [offer, setOffer] = useState<MoveOffer | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  /** The move currently shown in the fixed info panel, and why it's there. */
  const [viewedMoveId, setViewedMoveId] = useState<string | null>(null);
  const [viewedLabel, setViewedLabel] = useState<string>('');

  function showMoveInfo(moveId: string, label: string) {
    setViewedMoveId(moveId);
    setViewedLabel(label);
  }

  function handleLevelUp(rosterId: string) {
    if (run.levelUpPool < 1) return;
    const entry = run.roster.find((r) => r.rosterId === rosterId);
    if (!entry) return;
    const hero = heroes[entry.heroId];
    const pool = levelUpMovePool(progressionTable, entry);
    const wasAtCap = entry.unlockedMoveIds.length >= MOVE_CAP;
    const newLevel = entry.level + 1;

    let next: RunState;
    try {
      next = levelUpHero(run, rosterId);
    } catch (err) {
      if (err instanceof ProgressionError) return;
      throw err;
    }

    if (pool.length === 0) {
      onRunChange(next);
      setLastMessage(`${hero.name} reached level ${newLevel}.`);
      setViewedMoveId(null);
      return;
    }

    const moveId = pool[Math.floor(Math.random() * pool.length)];
    if (!wasAtCap) {
      onRunChange(grantLevelUpMove(next, rosterId, moveId));
      setLastMessage(`${hero.name} reached level ${newLevel} and learned ${moves[moveId].name}!`);
      showMoveInfo(moveId, `${hero.name} — move learned`);
    } else {
      onRunChange(next);
      setOffer({ rosterId, moveId });
      showMoveInfo(moveId, `${hero.name} — move offered`);
    }
  }

  function resolveOffer(replaceMoveId: string | null) {
    if (!offer) return;
    const entry = run.roster.find((r) => r.rosterId === offer.rosterId);
    const hero = entry ? heroes[entry.heroId] : null;
    if (replaceMoveId) {
      onRunChange(grantLevelUpMove(run, offer.rosterId, offer.moveId, replaceMoveId));
      if (hero) setLastMessage(`${hero.name} swapped in ${moves[offer.moveId].name}.`);
    } else if (hero) {
      setLastMessage(`${hero.name} kept its current moves.`);
    }
    setViewedMoveId(null);
    setOffer(null);
  }

  const offerEntry = offer ? (run.roster.find((r) => r.rosterId === offer.rosterId) ?? null) : null;
  const viewedMove = viewedMoveId ? moves[viewedMoveId] : null;

  return (
    <div className="node-screen">
      <div className="screen-scroll">
        <h2 className="squad-section-title">📈 Level Up — {run.levelUpPool} pts remaining</h2>
        <p className="hint">Spend every Training Point before continuing.</p>

        <MoveInfoPanel
          move={viewedMove}
          label={viewedLabel}
          placeholder={lastMessage ?? 'Hover or tap a move to see its details here.'}
        />

        {offer && offerEntry ? (
          <div className="reward-panel">
            <h3>
              {heroes[offerEntry.heroId].name} is already at {MOVE_CAP} moves — pick one to replace, or decline.
            </h3>
            <div className="roster-grid">
              {offerEntry.unlockedMoveIds.map((moveId) => (
                <button key={moveId} className="roster-card" onClick={() => resolveOffer(moveId)}>
                  <div className="roster-card-name">Replace {moves[moveId].name}</div>
                  <div className="roster-card-types">
                    <MoveTile move={moves[moveId]} />
                  </div>
                </button>
              ))}
              <button className="roster-card" onClick={() => resolveOffer(null)}>
                <div className="roster-card-name">Decline — keep current moves</div>
              </button>
            </div>
          </div>
        ) : (
          <div className="training-hero-list">
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              const node = availableRankUp(progressionTable, entry);
              const canLevelUp = run.levelUpPool >= 1;
              return (
                <div
                  key={entry.rosterId}
                  className={`training-hero${canLevelUp ? '' : ' training-hero-disabled'}`}
                  style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
                  role="button"
                  tabIndex={canLevelUp ? 0 : -1}
                  aria-disabled={!canLevelUp}
                  onClick={() => handleLevelUp(entry.rosterId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleLevelUp(entry.rosterId);
                    }
                  }}
                >
                  <div className="training-hero-head">
                    <h3>
                      {hero.name} — Lv {entry.level}
                    </h3>
                    <span className="training-hero-cta">{canLevelUp ? 'Tap to level up' : 'No points'}</span>
                  </div>
                  <div className="roster-card-types">
                    {hero.types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                  <div className="move-tile-row">
                    {entry.unlockedMoveIds.map((moveId) =>
                      moves[moveId] ? (
                        <MoveTile
                          key={moveId}
                          move={moves[moveId]}
                          selected={viewedMoveId === moveId}
                          onSelect={() => showMoveInfo(moveId, `${hero.name}`)}
                        />
                      ) : null
                    )}
                  </div>
                  {node && (
                    <div className="training-row" onClick={(e) => e.stopPropagation()}>
                      <span className="hint">Rank-up ready — choose a branch:</span>
                      {node.branches.map((branch) => (
                        <button
                          key={branch.id}
                          className={`rankup-branch-button rankup-${branch.kind}`}
                          onClick={() => onRunChange(chooseRankUpBranch(run, progressionTable, heroes, entry.rosterId, branch.id))}
                        >
                          <span className="rankup-branch-name">{branch.name}</span>
                          <span className="rankup-branch-kind">{branch.kind}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <button className="resolve-button" disabled={run.levelUpPool > 0 || !!offer} onClick={onDone}>
        Continue
      </button>
    </div>
  );
}
