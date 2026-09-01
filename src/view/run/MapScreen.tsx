import React, { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { RunState } from '../../run/state';
import { TOTAL_ACTS } from '../../run/state';
import { reachableNodeIds } from '../../run/runProgress';
import type { MapNode, MapNodeType } from '../../run/map';
import { useLongPress } from '../shared/MoveTile';
import { RosterManagementScreen } from './RosterManagementScreen';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { RelicsOverlay } from './RelicsOverlay';
import { ResourceMark } from '../shared/RunGlyph';
import { HubGlyph, NodeGlyph, type HubGlyphName } from '../shared/nodeIcons';
import { locationForAct } from '../../run/locations';
import type { LocationDefinition } from '../../data/locations';
import { LocationAmbience } from '../shared/LocationSky';
import { AudioSettings } from '../shared/AudioSettings';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onSelectNode: (nodeId: string) => void;
  /** Omit and the pause menu drops its quit entry. */
  onQuitToTitle?: () => void;
}

// Name carries recruitability (Monsters vs Skirmish); NODE_COLORS carries
// difficulty. The two channels are deliberately not redundant.
const NODE_NAMES: Record<MapNodeType, string> = {
  fight: 'Monsters',
  skirmish: 'Skirmish',
  battle: 'Monsters',
  elite: 'Skirmish',
  boss: 'Guardian',
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

// Stat-reward colours match StatBars' STAT_COLORS. `battle` stays `--ally`,
// not `--enemy`: two reds a shade apart on the Elite-or-Battle row was illegible.
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

// Long-press preview text. Each line names its own difficulty — the label can't.
const NODE_DESCRIPTIONS: Record<MapNodeType, string> = {
  fight: 'A weak Monster squad (4v4, no bonus) — not recruitable. The act’s opener.',
  skirmish: 'A recruitable hero squad (4v4, no bonus). Win to claim a Recruit Contract.',
  battle: 'A Monster squad (4v4, no bonus) — not recruitable, same pool as the act’s opener.',
  elite: 'A recruitable hero squad, each with +10 to 2 stats — the act’s difficulty spike.',
  boss: 'The act’s Guardian: 2 heroes, no bench, each with +20 to 3 stats. Ends the act.',
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
  event: 'An unknown encounter: a move, a passive, a trade, or gear. What it is stays hidden until you arrive.',
};

// Silhouette tier, done with border-radius rather than clip-path so the
// reachable/current box-shadow glows are never cropped.
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

// Fixed 3-column geometry shared by .map-row and the edge overlay; a 2-node
// row spreads to the outer columns so a fork reads as a fork.
const MAP_COLUMNS = 3;
const ROW_COLUMNS: Record<number, readonly number[]> = {
  1: [2],
  2: [1, 3],
  3: [1, 2, 3],
};

function columnOf(indexInRow: number, rowLength: number): number {
  return (ROW_COLUMNS[rowLength] ?? ROW_COLUMNS[MAP_COLUMNS])[indexInRow] ?? 2;
}

/** A measured node tile in .map-grid layout px (offsetLeft/Top — unaffected by .app-shell's transform scale). */
interface NodeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MapGeometry {
  width: number;
  height: number;
  boxes: Record<string, NodeBox>;
}

const DOCK_GAP = 3;
/** Sibling-edge fan spread as a fraction of tile width, and its cap. */
const FAN_SPREAD = 0.24;
const FAN_SPREAD_MAX = 13;

interface MapEdge {
  key: string;
  /** Cubic path, parent tile's top edge -> child tile's bottom edge. */
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** The destination's accent. */
  color: string;
  /** Both ends already walked. */
  traveled: boolean;
  /** Leaves the current node and lands on a reachable one. */
  open: boolean;
}

function fanOffset(index: number, count: number, width: number): number {
  if (count < 2) return 0;
  const spread = Math.min(width * FAN_SPREAD, FAN_SPREAD_MAX);
  return (index - (count - 1) / 2) * spread;
}

// Edges dock to measured boxes (tiles differ in size by tier), leave the parent
// heading straight up and arrive at the child still heading straight up, so
// the end tangents are always vertical and caps/arrows never need rotating.
// `map.rows` is bottom-up; a node's `nextIds` sit one row ABOVE it on screen.
function buildEdges(
  rowsTopDown: readonly (readonly string[])[],
  nodes: Record<string, MapNode>,
  geometry: MapGeometry,
  currentNodeId: string | null,
  reachable: ReadonlySet<string>,
  visited: ReadonlySet<string>,
): MapEdge[] {
  const { boxes } = geometry;

  // Both fans are sorted by measured x: `nextIds` is in generation order, and
  // handing out fan slots in that order crossed lines at the tile edge.
  const parentsOf = new Map<string, string[]>();
  for (const rowIds of rowsTopDown) {
    for (const id of rowIds) {
      for (const childId of nodes[id]?.nextIds ?? []) {
        const list = parentsOf.get(childId);
        if (list) list.push(id);
        else parentsOf.set(childId, [id]);
      }
    }
  }
  const byX = (a: string, b: string) => (boxes[a]?.x ?? 0) - (boxes[b]?.x ?? 0);
  for (const list of parentsOf.values()) list.sort(byX);

  const edges = rowsTopDown.flatMap((rowIds) =>
    rowIds.flatMap((id) => {
      const from = boxes[id];
      const childIds = [...(nodes[id]?.nextIds ?? [])].sort(byX);
      return childIds.flatMap((childId, childIndex) => {
        const to = boxes[childId];
        if (!from || !to) return [];

        const parents = parentsOf.get(childId) ?? [];
        const x1 = from.x + from.w / 2 + fanOffset(childIndex, childIds.length, from.w);
        const y1 = from.y - DOCK_GAP;
        const x2 = to.x + to.w / 2 + fanOffset(parents.indexOf(id), parents.length, to.w);
        const y2 = to.y + to.h + DOCK_GAP;
        // Handle floored for a curve on near-touching rows, capped at half the
        // run so the two handles can never cross (a ~16px gap otherwise doubles back).
        const run = y1 - y2;
        const handle = Math.min(Math.max(12, run * 0.48), run / 2);

        return [{
          key: id + '->' + childId,
          d: `M ${x1} ${y1} C ${x1} ${y1 - handle}, ${x2} ${y2 + handle}, ${x2} ${y2}`,
          x1,
          y1,
          x2,
          y2,
          color: NODE_COLORS[nodes[childId]?.type ?? 'event'],
          traveled: visited.has(id) && visited.has(childId),
          open: currentNodeId === id && reachable.has(childId),
        }];
      });
    }),
  );

  // Paint order: structure, then history, then the live choice on top.
  const rank = (e: MapEdge) => (e.open ? 2 : e.traveled ? 1 : 0);
  return edges.sort((a, b) => rank(a) - rank(b));
}

function sameGeometry(a: MapGeometry, b: MapGeometry): boolean {
  if (a.width !== b.width || a.height !== b.height) return false;
  const aIds = Object.keys(a.boxes);
  if (aIds.length !== Object.keys(b.boxes).length) return false;
  return aIds.every((id) => {
    const prev = a.boxes[id];
    const next = b.boxes[id];
    return !!next && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h;
  });
}

// offsetLeft/Top, not getBoundingClientRect: .app-shell is transform-scaled
// (src/app/uiScale.ts) and offsets are pre-transform px — the SVG's viewBox space.
function useMapGeometry(
  nodeRefs: React.RefObject<Map<string, HTMLElement>>,
  mapKey: string,
): [React.RefObject<HTMLDivElement | null>, MapGeometry | null] {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [geometry, setGeometry] = useState<MapGeometry | null>(null);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const measure = () => {
      const boxes: Record<string, NodeBox> = {};
      for (const [id, el] of nodeRefs.current) {
        boxes[id] = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
      }
      const next = { width: grid.offsetWidth, height: grid.offsetHeight, boxes };
      // Bail when nothing moved — a ResizeObserver that setStates unconditionally loops.
      setGeometry((prev) => (prev && sameGeometry(prev, next) ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [nodeRefs, mapKey]);

  return [gridRef, geometry];
}

// Not `disabled`: disabled controls suppress pointer events, which would kill
// long-press on locked nodes. Reachability is enforced in the tap handler.
function MapNodeButton({
  node,
  column,
  isCurrent,
  isReachable,
  isVisited,
  onSelect,
  onPreview,
  registerRef,
}: {
  node: MapNode;
  /** 1-based grid column (columnOf). */
  column: number;
  isCurrent: boolean;
  isReachable: boolean;
  isVisited: boolean;
  onSelect: () => void;
  onPreview: () => void;
  registerRef: (el: HTMLElement | null) => void;
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
      ref={registerRef}
      type="button"
      className={classes}
      style={{ '--node-color': NODE_COLORS[node.type], gridColumn: column } as CSSProperties}
      aria-disabled={!isReachable}
      {...longPress}
    >
      <NodeGlyph type={node.type} className="map-node-glyph" />
      <span className="map-node-name">{NODE_NAMES[node.type]}</span>
    </button>
  );
}

function MapNodePreviewPopup({ node, onClose }: { node: MapNode; onClose: () => void }) {
  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel move-popup-panel" style={{ '--node-color': NODE_COLORS[node.type] } as CSSProperties}>
        <div className="log-panel-header">
          <span>
            <NodeGlyph type={node.type} className="map-popup-glyph" /> {NODE_NAMES[node.type]}
          </span>
        </div>
        <div className="move-popup-description">{NODE_DESCRIPTIONS[node.type]}</div>
        <div className="move-popup-hint">Tap anywhere to close</div>
      </div>
    </div>
  );
}

const FOOTER_BUTTONS: readonly { key: HubGlyphName; label: string; color: string; iconOnly?: true }[] = [
  { key: 'relics', label: 'Relics', color: 'var(--magical)' },
  { key: 'roster', label: 'Roster', color: 'var(--ally)' },
  // Icon-only to fit four buttons in the row; still labelled for screen readers.
  { key: 'reference', label: 'Reference', color: 'var(--accent)', iconOnly: true },
  { key: 'menu', label: 'Menu', color: 'var(--text-dim)' },
];

// docs/locations.md §4 — the well carries the act's Location at a fraction of
// the arrival screen's strength.
const MAP_MOTE_DENSITY = 0.5;

// Bottom-left: the bottom row is a width-1 encounter tile that fits its column;
// the top row's Guardian tile spills into both neighbours.
function MapPlacard({ location }: { location: LocationDefinition }) {
  return (
    <div className="map-placard">
      <span className="map-placard-name">{location.name}</span>
      <span className="map-placard-faction">{location.faction}</span>
    </div>
  );
}

// The run's hub (docs/run-loop.md). Training Points are spent on LevelUpScreen,
// not here; a banked remainder on the map is normal.
export function MapScreen({ run, onRunChange, onSelectNode, onQuitToTitle }: Props) {
  const [showRoster, setShowRoster] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showRelics, setShowRelics] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  // Two taps to abandon: there is no save file.
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [previewNode, setPreviewNode] = useState<MapNode | null>(null);
  // Called unconditionally — hooks can't sit behind the `if (!map)` bail.
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [gridRef, geometry] = useMapGeometry(nodeRefs, run.map ? `${run.actNumber}:${run.map.seed}` : 'none');

  const map = run.map;
  if (!map) return null;

  const location = locationForAct(run.locationIds, run.actNumber);

  const reachable = new Set(reachableNodeIds(run));
  const visited = new Set(run.visitedNodeIds);
  const rowsTopDown = [...map.rows].reverse();
  const edges = geometry ? buildEdges(rowsTopDown, map.nodes, geometry, run.currentNodeId, reachable, visited) : [];

  const openFooterOverlay: Record<(typeof FOOTER_BUTTONS)[number]['key'], () => void> = {
    relics: () => setShowRelics(true),
    roster: () => setShowRoster(true),
    reference: () => setShowReference(true),
    menu: () => {
      setConfirmingQuit(false);
      setShowMenu(true);
    },
  };

  return (
    <div className="map-screen" data-location={location.id} style={{ '--node-rgb': location.tintRgb } as CSSProperties}>
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

      {/* The well is a frame with a scroller inside it: atmosphere and placard
          overhang the padding, and negative insets inside a scroll container
          become scrollable overflow. */}
      <div className="map-well">
        <LocationAmbience location={location} density={MAP_MOTE_DENSITY} className="map-atmosphere" />
        <MapPlacard location={location} />

        <div className="map-scroll screen-scroll">
          <div className="map-grid" ref={gridRef} style={{ '--map-rows': rowsTopDown.length } as CSSProperties}>
            {/* viewBox = measured size, so 1 user unit = 1 CSS px. All casings
                are laid before any core so a casing never cuts a crossing line. */}
            {geometry && (
              <svg
                className="map-edges"
                viewBox={`0 0 ${geometry.width} ${geometry.height}`}
                width={geometry.width}
                height={geometry.height}
                aria-hidden="true"
              >
                {edges.map((edge) => (
                  <path key={`casing:${edge.key}`} className="map-edge-casing" d={edge.d} />
                ))}
                {edges.map((edge) => (
                  <g
                    key={edge.key}
                    className={['map-edge-group', edge.traveled ? 'traveled' : '', edge.open ? 'open' : ''].filter(Boolean).join(' ')}
                    style={{ '--edge-color': edge.color } as CSSProperties}
                  >
                    <path className="map-edge" d={edge.d} />
                    <circle className="map-edge-cap" cx={edge.x1} cy={edge.y1} r={2.2} />
                    {edge.open ? (
                      // Always drawn straight up: the path's end tangent is always vertical.
                      <path className="map-edge-arrow" d={`M ${edge.x2 - 4.2} ${edge.y2 + 5} L ${edge.x2} ${edge.y2} L ${edge.x2 + 4.2} ${edge.y2 + 5}`} />
                    ) : (
                      <circle className="map-edge-cap" cx={edge.x2} cy={edge.y2} r={2.2} />
                    )}
                  </g>
                ))}
              </svg>
            )}

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
                      registerRef={(el) => {
                        if (el) nodeRefs.current.set(nodeId, el);
                        else nodeRefs.current.delete(nodeId);
                      }}
                    />
                  );
                })}
              </div>
            ))}
        </div>
        </div>
      </div>

      <div className="map-footer">
        {FOOTER_BUTTONS.map(({ key, label, color, iconOnly }) => (
          <button
            key={key}
            className={`map-footer-button${iconOnly ? ' is-icon-only' : ''}`}
            style={{ '--btn-color': color } as CSSProperties}
            onClick={openFooterOverlay[key]}
            aria-label={iconOnly ? label : undefined}
            title={iconOnly ? label : undefined}
          >
            <span className="map-footer-icon"><HubGlyph name={key} /></span>
            {!iconOnly && <span className="map-footer-label">{label}</span>}
            {key === 'relics' && run.relics.length > 0 && <span className="map-footer-badge">{run.relics.length}</span>}
          </button>
        ))}
      </div>

      {/* Same markup as FightScreen's Options panel. */}
      {showMenu && (
        <div className="log-overlay" onClick={() => setShowMenu(false)}>
          <div className="log-panel options-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>Options</span>
              <button className="log-close-button" onClick={() => setShowMenu(false)}>
                ✕
              </button>
            </div>
            <div className="options-list">
              <AudioSettings />
              <button className="options-item" onClick={() => setShowMenu(false)}>
                <span className="options-item-glyph" aria-hidden="true">
                  ▶
                </span>
                Back to Map
              </button>
              {onQuitToTitle && (
                <button
                  className={`options-item options-item-danger${confirmingQuit ? ' armed' : ''}`}
                  onClick={() => (confirmingQuit ? onQuitToTitle() : setConfirmingQuit(true))}
                >
                  <span className="options-item-glyph" aria-hidden="true">
                    {confirmingQuit ? '⚠' : '🚪'}
                  </span>
                  {confirmingQuit ? 'Tap again to abandon' : 'Quit Run — Return to Title'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showRoster && <RosterManagementScreen run={run} onRunChange={onRunChange} onClose={() => setShowRoster(false)} />}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
      {showRelics && <RelicsOverlay ownedRelicIds={run.relics} onClose={() => setShowRelics(false)} />}
      {previewNode && <MapNodePreviewPopup node={previewNode} onClose={() => setPreviewNode(null)} />}
    </div>
  );
}
