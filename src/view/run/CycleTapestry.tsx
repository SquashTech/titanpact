import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CYCLES, type CycleDefinition } from '../../run/cycles';
import { locationBackdrop } from '../shared/locationBackdrops';
import { heroArt } from '../shared/heroArt';
import { evolutionArt } from '../shared/evolutionArt';
import { GUARDIAN_VIEW_BOX, guardianMarkup } from '../shared/guardianFigures';
import { LEFT_EYE_ID, ROC_ID } from '../../data/enemies';
import './cycleTapestry.css';

// The Cycle picker as a woven chronicle (docs/cycles.md §4). Each Cycle is a panel cross-stitched
// from art the game already has: a cleared Cycle woven, an open one half-woven with its threads
// hanging, a locked one bare warp with what it will hold ghosted through it.

const COLS = 150;
const ROWS = 84;
const CELL = 2;
const OPEN_ROWS = 50;

/** Star colours by Cycle (docs/cycles.md §5); V is drawn as a rainbow frame. */
const THREAD: Record<number, string> = { 1: '#f3eee2', 2: '#c07a3e', 3: '#c9d2dc', 4: '#e6b640', 5: '#ffffff' };

type FigureSpec = { src: string; tint?: string };
interface Scene {
  backdrop?: { src: string; y: number };
  ground?: string;
  /** Sprites standing along the bottom, left to right. */
  figures: FigureSpec[];
  figureRows: number;
  /** Darkens the ground so the figures read against it. */
  groundDim?: number;
}

export interface TapestryWarden {
  heroId: string;
  /** Drawn in the form it finished in, when that form has art. */
  pathId: string | null;
}

export interface CycleTapestryProps {
  /** The highest Cycle the player may start. */
  openCycle: number;
  /** Cycles cleared on the account; those are woven. */
  cleared: number;
  wardens: readonly TapestryWarden[];
  /** What the chronicle says under a cleared Cycle. */
  chronicle: Partial<Record<number, string>>;
  /** Play the weave: this Cycle finishes, then the next one starts if it is open. */
  weaveCycle?: number;
  onBegin: (cycle: number) => void;
  onClose: () => void;
}

