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
 */
export function LevelUpScreen({ run, onRunChange, onDone }: Props) {
  const [offer, setOffer] = useState<MoveOffer | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  function handleLevelUp(rosterId: string) {
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
      return;
    }

    const moveId = pool[Math.floor(Math.random() * pool.length)];
    if (!wasAtCap) {
      onRunChange(grantLevelUpMove(next, rosterId, moveId));
      setLastMessage(`${hero.name} reached level ${newLevel} and learned ${moves[moveId].name}!`);
    } else {
      onRunChange(next);
      setOffer({ rosterId, moveId });
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
    setOffer(null);
  }

  const offerEntry = offer ? (run.roster.find((r) => r.rosterId === offer.rosterId) ?? null) : null;

  return (
    <div className="node-screen">
      <div className="screen-scroll">
        <h2>📈 Level Up — {run.levelUpPool} pts remaining</h2>
        <p className="hint">Spend every Training Point before continuing.</p>
        {lastMessage && <p className="hint">{lastMessage}</p>}

        {offer && offerEntry ? (
          <div className="reward-panel">
            <h3>
              {heroes[offerEntry.heroId].name} is offered {moves[offer.moveId].name} — already at {MOVE_CAP} moves.
            </h3>
            <div className="roster-grid">
              {offerEntry.unlockedMoveIds.map((moveId) => (
                <button key={moveId} className="roster-card" onClick={() => resolveOffer(moveId)}>
                  <div className="roster-card-name">Replace {moves[moveId].name}</div>
                </button>
              ))}
              <button className="roster-card" onClick={() => resolveOffer(null)}>
                <div className="roster-card-name">Decline — keep current moves</div>
              </button>
            </div>
          </div>
        ) : (
          <div className="roster-grid">
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              const node = availableRankUp(progressionTable, entry);
              return (
                <div key={entry.rosterId} className="training-hero">
                  <h3>
                    {hero.name} — Lv {entry.level}
                  </h3>
                  <button className="move-button" disabled={run.levelUpPool < 1} onClick={() => handleLevelUp(entry.rosterId)}>
                    Level Up (1 pt)
                  </button>
                  {node && (
                    <div className="training-row">
                      <span className="hint">Rank-up ready — choose a branch:</span>
                      {node.branches.map((branch) => (
                        <button
                          key={branch.id}
                          className="move-button"
                          onClick={() => onRunChange(chooseRankUpBranch(run, progressionTable, heroes, entry.rosterId, branch.id))}
                        >
                          {branch.name} ({branch.kind})
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
