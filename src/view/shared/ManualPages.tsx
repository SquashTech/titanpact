import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import type { StatKey } from '../../engine/content';
import type { MapNodeType } from '../../run/map';
import type { ManualPage } from '../../run/manual';
import type { ResourceKind } from './RunGlyph';
import { ResourceGlyph, RESOURCE_COLORS } from './RunGlyph';
import { MoveKindGlyph, StatGlyph, STAT_COLORS } from './statIcons';
import type { MoveKindGlyphKind } from './moveKind';
import { StatusGlyph, statusColor } from './statusIcons';
import { FieldGlyph } from './fieldIcons';
import { SeatArrow } from './MoveStrip';
import { TypeBadge } from './TypeBadge';
import { mapNodeArt, mapNodeIcon } from '../run/mapNodeArt';
import { TipPictureView } from '../run/TipScene';
import { PageText } from '../run/TipOverlay';
import { TIP_SCENES } from '../../data/tipScenes';
import { overlayHost } from './overlayHost';
import { useProfile } from './ProfileContext';
import { MANUAL_PAGES } from '../../data/howToPlay';
import { sky } from '../../data/sky';
import { isPageLearned } from '../../run/manual';
import './manualPages.css';

const KIND_COLORS: Record<MoveKindGlyphKind, string> = {
  physical: STAT_COLORS.attack,
  magical: STAT_COLORS.intelligence,
  heal: STAT_COLORS.hp,
  buff: '#e8c46a',
  debuff: '#a99cc4',
};

