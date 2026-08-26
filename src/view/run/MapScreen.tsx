import { useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import { TOTAL_ACTS } from '../../run/state';
import { reachableNodeIds } from '../../run/runProgress';
import type { MapNode, MapNodeType } from '../../run/map';
import { useLongPress } from '../shared/MoveTile';
import { RosterManagementScreen } from './RosterManagementScreen';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { RelicsOverlay } from './RelicsOverlay';
import { ResourceMark, RunGlyph, type RunGlyphKind } from '../shared/RunGlyph';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onSelectNode: (nodeId: string) => void;
}

const NODE_NAMES: Record<MapNodeType, string> = {
  fight: 'Fight',
  skirmish: 'Skirmish',
  battle: 'Monsters',
  elite: 'Elite',
  boss: 'Ancient',
  shop: 'Guild Hall',
  equipmentReward: 'Equipment',
  relicReward: 'Relic',
  currencyReward: 'Gold',
  upgradeReward: 'XP',
  weaponReward: 'Weapon',
  armorReward: 'Armor',
  accessoryReward: 'Accessory',
  hpBoostReward: 'Vitality',
  manaBoostReward: 'Mana',
  manaRegenBoostReward: 'Regen',
  classReward: 'Mentor',
  event: 'Event',
};

/**
 * Per-type accent color, keyed to the existing palette (styles.css :root) so
 * nodes read at a glance. `weaponReward`/`armorReward`/`accessoryReward`/
 * `hpBoostReward`/`manaBoostReward`/`manaRegenBoostReward` reuse the same
 * color language StatBars.tsx (STAT_COLORS) already established per-stat
 * (attack red, defense gray, hp green, manaPool blue, mpRegen teal) so a
 * player who's learned that vocabulary reading hero stat blocks recognizes
 * it on the map too. `event` gets a neutral gray — it's an unknown/mystery
 * placeholder, not tied to any stat.
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
  manaRegenBoostReward: '#4cd9a0',
  classReward: 'var(--buff)',
  event: 'var(--tier-common)',
};

/**
 * Long-press preview text (2026-08-22, per user direction: "let players
 * preview what they may encounter"), one line per node type — mechanical
 * shape + pool, not flavor fiction, matching this game's existing
 * "spell the math out" transparency (Battle Log, item stat-grant previews).
 * `battle`'s "Monsters" framing and non-recruitable pool is the same
 * 2026-08-22 decision as its map-facing rename (see src/run/map.ts).
 */
const NODE_DESCRIPTIONS: Record<MapNodeType, string> = {
  fight: 'A weak Monster squad (4v4, no bonus) — not recruitable. The act’s opener.',
  skirmish: 'A recruitable hero squad (4v4, no bonus). Win to claim a Recruit Contract.',
  battle: 'A Monster squad (4v4, no bonus) — not recruitable, same pool as Fight.',
  elite: 'A recruitable hero squad, each with +10 to 2 stats. Tougher than a Skirmish.',
  boss: 'The act’s Ancient: 2 heroes, no bench, each with +20 to 3 stats. Ends the act.',
  shop: 'Guild Hall: spend gold on hero recruits, equipment, and relics before the boss.',
  equipmentReward: 'Pick 1 of 3 equipment items.',
  relicReward: 'Pick 1 of 3 team-wide relics.',
  currencyReward: 'An instant grant of gold.',
  upgradeReward: 'An instant grant to your pooled level-up currency.',
  weaponReward: 'A guaranteed weapon (no 3-choice pick).',
  armorReward: 'A guaranteed piece of armor (no 3-choice pick).',
  accessoryReward: 'A guaranteed accessory (no 3-choice pick).',
  hpBoostReward: '+20 max HP, permanent for the run, to one hero you choose.',
  manaBoostReward: '+10 max Mana, permanent for the run, to one hero you choose.',
  manaRegenBoostReward: '+5 Mana Regen, permanent for the run, to one hero you choose.',
  classReward: 'Mentor’s Hall: pick a Class, then a hero with no Class yet to teach it to.',
  event: 'Unknown — not yet implemented.',
};

/**
 * One map node button. Split out from MapScreen's row-render loop because
 * `useLongPress` is a hook and can't be called from inside a `.map()`
 * callback. A long press (any node, including locked/visited ones — a
 * harmless info action) opens the preview popup; a plain tap still only
 * advances the run, and only when the node is actually reachable. The
 * `disabled` attribute is deliberately NOT used (unlike before this
 * long-press feature): disabled form controls suppress pointer events in
 * most browsers, which would silently kill long-press on every locked node
 * too — reachability is instead enforced in the click handler, same as the
 * dimmed-but-inert look `.map-node.locked` already conveys purely via CSS.
 */