function svgUrl(markup: string, viewBox: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="216" height="216">${markup}</svg>`;
  return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
}

function sceneFor(cycle: number, wardens: readonly TapestryWarden[]): Scene {
  const band = wardens.map((w) => (w.pathId && evolutionArt[w.pathId]) || heroArt[w.heroId]).filter((s): s is string => !!s);
  switch (cycle) {
    case 1:
      return { backdrop: { src: locationBackdrop('wildsEdge') ?? '', y: 190 }, figures: band.map((src) => ({ src })), figureRows: 34, groundDim: 0.6 };
    case 2:
      return {
        backdrop: { src: locationBackdrop('holySanctum') ?? '', y: 170 },
        figures: band.map((src) => ({ src, tint: 'rgba(150, 14, 30, 0.5)' })),
        figureRows: 34,
        groundDim: 0.6,
      };
    case 3:
      return { backdrop: { src: locationBackdrop('frozenReach') ?? '', y: 120 }, figures: [], figureRows: 0 };
    case 4:
      return {
        backdrop: { src: locationBackdrop('thunderAerie') ?? '', y: 110 },
        figures: [{ src: svgUrl(guardianMarkup(ROC_ID, 'idle', 'tpRoc'), GUARDIAN_VIEW_BOX) }],
        figureRows: 64,
      };
    default:
      return {
        ground: '#16121c',
        figures: [{ src: svgUrl(guardianMarkup(LEFT_EYE_ID, 'idle', 'tpEye'), GUARDIAN_VIEW_BOX) }],
        figureRows: 76,
      };
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** A sprite's opaque box, so padding in the PNG does not shrink the figure. */
function opaqueBounds(img: HTMLImageElement): { x: number; y: number; w: number; h: number } {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width;
  let y0 = c.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 20) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return x1 < 0 ? { x: 0, y: 0, w: img.width, h: img.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

interface Pixels {
  ground: Uint8ClampedArray;
  figures: Uint8ClampedArray;
}

async function rasterise(scene: Scene): Promise<Pixels> {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = COLS;
    c.height = ROWS;
    return c.getContext('2d')!;
  };
  const g = make();
  if (scene.backdrop) {
    const img = await loadImage(scene.backdrop.src);
    if (img) {
      const h = (img.width * ROWS) / COLS;
      g.drawImage(img, 0, scene.backdrop.y, img.width, h, 0, 0, COLS, ROWS);
    }
  } else {
    g.fillStyle = scene.ground ?? '#000';
    g.fillRect(0, 0, COLS, ROWS);
  }
  const f = make();
  const imgs = (await Promise.all(scene.figures.map((s) => loadImage(s.src)))).map((img, i) => ({ img, spec: scene.figures[i] }));
  const n = imgs.length;
  const slot = (COLS - 4) / Math.max(1, n);
  imgs.forEach(({ img, spec }, i) => {
    if (!img) return;
    const b = opaqueBounds(img);
    const h = scene.figureRows;
    const w = Math.min((b.w / b.h) * h, n === 1 ? COLS : slot + 6);
    const x = n === 1 ? (COLS - w) / 2 : 2 + slot * i + (slot - w) / 2;
    const y = n === 1 ? (ROWS - h) / 2 : ROWS - h - 2;
    const layer = make();
    layer.imageSmoothingEnabled = true;
    layer.drawImage(img, b.x, b.y, b.w, b.h, x, y, w, h);
    if (spec.tint) {
      layer.globalCompositeOperation = 'source-atop';
      layer.fillStyle = spec.tint;
      layer.fillRect(0, 0, COLS, ROWS);
    }
    f.drawImage(layer.canvas, 0, 0);
  });
  if (scene.groundDim) {
    g.fillStyle = `rgba(10, 6, 4, ${1 - scene.groundDim})`;
    g.fillRect(0, 0, COLS, ROWS);
  }
  return { ground: g.getImageData(0, 0, COLS, ROWS).data, figures: f.getImageData(0, 0, COLS, ROWS).data };
}

/** A thread colour: channels snapped to a short skein palette. */
function thread(r: number, g: number, b: number): [number, number, number] {
  const q = (v: number) => Math.round(v / 24) * 24;
  return [q(r), q(g), q(b)];
}

const rgb = (c: [number, number, number], k = 1) =>
  `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;

/** Seeded jitter so a panel's ragged edge and loose threads hold still between frames. */
function noise(i: number, seed: number): number {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type PanelState = 'woven' | 'open' | 'warp';

function drawPanel(ctx: CanvasRenderingContext2D, px: Pixels, state: PanelState, frontier: number, seed: number, scale: number) {
  const s = CELL * scale;
  ctx.clearRect(0, 0, COLS * s, ROWS * s);
  ctx.lineCap = 'round';

  // Warp: the bare vertical threads every unwoven cell sits on.
  ctx.strokeStyle = 'rgba(92, 70, 44, 0.35)';
  ctx.lineWidth = Math.max(1, s * 0.22);
  for (let c = 0; c < COLS; c++) {
    const top = state === 'warp' ? 0 : edge(c, frontier, seed, state);
    if (top >= ROWS) continue;
    ctx.beginPath();
    ctx.moveTo(c * s + s / 2, top * s);
    ctx.lineTo(c * s + s / 2, ROWS * s);
    ctx.stroke();
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = (r * COLS + c) * 4;
      const fa = px.figures[i + 3];
      const woven = state === 'woven' || (state === 'open' && r < edge(c, frontier, seed, state));
      if (!woven) {
        // A locked panel shows what it will hold as a ghost through the warp.
        if (state === 'warp' && fa > 90) stitch(ctx, c, r, s, thread(px.figures[i], px.figures[i + 1], px.figures[i + 2]), 0.2);
        continue;
      }
      const src = fa > 90 ? px.figures : px.ground;
      stitch(ctx, c, r, s, thread(src[i], src[i + 1], src[i + 2]), 1);
    }
  }

  // Loose threads below the woven edge of an open panel.
  if (state === 'open') {
    ctx.lineWidth = s * 0.34;
    for (let c = 0; c < COLS; c++) {
      if (noise(c, seed + 7) > 0.42) continue;
      const top = edge(c, frontier, seed, state);
      if (top >= ROWS || top <= 0) continue;
      const i = ((top - 1) * COLS + c) * 4;
      const src = px.figures[i + 3] > 90 ? px.figures : px.ground;
      const len = 3 + noise(c, seed + 3) * 14;
      const sway = (noise(c, seed + 5) - 0.5) * 2.2;
      ctx.strokeStyle = rgb(thread(src[i], src[i + 1], src[i + 2]), 0.92);
      ctx.beginPath();
      ctx.moveTo(c * s + s / 2, top * s);
      ctx.quadraticCurveTo(c * s + s / 2 + sway * s, (top + len * 0.6) * s, c * s + s / 2 + sway * s * 0.4, Math.min(ROWS, top + len) * s);
      ctx.stroke();
    }
  }
}

function edge(c: number, frontier: number, seed: number, state: PanelState): number {
  if (state === 'woven') return ROWS;
  return Math.round(frontier + (noise(c, seed) - 0.5) * 3 + (noise(Math.floor(c / 6), seed + 1) - 0.5) * 3);
}

function stitch(ctx: CanvasRenderingContext2D, c: number, r: number, s: number, col: [number, number, number], alpha: number) {
  const x = c * s;
  const y = r * s;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = s * 0.46;
  ctx.strokeStyle = rgb(col, 0.78);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.24, y + s * 0.24);
  ctx.lineTo(x + s * 0.76, y + s * 0.76);
  ctx.stroke();
  ctx.strokeStyle = rgb(col, 1.08);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.76, y + s * 0.24);
  ctx.lineTo(x + s * 0.24, y + s * 0.76);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

