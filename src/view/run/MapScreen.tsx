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
 * Silhouette tier. With the node icons gone, shape and size are the only
 * channels left to say "how much does this node matter" — and they say it
 * better at phone scale than a 22px drawing ever did, because a silhouette
 * survives being small while a drawing does not.
 *
 * Deliberately NOT expressed as clip-path polygons: every reachability signal
 * on this screen is a box-shadow glow (.map-node.reachable/.current), and
 * clip-path would crop it. Pill-vs-plate does the same silhouette work with
 * border-radius alone, which shadows pass through untouched.
 *
 * Keyed by node type as pure data, same as NODE_COLORS/NODE_NAMES — a new
 * node type picks its tier here and inherits the whole treatment.
 */
type NodeTier = 'reward' | 'encounter' | 'landmark' | 'ancient';

const NODE_TIERS: Record<MapNodeType, NodeTier> = {
  fight: 'encounter',
  skirmish: 'encounter',
  battle: 'encounter',
  elite: 'encounter',
  boss: 'ancient',
  shop: 'landmark',
  equipmentReward: 'reward',
  relicReward: 'reward',
  currencyReward: 'reward',
  upgradeReward: 'reward',
  weaponReward: 'reward',
  armorReward: 'reward',
  accessoryReward: 'reward',
  hpBoostReward: 'reward',
  manaBoostReward: 'reward',
  manaRegenBoostReward: 'reward',
  classReward: 'reward',
  event: 'reward',
};

/**
 * Fixed 3-column geometry, shared by the CSS grid (.map-row) and the edge
 * overlay below. Pinning nodes to columns is what lets the connecting lines
 * be drawn from pure arithmetic instead of measured DOM rects — no layout
 * effect, no ResizeObserver, no first-paint flicker, and the lines stay
 * exact at every viewport width because the SVG stretches with the grid.
 *
 * A 2-node row spreads to the OUTER columns rather than sitting adjacent, so
 * a fork reads as a fork. That also means a 3-node row's middle node lines up
 * with the gap in the row above it, which is what gives the map its woven,
 * non-gridlike look once the edges are drawn.
 */
const MAP_COLUMNS = 3;
const ROW_COLUMNS: Record<number, readonly number[]> = {
  1: [2],
  2: [1, 3],
  3: [1, 2, 3],
};
/** SVG user units per grid cell. Arbitrary — the viewBox is stretched to fit. */
const CELL = 100;
/**
 * Fraction of each edge trimmed off both ends, so a line runs BETWEEN two
 * tiles instead of into their centers. Node tiles are semi-transparent, so an
 * untrimmed line stays visible straight through the label underneath it.
 * Trimming proportionally (rather than by a pixel radius) also pulls a
 * diagonal edge's x inward by the right amount for free, and stays correct
 * under the viewBox's non-uniform stretch.
 */
const EDGE_TRIM = 0.3;

function columnOf(indexInRow: number, rowLength: number): number {
  return (ROW_COLUMNS[rowLength] ?? ROW_COLUMNS[MAP_COLUMNS])[indexInRow] ?? 2;
}

interface EdgeLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Both ends already walked — the route behind you. */
  traveled: boolean;
  /** Leaves the node you're standing on and lands somewhere you may go next. */
  open: boolean;
}

/**
 * Every parent→child link in the map as a drawable line, in the SVG's user
 * units. `map.rows` is stored bottom-up (row 0 is the act's opening fight)
 * but the map renders top-down, so a node's `nextIds` always live one row
 * ABOVE it on screen.
 */
function buildEdges(
  rowsTopDown: readonly (readonly string[])[],
  nodes: Record<string, MapNode>,
  currentNodeId: string | null,
  reachable: ReadonlySet<string>,
  visited: ReadonlySet<string>,
): EdgeLine[] {
  const centers = new Map<string, { x: number; y: number }>();
  rowsTopDown.forEach((rowIds, row) => {
    rowIds.forEach((id, i) => {
      centers.set(id, { x: (columnOf(i, rowIds.length) - 0.5) * CELL, y: (row + 0.5) * CELL });
    });
  });

  return rowsTopDown.flatMap((rowIds) =>
    rowIds.flatMap((id) => {
      const from = centers.get(id);
      return (nodes[id]?.nextIds ?? []).flatMap((childId) => {
        const to = centers.get(childId);
        if (!from || !to) return [];
        return [{
          key: `${id}->${childId}`,
          x1: from.x + (to.x - from.x) * EDGE_TRIM,
          y1: from.y + (to.y - from.y) * EDGE_TRIM,
          x2: to.x - (to.x - from.x) * EDGE_TRIM,
          y2: to.y - (to.y - from.y) * EDGE_TRIM,
          traveled: visited.has(id) && visited.has(childId),
          open: currentNodeId === id && reachable.has(childId),
        }];
      });
    }),
  );
}

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
  column,
  isCurrent,
  isReachable,
  isVisited,
  onSelect,
  onPreview,
}: {
  node: MapNode;
  /** 1-based grid column this node sits in (columnOf) — kept in sync with the edge overlay, which assumes the same geometry. */
  column: number;
  isCurrent: boolean;
  isReachable: boolean;
  isVisited: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  const classes = [
    'map-node',
    `tier-${NODE_TIERS[node.type]}`,
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
      style={{ '--node-color': NODE_COLORS[node.type], gridColumn: column } as CSSProperties}
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
  const edges = buildEdges(rowsTopDown, map.nodes, run.currentNodeId, reachable, visited);

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
        <div className="map-grid" style={{ '--map-rows': rowsTopDown.length } as CSSProperties}>
          {/*
            The route itself. Drawn under the nodes as one stretched SVG rather
            than per-row connector stubs: a stub between rows can only say
            "these rows are adjacent", while a real parent->child line says
            WHICH node leads where — the only thing that makes a branching map
            plannable. preserveAspectRatio="none" lets the overlay stretch to
            whatever the grid resolves to, and non-scaling-stroke keeps the
            lines an even weight through that stretch.
          */}
          <svg
            className="map-edges"
            viewBox={`0 0 ${MAP_COLUMNS * CELL} ${rowsTopDown.length * CELL}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {edges.map((edge) => (
              <line
                key={edge.key}
                className={['map-edge', edge.traveled ? 'traveled' : '', edge.open ? 'open' : ''].filter(Boolean).join(' ')}
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {rowsTopDown.map((rowIds, rowIndex) => (
            <div className="map-row" key={rowIndex}>
              {rowIds.map((nodeId, indexInRow) => {
                const node = map.nodes[nodeId];
                return (
                  <MapNodeButton
                    key={nodeId}
                    node={node}
                    column={columnOf(indexInRow, rowIds.length)}
                    isCurrent={run.currentNodeId === nodeId}
                    isReachable={reachable.has(nodeId)}
                    isVisited={visited.has(nodeId)}
                    onSelect={() => onSelectNode(nodeId)}
                    onPreview={() => setPreviewNode(node)}
                  />
                );
              })}
            </div>
          ))}
        </div>
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
