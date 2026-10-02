import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { MapNode, MapNodeType, RunMap } from '../../run/map';
import { HubGlyph, NodeGlyph } from '../shared/nodeIcons';
import { useLongPress } from '../shared/MoveTile';
import { playSfx, type SfxId } from '../../audio/sfx';
import { NODE_COLORS, NODE_NAMES, NODE_TIERS, type NodeTier } from './mapNodes';
import { nodeFactsLine } from './nodeFacts';
import { isMapProp, mapNodeArt } from './mapNodeArt';
import { landmarkKind, MapLandmarkFace, TITAN_LIGHT, type LandmarkKind } from './mapLandmarks';
import campArt from '../../../art/places/rest.png';
import { ElementPie } from '../shared/ElementPie';
import { ElementGlyph } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';
import type { TypeId } from '../../engine/content';
import { canvasPoint, overlayHost } from '../shared/overlayHost';
import { handOffFlood } from '../shared/EntranceFlood';
import { allCombatants } from '../../data/content';

/**
 * The route out of where the player is standing (2026-09-08, per user direction): the node just
 * resolved, greyed and low; the paths leading forward from it; and the places those paths reach.
 *
 * The map stopped drawing the whole act, which cost the player the one thing a graph gives for
 * free — the sense of MOVING along it. This is what gives it back, and it gives it back as an
 * event rather than as a diagram: the paths are drawn in real time and each destination arrives
 * when its own path gets there. What arrives is a claw or a Boon, and it does not sound the same.
 *
 * The whole structure is permanent, not just an animation frame. The reveal only decides whether
 * you WATCH it happen or find it already drawn — coming back from the Roster sheet or the Level Up
 * screen must not replay it, so it runs once per node arrived at (`revealedKey`).
 */

// One path draws in this long, and the next starts this far behind it. Sized to be over inside a
// second for three options: this plays after every node in the run, and a flourish seen forty
// times an act has to be shorter than the patience of the fortieth viewing.
const PATH_DRAW_MS = 420;
const PATH_STAGGER_MS = 130;
const LAND_MS = 340;

function revealDurationMs(count: number): number {
  return Math.max(0, count - 1) * PATH_STAGGER_MS + PATH_DRAW_MS + LAND_MS;
}

/**
 * What arriving sounds like. Per node rather than per row, which covers the row-level ask —
 * a reward row plays nothing but chimes, and one claw among them is heard on its own terms —
 * without assuming a row is ever homogeneous.
 */
const ARRIVAL_SFX: Record<NodeTier, { id: SfxId; pitch?: number; gain?: number }> = {
  reward: { id: 'map.boon' },
  // The same chime taken down a fourth: a landmark is a place you walk into, not a thing you take.
  landmark: { id: 'map.boon', pitch: 0.75, gain: 1.05 },
  encounter: { id: 'map.threat' },
  // There is one of these an act. It gets the bottom of the register and the room to use it.
  ancient: { id: 'map.threat', pitch: 0.66, gain: 1.25 },
};

// Three landmarks are opened before their fight starts, and the fight mounts under the light that
// floods out of them (styles.css "is-opening"): the Guardian's gate and the finale's, their seals
// cracking and their doors swinging in, and the act's opening stone, the Titan's eye in it flaring.
const OPENING: Partial<Record<LandmarkKind, { ms: number; sfx: SfxId }>> = {
  gate: { ms: 1250, sfx: 'map.gate' },
  titanGate: { ms: 1250, sfx: 'map.gate' },
  stone: { ms: 700, sfx: 'titan.gaze' },
};

/** Set once per node arrived at, so the reveal survives a trip to the Roster sheet without replaying. */
let revealedKey: string | null = null;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * What a choice leads ON to (2026-09-08, per user direction). One branch point in an act actually
 * routes — Elite-or-Battle, where which encounter you take limits which of the next row's rewards
 * you reach — and this is what prices it: the option carries what it opens, so the price is visible
 * before it is paid, which the whole map used to do by being whole.
 *
 * Drawn only when the options DIFFER. If every choice on the row leads to the same places the
 * marker is noise, which is also what silently took it off the row above Elite-or-Battle when that
 * row stopped steering. Derived, never authored, so a change to the generator shows up here free.
 */
