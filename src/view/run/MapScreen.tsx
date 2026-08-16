import { useState } from 'react';
import type { RunState } from '../../run/state';
import { reachableNodeIds } from '../../run/runProgress';
import type { MapNodeType } from '../../run/map';
import { RosterManagementScreen } from './RosterManagementScreen';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onSelectNode: (nodeId: string) => void;
}

const NODE_LABELS: Record<MapNodeType, string> = {
  fight: '⚔️ Fight',
  elite: '💀 Elite',
  boss: '👑 Ancient',
  shop: '🏪 Guild Hall',
  equipmentReward: '🛡️ Equipment',
  relicReward: '💠 Relic',
  currencyReward: '💰 Gold',
  upgradeReward: '📈 Training',
  contractReward: '📜 Contract',
};

/**
 * The run's hub screen (docs/run-loop.md): a branching map the player
 * ascends node by node, plus always-on access to Manage Roster — full stat
 * spreads and equipment reassignment (RosterManagementScreen). Training
 * Points are no longer spent here: they're forced-allocated immediately
 * after a win via LevelUpScreen (App.tsx), so by the time the player is back
 * on the map `run.levelUpPool` is always 0.
 */
export function MapScreen({ run, onRunChange, onSelectNode }: Props) {
  const [showRoster, setShowRoster] = useState(false);
  const map = run.map;
  if (!map) return null;

  const reachable = new Set(reachableNodeIds(run));
  const visited = new Set(run.visitedNodeIds);
  const rowsTopDown = [...map.rows].reverse();

  return (
    <div className="map-screen">
      <div className="map-header">
        <span>{run.gold}g</span>
        <span>{run.levelUpPool} training pts</span>
        <span>{run.relics.length} relics</span>
        <span>📜 {run.recruitContracts}</span>
        <button className="log-toggle-button" onClick={() => setShowRoster(true)}>
          Manage Roster
        </button>
      </div>

      <div className="map-scroll screen-scroll">
        {rowsTopDown.map((rowIds, rowIndex) => (
          <div className="map-row" key={rowIndex}>
            {rowIds.map((nodeId) => {
              const node = map.nodes[nodeId];
              const isCurrent = run.currentNodeId === nodeId;
              const isReachable = reachable.has(nodeId);
              const isVisited = visited.has(nodeId);
              const classes = [
                'map-node',
                isCurrent ? 'current' : '',
                isReachable ? 'reachable' : '',
                isVisited ? 'visited' : '',
                !isReachable && !isVisited && !isCurrent ? 'locked' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button key={nodeId} className={classes} disabled={!isReachable} onClick={() => onSelectNode(nodeId)}>
                  {NODE_LABELS[node.type]}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {showRoster && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setShowRoster(false)} />}
    </div>
  );
}
