import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { MapNode, MapNodeType, RunMap } from '../../run/map';
import { NodeGlyph } from '../shared/nodeIcons';
import { playSfx, type SfxId } from '../../audio/sfx';
import { NODE_COLORS, NODE_LABELS, NODE_NAMES, NODE_TIERS } from './mapNodes';
import { nodeFactsLine } from './nodeFacts';
import { mapNodeArt, mapNodeIcon } from './mapNodeArt';
import { landmarkKind, MapLandmarkFace, TITAN_LIGHT, type LandmarkKind } from './mapLandmarks';
import { PatronEntrance, PatronFigure, TrustPips, patronEntranceSfx, patronPose } from './patronView';
import { MapPreview } from './MapPreview';
import { HeroPortrait } from '../shared/HeroPortrait';
import { getTypeColor } from '../combat/typeColors';
import { allCombatants } from '../../data/content';
import { canvasPoint, overlayHost } from '../shared/overlayHost';
import { handOffFlood } from '../shared/EntranceFlood';
import campArt from '../../../art/map-nodes/landmarks/camp.png';
import './mapRoad.css';

/** What a patron seat shows. */
export interface PatronTile {
  id: string;
  title: string;
  name: string;
  color: string;
  trust: number;
}

// The act as one road up the screen (docs/road-map.md): the Guardian at the top on the painting,
// the camp at the foot, a choice row splitting the road into lanes that join at the next stop.
const W = 394;
const PAINT_H = 688;
const ROW_GAP = 206;
const TOP_Y = 560;
const FOOT = 250;
const CAMP_DROP = 150;
const LANES: Record<number, number[]> = { 1: [0], 2: [-80, 80], 3: [-124, 0, 124] };

/** A door goes on its first tap; a row of one does too, unless its keeper is met first. */
const ENTERED_ON_TAP: readonly MapNodeType[] = ['boss', 'finale', 'fight', 'battle'];
const PREVIEWED_WHEN_ALONE: readonly MapNodeType[] = ['mentorReward', 'tutorReward', 'academyReward'];

const OPENING: Partial<Record<LandmarkKind, { ms: number; sfx: SfxId }>> = {
  tower: { ms: 1250, sfx: 'map.gate' },
  titanGate: { ms: 1250, sfx: 'map.gate' },
  stone: { ms: 700, sfx: 'titan.gaze' },
};

type StopState = 'done' | 'skipped' | 'here' | 'next' | 'ahead';
type SegState = 'walked' | 'skipped' | 'live' | 'ahead';

interface Stop {
  id: string;
  type: MapNodeType;
  x: number;
  y: number;
  state: StopState;
}

/** The node the last road was drawn at, so arriving somewhere new walks the view up from it. */
let lastShownAt: { key: string; scrollTop: number } | null = null;

/** The stop whose patrons last made their entrance, so a trip to the Roster sheet does not replay it. */
let enteredAt: string | null = null;

// A patron's entrance runs this long (patronView ENTRANCES); two on one row start this far apart, after the road has scrolled.
const ENTRANCE_MS = 1580;
const PATRON_STAGGER_MS = 910;
const ENTRANCE_START_MS = 450;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dy = (y1 - y2) / 2;
  return `M${x1} ${y1}C${x1} ${y1 - dy} ${x2} ${y2 + dy} ${x2} ${y2}`;
}

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rgb = [number, number, number];
const shade = ([r, g, b]: Rgb, k: number): string => {
  const f = (c: number) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
};

/** The painting's own ground colour, read where the painting fades into it, so the road's land continues it. */
function useGroundColor(src: string | undefined): Rgb {
  const [rgb, setRgb] = useState<Rgb>([134, 201, 90]);
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, Math.round(img.naturalHeight * 0.8), img.naturalWidth, 1, 0, 0, img.naturalWidth, 1);
        const data = ctx.getImageData(0, 0, img.naturalWidth, 1).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        if (n) setRgb([r / n, g / n, b / n]);
      } catch {
        // A tainted canvas keeps the meadow default.
      }
    };
    img.src = src;
  }, [src]);
  return rgb;
}

function wardenColor(guardianId: string | null): string {
  const type = guardianId ? allCombatants[guardianId]?.types[0] : undefined;
  return type ? getTypeColor(type) : '#e0a63c';
}

