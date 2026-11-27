import { useEffect, useRef, useState, type CSSProperties } from 'react';
import ReactDOM from 'react-dom/client';
import '../../../src/app/styles.css';
import '../../../src/app/storybook.css';
import './open.css';
import { playSfx } from '../../../src/audio/sfx';
import { rosterHeroes } from '../../../src/data/content';
import type { TypeId } from '../../../src/engine/content';
import { addRosterEntry, createRosterEntry, createRunState } from '../../../src/run/state';
import { recruitNodeEntry, rollRecruitHero } from '../../../src/run/recruitNode';
import { getTypeColorRgb } from '../../../src/view/combat/typeColors';
import { ElementGlyph } from '../../../src/view/shared/elementIcons';
import { seededRandom } from '../../../src/view/shared/seededRandom';
import { mapNodeIcon } from '../../../src/view/run/mapNodeArt';
import { RecruitOath } from '../../../src/view/run/RecruitOath';

// Three openings for the Recruit node, none showing who could answer. A pick plays into the real oath.
let run = createRunState();
for (const id of ['valor', 'crag', 'kitsu']) run = addRosterEntry(run, createRosterEntry(`${id}-1`, id, rosterHeroes[id].moveIds));
const TYPES: TypeId[] = ['Fire', 'Water', 'Nature'];
const entryFor = (type: TypeId) => {
  const id = rollRecruitHero(run, rosterHeroes, type, seededRandom(7, type))!;
  return recruitNodeEntry(run, rosterHeroes[id], `${id}-r`, seededRandom(7, `e${type}`));
};

type Phase = 'intro' | 'idle' | 'picked' | 'oath';

function useMock(introMs: number, pickMs: number, cues: [number, () => void][]) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [chosen, setChosen] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => {
    cues.forEach(([ms, fn]) => later(ms, fn));
    later(introMs, () => setPhase('idle'));
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = (i: number, pickCues: [number, () => void][] = []) => {
    if (phase !== 'idle') return;
    setChosen(i);
    setPhase('picked');
    pickCues.forEach(([ms, fn]) => later(ms, fn));
    later(pickMs, () => setPhase('oath'));
  };
  return { phase, chosen, pick };
}

function Oath({ type }: { type: TypeId }) {
  const entry = entryFor(type);
  return <RecruitOath run={addRosterEntry(run, entry)} entry={entry} onContinue={() => {}} />;
}

function Head() {
  return (
    <header className="ro-head">
      <img src={mapNodeIcon('recruitReward')} className="ro-horn" alt="" draggable={false} />
      <span className="ro-eyebrow">Word Goes Out</span>
      <h2 className="ro-title">Recruit</h2>
    </header>
  );
}

const rgb = (type: TypeId) => ({ '--t': getTypeColorRgb(type) }) as CSSProperties;

