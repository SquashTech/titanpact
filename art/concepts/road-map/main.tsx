import ReactDOM from 'react-dom/client';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import '../../../src/app/styles.css';
import '../../../src/app/storybook.css';
import './road.css';
import { MapScreen } from '../../../src/view/run/MapScreen';
import { createRosterEntry, createRunState, type RunState } from '../../../src/run/state';
import { generateMap, type MapNodeType } from '../../../src/run/map';
import { heroes } from '../../../src/data/heroes';
import { withReachableSeatOffers } from '../../../src/run/runProgress';
import { mapNodeArt, mapNodeIcon } from '../../../src/view/run/mapNodeArt';
import { landmarkStillArt } from '../../../src/view/run/mapLandmarks';
import { NODE_COLORS, NODE_LABELS, NODE_NAMES, NODE_TIERS } from '../../../src/view/run/mapNodes';
import { HeroPortrait } from '../../../src/view/shared/HeroPortrait';
import paintingArt from '../../../art/locations/map/wildsEdge.png';
import huntressArt from '../../../art/npc/patron-huntress.png';
import archmageArt from '../../../art/npc/patron-archmage.png';
import lairArt from './guardian/lair.png';
import ringArt from './guardian/ring.png';
import towerArt from './guardian/tower.png';
import eggArt from './guardian/egg.png';
import throneArt from './guardian/throne.png';

// One real Act 1 map, walked to the Skirmish: the next pick is the three-wide reward row.
const SEED = 7;
const PARTY = ['valor', 'crag', 'kitsu', 'tidecaller'];
const PICKS = new URLSearchParams(location.search).get('picks')?.split(',').filter(Boolean).map(Number) ?? [0, 1, 0, 0, 1];
const HERE_ROW = PICKS.length - 1;

function buildRun(): RunState {
  const map = generateMap(SEED, 1);
  const visited = PICKS.map((col, row) => map.rows[row][col]);
  return withReachableSeatOffers({
    ...createRunState(),
    roster: PARTY.map((id) => createRosterEntry(id, id, heroes[id].moveIds)),
    map,
    currentNodeId: visited[visited.length - 1] ?? null,
    visitedNodeIds: visited,
    fightsStarted: 3,
    encountersWon: 3,
    locationIds: [new URLSearchParams(location.search).get('place') ?? 'wildsEdge'],
  });
}

const RUN = buildRun();
const MAP = RUN.map!;

// ---- geometry ---------------------------------------------------------------------------------

const W = 394;
const ROW_GAP = 206;
const BOSS_Y = 560;
const H = BOSS_Y + 9 * ROW_GAP + 150;
const rowY = (r: number) => H - 150 - r * ROW_GAP;
const LANE_OFFSETS: Record<number, number[]> = { 1: [0], 2: [-80, 80], 3: [-124, 0, 124] };

type Variant = 'lanes' | 'signpost';
type NodeState = 'done' | 'skipped' | 'here' | 'next' | 'ahead';

interface Stop {
  id: string;
  row: number;
  type: MapNodeType;
  x: number;
  y: number;
  state: NodeState;
  /** Signpost only: the row's options when it is a choice. */
  options?: { id: string; type: MapNodeType; state: NodeState }[];
}

function nodeState(row: number, col: number): NodeState {
  if (row < HERE_ROW) return PICKS[row] === col ? 'done' : 'skipped';
  if (row === HERE_ROW) return PICKS[row] === col ? 'here' : 'skipped';
  return row === HERE_ROW + 1 ? 'next' : 'ahead';
}

function spineX(row: number, variant: Variant): number {
  const wide = MAP.rows[row].length > 1;
  if (variant === 'lanes' && wide) return W / 2;
  return W / 2 + Math.sin(row * 1.25 + 0.4) * 82;
}