export function MapRoad({
  map,
  currentNodeId,
  visitedNodeIds,
  choiceIds,
  actNumber,
  guardianId,
  painting,
  leadHeroId,
  onSelectNode,
  renderDossier,
  onPreviewChange,
  patronFor,
}: {
  map: RunMap;
  currentNodeId: string | null;
  visitedNodeIds: readonly string[];
  choiceIds: readonly string[];
  actNumber: number;
  /** The act's Guardian, whose element lights the tower's door. */
  guardianId: string | null;
  /** The Location's map painting, standing at the top of the road as its horizon. */
  painting?: string;
  /** Whose face the party's token wears. */
  leadHeroId?: string;
  onSelectNode: (nodeId: string) => void;
  renderDossier: (node: MapNode) => ReactNode;
  onPreviewChange?: (node: MapNode | null) => void;
  patronFor?: (node: MapNode) => PatronTile | null;
}) {
  const rowCount = map.rows.length;
  const H = TOP_Y + (rowCount - 1) * ROW_GAP + FOOT;
  const rowY = (r: number) => TOP_Y + (rowCount - 1 - r) * ROW_GAP;
  const spineX = (r: number) => (map.rows[r].length > 1 ? W / 2 : W / 2 + Math.sin(r * 1.25 + 0.4) * 82);
  const camp = { x: W / 2, y: rowY(0) + CAMP_DROP };
  const currentRow = currentNodeId ? map.nodes[currentNodeId]?.row ?? -1 : -1;
  const choiceKey = choiceIds.join(',');

  const rows: Stop[][] = useMemo(
    () =>
      map.rows.map((ids, r) =>
        ids.map((id, col) => {
          const state: StopState =
            id === currentNodeId ? 'here' : visitedNodeIds.includes(id) ? 'done' : choiceIds.includes(id) ? 'next' : r <= currentRow ? 'skipped' : 'ahead';
          return { id, type: map.nodes[id].type, x: spineX(r) + LANES[ids.length][col], y: rowY(r), state };
        })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, currentNodeId, visitedNodeIds.join(','), choiceKey]
  );

  const segments = useMemo(() => {
    const out: { d: string; state: SegState }[] = [];
    const lower = (s: StopState): SegState => (s === 'done' ? 'walked' : s === 'here' ? 'live' : s === 'skipped' ? 'skipped' : 'ahead');
    const upper = (s: StopState): SegState => (s === 'done' || s === 'here' ? 'walked' : s === 'next' ? 'live' : s === 'skipped' ? 'skipped' : 'ahead');
    const join = (from: Stop[] | { x: number; y: number; state: StopState }[], to: Stop[], fromRow: number) => {
      if (from.length === 1 && to.length === 1) {
        const u = upper(to[0].state);
        out.push({ d: curve(from[0].x, from[0].y, to[0].x, to[0].y), state: u === 'ahead' ? lower(from[0].state) === 'live' ? 'live' : 'ahead' : u });
        return;
      }
      const j = { x: from.length === 1 ? from[0].x : to.length === 1 ? to[0].x : W / 2, y: (from[0].y + to[0].y) / 2 };
      if (fromRow >= 0 && from.length > 1 && to.length > 1) j.x = (spineX(fromRow) + spineX(fromRow + 1)) / 2;
      for (const s of from) out.push({ d: curve(s.x, s.y, j.x, j.y), state: lower(s.state) });
      for (const s of to) out.push({ d: curve(j.x, j.y, s.x, s.y), state: upper(s.state) });
    };
    join([{ ...camp, state: currentNodeId ? 'done' : 'here' }], rows[0], -1);
    for (let r = 0; r < rows.length - 1; r++) join(rows[r], rows[r + 1], r);
    const order: SegState[] = ['ahead', 'skipped', 'walked', 'live'];
    return out.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const ground = useGroundColor(painting);
  const scenery = useMemo(() => {
    const rnd = mulberry(map.seed * 31 + actNumber);
    const keepOff = [...rows.flat(), camp];
    for (let r = -1; r < rowCount - 1; r++) {
      const a = r < 0 ? camp.x : spineX(r);
      const b = spineX(r + 1);
      const y0 = r < 0 ? camp.y : rowY(r);
      const y1 = rowY(r + 1);
      for (let t = 0; t <= 1; t += 0.1) keepOff.push({ x: a + (b - a) * (3 * t * t - 2 * t * t * t), y: y0 + (y1 - y0) * t } as Stop);
    }
    const lanesAt = rows.filter((row) => row.length > 1).map((row) => row[0].y);
    const trees: { x: number; y: number; r: number; tone: number }[] = [];
    for (let i = 0; i < 260 && trees.length < 8 + rowCount * 4; i++) {
      const x = 14 + rnd() * (W - 28);
      const y = TOP_Y + 120 + rnd() * (H - TOP_Y - 140);
      if (keepOff.every((p) => Math.hypot(p.x - x, p.y - y) > 60) && lanesAt.every((ly) => Math.abs(ly - y) > 70)) trees.push({ x, y, r: 13 + rnd() * 9, tone: rnd() });
    }
    const flecks = Array.from({ length: rowCount * 7 }, () => ({ x: rnd() * W, y: TOP_Y + 80 + rnd() * (H - TOP_Y - 90), k: rnd() }));
    return { trees: trees.sort((a, b) => a.y - b.y), flecks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.seed, actNumber, rows]);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [opening, setOpening] = useState<{ id: string; kind: LandmarkKind; color: string; x: number; y: number } | null>(null);
  useEffect(() => setPreviewId(null), [choiceKey]);
  useEffect(() => {
    onPreviewChange?.(previewId ? map.nodes[previewId] ?? null : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewId]);
  const stopRefs = useRef(new Map<string, HTMLButtonElement>());
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Patrons reached on this stop make their entrance once, one after the other, each with its sound.
  const patronIds = choiceIds.filter((id) => patronFor?.(map.nodes[id]));
  const [entering, setEntering] = useState(false);
  useEffect(() => {
    const key = `${map.seed}:${actNumber}:${currentNodeId ?? 'camp'}`;
    if (!patronIds.length || enteredAt === key) return;
    enteredAt = key;
    if (prefersReducedMotion()) return;
    setEntering(true);
    const own: number[] = [];
    patronIds.forEach((id, i) => {
      const sfx = patronEntranceSfx(patronFor!(map.nodes[id])!.id);
      if (sfx) own.push(window.setTimeout(() => playSfx(sfx), ENTRANCE_START_MS + i * PATRON_STAGGER_MS));
    });
    own.push(window.setTimeout(() => setEntering(false), ENTRANCE_START_MS + (patronIds.length - 1) * PATRON_STAGGER_MS + ENTRANCE_MS));
    return () => {
      own.forEach(clearTimeout);
      if (enteredAt === key) enteredAt = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choiceKey]);

  // Opened on where you stand; arriving somewhere new walks the view up from the last stop.
  const scroller = useRef<HTMLDivElement>(null);
  const here = currentNodeId ? rows.flat().find((s) => s.id === currentNodeId) ?? camp : camp;
  const placeKey = `${map.seed}:${actNumber}:${currentNodeId ?? 'camp'}`;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = Math.max(0, Math.min(H - el.clientHeight, here.y - el.clientHeight * 0.74));
    const from = lastShownAt && lastShownAt.key !== placeKey && lastShownAt.key.startsWith(`${map.seed}:${actNumber}:`) ? lastShownAt.scrollTop : null;
    lastShownAt = { key: placeKey, scrollTop: target };
    if (from === null || prefersReducedMotion() || Math.abs(from - target) < 4) {
      el.scrollTop = target;
      return;
    }
    el.scrollTop = from;
    playSfx('map.path');
    const t = window.setTimeout(() => el.scrollTo({ top: target, behavior: 'smooth' }), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey]);

  function go(nodeId: string) {
    if (opening) return;
    setPreviewId(null);
    playSfx('map.select');
    const kind = landmarkKind(map.nodes[nodeId].type);
    const beat = kind && OPENING[kind];
    if (kind && beat && !prefersReducedMotion()) {
      playSfx(beat.sfx);
      const box = stopRefs.current.get(nodeId)?.getBoundingClientRect();
      const at = box ? canvasPoint(box.x + box.width / 2, box.y + box.height * (kind === 'stone' ? 0.3 : 0.7)) : { x: 0, y: 0 };
      const flood = { color: kind === 'tower' ? wardenColor(guardianId) : TITAN_LIGHT, x: at.x, y: at.y };
      setOpening({ id: nodeId, kind, ...flood });
      timers.current.push(
        window.setTimeout(() => {
          handOffFlood(flood);
          onSelectNode(nodeId);
        }, beat.ms)
      );
      return;
    }
    onSelectNode(nodeId);
  }

  function tap(nodeId: string) {
    if (opening || !choiceIds.includes(nodeId)) return;
    const type = map.nodes[nodeId].type;
    const alone = choiceIds.length === 1 && !PREVIEWED_WHEN_ALONE.includes(type);
    if (previewId === nodeId || alone || ENTERED_ON_TAP.includes(type)) {
      go(nodeId);
      return;
    }
    playSfx('ui.select');
    setPreviewId(nodeId);
  }

  const groundStyle = { '--road-ground': shade(ground, 0), '--road-ground-dark': shade(ground, -0.3), '--road-ground-mid': shade(ground, -0.18), '--road-ground-light': shade(ground, 0.18) } as CSSProperties;

  return (
    <div className="road-scroll" ref={scroller} style={groundStyle}>
      <div className="road-world" style={{ height: H }}>
        {painting && <img className="road-painting" src={painting} alt="" draggable={false} style={{ height: PAINT_H, top: TOP_Y - PAINT_H + 150 }} />}
        <svg className="road-ground" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {Array.from({ length: rowCount }, (_, i) => (
            <ellipse key={i} cx={i % 2 ? 60 : 330} cy={TOP_Y + 240 + i * 190} rx={170} ry={70} style={{ fill: 'var(--road-ground-light)' }} opacity={0.35} />
          ))}
          {scenery.flecks.map((f, i) => (
            <circle key={i} cx={f.x} cy={f.y} r={2.2} style={{ fill: f.k > 0.5 ? 'var(--road-ground-light)' : '#fff6c8' }} opacity={0.8} />
          ))}
          {scenery.trees.map((t, i) => (
            <g key={i}>
              <ellipse cx={t.x} cy={t.y + t.r * 0.95} rx={t.r * 0.9} ry={t.r * 0.3} fill="#2b2340" opacity={0.18} />
              <rect x={t.x - 3} y={t.y + t.r * 0.3} width={6} height={t.r * 0.7} rx={2} fill="#8a5a3a" stroke="#2b2340" strokeWidth={2} />
              <circle cx={t.x} cy={t.y} r={t.r} style={{ fill: t.tone > 0.5 ? 'var(--road-ground-dark)' : 'var(--road-ground-mid)' }} stroke="#2b2340" strokeWidth={3} />
              <circle cx={t.x - t.r * 0.3} cy={t.y - t.r * 0.35} r={t.r * 0.35} style={{ fill: 'var(--road-ground)' }} />
            </g>
          ))}
        </svg>
        <svg className="road-paths" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {segments.map((s, i) => (
            <g key={i} className={`road-seg is-${s.state}`}>
              <path d={s.d} className="road-seg-rim" />
              <path d={s.d} className="road-seg-face" />
              <path d={s.d} className="road-seg-dash" />
            </g>
          ))}
        </svg>
        {currentRow + 1 < rowCount - 1 && (
          <div className="road-mist" style={{ top: TOP_Y + 70, height: Math.max(0, rowY(currentRow + 1) - ROW_GAP / 2 - TOP_Y - 70) }} />
        )}

        <div className="road-at road-camp" style={{ left: camp.x, top: camp.y }}>
          <img src={campArt} alt="" draggable={false} />
        </div>
        {rows.flat().map((s) => (
          <div key={s.id} className={`road-at is-${s.state}`} style={{ left: s.x, top: s.y }}>
            <RoadStop
              stop={s}
              guardianId={guardianId}
              actNumber={actNumber}
              patron={s.state === 'next' ? patronFor?.(map.nodes[s.id]) : null}
              previewed={previewId === s.id}
              entering={entering ? ENTRANCE_START_MS + Math.max(0, patronIds.indexOf(s.id)) * PATRON_STAGGER_MS : undefined}
              opening={opening?.id === s.id}
              onTap={() => tap(s.id)}
              hint={actNumber === 1 && !currentNodeId && choiceIds.length === 1 ? 'Tap to begin' : undefined}
              measureRef={(el) => {
                if (el) stopRefs.current.set(s.id, el);
                else stopRefs.current.delete(s.id);
              }}
            />
          </div>
        ))}
        <div className="road-at road-token-at" style={{ left: here.x, top: here.y }} aria-hidden="true">
          <span className="road-token">
            <span className="road-token-face">{leadHeroId && <HeroPortrait heroId={leadHeroId} className="road-token-portrait" />}</span>
            <span className="road-token-tail" />
          </span>
        </div>
      </div>

      {opening &&
        createPortal(
          <div
            className={`map-opening-flood is-${opening.kind}`}
            style={{ '--flood-color': opening.color, '--flood-x': `${opening.x}px`, '--flood-y': `${opening.y}px` } as CSSProperties}
            aria-hidden="true"
          />,
          overlayHost()
        )}

      {previewId &&
        map.nodes[previewId] &&
        createPortal(
          <MapPreview
            tiles={choiceIds.flatMap((id) => {
              const el = stopRefs.current.get(id);
              return el ? [{ id, el }] : [];
            })}
            previewId={previewId}
            color={patronFor?.(map.nodes[previewId])?.color ?? NODE_COLORS[map.nodes[previewId].type]}
            label={patronFor?.(map.nodes[previewId])?.name ?? NODE_LABELS[map.nodes[previewId].type]}
            onTap={tap}
            onBack={() => setPreviewId(null)}
            onGo={() => go(previewId)}
            pages={choiceIds.filter((id) => map.nodes[id] && !ENTERED_ON_TAP.includes(map.nodes[id].type)).map((id) => ({ id, content: renderDossier(map.nodes[id]) }))}
          />,
          overlayHost()
        )}
    </div>
  );
}

function RoadStop({
  stop,
  guardianId,
  actNumber,
  patron,
  previewed,
  entering,
  opening,
  hint,
  onTap,
  measureRef,
}: {
  stop: Stop;
  guardianId: string | null;
  actNumber: number;
  patron?: PatronTile | null;
  previewed: boolean;
  /** Making its patron's entrance, starting this many ms in. */
  entering?: number;
  opening: boolean;
  hint?: string;
  onTap: () => void;
  measureRef: (el: HTMLButtonElement | null) => void;
}) {
  const { type, state } = stop;
  const landmark = landmarkKind(type);
  const hidden = state === 'ahead' && NODE_TIERS[type] === 'reward';
  const live = state === 'next';
  const icon = mapNodeIcon(type) ?? mapNodeArt(type);
  const label = patron ? `${patron.name}, ${patron.title}` : nodeFactsLine(NODE_NAMES[type], type, actNumber);
  const style = { '--node-color': patron?.color ?? NODE_COLORS[type], '--land-delay': `${entering ?? 0}ms` } as CSSProperties;
  return (
    <button
      type="button"
      className={`road-stop is-${state} type-${type}${landmark ? ` is-landmark is-${landmark}` : ''}${patron ? ' is-patron' : ''}${previewed ? ' is-previewed' : ''}${patron && entering !== undefined ? ' is-entering' : ''}${patron && patronPose(patron.id) ? ' has-pose' : ''}${opening ? ' is-opening' : ''}`}
      style={style}
      ref={measureRef}
      aria-label={live ? label : NODE_NAMES[type]}
      aria-disabled={!live}
      tabIndex={live ? 0 : -1}
      data-sfx="none"
      data-patron={patron?.id}
      onClick={onTap}
    >
      {landmark && !hidden ? (
        <span className="road-landmark">
          <MapLandmarkFace kind={landmark} type={type} guardianId={guardianId} quiet={!live} />
        </span>
      ) : (
        <span className="road-disc">
          {hidden ? (
            <span className="road-unknown">?</span>
          ) : patron ? (
            <>
              <PatronEntrance patronId={patron.id} />
              <PatronFigure patronId={patron.id} className="road-patron" />
              <TrustPips trust={patron.trust} className="road-trust" />
            </>
          ) : icon ? (
            <img src={icon} alt="" draggable={false} />
          ) : (
            <NodeGlyph type={type} className="road-glyph" />
          )}
        </span>
      )}
      {state === 'done' && <span className="road-check" aria-hidden="true">✓</span>}
      {(live || type === 'boss') && (
        <span className="road-label" aria-hidden="true">
          {patron ? patron.name : NODE_LABELS[type]}
        </span>
      )}
      {hint && live && !opening && <span className="road-hint" aria-hidden="true">{hint}</span>}
    </button>
  );
}