/** A · Dealt: three face-down cards dealt up from the bottom, flipped one by one. */
function Dealt({ head = <Head /> }: { head?: JSX.Element }) {
  const m = useMock(2100, 1500, [
    [700, () => playSfx('ui.page')],
    [850, () => playSfx('ui.page')],
    [1000, () => playSfx('ui.page')],
    [1400, () => playSfx('star.tick')],
    [1550, () => playSfx('star.tick')],
    [1700, () => playSfx('star.land')],
  ]);
  if (m.phase === 'oath') return <Oath type={TYPES[m.chosen!]} />;
  return (
    <div className={`ro-screen ro-dealt is-${m.phase}`}>
      {head}
      <div className="ro-cards">
        {TYPES.map((type, i) => (
          <button
            key={type}
            className={`ro-card${m.chosen === i ? ' is-chosen' : ''}`}
            style={{ ...rgb(type), '--i': i } as CSSProperties}
            onClick={() => m.pick(i, [[0, () => playSfx('star.charge')], [1200, () => playSfx('star.reveal')]])}
          >
            <span className="ro-card-inner">
              <span className="ro-card-back" />
              <span className="ro-card-face">
                <span className="ro-card-disc">
                  <ElementGlyph type={type} className="ro-card-glyph" />
                </span>
                <span className="ro-card-name">{type}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
      <button className="moveoffer-button moveoffer-decline ro-leave">
        <span className="moveoffer-label">Leave</span>
      </button>
      <span className="ro-flash" />
    </div>
  );
}

/** B · Stamped: an ink ring drawn on the page, three wax seals stamped into it; the picked one cracks open. */
function Stamped() {
  const m = useMock(1900, 1500, [
    [100, () => playSfx('quill.scratch')],
    [950, () => playSfx('wax.stamp')],
    [1200, () => playSfx('wax.stamp')],
    [1450, () => playSfx('wax.stamp')],
  ]);
  if (m.phase === 'oath') return <Oath type={TYPES[m.chosen!]} />;
  return (
    <div className={`ro-screen ro-stamped is-${m.phase}`}>
      <Head />
      <div className="ro-page">
        <svg className="ro-ink-ring" viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="150" cy="150" r="128" />
          <circle cx="150" cy="150" r="112" className="is-inner" />
        </svg>
        {TYPES.map((type, i) => (
          <button
            key={type}
            className={`ro-seal${m.chosen === i ? ' is-chosen' : ''}`}
            style={{ ...rgb(type), '--i': i, '--a': `${i * 120}deg` } as CSSProperties}
            onClick={() => m.pick(i, [[0, () => playSfx('star.charge')], [900, () => playSfx('seal.shatter')]])}
          >
            <span className="ro-seal-half is-left">
              <span className="ro-seal-body">
                <ElementGlyph type={type} className="ro-seal-glyph" />
                <span className="ro-seal-name">{type}</span>
              </span>
            </span>
            <span className="ro-seal-half is-right">
              <span className="ro-seal-body">
                <ElementGlyph type={type} className="ro-seal-glyph" />
                <span className="ro-seal-name">{type}</span>
              </span>
            </span>
            <span className="ro-seal-puff" />
          </button>
        ))}
      </div>
      <button className="moveoffer-button moveoffer-decline ro-leave">
        <span className="moveoffer-label">Leave</span>
      </button>
      <span className="ro-flash" />
    </div>
  );
}

/** C · Drawn: today's ring, drawn in arc by arc with no faces; the picked arc turns up and pours into an orb. */
function Drawn() {
  const m = useMock(1800, 1900, [
    [500, () => playSfx('star.tick')],
    [800, () => playSfx('star.tick')],
    [1100, () => playSfx('star.land')],
  ]);
  if (m.phase === 'oath') return <Oath type={TYPES[m.chosen!]} />;
  const span = 360 / TYPES.length;
  const turn = m.chosen === null ? 0 : -m.chosen * span;
  return (
    <div className={`ro-screen ro-drawn is-${m.phase}`} style={m.chosen === null ? undefined : rgb(TYPES[m.chosen])}>
      <Head />
      <div className="ro-wheel" style={{ '--turn': `${turn}deg` } as CSSProperties}>
        <svg className="ro-ink-ring" viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="150" cy="150" r="132" />
        </svg>
        <div className="ro-wheel-turn">
          {TYPES.map((type, i) => (
            <button
              key={type}
              className={`ro-arc${m.chosen === i ? ' is-chosen' : ''}`}
              style={{ ...rgb(type), '--i': i, '--a': `${i * span}deg`, '--span': `${span}deg`, '--wedge': wedge(i * span, span) } as CSSProperties}
              onClick={() =>
                m.pick(i, [
                  [0, () => playSfx('star.charge')],
                  [1000, () => playSfx('star.tick')],
                  [1250, () => playSfx('star.tick')],
                  [1500, () => playSfx('star.reveal')],
                ])
              }
            >
              <span className="ro-arc-fill" />
              <span className="ro-arc-label">
                <span className="ro-arc-upright">
                  <ElementGlyph type={type} className="ro-arc-glyph" />
                  <span className="ro-arc-name">{type}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
        <span className="ro-orb" />
      </div>
      <button className="moveoffer-button moveoffer-decline ro-leave">
        <span className="moveoffer-label">Leave</span>
      </button>
      <span className="ro-flash" />
    </div>
  );
}

/** A pie slice around `at` (0 is the top), so each arc only catches its own taps. */
function wedge(at: number, span: number): string {
  const pts = ['50% 50%'];
  for (let k = 0; k <= 6; k++) {
    const t = ((at - span / 2 + (span * k) / 6) * Math.PI) / 180;
    pts.push(`${50 + 72 * Math.sin(t)}% ${50 - 72 * Math.cos(t)}%`);
  }
  return `polygon(${pts.join(', ')})`;
}

function RibbonHead() {
  return (
    <header className="ro-head ro-ribbon-head">
      <span className="ro-ribbon">
        <span className="ro-ribbon-text">Recruit</span>
      </span>
    </header>
  );
}

function PosterHead() {
  return (
    <header className="ro-head ro-poster-head">
      <span className="ro-poster">
        <span className="ro-poster-tack" />
        <span className="ro-poster-text">Heroes Wanted</span>
      </span>
    </header>
  );
}

function BounceHead() {
  const words = ['A', 'New', 'Hero'];
  let n = 0;
  return (
    <header className="ro-head ro-bounce-head">
      <h2 className="ro-bounce">
        {words.map((w) => (
          <span key={w} className="ro-bounce-word">
            {[...w].map((ch) => (
              <span key={n} className="ro-bounce-ch" style={{ '--n': n++ } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
        ))}
      </h2>
    </header>
  );
}

const MOCKS = [
  { name: 'A · Ribbon', note: '“Recruit” on a ribbon that unfurls across the top. No icon, no line above.', C: () => <Dealt head={<RibbonHead />} /> },
  { name: 'B · Poster', note: '“Heroes Wanted” on a paper notice that swings in on its tack.', C: () => <Dealt head={<PosterHead />} /> },
  { name: 'C · Big title', note: '“A New Hero” in big inked letters that bounce in one by one.', C: () => <Dealt head={<BounceHead />} /> },
];

function Page() {
  const [keys, setKeys] = useState([0, 0, 0]);
  return (
    <div className="ro-page-wrap">
      <h1 className="ro-page-title">Recruit openings</h1>
      <div className="ro-grid">
        {MOCKS.map(({ name, note, C }, i) => (
          <section key={name} className="ro-col">
            <div className="ro-col-head">
              <h2>{name}</h2>
              <button onClick={() => setKeys((k) => k.map((v, j) => (j === i ? v + 1 : v)))}>Replay</button>
            </div>
            <p>{note}</p>
            <div className="app-shell ro-shell">
              <C key={keys[i]} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Page />);