function stopsFor(variant: Variant): Stop[][] {
  return MAP.rows.map((ids, row) => {
    const y = rowY(row);
    const cx = spineX(row, variant);
    const nodes = ids.map((id, col) => ({ id, type: MAP.nodes[id].type, state: nodeState(row, col) }));
    if (variant === 'signpost' && ids.length > 1) {
      const picked = nodes.find((n) => n.state === 'done' || n.state === 'here');
      const state: NodeState = picked ? picked.state : nodes[0].state;
      return [{ id: `sign-${row}`, row, type: picked?.type ?? nodes[0].type, x: cx, y, state, options: nodes }];
    }
    return nodes.map((n, col) => ({ ...n, row, x: cx + LANE_OFFSETS[ids.length][col], y }));
  });
}

type SegState = 'walked' | 'skipped' | 'live' | 'ahead';
const segOf = (s: NodeState, upper: boolean): SegState =>
  s === 'done' ? 'walked' : s === 'skipped' ? 'skipped' : s === 'here' ? (upper ? 'walked' : 'live') : s === 'next' ? (upper ? 'live' : 'ahead') : 'ahead';

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dy = (y1 - y2) / 2;
  return `M${x1} ${y1} C${x1} ${y1 - dy} ${x2} ${y2 + dy} ${x2} ${y2}`;
}

function segmentsFor(rows: Stop[][]): { d: string; state: SegState }[] {
  const segs: { d: string; state: SegState }[] = [];
  for (let r = 0; r < rows.length - 1; r++) {
    const a = rows[r];
    const b = rows[r + 1];
    const jx = (spineX(r, 'lanes') + spineX(r + 1, 'lanes')) / 2;
    const jy = (a[0].y + b[0].y) / 2;
    const aX = a.length > 1 ? jx : a[0].x;
    const bX = b.length > 1 ? jx : b[0].x;
    const j = a.length === 1 && b.length === 1 ? null : { x: a.length === 1 ? aX : b.length === 1 ? bX : jx, y: jy };
    if (!j) {
      segs.push({ d: curve(a[0].x, a[0].y, b[0].x, b[0].y), state: segOf(b[0].state, true) === 'live' ? 'live' : segOf(a[0].state, false) });
      continue;
    }
    for (const s of a) segs.push({ d: curve(s.x, s.y, j.x, j.y), state: segOf(s.state, false) });
    for (const s of b) segs.push({ d: curve(j.x, j.y, s.x, s.y), state: segOf(s.state, true) });
  }
  return segs;
}

// ---- faces ------------------------------------------------------------------------------------

const PATRON_ART = [huntressArt, archmageArt];

function faceArt(type: MapNodeType, col = 0, guardian?: string): { src?: string; big: boolean } {
  if (type === 'boss' && guardian) return { src: guardian, big: true };
  if (type === 'patronSeat') return { src: PATRON_ART[col % 2], big: false };
  const still = landmarkStillArt(type);
  if (still) return { src: still, big: true };
  return { src: mapNodeIcon(type) ?? mapNodeArt(type), big: false };
}

function Medallion({ type, col, state, label, onTap, lit, guardian }: { type: MapNodeType; col: number; state: NodeState; label?: boolean; onTap?: () => void; lit?: boolean; guardian?: string }) {
  const art = faceArt(type, col, guardian);
  const hidden = state === 'ahead' && NODE_TIERS[type] === 'reward';
  const style = { '--node-color': NODE_COLORS[type] } as CSSProperties;
  return (
    <button className={`rm-node is-${state} ${art.big ? 'is-big' : ''} ${lit ? 'is-lit' : ''} ${guardian ? 'is-alt' : ''} type-${type}`} style={style} onClick={onTap}>
      {art.big ? (
        <img className="rm-landmark" src={art.src} alt="" draggable={false} />
      ) : (
        <span className="rm-disc">{hidden ? <span className="rm-q">?</span> : <img src={art.src} alt="" draggable={false} />}</span>
      )}
      {state === 'done' && <span className="rm-check">✓</span>}
      {label && <span className="rm-label">{NODE_LABELS[type]}</span>}
    </button>
  );
}

function PartyToken() {
  return (
    <span className="rm-token">
      <span className="rm-token-face">
        <HeroPortrait heroId={PARTY[0]} />
      </span>
      <span className="rm-token-tail" />
    </span>
  );
}

