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
  /** Abandon the run and return to the title. Omit and the pause menu simply drops that entry — same contract FightScreen's own quit uses. */
  onQuitToTitle?: () => void;
}

/**
 * What each node calls itself on the map.
 *
 * The encounter names are a two-word vocabulary, not five distinct ones
 * (2026-08-29, per user direction): **Monsters** is a fight you cannot recruit
 * from, **Skirmish** is one you can. That is the single fact a player needs
 * before picking a route, so it is the fact the label carries — which is why
 * `fight`/`battle` share a name and `skirmish`/`elite` share a name, even
 * though all four are distinct node types underneath.
 *
 * What separates the two members of each pair is difficulty, and difficulty is
 * said in COLOR and GLYPH instead (NODE_COLORS, nodeIcons.tsx): the Elite-tier
 * Skirmish is `--crit` and wears a crowned helm, so the harder of the two
 * recruitable fights still reads as the spike on its row without needing a
 * word the player has to learn separately. The two channels are deliberately
 * NOT redundant — name for recruitability, color for difficulty — which is
 * what keeps row 4's Elite-or-Battle choice legible in both dimensions at
 * once (see NODE_COLORS for the version of this that did not work).
 *
 * `boss` is the act's **Guardian**. "Ancient" is deliberately not used here —
 * it is reserved for something later in a run — and this is only the node's
 * name, unrelated to the locked `Ancient` TYPE (CLAUDE.md), which is untouched.
 */
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

/**
 * Per-type accent color, keyed to the existing palette (styles.css :root) so
 * nodes read at a glance. `weaponReward`/`armorReward`/`accessoryReward`/
 * `hpBoostReward`/`manaBoostReward`/`manaRegenBoostReward` reuse the same
 * color language StatBars.tsx (STAT_COLORS) already established per-stat
 * (attack red, defense gray, hp green, manaPool blue, mpRegen teal) so a
 * player who's learned that vocabulary reading hero stat blocks recognizes
 * it on the map too. `event` keeps its neutral gray now that it has real
 * content (src/data/events.ts): what it holds is genuinely unknown until you
 * arrive, and the events span every reward axis, so any stat colour here
 * would be a lie about which one you are walking into. The colour arrives on
 * the node SCREEN instead, from the rolled event's own `tone`.
 *
 * The four encounter types split the work with NODE_NAMES rather than
 * duplicating it, which is why the 2026-08-29 rename left these alone. **The
 * name carries recruitability** (Monsters vs Skirmish); **color carries
 * difficulty** — `--enemy` the act's soft opener, `--ally` a standard fight,
 * `--crit` the Elite spike. Two axes, one each, no redundancy.
 *
 * `battle` was briefly moved to `--enemy` during that rename, on the theory
 * that color should agree with the label about recruiting. Reverted the same
 * day: it put `battle` beside `elite` on row 4 — the act's one real difficulty
 * choice — in two reds a shade apart (#d9534f vs #ff7043), costing more
 * legibility on the row that matters most than the redundancy bought anywhere.
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
 *
 * This is also where the two same-named pairs (NODE_NAMES) are told apart, so
 * each line has to name its own difficulty rather than leaning on the label.
 */
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

/**
 * Silhouette tier — how much this node matters, said in shape and size rather
 * than in the glyph. The two channels answer different questions and both are
 * needed: the glyph (src/view/shared/nodeIcons.tsx) says WHAT is here, the
 * silhouette says how much it weighs, and the silhouette is the one that
 * survives peripheral vision at phone scale.
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
 * overlay below. Pinning nodes to columns is what keeps the route legible:
 * a 2-node row spreads to the OUTER columns rather than sitting adjacent, so
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

function columnOf(indexInRow: number, rowLength: number): number {
  return (ROW_COLUMNS[rowLength] ?? ROW_COLUMNS[MAP_COLUMNS])[indexInRow] ?? 2;
}

/** A measured node tile, in .map-grid-relative layout px (offsetLeft/Top — unaffected by .app-shell's transform scale). */
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

/** Gap left between a tile's edge and the line docking into it. Small on purpose — the route should touch each stop, not hover near it. */
const DOCK_GAP = 3;
/**
 * How far apart sibling edges spread across the edge they share, as a
 * fraction of the tile's width. A node with two children fans its two lines
 * out of its top edge instead of stacking them on one point, so a fork is
 * visible at the fork rather than only further along.
 */
const FAN_SPREAD = 0.24;
const FAN_SPREAD_MAX = 13;

interface MapEdge {
  key: string;
  /** Cubic path, parent tile's top edge -> child tile's bottom edge. */
  d: string;
  /** Docking point on the parent (lower on screen). */
  x1: number;
  y1: number;
  /** Docking point on the child (higher on screen — the route runs upward). */
  x2: number;
  y2: number;
  /** The destination's accent, so a live choice previews what it leads to. */
  color: string;
  /** Both ends already walked — the route behind you. */
  traveled: boolean;
  /** Leaves the node you're standing on and lands somewhere you may go next. */
  open: boolean;
}