function leadOnTypes(map: RunMap, nodeId: string): MapNodeType[] {
  const seen: MapNodeType[] = [];
  for (const nextId of map.nodes[nodeId]?.nextIds ?? []) {
    const type = map.nodes[nextId]?.type;
    if (type && !seen.includes(type)) seen.push(type);
  }
  return seen;
}

function leadOnsDiffer(map: RunMap, nodeIds: readonly string[]): boolean {
  if (nodeIds.length < 2) return false;
  const signature = (id: string) => leadOnTypes(map, id).join('+');
  const first = signature(nodeIds[0]);
  return nodeIds.some((id) => signature(id) !== first);
}

/**
 * Where `el` sits inside `root`, in `root`'s own layout px.
 *
 * Offsets rather than `getBoundingClientRect`, and that is the whole point: a client rect includes
 * every transform on the element, and these elements are mid-animation when the ResizeObserver's
 * initial observation fires. Measured that way a reward medallion came back at its `scale(0.3)`
 * opening frame and its line ran INSIDE the finished circle; an encounter came back at `scale(1.5)`
 * and its line stopped short of one. `offsetLeft`/`offsetTop`/`offsetWidth` are pure layout, so the
 * path always ends on the disc's real edge whatever frame the animation is on — and being layout px
 * already, they also need no correction for the shell's own `transform: scale` (uiScale).
 *
 * The walk needs every element between `el` and `root` that is positioned to be one the chain
 * passes through, which `.map-choices` / `.map-origin` are.
 */
