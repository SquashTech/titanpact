import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { formatPlaytime, starredHeroCount, totalStars, type Profile } from '../../run/profile';
import { SEAL_ACTS } from '../../run/state';

interface Props {
  profile: Profile;
  /** Erases the profile and any parked run, then hands back a fresh profile to render. */
  onEraseAllData: () => void;
  onClose: () => void;
}

const ACT_ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const HERO_COUNT = Object.keys(heroes).length;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="records-stat">
      <span className="records-stat-value">{value}</span>
      <span className="records-stat-label">{label}</span>
    </div>
  );
}

/**
 * Lifetime figures, read once when this opens (profileStorage is not React state). Stars
 * themselves live on the Compendium tiles — this screen only counts them, so the two are
 * not two places to keep the same list.
 */
export function RecordsScreen({ profile, onEraseAllData, onClose }: Props) {
  // Two taps: this is the only control in the game that destroys something unrecoverable.
  const [confirmingErase, setConfirmingErase] = useState(false);

  const cleared = profile.runsCompleted;
  const played = profile.runsStarted;
  const winRate = played > 0 ? `${Math.round((cleared / played) * 100)}%` : '—';

  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel records-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Records</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="screen-scroll">
          <div className="records-grid">
            <Stat label="Playtime" value={formatPlaytime(profile.playtimeMs)} />
            <Stat label="Runs started" value={String(played)} />
            <Stat label="Runs cleared" value={String(cleared)} />
            <Stat label="Runs lost" value={String(profile.runsFailed)} />
            <Stat label="Clear rate" value={winRate} />
            <Stat
              label="Furthest act"
              value={
                profile.furthestAct > SEAL_ACTS
                  ? 'Finale'
                  : `${ACT_ROMAN[profile.furthestAct - 1] ?? profile.furthestAct} / ${SEAL_ACTS}`
              }
            />
          </div>

          <div className="records-section-title">Stars</div>
          <p className="records-note">
            A hero earns a star for every run cleared with them on the final roster. Stars show on their
            Compendium tile.
          </p>
          <div className="records-grid">
            <Stat label="Stars earned" value={String(totalStars(profile))} />
            <Stat label="Heroes starred" value={`${starredHeroCount(profile)} / ${HERO_COUNT}`} />
          </div>

          <div className="records-section-title">Data</div>
          <button
            className={`options-item options-item-danger${confirmingErase ? ' armed' : ''}`}
            onClick={() => {
              if (!confirmingErase) {
                setConfirmingErase(true);
                return;
              }
              setConfirmingErase(false);
              onEraseAllData();
            }}
          >
            <span className="options-item-glyph" aria-hidden="true">
              {confirmingErase ? '⚠' : '🗑'}
            </span>
            {confirmingErase ? 'Tap again to erase everything' : 'Erase All Data'}
          </button>
          <p className="records-note">
            {confirmingErase
              ? 'Records, stars and any parked run are deleted. This cannot be undone.'
              : 'Clears these records, every star, and any parked run. Sound settings are kept.'}
          </p>
        </div>
      </div>
    </div>
  );
}