function fanOffset(index: number, count: number, width: number): number {
  if (count < 2) return 0;
  const spread = Math.min(width * FAN_SPREAD, FAN_SPREAD_MAX);
  return (index - (count - 1) / 2) * spread;
}

/**
 * Every parent->child link as a drawable path, in measured layout px.
 *
 * The geometry is measured rather than derived from the grid's arithmetic
 * (which is what this used to do). Column centers are only the centers of
 * CELLS; the tiles inside them are four different widths and heights by tier,
 * so a line trimmed by a fixed fraction of its own length stopped short of a
 * wide tile and ran under a narrow one — a different gap on every edge, which
 * is exactly what made the route read as loose sticks rather than a path.
 * Docking to the real box costs one layout read and makes every connection
 * exact at every viewport width.
 *
 * Every edge leaves its parent's TOP edge heading straight up and arrives at
 * its child's BOTTOM edge still heading straight up — a cubic with purely
 * vertical control handles. Two consequences, both wanted: a diagonal becomes
 * an S-curve that reads as travel rather than as a strut, and the tangent at
 * both ends is always vertical, so the caps and the chevron below never need
 * rotating to match.
 *
 * `map.rows` is stored bottom-up (row 0 is the act's opening fight) but the
 * map renders top-down, so a node's `nextIds` always live one row ABOVE it on
 * screen.
 */