function localBox(el: HTMLElement, root: HTMLElement): { cx: number; top: number; bottom: number } {
  let x = 0;
  let y = 0;
  for (let node: HTMLElement | null = el; node && node !== root; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { cx: x + el.offsetWidth / 2, top: y, bottom: y + el.offsetHeight };
}

/** One drawn path, in the route box's own layout px. */
interface RouteSegment {
  id: string;
  type: MapNodeType;
  d: string;
}

/**
 * One place the player may go, as a lit sigil rather than a row of text (2026-09-08, per user
 * direction). The well is the act's Location and these are the ways out of it, so a choice is a
 * thing you look at and not a line you read: the glyph, the colour and the size are the whole
 * card, and holding one names it and says what it pays.
 *
 * What lies BEYOND it — the "Opens" chips, on the two rows where the options differ — sits above
 * the sigil in the destination's own colour, small and unlit. Above, because the map has always
 * run bottom-up toward the Guardian: further along the path is higher up the screen.
 */
function ChoiceMedallion({
  map,
  node,
  scouted,
  actNumber,
  showLeadOn,
  landDelayMs,
  guardianId,
  opening,
  hint,
  onSelect,
  onPreview,
  measureRef,
}: {
  map: RunMap;
  node: MapNode;
  /** A word under the tile when nothing else says it is the thing to tap: the run's first node. */
  hint?: string;
  /** The act's Guardian, drawn as the Guardian node's face. */
  guardianId: string | null;
  /** The enemy typing this tile previews, or none — the Skirmish and the fork only (MapScreen). */
  scouted: readonly TypeId[] | undefined;
  actNumber: number;
  showLeadOn: boolean;
  landDelayMs: number;
  /** Tapped and opening: the gate or the stone playing its beat before the fight (OPENING). */
  opening: boolean;
  onSelect: () => void;
  onPreview: () => void;
  measureRef: (el: HTMLButtonElement | null) => void;
}) {
  const leadOns = showLeadOn ? leadOnTypes(map, node.id) : [];
  const press = useLongPress(onPreview, onSelect);
  // The enemy typing stays ON the tile (docs/titanspawn-overhaul.md §4) — a rule held in the head
  // does not survive the map being a scene — but as a plaque under the helm, not cut into it.
  const scoutedFace = scouted && scouted.length > 0 ? scouted : null;
  const label = nodeFactsLine(NODE_NAMES[node.type], node.type, actNumber);
  // The pixel medallion wears the node's own emblem — helm or crowned helm on the fork — and a
  // scouted typing hangs under it as a plaque, rather than being cut into the face.
  const landmark = landmarkKind(node.type);
  const art = landmark ? undefined : mapNodeArt(node.type);
  const prop = art !== undefined && isMapProp(node.type);
  return (
    <div
      className={`map-choice tier-${NODE_TIERS[node.type]}`}
      data-node-type={node.type}
      style={{ '--land-delay': `${landDelayMs}ms`, '--node-color': NODE_COLORS[node.type] } as CSSProperties}
    >
      <span className="map-choice-ahead" aria-hidden="true">
        {leadOns.map((type) => (
          <span key={type} className="map-choice-ahead-mark" style={{ '--node-color': NODE_COLORS[type] } as CSSProperties}>
            <NodeGlyph type={type} />
          </span>
        ))}
      </span>
      <button
        type="button"
        className={`map-medallion${scoutedFace ? ' is-scouted' : ''}${art ? (prop ? ' has-prop' : ' has-art') : ''}${landmark ? ` is-landmark is-${landmark}` : ''}${opening ? ' is-opening' : ''}`}
        ref={measureRef}
        aria-label={scoutedFace ? `${label}. Enemies: ${scoutedFace.join(', ')}` : label}
        data-sfx="none"
        {...press}
      >
        <span className="map-medallion-glow" aria-hidden="true" />
        <span className="map-choice-burst" aria-hidden="true" />
        {landmark && <MapLandmarkFace kind={landmark} type={node.type} guardianId={guardianId} actNumber={actNumber} />}
        {art && <img src={art} className={prop ? 'map-medallion-prop' : 'map-medallion-art'} alt="" draggable={false} />}
        {art && scoutedFace && (
          <span className="map-medallion-typing" aria-hidden="true">
            {scoutedFace.map((type, i) => (
              <span key={`${type}-${i}`} className="map-medallion-type" style={{ color: getTypeColor(type) }}>
                <ElementGlyph type={type} />
              </span>
            ))}
          </span>
        )}
        {!art && !landmark && scoutedFace && <ElementPie types={scoutedFace} className="map-medallion-pie" />}
        {!art && !landmark && !scoutedFace && <NodeGlyph type={node.type} className="map-medallion-glyph" />}
        {!art && !landmark && scoutedFace && node.type === 'elite' && (
          <span className="map-medallion-crown" aria-hidden="true">
            <HubGlyph name="crown" />
          </span>
        )}
      </button>
      {hint && !opening && (
        <span className="map-choice-hint" aria-hidden="true">
          {hint}
        </span>
      )}
    </div>
  );
}

export function MapRoute({
  map,
  originNode,
  omen,
  choiceIds,
  scouted,
  actNumber,
  guardianId,
  onSelectNode,
  onPreviewNode,
}: {
  map: RunMap;
  /** The act's Guardian (LocationDefinition.guardianFinalEnemyId), for the Guardian node's face. */
  guardianId: string | null;
  /** The node just resolved, or null on an act's first row — there is nothing behind you yet. */
  originNode: MapNode | null;
  /** The Location's omen — what leaks here — shown in the origin's place at the act's first Monsters node. */
  omen: string;
  choiceIds: readonly string[];
  /** nodeId → the enemy typing its tile previews (MapScreen scoutChoices). */
  scouted: Readonly<Record<string, readonly TypeId[]>>;
  /** The act the map belongs to — the ledger's drop odds and hire level are per act. */
  actNumber: number;
  onSelectNode: (nodeId: string) => void;
  onPreviewNode: (node: MapNode) => void;
}) {
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [revealing, setRevealing] = useState(false);
  const [opening, setOpening] = useState<{ id: string; color: string; x: number; y: number } | null>(null);
  const openingId = opening?.id ?? null;
  const routeRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLSpanElement>(null);
  const medallionRefs = useRef(new Map<string, HTMLButtonElement>());
  const timers = useRef<number[]>([]);
  const finished = useRef(false);

  const choiceKey = choiceIds.join(',');
  const showLeadOn = leadOnsDiffer(map, choiceIds);
  // Gated on the node kind, not just on being row 0: act 6 opens on the Vigil, and an omen
  // over a muster would be naming enemies that are not there — nor does a camp sit before it.
  const originLandmark = originNode ? landmarkKind(originNode.type) : undefined;
  const opensOnFight = !originNode && map.nodes[choiceIds[0]]?.type === 'fight';
  const showOmen = opensOnFight;
  // An act's first row reveals too, from the camp: the opening fight is reached by a road like
  // every other node, which is what tells a new player it is a place to go.
  const revealKey = originNode ? `${map.seed}:${originNode.id}` : opensOnFight ? `${map.seed}:start` : null;

  /**
   * Where each path runs. Measured rather than laid out, because a medallion's size comes from its
   * tier and how many share the row — the geometry only exists once the browser has done it.
   */
  const measure = useCallback(() => {
    const route = routeRef.current;
    const origin = originRef.current;
    if (!route || !origin) {
      setSegments([]);
      return;
    }
    const from = localBox(origin, route);
    const next: RouteSegment[] = [];
    for (const id of choiceIds) {
      const el = medallionRefs.current.get(id);
      const type = map.nodes[id]?.type;
      if (!el || !type) continue;
      const to = localBox(el, route);
      // Vertical control handles, so every path leaves the origin and meets its destination
      // head-on however far sideways it has to travel.
      const bend = Math.max(20, (from.top - to.bottom) * 0.52);
      next.push({
        id,
        type,
        d: `M${from.cx.toFixed(1)} ${from.top.toFixed(1)}C${from.cx.toFixed(1)} ${(from.top - bend).toFixed(1)} ${to.cx.toFixed(1)} ${(to.bottom + bend).toFixed(1)} ${to.cx.toFixed(1)} ${to.bottom.toFixed(1)}`,
      });
    }
    setSegments(next);
    // choiceIds is captured, not listed: it is a fresh array every render, and choiceKey is its
    // identity. Same reason below.
  }, [choiceKey, map, originNode?.id]);

  useLayoutEffect(() => {
    measure();
    const route = routeRef.current;
    if (!route || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(route);
    return () => observer.disconnect();
  }, [measure]);

  const stopTimers = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };

  /** Tapping during the reveal lands everything at once — nobody should have to wait out a flourish. */
  const skip = () => {
    stopTimers();
    finished.current = true;
    setRevealing(false);
  };

  useEffect(() => {
    if (!revealKey || revealedKey === revealKey) {
      setRevealing(false);
      return;
    }
    // Claimed before the reduced-motion bail so a player who never sees it never sees it twice.
    revealedKey = revealKey;
    if (prefersReducedMotion() || choiceIds.length === 0) return;

    finished.current = false;
    setRevealing(true);
    playSfx('map.path');
    choiceIds.forEach((id, i) => {
      const cue = ARRIVAL_SFX[NODE_TIERS[map.nodes[id].type]];
      timers.current.push(
        window.setTimeout(() => playSfx(cue.id, { pitch: cue.pitch, gain: cue.gain }), i * PATH_STAGGER_MS + PATH_DRAW_MS)
      );
    });
    timers.current.push(
      window.setTimeout(() => {
        finished.current = true;
        setRevealing(false);
      }, revealDurationMs(choiceIds.length))
    );

    return () => {
      stopTimers();
      // Torn down before it played out (a fast tap, StrictMode's double mount): hand the claim
      // back, or the reveal is silently spent on a frame nobody saw.
      if (!finished.current && revealedKey === revealKey) revealedKey = null;
    };
  }, [revealKey, choiceKey]);

  return (
    <div className={`map-route${revealing ? ' is-revealing' : ''}`} ref={routeRef}>
      {segments.length > 0 && (
        <svg className="map-paths" aria-hidden="true">
          {segments.map((seg, i) => (
            <g
              key={seg.id}
              className="map-path"
              style={{ '--path-delay': `${i * PATH_STAGGER_MS}ms`, '--node-color': NODE_COLORS[seg.type] } as CSSProperties}
            >
              <path className="map-path-line" d={seg.d} pathLength={1} />
              <path className="map-path-spark" d={seg.d} pathLength={1} />
            </g>
          ))}
        </svg>
      )}

      {/* Whose land this is, on the one row that has nothing behind it (2026-09-08, per user
          direction). ABOVE the sigil, which is the direction the act runs in: the line is the
          place speaking first and the fight is what answers it. The arrival screen has already
          said WHERE you are, so this says who is already here, once — the next node replaces it
          with the route's own origin. */}
      {showOmen && (
        <div className="map-omen-band">
          <p className="map-omen">{omen}</p>
        </div>
      )}

      <div className="map-choices">
        {choiceIds.map((nodeId, i) => (
          <ChoiceMedallion
            key={nodeId}
            map={map}
            node={map.nodes[nodeId]}
            scouted={scouted[nodeId]}
            actNumber={actNumber}
            showLeadOn={showLeadOn}
            guardianId={guardianId}
            landDelayMs={i * PATH_STAGGER_MS + PATH_DRAW_MS}
            opening={openingId === nodeId}
            hint={actNumber === 1 && !originNode && choiceIds.length === 1 ? 'Tap to begin' : undefined}
            onSelect={() => {
              if (openingId) return;
              // Played here rather than via data-sfx, which fires on POINTERDOWN — the same press that
              // starts a long-press preview. Committing to a path should not sound when you are only
              // asking what it is.
              playSfx('map.select');
              const kind = landmarkKind(map.nodes[nodeId].type);
              const beat = kind && OPENING[kind];
              if (beat && !prefersReducedMotion()) {
                playSfx(beat.sfx);
                // The flood pours out of the landmark, wherever it stands on the screen: the gate's
                // doorway, the stone's eye.
                const box = medallionRefs.current.get(nodeId)?.getBoundingClientRect();
                const at = box ? canvasPoint(box.x + box.width / 2, box.y + box.height * (kind === 'stone' ? 0.3 : 0.55)) : { x: 0, y: 0 };
                const flood = { color: kind === 'gate' ? gateWardenColor(guardianId) : TITAN_LIGHT, x: at.x, y: at.y };
                setOpening({ id: nodeId, ...flood });
                timers.current.push(
                  window.setTimeout(() => {
                    handOffFlood(flood);
                    onSelectNode(nodeId);
                  }, beat.ms)
                );
                return;
              }
              onSelectNode(nodeId);
            }}
            onPreview={() => onPreviewNode(map.nodes[nodeId])}
            measureRef={(el) => {
              if (el) medallionRefs.current.set(nodeId, el);
              else medallionRefs.current.delete(nodeId);
            }}
          />
        ))}
      </div>

      {/* Behind you. Unlit and colourless — it is where the paths come FROM, and the only thing on
          the screen that is not a decision. */}
      {/* Where the act begins: the company's camp, so the first node has a road leading to it. */}
      {opensOnFight && (
        <div className="map-origin">
          <span className="map-origin-mark is-start" ref={originRef} aria-hidden="true">
            <img src={campArt} className="map-origin-camp" alt="" draggable={false} />
          </span>
        </div>
      )}

      {originNode && (
        <div className="map-origin">
          <span
            className={`map-origin-mark${originLandmark ? ` is-landmark is-${originLandmark}` : mapNodeArt(originNode.type) ? ' has-art' : ''}`}
            ref={originRef}
            aria-hidden="true"
          >
            {/* A landmark stays itself behind you — the eye, the Mentor, the hall — small and unlit. */}
            {originLandmark ? (
              <MapLandmarkFace kind={originLandmark} type={originNode.type} guardianId={guardianId} actNumber={actNumber} quiet />
            ) : mapNodeArt(originNode.type) ? (
              <img src={mapNodeArt(originNode.type)} className="map-origin-art" alt="" draggable={false} />
            ) : (
              <NodeGlyph type={originNode.type} className="map-origin-glyph" />
            )}
          </span>
        </div>
      )}

      {openingId &&
        createPortal(
          <div
            className={`map-opening-flood is-${landmarkKind(map.nodes[opening!.id].type)}`}
            style={
              {
                '--flood-color': opening!.color,
                '--flood-x': `${opening!.x}px`,
                '--flood-y': `${opening!.y}px`,
              } as CSSProperties
            }
            aria-hidden="true"
          />,
          overlayHost()
        )}

      {/* Plain div, so uiSfx's delegated listener leaves it alone (it only catches real controls). */}
      {revealing && <div className="map-reveal-skip" onClick={skip} />}
    </div>
  );
}

function gateWardenColor(guardianId: string | null): string {
  const type = guardianId ? allCombatants[guardianId]?.types[0] : undefined;
  return type ? getTypeColor(type) : '#e0a63c';
}
