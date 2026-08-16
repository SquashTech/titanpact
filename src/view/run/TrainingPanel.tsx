import { heroes } from '../../data/heroes';
import { progressionTable } from '../../data/progression';
import type { RunState } from '../../run/state';
import { unlockTierMove, investRankProgress, availableRankUp, chooseRankUpBranch, ProgressionError } from '../../run/progression';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onClose: () => void;
}

/**
 * The previously-missing spend UI for the pooled level-up currency
 * (src/run/progression.ts — docs/progression.md "The level-up currency"):
 * unlockTierMove/investRankProgress/chooseRankUpBranch existed and were
 * fully tested, but nothing in the view layer ever called them (README
 * "Next steps" #4 exploration). Reachable from MapScreen at any time, same
 * spirit as GuildHallPanel being reachable from SquadSelectScreen.
 */
export function TrainingPanel({ run, onRunChange, onClose }: Props) {
  function tryApply(next: RunState) {
    try {
      onRunChange(next);
    } catch (err) {
      if (!(err instanceof ProgressionError)) throw err;
    }
  }

  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel training-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Training — {run.levelUpPool} pts</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="screen-scroll">
          {run.roster.map((entry) => {
            const hero = heroes[entry.heroId];
            const tiers = (progressionTable.moveTiers[entry.heroId] ?? []).filter((t) => !entry.unlockedMoveIds.includes(t.moveId));
            const nodes = progressionTable.rankUps[entry.heroId] ?? [];
            const nextNode = nodes[entry.chosenBranchIds.length] ?? null;
            const offeredNode = availableRankUp(progressionTable, entry);

            return (
              <div key={entry.rosterId} className="training-hero">
                <h3>{hero.name}</h3>

                {tiers.length > 0 && (
                  <div className="training-row">
                    <span className="hint">Moves:</span>
                    {tiers.map((tier) => (
                      <button
                        key={tier.moveId}
                        className="move-button"
                        disabled={run.levelUpPool < tier.cost}
                        onClick={() => tryApply(unlockTierMove(run, progressionTable, entry.rosterId, tier.moveId))}
                      >
                        Unlock {tier.moveId} ({tier.cost} pts)
                      </button>
                    ))}
                  </div>
                )}

                {offeredNode ? (
                  <div className="training-row">
                    <span className="hint">Rank-up ready — choose a branch:</span>
                    {offeredNode.branches.map((branch) => (
                      <button
                        key={branch.id}
                        className="move-button"
                        onClick={() => tryApply(chooseRankUpBranch(run, progressionTable, heroes, entry.rosterId, branch.id))}
                      >
                        {branch.name} ({branch.kind})
                      </button>
                    ))}
                  </div>
                ) : nextNode ? (
                  <div className="training-row">
                    <span className="hint">
                      Rank-up progress: {entry.rankProgress}/{nextNode.threshold}
                    </span>
                    <button
                      className="move-button"
                      disabled={run.levelUpPool < 1}
                      onClick={() => tryApply(investRankProgress(run, entry.rosterId, 1))}
                    >
                      Invest 1 pt
                    </button>
                  </div>
                ) : (
                  <div className="training-row">
                    <span className="hint">No further rank-up path.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