interface PanelProps {
  def: CycleDefinition;
  state: PanelState;
  scene: Scene;
  /** Rows woven; animates when it changes. */
  rows: number;
}

function StitchPanel({ def, state, scene, rows }: PanelProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [px, setPx] = useState<Pixels | null>(null);
  const shown = useRef(rows);
  const [frontier, setFrontier] = useState(rows);

  useEffect(() => {
    let live = true;
    rasterise(scene).then((p) => live && setPx(p));
    return () => {
      live = false;
    };
    // The scene is derived from props that do not change while the tapestry is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Weave toward the target a row at a time.
  useEffect(() => {
    if (shown.current === rows) return;
    const id = window.setInterval(() => {
      shown.current += Math.sign(rows - shown.current);
      setFrontier(shown.current);
      if (shown.current === rows) window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
  }, [rows]);

  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el || !px) return;
    const scale = 2;
    el.width = COLS * CELL * scale;
    el.height = ROWS * CELL * scale;
    const st: PanelState = state === 'open' && frontier >= ROWS + 2 ? 'woven' : state;
    drawPanel(el.getContext('2d')!, px, st, frontier, def.cycle, scale);
  }, [px, state, frontier, def.cycle]);

  return (
    <div className="tp-panel-art">
      <canvas ref={canvas} className="tp-canvas" style={{ width: COLS * CELL, height: ROWS * CELL }} />
      {state === 'open' && frontier < ROWS + 2 && (
        <div className={`tp-shuttle${frontier !== rows ? ' is-weaving' : ''}`} style={{ top: Math.max(0, frontier) * CELL - 5 }} aria-hidden="true" />
      )}
    </div>
  );
}

export function CycleTapestry({ openCycle, cleared, wardens, chronicle, weaveCycle, onBegin, onClose }: CycleTapestryProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const scenes = useRef(CYCLES.map((c) => sceneFor(c.cycle, wardens)));
  // While weaving, the cycle being finished reads as still open and the next as still warp.
  const [weaveStep, setWeaveStep] = useState<0 | 1 | 2>(weaveCycle ? 0 : 2);
  const scroller = useRef<HTMLDivElement>(null);
  const panels = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!weaveCycle) return;
    const t1 = window.setTimeout(() => setWeaveStep(1), 1600);
    const t2 = window.setTimeout(() => setWeaveStep(2), 1600 + (ROWS + 2 - OPEN_ROWS) * 40 + 700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [weaveCycle]);

  // Open on the newest page of the chronicle.
  useEffect(() => {
    const focus = weaveCycle && weaveStep < 2 ? weaveCycle : Math.min(openCycle, cleared + 1);
    const el = panels.current[focus - 1];
    const box = scroller.current;
    if (!el || !box) return;
    const t = window.setTimeout(() => box.scrollTo({ top: el.offsetTop - 70, behavior: 'smooth' }), weaveStep === 0 ? 900 : 0);
    return () => window.clearTimeout(t);
  }, [openCycle, cleared, weaveCycle, weaveStep]);

  const stateOf = (cycle: number): PanelState => {
    if (weaveCycle && weaveStep < 2) {
      if (cycle === weaveCycle) return 'open';
      if (cycle > weaveCycle) return 'warp';
    }
    return cycle <= cleared ? 'woven' : cycle <= openCycle ? 'open' : 'warp';
  };
  const rowsOf = (cycle: number): number => {
    if (weaveCycle && cycle === weaveCycle) return weaveStep === 0 ? OPEN_ROWS : ROWS + 2;
    return stateOf(cycle) === 'open' ? OPEN_ROWS : stateOf(cycle) === 'woven' ? ROWS + 2 : 0;
  };

  const pickedDef = picked ? CYCLES.find((c) => c.cycle === picked) : undefined;

  return (
    <div className="tp-root">
      <div className="tp-rod" aria-hidden="true">
        <span className="tp-finial tp-finial-l" />
        <span className="tp-rod-bar" />
        <span className="tp-finial tp-finial-r" />
      </div>
      <div className="tp-plaque">The Chronicle</div>
      <button className="tp-close" onClick={onClose} aria-label="Close">
        ✕
      </button>

      <div className="tp-scroll" ref={scroller}>
        <div className="tp-cloth">
          {CYCLES.map((def, idx) => {
            const state = stateOf(def.cycle);
            const selectable = def.cycle <= openCycle;
            const said = state === 'woven' ? chronicle[def.cycle] : undefined;
            return (
              <div
                key={def.cycle}
                ref={(el) => {
                  panels.current[idx] = el;
                }}
                className={`tp-panel is-${state}${picked === def.cycle ? ' is-picked' : ''}`}
                style={{ ['--thread' as string]: THREAD[def.cycle] }}
                onClick={() => selectable && setPicked(picked === def.cycle ? null : def.cycle)}
              >
                <div className="tp-head">
                  <span className="tp-numeral">{def.numeral}</span>
                  <span className="tp-name">{def.name}</span>
                </div>
                <div className={`tp-frame${def.cycle === 5 ? ' is-rainbow' : ''}`}>
                  <StitchPanel
                    def={def}
                    state={state}
                    scene={scenes.current[idx]}
                    rows={rowsOf(def.cycle)}
                  />
                </div>
                <p className="tp-caption">
                  {state === 'warp' ? '' : state === 'open' ? 'This year is not yet written.' : said ?? def.line}
                </p>
              </div>
            );
          })}
          <div className="tp-tassels" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="tp-tassel" style={{ background: THREAD[(i % 5) + 1] }} />
            ))}
          </div>
        </div>
      </div>

      <div className={`tp-sheet${pickedDef ? ' is-up' : ''}`}>
        {pickedDef && (
          <>
            <div className="tp-sheet-head">
              <span className="tp-numeral">{pickedDef.numeral}</span>
              <span className="tp-sheet-name">{pickedDef.name}</span>
              <span className="tp-sheet-bonus">Clear +★ {pickedDef.clearBonus}</span>
            </div>
            <p className="tp-sheet-line">{pickedDef.line}</p>
            <button className="tp-begin" onClick={() => onBegin(pickedDef.cycle)}>
              Begin the Year
            </button>
          </>
        )}
      </div>
    </div>
  );
}
