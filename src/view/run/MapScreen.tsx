import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import { TOTAL_ACTS } from '../../run/state';
import { reachableNodeIds } from '../../run/runProgress';
import type { MapNodeType } from '../../run/map';
import { RosterManagementScreen } from './RosterManagementScreen';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { RelicsOverlay } from './RelicsOverlay';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onSelectNode: (nodeId: string) => void;
}

const NODE_ICONS: Record<MapNodeType, string> = {
  fight: '⚔️',
  skirmish: '🤺',
  battle: '🗡️',
  elite: '💀',
  boss: '👑',
  shop: '🏪',
  equipmentReward: '🛡️',
  relicReward: '💠',
  currencyReward: '💰',
  upgradeReward: '📈',
  weaponReward: '🏹',
  armorReward: '🪖',
  accessoryReward: '💍',
  hpBoostReward: '❤️',
  manaBoostReward: '💧',
  event: '❓',
};

const NODE_NAMES: Record<MapNodeType, string> = {
  fight: 'Fight',
  skirmish: 'Skirmish',
  battle: 'Battle',
  elite: 'Elite',
  boss: 'Ancient',
  shop: 'Guild Hall',
  equipmentReward: 'Equipment',
  relicReward: 'Relic',
  currencyReward: 'Gold',
  upgradeReward: 'Training',
  weaponReward: 'Weapon',
  armorReward: 'Armor',
  accessoryReward: 'Accessory',
  hpBoostReward: 'Vitality',
  manaBoostReward: 'Mana',
  event: 'Event',
};

/**
 * Per-type accent color, keyed to the existing palette (styles.css :root) so
 * nodes read at a glance. `weaponReward`/`armorReward`/`accessoryReward`/
 * `hpBoostReward`/`manaBoostReward` reuse the same color language StatBars.tsx
 * (STAT_COLORS) already established per-stat (attack red, defense gray, hp
 * green, manaPool blue) so a player who's learned that vocabulary reading
 * hero stat blocks recognizes it on the map too. `event` gets a neutral gray
 * — it's an unknown/mystery placeholder, not tied to any stat.
 */
const NODE_COLORS: Record<MapNodeType, string> = {
  fight: 'var(--enemy)',
  skirmish: 'var(--ally)',
  battle: 'var(--ally)',
  elite: 'var(--crit)',
  boss: 'var(--accent)',
  shop: 'var(--mana)',
  equipmentReward: 'var(--physical)',
  relicReward: 'var(--magical)',
  currencyReward: 'var(--accent)',
  upgradeReward: 'var(--hp-high)',
  weaponReward: 'var(--enemy)',
  armorReward: '#8a94a8',
  accessoryReward: '#7fd6e0',
  hpBoostReward: 'var(--hp-high)',
  manaBoostReward: 'var(--mana)',
  event: 'var(--tier-common)',
};

/**
 * Bottom-of-screen hub nav (2026-08-17 revision, per user direction): the
 * three always-on overlays (Relics/Roster/Reference) moved out of the
 * header into a flavorful footer row, using the same "fixed row of secondary
 * actions" containment pattern FightScreen's .bottom-bar already established
 * (CLAUDE.md architecture note in styles.css .bottom-bar) — .map-scroll keeps
 * the flex-fill/internal-scroll role, this row just sits below it instead of
 * inside the header. Each button gets its own accent color (mirroring
 * NODE_COLORS below) so the row reads as a small "hub signpost" rather than
 * generic pills.
 */
const FOOTER_BUTTONS: readonly { key: 'relics' | 'roster' | 'reference'; icon: string; label: string; color: string }[] = [
  { key: 'relics', icon: '💠', label: 'Relics', color: 'var(--magical)' },
  { key: 'roster', icon: '👥', label: 'Roster', color: 'var(--ally)' },
  { key: 'reference', icon: '📖', label: 'Reference', color: 'var(--accent)' },
];

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
  const [showReference, setShowReference] = useState(false);
  const [showRelics, setShowRelics] = useState(false);
  const map = run.map;
  if (!map) return null;

  const reachable = new Set(reachableNodeIds(run));
  const visited = new Set(run.visitedNodeIds);
  const rowsTopDown = [...map.rows].reverse();

  const openFooterOverlay: Record<(typeof FOOTER_BUTTONS)[number]['key'], () => void> = {
    relics: () => setShowRelics(true),
    roster: () => setShowRoster(true),
    reference: () => setShowReference(true),
  };

  return (
    <div className="map-screen">
      <div className="map-header">
        <span className="map-stat" title="Act">
          🗺️ Act {run.actNumber}/{TOTAL_ACTS}
        </span>
        <span className="map-stat" title="Gold">
          💰 {run.gold}
        </span>
        <span className="map-stat" title="Recruit Contracts">
          📜 {run.recruitContracts}
        </span>
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

      <div className="map-footer">
        {FOOTER_BUTTONS.map(({ key, icon, label, color }) => (
          <button
            key={key}
            className="map-footer-button"
            style={{ '--btn-color': color } as CSSProperties}
            onClick={openFooterOverlay[key]}
          >
            <span className="map-footer-icon">{icon}</span>
            <span className="map-footer-label">{label}</span>
            {key === 'relics' && run.relics.length > 0 && <span className="map-footer-badge">{run.relics.length}</span>}
          </button>
        ))}
      </div>

      {showRoster && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setShowRoster(false)} />}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
      {showRelics && <RelicsOverlay ownedRelicIds={run.relics} onClose={() => setShowRelics(false)} />}
    </div>
  );
}