function Signpost({ arrows }: { arrows: number }) {
  return (
    <span className="rm-sign">
      <span className="rm-sign-post" />
      {Array.from({ length: arrows }, (_, i) => (
        <span key={i} className={`rm-sign-board ${i % 2 ? 'is-right' : 'is-left'}`} style={{ top: 4 + i * 13 }} />
      ))}
    </span>
  );
}

// ---- ground -----------------------------------------------------------------------------------

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Ground({ rows, variant }: { rows: Stop[][]; variant: Variant }) {
  const rnd = mulberry(11);
  // Sample the road's spine so trees keep off it.
  const spine: { x: number; y: number }[] = [];
  for (let r = 0; r < rows.length - 1; r++) {
    const a = spineX(r, variant);
    const b = spineX(r + 1, variant);
    for (let t = 0; t <= 1; t += 0.1) spine.push({ x: a + (b - a) * (3 * t * t - 2 * t * t * t), y: rowY(r) - ROW_GAP * t });
  }
  const pts = [...rows.flat(), ...spine];
  const trees: { x: number; y: number; r: number; tone: number }[] = [];
  for (let i = 0; i < 200 && trees.length < 40; i++) {
    const x = 14 + rnd() * (W - 28);
    const y = BOSS_Y + 120 + rnd() * (H - BOSS_Y - 140);
    const clear = pts.every((p) => Math.hypot(p.x - x, p.y - y) > 60) && (variant === 'signpost' || rows.every((row) => row.length === 1 || Math.abs(row[0].y - y) > 70));
    if (clear) trees.push({ x, y, r: 13 + rnd() * 9, tone: rnd() });
  }
  const flowers = Array.from({ length: 70 }, () => ({ x: rnd() * W, y: BOSS_Y + 80 + rnd() * (H - BOSS_Y - 90), c: ['#fff6c8', '#ffb7d0', '#ffffff'][Math.floor(rnd() * 3)] }));
  return (
    <svg className="rm-ground" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <ellipse key={i} cx={i % 2 ? 60 : 330} cy={BOSS_Y + 240 + i * 190} rx={170} ry={70} fill="#9bd86a" opacity={0.45} />
      ))}
      <ellipse cx={318} cy={rowY(2) - 40} rx={44} ry={24} fill="#7fd0ee" stroke="#2b2340" strokeWidth={3} />
      <ellipse cx={312} cy={rowY(2) - 46} rx={20} ry={7} fill="#c9f0fb" />
      {flowers.map((f, i) => (
        <circle key={i} cx={f.x} cy={f.y} r={2.2} fill={f.c} />
      ))}
      {trees
        .sort((a, b) => a.y - b.y)
        .map((t, i) => (
          <g key={i}>
            <ellipse cx={t.x} cy={t.y + t.r * 0.95} rx={t.r * 0.9} ry={t.r * 0.3} fill="#2b2340" opacity={0.18} />
            <rect x={t.x - 3} y={t.y + t.r * 0.3} width={6} height={t.r * 0.7} rx={2} fill="#8a5a3a" stroke="#2b2340" strokeWidth={2} />
            <circle cx={t.x} cy={t.y} r={t.r} fill={t.tone > 0.5 ? '#4fae4a' : '#5cbc52'} stroke="#2b2340" strokeWidth={3} />
            <circle cx={t.x - t.r * 0.3} cy={t.y - t.r * 0.35} r={t.r * 0.35} fill="#8fdc6e" />
          </g>
        ))}
    </svg>
  );
}

// ---- the road mock ----------------------------------------------------------------------------

