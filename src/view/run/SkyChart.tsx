import { useState, type CSSProperties } from 'react';
import { sky } from '../../data/sky';
import { trials } from '../../data/trials';
import { cycleOf } from '../../run/cycles';
import type { Profile } from '../../run/profile';
import { constellationState, isStarLit, starScenario, type ConstellationDefinition, type ConstellationState, type SkyStar } from '../../run/sky';
import { PlateButton } from '../shared/PlateButton';
import './skyChart.css';

// The title as the sky (docs/the-sky.md §2, §10 phase 4): every constellation the account can see,
// lit, open, or glimpsed as a shape with its reward. A tap opens one; its sheet lists its stars and
// holds the one press that plays it.

const W = 360;
const H = 440;

/** A constellation's box in the chart's units: the Trials hold fourteen stars and get more room. */
const boxOf = (c: ConstellationDefinition) => (c.stars.length > 6 ? 112 : 96);

/** Where a star sits in the chart. */
function place(c: ConstellationDefinition, star: SkyStar): { x: number; y: number } {
  const size = boxOf(c);
  return { x: c.at.x * W - size / 2 + star.x * size, y: c.at.y * H - size / 2 + star.y * size };
}

/** What the sheet's one press does, read off the kind of star the constellation holds. */
export type SkyPlay = 'journey' | 'cycles' | 'trials' | 'gauntlet';

function playOf(c: ConstellationDefinition): SkyPlay | null {
  switch (c.stars[0]?.light.kind) {
    case 'journeyWon':
      return 'journey';
    case 'cycleCleared':
      return 'cycles';
    case 'trialBeaten':
      return 'trials';
    case 'gauntletCleared':
      return 'gauntlet';
    default:
      return null;
  }
}

const PLAY_LABELS: Record<SkyPlay, string> = {
  journey: 'Begin a Journey',
  cycles: 'Choose a Cycle',
  trials: 'Open the Trials',
  gauntlet: 'Enter the Gauntlet',
};

function starName(star: SkyStar): string {
  const scenario = starScenario(sky, star);
  if (scenario) return scenario.name;
  switch (star.light.kind) {
    case 'journeyWon':
      return 'A Journey won';
    case 'cycleCleared': {
      const cycle = cycleOf(star.light.cycle);
      return `Cycle ${cycle.numeral} · ${cycle.name}`;
    }
    case 'trialBeaten':
      return trials[star.light.trialId]?.name ?? star.light.trialId;
    case 'gauntletCleared':
      return 'The Gauntlet cleared';
    default:
      return star.id;
  }
}

interface Props {
  profile: Profile;
  disabled?: boolean;
  onPlay: (play: SkyPlay) => void;
}

export function SkyChart({ profile, disabled = false, onPlay }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = Object.values(sky.constellations)
    .map((c) => ({ c, state: constellationState(profile, sky, c.id) }))
    .filter((entry): entry is { c: ConstellationDefinition; state: Exclude<ConstellationState, 'hidden'> } => entry.state !== 'hidden');
  const open = openId ? sky.constellations[openId] : null;

  return (
    <>
      <div className="sky-chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-label="The sky">
          <defs>
            <filter id="sky-chart-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {shown.map(({ c, state }) => {
            const size = boxOf(c);
            const lit = c.stars.map((star) => isStarLit(profile, c, star));
            const tappable = state !== 'glimpsed' && !disabled;
            const reward = c.rewards.reduce((sum, r) => sum + r.amount, 0);
            // A constellation of one star is a mode in itself; it is drawn larger so it reads as a place to go.
            const solo = c.stars.length === 1;
            return (
              <g
                key={c.id}
                className={`sky-con is-${state}${c.uncharted ? ' is-uncharted' : ''}`}
                role={tappable ? 'button' : undefined}
                tabIndex={tappable ? 0 : undefined}
                aria-label={tappable ? c.name : undefined}
                onClick={tappable ? () => setOpenId(c.id) : undefined}
                onKeyDown={
                  tappable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') setOpenId(c.id);
                      }
                    : undefined
                }
              >
                <circle className="sky-con-hit" cx={c.at.x * W} cy={c.at.y * H} r={size * 0.62} />
                {c.lines.map(([a, b]) => {
                  const p = place(c, c.stars[a]);
                  const q = place(c, c.stars[b]);
                  return <line key={`${a}-${b}`} className="sky-con-line" x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
                })}
                {solo && state !== 'glimpsed' && <circle className="sky-con-halo" cx={place(c, c.stars[0]).x} cy={place(c, c.stars[0]).y} r={14} />}
                {c.stars.map((star, i) => {
                  const p = place(c, star);
                  return (
                    <circle
                      key={star.id}
                      className={`sky-con-star${lit[i] ? ' is-lit' : ''}`}
                      cx={p.x}
                      cy={p.y}
                      r={(lit[i] ? 3.6 : 2.4) * (solo ? 1.6 : 1)}
                      filter={lit[i] ? 'url(#sky-chart-glow)' : undefined}
                      style={{ '--twinkle': `${(i * 0.37) % 2.4}s` } as CSSProperties}
                    />
                  );
                })}
                <text className="sky-con-name" x={c.at.x * W} y={c.at.y * H + (solo ? 24 : size / 2 + 12)} textAnchor="middle">
                  {c.name}
                </text>
                {state === 'glimpsed' && reward > 0 && (
                  <text className="sky-con-reward" x={c.at.x * W} y={c.at.y * H + (solo ? 36 : size / 2 + 24)} textAnchor="middle">
                    ✦ {reward}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {open && (
        <ConstellationSheet
          profile={profile}
          constellation={open}
          onClose={() => setOpenId(null)}
          onPlay={(play) => {
            setOpenId(null);
            onPlay(play);
          }}
        />
      )}
    </>
  );
}

function ConstellationSheet({
  profile,
  constellation,
  onClose,
  onPlay,
}: {
  profile: Profile;
  constellation: ConstellationDefinition;
  onClose: () => void;
  onPlay: (play: SkyPlay) => void;
}) {
  const play = playOf(constellation);
  const reward = constellation.rewards.reduce((sum, r) => sum + r.amount, 0);
  const lit = constellation.stars.map((star) => isStarLit(profile, constellation, star));
  const allLit = lit.every(Boolean);
  return (
    <div className="sky-sheet-scrim" onClick={onClose}>
      <div className="sky-sheet" role="dialog" aria-label={constellation.name} onClick={(e) => e.stopPropagation()}>
        <div className="sky-sheet-head">
          <span className="sky-sheet-name">{constellation.name}</span>
          {reward > 0 && !allLit && <span className="sky-sheet-reward">✦ {reward}</span>}
          <button type="button" className="sky-sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <ul className={`sky-sheet-stars${constellation.stars.length > 6 ? ' is-many' : ''}`}>
          {constellation.stars.map((star, i) => (
            <li key={star.id} className={`sky-sheet-star${lit[i] ? ' is-lit' : ''}`}>
              <span className="sky-sheet-star-mark" aria-hidden="true">
                {lit[i] ? '★' : '☆'}
              </span>
              {starName(star)}
            </li>
          ))}
        </ul>
        {constellation.uncharted && !allLit && <p className="sky-sheet-uncharted">Not yet charted.</p>}
        {play && (
          <PlateButton className="sky-sheet-play" onClick={() => onPlay(play)} data-sfx="ui.commit">
            {PLAY_LABELS[play]}
          </PlateButton>
        )}
      </div>
    </div>
  );
}