function buildEdges(
  rowsTopDown: readonly (readonly string[])[],
  nodes: Record<string, MapNode>,
  geometry: MapGeometry,
  currentNodeId: string | null,
  reachable: ReadonlySet<string>,
  visited: ReadonlySet<string>,
): MapEdge[] {
  const { boxes } = geometry;

  // How many parents each child has, and this edge's index among them, so the
  // arriving lines spread across the child's bottom edge the same way the
  // leaving ones spread across the parent's top edge.
  //
  // Both fans are then sorted left-to-right by measured x, which is what keeps
  // the route from tangling: fan slots are handed out in index order (slot 0
  // leftmost), but `nextIds` is in GENERATION order — a random pick order plus
  // the generator repair pass appends (src/run/map.ts) — so without this, slot
  // 0 could dock the middle child while slot 1 docked the left one, and the two
  // lines crossed each other right at the parent tile top edge. Sorting by the
  // child box rather than by `col` means the rule holds for whatever geometry
  // the grid lands on.
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
        // Handle length: enough to bend a diagonal into a readable S, floored
        // so two rows that nearly touch still get a curve rather than a stub,
        // and capped at half the run so the two handles can never cross. On
        // this map most vertical gaps are only ~16px (a 74px row holding a
        // ~56px tile), and an uncapped 12px floor put c1 ABOVE c2 there —
        // a curve that doubles back on itself, which reads as a wobble and
        // makes the open edge's dash crawl stutter as it passes through.
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

  // Paint order = importance order: structure, then history, then the live
  // choice on top, so an open edge is never crossed by a dim one.
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

/**
 * Measures every node tile against .map-grid. offsetLeft/offsetTop rather
 * than getBoundingClientRect on purpose: .app-shell is transform-scaled to
 * the device (src/app/uiScale.ts), and offsets are pre-transform layout px —
 * the same space the SVG's viewBox is authored in. Rect math would have to
 * divide that scale back out and would drift on fractional scales.
 *
 * Re-measures on any resize of the grid (rotation, a wider device, the
 * scrollbar appearing) via ResizeObserver, and on a new act's map via
 * `mapKey`. One frame renders before the first measurement lands; the edges
 * sit *behind* the tiles, so what that frame is missing is the connective
 * tissue, never a control.
 */
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
      // Bail out when nothing moved — a ResizeObserver that setStates
      // unconditionally can loop against its own re-render.
      setGeometry((prev) => (prev && sameGeometry(prev, next) ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [nodeRefs, mapKey]);

  return [gridRef, geometry];
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
  registerRef,
}: {
  node: MapNode;
  /** 1-based grid column this node sits in (columnOf) — the CSS grid's placement; the edge overlay reads the resulting box, it doesn't assume it. */
  column: number;
  isCurrent: boolean;
  isReachable: boolean;
  isVisited: boolean;
  onSelect: () => void;
  onPreview: () => void;
  /** Hands this tile's DOM node to MapScreen's geometry cache so the route can dock to its real box (useMapGeometry). */
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
            <NodeGlyph type={node.type} className="map-popup-glyph" /> {NODE_NAMES[node.type]}
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
 * (CLAUDE.md architecture note in styles.css .bottom-bar) — .map-well keeps
 * the flex-fill role and .map-scroll inside it the internal scroll, this row
 * just sits below both instead of inside the header. Each button gets its own accent color (mirroring
 * NODE_COLORS below) so the row reads as a small "hub signpost" rather than
 * generic pills.
 */
const FOOTER_BUTTONS: readonly { key: HubGlyphName; label: string; color: string; iconOnly?: true }[] = [
  { key: 'relics', label: 'Relics', color: 'var(--magical)' },
  { key: 'roster', label: 'Roster', color: 'var(--ally)' },
  /* Icon-only, to make room for Menu without cramming four labels into a
     ~394px row. Reference is the one that can afford it: it is a lookup
     table consulted occasionally, while the other three are things the
     player reaches for by habit — and its scroll is the most distinctive
     shape of the four, so it survives losing its word better than they
     would. Still labelled for screen readers (aria-label below). */
  { key: 'reference', label: 'Reference', color: 'var(--accent)', iconOnly: true },
  { key: 'menu', label: 'Menu', color: 'var(--text-dim)' },
];

/**
 * The map well's back layer — the act's Location, standing behind the route
 * (docs/locations.md §4).
 *
 * The arrival screen already answers "where am I" once, loudly, and then the
 * player spends the rest of the act on a well that used to look the same in
 * every location: one hardcoded warm-gold pool, gold at the bottom, gold at
 * the top. That made the place a title card rather than a setting. This layer
 * moves the same three identity channels the arrival screen uses onto the map,
 * at a fraction of the strength:
 *
 * 1. **Tint and lighting** — `--node-rgb` and `data-location`, both set on
 *    `.map-screen`, drive a per-location wash recipe (styles.css). That wash
 *    is `.map-well`'s own *background* rather than a layer in here — a
 *    background is fixed to its element, so it survives a map tall enough to
 *    scroll where a layer inside the scroller would slide up and strand the
 *    route on a bare well. The layers below get the same immunity from
 *    sitting on the frame rather than in the scroller (see the well markup).
 * 2. **Weather** — the location's own ambience keyframe (LocationMotes),
 *    thinned to `MAP_MOTE_DENSITY` and dimmed further in styles.css.
 * 3. **Horizon** — the same silhouette band (locationArt.tsx), sitting at the
 *    BOTTOM of the well, which on this screen is the act's origin: the route
 *    climbs away from the place you walked in from, toward the Guardian.
 *
 * Only 2 and 3 need real elements, and those two are the shared
 * `LocationAmbience` (LocationSky.tsx), which the node screens render as well.
 * It is `pointer-events: none` and paints under `.map-grid`, so no amount of
 * atmosphere can intercept a tap on a node. The one thing this layer must
 * never do is make the route harder to read, which is why the density and the
 * opacity are both well under the arrival screen's — and why the edge casing
 * pass (see the SVG below) already exists to keep a line legible over whatever
 * it crosses.
 */
const MAP_MOTE_DENSITY = 0.5;

/**
 * The place's name, etched into the well's bottom-left corner (2026-08-29, per
 * user direction). The map used to carry the location's whole look and never
 * its name — the header says `ACT 1/5` and nothing else, so the one word the
 * player could actually repeat back was only ever on a screen they had
 * already dismissed.
 *
 * It sat top-left first, on the reasoning that the top two rows are width-1
 * and a width-1 row pins to the CENTRE column (ROW_COLUMNS). True, and not
 * enough: pinning a tile to a column does not keep it inside one. The Guardian
 * is `tier-ancient`, whose 124px min-width exceeds the ~117px column, so it
 * spills into both neighbours and ran under the placard on longer names.
 *
 * The bottom row is the act's opening fight — also width-1, but a
 * `tier-encounter` tile at 92px, which fits its column with room to spare. The
 * corner is genuinely empty there, and the placard's width cap (styles.css) is
 * now sized to that free column rather than to the well, so a long name wraps
 * rather than reaching whatever tier ends up beside it.
 *
 * Etched rather than boxed, per visual-language's standing rule that the only
 * rectangles on a screen are the things you can act on — and `pointer-events:
 * none`, so it can never eat a tap even if a future map shape does grow a
 * tile underneath it. The faction rides along under the name because "who
 * holds this place" is the half of a location that survives into the fights;
 * the arrival screen says it once and this is the only other place it is
 * said.
 */
function MapPlacard({ location }: { location: LocationDefinition }) {
  return (
    <div className="map-placard">
      <span className="map-placard-name">{location.name}</span>
      <span className="map-placard-faction">{location.faction}</span>
    </div>
  );
}

/**
 * The run's hub screen (docs/run-loop.md): a branching map the player
 * ascends node by node, plus always-on access to Manage Roster — full stat
 * spreads and equipment reassignment (RosterManagementScreen). Training
 * Points are no longer spent here: they're forced-allocated immediately
 * after a win via LevelUpScreen (App.tsx). That screen used to drain the pool
 * to exactly 0 every time; under the level-price curve (run/progression.ts
 * levelUpCost) it drains it to whatever no hero on the roster can afford, so a
 * banked remainder sitting on the map is now NORMAL rather than impossible. It
 * shows on RosterPeek's resource row rather than in this header — a number the
 * player is saving toward one specific hero belongs beside the roster.
 */
export function MapScreen({ run, onRunChange, onSelectNode, onQuitToTitle }: Props) {
  const [showRoster, setShowRoster] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showRelics, setShowRelics] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  /* Two taps to abandon a run, the same arming FightScreen's own quit entry
     uses: there is no save file, so a mis-tap here costs a 45-minute run. */
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [previewNode, setPreviewNode] = useState<MapNode | null>(null);
  // Hooks can't sit behind the `if (!map)` bail below, so both of these are
  // called unconditionally; a mapless run simply never registers a tile and
  // the geometry stays an empty measurement.
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [gridRef, geometry] = useMapGeometry(nodeRefs, run.map ? `${run.actNumber}:${run.map.seed}` : 'none');

  const map = run.map;
  if (!map) return null;

  // Read off the run rather than threaded down from App: MapScreen already
  // has the itinerary and the act number, and `locationForAct` falls back
  // rather than throwing on a run with no itinerary at all (a pre-Locations
  // save, or enemyGen's throwaway rosters).
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
    // One custom property on the root is the whole plumbing, exactly as on the
    // node screens: the well's wash, its border, the horizon's rim light and
    // every mote downstream all resolve their colour from it.
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

      {/*
        The well is a FRAME with a scroller inside it, not a scroller that also
        draws a frame. The two were one element until 2026-08-29, and that cost
        the map a scrollbar: the atmosphere layer has to reach back over the
        well's padding to put its horizon on the real inside edge, and a child
        with negative insets inside a scroll container does not overhang — it
        becomes scrollable overflow. 14px down and 12px across, on a map
        already sized to fit its canvas exactly.

        Splitting them fixes that by construction rather than by clamping:
        atmosphere and placard belong to the frame, so they cannot enlarge the
        scrolled content, and they now genuinely stay put when a tall map does
        scroll — which is what the wash (a background, and so always fixed to
        its own box) was already doing without them.
      */}
      <div className="map-well">
        <LocationAmbience location={location} density={MAP_MOTE_DENSITY} className="map-atmosphere" />
        <MapPlacard location={location} />

        <div className="map-scroll screen-scroll">
          <div className="map-grid" ref={gridRef} style={{ '--map-rows': rowsTopDown.length } as CSSProperties}>
            {/*
              The route itself. Drawn under the tiles as one SVG in the grid's own
              layout px (viewBox = measured size, so 1 user unit = 1 CSS px and
              strokes need no non-scaling-stroke correction) rather than as
              per-row connector stubs: a stub between rows can only say "these
              rows are adjacent", while a real parent->child path says WHICH node
              leads where — the only thing that makes a branching map plannable.

              Two passes, not one: every casing is laid down before any core, so
              a dark casing can never cut a hole through a line that crosses it.
              The casing is what keeps a route readable where it runs over the
              well's warm pool at the bottom of the map.
            */}
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
                    {/* Docking caps. They sit exactly on the tile edge, so they
                        read as the line socketing into the stop rather than
                        merely ending near it — and they hide the half-pixel a
                        fractional layout can leave between stroke and border. */}
                    <circle className="map-edge-cap" cx={edge.x1} cy={edge.y1} r={2.2} />
                    {edge.open ? (
                      // The route's only direction cue: an open edge arrives at
                      // its destination pointing at it. Always drawn straight
                      // up because the path's end tangent is always vertical
                      // (buildEdges' control handles) — no rotation needed.
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
            /* Only when the word is gone: with the label rendered, naming the
               button here would make a screen reader say it twice — the same
               reasoning that keeps the glyphs themselves aria-hidden. */
            aria-label={iconOnly ? label : undefined}
            title={iconOnly ? label : undefined}
          >
            <span className="map-footer-icon"><HubGlyph name={key} /></span>
            {!iconOnly && <span className="map-footer-label">{label}</span>}
            {key === 'relics' && run.relics.length > 0 && <span className="map-footer-badge">{run.relics.length}</span>}
          </button>
        ))}
      </div>

      {/* The map's pause menu. Deliberately the same markup as FightScreen's
          Options panel (.log-overlay / .options-panel / .options-item) rather
          than a second styling of the same idea — a player who opened it in a
          fight should meet the identical thing here, and the shared audio
          block is the whole reason this screen needed a menu at all: volume
          and mute were previously reachable only mid-fight. */}
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