function MapNodeButton({
  node,
  isCurrent,
  isReachable,
  isVisited,
  onSelect,
  onPreview,
}: {
  node: MapNode;
  isCurrent: boolean;
  isReachable: boolean;
  isVisited: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  const classes = [
    'map-node',
    isCurrent ? 'current' : '',
    isReachable ? 'reachable' : '',
    isVisited ? 'visited' : '',
    !isReachable && !isVisited && !isCurrent ? 'locked' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const longPress = useLongPress(onPreview, () => {
    if (isReachable) onSelect();
  });

  return (
    <button
      type="button"
      className={classes}
      style={{ '--node-color': NODE_COLORS[node.type] } as CSSProperties}
      aria-disabled={!isReachable}
      {...longPress}
    >
      <span className="map-node-name">{NODE_NAMES[node.type]}</span>
    </button>
  );
}

/**
 * Long-press preview popup (2026-08-22) — reuses the .log-overlay/.log-panel
 * "tap anywhere to close" pattern already established for MoveInfoPanel's
 * long-press popup (MoveTile.tsx), so holding a map node feels like the same
 * gesture as holding a move.
 */
function MapNodePreviewPopup({ node, onClose }: { node: MapNode; onClose: () => void }) {
  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel move-popup-panel" style={{ '--node-color': NODE_COLORS[node.type] } as CSSProperties}>
        <div className="log-panel-header">
          <span>
            {NODE_NAMES[node.type]}
          </span>
        </div>
        <div className="move-popup-description">{NODE_DESCRIPTIONS[node.type]}</div>
        <div className="move-popup-hint">Tap anywhere to close</div>
      </div>
    </div>
  );
}

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
const FOOTER_BUTTONS: readonly { key: 'relics' | 'roster' | 'reference'; icon: RunGlyphKind | null; mark: string; label: string; color: string }[] = [
  { key: 'relics', icon: 'relic', mark: 'R', label: 'Relics', color: 'var(--magical)' },
  { key: 'roster', icon: null, mark: 'II', label: 'Roster', color: 'var(--ally)' },
  { key: 'reference', icon: 'guild', mark: 'i', label: 'Reference', color: 'var(--accent)' },
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
  const [previewNode, setPreviewNode] = useState<MapNode | null>(null);
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
          <ResourceMark label="ACT" tone="blue" /> {run.actNumber}/{TOTAL_ACTS}
        </span>
        <span className="map-stat" title="Gold">
          <ResourceMark label="G" /> {run.gold}
        </span>
        <span className="map-stat" title="Recruit Contracts">
          <ResourceMark label="C" tone="green" /> {run.recruitContracts}
        </span>
      </div>

      <div className="map-scroll screen-scroll">
        {rowsTopDown.map((rowIds, rowIndex) => (
          <div className="map-row-wrap" key={rowIndex}>
            {rowIndex > 0 && <div className="map-row-connector" aria-hidden="true" />}
            <div className="map-row">
              {rowIds.map((nodeId) => {
                const node = map.nodes[nodeId];
                return (
                  <MapNodeButton
                    key={nodeId}
                    node={node}
                    isCurrent={run.currentNodeId === nodeId}
                    isReachable={reachable.has(nodeId)}
                    isVisited={visited.has(nodeId)}
                    onSelect={() => onSelectNode(nodeId)}
                    onPreview={() => setPreviewNode(node)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="map-footer">
        {FOOTER_BUTTONS.map(({ key, icon, mark, label, color }) => (
          <button
            key={key}
            className="map-footer-button"
            style={{ '--btn-color': color } as CSSProperties}
            onClick={openFooterOverlay[key]}
          >
            <span className="map-footer-icon">{icon ? <RunGlyph kind={icon} /> : <ResourceMark label={mark} tone="blue" />}</span>
            <span className="map-footer-label">{label}</span>
            {key === 'relics' && run.relics.length > 0 && <span className="map-footer-badge">{run.relics.length}</span>}
          </button>
        ))}
      </div>

      {showRoster && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setShowRoster(false)} />}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
      {showRelics && <RelicsOverlay ownedRelicIds={run.relics} onClose={() => setShowRelics(false)} />}
      {previewNode && <MapNodePreviewPopup node={previewNode} onClose={() => setPreviewNode(null)} />}
    </div>
  );
}