/** The few marks no other screen draws, in the stat glyphs' 24-box. */
const DRAWN: Record<string, ReactNode> = {
  spread: (
    <>
      <circle cx="7" cy="8" r="3.5" />
      <circle cx="17" cy="8" r="3.5" />
      <rect x="2.5" y="15" width="19" height="3.5" rx="1.75" />
    </>
  ),
  switch: (
    <>
      <path d="M4 8h12l-3-3M20 16H8l3 3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  leads: (
    <>
      <circle cx="8" cy="7" r="3" />
      <circle cx="16" cy="7" r="3" />
      <path d="M3 19c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5zM11 19c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5z" />
    </>
  ),
  lock: (
    <>
      <path d="M7 10V7.5a5 5 0 0 1 10 0V10" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="5" y="10" width="14" height="11" rx="2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M12 7v5l3.5 2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  banner: <path d="M6 3h2v18H6zM8 4h11l-3 4.5 3 4.5H8z" />,
  road: <path d="M10 3h4l5 18h-4l-1-4h-4l-1 4H5zm1.5 6-.8 4h2.6l-.8-4z" fillRule="evenodd" />,
  cycle: (
    <path
      d="M12 4a8 8 0 0 1 7.4 5H22l-3.5 4.5L15 9h2.2A6 6 0 0 0 6 12H4a8 8 0 0 1 8-8zm-7.5 6.5L8 15H5.8A6 6 0 0 0 18 12h2a8 8 0 0 1-15.4 3H2z"
    />
  ),
  paw: (
    <>
      <ellipse cx="12" cy="16" rx="5" ry="4" />
      <circle cx="6" cy="10" r="2" />
      <circle cx="10" cy="6.5" r="2" />
      <circle cx="14" cy="6.5" r="2" />
      <circle cx="18" cy="10" r="2" />
    </>
  ),
};

/** One mark of a page's emblem (run/manual.ts ManualPage.emblem). */
function EmblemMark({ mark }: { mark: string }) {
  const [kind, value] = mark.split(':');
  const tint = (color: string, child: ReactNode) => (
    <span className="manual-mark" style={{ '--mark-color': color } as CSSProperties}>
      {child}
    </span>
  );
  switch (kind) {
    case 'node': {
      const art = mapNodeArt(value as MapNodeType) ?? mapNodeIcon(value as MapNodeType);
      return art ? <img className="manual-mark manual-mark-art" src={art} alt="" draggable={false} /> : null;
    }
    case 'status':
      return tint(statusColor(value), <StatusGlyph statusId={value} className="manual-mark-glyph" />);
    case 'kind':
      return tint(KIND_COLORS[value as MoveKindGlyphKind], <MoveKindGlyph kind={value as MoveKindGlyphKind} className="manual-mark-glyph" />);
    case 'stat':
      return tint(STAT_COLORS[value as StatKey], <StatGlyph stat={value as StatKey} tone="inherit" className="manual-mark-glyph" />);
    case 'resource':
      return tint(RESOURCE_COLORS[value as ResourceKind], <ResourceGlyph kind={value as ResourceKind} tone="inherit" className="manual-mark-glyph" />);
    case 'arrow':
      return <span className="manual-mark manual-mark-arrow"><SeatArrow mult={value === 'super' ? 2 : 0.5} /></span>;
    case 'type':
      return <span className="manual-mark manual-mark-type"><TypeBadge type={value} iconOnly /></span>;
    case 'field':
      return tint('#e8a46a', <FieldGlyph fieldEffectId={value} className="manual-mark-glyph" />);
    case 'glyph':
      return tint(
        '#e9dcc0',
        <svg className="manual-mark-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          {DRAWN[value]}
        </svg>
      );
    default:
      return null;
  }
}

export function PageEmblem({ page }: { page: ManualPage }) {
  return (
    <span className={`manual-emblem${page.emblem.length > 1 ? ' is-pair' : ''}`} aria-hidden="true">
      {page.emblem.map((mark) => (
        <EmblemMark key={mark} mark={mark} />
      ))}
    </span>
  );
}

/** A page read whole: its pictures over the words they show (the How to Play page's own layout). */
export function PageBody({ page }: { page: ManualPage }) {
  const scenes = TIP_SCENES[page.id] ?? [];
  return (
    <div className="manual-page-body">
      {page.pages.map((text, i) => {
        const scene = scenes[i];
        return (
          <div key={i} className="howto-page">
            {scene && (
              <div className="tip-scene-frame">
                <TipPictureView scene={scene} />
              </div>
            )}
            <div className="howto-text">
              <PageText text={text} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One page over the screen, closed by a tap anywhere. */
export function PageReader({ page, onClose }: { page: ManualPage; onClose: () => void }) {
  return createPortal(
    <div
      className="detail-overlay manual-reader"
      onClick={(e) => {
        e.stopPropagation();
        playSfx('ui.back');
        onClose();
      }}
    >
      <div className="manual-reader-sheet">
        <div className="manual-reader-head">
          <PageEmblem page={page} />
          <h3 className="manual-reader-title">{page.title}</h3>
        </div>
        <PageBody page={page} />
      </div>
    </div>,
    overlayHost()
  );
}

/** How long each tile waits on the one before it. */
export const LEARNED_STAGGER_MS = 170;

/**
 * The pages a win filed, as tiles that land one after another, any one opened by a tap. `shown`
 * starts the landing; `landed` puts every tile down at once (the screen was tapped through).
 */
export function LearnedTiles({ pages, shown, landed = false }: { pages: readonly ManualPage[]; shown: boolean; landed?: boolean }) {
  const [count, setCount] = useState(landed ? pages.length : 0);
  const [reading, setReading] = useState<ManualPage | null>(null);

  useEffect(() => {
    if (landed) {
      setCount(pages.length);
      return;
    }
    if (!shown) return;
    const timers = pages.map((_, i) =>
      window.setTimeout(() => {
        setCount((n) => Math.max(n, i + 1));
        playSfx('ui.page', { pitch: 1 + i * 0.06 });
      }, i * LEARNED_STAGGER_MS)
    );
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, landed]);

  return (
    <>
      <div className={`manual-tiles${pages.length > 4 ? ' is-three' : ''}`}>
        {pages.map((page, i) => (
          <button
            key={page.id}
            type="button"
            className={`manual-tile${i < count ? ' is-landed' : ''}`}
            data-sfx="ui.select"
            onClick={(e) => {
              e.stopPropagation();
              setReading(page);
            }}
          >
            <PageEmblem page={page} />
            <span className="manual-tile-title">{page.title}</span>
          </button>
        ))}
      </div>
      {reading && <PageReader page={reading} onClose={() => setReading(null)} />}
    </>
  );
}

/** The book swings open, then each page takes this long to fly in and be turned over by the next. */
const BOOK_OPEN_MS = 700;
const LEAF_MS = 950;

/** Sparks off the book as the last page settles: angle (deg), reach (px), delay (s). */
const BOOK_SPARKS = Array.from({ length: 10 }, (_, i) => [i * 36 + 8, 70 + ((i * 23) % 40), +((i * 0.07) % 0.3).toFixed(2)] as const);

function LeafFace({ page, back }: { page: ManualPage; back?: boolean }) {
  return (
    <span className={`learned-leaf-face${back ? ' is-back' : ''}`}>
      <PageEmblem page={page} />
      <span className="learned-leaf-title">{page.title}</span>
      <span className="learned-leaf-rule" aria-hidden="true" />
    </span>
  );
}

/**
 * How to Play takes the pages a win filed: the book swings open, and each page flies up onto its
 * right side and is turned over by the next, so the last lies open on top. `landed` puts it there at
 * once. A tap on the open page reads it.
 */
export function LearnedBook({ pages, landed }: { pages: readonly ManualPage[]; landed: boolean }) {
  const [open, setOpen] = useState(landed);
  const [arrived, setArrived] = useState(landed ? pages.length : 0);
  const [reading, setReading] = useState<ManualPage | null>(null);
  const full = arrived >= pages.length;

  useEffect(() => {
    if (landed) {
      setOpen(true);
      setArrived(pages.length);
      return;
    }
    const timers = [window.setTimeout(() => setOpen(true), 120)];
    pages.forEach((_, i) =>
      timers.push(
        window.setTimeout(() => {
          setArrived((n) => Math.max(n, i + 1));
          playSfx('ui.page', { pitch: 1 + i * 0.07 });
          if (i === pages.length - 1) playSfx('discovery');
        }, BOOK_OPEN_MS + i * LEAF_MS)
      )
    );
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed]);

  const top = pages[arrived - 1];

  return (
    <>
      <div className={`learned-book${open ? ' is-open' : ''}${full ? ' is-full' : ''}${landed ? ' is-still' : ''}`}>
        <span className="learned-book-glow" aria-hidden="true" />
        <span className="learned-book-board" aria-hidden="true" />
        <span className="learned-book-page is-left" aria-hidden="true" />
        <span className="learned-book-page is-right" aria-hidden="true" />
        <span className="learned-book-cover" aria-hidden="true">
          <span className="learned-book-cover-front" />
          <span className="learned-book-cover-back" />
        </span>
        {pages.map((page, i) => (
          <button
            key={page.id}
            type="button"
            className={`learned-leaf${i < arrived - 1 ? ' is-turned' : i === arrived - 1 ? ' is-in' : ''}${i > 0 ? ' is-after' : ''}`}
            style={{ zIndex: i === arrived - 1 ? 50 : i + 1 } as CSSProperties}
            tabIndex={page === top ? 0 : -1}
            aria-label={page.title}
            onClick={(e) => {
              e.stopPropagation();
              if (page !== top) return;
              playSfx('ui.select');
              setReading(page);
            }}
          >
            <LeafFace page={page} />
            <LeafFace page={page} back />
          </button>
        ))}
        {full && !landed && (
          <span className="learned-book-sparks" aria-hidden="true">
            {BOOK_SPARKS.map(([a, reach, delay]) => (
              <i key={a} style={{ '--a': `${a}deg`, '--reach': `${reach}px`, animationDelay: `${delay}s` } as CSSProperties} />
            ))}
          </span>
        )}
      </div>
      {reading && <PageReader page={reading} onClose={() => setReading(null)} />}
    </>
  );
}

/** How long the book takes to file `count` pages, before the screen counts as landed. */
export function learnedBookMs(count: number): number {
  return BOOK_OPEN_MS + count * LEAF_MS;
}

/** The book's contents: First Light's trail, a star a lesson, then the Infinite's mark for what runs file. */
const SKY_W = 300;
const SKY_H = 92;
const RUN_CHAPTER = 'run';

function starPath(cx: number, cy: number, r: number): string {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rr = i % 2 ? r * 0.38 : r;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }
  return `${d}Z`;
}

/** The Infinite's mark: its nested rings. */
function ringsPath(cx: number, cy: number, r: number): string {
  return [1, 0.66, 0.32]
    .map((k) => {
      const rr = r * k;
      return `M${(cx - rr).toFixed(1)} ${cy}a${rr} ${rr} 0 1 0 ${2 * rr} 0a${rr} ${rr} 0 1 0 ${-2 * rr} 0`;
    })
    .join('');
}

/**
 * How to Play as the player has filled it (docs/the-sky.md §2c): the contents are the sky they
 * already know — a lit star opens the pages its lesson taught, a dark one is what is still to come —
 * and the Infinite's mark holds the pages runs have filed. A page not yet learned is not shown.
 */
export function ManualBook() {
  const profile = useProfile();
  const firstLight = sky.constellations.firstLight;
  const chapters = [...firstLight.stars.map((star) => star.id), RUN_CHAPTER];
  const learned = (id: string) => MANUAL_PAGES.filter((p) => (id === RUN_CHAPTER ? p.source.kind === 'run' : p.source.kind === 'lesson' && p.source.scenarioId === id)).filter((p) => isPageLearned(profile, p));
  const lit = (id: string) => learned(id).length > 0;
  // Opens where the player is: the last lesson won, or what runs have filed once the lessons are done.
  const lessons = chapters.slice(0, -1);
  const [chapter, setChapter] = useState(() =>
    lessons.every(lit) && lit(RUN_CHAPTER) ? RUN_CHAPTER : [...lessons].reverse().find(lit) ?? (lit(RUN_CHAPTER) ? RUN_CHAPTER : chapters[0])
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const pages = learned(chapter);

  const at = (x: number, y: number) => ({ x: 14 + x * (SKY_W - 74), y: 10 + y * (SKY_H - 20) });
  const runAt = { x: SKY_W - 26, y: SKY_H / 2 };

  return (
    <div className="manual-book">
      <svg className="manual-sky" viewBox={`0 0 ${SKY_W} ${SKY_H}`} role="tablist" aria-label="Chapters">
        {firstLight.lines.map(([a, b]) => {
          const p = at(firstLight.stars[a].x, firstLight.stars[a].y);
          const q = at(firstLight.stars[b].x, firstLight.stars[b].y);
          return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={`manual-sky-line${lit(firstLight.stars[b].id) ? ' is-lit' : ''}`} />;
        })}
        {firstLight.stars.map((star) => {
          const p = at(star.x, star.y);
          return (
            <g
              key={star.id}
              className={`manual-sky-star${lit(star.id) ? ' is-lit' : ''}${chapter === star.id ? ' is-chosen' : ''}`}
              role="tab"
              aria-selected={chapter === star.id}
              onClick={() => {
                playSfx('ui.select');
                setChapter(star.id);
                setOpenId(null);
              }}
            >
              <circle cx={p.x} cy={p.y} r={17} className="manual-sky-hit" />
              <circle cx={p.x} cy={p.y} r={13} className="manual-sky-ring" />
              <path d={starPath(p.x, p.y, 9)} className="manual-sky-core" />
            </g>
          );
        })}
        <g
          className={`manual-sky-star is-run${lit(RUN_CHAPTER) ? ' is-lit' : ''}${chapter === RUN_CHAPTER ? ' is-chosen' : ''}`}
          role="tab"
          aria-selected={chapter === RUN_CHAPTER}
          onClick={() => {
            playSfx('ui.select');
            setChapter(RUN_CHAPTER);
            setOpenId(null);
          }}
        >
          <circle cx={runAt.x} cy={runAt.y} r={22} className="manual-sky-hit" />
          <circle cx={runAt.x} cy={runAt.y} r={19} className="manual-sky-ring" />
          <path d={ringsPath(runAt.x, runAt.y, 13)} className="manual-sky-rings" />
        </g>
      </svg>

      {pages.length === 0 ? (
        <div className="manual-dark" aria-hidden="true">
          <svg viewBox="0 0 60 60">
            <path d={chapter === RUN_CHAPTER ? ringsPath(30, 30, 22) : starPath(30, 30, 24)} />
          </svg>
        </div>
      ) : (
        <div className="manual-entries">
          {pages.map((page) => {
            const open = page.id === openId;
            return (
              <section key={page.id} className={`manual-entry${open ? ' is-open' : ''}`}>
                <button type="button" className="manual-entry-head" aria-expanded={open} data-sfx="ui.select" onClick={() => setOpenId(open ? null : page.id)}>
                  <PageEmblem page={page} />
                  <span className="manual-entry-title">{page.title}</span>
                </button>
                {open && <PageBody page={page} />}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
