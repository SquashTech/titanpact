// The title's three doors as three pages (docs/gauntlet.md §7): Seal the Pact is the title itself,
// the Trials and the Gauntlet each a stage of their own a swipe or an arrow away.

import { useEffect, useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { deckRows, profileDeck } from '../../run/deck';
import { LOSSES_TO_END, WINS_TO_CLEAR } from '../../run/gauntlet';
import type { Profile } from '../../run/profile';
import { HeroPortrait } from '../shared/HeroPortrait';
import { getTypeColorRgb } from '../combat/typeColors';

export type TitleMode = 'trials' | 'pact' | 'gauntlet';

/** Left to right: the Pact in the middle, so either swipe from the title finds a mode. */
export const TITLE_MODES: readonly TitleMode[] = ['trials', 'pact', 'gauntlet'];

export const TITLE_MODE_LABELS: Record<TitleMode, string> = {
  trials: 'Trials',
  pact: 'Pact',
  gauntlet: 'Gauntlet',
};

function LockGlyph() {
  return (
    <svg className="title-cta-lock" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/**
 * The one press each page is built around. The bezel and the specular sweep are separate
 * elements rather than shadows on the button because the plate is chamfered by a
 * `clip-path`, and a clip-path takes the box-shadow with it — so the glow lives on the
 * socket outside the clip and the sweep lives inside it.
 *
 * It carries no colour of its own: the metal is a set of custom properties declared on an
 * ancestor — `.title-screen`'s tone for the Pact, each mode stage's own for the other two.
 * Locked, it still takes the press, so the tap can say what opens it.
 */
export function PactButton({ label, disabled, locked = false, onClick }: { label: string; disabled: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <div className={`title-cta-socket${locked ? ' is-locked' : ''}`}>
      <span className="title-cta-wing-tip is-left" aria-hidden="true" />
      <span className="title-cta-wing-tip is-right" aria-hidden="true" />
      <span className="title-cta-frame" aria-hidden="true" />
      <button className="resolve-button title-cta" onClick={onClick} disabled={disabled} aria-label={locked ? `${label}, locked` : undefined}>
        <span className="title-cta-sheen" aria-hidden="true" />
        <span className="title-cta-label">
          {locked && <LockGlyph />}
          {label}
        </span>
      </button>
    </div>
  );
}

/** One from each of six deck rows, shuffled once a visit: the six a player might build. */
function useTrialsSix(profile: Profile): string[] {
  // Rolled once a mount, not on every profile write.
  const [six] = useState(() => {
    const rows = deckRows(profileDeck(profile, heroes)).filter((row) => row.length > 0);
    const shuffled = [...rows].sort(() => Math.random() - 0.5).slice(0, 6);
    return shuffled.map((row) => row[Math.floor(Math.random() * row.length)]);
  });
  return six;
}

/** The whole deck, shuffled once: what the Gauntlet's reels spin through. */
function useOwnedReel(profile: Profile): string[] {
  const [reel] = useState(() => [...deckRows(profileDeck(profile, heroes)).flat()].sort(() => Math.random() - 0.5));
  return reel;
}

/** One reel steps each tick, in turn, so each spins every REEL_COUNT ticks and the three never land together. */
const REEL_TICK_MS = 420;
const REEL_COUNT = 3;

function TrialsScene({ profile }: { profile: Profile }) {
  const six = useTrialsSix(profile);
  const ranks = [six.slice(0, 3), six.slice(3, 6)];
  return (
    <div className="title-mode-scene trials-scene" aria-hidden="true">
      <svg className="trials-hall" viewBox="0 0 360 300" preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="trials-stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a4658" />
            <stop offset="1" stopColor="#141a24" />
          </linearGradient>
        </defs>
        {/* The arch the six stand under. */}
        <path className="trials-arch" d="M58 300 V112 Q180 -6 302 112 V300 H276 V118 Q180 20 84 118 V300 Z" fill="url(#trials-stone)" />
        <rect x="40" y="96" width="38" height="204" fill="url(#trials-stone)" />
        <rect x="282" y="96" width="38" height="204" fill="url(#trials-stone)" />
        <rect x="34" y="88" width="50" height="10" fill="#4c5a70" />
        <rect x="276" y="88" width="50" height="10" fill="#4c5a70" />
        {/* The keystone sigil: six points, one a seat. */}
        <g className="trials-sigil" transform="translate(180 54)">
          <circle r="17" fill="none" stroke="currentColor" strokeWidth="2" />
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i * Math.PI) / 3 - Math.PI / 2;
            return <circle key={i} cx={Math.cos(a) * 17} cy={Math.sin(a) * 17} r="3.2" fill="currentColor" />;
          })}
          <path d="M0 -9 L7.8 4.5 L-7.8 4.5 Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </g>
      </svg>
      <div className="trials-ranks">
        {ranks.map((rank, r) => (
          <div key={r} className={`trials-rank ${r === 0 ? 'is-back' : 'is-front'}`}>
            {rank.map((heroId, i) => (
              <span key={heroId} className="trials-figure" style={{ '--type-rgb': getTypeColorRgb(heroes[heroId]?.types[0] ?? 'Arcane'), '--rise-delay': `${0.15 + (r * 3 + i) * 0.08}s` } as CSSProperties}>
                <span className="trials-plinth" />
                <HeroPortrait heroId={heroId} className="trials-portrait" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function GauntletScene({ profile }: { profile: Profile }) {
  const reel = useOwnedReel(profile);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reel.length === 0) return;
    const id = window.setInterval(() => setTick((t) => t + 1), REEL_TICK_MS);
    return () => window.clearInterval(id);
  }, [reel.length]);
  return (
    <div className="title-mode-scene gauntlet-scene" aria-hidden="true">
      <svg className="gauntlet-arena" viewBox="0 0 360 300" preserveAspectRatio="xMidYMax meet">
        <defs>
          <linearGradient id="gauntlet-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a1210" />
            <stop offset="1" stopColor="#120807" />
          </linearGradient>
          <linearGradient id="gauntlet-mouth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#060303" />
            <stop offset="1" stopColor="#5a1a0c" />
          </linearGradient>
        </defs>
        {/* Two tiers of arches, the far tier darker, curving away at the ends like a ring. */}
        <path d="M0 150 Q180 118 360 150 V300 H0 Z" fill="url(#gauntlet-wall)" />
        {Array.from({ length: 9 }, (_, i) => {
          const x = 14 + i * 38;
          const dip = Math.abs(i - 4) * 3;
          return <path key={`u${i}`} d={`M${x} ${178 + dip} V${158 + dip} Q${x + 12} ${144 + dip} ${x + 24} ${158 + dip} V${178 + dip} Z`} fill="url(#gauntlet-mouth)" opacity="0.7" />;
        })}
        {Array.from({ length: 7 }, (_, i) => {
          const x = 10 + i * 50;
          const dip = Math.abs(i - 3) * 5;
          return <path key={`l${i}`} d={`M${x} ${300} V${222 + dip} Q${x + 17} ${200 + dip} ${x + 34} ${222 + dip} V300 Z`} fill="url(#gauntlet-mouth)" />;
        })}
        <path d="M0 192 Q180 168 360 192" fill="none" stroke="#5a2a1a" strokeWidth="3" />
      </svg>
      <svg className="gauntlet-emblem" viewBox="0 0 120 80">
        {/* Two blades crossed over a shield: fight, and fight again. */}
        <g className="gauntlet-blade">
          <path d="M18 8 L22 4 L84 66 L80 70 Z" />
          <path d="M76 58 L68 66" strokeWidth="5" className="gauntlet-guard" />
        </g>
        <g className="gauntlet-blade">
          <path d="M102 8 L98 4 L36 66 L40 70 Z" />
          <path d="M44 58 L52 66" strokeWidth="5" className="gauntlet-guard" />
        </g>
        <path className="gauntlet-shield" d="M60 20 L80 27 V44 Q80 60 60 70 Q40 60 40 44 V27 Z" />
        <path className="gauntlet-shield-mark" d="M60 30 L66 44 L60 56 L54 44 Z" />
      </svg>
      <div className="gauntlet-reels">
        {Array.from({ length: REEL_COUNT }, (_, i) => {
          const step = Math.floor((tick + REEL_COUNT - 1 - i) / REEL_COUNT);
          const heroId = reel.length ? reel[(step * REEL_COUNT + i * 5) % reel.length] : null;
          return (
            <span key={i} className={`gauntlet-reel${i === 1 ? ' is-center' : ''}`}>
              {heroId && (
                <span key={`${heroId}-${step}`} className="gauntlet-reel-face" style={{ '--type-rgb': getTypeColorRgb(heroes[heroId]?.types[0] ?? 'Fire') } as CSSProperties}>
                  <HeroPortrait heroId={heroId} className="gauntlet-portrait" />
                </span>
              )}
            </span>
          );
        })}
      </div>
      <div className="gauntlet-record">
        {Array.from({ length: WINS_TO_CLEAR }, (_, i) => (
          <span key={`w${i}`} className="gauntlet-brazier" style={{ '--flicker-delay': `${i * 0.37}s` } as CSSProperties} />
        ))}
        <span className="gauntlet-record-gap" />
        {Array.from({ length: LOSSES_TO_END }, (_, i) => (
          <span key={`l${i}`} className="gauntlet-skull" />
        ))}
      </div>
    </div>
  );
}

const MODE_COPY: Record<Exclude<TitleMode, 'pact'>, { word: string; line: string; cta: string; tone: string }> = {
  trials: { word: 'Trials', line: 'Build any six. Prove them in the Trials.', cta: 'Enter the Trials', tone: 'is-steel' },
  gauntlet: { word: 'Gauntlet', line: `Fifteen rolled. Draft six. ${WINS_TO_CLEAR} wins before ${LOSSES_TO_END} losses.`, cta: 'Run the Gauntlet', tone: 'is-ember' },
};

/** The light a mode page is lit in — below the ridge, like the Pact's backlight. */
export function ModeLight({ mode }: { mode: Exclude<TitleMode, 'pact'> }) {
  return <span key={mode} className={`title-mode-light is-${mode}`} aria-hidden="true" />;
}

/** A mode page: its scene, its wordmark and line, and the press that opens it. */
export function ModeStage({
  mode,
  profile,
  open,
  disabled,
  direction,
  onOpen,
  onLocked,
}: {
  mode: Exclude<TitleMode, 'pact'>;
  profile: Profile;
  open: boolean;
  disabled: boolean;
  /** +1 slid in from the right, -1 from the left. */
  direction: number;
  onOpen: () => void;
  onLocked: () => void;
}) {
  const copy = MODE_COPY[mode];
  return (
    <div key={mode} className={`title-mode-stage is-${mode} ${copy.tone}${open ? '' : ' is-shut'}`} style={{ '--slide': direction } as CSSProperties}>
      {mode === 'trials' ? <TrialsScene profile={profile} /> : <GauntletScene profile={profile} />}
      <div className="title-mode-mark">
        <span className="title-mode-the">The</span>
        <span className="title-mode-word" data-word={copy.word.toUpperCase()}>
          {copy.word.toUpperCase()}
        </span>
        <span className="title-mode-line">{copy.line}</span>
      </div>
      <div className="title-buttons">
        <PactButton label={copy.cta} disabled={disabled} locked={!open} onClick={open ? onOpen : onLocked} />
        <span className="title-mode-rail-seat" aria-hidden="true" />
      </div>
    </div>
  );
}

/** The three pages named along the foot of the stack; the lit one is where the player stands. */
export function ModeRail({ mode, onSelect }: { mode: TitleMode; onSelect: (mode: TitleMode) => void }) {
  return (
    <nav className="title-mode-rail" aria-label="Modes">
      {TITLE_MODES.map((m) => (
        <button key={m} type="button" className={`title-mode-rail-item${m === mode ? ' is-active' : ''}`} aria-current={m === mode ? 'page' : undefined} onClick={() => onSelect(m)}>
          <span className="title-mode-rail-dot" aria-hidden="true" />
          {TITLE_MODE_LABELS[m]}
        </button>
      ))}
    </nav>
  );
}

/** Edge chevrons to the neighbouring pages, named under the arrow. */
export function ModeArrows({ mode, onSelect }: { mode: TitleMode; onSelect: (mode: TitleMode) => void }) {
  const i = TITLE_MODES.indexOf(mode);
  const prev = TITLE_MODES[i - 1];
  const next = TITLE_MODES[i + 1];
  return (
    <>
      {prev && (
        <button type="button" className="title-mode-arrow is-left" aria-label={TITLE_MODE_LABELS[prev]} onClick={() => onSelect(prev)}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      )}
      {next && (
        <button type="button" className="title-mode-arrow is-right" aria-label={TITLE_MODE_LABELS[next]} onClick={() => onSelect(next)}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </>
  );
}