function RoadMap({ variant, guardian, top }: { variant: Variant; guardian?: string; top?: boolean }) {
  const rows = stopsFor(variant);
  const segs = segmentsFor(rows);
  const [lit, setLit] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = top ? BOSS_Y - 250 : rowY(HERE_ROW) - el.clientHeight * 0.8;
  }, []);
  const here = rows[HERE_ROW].find((s) => s.state === 'here') ?? rows[HERE_ROW][0];
  const fogBottom = rowY(HERE_ROW + 1) - ROW_GAP / 2;
  const litType = lit ? MAP.nodes[lit]?.type : null;

  return (
    <div className="rm-phone-inner">
      <header className="rm-header">
        <span className="rm-chip">
          <b>Act</b> 1<i>/4</i>
        </span>
        <span className="rm-place">Wild&rsquo;s Edge</span>
        <span className="rm-chip is-round">≡</span>
      </header>
      <div className="rm-scroll" ref={scroller} onClick={(e) => e.target === e.currentTarget && setLit(null)}>
        <div className="rm-world" style={{ height: H }}>
          <img className="rm-painting" src={paintingArt} alt="" draggable={false} />
          <Ground rows={rows} variant={variant} />
          <svg className="rm-road" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            {(['ahead', 'skipped', 'walked', 'live'] as SegState[]).map((state) =>
              segs
                .filter((s) => s.state === state)
                .map((s, i) => (
                  <g key={`${state}${i}`} className={`rm-seg is-${state}`}>
                    <path d={s.d} className="rm-seg-rim" />
                    <path d={s.d} className="rm-seg-face" />
                    <path d={s.d} className="rm-seg-dash" />
                  </g>
                ))
            )}
          </svg>
          <div className="rm-fog" style={{ top: BOSS_Y + 70, height: fogBottom - BOSS_Y - 70 }} />
          {rows.flat().map((s) =>
            s.options ? (
              <div key={s.id} className={`rm-at rm-sign-at is-${s.state}`} style={{ left: s.x, top: s.y }}>
                <Signpost arrows={s.options.length} />
                {(s.state === 'done' || s.state === 'here') && (
                  <span className="rm-sign-badge">
                    <Medallion type={s.type} col={s.options.findIndex((o) => o.type === s.type)} state="done" />
                  </span>
                )}
                {s.state === 'next' && (
                  <div className="rm-tray">
                    {s.options.map((o, col) => (
                      <Medallion key={o.id} type={o.type} col={col} state="next" label lit={lit === o.id} onTap={() => setLit(lit === o.id ? null : o.id)} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div key={s.id} className={`rm-at is-${s.state}`} style={{ left: s.x, top: s.y }}>
                <Medallion type={s.type} col={MAP.nodes[s.id].col} state={s.state} label={s.state === 'next' || s.type === 'boss'} guardian={guardian} lit={lit === s.id} onTap={s.state === 'next' ? () => setLit(lit === s.id ? null : s.id) : undefined} />
              </div>
            )
          )}
          <div className="rm-at rm-token-at" style={{ left: here.x, top: here.y }}>
            <PartyToken />
          </div>
        </div>
      </div>
      {litType && (
        <div className="rm-card">
          <span className="rm-card-name">{NODE_NAMES[litType]}</span>
          <span className="rm-card-go">Go</span>
        </div>
      )}
      <footer className="rm-footer">
        <span className="rm-roster">
          <b>Roster</b>
          <span className="rm-roster-faces">
            {PARTY.map((id) => (
              <span key={id} className="rm-roster-face">
                <HeroPortrait heroId={id} />
              </span>
            ))}
          </span>
        </span>
      </footer>
    </div>
  );
}

function NowMap() {
  const [run, setRun] = useState(RUN);
  return <MapScreen run={run} onRunChange={setRun} onSelectNode={() => {}} />;
}

// ---- page -------------------------------------------------------------------------------------

const PHONES: { id: string; name: string; note: string; body: () => ReactNode }[] = [
  { id: 'now', name: 'Now', note: 'One row of choices over the Location painting.', body: () => <NowMap /> },
  { id: 'a', name: 'A · Lanes', note: 'The act as one scrolling road. A choice is the road splitting into lanes that join again at the next stop; mist hides what the lanes past the next one hold.', body: () => <RoadMap variant="lanes" guardian={towerArt} /> },
  { id: 'b', name: 'B · Signposts', note: 'One road, no lanes. A choice is a signpost on it, and the one you are at raises today’s tiles on a paper tray.', body: () => <RoadMap variant="signpost" /> },
];

const GUARDIANS: { id: string; name: string; note: string; art?: string }[] = [
  { id: 'gate', name: 'Today · the gate', note: 'The sealed stone gate.' },
  { id: 'lair', name: 'Lair', note: 'A cave in a hill, claw marks by the mouth, bones and a lost shield.', art: lairArt },
  { id: 'ring', name: 'Ring', note: 'Standing stones round an arena floor, a gold seal at its heart.', art: ringArt },
  { id: 'tower', name: 'Tower · picked', note: 'A stout keep with a red pennant and a barred door.', art: towerArt },
  { id: 'egg', name: 'Egg', note: 'A chained stone egg cracking with gold light; what sleeps in it is the fight.', art: eggArt },
  { id: 'throne', name: 'Throne', note: 'An empty clawed throne on a dais; its owner is out.', art: throneArt },
];

function Phone({ children, short }: { children: ReactNode; short?: boolean }) {
  return (
    <div className={`frame rm-frame ${short ? 'is-short' : ''}`}>
      <div className="app-shell rm-shell">{children}</div>
    </div>
  );
}

function Page() {
  const solo = new URLSearchParams(location.search).get('solo');
  useEffect(() => {
    document.body.classList.toggle('rm-solo', !!solo);
  }, [solo]);
  const shown = solo ? PHONES.filter((p) => p.id === solo) : PHONES.filter((p) => p.id !== 'b');
  if (solo) return <Phone>{shown[0]?.body()}</Phone>;
  return (
    <div className="rm-page">
      <h1>Road map · Lanes</h1>
      <div className="rm-grid">
        {shown.map((p) => (
          <section key={p.id} className="rm-col">
            <h2>{p.name}</h2>
            <p>{p.note}</p>
            <Phone>{p.body()}</Phone>
          </section>
        ))}
      </div>
      <h1 className="rm-sub">The Guardian stop</h1>
      <div className="rm-grid">
        {GUARDIANS.map((g) => (
          <section key={g.id} className="rm-col">
            <h2>{g.name}</h2>
            <p>{g.note}</p>
            <Phone short>
              <RoadMap variant="lanes" guardian={g.art} top />
            </Phone>
          </section>
        ))}
      </div>
      <section className="rm-notes">
        <h2>Tensions</h2>
        <ul>
          <li>
            <b>One row at a time.</b> Today the map is a scene of the row in front of you. A road shows the whole act, so it has to decide what the far rows give away. Lanes shows what the rail already shows (every fight, the Elite, the Camp, the Guardian) and hide what a reward row holds under mist until it is next.
          </li>
          <li>
            <b>The fork is an illusion of geography.</b> Every row is fully connected to the next since 2026-09-08, so no lane closes anything. Lanes draws that honestly, the road always rejoins, but a road that splits invites the player to read it as a route that matters. (Signposts, picked against 2026-11-27, said it more plainly.)
          </li>
          <li>
            <b>Tap to preview.</b> The first tap lights a stop and raises a card with Go; the second goes.
          </li>
          <li>
            <b>Portrait 394×780.</b> Three lanes fit at about 124px apart with 62px stops; a three-wide row leaves no room for the road to wind, so the road straightens at every choice. One act is about 2,200px tall, three screens of scrolling, and scrolling is a gesture the map has never asked for.
          </li>
          <li>
            <b>The painting.</b> The Location backdrops are side-on landscapes, not ground seen from above. Lanes keeps the painting as the horizon the Guardian stands on and lay a top-down meadow below it; a real build would need ground art per Location.
          </li>
          <li>
            <b>The Guardian is never on the map</b> (2026-09-28). Every option is a place, not the creature; the Egg and the Lair come closest, hinting at it without drawing it. Today’s gate also carries the Guardian’s element as a seal on its door, which none of these do yet: the seal, the egg’s light or the pennant could take the type colour where they are gold or red now. No magenta anywhere: the Titan’s eye is retired (2026-11-27, per user direction).
          </li>
          <li>
            <b>The gate opens.</b> Tapping today’s gate plays a door-opening beat (three layers, 1250ms). A new landmark needs its own beat: the egg splitting, the pennant rising, the seal flaring.
          </li>
        </ul>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Page />);
