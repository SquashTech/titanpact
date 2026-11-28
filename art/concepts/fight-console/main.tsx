import type { CSSProperties, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import '../../../src/app/styles.css';
import '../../../src/app/storybook.css';
import './console.css';
import { HeroPortrait } from '../../../src/view/shared/HeroPortrait';
import { ElementGlyph } from '../../../src/view/shared/elementIcons';
import { getTypeColorRgb } from '../../../src/view/combat/typeColors';
import { ResourceGlyph } from '../../../src/view/shared/RunGlyph';
import { ConsoleGlyph } from '../../../src/view/combat/consoleGlyphs';
import forestMap from '../../../art/locations/map/forbiddenForest.png';

const CHAPTERS = [
  { n: 1, place: "Wild's Edge", guardian: 'ursa', state: 'done' },
  { n: 2, place: 'Forbidden Forest', state: 'next' },
  { n: 3, place: null, state: 'ahead' },
  { n: 4, place: null, state: 'ahead' },
] as const;

function Phone({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`fc-phone ${className}`}>{children}</div>;
}

function Option({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <section className="fc-option">
      <h3>{name}</h3>
      <p>{note}</p>
      {children}
    </section>
  );
}

function Plate({ children }: { children: ReactNode }) {
  return <button className="fc-plate">{children}</button>;
}

/* ---------- 3 · the seal ---------- */

function Contents() {
  return (
    <Phone className="fc-paper">
      <div className="fc-book-eyebrow">The Inkmaster's Book</div>
      <h2 className="fc-book-title">Contents</h2>
      <ol className="fc-toc">
        {CHAPTERS.map((c) => (
          <li key={c.n} className={`is-${c.state}`}>
            <span className="fc-toc-n">Chapter {c.n}</span>
            <span className="fc-toc-place">{c.place ?? '· · ·'}</span>
            {c.state === 'done' && (
              <span className="fc-toc-guardian">
                <HeroPortrait heroId={c.guardian} className="fc-toc-art" />
                <span className="fc-toc-tick">✓</span>
              </span>
            )}
            {c.state === 'next' && <span className="fc-ribbon" />}
          </li>
        ))}
      </ol>
      <div className="fc-grow" />
      <Plate>Turn the page</Plate>
    </Phone>
  );
}

function ChapterOpening() {
  return (
    <Phone className="fc-paper">
      <div className="fc-book-eyebrow">Chapter Two</div>
      <h2 className="fc-book-title">Forbidden Forest</h2>
      <div className="fc-plate-art">
        <img src={forestMap} alt="" />
      </div>
      <div className="fc-bookmarks">
        {CHAPTERS.map((c) => (
          <span key={c.n} className={`fc-bookmark is-${c.state}`}>
            {c.state === 'done' ? <HeroPortrait heroId={c.guardian} className="fc-bookmark-art" /> : <span>{c.n}</span>}
          </span>
        ))}
      </div>
      <div className="fc-grow" />
      <Plate>Begin</Plate>
    </Phone>
  );
}

/* ---------- 4 · the lead pick ---------- */

const LEADS = [
  { id: 'ronin', name: 'Ronin', types: ['Iron'], hp: [229, 229], mp: [25, 55], arrows: ['up', null], pick: 1 },
  { id: 'aegis', name: 'Aegis', types: ['Light'], hp: [203, 245], mp: [44, 54], arrows: [null, null] },
  { id: 'brimstone', name: 'Brimstone', types: ['Fire', 'Shadow'], hp: [202, 202], mp: [69, 69], arrows: ['down', 'up'] },
  { id: 'kitsu', name: 'Kitsu', types: ['Spirit'], hp: [140, 198], mp: [60, 60], arrows: ['up', 'up'] },
];

function TypeChip({ type }: { type: string }) {
  return (
    <span className="fc-type" style={{ '--t': getTypeColorRgb(type as never) } as CSSProperties}>
      <ElementGlyph type={type} />
    </span>
  );
}

function Arrow({ dir }: { dir: string | null }) {
  return <span className={`fc-arrow is-${dir ?? 'even'}`}>{dir === 'up' ? '▲' : dir === 'down' ? '▼' : '–'}</span>;
}

function FieldPlate({ hp, mp }: { hp: number[]; mp: number[] }) {
  return (
    <span className="fc-fplate">
      <span className="fc-fplate-hp" style={{ '--f': hp[0] / hp[1] } as CSSProperties}>
        <b>{hp[0]}</b>
      </span>
      <span className="fc-fplate-mp" style={{ '--f': mp[0] / mp[1] } as CSSProperties} />
      <span className="fc-fplate-disc">{mp[0]}</span>
    </span>
  );
}

function LeadHead() {
  return (
    <div className="fc-lead-head">
      <span>Choose your leads</span>
      <span className="fc-lead-slots">
        <HeroPortrait heroId="ronin" className="fc-lead-slot-art" />
        <span className="fc-lead-slot" />
      </span>
    </div>
  );
}

function LeadsA() {
  return (
    <Phone className="fc-cream">
      <LeadHead />
      <div className="fc-lead-grid">
        {LEADS.map((l) => (
          <div key={l.id} className={`fc-lead-a${l.pick ? ' is-picked' : ''}`}>
            {l.pick && <span className="fc-lead-pick">{l.pick}</span>}
            <HeroPortrait heroId={l.id} className="fc-lead-a-art" />
            <div className="fc-lead-a-top">
              <span className="fc-lead-name">
                <small>Lv</small>4 {l.name}
              </span>
              <span className="fc-lead-row">
                {l.types.map((t) => <TypeChip key={t} type={t} />)}
                <span className="fc-grow" />
                {l.arrows.map((a, i) => <Arrow key={i} dir={a} />)}
              </span>
            </div>
            <FieldPlate hp={l.hp} mp={l.mp} />
          </div>
        ))}
      </div>
    </Phone>
  );
}

function LeadsB() {
  return (
    <Phone className="fc-cream">
      <LeadHead />
      <div className="fc-lead-grid is-b">
        {LEADS.map((l) => (
          <div key={l.id} className={`fc-lead-b${l.pick ? ' is-picked' : ''}`} style={{ '--t': getTypeColorRgb(l.types[0] as never) } as CSSProperties}>
            {l.pick && <span className="fc-lead-pick">{l.pick}</span>}
            <span className="fc-lead-b-stage">
              <HeroPortrait heroId={l.id} className="fc-lead-b-art" />
              <span className="fc-lead-b-types">{l.types.map((t) => <TypeChip key={t} type={t} />)}</span>
              <span className="fc-lead-b-arrows">{l.arrows.map((a, i) => <Arrow key={i} dir={a} />)}</span>
            </span>
            <span className="fc-lead-name">
              <small>Lv</small>4 {l.name}
            </span>
            <FieldPlate hp={l.hp} mp={l.mp} />
          </div>
        ))}
      </div>
    </Phone>
  );
}

/* ---------- 5 · the action bar ---------- */

const SLICES: Record<string, ReactNode> = {
  Now: <path d="M21.5 2.5 9 15l-2.5-.3L6.2 12 18.8.3ZM3 21l4.3-4.3 1.4 1.4L4.4 22.4Z" />,
  Swipe: (
    <g fill="none" stroke="currentColor" strokeLinecap="round">
      <path d="M4 20C10 17 17 11 20 4" strokeWidth="3.2" />
      <path d="M3 13c4-1 8-4 10-8" strokeWidth="2" opacity="0.7" />
      <path d="M11 21c4-2 7-5 9-9" strokeWidth="2" opacity="0.7" />
    </g>
  ),
  Katana: (
    <g>
      <path d="M20.5 2.2c.6.6.4 2-1.4 4.4L9.6 16.2l-1.8-1.8 9.6-9.5c2.3-2.3 2.6-3.2 3.1-2.7Z" />
      <path d="M6.2 13.6l4.2 4.2-1.2 1.2-4.2-4.2Z" />
      <path d="M6.4 17.6l-3.6 3.6a1 1 0 0 0 1.4 1.4l3.6-3.6Z" />
    </g>
  ),
};

function SliceRow({ name }: { name: string }) {
  return (
    <div className="fc-move">
      <span className="fc-move-cost">40</span>
      <span className="fc-move-name">Shock Slice</span>
      <span className="fc-grow" />
      <svg viewBox="0 0 24 24" className="fc-slice" fill="currentColor">{SLICES[name]}</svg>
      <span className="fc-move-bleed">50%</span>
      <span className="fc-slice-label">{name}</span>
    </div>
  );
}

const KEYS = [
  { id: 'back', label: 'Back', glyph: <ConsoleGlyph kind="back" />, color: '#a59cc0' },
  { id: 'switch', label: 'Switch', glyph: <span className="fc-key-char">⇄</span>, color: '#38b6a8' },
  { id: 'rest', label: 'Rest', glyph: <span className="fc-key-char">☾</span>, color: '#6c63d9' },
  { id: 'bag', label: 'Bag', glyph: <ResourceGlyph kind="hpPotion" tone="inherit" />, color: '#f08a2c', count: 2 },
];

function Bar({ skin }: { skin: 'a' | 'b' }) {
  return (
    <Phone className="fc-cream fc-short">
      <SliceRow name={skin === 'a' ? 'Swipe' : 'Katana'} />
      <div className="fc-grow" />
      <div className={`fc-bar is-${skin}`}>
        {KEYS.map((k, i) => (
          <button key={k.id} className={`fc-key${i === 0 ? ' is-dark' : ''}`} style={{ '--k': k.color } as CSSProperties}>
            <span className="fc-key-face">
              {k.glyph}
              {k.count && <span className="fc-key-count">{k.count}</span>}
            </span>
            <span className="fc-key-label">{k.label}</span>
          </button>
        ))}
      </div>
    </Phone>
  );
}

function Page() {
  return (
    <div className="fc-page">
      <h1>Fight console and the book</h1>

      <h2>The Titan's Seal, replaced</h2>
      <div className="fc-row">
        <Option name="A · Contents" note="The book's contents page between chapters: each Guardian beaten ticked beside its place, a ribbon on the next chapter. Mirrors the End page.">
          <Contents />
        </Option>
        <Option name="B · Chapter opening" note="The next chapter's title page, the place painted as its plate, the Guardians beaten as bookmarks along the foot.">
          <ChapterOpening />
        </Option>
      </div>

      <h2>Choosing leads</h2>
      <div className="fc-row">
        <Option name="A · Field plates" note="Each card wears the same plate as the battlefield: HP number inside a full-width bar, mana on its disc. The tally becomes two slots that fill with faces.">
          <LeadsA />
        </Option>
        <Option name="B · Little stages" note="The hero stands on a tile of its type colour with chips and arrows on it, the field plate underneath.">
          <LeadsB />
        </Option>
      </div>

      <h2>Back · Switch · Rest · Bag, and the Slice mark</h2>
      <div className="fc-row">
        <Option name="A · Candy coins" note="Filled round keys in their own colours with white marks rimmed in ink, the label beneath. Shown with a swipe for Slice.">
          <Bar skin="a" />
        </Option>
        <Option name="B · Paper keys" note="Cream keys with an ink rim and a lip, the mark in its colour above the word. Shown with a katana for Slice.">
          <Bar skin="b" />
        </Option>
        <Option name="Slice marks" note="Today's blade, a swipe, a katana.">
          <Phone className="fc-cream fc-short">
            <SliceRow name="Now" />
            <SliceRow name="Swipe" />
            <SliceRow name="Katana" />
          </Phone>
        </Option>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Page />);
