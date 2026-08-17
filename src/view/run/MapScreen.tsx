import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import { reachableNodeIds } from '../../run/runProgress';
import type { MapNodeType } from '../../run/map';
import { RosterManagementScreen } from './RosterManagementScreen';
import { TypeChartOverlay } from '../shared/TypeChartOverlay';
import { RelicsOverlay } from './RelicsOverlay';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onSelectNode: (nodeId: string) => void;
}

const NODE_ICONS: Record<MapNodeType, string> = {
  fight: '⚔️',
  elite: '💀',
  boss: '👑',
  shop: '🏪',
  equipmentReward: '🛡️',
  relicReward: '💠',
  currencyReward: '💰',
  upgradeReward: '📈',
  contractReward: '📜',
};

const NODE_NAMES: Record<MapNodeType, string> = {
  fight: 'Fight',
  elite: 'Elite',
  boss: 'Ancient',
  shop: 'Guild Hall',
  equipmentReward: 'Equipment',
  relicReward: 'Relic',
  currencyReward: 'Gold',
  upgradeReward: 'Training',
  contractReward: 'Contract',
};

/** Per-type accent color, keyed to the existing palette (styles.css :root) so nodes read at a glance. */
const NODE_COLORS: Record<MapNodeType, string> = {
  fight: 'var(--enemy)',
  elite: 'var(--crit)',
  boss: 'var(--accent)',
  shop: 'var(--mana)',
  equipmentReward: 'var(--physical)',
  relicReward: 'var(--magical)',
  currencyReward: 'var(--accent)',
  upgradeReward: 'var(--hp-high)',
  contractReward: 'var(--ally)',
};

/**
 * The run's hub screen (docs/run-loop.md): a branching map the player
 * ascends node by node, plus always-on access to Manage Roster — full stat
 * spreads and equipment reassignment (RosterManagementScreen). Training
 * Points are no longer spent here: they're forced-allocated immediately
 * after a win via LevelUpScreen (App.tsx), so by the time the player is back
 * on the map `run.levelUpPool` is always 0 — nothing to show in the header.
 */
export function MapScreen({ run, onRunChange, onSelectNode }: Props) {
  const [showRoster, setShowRoster] = useState(false);
  const [showTypeChart, setShowTypeChart] = useState(false);
  const [showRelics, setShowRelics] = useState(false);
  const map = run.map;
  if (!map) return null;

  const reachable = new Set(reachableNodeIds(run));
  const visited = new Set(run.visitedNodeIds);
  const rowsTopDown = [...map.rows].reverse();

  return (
    <div className="map-screen">
      <div className="map-header">
        <button className="log-toggle-button" onClick={() => setShowRelics(true)}>
          💠 Relics{run.relics.length > 0 ? ` (${run.relics.length})` : ''}
        </button>
        <button className="log-toggle-button" onClick={() => setShowRoster(true)}>
          Manage Roster
        </button>
        <button className="log-toggle-button" onClick={() => setShowTypeChart(true)}>
          Type Chart
        </button>
        <div className="map-header-right">
          <span title="Gold">💰 {run.gold}</span>
          <span title="Recruit Contracts">📜 {run.recruitContracts}</span>
        </div>
      </div>

      <div className="map-scroll screen-scroll">
        {rowsTopDown.map((rowIds, rowIndex) => (
          <div className="map-row-wrap" key={rowIndex}>
            {rowIndex > 0 && <div className="map-row-connector" aria-hidden="true" />}
            <div className="map-row">
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
                  <button
                    key={nodeId}
                    className={classes}
                    style={{ '--node-color': NODE_COLORS[node.type] } as CSSProperties}
                    disabled={!isReachable}
                    onClick={() => onSelectNode(nodeId)}
                  >
                    <span className="map-node-icon">{NODE_ICONS[node.type]}</span>
                    <span className="map-node-name">{NODE_NAMES[node.type]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {showRoster && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setShowRoster(false)} />}
      {showTypeChart && <TypeChartOverlay onClose={() => setShowTypeChart(false)} />}
      {showRelics && <RelicsOverlay ownedRelicIds={run.relics} onClose={() => setShowRelics(false)} />}
    </div>
  );
}
